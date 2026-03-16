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
let pendingPos   = null;
let hostCache    = {};
let eventLog     = [];
let activeSnapin = null;
let currentTheme = 'dark';


// ═══════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {

  const savedTheme = localStorage.getItem('nv2-theme') ?? 'dark';
  setTheme(savedTheme, false);

  restoreSidebar();

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

  // ── FIX: Zoom-Buttons korrekt verdrahten (btn-zoom-*, nicht nv2-zoom-*) ──
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
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
  localStorage.setItem('nv2-sidebar', sidebarCollapsed ? '1' : '0');
}

function restoreSidebar() {
  if (localStorage.getItem('nv2-sidebar') === '1') {
    sidebarCollapsed = true;
    document.getElementById('sidebar').classList.add('collapsed');
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

window.toggleBurgerMenu = toggleBurgerMenu;
window.closeBurgerMenu  = closeBurgerMenu;

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
    return;
  }
  el.innerHTML = maps.map(m => `
    <div class="map-entry" id="smap-${esc(m.id)}" data-map-id="${esc(m.id)}">
      <div class="map-pip unkn" id="mpip-${esc(m.id)}"></div>
      ${esc(m.title)}
    </div>`).join('');

  el.querySelectorAll('.map-entry').forEach(entry => {
    entry.addEventListener('click', () => openMap(entry.dataset.mapId));
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


// ═══════════════════════════════════════════════════════════════════════
//  MAP ÖFFNEN / SCHLIESSEN
// ═══════════════════════════════════════════════════════════════════════

async function openMap(mapId) {
  activeMapId  = mapId;
  activeMapCfg = await api(`/api/maps/${mapId}`);
  if (!activeMapCfg) { alert('Map nicht gefunden'); return; }

  // Layout-Switch
  document.getElementById('overview')         .style.display = 'none';
  document.getElementById('map-area')         .style.display = 'block';
  document.getElementById('map-toolbar')      .style.display = 'flex';
  document.getElementById('tb-pills')         .style.display = 'flex';
  document.getElementById('snap-tabs')        .style.display = 'flex';
  document.getElementById('snapin-container') .style.display = 'block';
  const bms = document.getElementById('burger-map-section');
  if (bms) bms.style.display = 'block';

  // Topbar
  document.getElementById('tb-title').textContent = activeMapCfg.title;
  document.getElementById('tb-sub')  .textContent =
    `${activeMapCfg.objects?.length ?? 0} Objekte · ${mapId}`;

  // Sidebar-Highlights
  document.querySelectorAll('.map-entry').forEach(e => e.classList.remove('active'));
  document.getElementById('nav-btn-overview')?.classList.remove('active');
  document.getElementById(`smap-${mapId}`)?.classList.add('active');

  // Canvas leeren + Hintergrundbild
  const canvas = document.getElementById('nv2-canvas');
  canvas.innerHTML = '';
  canvas.dataset.mapId = mapId;

  // ── FIX: map-canvas-wrapper nach canvas-clear neu anlegen ──
  const wrapper = document.createElement('div');
  wrapper.id = 'map-canvas-wrapper';
  canvas.appendChild(wrapper);

  if (activeMapCfg.background) {
    setBg(`/${activeMapCfg.background}`);
  } else {
    canvas.style.backgroundImage = '';
  }

  // Nodes platzieren
  for (const obj of activeMapCfg.objects ?? []) {
    const el = createNode(obj);
    if (el && obj.layer != null) el.dataset.layer = obj.layer;
  }
  initLayers(activeMapCfg.objects ?? []);

  // WebSocket
  if (wsClient) {
    wsClient._dead = true;
    wsClient.ws?.close();
  }
  wsClient = _demoMode ? makeDemoWsClient(mapId) : makeWsClient(mapId);
  wsClient.connect();

  // ── FIX: Zoom-Controls einblenden + NV2_ZOOM initialisieren ──
  const zoomControls = document.getElementById('nv2-zoom-controls');
  if (zoomControls) zoomControls.style.display = 'flex';
  if (window.NV2_ZOOM) {
    NV2_ZOOM.reset();
    NV2_ZOOM.init(canvas, wrapper);
  }
}

function showOverview() {
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

  // ── FIX: Zoom-Controls ausblenden + NV2_ZOOM aufräumen ──
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
    case 'gadget':    return createGadget?.(obj) ?? null;
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
  });

  document.getElementById('nv2-canvas').appendChild(el);

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
  el.addEventListener('contextmenu', e => { e.preventDefault(); if (editActive) showNodeContextMenu(e, el, obj); });
  document.getElementById('nv2-canvas').appendChild(el);
  return el;
}

function _renderLine(obj) {
  let svg = document.getElementById('nv2-lines-svg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'nv2-lines-svg';
    svg.classList.add('nv2-line-svg');
    document.getElementById('nv2-canvas').appendChild(svg);
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

  // Hit-Target
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

function _createLineHandles(lineVis, hitLine, obj, svg) {
  const makeHandle = (cx, cy, isStart) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.classList.add('line-handle');
    c.setAttribute('cx', cx);
    c.setAttribute('cy', cy);
    c.setAttribute('r', '5');
    c.style.fill        = 'var(--acc, #29b6d4)';
    c.style.stroke      = 'var(--bg-panel, #2b2b2b)';
    c.style.strokeWidth = '2';
    c.style.cursor      = 'crosshair';
    c.style.opacity     = '0';
    c.addEventListener('mousedown', e => {
      if (!editActive || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      _dragHandle(e, lineVis, hitLine, c, isStart, obj, svg);
    });
    svg.appendChild(c);
    return c;
  };
  const h1 = makeHandle(`${obj.x}%`,              `${obj.y}%`,            true);
  const h2 = makeHandle(`${obj.x2 ?? obj.x+20}%`, `${obj.y2 ?? obj.y}%`, false);
  return [h1, h2];
}

function _dragHandle(e, lineVis, hitLine, handle, isStart, obj, svg) {
  const canvas = document.getElementById('nv2-canvas');
  const rect   = canvas.getBoundingClientRect();
  lineVis.style.opacity = '0.6';

  const onMove = ev => {
    const nx = ((ev.clientX - rect.left) / rect.width  * 100).toFixed(2);
    const ny = ((ev.clientY - rect.top)  / rect.height * 100).toFixed(2);
    const attr = isStart ? ['x1','y1'] : ['x2','y2'];
    lineVis.setAttribute(attr[0], `${nx}%`);
    lineVis.setAttribute(attr[1], `${ny}%`);
    hitLine.setAttribute(attr[0], `${nx}%`);
    hitLine.setAttribute(attr[1], `${ny}%`);
    handle.setAttribute('cx', `${nx}%`);
    handle.setAttribute('cy', `${ny}%`);
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
  el.value = deg;
  lbl.textContent = deg + '°';
}

function showLineContextMenu(e, lineVis, obj) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.id = 'nv2-ctx-menu';
  menu.className = 'ctx-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top  = `${e.clientY}px`;
  const items = [
    { label: '↔ Linienstil',    action: () => openLineStyleDialog(lineVis, obj) },
    { label: '◫ Layer zuweisen', action: () => openLayerDialog(lineVis, obj) },
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
  const x1 = parseFloat(lineVis.getAttribute('x1'));
  const y1 = parseFloat(lineVis.getAttribute('y1'));
  const x2 = parseFloat(lineVis.getAttribute('x2'));
  const y2 = parseFloat(lineVis.getAttribute('y2'));
  const mx = (e.clientX - rect.left) / rect.width  * 100;
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
  panel.id = 'nv2-resize-panel';
  panel.className = 'resize-panel';
  const cvRect = document.getElementById('nv2-canvas').getBoundingClientRect();
  panel.style.left = `${cvRect.width / 2 - 120}px`;
  panel.style.top  = '60px';

  panel.innerHTML = `
    <div class="rp-head"><span>Linienstil</span><button class="rp-close" id="rp-close-btn">✕</button></div>
    <div class="rp-body" style="display:flex;flex-direction:column;gap:8px;padding:8px">
      <label style="font-size:11px">Farbe
        <input type="color" id="ln-color" value="${obj.color || '#475569'}" style="margin-left:6px">
      </label>
      <label style="font-size:11px">Stil
        <select id="ln-style" style="margin-left:6px">
          <option value="solid"  ${obj.line_style==='solid'  ?'selected':''}>Durchgezogen</option>
          <option value="dashed" ${obj.line_style==='dashed' ?'selected':''}>Gestrichelt</option>
          <option value="dotted" ${obj.line_style==='dotted' ?'selected':''}>Gepunktet</option>
        </select>
      </label>
      <label style="font-size:11px">Breite
        <input type="range" id="ln-width" min="1" max="10" value="${obj.line_width ?? 1}" style="vertical-align:middle">
        <span id="ln-width-val">${obj.line_width ?? 1}px</span>
      </label>
      <label style="font-size:11px">Winkel
        <input type="range" id="ln-angle" min="0" max="359" step="1"
               value="${Math.round(_lineAngle(lineVis))}" style="vertical-align:middle">
        <span id="ln-angle-val">${Math.round(_lineAngle(lineVis))}°</span>
      </label>
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
    lineVis.setAttribute('x2', `${nx2}%`);
    lineVis.setAttribute('y2', `${ny2}%`);
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
  document.getElementById('nv2-canvas').appendChild(el);
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
  document.querySelectorAll(`line[data-layer="${layerId}"], circle[data-layer="${layerId}"]`).forEach(el => {
    el.style.display = vis ? '' : 'none';
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
  panel.id = 'nv2-resize-panel';
  panel.className = 'resize-panel';
  const cvRect = document.getElementById('nv2-canvas').getBoundingClientRect();
  panel.style.left = `${cvRect.width / 2 - 120}px`;
  panel.style.top  = '80px';

  const curLayer = parseInt(el.dataset.layer ?? 0);
  const layerOpts = Object.values(_layers).map(l =>
    `<option value="${l.id}" ${l.id === curLayer ? 'selected' : ''}>${esc(l.name)} (z:${l.zIndex})</option>`
  ).join('');

  panel.innerHTML = `
    <div class="rp-head"><span>Layer zuweisen</span><button class="rp-close" id="rp-close-btn">✕</button></div>
    <div class="rp-body" style="display:flex;flex-direction:column;gap:8px;padding:8px">
      <label style="font-size:11px">Layer
        <select id="layer-select" style="margin-left:6px">${layerOpts}</select>
      </label>
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
  const h     = hostCache[obj.name];
  const label = h?.state_label ?? 'UNKNOWN';
  const tc    = STATE_CHIP[label] ?? 'unkn';
  const tt    = document.createElement('div');
  tt.className = 'nv2-tooltip';
  tt.innerHTML = `
    <div class="tt-name">${esc(obj.name)}</div>
    <div class="tt-row"><span>Status</span><b class="tt-${tc}">${label}</b></div>
    ${h ? `<div class="tt-row"><span>Output</span><b>${esc((h.output ?? '–').substring(0, 48))}</b></div>` : ''}
    ${h ? `<div class="tt-row"><span>Services</span><b>
      <span class="tt-ok">${h.services_ok ?? 0}ok</span>
      <span class="tt-warn"> ${h.services_warn ?? 0}w</span>
      <span class="tt-crit"> ${h.services_crit ?? 0}c</span></b></div>` : ''}
    <div class="tt-row"><span>Typ</span><b>${esc(obj.type)}</b></div>
    <div class="tt-row"><span>Pos</span><b>${parseFloat(obj.x).toFixed(1)}% / ${parseFloat(obj.y).toFixed(1)}%</b></div>`;

  const cvRect = document.getElementById('nv2-canvas').getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  tt.style.left = `${elRect.left - cvRect.left + elRect.width / 2}px`;
  tt.style.top  = `${elRect.top  - cvRect.top}px`;
  document.getElementById('nv2-canvas').appendChild(tt);
  _activeTooltip = tt;
}

function hideTooltip() {
  _activeTooltip?.remove();
  _activeTooltip = null;
}


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
  if (editActive) document.querySelectorAll('.nv2-node').forEach(makeDraggable);
}

function makeDraggable(el) {
  if (el._nv2drag) return;
  el._nv2drag = true;
  el.addEventListener('mousedown', e => {
    if (!editActive || e.button !== 0) return;
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
      el.style.left = `${Math.max(0, Math.min(100, x0 + (ev.clientX - sx) / rect.width  * 100)).toFixed(2)}%`;
      el.style.top  = `${Math.max(0, Math.min(97,  y0 + (ev.clientY - sy) / rect.height * 100)).toFixed(2)}%`;
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
function showNodeContextMenu(e, el, obj) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.id = 'nv2-ctx-menu';
  menu.className = 'ctx-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top  = `${e.clientY}px`;
  const items = [
    { label: '⤢ Größe ändern',     action: () => openResizeDialog(el, obj) },
    { label: '🖼 Iconset wechseln', action: () => openIconsetDialog(el, obj),
      hide: !['host','service','hostgroup','servicegroup','map'].includes(obj.type) },
    { label: '◫ Layer zuweisen',   action: () => openLayerDialog(el, obj) },
    { label: '🗑 Entfernen',        action: () => removeNode(el, obj), cls: 'ctx-danger' },
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

function closeContextMenu() {
  _ctxMenu?.remove();
  _ctxMenu = null;
}

function openResizeDialog(el, obj) {
  closeResizeDialog();
  const isNode   = ['host','service','hostgroup','servicegroup','map'].includes(obj.type);
  const isGadget = obj.type === 'gadget';
  const cur = isNode
    ? parseInt(el.style.getPropertyValue('--node-size') || '32')
    : isGadget
    ? parseInt(el.style.getPropertyValue('--gadget-size') || '100')
    : parseInt(el.style.transform?.match(/scale\(([\d.]+)\)/)?.[1] * 100 || '100');

  const panel = document.createElement('div');
  panel.id = 'nv2-resize-panel';
  panel.className = 'resize-panel';
  const rect   = el.getBoundingClientRect();
  const cvRect = document.getElementById('nv2-canvas').getBoundingClientRect();
  panel.style.left = `${rect.left - cvRect.left + rect.width + 8}px`;
  panel.style.top  = `${rect.top  - cvRect.top}px`;

  const unit = isNode ? 'px' : '%';
  const min  = isNode ? 16  : 40;
  const max  = isNode ? 128 : 300;
  const step = isNode ? 4   : 10;

  panel.innerHTML = `
    <div class="rp-head"><span>Größe</span><button class="rp-close" id="rp-close-btn">✕</button></div>
    <div class="rp-body">
      <input type="range" id="rp-slider" min="${min}" max="${max}" step="${step}" value="${cur}">
      <span class="rp-val" id="rp-val">${cur}${unit}</span>
    </div>
    <div class="rp-foot">
      <button class="btn-cancel rp-cancel" id="rp-cancel-btn">Abbrechen</button>
      <button class="btn-ok rp-ok" id="rp-ok-btn">Übernehmen</button>
    </div>`;

  document.getElementById('nv2-canvas').appendChild(panel);
  const slider = panel.querySelector('#rp-slider');
  const valLbl = panel.querySelector('#rp-val');
  slider.addEventListener('input', () => { valLbl.textContent = slider.value + unit; applySize(el, obj, parseInt(slider.value), isNode, isGadget); });
  panel.addEventListener('click', e => e.stopPropagation());
  panel.querySelector('#rp-close-btn').onclick  =
  panel.querySelector('#rp-cancel-btn').onclick = () => { applySize(el, obj, cur, isNode, isGadget); closeResizeDialog(); };
  panel.querySelector('#rp-ok-btn').onclick = async () => {
    const v = parseInt(slider.value);
    closeResizeDialog();
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
    el.style.transform = `scale(${v / 100})`;
    el.style.transformOrigin = 'top left';
  } else {
    el.style.transform = `scale(${v / 100})`;
    el.style.transformOrigin = 'top left';
  }
}

function closeResizeDialog() {
  document.getElementById('nv2-resize-panel')?.remove();
}

function openIconsetDialog(el, obj) {
  const all = [...KNOWN_ICONSETS, ...customIconsets];
  const cur = el.dataset.iconset || 'std_small';
  const dlg = document.createElement('div');
  dlg.id = 'nv2-iconset-dlg';
  dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg" style="width:360px">
      <h3>Iconset wählen – ${esc(obj.label || obj.name)}</h3>
      <div class="iconset-grid" id="iconset-grid">
        ${all.map(s => `
          <div class="iconset-card ${s === cur ? 'active' : ''}" data-set="${esc(s)}">
            <img src="assets/icons/${esc(s)}/ok.svg" width="32" height="32" alt="">
            <div class="iconset-name">${esc(s)}</div>
          </div>`).join('')}
        <div class="iconset-card iconset-upload" id="iconset-upload-card" title="Eigenes Iconset">
          <div style="font-size:22px">📂</div>
          <div class="iconset-name">Upload…</div>
          <input type="file" id="iconset-zip-input" accept=".zip" style="display:none">
        </div>
      </div>
      <div class="dlg-foot">
        <button class="btn-cancel" id="iconset-cancel">Abbrechen</button>
        <button class="btn-ok" id="iconset-ok">Übernehmen</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  let selected = cur;
  dlg.querySelectorAll('.iconset-card[data-set]').forEach(card => {
    card.addEventListener('click', () => {
      dlg.querySelectorAll('.iconset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active'); selected = card.dataset.set;
    });
  });
  dlg.querySelector('#iconset-cancel').onclick = () => dlg.remove();
  dlg.querySelector('#iconset-ok').onclick = async () => {
    dlg.remove();
    if (selected === cur) return;
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
  if (e.target.closest('#nv2-lines-svg')) return;
  if (document.getElementById('nv2-resize-panel')) { closeResizeDialog(); return; }
  if (_ctxMenu) { closeContextMenu(); return; }
  if (document.getElementById('nv2-iconset-dlg')) return;

  const rect = document.getElementById('nv2-canvas').getBoundingClientRect();
  pendingPos = {
    x: ((e.clientX - rect.left) / rect.width  * 100).toFixed(2),
    y: ((e.clientY - rect.top)  / rect.height * 100).toFixed(2),
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
    Object.assign(payload, { x2: parseFloat(pos.x) + 20, y2: parseFloat(pos.y), line_style: document.getElementById('dlg-ln-style').value, line_width: parseInt(document.getElementById('dlg-ln-width').value) || 1, color: document.getElementById('dlg-ln-color').value });
  } else if (type === 'container') {
    Object.assign(payload, { url: document.getElementById('dlg-ct-url').value.trim(), w: 12, h: 8 });
  }

  const obj = await api(`/api/maps/${activeMapId}/objects`, 'POST', payload);
  if (obj) { const el = createNode(obj); if (el && editActive) makeDraggable(el); }
  closeDlg('dlg-add-object');
  pendingPos = null;
}

async function confirmNewMap() {
  const title = document.getElementById('nm-title').value.trim();
  const mapId = document.getElementById('nm-id')   .value.trim();
  if (!title) { document.getElementById('nm-title').focus(); return; }
  closeDlg('dlg-new-map');
  const created = await api('/api/maps', 'POST', { title, map_id: mapId });
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

function dlgNewMap() { openDlg('dlg-new-map'); }


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
          <button class="manage-btn" onclick="closeDlg('dlg-manage-maps'); openMap('${esc(m.id)}')">▶</button>
          <button class="manage-btn" onclick="_renameMapId='${esc(m.id)}'; document.getElementById('rename-map-title').value='${esc(m.title)}'; closeDlg('dlg-manage-maps'); openDlg('dlg-rename-map')">✎</button>
          <button class="manage-btn" onclick="closeDlg('dlg-manage-maps'); openParentMapDlg('${esc(m.id)}')">🗺</button>
          <button class="manage-btn" onclick="exportMapById('${esc(m.id)}')">📤</button>
          <button class="manage-btn manage-btn-danger" onclick="_deleteMapId='${esc(m.id)}'; _deleteMapTitle='${esc(m.title)}'; confirmDeleteMapById(); closeDlg('dlg-manage-maps')">🗑</button>
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
window.openCardMenu          = openCardMenu;
window.closeCardMenu         = closeCardMenu;
window.confirmDeleteMapById  = confirmDeleteMapById;


// ═══════════════════════════════════════════════════════════════════════
//  KIOSK-MODUS
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
  const sd = document.getElementById('us-sidebar-default');   if (sd)  sd.value    = s.sidebarDefault;
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
  canvas.style.backgroundImage    = `url('${url}?t=${Date.now()}')`;
  canvas.style.backgroundSize     = 'contain';
  canvas.style.backgroundRepeat   = 'no-repeat';
  canvas.style.backgroundPosition = 'center';
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
  if (dot)    dot.className    = `foot-dot${ok ? '' : ' off'}`;
  if (status) status.textContent = txt ?? (ok ? 'verbunden' : 'getrennt');
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
  id: "demo-features", title: "NagVis 2 – Feature Demo", background: null,
  objects: [
    { object_id:"host::srv-web-01::abc123",  type:"host",     name:"srv-web-01",  x:15, y:20, iconset:"server",   label:"Webserver 01 (OK)" },
    { object_id:"host::srv-db-01::def456",   type:"host",     name:"srv-db-01",   x:35, y:20, iconset:"database", label:"Datenbank (ACK + DT)" },
    { object_id:"service::srv-web-01::HTTP", type:"service",  name:"HTTP Response Time", host_name:"srv-web-01", x:15, y:35, iconset:"default", label:"HTTP (CRITICAL)" },
    { object_id:"hostgroup::webservers",     type:"hostgroup",name:"webservers",   x:55, y:20, iconset:"default", label:"Alle Webserver" },
    { object_id:"textbox::zone-a",           type:"textbox",  text:"Zone A – Produktion", x:8, y:8, w:18, h:5, font_size:16, bold:true, color:"#0ea5e9", bg_color:"rgba(14,165,233,0.08)" },
    { object_id:"line::connection-1",        type:"line",     x:30, y:30, x2:70, y2:70, line_style:"dashed", line_width:2, color:"#475569" },
    { object_id:"map::datacenter-b",         type:"map",      name:"datacenter-b", x:75, y:35, iconset:"map", label:"Datacenter B (nested)" },
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
  { id:"demo-features", title:"NagVis 2 – Feature Demo", background:null, object_count:DEMO_MAP.objects.length }
];

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
    if (path === '/api/maps' && method === 'GET') return [..._demoMaps];

    const mGet = path.match(/^\/api\/maps\/([\w-]+)$/);
    if (mGet && method === 'GET') {
      if (mGet[1] === 'demo-features') return JSON.parse(JSON.stringify(DEMO_MAP));
      return null;
    }
    if (path === '/api/maps' && method === 'POST') {
      const id  = body.map_id || body.title.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
      const map = { id, title:body.title, background:null, objects:[] };
      _demoMaps.push({ ...map, object_count:0 });
      return { ...map };
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