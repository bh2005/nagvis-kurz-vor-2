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
//  KONSTANTEN
// ═══════════════════════════════════════════════════════════════════════

const STATE_CLS = {
  UP:'nv2-ok', OK:'nv2-ok', WARNING:'nv2-warning', CRITICAL:'nv2-critical',
  UNKNOWN:'nv2-unknown', DOWN:'nv2-critical', UNREACHABLE:'nv2-critical', PENDING:'nv2-unknown',
};

const STATE_BADGE = {
  UP:'✓', OK:'✓', WARNING:'!', CRITICAL:'✕',
  UNKNOWN:'?', DOWN:'↓', UNREACHABLE:'↕', PENDING:'…',
};

const STATE_CHIP = {
  UP:'ok', OK:'ok', WARNING:'warn', CRITICAL:'crit',
  DOWN:'crit', UNREACHABLE:'crit', UNKNOWN:'unkn', PENDING:'unkn',
};

const ICONS_FALLBACK = {
  server:'🖥', router:'🌐', switch:'🔀', firewall:'🔥',
  storage:'💾', database:'🗄', ups:'⚡', ap:'📡', map:'🗺', default:'⬡',
};

const KNOWN_ICONSETS = ['std_small','server','router','switch','firewall','database','storage','ups','ap'];

let customIconsets = JSON.parse(localStorage.getItem('nv2-custom-iconsets') || '[]');

const ICON_SVG = {
  ok:       `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#13d38e"/><path d="M11 18l5 5 9-9" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  warning:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#ffa726"/><text x="18" y="24" text-anchor="middle" font-size="20" font-weight="bold" fill="#fff">!</text></svg>`,
  critical: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#f44336"/><path d="M12 12l12 12M24 12l-12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  unknown:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#9e9e9e"/><text x="18" y="24" text-anchor="middle" font-size="20" font-weight="bold" fill="#fff">?</text></svg>`,
  pending:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#9e9e9e"/><text x="18" y="24" text-anchor="middle" font-size="16" fill="#fff">…</text></svg>`,
  down:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#f44336"/><text x="18" y="24" text-anchor="middle" font-size="18" font-weight="bold" fill="#fff">↓</text></svg>`,
};

const ICONSET_SHAPE = {
  server:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="6" y="8" width="24" height="7" rx="2" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><rect x="6" y="18" width="24" height="7" rx="2" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><circle cx="10" cy="11.5" r="1.2" fill="rgba(255,255,255,0.85)"/><circle cx="10" cy="21.5" r="1.2" fill="rgba(255,255,255,0.85)"/></svg>`,
  router:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="8" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><line x1="18" y1="6" x2="18" y2="30" stroke="rgba(255,255,255,0.85)" stroke-width="1"/><line x1="6" y1="18" x2="30" y2="18" stroke="rgba(255,255,255,0.85)" stroke-width="1"/></svg>`,
  switch:   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="5" y="14" width="26" height="8" rx="2" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><line x1="10" y1="14" x2="10" y2="10" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><line x1="18" y1="14" x2="18" y2="10" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><line x1="26" y1="14" x2="26" y2="10" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><line x1="10" y1="22" x2="10" y2="26" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><line x1="18" y1="22" x2="18" y2="26" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><line x1="26" y1="22" x2="26" y2="26" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/></svg>`,
  firewall: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="7" y="7" width="22" height="22" rx="2" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><line x1="7" y1="14" x2="29" y2="14" stroke="rgba(255,255,255,0.85)" stroke-width="1"/><line x1="7" y1="22" x2="29" y2="22" stroke="rgba(255,255,255,0.85)" stroke-width="1"/><line x1="14" y1="7" x2="14" y2="29" stroke="rgba(255,255,255,0.85)" stroke-width="1"/><line x1="22" y1="7" x2="22" y2="29" stroke="rgba(255,255,255,0.85)" stroke-width="1"/></svg>`,
  database: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><ellipse cx="18" cy="11" rx="10" ry="4" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><path d="M8 11v14c0 2.2 4.5 4 10 4s10-1.8 10-4V11" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><path d="M8 18c0 2.2 4.5 4 10 4s10-1.8 10-4" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1"/></svg>`,
  storage:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="6" y="9" width="24" height="18" rx="2" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><line x1="6" y1="16" x2="30" y2="16" stroke="rgba(255,255,255,0.85)" stroke-width="1"/><line x1="6" y1="22" x2="30" y2="22" stroke="rgba(255,255,255,0.85)" stroke-width="1"/></svg>`,
  ups:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="8" y="7" width="20" height="22" rx="2" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/><path d="M20 16l-4 5h4l-4 5" stroke="rgba(255,255,255,0.85)" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
  ap:       `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="22" r="3" fill="rgba(255,255,255,0.85)"/><path d="M12 17a8.5 8.5 0 0 1 12 0" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" stroke-linecap="round"/><path d="M8 13a14 14 0 0 1 20 0" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  map:      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M6 8l8 3 8-3 8 3v18l-8-3-8 3-8-3z" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" stroke-linejoin="round"/><line x1="14" y1="8" x2="14" y2="28" stroke="rgba(255,255,255,0.85)" stroke-width="1"/><line x1="22" y1="5" x2="22" y2="25" stroke="rgba(255,255,255,0.85)" stroke-width="1"/></svg>`,
  default:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><polygon points="18,4 32,28 4,28" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  std_small:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect x="9" y="9" width="18" height="18" rx="3" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"/></svg>`,
};

function svgToDataUri(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function iconSrc(iconset, stateLabel) {
  const stateKey = !stateLabel ? 'unknown'
    : stateLabel === 'UP' || stateLabel === 'OK'              ? 'ok'
    : stateLabel === 'WARNING'                                 ? 'warning'
    : stateLabel === 'CRITICAL' || stateLabel === 'DOWN'       ? 'critical'
    : stateLabel === 'UNREACHABLE'                             ? 'critical'
    : stateLabel === 'PENDING'                                 ? 'pending'
    : 'unknown';
  return { type: 'img', src: svgToDataUri(ICON_SVG[stateKey] ?? ICON_SVG.unknown) };
}

function updateNodeIcon(el, stateLabel) {
  const ring = el.querySelector('.nv2-ring');
  if (!ring) return;
  const { src } = iconSrc(null, stateLabel);
  const img = ring.querySelector('img.nv2-icon');
  if (img) img.src = src;
}


// ═══════════════════════════════════════════════════════════════════════
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
//  SIDEBAR TOGGLE
// ═══════════════════════════════════════════════════════════════════════

let sidebarCollapsed = false;

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  const sidebar = document.getElementById('sidebar');
  const app     = document.getElementById('app');

  sidebar.classList.toggle('collapsed', sidebarCollapsed);

  if (sidebarCollapsed) {
    app.style.gridTemplateColumns = '44px 1fr';
    app.classList.remove('sidebar-expanded');
  } else {
    app.style.gridTemplateColumns = 'var(--sidebar) 1fr';
    if (app.classList.contains('map-open')) {
      app.classList.add('sidebar-expanded');
    }
  }

  localStorage.setItem('nv2-sidebar', sidebarCollapsed ? '1' : '0');
}

function restoreSidebar() {
  if (localStorage.getItem('nv2-sidebar') === '1') {
    sidebarCollapsed = true;
    document.getElementById('sidebar').classList.add('collapsed');
    document.getElementById('app').style.gridTemplateColumns = '44px 1fr';
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  BURGER MENÜ
// ═══════════════════════════════════════════════════════════════════════

let _burgerOpen = false;

function toggleBurgerMenu() {
  _burgerOpen ? closeBurgerMenu() : openBurgerMenu();
}

function openBurgerMenu() {
  _burgerOpen = true;
  const dd = document.getElementById('burger-dropdown');
  dd.style.display = 'block';
  const mapSec = document.getElementById('burger-map-section');
  if (mapSec) mapSec.style.display = activeMapId ? 'block' : 'none';
  const ico   = document.getElementById('burger-theme-ico');
  const label = document.getElementById('burger-theme-label');
  if (ico)   ico.textContent   = currentTheme === 'dark' ? '☀' : '☽';
  if (label) label.textContent = currentTheme === 'dark' ? 'Light-Theme' : 'Dark-Theme';
  document.getElementById('btn-menu').classList.add('on');
}

function closeBurgerMenu() {
  _burgerOpen = false;
  const dd = document.getElementById('burger-dropdown');
  if (dd) dd.style.display = 'none';
  document.getElementById('btn-menu')?.classList.remove('on');
}

window.toggleBurgerMenu    = toggleBurgerMenu;
window.closeBurgerMenu     = closeBurgerMenu;
window.showNodeContextMenu = showNodeContextMenu;  // für gadget-renderer.js

function setTheme(theme, save = true) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const ico   = document.getElementById('burger-theme-ico');
  const label = document.getElementById('burger-theme-label');
  if (ico)   ico.textContent   = theme === 'dark' ? '☀' : '☽';
  if (label) label.textContent = theme === 'dark' ? 'Light-Theme' : 'Dark-Theme';
  if (save) localStorage.setItem('nv2-theme', theme);
  updateThemeChips();
}


// ═══════════════════════════════════════════════════════════════════════
//  MAPS LADEN & RENDERN
// ═══════════════════════════════════════════════════════════════════════

async function loadMaps() {
  const maps = await api('/api/maps') ?? [];
  renderSidebarMaps(maps);
  renderOverview(maps);
}

function renderSidebarMaps(maps) {
  const el = document.getElementById('sidebar-maps');
  if (!maps.length) {
    el.innerHTML = '<div style="padding:5px 10px 5px 20px;font-size:11px;color:var(--text-dim)">Keine Maps</div>';
    renderMapsSnapin(maps);
    return;
  }
  el.innerHTML = maps.map(m => `
    <div class="map-entry" id="smap-${esc(m.id)}" data-map-id="${esc(m.id)}" data-title="${esc(m.title)}">
      <div class="map-pip unkn" id="mpip-${esc(m.id)}" title="${esc(m.title)}"></div>
      <span class="map-entry-title">${esc(m.title)}</span>
    </div>`).join('');

  el.querySelectorAll('.map-entry').forEach(entry => {
    entry.addEventListener('click', () => openMap(entry.dataset.mapId));
  });

  renderMapsSnapin(maps);
}

function renderMapsSnapin(maps) {
  const body = document.getElementById('body-maps');
  if (!body) return;
  if (!maps.length) {
    body.innerHTML = '<div class="empty-hint">Keine Maps vorhanden</div>';
    return;
  }
  body.innerHTML = maps.map(m => `
    <div class="map-snap-entry ${activeMapId === m.id ? 'active' : ''}"
         data-map-id="${esc(m.id)}">
      <div class="ms-pip unkn" id="mspip-${esc(m.id)}"></div>
      <span class="ms-title">${esc(m.title)}</span>
      <span class="ms-count">${m.object_count ?? 0}</span>
    </div>`).join('');

  body.querySelectorAll('.map-snap-entry').forEach(entry => {
    entry.addEventListener('click', () => {
      openMap(entry.dataset.mapId);
      closeSnapin('maps');
    });
  });
}

function renderOverview(maps) {
  const grid = document.getElementById('ov-grid');

  const cards = maps.map(m => `
    <div class="ov-card" data-map-id="${esc(m.id)}">
      <div class="ov-card-header">
        <div class="ov-card-title">${esc(m.title)}</div>
        <button class="ov-card-menu-btn" data-map-id="${esc(m.id)}"
                title="Map-Optionen" onclick="event.stopPropagation(); openCardMenu(event, '${esc(m.id)}', '${esc(m.title)}')">⋯</button>
      </div>
      <div class="ov-card-meta">${m.object_count ?? 0} Objekte · <span class="ov-card-id">${esc(m.id)}</span></div>
      ${m.parent_map ? `<div class="ov-card-parent">↳ ${esc(m.parent_map)}</div>` : ''}
      <div class="ov-card-pills">
        <span class="ov-card-pill ok">UP –</span>
        <span class="ov-card-pill warn">W –</span>
        <span class="ov-card-pill crit">C –</span>
      </div>
    </div>`).join('');

  grid.innerHTML = cards + `
    <div class="ov-new" id="btn-new-map">
      <span style="font-size:18px;line-height:1">＋</span> Neue Map
    </div>`;

  grid.querySelectorAll('.ov-card').forEach(card => {
    card.addEventListener('click', () => openMap(card.dataset.mapId));
  });
  document.getElementById('btn-new-map')?.addEventListener('click', dlgNewMap);
}

function openCardMenu(e, mapId, mapTitle) {
  closeCardMenu();
  const menu = document.createElement('div');
  menu.id = 'card-ctx-menu';
  menu.className = 'ctx-menu';
  menu.style.cssText = `position:fixed;top:${e.clientY + 4}px;left:${e.clientX - 140}px`;
  menu.innerHTML = `
    <button class="ctx-item" onclick="closeCardMenu(); openMap('${esc(mapId)}')">▶ Öffnen</button>
    <button class="ctx-item" onclick="closeCardMenu(); _renameMapId='${esc(mapId)}';
      document.getElementById('rename-map-title').value='${esc(mapTitle)}';
      openDlg('dlg-rename-map')">✎ Umbenennen</button>
    <button class="ctx-item" onclick="closeCardMenu(); _parentMapId='${esc(mapId)}'; openParentMapDlg()">
      🗺 Parent-Map setzen</button>
    <button class="ctx-item" onclick="closeCardMenu(); exportMapById('${esc(mapId)}')">
      📤 Exportieren (.zip)</button>
    <button class="ctx-item ctx-danger"
      onclick="closeCardMenu(); _deleteMapId='${esc(mapId)}'; _deleteMapTitle='${esc(mapTitle)}'; confirmDeleteMapById()">
      🗑 Löschen</button>`;
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', closeCardMenu, { once: true }), 0);
}

function closeCardMenu() {
  document.getElementById('card-ctx-menu')?.remove();
}


async function openMap(mapId) {
  activeMapId  = mapId;
  activeMapCfg = await api(`/api/maps/${mapId}`);
  if (!activeMapCfg) { alert('Map nicht gefunden'); return; }

  document.getElementById('app')?.classList.add('map-open');
  document.getElementById('app').style.gridTemplateColumns = '44px 1fr';
  document.getElementById('overview')         .style.display = 'none';
  document.getElementById('map-area')         .style.display = 'block';
  document.getElementById('map-toolbar')      .style.display = 'flex';
  document.getElementById('tb-pills')         .style.display = 'flex';
  document.getElementById('snap-tabs')        .style.display = 'flex';
  document.getElementById('snapin-container') .style.display = 'block';
  const bms = document.getElementById('burger-map-section');
  if (bms) bms.style.display = 'block';

  document.getElementById('tb-title').textContent = activeMapCfg.title;
  document.getElementById('tb-sub')  .textContent =
    `${activeMapCfg.objects?.length ?? 0} Objekte · ${mapId}`;

  document.querySelectorAll('.map-entry').forEach(e => e.classList.remove('active'));
  document.getElementById('nav-btn-overview')?.classList.remove('active');
  document.getElementById(`smap-${mapId}`)?.classList.add('active');

  const canvas = document.getElementById('nv2-canvas');
  canvas.innerHTML = '';
  canvas.dataset.mapId = mapId;

  const wrapper = document.createElement('div');
  wrapper.id = 'map-canvas-wrapper';
  canvas.appendChild(wrapper);

  if (activeMapCfg.background) {
    setBg(`/${activeMapCfg.background}`);
  } else {
    canvas.style.backgroundImage = '';
  }

  applyCanvasMode(canvas, activeMapCfg.canvas);

  for (const obj of activeMapCfg.objects ?? []) {
    const el = createNode(obj);
    if (el && obj.layer != null) el.dataset.layer = obj.layer;
  }
  initLayers(activeMapCfg.objects ?? []);

  if (wsClient) {
    wsClient._dead = true;
    wsClient.ws?.close();
  }
  wsClient = _demoMode ? makeDemoWsClient(mapId) : makeWsClient(mapId);
  wsClient.connect();

  const zoomControls = document.getElementById('nv2-zoom-controls');
  if (zoomControls) zoomControls.style.display = 'flex';
  if (window.NV2_ZOOM) {
    NV2_ZOOM.reset();
    NV2_ZOOM.init(canvas, wrapper);
  }
}

function showOverview() {
  document.getElementById('app')?.classList.remove('map-open');
  document.getElementById('app')?.classList.remove('sidebar-expanded');
  document.getElementById('app').style.gridTemplateColumns =
    sidebarCollapsed ? '44px 1fr' : 'var(--sidebar) 1fr';
  document.getElementById('overview')         .style.display = 'block';
  document.getElementById('map-area')         .style.display = 'none';
  document.getElementById('map-toolbar')      .style.display = 'none';
  document.getElementById('tb-pills')         .style.display = 'none';
  document.getElementById('snap-tabs')        .style.display = 'none';
  document.getElementById('snapin-container') .style.display = 'none';
  const bms = document.getElementById('burger-map-section');
  if (bms) bms.style.display = 'none';
  closeBurgerMenu();

  document.getElementById('tb-title').textContent = 'NagVis 2';
  document.getElementById('tb-sub')  .textContent = 'Wähle eine Map';
  document.getElementById('nav-btn-overview').classList.add('active');
  document.querySelectorAll('.map-entry').forEach(e => e.classList.remove('active'));

  if (wsClient) { wsClient._dead = true; wsClient.ws?.close(); wsClient = null; }
  closeSnapin(activeSnapin);
  hostCache = {};
  activeMapId = null;
  if (editActive) toggleEdit();

  const zoomControls = document.getElementById('nv2-zoom-controls');
  if (zoomControls) zoomControls.style.display = 'none';
  if (window.NV2_ZOOM) NV2_ZOOM.destroy();

  loadMaps();
}

window.showOverview = showOverview;


// ═══════════════════════════════════════════════════════════════════════
//  WEBSOCKET CLIENT
// ═══════════════════════════════════════════════════════════════════════

function makeWsClient(mapId) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url   = `${proto}://${location.host}/ws/map/${mapId}`;

  const client = {
    mapId, ws: null, _dead: false, _delay: 2000,

    connect() {
      if (this._dead) return;
      this.ws = new WebSocket(url);
      this.ws.onopen    = () => { this._delay = 2000; onWsOpen(); };
      this.ws.onmessage = e => { try { onWsMsg(JSON.parse(e.data)); } catch { } };
      this.ws.onclose   = () => {
        if (this._dead) return;
        onWsClose();
        setTimeout(() => this.connect(), this._delay);
        this._delay = Math.min(this._delay * 1.5, 30_000);
      };
      this.ws.onerror = () => { };
    },

    send(data) {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
    },

    forceRefresh() { this.send({ cmd: 'force_refresh' }); },

    disconnect() { this._dead = true; this.ws?.close(); },
  };

  return client;
}

function onWsOpen()  { setConnDot('connected');    setSidebarLive(true,  'Livestatus · verbunden'); }
function onWsClose() { setConnDot('disconnected'); setSidebarLive(false, 'Getrennt – verbinde…');   setStatusBar('Verbindung unterbrochen…'); }


// ═══════════════════════════════════════════════════════════════════════
//  WEBSOCKET MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════

function onWsMsg(ev) {
  switch (ev.event) {

    case 'snapshot':
      applyStatuses(ev.hosts ?? [], ev.services ?? []);
      updateTopbarPills(ev.hosts ?? []);
      renderHostsPanel(ev.hosts ?? []);
      fillHostDatalist(ev.hosts ?? []);
      setStatusBar(`${fmt(ev.ts)} · Snapshot · ${ev.hosts?.length ?? 0} Hosts`);
      break;

    case 'status_update': {
      applyStatuses(ev.hosts ?? [], ev.services ?? []);
      updateTopbarPills(Object.values(hostCache));
      renderHostsPanel(Object.values(hostCache));
      appendEvents(ev.hosts ?? [], ev.services ?? [], ev.ts);
      if (ev.downtime_started?.length) showDowntimeBanner(ev.downtime_started, true);
      if (ev.downtime_ended?.length)   showDowntimeBanner(ev.downtime_ended,   false);
      const n = (ev.hosts?.length ?? 0) + (ev.services?.length ?? 0);
      setStatusBar(`${fmt(ev.ts)} · ${n} Änderung${n !== 1 ? 'en' : ''} · ${ev.elapsed}ms`);
      break;
    }

    case 'heartbeat':
      setStatusBar(`${fmt(ev.ts)} · live ♥`);
      break;

    case 'object_added':
      if (ev.map_id === activeMapId) {
        const el = createNode(ev.object);
        if (el && editActive) makeDraggable(el);
      }
      break;

    case 'object_removed':
      document.getElementById(`nv2-${ev.object_id}`)?.remove();
      break;

    case 'gadget_update': {
      const gadget = document.getElementById(`nv2-${ev.object_id}`);
      if (gadget) updateGadget(gadget, ev);
      break;
    }

    case '_connected':    setConnDot('connected');    break;
    case '_disconnected': setConnDot('disconnected'); break;
    case 'backend_error': setStatusBar(`⚠ ${ev.message}`); break;
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  NODE RENDERING
// ═══════════════════════════════════════════════════════════════════════

function createNode(obj) {
  if (document.getElementById(`nv2-${obj.object_id}`)) return null;
  switch (obj.type) {
    case 'host': case 'service': case 'hostgroup': case 'servicegroup': case 'map':
      return _renderMonitoringNode(obj);
    case 'textbox':   return _renderTextbox(obj);
    case 'line':      return _renderLine(obj);
    case 'container': return _renderContainer(obj);
    case 'gadget':
      if (typeof createGadget !== 'function') {
        console.error('[NV2] createGadget nicht verfügbar – gadget-renderer.js geladen?');
        return null;
      }
      return createGadget(obj);
    default:
      console.warn('[NV2] createNode: unbekannter Typ', obj.type);
      return null;
  }
}

function _renderMonitoringNode(obj) {
  const { src: statusSrc } = iconSrc(obj.iconset ?? 'std_small', null);
  const size     = obj.size ?? 32;
  const iconset  = obj.iconset ?? 'std_small';
  const shapeSvg = ICONSET_SHAPE[iconset] ?? ICONSET_SHAPE.std_small;

  const el = document.createElement('div');
  el.id               = `nv2-${obj.object_id}`;
  el.className        = 'nv2-node nv2-unknown';
  el.dataset.objectId = obj.object_id;
  el.dataset.name     = obj.type === 'service' ? `${obj.host_name}::${obj.name}` : obj.name;
  el.dataset.type     = obj.type;
  el.dataset.iconset  = iconset;
  el.style.left       = `${obj.x}%`;
  el.style.top        = `${obj.y}%`;
  el.style.setProperty('--node-size', `${size}px`);

  const typeBadge = { service:'svc', hostgroup:'hg', servicegroup:'sg', map:'map' };
  const typePill  = typeBadge[obj.type]
    ? `<span class="nv2-type-pill">${typeBadge[obj.type]}</span>` : '';

  el.innerHTML = `
    ${typePill}
    <div class="nv2-ring" style="width:${size}px;height:${size}px;position:relative">
      <img class="nv2-icon" src="${statusSrc}" alt="" width="${size}" height="${size}" style="position:absolute;inset:0">
      <img class="nv2-icon-shape" src="${svgToDataUri(shapeSvg)}" alt="" width="${size}" height="${size}" style="position:absolute;inset:0;pointer-events:none">
      <span class="nv2-badge" aria-label="UNKNOWN">?</span>
    </div>
    <div class="nv2-label" title="${esc(obj.label || obj.name)}">${esc(obj.label || obj.name)}</div>`;

  el.addEventListener('mouseenter', () => showTooltip(el, obj));
  el.addEventListener('mouseleave', hideTooltip);
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (editActive) showNodeContextMenu(e, el, obj);
    else            showViewContextMenu(e, el, obj);
  });

  getNodeContainer().appendChild(el);

  const cacheKey = obj.type === 'service' ? `${obj.host_name}::${obj.name}` : obj.name;
  const cached   = hostCache[cacheKey];
  if (cached) applyNodeStatus(el, cached.state_label, cached.acknowledged, cached.in_downtime);

  return el;
}

function _renderTextbox(obj) {
  const el = document.createElement('div');
  el.id               = `nv2-${obj.object_id}`;
  el.className        = 'nv2-textbox';
  el.dataset.objectId = obj.object_id;
  el.dataset.type     = 'textbox';
  el.style.left       = `${obj.x}%`;
  el.style.top        = `${obj.y}%`;
  const scale = (obj.size ?? 100) / 100;
  el.style.transform  = scale !== 1 ? `scale(${scale})` : '';
  el.style.fontSize   = `${obj.font_size ?? 13}px`;
  el.style.fontWeight = obj.bold ? '700' : '400';
  el.style.color      = obj.color      || 'var(--text)';
  el.style.background = obj.bg_color   || '';
  el.style.border     = obj.border_color ? `1px solid ${obj.border_color}` : '';
  if (obj.w) el.style.width = `${obj.w}%`;
  el.textContent = obj.text ?? '';

  if (obj.link) {
    el.dataset.href = obj.link;
    el.title = obj.link;
    el._linkHandler = () => { if (!editActive) window.open(el.dataset.href, '_blank'); };
    el.addEventListener('click', el._linkHandler);
    el.style.cursor = 'pointer';
    el.style.textDecoration = 'underline';
    el.style.textDecorationStyle = 'dotted';
  }

  el.addEventListener('contextmenu', e => { e.preventDefault(); if (editActive) showNodeContextMenu(e, el, obj); });

  getNodeContainer().appendChild(el);
  if (editActive) makeDraggable(el);
  return el;
}

function _renderContainer(obj) {
  const el = document.createElement('div');
  el.id               = `nv2-${obj.object_id}`;
  el.className        = 'nv2-container';
  el.dataset.objectId = obj.object_id;
  el.dataset.type     = 'container';
  el.style.left       = `${obj.x}%`;
  el.style.top        = `${obj.y}%`;
  if (obj.w) el.style.width  = `${obj.w}%`;
  if (obj.h) el.style.height = `${obj.h}vmin`;
  if (obj.url) {
    if (obj.url.toLowerCase().endsWith('.svg')) {
      const o = document.createElement('object'); o.type = 'image/svg+xml'; o.data = obj.url; el.appendChild(o);
    } else {
      const img = document.createElement('img'); img.src = obj.url; img.alt = ''; el.appendChild(img);
    }
  }
  el.addEventListener('contextmenu', e => { e.preventDefault(); if (editActive) showNodeContextMenu(e, el, obj); });
  getNodeContainer().appendChild(el);
  if (editActive) makeDraggable(el);
  return el;
}

function applyStatuses(hosts, services) {
  for (const h of hosts) {
    hostCache[h.name] = h;
    document.querySelectorAll(`[data-name="${esc(h.name)}"]`).forEach(el =>
      applyNodeStatus(el, h.state_label, h.acknowledged, h.in_downtime));
  }
  for (const s of services) {
    const key = `${s.host_name}::${s.description}`;
    document.querySelectorAll(`[data-name="${esc(key)}"]`).forEach(el =>
      applyNodeStatus(el, s.state_label, s.acknowledged, s.in_downtime));
  }
  _updateWeathermapLines();
}

function applyNodeStatus(el, label, ack, downtime) {
  let cls = 'nv2-node ' + (STATE_CLS[label] ?? 'nv2-unknown');
  if (ack)      cls += ' nv2-ack';
  if (downtime) cls += ' nv2-downtime';
  if (el.className === cls) return;
  const wasUnknown = el.className.includes('nv2-unknown');
  el.className = cls;
  const badge = el.querySelector('.nv2-badge');
  if (badge) { badge.textContent = STATE_BADGE[label] ?? '?'; badge.setAttribute('aria-label', label); }
  if (!wasUnknown) {
    el.classList.add('nv2-status-changed');
    setTimeout(() => el.classList.remove('nv2-status-changed'), 500);
  }
  if (el.dataset.iconset) updateNodeIcon(el, label);
}

// ════════════════════════════════════════════════════════════════════════
//  KIOSK-USER-VERWALTUNG (localStorage + Backend-Sync)
// ════════════════════════════════════════════════════════════════════════

async function _loadKioskUsers() {
  try {
    const remote = await api('/api/kiosk-users');
    if (remote) {
      _kioskUsers = remote;
      localStorage.setItem('nv2-kiosk-users', JSON.stringify(_kioskUsers));
      return;
    }
  } catch { /* offline – Fallback */ }
  _kioskUsers = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
}

async function _persistKioskUser(user) {
  const idx = _kioskUsers.findIndex(u => u.id === user.id);
  if (idx >= 0) _kioskUsers[idx] = user;
  else          _kioskUsers.push(user);
  localStorage.setItem('nv2-kiosk-users', JSON.stringify(_kioskUsers));

  if (_demoMode) return user;
  try {
    if (idx >= 0) return await api(`/api/kiosk-users/${user.id}`, 'PUT', user);
    else          return await api('/api/kiosk-users', 'POST', user);
  } catch { return user; }
}

async function _removeKioskUser(uid) {
  _kioskUsers = _kioskUsers.filter(u => u.id !== uid);
  localStorage.setItem('nv2-kiosk-users', JSON.stringify(_kioskUsers));
  if (!_demoMode) {
    try { await api(`/api/kiosk-users/${uid}`, 'DELETE'); } catch { }
  }
}


// ════════════════════════════════════════════════════════════════════════
//  KIOSK-SESSION (Token-Login via ?kiosk=<token>)
// ════════════════════════════════════════════════════════════════════════

async function _initKioskSession(token) {
  let user = null;

  // 1. Restliche App-Init durchführen (brauchen wir für openMap etc.)
  document.getElementById('btn-refresh')   ?.addEventListener('click', () => wsClient?.forceRefresh());
  document.getElementById('btn-add-host')  ?.addEventListener('click', () => openDlg('dlg-add-object'));
  document.getElementById('btn-kiosk')     ?.addEventListener('click', toggleKiosk);
  document.getElementById('bg-file-input') ?.addEventListener('change', e => {
    if (e.target.files[0]) uploadBg(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btn-sidebar-toggle-foot')?.addEventListener('click', toggleSidebar);
  document.addEventListener('click', e => {
    if (_burgerOpen && !e.target.closest('#burger-wrap')) closeBurgerMenu();
  });
  document.getElementById('nv2-canvas')?.addEventListener('click', onCanvasClick);
  setupDragDrop();
  document.addEventListener('keydown', onKeyDown);
  document.getElementById('btn-zoom-in') ?.addEventListener('click', () => NV2_ZOOM.zoomIn());
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => NV2_ZOOM.zoomOut());

  await detectDemoMode();

  // 2. Token auflösen
  if (!_demoMode) {
    try {
      const r = await fetch(
        `/api/kiosk-users/resolve?token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (r.ok) user = await r.json();
    } catch { /* Backend nicht erreichbar */ }
  }
  if (!user) {
    const local = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
    user = local.find(u => u.token === token) || null;
  }

  // 3. Ungültiger Token
  if (!user) {
    document.body.innerHTML = `
      <div style="display:grid;place-items:center;height:100vh;
                  font-family:var(--mono,monospace);
                  color:var(--crit,#f44336);background:var(--bg,#1a1a1a)">
        <div style="text-align:center">
          <div style="font-size:48px;margin-bottom:16px">⛔</div>
          <div style="font-size:16px;font-weight:600">Ungültiger Kiosk-Token</div>
          <div style="font-size:11px;color:var(--text-dim,#555);margin-top:8px">
            Token: ${esc(token.substring(0, 8))}…
          </div>
        </div>
      </div>`;
    return;
  }

  _kioskSession = user;

  // 4. Maps laden
  await loadMaps();

  // 5. UI in Kiosk-Modus versetzen
  _applyKioskSessionUI();

  // 6. Rotation starten
  _startKioskRotation();

  pollHealth();
  setInterval(pollHealth, 30_000);
}

function _applyKioskSessionUI() {
  // Edit-Mode dauerhaft sperren
  editActive = false;

  // Bearbeitungs-UI ausblenden
  const hideIds = [
    'btn-edit', 'btn-add-host', 'btn-menu',
    'burger-btn-rename', 'btn-delete-map', 'btn-bg-upload',
  ];
  hideIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Kiosk-Badge in Topbar
  const chip = document.createElement('span');
  chip.id = 'kiosk-session-badge';
  chip.textContent = `⬛ ${_kioskSession.label}`;
  document.getElementById('topbar')?.appendChild(chip);

  // Fortschrittsbalken (Linie am unteren Rand)
  const prog = document.createElement('div');
  prog.id = 'kiosk-rot-progress';
  prog.innerHTML = `<div id="kiosk-rot-bar"></div>`;
  document.body.appendChild(prog);
  _kioskProgress = prog;

  // Kontextmenüs deaktivieren (readonly)
  window.showNodeContextMenu = () => {};
  window.showViewContextMenu = () => {};
}


// ════════════════════════════════════════════════════════════════════════
//  KIOSK-ROTATION
// ════════════════════════════════════════════════════════════════════════

function _startKioskRotation() {
  if (_kioskRotTimer) clearInterval(_kioskRotTimer);

  const u     = _kioskSession;
  const order = (u.order?.length ? u.order : u.maps) || [];

  if (order.length === 0) {
    setStatusBar('⚠ Kiosk: keine Maps in der Rotations-Liste');
    return;
  }

  _kioskRotIdx = 0;
  _loadKioskMap(order[0]);

  const ms = Math.max(5000, (u.interval || 30) * 1000);
  _animateKioskProgress(ms);

  _kioskRotTimer = setInterval(() => {
    _kioskRotIdx = (_kioskRotIdx + 1) % order.length;
    _loadKioskMap(order[_kioskRotIdx]);
    _animateKioskProgress(ms);
  }, ms);
}

function _loadKioskMap(mapId) {
  openMap(mapId);
}

function _stopKioskRotation() {
  if (_kioskRotTimer) { clearInterval(_kioskRotTimer); _kioskRotTimer = null; }
}

function _animateKioskProgress(durationMs) {
  const bar = document.getElementById('kiosk-rot-bar');
  if (!bar) return;
  bar.style.transition = 'none';
  bar.style.width      = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.style.transition = `width ${durationMs}ms linear`;
    bar.style.width      = '100%';
  }));
}


// ════════════════════════════════════════════════════════════════════════
//  KIOSK-USER-VERWALTUNGS-DIALOG (für Admins)
// ════════════════════════════════════════════════════════════════════════

async function openKioskUsersDlg() {
  await _loadKioskUsers();
  const maps = (await api('/api/maps')) || [];

  document.getElementById('dlg-kiosk-users')?.remove();

  const dlg = document.createElement('div');
  dlg.id = 'dlg-kiosk-users';
  dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:660px;max-height:82vh;
         display:flex;flex-direction:column;gap:0">

      <h3 style="flex-shrink:0">⬛ Kiosk-User verwalten</h3>

      <div id="kiosk-user-list" style="flex:1;overflow-y:auto;min-height:60px;
           border:1px solid var(--border);border-radius:var(--r);margin-bottom:14px">
      </div>

      <div style="flex-shrink:0;border-top:1px solid var(--border);padding-top:12px">
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;
             text-transform:uppercase;color:var(--text-dim);margin-bottom:8px">
          Neuen Kiosk-User anlegen
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label class="f-label">Name / Label</label>
            <input id="ki-label" class="f-input" type="text"
                   placeholder="z.B. Leitwarte TV-1">
          </div>
          <div>
            <label class="f-label">Intervall (Sekunden)</label>
            <input id="ki-interval" class="f-input" type="number"
                   value="30" min="5" max="3600">
          </div>
        </div>

        <label class="f-label">Maps (Whitelist &amp; Rotations-Reihenfolge)</label>
        <div id="ki-map-list" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;
             padding:8px;background:var(--bg);border:1px solid var(--border);
             border-radius:var(--r);min-height:36px">
          ${maps.map(m => `
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;
                padding:3px 8px;border-radius:var(--r-sm);background:var(--bg-surf);
                border:1px solid var(--border);font-size:11px;user-select:none">
              <input type="checkbox" value="${esc(m.id)}"
                     style="accent-color:var(--acc)">
              ${esc(m.title)}
            </label>`).join('')}
          ${!maps.length ? '<span style="font-size:11px;color:var(--text-dim)">Keine Maps vorhanden</span>' : ''}
        </div>
      </div>

      <div class="dlg-foot" style="flex-shrink:0;margin-top:10px">
        <button class="btn-cancel"
                onclick="document.getElementById('dlg-kiosk-users').remove()">
          Schließen
        </button>
        <button class="btn-ok" onclick="_kioskCreateUser(this)">
          ＋ User anlegen
        </button>
      </div>
    </div>`;

  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
  document.body.appendChild(dlg);
  _renderKioskUserList(maps);
}

function _renderKioskUserList(maps) {
  const el = document.getElementById('kiosk-user-list');
  if (!el) return;

  if (!_kioskUsers.length) {
    el.innerHTML = `<div class="empty-hint">Noch keine Kiosk-User angelegt.</div>`;
    return;
  }

  el.innerHTML = _kioskUsers.map(u => {
    const mapLabels = (u.maps || []).map(mid => {
      const m = maps.find(x => x.id === mid);
      return m ? esc(m.title) : esc(mid);
    }).join(', ') || '–';

    const tokenBase = `${location.origin}${location.pathname}`;
    const tokenUrl  = u.token ? `${tokenBase}?kiosk=${u.token}` : '(nur serverseitig)';
    const hasToken  = !!u.token;

    return `
      <div style="background:var(--bg-surf);border-bottom:1px solid var(--border);
          padding:10px 14px;transition:background var(--t)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12.5px;font-weight:600;color:var(--text)">
              ${esc(u.label)}
            </div>
            <div style="font-size:10px;color:var(--text-dim);font-family:var(--mono);
                 margin-top:2px">
              ${mapLabels}
              <span style="color:var(--border-hi)"> · </span>
              ${u.interval || 30}s Intervall
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="manage-btn" title="Bearbeiten"
                    onclick="_kioskEditUser('${esc(u.id)}')">✏</button>
            <button class="manage-btn manage-btn-danger" title="Löschen"
                    onclick="_kioskDeleteUser('${esc(u.id)}')">🗑</button>
          </div>
        </div>
        ${hasToken ? `
        <div style="display:flex;align-items:center;gap:6px;margin-top:7px">
          <input readonly value="${esc(tokenUrl)}" onclick="this.select()"
            style="flex:1;font-size:10px;font-family:var(--mono);
                   background:var(--bg);border:1px solid var(--border);
                   border-radius:var(--r-sm);padding:3px 7px;color:var(--text-mid);
                   cursor:text;outline:none">
          <button class="manage-btn" title="URL kopieren"
                  onclick="navigator.clipboard.writeText('${esc(tokenUrl)}')
                    .then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='📋',1200)})
                    .catch(()=>this.textContent='!')">📋</button>
          <a href="${esc(tokenUrl)}" target="_blank" class="manage-btn"
             title="Im neuen Tab öffnen" style="text-decoration:none;display:flex;
             align-items:center;justify-content:center">⬛</a>
        </div>` : `
        <div style="font-size:9px;color:var(--text-dim);font-family:var(--mono);margin-top:5px">
          Token serverseitig gespeichert
        </div>`}
      </div>`;
  }).join('');
}

window._kioskCreateUser = async function(btn) {
  const label    = document.getElementById('ki-label')?.value.trim();
  const interval = parseInt(document.getElementById('ki-interval')?.value) || 30;
  const checked  = [...document.querySelectorAll('#ki-map-list input:checked')]
                     .map(i => i.value);

  if (!label)          { document.getElementById('ki-label')?.focus(); return; }
  if (!checked.length) { alert('Bitte mindestens eine Map auswählen.'); return; }

  const localToken = Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map(b => b.toString(36)).join('').slice(0, 24);

  const newUser = {
    id: (typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36),
    token:    localToken,
    label, interval,
    maps:  checked,
    order: checked,
  };

  const saved = await _persistKioskUser(newUser);
  if (saved?.id) Object.assign(newUser, saved);

  const maps = (await api('/api/maps')) || [];
  _renderKioskUserList(maps);

  const lbl = document.getElementById('ki-label');
  if (lbl) lbl.value = '';
  document.querySelectorAll('#ki-map-list input[type=checkbox]')
    .forEach(c => c.checked = false);
  setStatusBar(`✔ Kiosk-User „${label}" angelegt`);
};

window._kioskDeleteUser = async function(uid) {
  if (!confirm('Kiosk-User wirklich löschen?\nDie Token-URL wird ungültig.')) return;
  await _removeKioskUser(uid);
  const maps = (await api('/api/maps')) || [];
  _renderKioskUserList(maps);
};

window._kioskEditUser = async function(uid) {
  const user = _kioskUsers.find(u => u.id === uid);
  if (!user) return;
  const maps = (await api('/api/maps')) || [];

  document.getElementById('dlg-kiosk-edit')?.remove();
  const dlg = document.createElement('div');
  dlg.id = 'dlg-kiosk-edit';
  dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:500px">
      <h3>✏ Kiosk-User bearbeiten</h3>

      <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:10px">
        <div>
          <label class="f-label">Name / Label</label>
          <input id="kie-label" class="f-input" value="${esc(user.label)}">
        </div>
        <div>
          <label class="f-label">Intervall (Sekunden)</label>
          <input id="kie-interval" class="f-input" type="number"
                 value="${user.interval || 30}" min="5">
        </div>
      </div>

      <label class="f-label">Maps &amp; Rotations-Reihenfolge</label>
      <p style="font-size:9px;color:var(--text-dim);font-family:var(--mono);
         margin:3px 0 6px">
        Reihenfolge der Häkchen = Rotations-Reihenfolge
      </p>
      <div id="kie-map-list"
           style="display:flex;flex-direction:column;gap:3px;padding:8px;
                  background:var(--bg);border:1px solid var(--border);
                  border-radius:var(--r);max-height:260px;overflow-y:auto">
        ${maps.map(m => {
          const inList = user.maps?.includes(m.id);
          const pos    = user.order?.indexOf(m.id) ?? -1;
          return `
          <label style="display:flex;align-items:center;gap:8px;padding:5px 8px;
              border-radius:var(--r-sm);background:var(--bg-surf);
              border:1px solid var(--border);cursor:pointer;user-select:none">
            <input type="checkbox" value="${esc(m.id)}"
                   ${inList ? 'checked' : ''}
                   style="accent-color:var(--acc)">
            <span style="flex:1;font-size:12px">${esc(m.title)}</span>
            <span style="font-size:9px;color:var(--text-dim);font-family:var(--mono)">
              ${inList && pos >= 0 ? `#${pos + 1}` : ''}
            </span>
          </label>`;
        }).join('')}
        ${!maps.length ? '<div class="empty-hint">Keine Maps</div>' : ''}
      </div>

      <div class="dlg-foot" style="margin-top:12px">
        <button class="btn-cancel"
                onclick="document.getElementById('dlg-kiosk-edit').remove()">
          Abbrechen
        </button>
        <button class="btn-ok"
                onclick="_kioskSaveEdit('${esc(uid)}', this)">
          💾 Speichern
        </button>
      </div>
    </div>`;

  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
  document.body.appendChild(dlg);
};

window._kioskSaveEdit = async function(uid, btn) {
  const user = _kioskUsers.find(u => u.id === uid);
  if (!user) return;

  const label    = document.getElementById('kie-label')?.value.trim();
  const interval = parseInt(document.getElementById('kie-interval')?.value) || 30;
  const checked  = [...document.querySelectorAll('#kie-map-list input:checked')]
                     .map(i => i.value);

  if (!label) { document.getElementById('kie-label')?.focus(); return; }

  user.label    = label;
  user.interval = interval;
  user.maps     = checked;
  user.order    = checked;

  await _persistKioskUser(user);
  btn.closest('.dlg-overlay')?.remove();

  const maps = (await api('/api/maps')) || [];
  _renderKioskUserList(maps);
  setStatusBar(`✔ Kiosk-User „${label}" gespeichert`);
};

window.openKioskUsersDlg = openKioskUsersDlg;

// ═══════════════════════════════════════════════════════════════════════
//  GADGET-KONFIGURATIONS-DIALOG
// ═══════════════════════════════════════════════════════════════════════

function openGadgetConfigDialog(el, obj) {
  document.getElementById('dlg-gadget-cfg')?.remove();

  const cfg = obj.gadget_config ?? { type:'radial', metric:'', value:0, unit:'%', min:0, max:100, warning:70, critical:90 };
  const hosts = Object.values(hostCache);

  const hostOptions = hosts.map(h =>
    `<option value="${esc(h.name)}" ${cfg.host_name===h.name?'selected':''}>${esc(h.name)}</option>`
  ).join('');

  const dlg = document.createElement('div');
  dlg.id = 'dlg-gadget-cfg';
  dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:440px">
      <h3>Gadget konfigurieren – ${esc(obj.label || obj.object_id)}</h3>
      <div class="f-row">
        <label class="f-label">Anzeigetyp</label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
          <button class="type-chip ${cfg.type==='radial'      ?'active':''}" data-gtype="radial"      onclick="_gcSelectType(this)">⏱ Radial</button>
          <button class="type-chip ${cfg.type==='linear'      ?'active':''}" data-gtype="linear"      onclick="_gcSelectType(this)">▬ Linear</button>
          <button class="type-chip ${cfg.type==='sparkline'   ?'active':''}" data-gtype="sparkline"   onclick="_gcSelectType(this)">〜 Sparkline</button>
          <button class="type-chip ${cfg.type==='weather'     ?'active':''}" data-gtype="weather"     onclick="_gcSelectType(this)">→ Flow</button>
          <button class="type-chip ${cfg.type==='rawnumber'   ?'active':''}" data-gtype="rawnumber"   onclick="_gcSelectType(this)">🔢 Zahl</button>
          <button class="type-chip ${cfg.type==='thermometer' ?'active':''}" data-gtype="thermometer" onclick="_gcSelectType(this)">🌡 Thermo</button>
        </div>
      </div>
      <div class="f-row" style="margin-top:10px">
        <label class="f-label">Datenquelle</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label class="f-label">Host</label>
            <select class="f-select" id="gc-host" onchange="_gcUpdateServices()">
              <option value="">(Demo / Statisch)</option>${hostOptions}
            </select>
          </div>
          <div>
            <label class="f-label">Service / Metrik</label>
            <input class="f-input" id="gc-service" type="text" placeholder="z.B. CPU load"
                   value="${esc(cfg.service_description || '')}">
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:8px">
        <div>
          <label class="f-label">Bezeichnung (Label)</label>
          <input class="f-input" id="gc-metric" type="text" placeholder="z.B. CPU Auslastung"
                 value="${esc(cfg.metric || '')}">
        </div>
        <div>
          <label class="f-label">Einheit</label>
          <input class="f-input" id="gc-unit" type="text" placeholder="%, Mbps, °C …"
                 value="${esc(cfg.unit || '%')}" style="max-width:80px">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-top:8px" id="gc-minmax-row">
        <div><label class="f-label">Min</label><input class="f-input" id="gc-min" type="number" value="${cfg.min ?? 0}"></div>
        <div><label class="f-label">Max</label><input class="f-input" id="gc-max" type="number" value="${cfg.max ?? 100}"></div>
        <div><label class="f-label">Warning</label><input class="f-input" id="gc-warning" type="number" value="${cfg.warning ?? 70}" style="border-color:var(--warn)"></div>
        <div><label class="f-label">Critical</label><input class="f-input" id="gc-critical" type="number" value="${cfg.critical ?? 90}" style="border-color:var(--crit)"></div>
      </div>
      <div id="gc-direction-row" style="margin-top:8px;${cfg.type==='weather'?'':'display:none'}">
        <label class="f-label">Richtung</label>
        <div style="display:flex;gap:8px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="radio" name="gc-direction" value="out" ${(cfg.direction??'out')==='out'?'checked':''}><span>→ Ausgehend</span></label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="radio" name="gc-direction" value="in" ${cfg.direction==='in'?'checked':''}><span>← Eingehend</span></label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="radio" name="gc-direction" value="both" ${cfg.direction==='both'?'checked':''}><span>⇄ Bidirektional</span></label>
        </div>
      </div>
      <div id="gc-inout-row" style="display:${cfg.direction==='both'?'grid':'none'};grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div><label class="f-label">↑ Ausgehend (Out)</label><input class="f-input" id="gc-value-out" type="number" value="${cfg.value_out ?? cfg.value ?? 0}" min="0"></div>
        <div><label class="f-label">↓ Eingehend (In)</label><input class="f-input" id="gc-value-in" type="number" value="${cfg.value_in ?? 0}" min="0"></div>
      </div>
      <div id="gc-demo-row" style="margin-top:8px;${Object.keys(hostCache).length?'display:none':''}">
        <label class="f-label">Demo-Wert</label>
        <input class="f-input" id="gc-demo-value" type="number" value="${cfg.value ?? 0}" min="0" max="9999">
      </div>
      <div id="gc-divide-row" style="margin-top:8px;${cfg.type==='rawnumber'?'':'display:none'}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label class="f-label">Divisor</label><input class="f-input" id="gc-divide" type="number" step="any" value="${cfg.divide ?? 1}" min="0.001"></div>
          <div><label class="f-label">Anzeigeeinheit</label><input class="f-input" id="gc-display-unit" type="text" placeholder="MB, GB, …" value="${cfg.display_unit ?? cfg.unit ?? ''}"></div>
        </div>
      </div>
      <div style="margin-top:10px">
        <label class="f-label">Anzeigegröße</label>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="range" id="gc-size" min="40" max="300" step="10" value="${obj.size ?? 100}"
                 style="flex:1;accent-color:var(--acc)"
                 oninput="document.getElementById('gc-size-val').textContent=this.value+'%'">
          <span id="gc-size-val" style="font-family:var(--mono);font-size:11px;color:var(--text-mid);min-width:40px">${obj.size ?? 100}%</span>
        </div>
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:var(--r);
                  border:1px solid var(--border);display:flex;align-items:center;
                  justify-content:center;min-height:80px" id="gc-preview">
        <span style="color:var(--text-dim);font-size:11px">Vorschau…</span>
      </div>
      <div class="dlg-actions" style="margin-top:14px">
        <button class="btn-cancel" onclick="document.getElementById('dlg-gadget-cfg').remove()">Abbrechen</button>
        <button class="btn-ok" onclick="_gcSave('${esc(obj.object_id)}')">Übernehmen</button>
      </div>
    </div>`;

  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });

  _gcUpdatePreview();
  ['gc-metric','gc-unit','gc-min','gc-max','gc-warning','gc-critical','gc-demo-value','gc-size']
    .forEach(id => document.getElementById(id)?.addEventListener('input', _gcUpdatePreview));
}

window._gcSelectType = function(btn) {
  document.querySelectorAll('#dlg-gadget-cfg .type-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const type = btn.dataset.gtype;
  const mmRow  = document.getElementById('gc-minmax-row');
  const dirRow = document.getElementById('gc-direction-row');
  const divRow = document.getElementById('gc-divide-row');
  if (mmRow)  mmRow.style.display  = type === 'sparkline' ? 'none' : 'grid';
  if (dirRow) dirRow.style.display = type === 'weather'   ? 'block' : 'none';
  if (divRow) divRow.style.display = type === 'rawnumber' ? 'block' : 'none';
  _gcUpdatePreview();
};

document.addEventListener('change', e => {
  if (e.target.name === 'gc-direction') {
    const inout = document.getElementById('gc-inout-row');
    if (inout) inout.style.display = e.target.value === 'both' ? 'grid' : 'none';
    _gcUpdatePreview();
  }
});

window._gcUpdatePreview = function() {
  const preview = document.getElementById('gc-preview');
  if (!preview) return;
  const type     = document.querySelector('#dlg-gadget-cfg .type-chip.active')?.dataset.gtype ?? 'radial';
  const metric   = document.getElementById('gc-metric')?.value || 'Metrik';
  const unit     = document.getElementById('gc-unit')?.value   || '%';
  const min      = parseFloat(document.getElementById('gc-min')?.value)      || 0;
  const max      = parseFloat(document.getElementById('gc-max')?.value)      || 100;
  const warning  = parseFloat(document.getElementById('gc-warning')?.value)  || 70;
  const critical = parseFloat(document.getElementById('gc-critical')?.value) || 90;
  const value    = parseFloat(document.getElementById('gc-demo-value')?.value) || (max * 0.42);
  const size     = parseInt(document.getElementById('gc-size')?.value) || 100;

  const tmpCfg = { type, metric, unit, min, max, warning, critical, value,
    history:[30,45,52,38,61,55,70,65,48,58,72,68,80,75,62,68,55,70,65,78] };

  const tmp = document.createElement('div');
  tmp.style.transform = `scale(${size/100})`;
  tmp.style.transformOrigin = 'center center';

  try {
    const rendered = document.createElement('div');
    rendered.className = `nv2-node gadget ${type}`;
    switch (type) {
      case 'linear':      rendered.innerHTML = window._gadgetLinear?.(tmpCfg)      ?? ''; break;
      case 'sparkline':   rendered.innerHTML = window._gadgetSparkline?.(tmpCfg)   ?? ''; break;
      case 'weather':     rendered.innerHTML = window._gadgetWeather?.(tmpCfg)     ?? ''; break;
      case 'rawnumber':   rendered.innerHTML = window._gadgetRawNumber?.(tmpCfg)   ?? ''; break;
      case 'thermometer': rendered.innerHTML = window._gadgetThermometer?.(tmpCfg) ?? ''; break;
      default:            rendered.innerHTML = window._gadgetRadial?.(tmpCfg)      ?? '';
    }
    tmp.appendChild(rendered);
  } catch { tmp.innerHTML = `<span style="color:var(--text-dim);font-size:10px">${type}</span>`; }

  preview.innerHTML = '';
  preview.appendChild(tmp);
};

window._gcUpdateServices = function() { /* Services aus hostCache laden – für jetzt Freitext */ };

window._gcSave = async function(objectId) {
  const type     = document.querySelector('#dlg-gadget-cfg .type-chip.active')?.dataset.gtype ?? 'radial';
  const metric   = document.getElementById('gc-metric')?.value.trim()   || 'Metrik';
  const unit     = document.getElementById('gc-unit')?.value.trim()     || '%';
  const min      = parseFloat(document.getElementById('gc-min')?.value)      || 0;
  const max      = parseFloat(document.getElementById('gc-max')?.value)      || 100;
  const warning  = parseFloat(document.getElementById('gc-warning')?.value)  || 70;
  const critical = parseFloat(document.getElementById('gc-critical')?.value) || 90;
  const value    = parseFloat(document.getElementById('gc-demo-value')?.value) || 0;
  const size     = parseInt(document.getElementById('gc-size')?.value)   || 100;
  const hostName = document.getElementById('gc-host')?.value    || '';
  const svcName  = document.getElementById('gc-service')?.value || '';
  const direction   = document.querySelector('input[name="gc-direction"]:checked')?.value ?? 'out';
  const divide      = parseFloat(document.getElementById('gc-divide')?.value) || 1;
  const displayUnit = document.getElementById('gc-display-unit')?.value.trim() || '';
  const valueOut  = parseFloat(document.getElementById('gc-value-out')?.value) || value;
  const valueIn   = parseFloat(document.getElementById('gc-value-in')?.value)  || 0;

  const newCfg = { type, metric, unit, min, max, warning, critical, value,
    ...(type === 'rawnumber' ? { divide: divide !== 1 ? divide : undefined, display_unit: displayUnit || undefined } : {}),
    ...(type === 'weather' ? { direction, ...(direction === 'both' ? { value_out: valueOut, value_in: valueIn } : {}) } : {}),
    ...(hostName ? { host_name: hostName } : {}),
    ...(svcName  ? { service_description: svcName } : {}),
    history: [30,45,52,38,61,55,70,65,48,58,72,68,80,75,62,68,55,70,65,78],
  };

  const objRef = activeMapCfg?.objects?.find(o => o.object_id === objectId);
  if (objRef) { objRef.gadget_config = newCfg; objRef.size = size; objRef.label = metric; }

  const el = document.getElementById(`nv2-${objectId}`);
  if (el && typeof window._renderGadgetHTML === 'function') {
    el.innerHTML = window._renderGadgetHTML(newCfg);
    el.style.transform       = `translate(-50%,-50%) scale(${size/100})`;
    el.style.transformOrigin = 'center center';
    el.dataset.gadgetType    = newCfg.type;
  }

  await api(`/api/maps/${activeMapId}/objects/${objectId}/props`, 'PATCH',
    { gadget_config: newCfg, size, label: metric });

  document.getElementById('dlg-gadget-cfg')?.remove();
  setStatusBar(`Gadget „${metric}" aktualisiert`);
};

window.openGadgetConfigDialog = openGadgetConfigDialog;


// ═══════════════════════════════════════════════════════════════════════
//  LINIEN-RENDERING
// ═══════════════════════════════════════════════════════════════════════

function _renderLine(obj) {
  let svg = document.getElementById('nv2-lines-svg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'nv2-lines-svg';
    svg.classList.add('nv2-line-svg');
    getNodeContainer().appendChild(svg);
  }

  if (obj.line_type === 'weathermap') {
    return _renderWeathermapLine(obj, svg);
  }

  const lineVis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  lineVis.setAttribute('x1', `${obj.x}%`);
  lineVis.setAttribute('y1', `${obj.y}%`);
  lineVis.setAttribute('x2', `${obj.x2 ?? obj.x + 20}%`);
  lineVis.setAttribute('y2', `${obj.y2 ?? obj.y}%`);
  lineVis.setAttribute('stroke',       obj.color      || 'var(--border-hi)');
  lineVis.setAttribute('stroke-width', obj.line_width ?? 1);
  const dashMap = { dashed:'8,4', dotted:'2,4' };
  const dash = dashMap[obj.line_style];
  if (dash) lineVis.setAttribute('stroke-dasharray', dash);
  lineVis.style.pointerEvents = 'none';
  svg.appendChild(lineVis);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.id = `nv2-${obj.object_id}`;
  line.classList.add('nv2-line-el');
  line.dataset.objectId = obj.object_id;
  line.dataset.type     = 'line';
  line.setAttribute('x1', `${obj.x}%`);
  line.setAttribute('y1', `${obj.y}%`);
  line.setAttribute('x2', `${obj.x2 ?? obj.x + 20}%`);
  line.setAttribute('y2', `${obj.y2 ?? obj.y}%`);
  line.setAttribute('stroke-width',   Math.max(obj.line_width ?? 1, 8));
  line.setAttribute('stroke-opacity', '0');
  line.style.cursor = 'pointer';

  line.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    if (editActive) showLineContextMenu(e, lineVis, obj);
  });
  line.addEventListener('mousedown', e => {
    if (!editActive || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    _startLineDrag(e, lineVis, line, obj, svg);
  });
  svg.appendChild(line);

  const handles = _createLineHandles(lineVis, line, obj, svg);
  obj._handles = handles;
  return line;
}

function _worstStateColor(name) {
  const h = hostCache[name];
  if (!h) return 'var(--unkn)';
  const l = h.state_label;
  if (l === 'CRITICAL' || l === 'DOWN' || l === 'UNREACHABLE') return 'var(--crit)';
  if (l === 'WARNING')  return 'var(--warn)';
  if (l === 'OK' || l === 'UP') return 'var(--ok)';
  return 'var(--unkn)';
}

function _worstStateClass(name) {
  const h = hostCache[name];
  if (!h) return 'unkn';
  const l = h.state_label;
  if (l === 'CRITICAL' || l === 'DOWN' || l === 'UNREACHABLE') return 'crit';
  if (l === 'WARNING')  return 'warn';
  if (l === 'OK' || l === 'UP') return 'ok';
  return 'unkn';
}

function _renderWeathermapLine(obj, svg) {
  const x1 = obj.x,  y1 = obj.y;
  const x2 = obj.x2 ?? obj.x + 20;
  const y2 = obj.y2 ?? obj.y;
  const w  = obj.line_width ?? 3;

  const colFrom = obj.host_from ? _worstStateColor(obj.host_from) : 'var(--ok)';
  const colTo   = obj.host_to   ? _worstStateColor(obj.host_to)   : 'var(--ok)';

  const g   = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.id               = `nv2-${obj.object_id}`;
  g.dataset.objectId = obj.object_id;
  g.dataset.type     = 'line';
  g.dataset.lineType = 'weathermap';
  g.classList.add('nv2-wm-line');

  const split = obj.line_split ?? true;

  if (split) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const l1 = _wmSegment(x1, y1, mx, my, colFrom, w, obj.line_style);
    const l2 = _wmSegment(mx, my, x2, y2, colTo,   w, obj.line_style);
    l1.classList.add('wm-seg-from');
    l2.classList.add('wm-seg-to');
    g.appendChild(l1);
    g.appendChild(l2);
    if (obj.show_arrow !== false) g.appendChild(_wmArrow(mx, my, x2, y2, colTo, w));
    if (obj.label_from || obj.label_to || obj.host_from || obj.host_to) {
      const lf = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lf.classList.add('wm-label', 'wm-label-from');
      _wmPositionLabel(lf, x1, y1, mx, my, 0.35);
      lf.setAttribute('fill', colFrom);
      lf.textContent = obj.label_from || obj.host_from || '';
      lf.style.fontSize = '9px'; lf.style.fontFamily = 'monospace';
      const lt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lt.classList.add('wm-label', 'wm-label-to');
      _wmPositionLabel(lt, mx, my, x2, y2, 0.65);
      lt.setAttribute('fill', colTo);
      lt.textContent = obj.label_to || obj.host_to || '';
      lt.style.fontSize = '9px'; lt.style.fontFamily = 'monospace';
      g.appendChild(lf); g.appendChild(lt);
    }
  } else {
    const col = (colTo === 'var(--crit)' || colFrom === 'var(--crit)') ? 'var(--crit)'
              : (colTo === 'var(--warn)' || colFrom === 'var(--warn)') ? 'var(--warn)'
              : (colTo === 'var(--ok)'   && colFrom === 'var(--ok)')   ? 'var(--ok)'
              : 'var(--unkn)';
    g.appendChild(_wmSegment(x1, y1, x2, y2, col, w, obj.line_style));
    if (obj.show_arrow !== false) g.appendChild(_wmArrow(x1, y1, x2, y2, col, w));
  }

  const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  hit.setAttribute('x1', `${x1}%`); hit.setAttribute('y1', `${y1}%`);
  hit.setAttribute('x2', `${x2}%`); hit.setAttribute('y2', `${y2}%`);
  hit.setAttribute('stroke-width', Math.max(w, 10));
  hit.setAttribute('stroke-opacity', '0');
  hit.style.cursor = 'pointer';
  hit.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    if (editActive) showLineContextMenu(e, g.querySelector('.wm-seg-from,.wm-seg-to') ?? hit, obj);
  });
  hit.addEventListener('mousedown', e => {
    if (!editActive || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const canvas = document.getElementById('nv2-canvas');
    const rect   = canvas.getBoundingClientRect();
    const mx     = (e.clientX - rect.left) / rect.width  * 100;
    const my     = (e.clientY - rect.top)  / rect.height * 100;
    const cx1    = obj.x,   cy1 = obj.y;
    const cx2    = obj.x2 ?? obj.x + 20, cy2 = obj.y2 ?? obj.y;
    const cmx    = (cx1 + cx2) / 2, cmy = (cy1 + cy2) / 2;
    const d0 = Math.hypot(mx - cx1, my - cy1);
    const d1 = Math.hypot(mx - cmx, my - cmy);
    const d2 = Math.hypot(mx - cx2, my - cy2);
    const role = d0 < d1 && d0 < d2 ? 'start' : d2 < d1 ? 'end' : 'mid';
    const hi   = obj._handles?.[role==='start'?0:role==='mid'?1:2] ?? hit;
    _dragWmHandle(e, g, hit, hi, role, obj, svg);
  });
  hit.addEventListener('mouseenter', () => _wmShowTooltip(obj));
  hit.addEventListener('mouseleave', hideTooltip);
  g.appendChild(hit);

  const handles = _createWmHandles(g, hit, obj, svg);
  obj._handles = handles;
  obj._wmGroup = g;
  obj._wmSvg   = svg;

  svg.appendChild(g);
  return hit;
}

function _createWmHandles(g, hit, obj, svg) {
  const mx = (obj.x + (obj.x2 ?? obj.x + 20)) / 2;
  const my = (obj.y + (obj.y2 ?? obj.y))       / 2;

  const makeHandle = (cx, cy, role) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.classList.add('line-handle');
    c.setAttribute('cx', `${cx}%`); c.setAttribute('cy', `${cy}%`);
    c.setAttribute('r', role === 'mid' ? '6' : '5');
    c.style.fill        = role === 'mid' ? 'var(--text-dim)' : 'var(--acc, #29b6d4)';
    c.style.stroke      = 'var(--bg-panel, #2b2b2b)';
    c.style.strokeWidth = '2';
    c.style.cursor      = role === 'mid' ? 'move' : 'crosshair';
    c.style.opacity     = '0';
    c.dataset.wmRole    = role;
    c.addEventListener('mousedown', e => {
      if (!editActive || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      _dragWmHandle(e, g, hit, c, role, obj, svg);
    });
    svg.appendChild(c);
    return c;
  };

  return [
    makeHandle(obj.x, obj.y, 'start'),
    makeHandle(mx, my, 'mid'),
    makeHandle(obj.x2 ?? obj.x + 20, obj.y2 ?? obj.y, 'end'),
  ];
}

function _dragWmHandle(e, g, hit, handle, role, obj, svg) {
  const canvas = document.getElementById('nv2-canvas');
  const rect   = canvas.getBoundingClientRect();
  let x1 = obj.x, y1 = obj.y;
  let x2 = obj.x2 ?? obj.x + 20;
  let y2 = obj.y2  ?? obj.y;
  const startMx = (e.clientX - rect.left) / rect.width  * 100;
  const startMy = (e.clientY - rect.top)  / rect.height * 100;
  const origX1 = x1, origY1 = y1, origX2 = x2, origY2 = y2;

  const onMove = ev => {
    const nx = (ev.clientX - rect.left) / rect.width  * 100;
    const ny = (ev.clientY - rect.top)  / rect.height * 100;
    if (role === 'start') { x1 = nx; y1 = ny; }
    else if (role === 'end') { x2 = nx; y2 = ny; }
    else {
      const dx = nx - startMx, dy = ny - startMy;
      x1 = origX1 + dx; y1 = origY1 + dy;
      x2 = origX2 + dx; y2 = origY2 + dy;
    }
    _wmUpdateGeometry(g, hit, obj, x1, y1, x2, y2);
  };

  const onUp = async () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    obj.x = x1; obj.y = y1; obj.x2 = x2; obj.y2 = y2;
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/pos`, 'PATCH',
      { x: x1, y: y1, x2, y2 });
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}

function _wmUpdateGeometry(g, hit, obj, x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const segFrom = g.querySelector('.wm-seg-from');
  const segTo   = g.querySelector('.wm-seg-to');
  if (segFrom) { segFrom.setAttribute('x1', `${x1}%`); segFrom.setAttribute('y1', `${y1}%`); segFrom.setAttribute('x2', `${mx}%`); segFrom.setAttribute('y2', `${my}%`); }
  if (segTo)   { segTo  .setAttribute('x1', `${mx}%`); segTo  .setAttribute('y1', `${my}%`); segTo  .setAttribute('x2', `${x2}%`); segTo  .setAttribute('y2', `${y2}%`); }
  const arrow  = g.querySelector('.wm-arrow');
  if (arrow) { arrow.setAttribute('cx', `${x2}%`); arrow.setAttribute('cy', `${y2}%`); }
  const lf = g.querySelector('.wm-label-from'), lt = g.querySelector('.wm-label-to');
  if (lf) { lf.setAttribute('x', `${x1 + (mx - x1) * 0.35}%`); lf.setAttribute('y', `${y1 + (my - y1) * 0.35}%`); }
  if (lt) { lt.setAttribute('x', `${mx + (x2 - mx) * 0.65}%`); lt.setAttribute('y', `${my + (y2 - my) * 0.65}%`); }
  hit.setAttribute('x1', `${x1}%`); hit.setAttribute('y1', `${y1}%`);
  hit.setAttribute('x2', `${x2}%`); hit.setAttribute('y2', `${y2}%`);
  const handles = obj._handles ?? [];
  if (handles[0]) { handles[0].setAttribute('cx', `${x1}%`); handles[0].setAttribute('cy', `${y1}%`); }
  if (handles[1]) { handles[1].setAttribute('cx', `${mx}%`); handles[1].setAttribute('cy', `${my}%`); }
  if (handles[2]) { handles[2].setAttribute('cx', `${x2}%`); handles[2].setAttribute('cy', `${y2}%`); }
}

function _wmSegment(x1, y1, x2, y2, color, w, style) {
  const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l.setAttribute('x1', `${x1}%`); l.setAttribute('y1', `${y1}%`);
  l.setAttribute('x2', `${x2}%`); l.setAttribute('y2', `${y2}%`);
  l.setAttribute('stroke', color); l.setAttribute('stroke-width', w);
  l.setAttribute('stroke-linecap', 'round');
  const dash = { dashed:'8,4', dotted:'2,4' }[style];
  if (dash) l.setAttribute('stroke-dasharray', dash);
  l.style.pointerEvents = 'none'; l.style.transition = 'stroke 0.3s ease';
  return l;
}

function _wmArrow(x1, y1, x2, y2, color, w) {
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', `${x2}%`); dot.setAttribute('cy', `${y2}%`);
  dot.setAttribute('r', `${Math.max(6, w * 2.5) * 0.4}`);
  dot.setAttribute('fill', color);
  dot.style.pointerEvents = 'none'; dot.style.transition = 'fill 0.3s ease';
  dot.classList.add('wm-arrow');
  return dot;
}

function _wmPositionLabel(el, x1, y1, x2, y2, t) {
  el.setAttribute('x', `${x1 + (x2 - x1) * t}%`);
  el.setAttribute('y', `${y1 + (y2 - y1) * t}%`);
  el.setAttribute('text-anchor', 'middle');
  el.setAttribute('dominant-baseline', 'middle');
}

function _wmShowTooltip(obj) {
  hideTooltip();
  const tt = document.createElement('div');
  tt.className = 'nv2-tooltip';
  const hf = obj.host_from ? hostCache[obj.host_from] : null;
  const ht = obj.host_to   ? hostCache[obj.host_to]   : null;
  const cf = hf ? _worstStateClass(obj.host_from) : 'unkn';
  const ct = ht ? _worstStateClass(obj.host_to)   : 'unkn';
  tt.innerHTML = `
    <div class="tt-name">Weathermap-Linie</div>
    ${obj.host_from ? `<div class="tt-row"><span>Von</span><b class="tt-${cf}">${esc(obj.host_from)} · ${hf?.state_label ?? 'UNKNOWN'}</b></div>` : ''}
    ${obj.label_from ? `<div class="tt-row"><span>Out</span><b>${esc(obj.label_from)}</b></div>` : ''}
    ${obj.host_to ? `<div class="tt-row"><span>Nach</span><b class="tt-${ct}">${esc(obj.host_to)} · ${ht?.state_label ?? 'UNKNOWN'}</b></div>` : ''}
    ${obj.label_to ? `<div class="tt-row"><span>In</span><b>${esc(obj.label_to)}</b></div>` : ''}
    <div class="tt-row"><span>Typ</span><b>Weathermap-Linie</b></div>`;
  const cvRect = document.getElementById('nv2-canvas').getBoundingClientRect();
  const mx = (obj.x + (obj.x2 ?? obj.x + 20)) / 2;
  const my = (obj.y + (obj.y2 ?? obj.y)) / 2;
  tt.style.left = `${cvRect.width  * mx / 100}px`;
  tt.style.top  = `${cvRect.height * my / 100}px`;
  document.getElementById('nv2-canvas').appendChild(tt);
  _activeTooltip = tt;
}

function _updateWeathermapLines() {
  document.querySelectorAll('.nv2-wm-line').forEach(g => {
    const oid = g.dataset.objectId;
    const obj = activeMapCfg?.objects?.find(o => o.object_id === oid);
    if (!obj) return;
    const colFrom = obj.host_from ? _worstStateColor(obj.host_from) : 'var(--unkn)';
    const colTo   = obj.host_to   ? _worstStateColor(obj.host_to)   : 'var(--unkn)';
    const segFrom = g.querySelector('.wm-seg-from');
    const segTo   = g.querySelector('.wm-seg-to');
    const arrows  = g.querySelectorAll('.wm-arrow');
    const lblFrom = g.querySelector('.wm-label-from');
    const lblTo   = g.querySelector('.wm-label-to');
    if (segFrom) segFrom.setAttribute('stroke', colFrom);
    if (segTo)   segTo  .setAttribute('stroke', colTo);
    if (lblFrom) lblFrom.setAttribute('fill',   colFrom);
    if (lblTo)   lblTo  .setAttribute('fill',   colTo);
    arrows.forEach((a, i) => a.setAttribute('fill', i === 0 ? colFrom : colTo));
  });
}

function _createLineHandles(lineVis, hitLine, obj, svg) {
  const makeHandle = (cx, cy, isStart) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.classList.add('line-handle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', '5');
    c.style.fill = 'var(--acc, #29b6d4)'; c.style.stroke = 'var(--bg-panel, #2b2b2b)';
    c.style.strokeWidth = '2'; c.style.cursor = 'crosshair'; c.style.opacity = '0';
    c.addEventListener('mousedown', e => {
      if (!editActive || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      _dragHandle(e, lineVis, hitLine, c, isStart, obj, svg);
    });
    svg.appendChild(c);
    return c;
  };
  return [
    makeHandle(`${obj.x}%`, `${obj.y}%`, true),
    makeHandle(`${obj.x2 ?? obj.x+20}%`, `${obj.y2 ?? obj.y}%`, false),
  ];
}

function _dragHandle(e, lineVis, hitLine, handle, isStart, obj, svg) {
  const canvas = document.getElementById('nv2-canvas');
  const rect   = canvas.getBoundingClientRect();
  lineVis.style.opacity = '0.6';

  const onMove = ev => {
    const nx = ((ev.clientX - rect.left) / rect.width  * 100).toFixed(2);
    const ny = ((ev.clientY - rect.top)  / rect.height * 100).toFixed(2);
    const attr = isStart ? ['x1','y1'] : ['x2','y2'];
    lineVis.setAttribute(attr[0], `${nx}%`); lineVis.setAttribute(attr[1], `${ny}%`);
    hitLine.setAttribute(attr[0], `${nx}%`); hitLine.setAttribute(attr[1], `${ny}%`);
    handle.setAttribute('cx', `${nx}%`); handle.setAttribute('cy', `${ny}%`);
    _updateAngleDisplay(lineVis);
  };

  const onUp = async () => {
    lineVis.style.opacity = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    const newX  = parseFloat(lineVis.getAttribute('x1'));
    const newY  = parseFloat(lineVis.getAttribute('y1'));
    const newX2 = parseFloat(lineVis.getAttribute('x2'));
    const newY2 = parseFloat(lineVis.getAttribute('y2'));
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/pos`, 'PATCH',
      { x: newX, y: newY, x2: newX2, y2: newY2 });
    obj.x = newX; obj.y = newY; obj.x2 = newX2; obj.y2 = newY2;
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}

function _lineAngle(lineVis) {
  const x1 = parseFloat(lineVis.getAttribute('x1'));
  const y1 = parseFloat(lineVis.getAttribute('y1'));
  const x2 = parseFloat(lineVis.getAttribute('x2'));
  const y2 = parseFloat(lineVis.getAttribute('y2'));
  return ((Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI) + 360) % 360;
}

function _updateAngleDisplay(lineVis) {
  const el  = document.getElementById('ln-angle');
  const lbl = document.getElementById('ln-angle-val');
  if (!el || !lbl) return;
  const deg = Math.round(_lineAngle(lineVis));
  el.value = deg; lbl.textContent = deg + '°';
}

function showLineContextMenu(e, lineVis, obj) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.id = 'nv2-ctx-menu'; menu.className = 'ctx-menu';
  menu.style.left = `${e.clientX}px`; menu.style.top = `${e.clientY}px`;
  const items = [
    { label: '↔ Linienstil',         action: () => openLineStyleDialog(lineVis, obj) },
    { label: '🌡 Weathermap-Konfig.', action: () => openWeathermapLineDlg(lineVis, obj) },
    { label: '◫ Layer zuweisen',      action: () => openLayerDialog(lineVis, obj) },
    { label: '🗑 Entfernen', action: () => {
        lineVis.remove();
        document.getElementById(`nv2-${obj.object_id}`)?.remove();
        api(`/api/maps/${activeMapId}/objects/${obj.object_id}`, 'DELETE');
      }, cls: 'ctx-danger' },
  ];
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'ctx-item' + (item.cls ? ' ' + item.cls : '');
    btn.textContent = item.label;
    btn.onclick = () => { closeContextMenu(); item.action(); };
    menu.appendChild(btn);
  });
  menu.addEventListener('click', e => e.stopPropagation());
  document.body.appendChild(menu);
  _ctxMenu = menu;
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}

function _startLineDrag(e, lineVis, hitLine, obj, svg) {
  const canvas = document.getElementById('nv2-canvas');
  const rect   = canvas.getBoundingClientRect();
  const x1 = parseFloat(lineVis.getAttribute('x1')), y1 = parseFloat(lineVis.getAttribute('y1'));
  const x2 = parseFloat(lineVis.getAttribute('x2')), y2 = parseFloat(lineVis.getAttribute('y2'));
  const mx = (e.clientX - rect.left) / rect.width * 100;
  const my = (e.clientY - rect.top)  / rect.height * 100;
  const moveStart = Math.hypot(mx - x1, my - y1) < Math.hypot(mx - x2, my - y2);
  lineVis.style.opacity = '0.6';

  const onMove = ev => {
    const nx = ((ev.clientX - rect.left) / rect.width  * 100).toFixed(2);
    const ny = ((ev.clientY - rect.top)  / rect.height * 100).toFixed(2);
    if (moveStart) {
      lineVis.setAttribute('x1', `${nx}%`); lineVis.setAttribute('y1', `${ny}%`);
      hitLine.setAttribute('x1', `${nx}%`); hitLine.setAttribute('y1', `${ny}%`);
      obj._handles?.[0]?.setAttribute('cx', `${nx}%`);
      obj._handles?.[0]?.setAttribute('cy', `${ny}%`);
    } else {
      lineVis.setAttribute('x2', `${nx}%`); lineVis.setAttribute('y2', `${ny}%`);
      hitLine.setAttribute('x2', `${nx}%`); hitLine.setAttribute('y2', `${ny}%`);
      obj._handles?.[1]?.setAttribute('cx', `${nx}%`);
      obj._handles?.[1]?.setAttribute('cy', `${ny}%`);
    }
    _updateAngleDisplay(lineVis);
  };

  const onUp = async () => {
    lineVis.style.opacity = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    const newX  = parseFloat(lineVis.getAttribute('x1'));
    const newY  = parseFloat(lineVis.getAttribute('y1'));
    const newX2 = parseFloat(lineVis.getAttribute('x2'));
    const newY2 = parseFloat(lineVis.getAttribute('y2'));
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/pos`, 'PATCH',
      { x: newX, y: newY, x2: newX2, y2: newY2 });
    obj.x = newX; obj.y = newY; obj.x2 = newX2; obj.y2 = newY2;
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}

function openLineStyleDialog(lineVis, obj) {
  closeResizeDialog();
  const panel = document.createElement('div');
  panel.id = 'nv2-resize-panel'; panel.className = 'resize-panel';
  const cvRect = document.getElementById('nv2-canvas').getBoundingClientRect();
  panel.style.left = `${cvRect.width / 2 - 120}px`; panel.style.top = '60px';

  panel.innerHTML = `
    <div class="rp-head"><span>Linienstil</span><button class="rp-close" id="rp-close-btn">✕</button></div>
    <div class="rp-body" style="display:flex;flex-direction:column;gap:8px;padding:8px">
      <label style="font-size:11px">Farbe <input type="color" id="ln-color" value="${obj.color || '#475569'}" style="margin-left:6px"></label>
      <label style="font-size:11px">Stil
        <select id="ln-style" style="margin-left:6px">
          <option value="solid"  ${obj.line_style==='solid'  ?'selected':''}>Durchgezogen</option>
          <option value="dashed" ${obj.line_style==='dashed' ?'selected':''}>Gestrichelt</option>
          <option value="dotted" ${obj.line_style==='dotted' ?'selected':''}>Gepunktet</option>
        </select>
      </label>
      <label style="font-size:11px">Breite <input type="range" id="ln-width" min="1" max="10" value="${obj.line_width ?? 1}" style="vertical-align:middle"> <span id="ln-width-val">${obj.line_width ?? 1}px</span></label>
      <label style="font-size:11px">Winkel <input type="range" id="ln-angle" min="0" max="359" step="1" value="${Math.round(_lineAngle(lineVis))}" style="vertical-align:middle"> <span id="ln-angle-val">${Math.round(_lineAngle(lineVis))}°</span></label>
    </div>
    <div class="rp-foot">
      <button class="btn-cancel rp-cancel" id="rp-cancel-btn">Abbrechen</button>
      <button class="btn-ok rp-ok" id="rp-ok-btn">Übernehmen</button>
    </div>`;

  document.getElementById('nv2-canvas').appendChild(panel);
  panel.addEventListener('click', e => e.stopPropagation());

  const colorIn  = panel.querySelector('#ln-color');
  const styleIn  = panel.querySelector('#ln-style');
  const widthIn  = panel.querySelector('#ln-width');
  const widthLbl = panel.querySelector('#ln-width-val');
  const angleIn  = panel.querySelector('#ln-angle');
  const angleLbl = panel.querySelector('#ln-angle-val');
  const dashMap  = { dashed:'8,4', dotted:'2,4' };

  const applyAngle = deg => {
    const rad = deg * Math.PI / 180;
    const x1  = parseFloat(lineVis.getAttribute('x1'));
    const y1  = parseFloat(lineVis.getAttribute('y1'));
    const x2o = parseFloat(lineVis.getAttribute('x2'));
    const y2o = parseFloat(lineVis.getAttribute('y2'));
    const len = Math.hypot(x2o - x1, y2o - y1);
    const nx2 = (x1 + Math.cos(rad) * len).toFixed(2);
    const ny2 = (y1 + Math.sin(rad) * len).toFixed(2);
    lineVis.setAttribute('x2', `${nx2}%`); lineVis.setAttribute('y2', `${ny2}%`);
    obj._handles?.[1]?.setAttribute('cx', `${nx2}%`);
    obj._handles?.[1]?.setAttribute('cy', `${ny2}%`);
    return { nx2: parseFloat(nx2), ny2: parseFloat(ny2) };
  };

  const preview = () => {
    lineVis.setAttribute('stroke', colorIn.value);
    lineVis.setAttribute('stroke-width', widthIn.value);
    const dash = dashMap[styleIn.value];
    dash ? lineVis.setAttribute('stroke-dasharray', dash) : lineVis.removeAttribute('stroke-dasharray');
    widthLbl.textContent = widthIn.value + 'px';
  };
  colorIn.addEventListener('input',  preview);
  styleIn.addEventListener('change', preview);
  widthIn.addEventListener('input',  preview);
  angleIn.addEventListener('input',  () => { applyAngle(parseInt(angleIn.value)); angleLbl.textContent = angleIn.value + '°'; });

  panel.querySelector('#rp-close-btn').onclick  =
  panel.querySelector('#rp-cancel-btn').onclick = closeResizeDialog;

  panel.querySelector('#rp-ok-btn').onclick = async () => {
    closeResizeDialog();
    obj.color = colorIn.value; obj.line_style = styleIn.value; obj.line_width = parseInt(widthIn.value);
    const { nx2, ny2 } = applyAngle(parseInt(angleIn.value));
    obj.x2 = nx2; obj.y2 = ny2;
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/props`, 'PATCH',
      { color: obj.color, line_style: obj.line_style, line_width: obj.line_width });
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/pos`, 'PATCH',
      { x: obj.x, y: obj.y, x2: obj.x2, y2: obj.y2 });
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  LAYER SYSTEM
// ═══════════════════════════════════════════════════════════════════════

let _layers = {};

function initLayers(objects) {
  const used = new Set(objects.map(o => o.layer ?? 0));
  _layers = {};
  [...used].sort((a,b)=>a-b).forEach(id => {
    _layers[id] = { id, name: id === 0 ? 'Standard' : `Layer ${id}`, visible: true, zIndex: 10 + id * 10 };
  });
  renderLayerPanel();
  applyAllLayerVisibility();
}

function renderLayerPanel() {
  const el = document.getElementById('sidebar-layers');
  if (!el) return;
  if (!Object.keys(_layers).length) {
    el.innerHTML = '<div style="padding:5px 10px 5px 20px;font-size:11px;color:var(--text-dim)">Keine Layer</div>';
    return;
  }
  el.innerHTML = Object.values(_layers).map(l => `
    <div class="layer-row" data-layer-id="${l.id}">
      <label class="layer-toggle" title="${l.visible ? 'Ausblenden' : 'Einblenden'}">
        <input type="checkbox" class="layer-cb" data-layer="${l.id}" ${l.visible ? 'checked' : ''}>
        <span class="layer-eye">${l.visible ? '👁' : '🚫'}</span>
      </label>
      <span class="layer-name" data-layer="${l.id}">${esc(l.name)}</span>
      <span class="layer-z" title="Z-Index">${l.zIndex}</span>
    </div>`).join('');

  el.querySelectorAll('.layer-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = parseInt(cb.dataset.layer);
      _layers[id].visible = cb.checked;
      const eye = cb.closest('.layer-row').querySelector('.layer-eye');
      if (eye) eye.textContent = cb.checked ? '👁' : '🚫';
      applyLayerVisibility(id);
    });
  });

  el.querySelectorAll('.layer-name').forEach(span => {
    span.addEventListener('dblclick', () => {
      const id  = parseInt(span.dataset.layer);
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = _layers[id].name; inp.className = 'layer-name-input';
      span.replaceWith(inp); inp.focus(); inp.select();
      const done = () => {
        _layers[id].name = inp.value.trim() || _layers[id].name;
        inp.replaceWith(Object.assign(document.createElement('span'), {
          className: 'layer-name', dataset: { layer: id }, textContent: _layers[id].name,
        }));
        renderLayerPanel();
      };
      inp.addEventListener('blur', done);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    });
  });
}

function applyLayerVisibility(layerId) {
  const vis = _layers[layerId]?.visible ?? true;
  const zi  = _layers[layerId]?.zIndex  ?? 10;
  document.querySelectorAll(`[data-layer="${layerId}"]`).forEach(el => {
    el.style.display = vis ? '' : 'none';
    el.style.zIndex  = zi;
  });
}

function applyAllLayerVisibility() {
  Object.keys(_layers).forEach(id => applyLayerVisibility(parseInt(id)));
}

function assignLayer(el, layerId) {
  const id = parseInt(layerId ?? 0);
  el.dataset.layer = id;
  if (!_layers[id]) {
    _layers[id] = { id, name: `Layer ${id}`, visible: true, zIndex: 10 + id * 10 };
    renderLayerPanel();
  }
  el.style.zIndex = _layers[id].zIndex;
  if (!_layers[id].visible) el.style.display = 'none';
}

function openLayerDialog(el, obj) {
  closeResizeDialog();
  const panel = document.createElement('div');
  panel.id = 'nv2-resize-panel'; panel.className = 'resize-panel';
  const cvRect = document.getElementById('nv2-canvas').getBoundingClientRect();
  panel.style.left = `${cvRect.width / 2 - 120}px`; panel.style.top = '80px';

  const curLayer = parseInt(el.dataset.layer ?? 0);
  const layerOpts = Object.values(_layers).map(l =>
    `<option value="${l.id}" ${l.id === curLayer ? 'selected' : ''}>${esc(l.name)} (z:${l.zIndex})</option>`
  ).join('');

  panel.innerHTML = `
    <div class="rp-head"><span>Layer zuweisen</span><button class="rp-close" id="rp-close-btn">✕</button></div>
    <div class="rp-body" style="display:flex;flex-direction:column;gap:8px;padding:8px">
      <label style="font-size:11px">Layer <select id="layer-select" style="margin-left:6px">${layerOpts}</select></label>
      <label style="font-size:11px">Neuer Layer
        <input type="number" id="layer-new" min="0" max="99" placeholder="ID" style="width:48px;margin-left:6px">
        <input type="text" id="layer-new-name" placeholder="Name" style="width:80px;margin-left:4px">
      </label>
    </div>
    <div class="rp-foot">
      <button class="btn-cancel rp-cancel" id="rp-cancel-btn">Abbrechen</button>
      <button class="btn-ok rp-ok" id="rp-ok-btn">Übernehmen</button>
    </div>`;

  document.getElementById('nv2-canvas').appendChild(panel);
  panel.addEventListener('click', e => e.stopPropagation());
  panel.querySelector('#rp-close-btn').onclick  =
  panel.querySelector('#rp-cancel-btn').onclick = closeResizeDialog;

  panel.querySelector('#rp-ok-btn').onclick = async () => {
    const newIdInput = panel.querySelector('#layer-new').value.trim();
    let targetId = newIdInput !== '' ? parseInt(newIdInput) : parseInt(panel.querySelector('#layer-select').value);
    if (isNaN(targetId)) targetId = 0;
    if (newIdInput !== '') {
      const name = panel.querySelector('#layer-new-name').value.trim() || `Layer ${targetId}`;
      if (!_layers[targetId]) {
        _layers[targetId] = { id: targetId, name, visible: true, zIndex: 10 + targetId * 10 };
        renderLayerPanel();
      }
    }
    closeResizeDialog();
    assignLayer(el, targetId);
    obj.layer = targetId;
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/props`, 'PATCH', { layer: targetId });
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  TOOLTIP
// ═══════════════════════════════════════════════════════════════════════

let _activeTooltip = null;

function showTooltip(el, obj) {
  hideTooltip();
  const tt = document.createElement('div');
  tt.className = 'nv2-tooltip';

  if (obj.type === 'gadget') {
    const cfg  = obj.gadget_config ?? {};
    const val  = cfg.value ?? 0;
    const unit = cfg.unit  ?? '';
    const min  = cfg.min   ?? 0;
    const max  = cfg.max   ?? 100;
    const warn = cfg.warning  ?? 70;
    const crit = cfg.critical ?? 90;
    const pct  = Math.min(100, Math.max(0, ((val - min) / ((max - min) || 1)) * 100));
    const col  = pct >= 90 ? 'crit' : pct >= 70 ? 'warn' : 'ok';
    const hostData = cfg.host_name ? hostCache[cfg.host_name] : null;

    let rows = `
      <div class="tt-name">${esc(cfg.metric || obj.label || 'Gadget')}</div>
      <div class="tt-row"><span>Wert</span><b class="tt-${col}">${_fmtVal(val)}${unit}</b></div>
      <div class="tt-row"><span>Bereich</span><b>${min}${unit} – ${max}${unit}</b></div>`;

    if (cfg.type !== 'sparkline') {
      rows += `
      <div class="tt-row"><span>⚠ Warning</span><b class="tt-warn">${_fmtVal(warn)}${unit} <span style="color:var(--text-dim)">(${Math.round(_pctVal(warn, min, max))}%)</span></b></div>
      <div class="tt-row"><span>✕ Critical</span><b class="tt-crit">${_fmtVal(crit)}${unit} <span style="color:var(--text-dim)">(${Math.round(_pctVal(crit, min, max))}%)</span></b></div>`;
    }
    if (cfg.type === 'weather' && cfg.direction === 'both') {
      rows += `
      <div class="tt-row"><span>↑ Ausgehend</span><b>${_fmtVal(cfg.value_out ?? val)}${unit}</b></div>
      <div class="tt-row"><span>↓ Eingehend</span><b>${_fmtVal(cfg.value_in  ?? 0  )}${unit}</b></div>`;
    }
    if (cfg.host_name)            rows += `<div class="tt-row"><span>Host</span><b>${esc(cfg.host_name)}</b></div>`;
    if (cfg.service_description)  rows += `<div class="tt-row"><span>Service</span><b>${esc(cfg.service_description)}</b></div>`;
    if (hostData) {
      const lbl = hostData.state_label ?? 'UNKNOWN';
      rows += `<div class="tt-row"><span>Host-Status</span><b class="tt-${STATE_CHIP[lbl] ?? 'unkn'}">${lbl}</b></div>`;
    }
    if (cfg.type === 'sparkline' && cfg.history?.length) {
      const hist = cfg.history;
      rows += `
      <div class="tt-row"><span>Min / Max</span><b>${Math.min(...hist).toFixed(1)} / ${Math.max(...hist).toFixed(1)}${unit}</b></div>
      <div class="tt-row"><span>Ø Durchschnitt</span><b>${(hist.reduce((a,b)=>a+b,0)/hist.length).toFixed(1)}${unit}</b></div>`;
    }
    tt.innerHTML = rows;
  } else {
    const h     = hostCache[obj.name];
    const label = h?.state_label ?? 'UNKNOWN';
    const tc    = STATE_CHIP[label] ?? 'unkn';
    tt.innerHTML = `
      <div class="tt-name">${esc(obj.name)}</div>
      <div class="tt-row"><span>Status</span><b class="tt-${tc}">${label}</b></div>
      ${h ? `<div class="tt-row"><span>Output</span><b>${esc((h.output ?? '–').substring(0, 48))}</b></div>` : ''}
      ${h ? `<div class="tt-row"><span>Services</span><b><span class="tt-ok">${h.services_ok ?? 0}ok</span> <span class="tt-warn">${h.services_warn ?? 0}w</span> <span class="tt-crit">${h.services_crit ?? 0}c</span></b></div>` : ''}
      <div class="tt-row"><span>Typ</span><b>${esc(obj.type)}</b></div>
      <div class="tt-row"><span>Pos</span><b>${parseFloat(obj.x).toFixed(1)}% / ${parseFloat(obj.y).toFixed(1)}%</b></div>`;
  }

  const cvRect = document.getElementById('nv2-canvas').getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  tt.style.left = `${elRect.left - cvRect.left + elRect.width / 2}px`;
  tt.style.top  = `${elRect.top  - cvRect.top}px`;
  document.getElementById('nv2-canvas').appendChild(tt);
  _activeTooltip = tt;
}

function _fmtVal(v) { const n = parseFloat(v); if (isNaN(n)) return '–'; return n % 1 === 0 ? String(n) : n.toFixed(1); }
function _pctVal(val, min, max) { return Math.min(100, Math.max(0, ((val - min) / ((max - min) || 1)) * 100)); }
function hideTooltip() { _activeTooltip?.remove(); _activeTooltip = null; }


// ═══════════════════════════════════════════════════════════════════════
//  STATUS PILLS
// ═══════════════════════════════════════════════════════════════════════

function updateTopbarPills(hosts) {
  let ok = 0, warn = 0, crit = 0;
  for (const h of hosts) {
    const l = h.state_label;
    if      (l === 'UP' || l === 'OK')           ok++;
    else if (l === 'WARNING')                    warn++;
    else if (l === 'CRITICAL' || l === 'DOWN')   crit++;
  }
  document.getElementById('pill-ok')  .textContent = `● ${ok}`;
  document.getElementById('pill-warn').textContent = `● ${warn}`;
  document.getElementById('pill-crit').textContent = `● ${crit}`;
  if (activeMapId) {
    const pip = document.getElementById(`mpip-${activeMapId}`);
    if (pip) pip.className = 'map-pip ' + (crit > 0 ? 'crit' : warn > 0 ? 'warn' : ok > 0 ? 'ok' : 'unkn');
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  HOSTS SNAP-IN
// ═══════════════════════════════════════════════════════════════════════

function renderHostsPanel(hosts) {
  const body = document.getElementById('body-hosts');
  if (!hosts.length) { body.innerHTML = '<div class="empty-hint">Keine Hosts</div>'; return; }
  const sorted = [...hosts].sort((a, b) => b.state - a.state);
  body.innerHTML = sorted.map(h => {
    const c = STATE_CHIP[h.state_label] ?? 'unkn';
    return `<div class="host-row" data-host="${esc(h.name)}">
      <div class="hr-pip ${c}"></div>
      <div class="hr-body">
        <div class="hr-name">${esc(h.name)}</div>
        <div class="hr-out">${esc((h.output ?? '–').substring(0, 55))}</div>
      </div>
      <div class="hr-tag ${c}">${h.state_label}</div>
    </div>`;
  }).join('');
  body.querySelectorAll('.host-row').forEach(row => {
    row.addEventListener('click', () => focusHost(row.dataset.host));
  });
}

function focusHost(name) {
  const el = document.querySelector(`[data-name="${esc(name)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior:'smooth', block:'center' });
  el.classList.add('nv2-status-changed');
  setTimeout(() => el.classList.remove('nv2-status-changed'), 800);
}


// ═══════════════════════════════════════════════════════════════════════
//  EVENT STREAM
// ═══════════════════════════════════════════════════════════════════════

function appendEvents(hosts, services, ts) {
  const items = [
    ...hosts.map(h => ({
      bar:  STATE_CHIP[h.state_label] === 'crit' ? 'crit' : STATE_CHIP[h.state_label] === 'warn' ? 'warn' : STATE_CHIP[h.state_label] === 'ok' ? 'ok' : 'info',
      host: h.name, msg: `${h.state_label}: ${(h.output ?? '').substring(0, 60)}`, ts,
    })),
    ...services.map(s => ({
      bar:  STATE_CHIP[s.state_label] === 'crit' ? 'crit' : STATE_CHIP[s.state_label] === 'warn' ? 'warn' : STATE_CHIP[s.state_label] === 'ok' ? 'ok' : 'info',
      host: `${s.host_name} · ${s.description}`, msg: `${s.state_label}: ${(s.output ?? '').substring(0, 50)}`, ts,
    })),
  ];
  eventLog = [...items, ...eventLog].slice(0, 60);
  const body = document.getElementById('body-events');
  body.innerHTML = eventLog.map(e => `
    <div class="ev-row">
      <div class="ev-bar ${e.bar}"></div>
      <div class="ev-body">
        <div class="ev-host">${esc(e.host)}</div>
        <div class="ev-msg">${esc(e.msg)}</div>
        <div class="ev-time">${fmt(e.ts)}</div>
      </div>
    </div>`).join('');
}


// ═══════════════════════════════════════════════════════════════════════
//  SNAP-IN PANELS
// ═══════════════════════════════════════════════════════════════════════

function toggleSnapin(name) {
  if (activeSnapin === name) { closeSnapin(name); return; }
  if (activeSnapin) closeSnapin(activeSnapin);
  activeSnapin = name;
  document.getElementById(`snapin-${name}`)?.classList.add('open');
  document.getElementById(`tab-${name}`)   ?.classList.add('active');
  document.getElementById('snap-tabs')     ?.classList.add('panel-open');
}

function closeSnapin(name) {
  if (!name) return;
  document.getElementById(`snapin-${name}`)?.classList.remove('open');
  document.getElementById(`tab-${name}`)   ?.classList.remove('active');
  document.getElementById('snap-tabs')     ?.classList.remove('panel-open');
  activeSnapin = null;
}

window.toggleSnapin = toggleSnapin;
window.closeSnapin  = closeSnapin;


// ═══════════════════════════════════════════════════════════════════════
//  EDIT MODE
// ═══════════════════════════════════════════════════════════════════════

function toggleEdit() {
  editActive = !editActive;
  const btn    = document.getElementById('btn-edit');
  const addBtn = document.getElementById('btn-add-host');
  const banner = document.getElementById('nv2-edit-banner');
  const canvas = document.getElementById('nv2-canvas');
  const lbl    = document.getElementById('burger-edit-label');
  if (lbl) lbl.textContent = editActive ? 'Fertig' : 'Bearbeiten';
  if (btn) { btn.classList.toggle('on', editActive); btn.title = editActive ? 'Edit-Mode beenden (Ctrl+E)' : 'Edit-Mode starten (Ctrl+E)'; }
  addBtn.style.display = editActive ? 'flex' : 'none';
  banner.classList.toggle('show', editActive);
  canvas.classList.toggle('nv2-edit-mode', editActive);
  if (editActive) document.querySelectorAll('.nv2-node, .nv2-textbox, .nv2-container').forEach(makeDraggable);
}

function makeDraggable(el) {
  if (el._nv2drag) return;
  el._nv2drag = true;
  el.addEventListener('mousedown', e => {
    if (!editActive || e.button !== 0) return;
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault(); e.stopPropagation();
    hideTooltip();
    const canvas = document.getElementById('nv2-canvas');
    const rect   = canvas.getBoundingClientRect();
    const x0 = parseFloat(el.style.left);
    const y0 = parseFloat(el.style.top);
    const sx = e.clientX, sy = e.clientY;
    el.classList.add('nv2-dragging');
    el.style.zIndex = '40';
    const onMove = ev => {
      const zs = window.NV2_ZOOM?.getState?.() ?? { zoom: 1 };
      el.style.left = `${Math.max(0, Math.min(100, x0 + (ev.clientX - sx) / rect.width  * 100 / zs.zoom)).toFixed(2)}%`;
      el.style.top  = `${Math.max(0, Math.min(97,  y0 + (ev.clientY - sy) / rect.height * 100 / zs.zoom)).toFixed(2)}%`;
    };
    const onUp = async () => {
      el.classList.remove('nv2-dragging');
      el.style.zIndex = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      await api(`/api/maps/${activeMapId}/objects/${el.dataset.objectId}/pos`, 'PATCH',
        { x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

async function removeNode(el, obj) {
  if (!confirm(`"${obj.name ?? obj.object_id}" von der Map entfernen?`)) return;
  await api(`/api/maps/${activeMapId}/objects/${obj.object_id}`, 'DELETE');
  el.remove();
}

let _ctxMenu = null;

// ═══════════════════════════════════════════════════════════════════════
//  VIEW-MODE AKTIONEN
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_ACTIONS = [
  { id:'view_host',         label:'🔍 Im Monitoring öffnen', icon:'🔍', obj_type:['host','service','hostgroup','servicegroup','map'], url:'[monitoring_url]/[host_name]', target:'_blank', condition:(obj,h) => !!_actionConfig.monitoring_url },
  { id:'acknowledge',       label:'✔ Problem bestätigen',    icon:'✔',  obj_type:['host','service'], action:'acknowledge',       condition:(obj,h) => h && ['CRITICAL','DOWN','WARNING','UNKNOWN','UNREACHABLE'].includes(h.state_label) && !h.acknowledged },
  { id:'remove_ack',        label:'✖ Bestätigung aufheben',  icon:'✖',  obj_type:['host','service'], action:'remove_ack',        condition:(obj,h) => h?.acknowledged === true },
  { id:'schedule_downtime', label:'🔧 Wartung einplanen',    icon:'🔧', obj_type:['host','service'], action:'schedule_downtime', condition: null },
  { id:'reschedule_check',  label:'↻ Check jetzt erzwingen', icon:'↻',  obj_type:['host','service'], action:'reschedule_check',  condition: null },
  { id:'ssh',               label:'🖥 SSH (ssh://)',          icon:'🖥', obj_type:['host','service'], url:'ssh://[host_address]', target:'_self', condition:(obj,h) => !!(h?.address || obj.name) },
  { id:'rdp',               label:'🖥 RDP (Remote Desktop)',  icon:'🖥', obj_type:['host','service'], action:'rdp',               condition: null },
  { id:'http',              label:'🌐 HTTP öffnen',           icon:'🌐', obj_type:['host','service'], url:'http://[host_address]/', target:'_blank', condition: null },
  { id:'https',             label:'🔒 HTTPS öffnen',          icon:'🔒', obj_type:['host','service'], url:'https://[host_address]/', target:'_blank', condition: null },
  { id:'grafana',           label:'📊 Grafana öffnen',        icon:'📊', obj_type:['host','service'], url:'[grafana_url]/d/[host_name]', target:'_blank', condition:(obj,h) => !!_actionConfig.grafana_url },
];

let _actionConfig = JSON.parse(localStorage.getItem('nv2-action-config') || '{}');
if (!_actionConfig.monitoring_url) _actionConfig.monitoring_url = '';
if (!_actionConfig.grafana_url)    _actionConfig.grafana_url    = '';
if (!_actionConfig.enabled)        _actionConfig.enabled = ['view_host','acknowledge','remove_ack','schedule_downtime','reschedule_check','ssh'];
if (!_actionConfig.rdp_enabled)    _actionConfig.rdp_enabled = false;

function _saveActionConfig() { localStorage.setItem('nv2-action-config', JSON.stringify(_actionConfig)); }

function _expandActionUrl(url, obj, h) {
  const hostname = obj.type === 'service' ? obj.host_name : obj.name;
  const address  = h?.address || hostname || '';
  return url
    .replace(/\[host_name\]/g,     encodeURIComponent(hostname || ''))
    .replace(/\[host_address\]/g,  encodeURIComponent(address))
    .replace(/\[service_desc\]/g,  encodeURIComponent(obj.name || ''))
    .replace(/\[monitoring_url\]/g, _actionConfig.monitoring_url || '')
    .replace(/\[grafana_url\]/g,    _actionConfig.grafana_url    || '');
}

function showViewContextMenu(e, el, obj) {
  closeContextMenu();
  const types = ['host','service','hostgroup','servicegroup','map'];
  if (!types.includes(obj.type)) return;

  const h = hostCache[obj.name] ?? hostCache[`${obj.host_name}::${obj.name}`];
  const menu = document.createElement('div');
  menu.id = 'nv2-ctx-menu'; menu.className = 'ctx-menu';
  menu.style.left = `${e.clientX}px`; menu.style.top = `${e.clientY}px`;

  const label = h?.state_label ?? 'UNKNOWN';
  const col   = STATE_CHIP[label] ?? 'unkn';
  const hdr   = document.createElement('div');
  hdr.style.cssText = 'padding:6px 14px 5px;border-bottom:1px solid var(--border);margin-bottom:3px';
  hdr.innerHTML = `
    <div style="font-size:11.5px;font-weight:600;color:var(--text)">${esc(obj.label || obj.name)}</div>
    <div style="font-size:9px;font-family:var(--mono);color:var(--${col});margin-top:1px">
      ${label}${h?.output ? ' · ' + esc(h.output.substring(0,40)) : ''}
    </div>`;
  menu.appendChild(hdr);

  const visibleActions = DEFAULT_ACTIONS.filter(a => {
    if (!a.obj_type.includes(obj.type)) return false;
    if (!_actionConfig.enabled.includes(a.id)) return false;
    if (a.condition && !a.condition(obj, h)) return false;
    return true;
  });

  if (!visibleActions.length) {
    const empty = document.createElement('div');
    empty.className = 'ctx-item'; empty.style.color = 'var(--text-dim)'; empty.style.cursor = 'default';
    empty.textContent = 'Keine Aktionen verfügbar';
    menu.appendChild(empty);
  }

  visibleActions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'ctx-item';
    btn.textContent = action.label;
    btn.onclick = () => { closeContextMenu(); _performAction(action, obj, h); };
    menu.appendChild(btn);
  });

  const div = document.createElement('div');
  div.style.cssText = 'height:1px;background:var(--border);margin:3px 0';
  menu.appendChild(div);

  const cfgBtn = document.createElement('button');
  cfgBtn.className = 'ctx-item'; cfgBtn.style.color = 'var(--text-dim)';
  cfgBtn.textContent = '⚙ Aktionen konfigurieren…';
  cfgBtn.onclick = () => { closeContextMenu(); openActionConfigDlg(); };
  menu.appendChild(cfgBtn);

  menu.addEventListener('click', e => e.stopPropagation());
  document.body.appendChild(menu);
  _ctxMenu = menu;
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}

function _performAction(action, obj, h) {
  const hostname = obj.type === 'service' ? obj.host_name : obj.name;
  if (action.url) { const url = _expandActionUrl(action.url, obj, h); if (url) window.open(url, action.target ?? '_blank'); return; }
  switch (action.action) {
    case 'acknowledge':       openAcknowledgeDlg(obj, h); break;
    case 'remove_ack':        _apiAction('remove_ack', hostname, obj.type === 'service' ? obj.name : null); break;
    case 'reschedule_check':  _apiAction('reschedule_check', hostname, obj.type === 'service' ? obj.name : null); break;
    case 'schedule_downtime': openDowntimeDlg(obj, h); break;
    case 'rdp': { const addr = h?.address || hostname; window.open(`rdp://full%20address=s:${encodeURIComponent(addr)}&audiomode=i:2`, '_self'); break; }
  }
}

async function _apiAction(action, hostname, service) {
  const body = { action, hostname, ...(service ? { service } : {}) };
  const res  = await api('/api/actions', 'POST', body);
  if (res) setStatusBar(`✔ ${action} für ${hostname} ausgeführt`);
  else     setStatusBar(`⚠ ${action} fehlgeschlagen`);
}

function openAcknowledgeDlg(obj, h) {
  document.getElementById('dlg-ack')?.remove();
  const hostname = obj.type === 'service' ? obj.host_name : obj.name;
  const label    = h?.state_label ?? 'UNKNOWN';
  const col      = STATE_CHIP[label] ?? 'unkn';

  const dlg = document.createElement('div');
  dlg.id = 'dlg-ack'; dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:400px">
      <h3>Problem bestätigen</h3>
      <div style="padding:8px 10px;background:var(--bg);border-radius:var(--r);border-left:3px solid var(--${col});margin-bottom:12px">
        <div style="font-size:12px;font-weight:600">${esc(hostname)}</div>
        <div style="font-size:10px;font-family:var(--mono);color:var(--${col})">${label}</div>
        ${h?.output ? `<div style="font-size:10px;color:var(--text-dim);margin-top:3px">${esc(h.output.substring(0,80))}</div>` : ''}
      </div>
      <div class="f-row">
        <label class="f-label">Kommentar</label>
        <input class="f-input" id="ack-comment" type="text" placeholder="Grund für die Bestätigung…" autofocus>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px"><input type="checkbox" id="ack-sticky" checked> Sticky (bleibt bis Problem gelöst)</label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px"><input type="checkbox" id="ack-notify" checked> Benachrichtigung senden</label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px"><input type="checkbox" id="ack-persist"> Persistenter Kommentar</label>
      </div>
      <div class="dlg-actions" style="margin-top:16px">
        <button class="btn-cancel" onclick="document.getElementById('dlg-ack').remove()">Abbrechen</button>
        <button class="btn-ok" onclick="_confirmAck('${esc(hostname)}','${esc(obj.type)}',${obj.type==='service'?`'${esc(obj.name)}'`:'null'})">✔ Bestätigen</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
  setTimeout(() => document.getElementById('ack-comment')?.focus(), 80);
}

window._confirmAck = async function(hostname, type, service) {
  const comment = document.getElementById('ack-comment')?.value.trim();
  if (!comment) { document.getElementById('ack-comment')?.focus(); return; }
  const sticky  = document.getElementById('ack-sticky')?.checked  ?? true;
  const notify  = document.getElementById('ack-notify')?.checked  ?? true;
  const persist = document.getElementById('ack-persist')?.checked ?? false;
  document.getElementById('dlg-ack')?.remove();
  const res = await api('/api/actions', 'POST', { action:'acknowledge', hostname, type, ...(service ? {service}:{}), comment, sticky, notify, persist });
  setStatusBar(res ? `✔ Bestätigt: ${hostname}` : `⚠ Bestätigung fehlgeschlagen`);
  wsClient?.forceRefresh();
};

function openDowntimeDlg(obj, h) {
  document.getElementById('dlg-downtime')?.remove();
  const hostname = obj.type === 'service' ? obj.host_name : obj.name;
  const now   = new Date();
  const plus2 = new Date(now.getTime() + 2 * 3600 * 1000);
  const fmt   = d => d.toISOString().slice(0, 16);

  const dlg = document.createElement('div');
  dlg.id = 'dlg-downtime'; dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:420px">
      <h3>🔧 Wartung einplanen</h3>
      <div class="f-row">
        <label class="f-label">Host${obj.type==='service'?' / Service':''}</label>
        <div style="font-family:var(--mono);font-size:11px;color:var(--text)">${esc(hostname)}${obj.type==='service' ? ' · ' + esc(obj.name) : ''}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div><label class="f-label">Start</label><input class="f-input" id="dt-start" type="datetime-local" value="${fmt(now)}"></div>
        <div><label class="f-label">Ende</label><input class="f-input" id="dt-end" type="datetime-local" value="${fmt(plus2)}"></div>
      </div>
      <div class="f-row" style="margin-top:8px">
        <label class="f-label">Kommentar</label>
        <input class="f-input" id="dt-comment" type="text" placeholder="Grund für die Wartung…" autofocus>
      </div>
      <div style="margin-top:8px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px"><input type="checkbox" id="dt-child-hosts"> Auch Kind-Hosts in Wartung setzen</label></div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <label class="f-label" style="width:100%;margin-bottom:2px">Schnellauswahl</label>
        ${[30,60,120,240,480].map(m => `<button class="tb-btn" onclick="_dtQuick(${m})" style="font-size:10px;padding:3px 8px">${m < 60 ? m+'min' : (m/60)+'h'}</button>`).join('')}
      </div>
      <div class="dlg-actions" style="margin-top:16px">
        <button class="btn-cancel" onclick="document.getElementById('dlg-downtime').remove()">Abbrechen</button>
        <button class="btn-ok" onclick="_confirmDowntime('${esc(hostname)}','${esc(obj.type)}',${obj.type==='service'?`'${esc(obj.name)}'`:'null'})">🔧 Wartung einplanen</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
  setTimeout(() => document.getElementById('dt-comment')?.focus(), 80);
}

window._dtQuick = function(minutes) {
  const now = new Date(), end = new Date(now.getTime() + minutes * 60000);
  const fmt = d => d.toISOString().slice(0, 16);
  const s = document.getElementById('dt-start'), e = document.getElementById('dt-end');
  if (s) s.value = fmt(now); if (e) e.value = fmt(end);
};

window._confirmDowntime = async function(hostname, type, service) {
  const comment    = document.getElementById('dt-comment')?.value.trim() || 'Geplante Wartung';
  const startInput = document.getElementById('dt-start')?.value;
  const endInput   = document.getElementById('dt-end')?.value;
  const childHosts = document.getElementById('dt-child-hosts')?.checked ?? false;
  if (!startInput || !endInput) return;
  const start = Math.floor(new Date(startInput).getTime() / 1000);
  const end   = Math.floor(new Date(endInput).getTime()   / 1000);
  document.getElementById('dlg-downtime')?.remove();
  const res = await api('/api/actions', 'POST', { action:'schedule_downtime', hostname, type, ...(service ? {service}:{}), ...(childHosts ? {child_hosts:true}:{}), comment, start, end });
  setStatusBar(res ? `🔧 Wartung geplant: ${hostname}` : `⚠ Wartung fehlgeschlagen`);
  wsClient?.forceRefresh();
};

function openActionConfigDlg() {
  document.getElementById('dlg-action-cfg')?.remove();
  const dlg = document.createElement('div');
  dlg.id = 'dlg-action-cfg'; dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:460px">
      <h3>⚙ Aktionen konfigurieren</h3>
      <label class="f-label">Aktionen im Kontextmenü</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:12px">
        ${DEFAULT_ACTIONS.filter(a => !a.is_custom).map(a => `
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px">
            <input type="checkbox" id="ac-en-${a.id}" ${_actionConfig.enabled.includes(a.id) ? 'checked' : ''}>
            <span>${a.icon} ${a.label.replace(/^[^\s]+\s/,'')}</span>
          </label>`).join('')}
      </div>
      <div class="f-row">
        <label class="f-label">Monitoring-URL</label>
        <input class="f-input" id="ac-monitoring-url" type="text" placeholder="https://checkmk.local/mysite" value="${esc(_actionConfig.monitoring_url || '')}">
      </div>
      <div class="f-row" style="margin-top:8px">
        <label class="f-label">Grafana-URL</label>
        <input class="f-input" id="ac-grafana-url" type="text" placeholder="https://grafana.local" value="${esc(_actionConfig.grafana_url || '')}">
      </div>
      <div style="margin-top:12px">
        <label class="f-label">Eigene Aktionen</label>
        <div id="ac-custom-list">
          ${(_actionConfig.custom_actions ?? []).map((ca, i) => `
            <div style="display:grid;grid-template-columns:1fr 2fr auto;gap:6px;margin-bottom:6px" id="ac-ca-${i}">
              <input class="f-input" type="text" placeholder="Label" value="${esc(ca.label)}" id="ac-ca-lbl-${i}">
              <input class="f-input" type="text" placeholder="URL" value="${esc(ca.url)}" id="ac-ca-url-${i}">
              <button class="manage-btn manage-btn-danger" onclick="document.getElementById('ac-ca-${i}').remove()">🗑</button>
            </div>`).join('')}
        </div>
        <button class="tb-btn" style="margin-top:6px;font-size:11px" onclick="_acAddCustom()">＋ Eigene Aktion</button>
      </div>
      <div class="dlg-actions" style="margin-top:16px">
        <button class="btn-cancel" onclick="document.getElementById('dlg-action-cfg').remove()">Abbrechen</button>
        <button class="btn-ok" onclick="_saveActionCfg()">Speichern</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
}

window._acAddCustom = function() {
  const list = document.getElementById('ac-custom-list');
  const i = list.children.length;
  const row = document.createElement('div');
  row.id = `ac-ca-${i}`; row.style.cssText = 'display:grid;grid-template-columns:1fr 2fr auto;gap:6px;margin-bottom:6px';
  row.innerHTML = `<input class="f-input" type="text" placeholder="Label" id="ac-ca-lbl-${i}"><input class="f-input" type="text" placeholder="URL" id="ac-ca-url-${i}"><button class="manage-btn manage-btn-danger" onclick="this.closest('[id]').remove()">🗑</button>`;
  list.appendChild(row);
};

window._saveActionCfg = function() {
  _actionConfig.monitoring_url = document.getElementById('ac-monitoring-url')?.value.trim() || '';
  _actionConfig.grafana_url    = document.getElementById('ac-grafana-url')?.value.trim()    || '';
  _actionConfig.enabled        = DEFAULT_ACTIONS.filter(a => document.getElementById(`ac-en-${a.id}`)?.checked).map(a => a.id);
  const customList = document.getElementById('ac-custom-list');
  const customs    = [];
  if (customList) {
    [...customList.children].forEach((row, i) => {
      const lbl = document.getElementById(`ac-ca-lbl-${i}`)?.value.trim();
      const url = document.getElementById(`ac-ca-url-${i}`)?.value.trim();
      if (lbl && url) customs.push({ label: lbl, url, target: '_blank' });
    });
  }
  _actionConfig.custom_actions = customs;
  _syncCustomActions();
  _saveActionConfig();
  document.getElementById('dlg-action-cfg')?.remove();
  setStatusBar('✔ Aktionen gespeichert');
};

function _syncCustomActions() {
  while (DEFAULT_ACTIONS.length && DEFAULT_ACTIONS[DEFAULT_ACTIONS.length-1].is_custom) DEFAULT_ACTIONS.pop();
  (_actionConfig.custom_actions ?? []).forEach((ca, i) => {
    DEFAULT_ACTIONS.push({ id:`custom_${i}`, label:ca.label, icon:'▶', obj_type:['host','service','hostgroup','servicegroup'], url:ca.url, target:ca.target ?? '_blank', condition:null, is_custom:true });
    if (!_actionConfig.enabled.includes(`custom_${i}`)) _actionConfig.enabled.push(`custom_${i}`);
  });
}
_syncCustomActions();

window.showViewContextMenu  = showViewContextMenu;
window.openAcknowledgeDlg   = openAcknowledgeDlg;
window.openDowntimeDlg      = openDowntimeDlg;
window.openActionConfigDlg  = openActionConfigDlg;

function showNodeContextMenu(e, el, obj) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.id = 'nv2-ctx-menu'; menu.className = 'ctx-menu';
  menu.style.left = `${e.clientX}px`; menu.style.top = `${e.clientY}px`;
  const isTextbox = obj.type === 'textbox', isGadget = obj.type === 'gadget';
  const items = [
    { label:'✏ Text bearbeiten',      action:() => openTextboxDialog(el, obj),           hide:!isTextbox },
    { label:'⚙ Gadget konfigurieren', action:() => openGadgetConfigDialog(el, obj),       hide:!isGadget },
    { label:'⤢ Größe ändern',        action:() => openResizeDialog(el, obj),             hide:isTextbox || isGadget },
    { label:'🖼 Iconset wechseln',    action:() => openIconsetDialog(el, obj),            hide:!['host','service','hostgroup','servicegroup','map'].includes(obj.type) },
    { label:'◫ Layer zuweisen',       action:() => openLayerDialog(el, obj) },
    { label:'🗑 Entfernen',           action:() => removeNode(el, obj), cls:'ctx-danger' },
  ];
  items.forEach(item => {
    if (item.hide) return;
    const btn = document.createElement('button');
    btn.className = 'ctx-item' + (item.cls ? ' ' + item.cls : '');
    btn.textContent = item.label;
    btn.onclick = () => { closeContextMenu(); item.action(); };
    menu.appendChild(btn);
  });
  menu.addEventListener('click', e => e.stopPropagation());
  document.body.appendChild(menu);
  _ctxMenu = menu;
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}

function closeContextMenu() { _ctxMenu?.remove(); _ctxMenu = null; }

function openTextboxDialog(el, obj) {
  document.getElementById('dlg-textbox-props')?.remove();
  const dlg = document.createElement('div');
  dlg.id = 'dlg-textbox-props'; dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:380px">
      <h3>Textbox bearbeiten</h3>
      <label class="f-label">Text</label>
      <textarea class="f-input" id="tbp-text" rows="4" style="resize:vertical;font-family:var(--sans);font-size:13px;line-height:1.5">${esc(obj.text ?? '')}</textarea>
      <label class="f-label" style="margin-top:10px">Link <span style="color:var(--text-dim);font-weight:400">(optional)</span></label>
      <input class="f-input" id="tbp-link" type="text" placeholder="https://…" value="${esc(obj.link ?? '')}">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">
        <div><label class="f-label">Schriftgröße</label><input class="f-input" id="tbp-size" type="number" value="${obj.font_size ?? 13}" min="8" max="72"></div>
        <div><label class="f-label">Textfarbe</label><input class="f-input-color" id="tbp-color" type="color" value="${obj.color && obj.color.startsWith('#') ? obj.color : '#e0e0e0'}"></div>
        <div><label class="f-label">Hintergrund</label><input class="f-input-color" id="tbp-bg" type="color" value="${obj.bg_color && obj.bg_color.startsWith('#') ? obj.bg_color : '#2b2b2b'}"></div>
      </div>
      <label class="f-label" style="margin-top:10px;display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="tbp-bold" ${obj.bold ? 'checked' : ''}> Fett</label>
      <div class="dlg-actions" style="margin-top:16px">
        <button class="btn-cancel" id="tbp-cancel">Abbrechen</button>
        <button class="btn-ok" id="tbp-ok">Übernehmen</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  const taText = dlg.querySelector('#tbp-text'), inLink = dlg.querySelector('#tbp-link');
  const inSize = dlg.querySelector('#tbp-size'), inColor = dlg.querySelector('#tbp-color');
  const inBg   = dlg.querySelector('#tbp-bg'),   cbBold  = dlg.querySelector('#tbp-bold');

  const preview = () => {
    el.style.fontSize = `${inSize.value}px`; el.style.fontWeight = cbBold.checked ? '700' : '400';
    el.style.color = inColor.value; el.style.background = inBg.value;
    el.textContent = taText.value || obj.text;
  };
  [taText,inSize,inColor,inBg].forEach(i => i.addEventListener('input', preview));
  cbBold.addEventListener('change', preview);
  taText.focus(); taText.select();

  dlg.querySelector('#tbp-cancel').onclick = () => {
    el.style.fontSize = `${obj.font_size ?? 13}px`; el.style.fontWeight = obj.bold ? '700' : '400';
    el.style.color = obj.color || 'var(--text)'; el.style.background = obj.bg_color || '';
    el.textContent = obj.text ?? ''; dlg.remove();
  };

  dlg.querySelector('#tbp-ok').onclick = async () => {
    const newProps = { text: taText.value || obj.text, link: inLink.value.trim() || null, font_size: parseInt(inSize.value) || 13, color: inColor.value, bg_color: inBg.value, bold: cbBold.checked };
    el.textContent = newProps.text; el.style.fontSize = `${newProps.font_size}px`;
    el.style.fontWeight = newProps.bold ? '700' : '400'; el.style.color = newProps.color; el.style.background = newProps.bg_color;
    if (newProps.link) {
      el.dataset.href = newProps.link; el.title = newProps.link;
      if (!el._linkHandler) { el._linkHandler = () => { if (!editActive) window.open(el.dataset.href, '_blank'); }; el.addEventListener('click', el._linkHandler); }
      el.style.cursor = 'pointer'; el.style.textDecoration = 'underline'; el.style.textDecorationStyle = 'dotted';
    } else {
      delete el.dataset.href; el.title = '';
      if (el._linkHandler) { el.removeEventListener('click', el._linkHandler); el._linkHandler = null; }
      el.style.cursor = ''; el.style.textDecoration = '';
    }
    Object.assign(obj, newProps);
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/props`, 'PATCH', newProps);
    dlg.remove();
  };
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.querySelector('#tbp-cancel').click(); });
}

function openWeathermapLineDlg(lineVis, obj) {
  document.getElementById('dlg-wm-line')?.remove();
  const hosts = Object.keys(hostCache);
  const hostOpts = (val) => hosts.map(h => `<option value="${esc(h)}" ${val===h?'selected':''}>${esc(h)}</option>`).join('');

  const dlg = document.createElement('div');
  dlg.id = 'dlg-wm-line'; dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:420px">
      <h3>Weathermap-Linie konfigurieren</h3>
      <div class="f-row">
        <label class="f-label">Linientyp</label>
        <div style="display:flex;gap:10px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="radio" name="wm-type" value="static" ${obj.line_type !== 'weathermap' ? 'checked' : ''} onchange="_wmDlgUpdate()">⬛ Statisch</label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="radio" name="wm-type" value="weathermap" ${obj.line_type === 'weathermap' ? 'checked' : ''} onchange="_wmDlgUpdate()">🌡 Weathermap</label>
        </div>
      </div>
      <div id="wm-fields" style="${obj.line_type==='weathermap'?'':'display:none'}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
          <div><label class="f-label">Von (host_from)</label><select class="f-select" id="wm-host-from"><option value="">(keiner)</option>${hostOpts(obj.host_from ?? '')}</select></div>
          <div><label class="f-label">Nach (host_to)</label><select class="f-select" id="wm-host-to"><option value="">(keiner)</option>${hostOpts(obj.host_to ?? '')}</select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <div><label class="f-label">Label Von</label><input class="f-input" id="wm-label-from" type="text" placeholder="42 Mbps out" value="${esc(obj.label_from ?? '')}"></div>
          <div><label class="f-label">Label Nach</label><input class="f-input" id="wm-label-to" type="text" placeholder="18 Mbps in" value="${esc(obj.label_to ?? '')}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <div><label class="f-label">Linienbreite</label><input class="f-input" id="wm-width" type="number" value="${obj.line_width ?? 4}" min="1" max="12"></div>
          <div><label class="f-label">Stil</label><select class="f-select" id="wm-style"><option value="solid" ${(obj.line_style??'solid')==='solid'?'selected':''}>Durchgezogen</option><option value="dashed" ${obj.line_style==='dashed'?'selected':''}>Gestrichelt</option><option value="dotted" ${obj.line_style==='dotted'?'selected':''}>Gepunktet</option></select></div>
        </div>
        <div style="margin-top:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px"><input type="checkbox" id="wm-split" ${obj.line_split !== false ? 'checked' : ''}> Geteilte Linie</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;margin-top:6px"><input type="checkbox" id="wm-arrow" ${obj.show_arrow !== false ? 'checked' : ''}> Pfeilkopf anzeigen</label>
        </div>
        <div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:var(--r);border:1px solid var(--border)">
          <div style="font-size:9px;font-family:var(--mono);color:var(--text-dim);margin-bottom:6px">VORSCHAU</div>
          <svg viewBox="0 0 200 40" width="200" height="40" id="wm-preview-svg">
            <line x1="10%" y1="50%" x2="45%" y2="50%" id="wm-prev-from" stroke="var(--ok)" stroke-width="4" stroke-linecap="round"/>
            <line x1="55%" y1="50%" x2="90%" y2="50%" id="wm-prev-to" stroke="var(--warn)" stroke-width="4" stroke-linecap="round"/>
            <circle cx="90%" cy="50%" r="4" id="wm-prev-arrow" fill="var(--warn)"/>
            <text x="25%" y="35%" font-size="8" font-family="monospace" id="wm-prev-lf" fill="var(--ok)" text-anchor="middle"></text>
            <text x="72%" y="35%" font-size="8" font-family="monospace" id="wm-prev-lt" fill="var(--warn)" text-anchor="middle"></text>
          </svg>
        </div>
      </div>
      <div class="dlg-actions" style="margin-top:16px">
        <button class="btn-cancel" onclick="document.getElementById('dlg-wm-line').remove()">Abbrechen</button>
        <button class="btn-ok" onclick="_wmDlgSave('${esc(obj.object_id)}')">Übernehmen</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
  _wmDlgPreview();
}

window._wmDlgUpdate = function() {
  const type = document.querySelector('input[name="wm-type"]:checked')?.value;
  const fields = document.getElementById('wm-fields');
  if (fields) fields.style.display = type === 'weathermap' ? 'block' : 'none';
};

window._wmDlgPreview = function() {
  const hf = document.getElementById('wm-host-from')?.value;
  const ht = document.getElementById('wm-host-to')?.value;
  const cf = hf ? _worstStateColor(hf) : 'var(--unkn)';
  const ct = ht ? _worstStateColor(ht) : 'var(--unkn)';
  const lf = document.getElementById('wm-label-from')?.value || hf || '';
  const lt = document.getElementById('wm-label-to')?.value   || ht || '';
  document.getElementById('wm-prev-from') ?.setAttribute('stroke', cf);
  document.getElementById('wm-prev-to')   ?.setAttribute('stroke', ct);
  document.getElementById('wm-prev-arrow')?.setAttribute('fill',   ct);
  document.getElementById('wm-prev-lf')   ?.setAttribute('fill',   cf);
  document.getElementById('wm-prev-lt')   ?.setAttribute('fill',   ct);
  const lfe = document.getElementById('wm-prev-lf'), lte = document.getElementById('wm-prev-lt');
  if (lfe) lfe.textContent = lf; if (lte) lte.textContent = lt;
};

document.addEventListener('change', e => { if (e.target.closest('#dlg-wm-line')) _wmDlgPreview(); });
document.addEventListener('input',  e => { if (e.target.closest('#dlg-wm-line')) _wmDlgPreview(); });

window._wmDlgSave = async function(objectId) {
  const type      = document.querySelector('input[name="wm-type"]:checked')?.value ?? 'static';
  const hostFrom  = document.getElementById('wm-host-from')?.value  || undefined;
  const hostTo    = document.getElementById('wm-host-to')?.value    || undefined;
  const labelFrom = document.getElementById('wm-label-from')?.value.trim() || undefined;
  const labelTo   = document.getElementById('wm-label-to')?.value.trim()   || undefined;
  const lineWidth = parseInt(document.getElementById('wm-width')?.value)   || 4;
  const lineStyle = document.getElementById('wm-style')?.value             || 'solid';
  const split     = document.getElementById('wm-split')?.checked   ?? true;
  const arrow     = document.getElementById('wm-arrow')?.checked   ?? true;

  const props = { line_type: type==='weathermap'?'weathermap':undefined, host_from:type==='weathermap'?hostFrom:undefined, host_to:type==='weathermap'?hostTo:undefined, label_from:type==='weathermap'?labelFrom:undefined, label_to:type==='weathermap'?labelTo:undefined, line_split:split, show_arrow:arrow, line_width:lineWidth, line_style:lineStyle };

  const objRef = activeMapCfg?.objects?.find(o => o.object_id === objectId);
  if (objRef) Object.assign(objRef, props);

  const svg  = document.getElementById('nv2-lines-svg');
  const gOld = document.getElementById(`nv2-${objectId}`);
  if (gOld) gOld.remove();
  if (objRef?._handles) objRef._handles.forEach(h => h.remove());

  if (objRef && svg) { Object.assign(objRef, props); _renderLine(objRef); if (editActive) { const newEl = document.getElementById(`nv2-${objectId}`); if (newEl) makeDraggable(newEl); } }

  await api(`/api/maps/${activeMapId}/objects/${objectId}/props`, 'PATCH', props);
  document.getElementById('dlg-wm-line')?.remove();
  setStatusBar('Weathermap-Linie aktualisiert');
};

window.openWeathermapLineDlg = openWeathermapLineDlg;

function openResizeDialog(el, obj) {
  closeResizeDialog();
  const isNode   = ['host','service','hostgroup','servicegroup','map'].includes(obj.type);
  const isGadget = obj.type === 'gadget';
  const cur = isNode ? parseInt(el.style.getPropertyValue('--node-size') || '32')
              : isGadget ? parseInt(el.style.getPropertyValue('--gadget-size') || '100')
              : parseInt(el.style.transform?.match(/scale\(([\d.]+)\)/)?.[1] * 100 || '100');

  const panel = document.createElement('div');
  panel.id = 'nv2-resize-panel'; panel.className = 'resize-panel';
  const rect   = el.getBoundingClientRect();
  const cvRect = document.getElementById('nv2-canvas').getBoundingClientRect();
  panel.style.left = `${rect.left - cvRect.left + rect.width + 8}px`;
  panel.style.top  = `${rect.top  - cvRect.top}px`;

  const unit = isNode ? 'px' : '%', min = isNode ? 16 : 40, max = isNode ? 128 : 300, step = isNode ? 4 : 10;
  panel.innerHTML = `
    <div class="rp-head"><span>Größe</span><button class="rp-close" id="rp-close-btn">✕</button></div>
    <div class="rp-body"><input type="range" id="rp-slider" min="${min}" max="${max}" step="${step}" value="${cur}"><span class="rp-val" id="rp-val">${cur}${unit}</span></div>
    <div class="rp-foot"><button class="btn-cancel rp-cancel" id="rp-cancel-btn">Abbrechen</button><button class="btn-ok rp-ok" id="rp-ok-btn">Übernehmen</button></div>`;

  document.getElementById('nv2-canvas').appendChild(panel);
  const slider = panel.querySelector('#rp-slider'), valLbl = panel.querySelector('#rp-val');
  slider.addEventListener('input', () => { valLbl.textContent = slider.value + unit; applySize(el, obj, parseInt(slider.value), isNode, isGadget); });
  panel.addEventListener('click', e => e.stopPropagation());
  panel.querySelector('#rp-close-btn').onclick  =
  panel.querySelector('#rp-cancel-btn').onclick = () => { applySize(el, obj, cur, isNode, isGadget); closeResizeDialog(); };
  panel.querySelector('#rp-ok-btn').onclick = async () => {
    const v = parseInt(slider.value); closeResizeDialog();
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/props`, 'PATCH', { size: v });
    obj.size = v;
  };
}

function applySize(el, obj, v, isNode, isGadget) {
  if (isNode) {
    el.style.setProperty('--node-size', `${v}px`);
    const ring = el.querySelector('.nv2-ring');
    if (ring) { ring.style.width = `${v}px`; ring.style.height = `${v}px`; }
    const img = el.querySelector('img.nv2-icon');
    if (img) { img.width = v; img.height = v; }
  } else if (isGadget) {
    el.style.setProperty('--gadget-size', `${v}%`);
    el.style.transform = `scale(${v / 100})`; el.style.transformOrigin = 'top left';
  } else {
    el.style.transform = `scale(${v / 100})`; el.style.transformOrigin = 'top left';
  }
}

function closeResizeDialog() { document.getElementById('nv2-resize-panel')?.remove(); }

function openIconsetDialog(el, obj) {
  const all = [...KNOWN_ICONSETS, ...customIconsets];
  const cur = el.dataset.iconset || 'std_small';
  const dlg = document.createElement('div');
  dlg.id = 'nv2-iconset-dlg'; dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg" style="width:360px">
      <h3>Iconset wählen – ${esc(obj.label || obj.name)}</h3>
      <div class="iconset-grid" id="iconset-grid">
        ${all.map(s => `<div class="iconset-card ${s === cur ? 'active' : ''}" data-set="${esc(s)}"><img src="assets/icons/${esc(s)}/ok.svg" width="32" height="32" alt=""><div class="iconset-name">${esc(s)}</div></div>`).join('')}
        <div class="iconset-card iconset-upload" id="iconset-upload-card"><div style="font-size:22px">📂</div><div class="iconset-name">Upload…</div><input type="file" id="iconset-zip-input" accept=".zip" style="display:none"></div>
      </div>
      <div class="dlg-foot"><button class="btn-cancel" id="iconset-cancel">Abbrechen</button><button class="btn-ok" id="iconset-ok">Übernehmen</button></div>
    </div>`;
  document.body.appendChild(dlg);
  let selected = cur;
  dlg.querySelectorAll('.iconset-card[data-set]').forEach(card => {
    card.addEventListener('click', () => { dlg.querySelectorAll('.iconset-card').forEach(c => c.classList.remove('active')); card.classList.add('active'); selected = card.dataset.set; });
  });
  dlg.querySelector('#iconset-cancel').onclick = () => dlg.remove();
  dlg.querySelector('#iconset-ok').onclick = async () => {
    dlg.remove(); if (selected === cur) return;
    el.dataset.iconset = selected; obj.iconset = selected;
    updateNodeIcon(el, hostCache[obj.name]?.state_label ?? null);
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/props`, 'PATCH', { iconset: selected });
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  CANVAS-KLICK → OBJEKT PLATZIEREN
// ═══════════════════════════════════════════════════════════════════════

function onCanvasClick(e) {
  if (!editActive) return;
  if (e.target.closest('.nv2-node, .nv2-textbox, .nv2-container')) return;
  if (e.target.closest('.nv2-line-el, .nv2-wm-line, .line-handle')) return;
  if (document.getElementById('nv2-resize-panel')) { closeResizeDialog(); return; }
  if (_ctxMenu) { closeContextMenu(); return; }
  if (document.getElementById('nv2-iconset-dlg')) return;

  const rect  = document.getElementById('nv2-canvas').getBoundingClientRect();
  const state = window.NV2_ZOOM?.getState?.() ?? { zoom: 1, panX: 0, panY: 0 };
  const localX = (e.clientX - rect.left - state.panX) / state.zoom;
  const localY = (e.clientY - rect.top  - state.panY) / state.zoom;
  pendingPos = {
    x: (localX / rect.width  * 100).toFixed(2),
    y: (localY / rect.height * 100).toFixed(2),
  };
  openDlg('dlg-add-object');
}


// ═══════════════════════════════════════════════════════════════════════
//  DIALOGE
// ═══════════════════════════════════════════════════════════════════════

let _activeObjType = 'host';

function selectObjType(type) {
  _activeObjType = type;
  document.querySelectorAll('.type-chip').forEach(c => c.classList.toggle('active', c.dataset.type === type));
  const monTypes = ['host','hostgroup','servicegroup','map'];
  document.getElementById('dlg-fields-monitoring').style.display = monTypes.includes(type) ? 'block' : 'none';
  document.getElementById('dlg-fields-service')  .style.display = type === 'service'   ? 'block' : 'none';
  document.getElementById('dlg-fields-textbox')  .style.display = type === 'textbox'   ? 'block' : 'none';
  document.getElementById('dlg-fields-line')     .style.display = type === 'line'      ? 'block' : 'none';
  document.getElementById('dlg-fields-container').style.display = type === 'container' ? 'block' : 'none';
  const lbl = { host:'Hostname', hostgroup:'Gruppenname', servicegroup:'Gruppenname', map:'Map-ID' };
  const nameLabel = document.getElementById('dlg-name-label');
  if (nameLabel) nameLabel.textContent = lbl[type] ?? 'Name';
}

async function confirmAddObject() {
  const type = _activeObjType;
  const pos  = pendingPos ?? { x: (15 + Math.random() * 70).toFixed(1), y: (15 + Math.random() * 70).toFixed(1) };
  let payload = { type, x: parseFloat(pos.x), y: parseFloat(pos.y) };

  if (type === 'service') {
    const hostName = document.getElementById('dlg-svc-host').value.trim();
    const svcName  = document.getElementById('dlg-svc-name').value.trim();
    if (!hostName || !svcName) { document.getElementById(!hostName ? 'dlg-svc-host' : 'dlg-svc-name').focus(); return; }
    Object.assign(payload, { name: svcName, host_name: hostName, iconset: 'default', label: document.getElementById('dlg-svc-label').value.trim() || svcName });
  } else if (['host','hostgroup','servicegroup','map'].includes(type)) {
    const name = document.getElementById('dlg-obj-name').value.trim();
    if (!name) { document.getElementById('dlg-obj-name').focus(); return; }
    Object.assign(payload, { name, iconset: document.getElementById('dlg-iconset').value, size: parseInt(document.getElementById('dlg-iconsize')?.value ?? '32'), label: document.getElementById('dlg-obj-label').value.trim() || name });
  } else if (type === 'textbox') {
    Object.assign(payload, { text: document.getElementById('dlg-tb-text').value.trim() || 'Text', font_size: parseInt(document.getElementById('dlg-tb-size').value) || 13, bold: document.getElementById('dlg-tb-bold').checked, color: document.getElementById('dlg-tb-color').value, bg_color: document.getElementById('dlg-tb-bg').value, border_color: '', w: 14, h: 4 });
  } else if (type === 'line') {
    const isWM = document.getElementById('dlg-ln-weathermap')?.checked;
    Object.assign(payload, { x2: parseFloat(pos.x) + 20, y2: parseFloat(pos.y), line_style: document.getElementById('dlg-ln-style').value, line_width: parseInt(document.getElementById('dlg-ln-width').value) || (isWM ? 4 : 1), color: document.getElementById('dlg-ln-color').value, ...(isWM ? { line_type:'weathermap', line_split:true, show_arrow:true } : {}) });
  } else if (type === 'container') {
    Object.assign(payload, { url: document.getElementById('dlg-ct-url').value.trim(), w: 12, h: 8 });
  }

  const obj = await api(`/api/maps/${activeMapId}/objects`, 'POST', payload);
  if (obj) { const el = createNode(obj); if (el && editActive) makeDraggable(el); }
  closeDlg('dlg-add-object');
  pendingPos = null;
}

async function confirmNewMap() {
  const title  = document.getElementById('nm-title').value.trim();
  const mapId  = document.getElementById('nm-id').value.trim();
  if (!title) { document.getElementById('nm-title').focus(); return; }
  const mode   = document.querySelector('input[name="nm-canvas-mode"]:checked')?.value ?? 'free';
  const canvas = {};
  if (mode === 'ratio') { canvas.mode = 'ratio'; canvas.ratio = document.getElementById('nm-ratio').value; }
  else if (mode === 'fixed') { canvas.mode = 'fixed'; canvas.w = parseInt(document.getElementById('nm-fixed-w').value) || 1920; canvas.h = parseInt(document.getElementById('nm-fixed-h').value) || 1080; }
  else if (mode === 'background') { canvas.mode = 'background'; }
  else { canvas.mode = 'free'; }
  closeDlg('dlg-new-map');
  const created = await api('/api/maps', 'POST', { title, map_id: mapId, canvas });
  if (created) openMap(created.id);
}

async function confirmDeleteMap() {
  if (!activeMapId) return;
  if (!confirm(`Map „${activeMapCfg?.title ?? activeMapId}" wirklich löschen?`)) return;
  await api(`/api/maps/${activeMapId}`, 'DELETE');
  showOverview();
}

let _deleteMapId = null, _deleteMapTitle = null;
async function confirmDeleteMapById() {
  if (!_deleteMapId) return;
  if (!confirm(`Map „${_deleteMapTitle ?? _deleteMapId}" wirklich löschen?`)) return;
  await api(`/api/maps/${_deleteMapId}`, 'DELETE');
  _deleteMapId = _deleteMapTitle = null;
  await loadMaps();
}

function dlgNewMap() {
  document.getElementById('nm-title').value = '';
  document.getElementById('nm-id').value    = '';
  const freeRadio = document.querySelector('input[name="nm-canvas-mode"][value="free"]');
  if (freeRadio) { freeRadio.checked = true; _nmUpdateCanvasFields(); }
  openDlg('dlg-new-map');
  setTimeout(() => document.getElementById('nm-title').focus(), 80);
}

function _nmUpdateCanvasFields() {
  const mode = document.querySelector('input[name="nm-canvas-mode"]:checked')?.value ?? 'free';
  document.getElementById('nm-fields-ratio')?.style && (document.getElementById('nm-fields-ratio').style.display      = mode === 'ratio'      ? 'flex' : 'none');
  document.getElementById('nm-fields-fixed')?.style && (document.getElementById('nm-fields-fixed').style.display      = mode === 'fixed'      ? 'grid' : 'none');
  document.getElementById('nm-fields-background')?.style && (document.getElementById('nm-fields-background').style.display = mode === 'background' ? 'block': 'none');
}
window._nmUpdateCanvasFields = _nmUpdateCanvasFields;


// ═══════════════════════════════════════════════════════════════════════
//  MAP MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

let _renameMapId = null, _parentMapId = null;

function openRenameMapDlg() {
  _renameMapId = activeMapId;
  document.getElementById('rename-map-title').value = activeMapCfg?.title ?? '';
  openDlg('dlg-rename-map');
}

async function confirmRenameMap() {
  const newTitle = document.getElementById('rename-map-title').value.trim();
  if (!newTitle || !_renameMapId) return;
  closeDlg('dlg-rename-map');
  const ok = await api(`/api/maps/${_renameMapId}/title`, 'PUT', { title: newTitle });
  if (ok) {
    if (_renameMapId === activeMapId) { activeMapCfg.title = newTitle; document.getElementById('tb-title').textContent = newTitle; }
    await loadMaps();
  }
  _renameMapId = null;
}

async function openParentMapDlg(mapId) {
  _parentMapId = mapId ?? activeMapId;
  if (!_parentMapId) return;
  const maps = await api('/api/maps') ?? [];
  const sel  = document.getElementById('parent-map-select');
  sel.innerHTML = '<option value="">(keine – Top-Level)</option>' +
    maps.filter(m => m.id !== _parentMapId).map(m => `<option value="${esc(m.id)}">${esc(m.title)}</option>`).join('');
  const currentParent = maps.find(m => m.id === _parentMapId)?.parent_map ?? '';
  sel.value = currentParent;
  openDlg('dlg-parent-map');
}

async function confirmSetParentMap() {
  if (!_parentMapId) return;
  const parentId = document.getElementById('parent-map-select').value;
  closeDlg('dlg-parent-map');
  await api(`/api/maps/${_parentMapId}/parent`, 'PUT', { parent_map: parentId || null });
  await loadMaps();
  _parentMapId = null;
}

async function openManageMapsOverlay() {
  const maps = await api('/api/maps') ?? [];
  const list  = document.getElementById('manage-maps-list');
  if (!maps.length) {
    list.innerHTML = '<div class="empty-hint">Keine Maps vorhanden.</div>';
  } else {
    list.innerHTML = maps.map(m => `
      <div class="manage-row" data-id="${esc(m.id)}">
        <span class="manage-pip"></span>
        <div class="manage-info">
          <span class="manage-title">${esc(m.title)}</span>
          <span class="manage-meta">${esc(m.id)}${m.parent_map ? ' · ↳ ' + esc(m.parent_map) : ''}</span>
        </div>
        <div class="manage-actions">
          <button class="manage-btn" title="Öffnen"
                  onclick="closeDlg('dlg-manage-maps'); openMap('${esc(m.id)}')">▶</button>
          <button class="manage-btn" title="Umbenennen"
                  onclick="_renameMapId='${esc(m.id)}'; document.getElementById('rename-map-title').value='${esc(m.title)}'; closeDlg('dlg-manage-maps'); openDlg('dlg-rename-map')">✎</button>
          <button class="manage-btn" title="Canvas-Format ändern"
                  onclick="closeDlg('dlg-manage-maps'); openCanvasModeDialog('${esc(m.id)}', '${esc(m.title)}', ${JSON.stringify(m.canvas ?? {mode:'free'}).replace(/"/g,'&quot;')})">⊡</button>
          <button class="manage-btn" title="Parent-Map setzen"
                  onclick="closeDlg('dlg-manage-maps'); openParentMapDlg('${esc(m.id)}')">🗺</button>
          <button class="manage-btn" title="Exportieren (.zip)"
                  onclick="exportMapById('${esc(m.id)}')">📤</button>
          <button class="manage-btn manage-btn-danger" title="Löschen"
                  onclick="_deleteMapId='${esc(m.id)}'; _deleteMapTitle='${esc(m.title)}'; confirmDeleteMapById(); closeDlg('dlg-manage-maps')">🗑</button>
        </div>
      </div>`).join('');
  }
  openDlg('dlg-manage-maps');
}

window.openRenameMapDlg      = openRenameMapDlg;
window.confirmRenameMap      = confirmRenameMap;
window.openParentMapDlg      = openParentMapDlg;
window.confirmSetParentMap   = confirmSetParentMap;
window.openManageMapsOverlay = openManageMapsOverlay;

async function openCanvasModeDialog(mapId, mapTitle, currentCanvas) {
  document.getElementById('dlg-canvas-mode')?.remove();
  let cfg = currentCanvas;
  if (typeof cfg === 'string') {
    try { cfg = JSON.parse(cfg.replace(/&quot;/g, '"')); } catch { cfg = { mode: 'free' }; }
  }
  cfg = cfg ?? { mode: 'free' };
  const dlg = document.createElement('div');
  dlg.id = 'dlg-canvas-mode';
  dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:400px">
      <h3>Canvas-Format · ${esc(mapTitle)}</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text)">
          <input type="radio" name="cm-mode" value="free" ${cfg.mode==='free'?'checked':''} onchange="_cmUpdate()">
          <span>🔲 <b>Frei</b> – Canvas füllt immer das gesamte Fenster</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text)">
          <input type="radio" name="cm-mode" value="ratio" ${cfg.mode==='ratio'?'checked':''} onchange="_cmUpdate()">
          <span>📐 <b>Seitenverhältnis</b> – zentriert, so groß wie möglich</span>
        </label>
        <div id="cm-fields-ratio" style="padding-left:22px;${cfg.mode==='ratio'?'':'display:none'}">
          <select class="f-select" id="cm-ratio" style="max-width:160px">
            <option value="16:9"  ${(cfg.ratio??'16:9')==='16:9' ?'selected':''}>16 : 9 (HD/FHD)</option>
            <option value="4:3"   ${(cfg.ratio??'')==='4:3'  ?'selected':''}>4 : 3 (klassisch)</option>
            <option value="21:9"  ${(cfg.ratio??'')==='21:9' ?'selected':''}>21 : 9 (Ultrawide)</option>
            <option value="3:2"   ${(cfg.ratio??'')==='3:2'  ?'selected':''}>3 : 2</option>
            <option value="1:1"   ${(cfg.ratio??'')==='1:1'  ?'selected':''}>1 : 1 (quadratisch)</option>
          </select>
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text)">
          <input type="radio" name="cm-mode" value="fixed" ${cfg.mode==='fixed'?'checked':''} onchange="_cmUpdate()">
          <span>📏 <b>Feste Auflösung</b> – Zoom passt sich an</span>
        </label>
        <div id="cm-fields-fixed" style="padding-left:22px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;${cfg.mode==='fixed'?'':'display:none'}">
          <input class="f-input" id="cm-fixed-w" type="number" value="${cfg.w??1920}" min="400" max="9999" placeholder="Breite">
          <span style="color:var(--text-dim);font-size:12px">×</span>
          <input class="f-input" id="cm-fixed-h" type="number" value="${cfg.h??1080}" min="300" max="9999" placeholder="Höhe">
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text)">
          <input type="radio" name="cm-mode" value="background" ${cfg.mode==='background'?'checked':''} onchange="_cmUpdate()">
          <span>🖼 <b>Hintergrundbild</b> – Canvas übernimmt Bildgröße pixel-genau</span>
        </label>
        <div id="cm-fields-background" style="padding-left:22px;${cfg.mode==='background'?'':'display:none'}">
          <p class="f-hint">Canvas passt sich beim nächsten Hintergrundbild-Upload an.</p>
        </div>
      </div>
      <div class="dlg-actions" style="margin-top:16px">
        <button class="btn-cancel" onclick="document.getElementById('dlg-canvas-mode').remove()">Abbrechen</button>
        <button class="btn-ok" onclick="_cmSave('${esc(mapId)}')">Übernehmen</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
}

window._cmUpdate = function() {
  const mode = document.querySelector('input[name="cm-mode"]:checked')?.value ?? 'free';
  ['ratio','fixed','background'].forEach(k => {
    const el = document.getElementById(`cm-fields-${k}`);
    if (el) el.style.display = mode === k ? (k === 'fixed' ? 'grid' : 'block') : 'none';
  });
};

window._cmSave = async function(mapId) {
  const mode = document.querySelector('input[name="cm-mode"]:checked')?.value ?? 'free';
  const canvas = { mode };
  if (mode === 'ratio')  canvas.ratio = document.getElementById('cm-ratio').value;
  if (mode === 'fixed') {
    canvas.w = parseInt(document.getElementById('cm-fixed-w').value) || 1920;
    canvas.h = parseInt(document.getElementById('cm-fixed-h').value) || 1080;
  }
  if (_demoMode) {
    const m = _demoMaps.find(m => m.id === mapId);
    if (m) m.canvas = canvas;
  } else {
    await api(`/api/maps/${mapId}/canvas`, 'PUT', canvas);
  }
  document.getElementById('dlg-canvas-mode')?.remove();
  if (mapId === activeMapId && activeMapCfg) {
    activeMapCfg.canvas = canvas;
    applyCanvasMode(document.getElementById('nv2-canvas'), canvas);
  }
  setStatusBar(`Canvas-Format für „${mapId}" gesetzt: ${mode}`);
};

window.openCanvasModeDialog = openCanvasModeDialog;


/* ═══════════════════════════════════════════════════════════════════════
   VERBINDUNGS-VERWALTUNG
═══════════════════════════════════════════════════════════════════════ */

function openConnectionsDlg() {
  document.getElementById('dlg-connections')?.remove();
  const dlg = document.createElement('div');
  dlg.id = 'dlg-connections';
  dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:520px;max-height:85vh;display:flex;flex-direction:column">
      <h3 style="flex-shrink:0">Verbindungen verwalten</h3>
      <div id="conn-list" style="flex:1;overflow-y:auto;min-height:80px;
           border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px"></div>
      <div style="flex-shrink:0">
        <div class="burger-head" style="padding:0 0 6px 0">Neue Verbindung</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label class="f-label">Name</label><input class="f-input" id="nc-name" type="text" placeholder="z.B. Checkmk Prod"></div>
          <div><label class="f-label">Typ</label>
            <select class="f-select" id="nc-type" onchange="_ncUpdateFields()">
              <option value="checkmk">Checkmk / OMD</option>
              <option value="nagios">Nagios / Icinga</option>
              <option value="tcp">TCP Socket</option>
              <option value="unix">Unix Socket (Pfad)</option>
              <option value="demo">Demo (kein Backend)</option>
            </select>
          </div>
        </div>
        <div id="nc-fields-server" style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:8px">
          <div><label class="f-label">Host / IP</label><input class="f-input" id="nc-host" type="text" placeholder="192.168.1.10"></div>
          <div><label class="f-label">Port</label><input class="f-input" id="nc-port" type="number" placeholder="6557" value="6557"></div>
        </div>
        <div id="nc-fields-site" style="margin-top:8px">
          <label class="f-label">OMD-Site <span style="color:var(--text-dim);font-weight:400">(nur Checkmk)</span></label>
          <input class="f-input" id="nc-site" type="text" placeholder="mysite">
        </div>
        <div id="nc-fields-path" style="display:none;margin-top:8px">
          <label class="f-label">Socket-Pfad</label>
          <input class="f-input" id="nc-path" type="text" placeholder="/omd/sites/mysite/tmp/run/live">
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn-cancel" style="flex:1" onclick="_ncTest()">🔌 Test</button>
          <button class="btn-ok" style="flex:2" onclick="_ncAdd()">＋ Hinzufügen</button>
        </div>
        <div id="nc-test-result" style="display:none;margin-top:8px;padding:8px;
             background:var(--bg);border-radius:var(--r);font-size:11px;font-family:var(--mono);border:1px solid var(--border)"></div>
      </div>
      <div class="dlg-actions" style="flex-shrink:0;margin-top:8px">
        <button class="btn-cancel" onclick="document.getElementById('dlg-connections').remove()">Schließen</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
  _renderConnectionList();
}

function _renderConnectionList() {
  const list = document.getElementById('conn-list');
  if (!list) return;
  if (!_connections.length) {
    list.innerHTML = '<div class="empty-hint">Keine Verbindungen konfiguriert</div>';
    return;
  }
  list.innerHTML = _connections.map((c, i) => `
    <div class="conn-row" style="display:flex;align-items:center;gap:8px;padding:9px 12px;
         border-bottom:1px solid var(--border);${i===_connections.length-1?'border-bottom:none':''}">
      <div class="conn-status-dot" id="cdot-${i}"
           style="width:8px;height:8px;border-radius:50%;flex-shrink:0;
                  background:${c.active ? 'var(--ok)' : 'var(--border-hi)'}"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(c.name)}
          ${c.active ? '<span style="font-size:9px;color:var(--ok);margin-left:6px;font-family:var(--mono)">● AKTIV</span>' : ''}
        </div>
        <div style="font-size:10px;color:var(--text-dim);font-family:var(--mono);margin-top:1px">${_connLabel(c)}</div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        ${!c.active ? `<button class="manage-btn" title="Aktivieren" onclick="_connActivate(${i})">▶</button>` : ''}
        <button class="manage-btn" title="Verbindung testen" onclick="_connTest(${i})">🔌</button>
        <button class="manage-btn manage-btn-danger" title="Löschen" onclick="_connDelete(${i})">🗑</button>
      </div>
    </div>`).join('');
}

function _connLabel(c) {
  if (c.type === 'demo')    return 'Demo-Modus · kein Backend';
  if (c.type === 'unix')    return `Unix: ${c.path || '–'}`;
  if (c.type === 'tcp')     return `TCP: ${c.host}:${c.port}`;
  if (c.type === 'checkmk') return `Checkmk: ${c.host}${c.site ? ' · ' + c.site : ''}`;
  if (c.type === 'nagios')  return `Nagios: ${c.host}:${c.port}`;
  return c.host || '–';
}

window._ncUpdateFields = function() {
  const type = document.getElementById('nc-type')?.value;
  const srv  = document.getElementById('nc-fields-server');
  const site = document.getElementById('nc-fields-site');
  const path = document.getElementById('nc-fields-path');
  if (!srv) return;
  srv.style.display  = ['checkmk','nagios','tcp'].includes(type) ? 'grid' : 'none';
  site.style.display = type === 'checkmk' ? 'block' : 'none';
  path.style.display = type === 'unix'    ? 'block' : 'none';
};

window._ncAdd = function() {
  const name = document.getElementById('nc-name')?.value.trim();
  const type = document.getElementById('nc-type')?.value;
  if (!name) { document.getElementById('nc-name')?.focus(); return; }
  const conn = { id: Date.now().toString(36), name, type, active: false };
  if (type !== 'demo' && type !== 'unix') {
    conn.host = document.getElementById('nc-host')?.value.trim() || '';
    conn.port = document.getElementById('nc-port')?.value || '6557';
  }
  if (type === 'checkmk') conn.site = document.getElementById('nc-site')?.value.trim() || '';
  if (type === 'unix')    conn.path = document.getElementById('nc-path')?.value.trim() || '';
  _connections.push(conn);
  _saveConnections();
  _renderConnectionList();
  ['nc-name','nc-host','nc-site','nc-path'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
};

window._connActivate = function(i) {
  _connections.forEach((c, j) => c.active = (j === i));
  _saveConnections();
  _renderConnectionList();
  const active = _connections[i];
  if (active.type === 'demo') {
    _demoMode = true;
    setSidebarLive(true, 'Demo-Modus · kein Backend');
    setStatusBar('Demo-Modus · statische Daten');
    setConnDot('connected');
  } else {
    _demoMode = false;
    setSidebarLive(false, `Verbinde ${active.name}…`);
    setConnDot('connecting');
    if (activeMapId) {
      if (wsClient) { wsClient._dead = true; wsClient.ws?.close(); }
      wsClient = makeWsClient(activeMapId);
      wsClient.connect();
    }
    pollHealth();
  }
};

window._connDelete = function(i) {
  if (_connections[i]?.active) {
    alert('Aktive Verbindung kann nicht gelöscht werden. Zuerst eine andere aktivieren.');
    return;
  }
  _connections.splice(i, 1);
  _saveConnections();
  _renderConnectionList();
};

window._connTest = async function(i) {
  const c   = _connections[i];
  const dot = document.getElementById(`cdot-${i}`);
  if (dot) dot.style.background = 'var(--warn)';
  if (c.type === 'demo') { if (dot) dot.style.background = 'var(--ok)'; return; }
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    if (dot) dot.style.background = r.ok ? 'var(--ok)' : 'var(--crit)';
  } catch { if (dot) dot.style.background = 'var(--crit)'; }
};

window._ncTest = async function() {
  const result = document.getElementById('nc-test-result');
  if (!result) return;
  result.style.display = 'block';
  result.textContent = '⏳ Teste Verbindung…';
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    result.style.color = r.ok ? 'var(--ok)' : 'var(--crit)';
    result.textContent = r.ok
      ? `✅ Verbunden · ${d.demo_mode ? 'Demo' : 'Livestatus'} · ${d.status}`
      : `❌ Fehler: ${d.detail ?? r.statusText}`;
  } catch (err) {
    result.style.color = 'var(--crit)';
    result.textContent = `❌ Nicht erreichbar: ${err.message}`;
  }
};

window.openConnectionsDlg   = openConnectionsDlg;
window.openCardMenu          = openCardMenu;
window.closeCardMenu         = closeCardMenu;
window.confirmDeleteMapById  = confirmDeleteMapById;


// ═══════════════════════════════════════════════════════════════════════
//  KIOSK-MODUS (F11 / manueller Toggle)
// ═══════════════════════════════════════════════════════════════════════

let _kioskActive = false, _kioskRefreshTimer = null;

function toggleKiosk() { _kioskActive ? exitKiosk() : enterKiosk(); }

function enterKiosk() {
  if (!activeMapId) return;
  _kioskActive = true;
  const settings = loadUserSettings();
  const overlay  = document.getElementById('kiosk-overlay');
  const wrap     = document.getElementById('kiosk-canvas-wrap');
  const canvas   = document.getElementById('nv2-canvas');
  const svg      = document.getElementById('nv2-lines-svg');
  const banner   = document.getElementById('nv2-edit-banner');
  const snapCont = document.getElementById('snapin-container');
  const snapTabs = document.getElementById('snap-tabs');
  wrap.appendChild(canvas);
  if (svg)      wrap.appendChild(svg);
  if (banner)   wrap.appendChild(banner);
  if (snapCont) wrap.appendChild(snapCont);
  if (snapTabs) wrap.appendChild(snapTabs);
  overlay.style.display = 'flex';
  if (settings.kioskHideSidebar) document.getElementById('sidebar').style.display = 'none';
  if (settings.kioskHideTopbar)  document.getElementById('topbar').style.display  = 'none';
  const lbl = document.getElementById('burger-kiosk-label');
  if (lbl) lbl.textContent = 'Kiosk beenden';
  document.getElementById('btn-kiosk')?.classList.add('on');
  _updateKioskStatus();
  if (settings.kioskAutoRefresh) {
    _kioskRefreshTimer = setInterval(() => { wsClient?.forceRefresh(); _updateKioskStatus(); }, settings.kioskInterval * 1000);
  }
  document.documentElement.requestFullscreen?.().catch(() => {});
  _setupKioskMouseHide();
}

function exitKiosk() {
  _kioskActive = false;
  clearInterval(_kioskRefreshTimer);
  _kioskRefreshTimer = null;
  const overlay  = document.getElementById('kiosk-overlay');
  const mapArea  = document.getElementById('map-area');
  const canvas   = document.getElementById('nv2-canvas');
  const svg      = document.getElementById('nv2-lines-svg');
  const banner   = document.getElementById('nv2-edit-banner');
  const snapCont = document.getElementById('snapin-container');
  const snapTabs = document.getElementById('snap-tabs');
  mapArea.appendChild(canvas);
  if (svg)      mapArea.appendChild(svg);
  if (banner)   mapArea.appendChild(banner);
  if (snapCont) mapArea.appendChild(snapCont);
  if (snapTabs) mapArea.appendChild(snapTabs);
  overlay.style.display = 'none';
  document.getElementById('sidebar').style.display = '';
  document.getElementById('topbar').style.display  = '';
  const lbl = document.getElementById('burger-kiosk-label');
  if (lbl) lbl.textContent = 'Kiosk-Modus';
  document.getElementById('btn-kiosk')?.classList.remove('on');
  if (document.fullscreenElement) document.exitFullscreen?.();
}

function _updateKioskStatus() {
  const bar = document.getElementById('kiosk-status-bar');
  if (!bar) return;
  const now = new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  bar.textContent = `${activeMapCfg?.title ?? ''} · ${now}`;
}

let _kioskMouseTimer = null;
function _setupKioskMouseHide() {
  const overlay = document.getElementById('kiosk-overlay');
  const exitBtn = document.getElementById('kiosk-exit-btn');
  const showUI  = () => {
    exitBtn.classList.add('visible');
    clearTimeout(_kioskMouseTimer);
    _kioskMouseTimer = setTimeout(() => exitBtn.classList.remove('visible'), 2500);
  };
  overlay.addEventListener('mousemove', showUI);
  overlay.addEventListener('touchstart', showUI);
}

window.toggleKiosk = toggleKiosk;
window.exitKiosk   = exitKiosk;


// ═══════════════════════════════════════════════════════════════════════
//  BENUTZEREINSTELLUNGEN
// ═══════════════════════════════════════════════════════════════════════

const USER_SETTINGS_KEY = 'nv2-user-settings';

function defaultUserSettings() {
  return { theme:'dark', sidebarDefault:'expanded', kioskHideSidebar:false, kioskHideTopbar:false, kioskAutoRefresh:true, kioskInterval:60 };
}

function loadUserSettings() {
  try { return { ...defaultUserSettings(), ...JSON.parse(localStorage.getItem(USER_SETTINGS_KEY) ?? '{}') }; }
  catch { return defaultUserSettings(); }
}

function saveUserSettings() {
  const s = {
    theme:            currentTheme,
    sidebarDefault:   document.getElementById('us-sidebar-default')?.value    ?? 'expanded',
    kioskHideSidebar: document.getElementById('us-kiosk-hide-sidebar')?.checked ?? false,
    kioskHideTopbar:  document.getElementById('us-kiosk-hide-topbar')?.checked  ?? false,
    kioskAutoRefresh: document.getElementById('us-kiosk-auto-refresh')?.checked ?? true,
    kioskInterval:    parseInt(document.getElementById('us-kiosk-interval')?.value ?? '60'),
  };
  localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(s));
  closeDlg('dlg-user-settings');
}

function openUserSettingsDlg() {
  const s = loadUserSettings();
  updateThemeChips();
  const sd  = document.getElementById('us-sidebar-default');    if (sd)  sd.value    = s.sidebarDefault;
  const khs = document.getElementById('us-kiosk-hide-sidebar'); if (khs) khs.checked = s.kioskHideSidebar;
  const kht = document.getElementById('us-kiosk-hide-topbar');  if (kht) kht.checked = s.kioskHideTopbar;
  const kar = document.getElementById('us-kiosk-auto-refresh'); if (kar) kar.checked = s.kioskAutoRefresh;
  const ki  = document.getElementById('us-kiosk-interval');     if (ki)  ki.value    = String(s.kioskInterval);
  openDlg('dlg-user-settings');
}

function updateThemeChips() {
  document.getElementById('theme-chip-dark') ?.classList.toggle('active', currentTheme === 'dark');
  document.getElementById('theme-chip-light')?.classList.toggle('active', currentTheme === 'light');
}

window.openUserSettingsDlg = openUserSettingsDlg;
window.saveUserSettings    = saveUserSettings;
window.updateThemeChips    = updateThemeChips;


// ═══════════════════════════════════════════════════════════════════════
//  NAGVIS-1 MIGRATION
// ═══════════════════════════════════════════════════════════════════════

let _migFile = null;

function dlgMigrate() {
  _migFile = null;
  document.getElementById('cfg-drop-label').textContent = '📄 Datei wählen oder hier ablegen';
  document.getElementById('mig-btn-ok').disabled = true;
  document.getElementById('mig-result').style.display = 'none';
  document.getElementById('mig-result').textContent = '';
  document.getElementById('mig-dryrun').checked = false;
  openDlg('dlg-migrate');
  const inp = document.getElementById('cfg-file-input');
  inp.value = '';
  inp.onchange = e => _migHandleFile(e.target.files[0]);
  const zone = document.getElementById('cfg-drop-zone');
  zone.ondragover  = e => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = e => { e.preventDefault(); zone.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) _migHandleFile(f); };
}

function _migHandleFile(file) {
  if (!file || !file.name.endsWith('.cfg')) {
    document.getElementById('cfg-drop-label').textContent = '⚠ Nur .cfg-Dateien erlaubt'; return;
  }
  _migFile = file;
  document.getElementById('cfg-drop-label').textContent = `✓ ${file.name}`;
  document.getElementById('mig-btn-ok').disabled = false;
  const idField = document.getElementById('mig-id');
  if (!idField.value) idField.value = file.name.replace(/\.cfg$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

async function confirmMigrate() {
  if (!_migFile) return;
  const mapId   = document.getElementById('mig-id').value.trim();
  const canvasW = document.getElementById('mig-w').value || 1200;
  const canvasH = document.getElementById('mig-h').value || 800;
  const dryRun  = document.getElementById('mig-dryrun').checked;
  const resultBox = document.getElementById('mig-result');
  resultBox.style.display = 'block';
  resultBox.textContent   = '⏳ Migriere…';
  const form   = new FormData();
  form.append('file', _migFile);
  const params = new URLSearchParams({ map_id: mapId, canvas_w: canvasW, canvas_h: canvasH, dry_run: dryRun });
  try {
    const res  = await fetch(`/api/migrate?${params}`, { method:'POST', body:form });
    const data = await res.json();
    if (!res.ok) { resultBox.textContent = `❌ ${data.detail || 'Fehler beim Import'}`; return; }
    const lines = [
      dryRun ? '📋 VORSCHAU (nicht gespeichert)' : '✅ Import erfolgreich',
      `Map-ID: ${data.map_id}`, `Titel:  ${data.title}`, `Objekte: ${data.object_count}`,
      data.skipped ? `⚠ Übersprungen: ${data.skipped}` : null,
      ...(data.warnings ?? []).map(w => `⚠ ${w.type}.${w.field}: ${w.message}`),
      data.note ? `ℹ ${data.note}` : null,
    ].filter(Boolean);
    resultBox.textContent = lines.join('\n');
    if (!dryRun) setTimeout(() => { closeDlg('dlg-migrate'); showOverview(); }, 1800);
  } catch (err) {
    resultBox.textContent = `❌ Netzwerkfehler: ${err.message}`;
  }
}

function fillHostDatalist(hosts) {
  const opts = hosts.map(h => `<option value="${esc(h.name)}">`).join('');
  document.getElementById('known-hosts')    .innerHTML = opts;
  document.getElementById('known-hosts-svc').innerHTML = opts;
}

window.confirmAddObject = confirmAddObject;
window.selectObjType    = selectObjType;
window.confirmNewMap    = confirmNewMap;
window.exportActiveMap  = exportActiveMap;
window.exportMapById    = exportMapById;
window.dlgImportZip     = dlgImportZip;
window.confirmImportZip = confirmImportZip;
window.dlgNewMap        = dlgNewMap;
window.dlgMigrate       = dlgMigrate;
window.confirmMigrate   = confirmMigrate;
window.openDlg  = id => document.getElementById(id)?.classList.add('show');
window.closeDlg = id => {
  document.getElementById(id)?.classList.remove('show');
  document.querySelectorAll(`#${id} input[type=text], #${id} textarea`).forEach(i => i.value = '');
};


// ═══════════════════════════════════════════════════════════════════════
//  MAP EXPORT / ZIP IMPORT
// ═══════════════════════════════════════════════════════════════════════

let _zipFile = null;

async function exportActiveMap() {
  if (!activeMapId) return;
  try {
    const res = await fetch(`/api/maps/${activeMapId}/export`);
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(`Export fehlgeschlagen: ${err.detail || res.statusText}`); return; }
    const cd       = res.headers.get('Content-Disposition') ?? '';
    const match    = cd.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `nagvis2-${activeMapId}.zip`;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch (err) { alert(`Export fehlgeschlagen: ${err.message}`); }
}

async function exportMapById(mapId) {
  if (!mapId) return;
  try {
    const res = await fetch(`/api/maps/${mapId}/export`);
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(`Export fehlgeschlagen: ${err.detail || res.statusText}`); return; }
    const cd       = res.headers.get('Content-Disposition') ?? '';
    const match    = cd.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `nagvis2-${mapId}.zip`;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch (err) { alert(`Export fehlgeschlagen: ${err.message}`); }
}

function dlgImportZip() {
  _zipFile = null;
  document.getElementById('zip-drop-label').textContent = '📦 .zip-Datei wählen oder hier ablegen';
  document.getElementById('zip-drop-label').style.color = '';
  document.getElementById('zip-btn-ok').disabled = true;
  document.getElementById('zip-result').style.display = 'none';
  document.getElementById('zip-result').textContent = '';
  document.getElementById('zip-map-id').value = '';
  document.getElementById('zip-dryrun').checked = false;
  openDlg('dlg-zip-import');
  const inp = document.getElementById('zip-file-input');
  inp.value = '';
  inp.onchange = e => _zipHandleFile(e.target.files[0]);
  const zone = document.getElementById('zip-drop-zone');
  zone.ondragover  = e => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = e => { e.preventDefault(); zone.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) _zipHandleFile(f); };
}

function _zipHandleFile(file) {
  const lbl = document.getElementById('zip-drop-label');
  if (!file || !file.name.toLowerCase().endsWith('.zip')) {
    lbl.textContent = '⚠ Nur .zip-Dateien erlaubt'; lbl.style.color = 'var(--crit)';
    _zipFile = null; document.getElementById('zip-btn-ok').disabled = true; return;
  }
  _zipFile = file;
  lbl.textContent = `✓ ${file.name}  (${(file.size / 1024).toFixed(0)} KB)`;
  lbl.style.color = 'var(--ok)';
  document.getElementById('zip-btn-ok').disabled = false;
  const idField = document.getElementById('zip-map-id');
  if (!idField.value) {
    idField.value = file.name.replace(/\.zip$/i, '').replace(/^nagvis2-/i, '').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  }
}

async function confirmImportZip() {
  if (!_zipFile) return;
  const mapId     = document.getElementById('zip-map-id').value.trim() || undefined;
  const dryRun    = document.getElementById('zip-dryrun').checked;
  const resultBox = document.getElementById('zip-result');
  resultBox.style.display = 'block'; resultBox.style.color = ''; resultBox.textContent = '⏳ Importiere…';
  document.getElementById('zip-btn-ok').disabled = true;
  try {
    const form   = new FormData();
    form.append('file', _zipFile);
    const params = new URLSearchParams({ dry_run: dryRun });
    if (mapId) params.set('map_id', mapId);
    const res  = await fetch(`/api/maps/import?${params}`, { method:'POST', body:form });
    const data = await res.json();
    if (!res.ok) {
      const errs = data.detail?.errors ?? [data.detail ?? 'Unbekannter Fehler'];
      resultBox.style.color = 'var(--crit)'; resultBox.textContent = '❌ ' + errs.join('\n❌ ');
      document.getElementById('zip-btn-ok').disabled = false; return;
    }
    const lines = [
      dryRun ? '📋 VORSCHAU (nicht gespeichert)' : '✅ Import erfolgreich',
      `Map-ID: ${data.map_id}`, `Titel:  ${data.title}`,
      data.bg_saved ? '🖼 Hintergrundbild gespeichert' : '',
      ...(data.warnings ?? []).map(w => `⚠ ${w}`),
    ].filter(Boolean);
    resultBox.style.color = dryRun ? '' : 'var(--ok)'; resultBox.textContent = lines.join('\n');
    if (!dryRun) {
      await loadMaps();
      setTimeout(() => { closeDlg('dlg-zip-import'); openMap(data.map_id); }, 1500);
    } else { document.getElementById('zip-btn-ok').disabled = false; }
  } catch (err) {
    resultBox.style.color = 'var(--crit)'; resultBox.textContent = `❌ Netzwerkfehler: ${err.message}`;
    document.getElementById('zip-btn-ok').disabled = false;
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  HINTERGRUNDBILD
// ═══════════════════════════════════════════════════════════════════════

function applyCanvasMode(canvas, cfg) {
  const mode = cfg?.mode ?? 'free';
  canvas.style.width       = '';
  canvas.style.height      = '';
  canvas.style.maxWidth    = '';
  canvas.style.maxHeight   = '';
  canvas.style.aspectRatio = '';
  canvas.style.margin      = '';
  canvas.style.position    = 'absolute';
  canvas.style.inset       = '0';
  const area = document.getElementById('map-area');
  area.style.alignItems      = '';
  area.style.justifyContent  = '';

  if (mode === 'ratio') {
    const [rw, rh] = (cfg.ratio ?? '16:9').split(':').map(Number);
    canvas.style.position    = 'relative';
    canvas.style.inset       = 'auto';
    canvas.style.width       = '100%';
    canvas.style.aspectRatio = `${rw} / ${rh}`;
    canvas.style.maxHeight   = '100%';
    canvas.style.maxWidth    = `calc(100vh * ${rw} / ${rh})`;
    area.style.display         = 'flex';
    area.style.alignItems      = 'center';
    area.style.justifyContent  = 'center';
    area.style.overflow        = 'hidden';
  } else if (mode === 'fixed') {
    const w = cfg.w ?? 1920;
    const h = cfg.h ?? 1080;
    canvas.style.position = 'relative';
    canvas.style.inset    = 'auto';
    canvas.style.width    = `${w}px`;
    canvas.style.height   = `${h}px`;
    area.style.display         = 'flex';
    area.style.alignItems      = 'center';
    area.style.justifyContent  = 'center';
    area.style.overflow        = 'hidden';
    const scaleX = area.clientWidth  / w;
    const scaleY = area.clientHeight / h;
    const scale  = Math.min(scaleX, scaleY, 1) * 0.95;
    if (window.NV2_ZOOM) {
      const panX = (area.clientWidth  - w * scale) / 2;
      const panY = (area.clientHeight - h * scale) / 2;
      NV2_ZOOM.setState(scale, panX, panY);
    }
  } else if (mode === 'background') {
    canvas.style.backgroundSize = '100% 100%';
  } else {
    canvas.style.backgroundSize = 'contain';
  }
}

async function uploadBg(file) {
  const form = new FormData();
  form.append('file', file);
  try {
    const res  = await fetch(`/api/maps/${activeMapId}/background`, { method:'POST', body:form });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setBg(data.url);
  } catch (err) { alert(`Upload fehlgeschlagen: ${err.message}`); }
}

function setBg(url) {
  const canvas = document.getElementById('nv2-canvas');
  canvas.style.backgroundImage = `url('${url}?t=${Date.now()}')`;
  const mode = activeMapCfg?.canvas?.mode ?? 'free';
  if (mode === 'background') {
    const img = new Image();
    img.onload = () => {
      const area = document.getElementById('map-area');
      const scaleX = area.clientWidth  / img.naturalWidth;
      const scaleY = area.clientHeight / img.naturalHeight;
      const scale  = Math.min(scaleX, scaleY) * 0.98;
      canvas.style.position        = 'relative';
      canvas.style.inset           = 'auto';
      canvas.style.width           = `${img.naturalWidth}px`;
      canvas.style.height          = `${img.naturalHeight}px`;
      canvas.style.backgroundSize  = '100% 100%';
      canvas.style.backgroundRepeat   = 'no-repeat';
      canvas.style.backgroundPosition = '0 0';
      area.style.display         = 'flex';
      area.style.alignItems      = 'center';
      area.style.justifyContent  = 'center';
      if (window.NV2_ZOOM) {
        const panX = (area.clientWidth  - img.naturalWidth  * scale) / 2;
        const panY = (area.clientHeight - img.naturalHeight * scale) / 2;
        NV2_ZOOM.setState(scale, panX, panY);
      }
    };
    img.src = url;
  } else {
    canvas.style.backgroundSize     = mode === 'fixed' ? '100% 100%' : 'contain';
    canvas.style.backgroundRepeat   = 'no-repeat';
    canvas.style.backgroundPosition = 'center';
  }
}

function setupDragDrop() {
  const area = document.getElementById('map-area');
  area.addEventListener('dragenter', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragover',  e => { e.preventDefault(); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault(); area.classList.remove('drag-over');
    if (e.dataTransfer.files[0] && activeMapId) uploadBg(e.dataTransfer.files[0]);
  });
}


// ═══════════════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════

async function pollHealth() {
  const h = await api('/api/health');
  if (!h) return;
  const ok   = h.status === 'ok';
  const chip = document.getElementById('health-chip');
  if (chip) { chip.textContent = ok ? 'OK' : '!'; chip.className = 'nav-chip ' + (ok ? 'ok' : 'crit'); }
  setSidebarLive(ok, `${h.demo_mode ? 'Demo' : 'Livestatus'} · ${h.status}`);
}


// ═══════════════════════════════════════════════════════════════════════
//  UI-HELFER
// ═══════════════════════════════════════════════════════════════════════

function setStatusBar(msg) { document.getElementById('nv2-status-bar').textContent = msg; }
function setConnDot(state) { document.getElementById('nv2-conn-dot').className = `conn-dot ${state}`; }

function setSidebarLive(ok, txt) {
  const dot    = document.getElementById('foot-dot');
  const status = document.getElementById('sidebar-status');
  const label  = txt ?? (ok ? 'verbunden' : 'getrennt');
  if (dot)    { dot.className = `foot-dot${ok ? '' : ' off'}`; dot.title = label; }
  if (status) status.textContent = label;
}

let _dtBannerTimer = null;
function showDowntimeBanner(hostNames, started) {
  let banner = document.getElementById('nv2-dt-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'nv2-dt-banner'; banner.className = 'nv2-dt-banner';
    document.getElementById('nv2-canvas')?.appendChild(banner);
  }
  const verb  = started ? 'Downtime gestartet' : 'Downtime beendet';
  const names = hostNames.slice(0, 3).map(esc).join(', ') + (hostNames.length > 3 ? ` +${hostNames.length - 3}` : '');
  banner.textContent = `🔧 ${verb}: ${names}`;
  banner.classList.add('show');
  clearTimeout(_dtBannerTimer);
  _dtBannerTimer = setTimeout(() => banner.classList.remove('show'), 4000);
}

function fmt(ts) { return ts ? new Date(ts * 1000).toLocaleTimeString('de-DE') : ''; }

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getNodeContainer() {
  return document.getElementById('map-canvas-wrapper') ?? document.getElementById('nv2-canvas');
}


// ═══════════════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════════════

function onKeyDown(e) {
  const inInput = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
  if (e.key === 'b' && !inInput && !e.ctrlKey && !e.metaKey) toggleSidebar();
  if (e.key === 'Escape') {
    if (_kioskActive) { exitKiosk(); return; }
    closeBurgerMenu();
    window.closeDlg('dlg-add-object'); window.closeDlg('dlg-new-map'); window.closeDlg('dlg-user-settings');
    closeResizeDialog(); closeContextMenu();
    if (editActive) toggleEdit();
    closeSnapin(activeSnapin);
  }
  if (e.key === 'F11' && activeMapId) { e.preventDefault(); toggleKiosk(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'e' && activeMapId) { e.preventDefault(); toggleEdit(); }
  if (e.key === 'r' && activeMapId && !e.ctrlKey && !e.metaKey && !inInput) wsClient?.forceRefresh();
}


// ═══════════════════════════════════════════════════════════════════════
//  DEMO MODE
// ═══════════════════════════════════════════════════════════════════════

const DEMO_MAP = {
  id: "demo-features", title: "NagVis 2 – Feature Demo", background: null, canvas: { mode: "ratio", ratio: "16:9" },
  objects: [
    { object_id:"host::srv-web-01::abc123",  type:"host",     name:"srv-web-01",  x:15, y:20, iconset:"server",   label:"Webserver 01 (OK)" },
    { object_id:"host::srv-db-01::def456",   type:"host",     name:"srv-db-01",   x:35, y:20, iconset:"database", label:"Datenbank (ACK + DT)" },
    { object_id:"service::srv-web-01::HTTP", type:"service",  name:"HTTP Response Time", host_name:"srv-web-01", x:15, y:35, iconset:"default", label:"HTTP (CRITICAL)" },
    { object_id:"hostgroup::webservers",     type:"hostgroup",name:"webservers",   x:55, y:20, iconset:"default", label:"Alle Webserver" },
    { object_id:"textbox::zone-a",           type:"textbox",  text:"Zone A – Produktion", x:8, y:8, w:18, h:5, font_size:16, bold:true, color:"#0ea5e9", bg_color:"rgba(14,165,233,0.08)" },
    { object_id:"line::connection-1",        type:"line",     x:30, y:30, x2:70, y2:70, line_style:"dashed", line_width:2, color:"#475569" },
    { object_id:"line::wm-srv-db",           type:"line",     x:15, y:20, x2:35, y2:20,
      line_type:"weathermap", host_from:"srv-web-01", host_to:"srv-db-01",
      label_from:"42 Mbps", label_to:"18 Mbps", line_width:5, line_style:"solid", line_split:true, show_arrow:true },
    { object_id:"map::datacenter-b",         type:"map",      name:"datacenter-b", x:75, y:35, iconset:"map", label:"Datacenter B (nested)" },
    { object_id:"gadget::cpu-01",     type:"gadget", x:25, y:55,
      gadget_config:{ type:"radial",    metric:"CPU Load",   value:42, unit:"%",    min:0, max:100, warning:70, critical:90 }, label:"CPU Load" },
    { object_id:"gadget::memory-01",  type:"gadget", x:45, y:55,
      gadget_config:{ type:"linear",    metric:"RAM",        value:78, unit:"%",    min:0, max:100, warning:75, critical:90 }, label:"RAM" },
    { object_id:"gadget::traffic-01", type:"gadget", x:25, y:72,
      gadget_config:{ type:"sparkline", metric:"Traffic Out",value:68,
        history:[45,52,61,58,72,68,80,75,62,68,55,70,65,78,82,60,68,74,71,69] }, label:"Traffic Out" },
    { object_id:"gadget::flow-01",    type:"gadget", x:50, y:72,
      gadget_config:{ type:"weather",   metric:"Backbone",   value:620, unit:"Mbps", max:1000 }, label:"Backbone 1G" },
    { object_id:"gadget::raw-01",     type:"gadget", x:70, y:55,
      gadget_config:{ type:"rawnumber", metric:"Disk I/O",   value:3752690, unit:"B/s",
        display_unit:"MB/s", divide:1048576, min:0, max:200, warning:150, critical:190 }, label:"Disk I/O" },
    { object_id:"gadget::thermo-01",  type:"gadget", x:85, y:55,
      gadget_config:{ type:"thermometer", metric:"CPU Temp", value:62, unit:"°C",
        min:0, max:100, warning:70, critical:85 }, label:"CPU Temp" },
  ]
};

const DEMO_STATUS = [
  { name:"srv-web-01",  state:0, state_label:"UP",   acknowledged:false, in_downtime:false, output:"PING OK - 1.4ms", services_ok:8, services_warn:0, services_crit:1, services_unkn:0 },
  { name:"srv-db-01",   state:0, state_label:"UP",   acknowledged:true,  in_downtime:true,  output:"PING OK - 0.8ms", services_ok:5, services_warn:1, services_crit:0, services_unkn:0 },
  { name:"srv-backup",  state:1, state_label:"DOWN", acknowledged:false, in_downtime:false, output:"Connection refused", services_ok:0, services_warn:0, services_crit:3, services_unkn:0 },
  { name:"srv-monitor", state:0, state_label:"UP",   acknowledged:false, in_downtime:false, output:"PING OK - 2.1ms", services_ok:12, services_warn:2, services_crit:0, services_unkn:0 },
];

let _demoMode = false;
let _demoMaps = [
  { id:"demo-features", title:"NagVis 2 – Feature Demo", background:null, canvas: { mode:"ratio", ratio:"16:9" }, object_count:DEMO_MAP.objects.length }
];

let _connections = JSON.parse(localStorage.getItem('nv2-connections') || '[]');
if (!_connections.length) {
  _connections = [{ id:'local', name:'Lokal (Demo)', type:'demo', host:'', port:'', site:'', active:true }];
}
function _saveConnections() {
  localStorage.setItem('nv2-connections', JSON.stringify(_connections));
}

async function detectDemoMode() {
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(1500) });
    if (r.ok) { _demoMode = false; return; }
  } catch { }
  _demoMode = true;
  console.info('[NV2] Kein Backend gefunden – Demo-Modus aktiv');
  setSidebarLive(true, 'Demo-Modus · kein Backend');
  setStatusBar('Demo-Modus · statische Daten');
  document.getElementById('nv2-conn-dot').className = 'conn-dot connected';
}

function makeDemoWsClient(mapId) {
  let _interval = null;
  return {
    mapId, ws: null, _dead: false,
    connect() {
      if (this._dead) return;
      setTimeout(() => {
        if (this._dead) return;
        onWsMsg({ event:'snapshot', ts:Date.now()/1000, hosts:DEMO_STATUS, services:[] });
        onWsOpen();
      }, 200);
      _interval = setInterval(() => {
        if (this._dead) { clearInterval(_interval); return; }
        const changed  = DEMO_STATUS[Math.floor(Math.random() * DEMO_STATUS.length)];
        const states   = ['UP','UP','UP','DOWN','WARNING'];
        const newState = states[Math.floor(Math.random() * states.length)];
        const fake = { ...changed, state_label:newState, output:newState==='UP'?'PING OK':'Check failed', change_type:'state_change' };
        onWsMsg({ event:'status_update', ts:Date.now()/1000, elapsed:Math.floor(Math.random()*30)+5, hosts:[fake], services:[] });
      }, 8000);
    },
    forceRefresh() { onWsMsg({ event:'snapshot', ts:Date.now()/1000, hosts:DEMO_STATUS, services:[] }); },
    disconnect() { this._dead = true; clearInterval(_interval); },
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  API WRAPPER
// ═══════════════════════════════════════════════════════════════════════

async function api(path, method = 'GET', body = null) {
  if (_demoMode) {
    // ── Kiosk-User Demo-Mode-Handlers ──────────────────────────────────
    if (path === '/api/kiosk-users' && method === 'GET') {
      return JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
    }
    if (path === '/api/kiosk-users' && method === 'POST') {
      const users = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
      const u = { ...body,
        id:    body.id    || Math.random().toString(36).slice(2),
        token: body.token || Math.random().toString(36).slice(2, 26),
      };
      users.push(u);
      localStorage.setItem('nv2-kiosk-users', JSON.stringify(users));
      return u;
    }
    const _kioskPut = path.match(/^\/api\/kiosk-users\/([\w-]+)$/);
    if (_kioskPut && method === 'PUT') {
      const users = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
      const idx = users.findIndex(u => u.id === _kioskPut[1]);
      if (idx >= 0) { Object.assign(users[idx], body); localStorage.setItem('nv2-kiosk-users', JSON.stringify(users)); return users[idx]; }
      return null;
    }
    const _kioskDel = path.match(/^\/api\/kiosk-users\/([\w-]+)$/);
    if (_kioskDel && method === 'DELETE') {
      const users = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]').filter(u => u.id !== _kioskDel[1]);
      localStorage.setItem('nv2-kiosk-users', JSON.stringify(users));
      return true;
    }
    if (path.startsWith('/api/kiosk-users/resolve')) {
      const t = new URL(location.href).searchParams.get('token') || path.split('token=')[1];
      const users = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
      const found = users.find(u => u.token === t);
      return found ? { ...found } : null;
    }

    // ── Standard Demo-Mode Handlers ────────────────────────────────────
    if (path === '/api/maps' && method === 'GET') return [..._demoMaps];

    if (path === '/api/maps' && method === 'POST') {
      const id  = body.map_id || body.title.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
      const map = { id, title:body.title, background:null, canvas: body.canvas ?? { mode:'free' }, objects:[] };
      _demoMaps.push({ ...map, object_count:0 });
      return { ...map };
    }

    const mGet = path.match(/^\/api\/maps\/([\w-]+)$/);
    if (mGet && method === 'GET') {
      if (mGet[1] === 'demo-features') return JSON.parse(JSON.stringify(DEMO_MAP));
      const found = _demoMaps.find(m => m.id === mGet[1]);
      if (found) return JSON.parse(JSON.stringify({ ...found, objects: found.objects ?? [], canvas: found.canvas ?? { mode: 'free' } }));
      return null;
    }

    const mDel = path.match(/^\/api\/maps\/([\w-]+)$/);
    if (mDel && method === 'DELETE') { _demoMaps = _demoMaps.filter(m => m.id !== mDel[1]); return true; }

    const mObj = path.match(/^\/api\/maps\/([\w-]+)\/objects$/);
    if (mObj && method === 'POST') {
      const obj = { ...body, object_id:`${body.type}::${body.name||''}::${Math.random().toString(36).slice(2,8)}` };
      const map = _demoMaps.find(m => m.id === mObj[1]);
      if (map) map.object_count = (map.object_count || 0) + 1;
      return obj;
    }
    if (method === 'PATCH' || (method === 'DELETE' && path.includes('/objects/'))) return method === 'DELETE' ? true : body;

    const mCanvas = path.match(/^\/api\/maps\/([\w-]+)\/canvas$/);
    if (mCanvas && method === 'PUT') {
      const m = _demoMaps.find(m => m.id === mCanvas[1]);
      if (m) m.canvas = body;
      return body;
    }
    if (path === '/api/health') return { status:'ok', demo_mode:true };
    console.warn('[NV2] Demo: unhandled API call', method, path);
    return null;
  }

  try {
    const opts = { method, headers:{} };
    if (body) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    const r = await fetch(path, opts);
    if (!r.ok) { console.warn(`[NV2] API ${method} ${path} → ${r.status}`); return null; }
    if (method === 'DELETE') return true;
    return r.json();
  } catch (err) {
    console.error('[NV2] api() error:', err);
    return null;
  }
}