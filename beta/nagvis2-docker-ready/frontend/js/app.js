// NagVis 2 – app.js
// Einstiegspunkt: DOMContentLoaded, Event-Listener, Initialisierung.
// Wird zuletzt geladen – setzt alle anderen Module voraus.
'use strict';

/**
 * NagVis 2 – app.js
 * =================
 * Vollständige Applikationslogik: WebSocket, DOM-Rendering,
 * Edit-Mode, Theme-Switch, Dialoge, Snap-In Panels.
 *
 * Keine externe Abhängigkeit, kein Build-Step.
 * Kommuniziert mit dem FastAPI-Backend via REST + WebSocket.
 *
 * FIXES (März 2026):
 *   - Doppelte openMap()-Definition entfernt (Zoom-Stub überschrieb Original)
 *   - Doppelte showOverview()-Definition entfernt
 *   - Zoom-Button-IDs korrigiert: nv2-zoom-in/out → btn-zoom-in/out
 *   - NV2_ZOOM.init() in openMap() integriert
 *   - NV2_ZOOM.destroy() in showOverview() integriert
 *
 * NEU (Kiosk-Rotation):
 *   - Token-Login via ?kiosk=<token>
 *   - _initKioskSession(), _startKioskRotation()
 *   - openKioskUsersDlg() für Admin-Verwaltung
 */

'use strict';


// ═══════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {

  const savedTheme = localStorage.getItem('nv2-theme') ?? 'dark';
  setTheme(savedTheme, false);

  restoreSidebar();

  // ── Kiosk-Token aus URL (?kiosk=<token>)? ──────────────────────────
  const _urlKioskToken = new URLSearchParams(location.search).get('kiosk');
  if (_urlKioskToken) {
    _initKioskSession(_urlKioskToken);
  } else {
    _loadKioskUsers();
  }

  document.getElementById('btn-refresh')   .addEventListener('click', () => wsClient?.forceRefresh());
  document.getElementById('btn-add-host')  .addEventListener('click', () => openDlg('dlg-add-object'));
  document.getElementById('btn-kiosk')     .addEventListener('click', toggleKiosk);
  document.getElementById('bg-file-input') .addEventListener('change', e => {
    if (e.target.files[0]) uploadBg(e.target.files[0]);
    e.target.value = '';
  });

  document.getElementById('btn-sidebar-toggle-foot').addEventListener('click', toggleSidebar);

  document.addEventListener('click', e => {
    if (_burgerOpen && !e.target.closest('#burger-wrap')) closeBurgerMenu();
  });

  document.getElementById('nv2-canvas').addEventListener('click', onCanvasClick);

  setupDragDrop();
  document.addEventListener('keydown', onKeyDown);

  document.getElementById('btn-zoom-in') ?.addEventListener('click', () => NV2_ZOOM.zoomIn());
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => NV2_ZOOM.zoomOut());

  await detectDemoMode();
  await loadMaps();

  pollHealth();
  setInterval(pollHealth, 30_000);
});


// ═══════════════════════════════════════════════════════════════════════