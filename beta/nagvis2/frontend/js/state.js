// NagVis 2 – state.js
// Globale Laufzeit-Variablen. Muss nach constants.js geladen werden.
'use strict';

//  STATE
// ═══════════════════════════════════════════════════════════════════════

let activeMapId  = null;
let activeMapCfg = null;
let wsClient     = null;
let editActive   = false;

// Globale Exports für gadget-renderer.js und andere externe Scripts
Object.defineProperty(window, 'editActive', {
  get: () => editActive,
  set: v  => { editActive = v; },
});
let pendingPos   = null;
let hostCache    = {};
let eventLog     = [];
let activeSnapin = null;
let currentTheme = 'dark';

// ── Kiosk-Rotations-System ──────────────────────────────────────────────
let _kioskUsers    = [];    // lokal gecacht (sync mit Backend)
let _kioskSession  = null;  // aktiver Kiosk-User bei Token-Login
let _kioskRotTimer = null;  // setInterval-Handle für Rotation
let _kioskRotIdx   = 0;     // aktueller Index in der Rotations-Reihenfolge
let _kioskProgress = null;  // Fortschrittsbalken-Element (bottom bar)


// ═══════════════════════════════════════════════════════════════════════