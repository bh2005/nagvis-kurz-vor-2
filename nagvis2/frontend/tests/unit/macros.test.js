/**
 * Unit-Tests für resolveMacros() aus frontend/js/nodes.js (Zeilen 1-51)
 *
 * Funktion wird via setup.js in den jsdom-Scope geladen.
 */
import { describe, it, expect, beforeEach } from 'vitest'

describe('resolveMacros', () => {
  beforeEach(() => {
    globalThis.activeMapId = null
  })

  it('gibt obj.label zurück wenn kein Template angegeben', () => {
    expect(resolveMacros('', { label: 'myLabel', name: 'myName' }, {})).toBe('myLabel')
    expect(resolveMacros(null, { name: 'fallback' }, {})).toBe('fallback')
  })

  it('löst $HOSTNAME$ auf', () => {
    const result = resolveMacros('Host: $HOSTNAME$', { name: 'host1' }, { name: 'web01' })
    expect(result).toBe('Host: web01')
  })

  it('löst mehrere Macros im selben Template auf', () => {
    const result = resolveMacros(
      '$HOSTNAME$ ist $HOSTSTATE$',
      { name: 'host1' },
      { name: 'db01', state_label: 'DOWN' }
    )
    expect(result).toBe('db01 ist DOWN')
  })

  it('löst $LABEL:key$ mit lowercase key auf', () => {
    const result = resolveMacros(
      'Rack: $LABEL:RACK_ID$',
      { name: 'host1' },
      { labels: { rack_id: 'R-42' } }
    )
    expect(result).toBe('Rack: R-42')
  })

  it('löst $MAPNAME$ auf (activeMapId gesetzt)', () => {
    globalThis.activeMapId = 'datacenter-map'
    const result = resolveMacros('Map: $MAPNAME$', { name: 'x' }, {})
    expect(result).toBe('Map: datacenter-map')
  })

  it('lässt unbekannte Macros unverändert', () => {
    const result = resolveMacros('$FOOBAR$ bleibt', { name: 'x' }, {})
    expect(result).toBe('$FOOBAR$ bleibt')
  })

  it('löst $SERVICESTATE$ korrekt auf', () => {
    const result = resolveMacros(
      '$SERVICEDESC$: $SERVICESTATE$',
      { name: 'svc1' },
      { description: 'CPU Load', state_label: 'WARNING' }
    )
    expect(result).toBe('CPU Load: WARNING')
  })
})
