// NagVis 2 – app.js
// Einstiegspunkt: DOMContentLoaded, Event-Listener, Initialisierung.
// Wird zuletzt geladen – setzt alle anderen Module voraus.
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