/**
 * Unit-Tests für frontend/js/constants.js
 *
 * Getestete Funktionen:
 *   svgToDataUri(svg)           – SVG → data-URI (pure)
 *   iconSrc(iconset, stateLabel) – State-Label → { type, src } (pure)
 *
 * Funktionen werden via setup.js in den jsdom-Scope geladen.
 */
import { describe, it, expect } from 'vitest'

// ── svgToDataUri ──────────────────────────────────────────────────────

describe('svgToDataUri', () => {
  it('erzeugt eine korrekte data-URI mit Prefix', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'
    expect(svgToDataUri(svg)).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
  })

  it('encoded den SVG-Inhalt korrekt', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'
    expect(svgToDataUri(svg)).toBe(
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    )
  })

  it('behandelt Sonderzeichen in SVG (Anführungszeichen, Klammern)', () => {
    const svg = '<svg><text fill="#fff">OK (2/3)</text></svg>'
    const uri = svgToDataUri(svg)
    expect(uri).not.toContain('"')     // Anführungszeichen müssen encoded sein
    expect(uri).not.toContain('<')     // Spitze Klammern müssen encoded sein
  })
})

// ── iconSrc – State-Mapping ───────────────────────────────────────────

describe('iconSrc', () => {
  // Erwartetes Mapping: stateLabel → ICON_SVG-Key
  const stateCases = [
    ['UP',          'ok'],
    ['OK',          'ok'],
    ['WARNING',     'warning'],
    ['CRITICAL',    'critical'],
    ['DOWN',        'critical'],
    ['UNREACHABLE', 'critical'],
    ['PENDING',     'pending'],
    ['UNKNOWN',     'unknown'],
    [null,          'unknown'],
    [undefined,     'unknown'],
    ['',            'unknown'],
  ]

  it.each(stateCases)(
    'stateLabel=%s → SVG-Key "%s"',
    (label, expectedKey) => {
      const { type, src } = iconSrc(null, label)
      expect(type).toBe('img')
      expect(src).toBe(svgToDataUri(window.ICON_SVG[expectedKey]))
    }
  )

  it('gibt immer { type: "img", src: "data:..." } zurück', () => {
    const result = iconSrc('server', 'OK')
    expect(result).toMatchObject({
      type: 'img',
      src: expect.stringMatching(/^data:image\/svg\+xml/),
    })
  })

  it('ignoriert den iconset-Parameter (nur stateLabel zählt)', () => {
    // Verschiedene iconsets → gleiches stateLabel → identisches src
    const r1 = iconSrc('server',   'OK')
    const r2 = iconSrc('router',   'OK')
    const r3 = iconSrc('database', 'OK')
    expect(r1.src).toBe(r2.src)
    expect(r2.src).toBe(r3.src)
  })
})
