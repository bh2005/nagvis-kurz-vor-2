/**
 * Vitest Setup – lädt Vanilla-JS-Quelldateien in den jsdom-Scope.
 *
 * Strategie: Die Frontend-JS-Dateien nutzen window.* als globalen Namespace
 * (kein ES-Modul-System).  Wir evaluieren die benötigten Teile über
 * readFileSync + indirektes eval – so landen alle window.X-Zuweisungen
 * in globalThis (= window in jsdom).
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const JS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../js')

/** Evaluiert eine komplette JS-Datei im globalen Scope. */
function evalGlobal(filename) {
  const src = readFileSync(resolve(JS_DIR, filename), 'utf-8')
  // Indirektes eval → läuft im globalen Scope, nicht im Modul-Scope
  ;(0, eval)(src)
}

// ── constants.js ──────────────────────────────────────────────────────
// Setzt: window.ICON_SVG, window.STATE_CLS, window.STATE_BADGE,
//        svgToDataUri(), iconSrc(), updateNodeIcon()
evalGlobal('constants.js')

// constants.js weist window.* explizit zu, aber zur Sicherheit hier nochmal:
// In manchen jsdom/Node-Kombinationen landen window.* aus eval nicht
// automatisch als bare-name-Bindungen in ES-Modul-Testdateien.
globalThis.svgToDataUri   = globalThis.svgToDataUri   ?? globalThis.window?.svgToDataUri
globalThis.iconSrc        = globalThis.iconSrc        ?? globalThis.window?.iconSrc
globalThis.updateNodeIcon = globalThis.updateNodeIcon ?? globalThis.window?.updateNodeIcon

// ── nodes.js (nur Zeilen 1-51: resolveMacros) ─────────────────────────
// nodes.js ist ~2500 Zeilen lang und hat DOM-Abhängigkeiten.
// Wir laden nur den oberen Block, der resolveMacros enthält und
// keine DOM-Elemente referenziert.
// HINWEIS: 'use strict' in nodes.js verhindert, dass function-Deklarationen
// bei indirektem eval automatisch auf globalThis landen → explizit zuweisen.
const nodesSrc   = readFileSync(resolve(JS_DIR, 'nodes.js'), 'utf-8')
const macroLines = nodesSrc.split('\n').slice(0, 51).join('\n')
;(0, eval)(macroLines + '\nglobalThis.resolveMacros = resolveMacros')

// window.activeMapId standardmäßig auf null setzen (für $MAPNAME$-Tests)
globalThis.activeMapId = null
