// NagVis 2 – state.js
// Globale Laufzeit-Variablen. Alle werden auf window.* gesetzt damit sie
// über <script>-Tag-Grenzen hinweg sichtbar sind ('use strict' + let = nur lokal).
'use strict';

// ── Kern-State ──────────────────────────────────────────────────────────
window.activeMapId   = null;
window.activeMapCfg  = null;
window.wsClient      = null;
window.editActive    = false;

// editActive als Property mit Getter/Setter für gadget-renderer.js
Object.defineProperty(window, 'editActive', {
  get: () => window._editActive ?? false,
  set: v  => { window._editActive = v; },
  configurable: true,
});

window.pendingPos    = null;
window.selectedNodes = new Set();   // Set<HTMLElement> — aktive Multi-Selektion
window.hostCache     = {};
window.serviceCache  = {};     // hostname → string[]  (service descriptions)
window.perfdataCache = {};     // "hostname::service_desc" → { metric: {value,unit,warn,crit,min,max} }
window.eventLog      = [];
window.activeSnapin  = null;
window.currentTheme  = 'dark';

// ── Kiosk-Rotations-System ──────────────────────────────────────────────
window._kioskUsers    = [];
window._kioskSession  = null;
window._kioskRotTimer = null;
window._kioskRotIdx   = 0;
window._kioskProgress = null;