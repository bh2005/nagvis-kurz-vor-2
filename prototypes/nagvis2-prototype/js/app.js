/**
 * NagVis 2 – app.js
 * =================
 * Vollständige Applikationslogik: WebSocket, DOM-Rendering,
 * Edit-Mode, Theme-Switch, Dialoge, Snap-In Panels.
 *
 * Keine externe Abhängigkeit, kein Build-Step.
 * Kommuniziert mit dem FastAPI-Backend via REST + WebSocket.
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════
//  KONSTANTEN
// ═══════════════════════════════════════════════════════════════════════

/** CSS-Klassen je Livestatus-Zustand */
const STATE_CLS = {
  UP:          'nv2-ok',
  OK:          'nv2-ok',
  WARNING:     'nv2-warning',
  CRITICAL:    'nv2-critical',
  UNKNOWN:     'nv2-unknown',
  DOWN:        'nv2-critical',
  UNREACHABLE: 'nv2-critical',
  PENDING:     'nv2-unknown',
};

/** Badge-Zeichen */
const STATE_BADGE = {
  UP:'✓', OK:'✓', WARNING:'!', CRITICAL:'✕',
  UNKNOWN:'?', DOWN:'↓', UNREACHABLE:'↕', PENDING:'…',
};

/** CSS-Klasse für Status-Pip / Tag */
const STATE_CHIP = {
  UP:'ok', OK:'ok', WARNING:'warn', CRITICAL:'crit',
  DOWN:'crit', UNREACHABLE:'crit', UNKNOWN:'unkn', PENDING:'unkn',
};

/** Emoji-Icons je Iconset */
const ICONS = {
  server:   '🖥',
  router:   '🌐',
  switch:   '🔀',
  firewall: '🔥',
  storage:  '💾',
  database: '🗄',
  ups:      '⚡',
  ap:       '📡',
  default:  '⬡',
};


// ═══════════════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════════════

let activeMapId  = null;   // aktuell geöffnete Map-ID
let activeMapCfg = null;   // Map-Config-Objekt vom Server
let wsClient     = null;   // WebSocket-Verbindung
let editActive   = false;  // Edit-Mode an/aus
let pendingPos   = null;   // { x, y } für nächsten Host-Place via Canvas-Klick
let hostCache    = {};     // name → hostData (letzter Snapshot/Update)
let eventLog     = [];     // Array der letzten 60 Events für den Event-Stream
let activeSnapin = null;   // 'hosts' | 'events' | null
let currentTheme = 'dark'; // 'dark' | 'light'


// ═══════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {

  // Theme aus localStorage wiederherstellen
  const savedTheme = localStorage.getItem('nv2-theme') ?? 'dark';
  setTheme(savedTheme, false);

  // Sidebar-State wiederherstellen
  restoreSidebar();

  // Button-Verdrahtung
  document.getElementById('btn-edit')      .addEventListener('click', toggleEdit);
  document.getElementById('btn-refresh')   .addEventListener('click', () => wsClient?.forceRefresh());
  document.getElementById('btn-add-host').addEventListener('click', () => openDlg('dlg-add-object'));
  document.getElementById('btn-delete-map').addEventListener('click', confirmDeleteMap);
  document.getElementById('btn-bg-upload') .addEventListener('click', () => document.getElementById('bg-file-input').click());
  document.getElementById('bg-file-input') .addEventListener('change', e => {
    if (e.target.files[0]) uploadBg(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btn-sidebar-toggle-foot').addEventListener('click', toggleSidebar);
  document.getElementById('btn-theme').addEventListener('click', () => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  // Canvas-Klick → Host platzieren
  document.getElementById('nv2-canvas').addEventListener('click', onCanvasClick);

  // Drag & Drop für Hintergrundbilder
  setupDragDrop();

  // Keyboard-Shortcuts
  document.addEventListener('keydown', onKeyDown);

  // Erste Map-Liste laden → Overview aufbauen
  await loadMaps();

  // Health-Polling alle 30s
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
  sidebar.classList.toggle('collapsed', sidebarCollapsed);
  localStorage.setItem('nv2-sidebar', sidebarCollapsed ? '1' : '0');
}

function restoreSidebar() {
  if (localStorage.getItem('nv2-sidebar') === '1') {
    sidebarCollapsed = true;
    document.getElementById('sidebar').classList.add('collapsed');
  }
}




/**
 * Schaltet Light/Dark-Theme und persistiert die Auswahl.
 * @param {'light'|'dark'} theme
 * @param {boolean} [save=true]
 */
function setTheme(theme, save = true) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀' : '☽';
    btn.title = theme === 'dark' ? 'Zu Light-Theme wechseln' : 'Zu Dark-Theme wechseln';
  }
  if (save) localStorage.setItem('nv2-theme', theme);
}


// ═══════════════════════════════════════════════════════════════════════
//  MAPS LADEN & RENDERN
// ═══════════════════════════════════════════════════════════════════════

async function loadMaps() {
  const maps = await api('/api/maps') ?? [];
  renderSidebarMaps(maps);
  renderOverview(maps);
}

/** Maps in der Sidebar-Liste darstellen */
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

  // Click-Handler
  el.querySelectorAll('.map-entry').forEach(entry => {
    entry.addEventListener('click', () => openMap(entry.dataset.mapId));
  });
}

/** Overview-Karten-Raster befüllen */
function renderOverview(maps) {
  const grid = document.getElementById('ov-grid');
  const cards = maps.map(m => `
    <div class="ov-card" data-map-id="${esc(m.id)}">
      <div class="ov-card-title">${esc(m.title)}</div>
      <div class="ov-card-meta">${m.object_count ?? 0} Objekte · ${esc(m.id)}</div>
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

  // Click-Handler
  grid.querySelectorAll('.ov-card').forEach(card => {
    card.addEventListener('click', () => openMap(card.dataset.mapId));
  });
  document.getElementById('btn-new-map')?.addEventListener('click', dlgNewMap);
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

  if (activeMapCfg.background) {
    setBg(`/${activeMapCfg.background}`);
  } else {
    canvas.style.backgroundImage = '';
    document.getElementById('upload-prompt').classList.remove('hidden');
  }

  // Nodes platzieren
  for (const obj of activeMapCfg.objects ?? []) {
    createNode(obj);
  }

  // WebSocket
  if (wsClient) {
    wsClient._dead = true;
    wsClient.ws?.close();
  }
  wsClient = makeWsClient(mapId);
  wsClient.connect();
}

/** Zurück zur Übersicht */
function showOverview() {
  document.getElementById('overview')         .style.display = 'block';
  document.getElementById('map-area')         .style.display = 'none';
  document.getElementById('map-toolbar')      .style.display = 'none';
  document.getElementById('tb-pills')         .style.display = 'none';
  document.getElementById('snap-tabs')        .style.display = 'none';
  document.getElementById('snapin-container') .style.display = 'none';

  document.getElementById('tb-title').textContent = 'NagVis 2';
  document.getElementById('tb-sub')  .textContent = 'Wähle eine Map';
  document.getElementById('nav-btn-overview').classList.add('active');
  document.querySelectorAll('.map-entry').forEach(e => e.classList.remove('active'));

  if (wsClient) { wsClient._dead = true; wsClient.ws?.close(); wsClient = null; }
  closeSnapin(activeSnapin);
  hostCache = {};
  activeMapId = null;
  if (editActive) toggleEdit();

  loadMaps();
}

// Globale Exports für onclick-Attribute im HTML
window.showOverview = showOverview;


// ═══════════════════════════════════════════════════════════════════════
//  WEBSOCKET CLIENT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Erstellt einen minimalen WebSocket-Client mit Auto-Reconnect.
 * @param {string} mapId
 * @returns {{ connect, send, forceRefresh, disconnect, _dead, ws }}
 */
function makeWsClient(mapId) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url   = `${proto}://${location.host}/ws/map/${mapId}`;

  const client = {
    mapId,
    ws:     null,
    _dead:  false,
    _delay: 2000,

    connect() {
      if (this._dead) return;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this._delay = 2000;
        onWsOpen();
      };
      this.ws.onmessage = e => {
        try { onWsMsg(JSON.parse(e.data)); }
        catch { /* malformed JSON */ }
      };
      this.ws.onclose = () => {
        if (this._dead) return;
        onWsClose();
        setTimeout(() => this.connect(), this._delay);
        this._delay = Math.min(this._delay * 1.5, 30_000);
      };
      this.ws.onerror = () => { /* onclose folgt */ };
    },

    send(data) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data));
      }
    },

    forceRefresh() { this.send({ cmd: 'force_refresh' }); },

    disconnect() {
      this._dead = true;
      this.ws?.close();
    },
  };

  return client;
}

function onWsOpen() {
  setConnDot('connected');
  setSidebarLive(true, 'Livestatus · verbunden');
}

function onWsClose() {
  setConnDot('disconnected');
  setSidebarLive(false, 'Getrennt – verbinde…');
  setStatusBar('Verbindung unterbrochen…');
}


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

    case '_connected':
      setConnDot('connected');
      break;

    case '_disconnected':
      setConnDot('disconnected');
      break;

    case 'backend_error':
      setStatusBar(`⚠ ${ev.message}`);
      break;
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  NODE RENDERING  – alle Objekttypen
// ═══════════════════════════════════════════════════════════════════════

/**
 * Erzeugt das passende DOM-Element je Objekttyp.
 */
function createNode(obj) {
  if (document.getElementById(`nv2-${obj.object_id}`)) return null;

  switch (obj.type) {
    case 'host':
    case 'service':
    case 'hostgroup':
    case 'servicegroup':
    case 'map':
      return _renderMonitoringNode(obj);
    case 'textbox':
      return _renderTextbox(obj);
    case 'line':
      return _renderLine(obj);
    case 'container':
      return _renderContainer(obj);
    default:
      console.warn('[NV2] createNode: unbekannter Typ', obj.type);
      return null;
  }
}

/** Monitoring-Knoten (host / service / hostgroup / servicegroup / map) */
function _renderMonitoringNode(obj) {
  const icon = ICONS[obj.iconset] ?? ICONS.default;
  const el   = document.createElement('div');
  el.id               = `nv2-${obj.object_id}`;
  el.className        = 'nv2-node nv2-unknown';
  el.dataset.objectId = obj.object_id;
  el.dataset.name     = obj.type === 'service'
    ? `${obj.host_name}::${obj.name}`
    : obj.name;
  el.dataset.type     = obj.type;
  el.style.left       = `${obj.x}%`;
  el.style.top        = `${obj.y}%`;

  // Typ-Badge oben links
  const typeBadge = { service:'svc', hostgroup:'hg', servicegroup:'sg', map:'map' };
  const typePill  = typeBadge[obj.type]
    ? `<span class="nv2-type-pill">${typeBadge[obj.type]}</span>`
    : '';

  el.innerHTML = `
    ${typePill}
    <div class="nv2-ring">
      <span aria-hidden="true">${icon}</span>
      <span class="nv2-badge" aria-label="UNKNOWN">?</span>
    </div>
    <div class="nv2-label" title="${esc(obj.label || obj.name)}">${esc(obj.label || obj.name)}</div>`;

  el.addEventListener('mouseenter', () => showTooltip(el, obj));
  el.addEventListener('mouseleave', hideTooltip);
  el.addEventListener('contextmenu', e => { e.preventDefault(); if (editActive) removeNode(el, obj); });

  document.getElementById('nv2-canvas').appendChild(el);

  // Sofort Status aus Cache
  const cacheKey = obj.type === 'service'
    ? `${obj.host_name}::${obj.name}`
    : obj.name;
  const cached = hostCache[cacheKey];
  if (cached) applyNodeStatus(el, cached.state_label, cached.acknowledged, cached.in_downtime);

  return el;
}

/** Textbox */
function _renderTextbox(obj) {
  const el = document.createElement('div');
  el.id               = `nv2-${obj.object_id}`;
  el.className        = 'nv2-textbox';
  el.dataset.objectId = obj.object_id;
  el.dataset.type     = 'textbox';
  el.style.left       = `${obj.x}%`;
  el.style.top        = `${obj.y}%`;
  el.style.fontSize   = `${obj.font_size ?? 13}px`;
  el.style.fontWeight = obj.bold ? '700' : '400';
  el.style.color      = obj.color      || 'var(--text)';
  el.style.background = obj.bg_color   || '';
  el.style.border     = obj.border_color ? `1px solid ${obj.border_color}` : '';
  if (obj.w) el.style.width  = `${obj.w}%`;
  el.textContent = obj.text ?? '';

  el.addEventListener('contextmenu', e => { e.preventDefault(); if (editActive) removeNode(el, obj); });
  document.getElementById('nv2-canvas').appendChild(el);
  return el;
}

/** Linie – gezeichnet als SVG-Overlay */
function _renderLine(obj) {
  // Einen einzigen SVG-Overlay pro Canvas anlegen und wiederverwenden
  let svg = document.getElementById('nv2-lines-svg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id        = 'nv2-lines-svg';
    svg.classList.add('nv2-line-svg');
    document.getElementById('nv2-canvas').appendChild(svg);
  }

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.id = `nv2-${obj.object_id}`;
  line.classList.add('nv2-line-el');
  line.dataset.objectId = obj.object_id;
  line.dataset.type     = 'line';

  // Koordinaten in % → SVG-Attribute
  line.setAttribute('x1', `${obj.x}%`);
  line.setAttribute('y1', `${obj.y}%`);
  line.setAttribute('x2', `${obj.x2 ?? obj.x + 20}%`);
  line.setAttribute('y2', `${obj.y2 ?? obj.y}%`);
  line.setAttribute('stroke',       obj.color       || 'var(--border-hi)');
  line.setAttribute('stroke-width', obj.line_width  ?? 1);

  const dashMap = { dashed: '8,4', dotted: '2,4' };
  const dash    = dashMap[obj.line_style];
  if (dash) line.setAttribute('stroke-dasharray', dash);

  line.addEventListener('contextmenu', e => { e.preventDefault(); if (editActive) { line.remove(); _patchRemove(obj); } });
  svg.appendChild(line);
  return line;
}

/** Container / Bild */
function _renderContainer(obj) {
  const el  = document.createElement('div');
  el.id               = `nv2-${obj.object_id}`;
  el.className        = 'nv2-container';
  el.dataset.objectId = obj.object_id;
  el.dataset.type     = 'container';
  el.style.left       = `${obj.x}%`;
  el.style.top        = `${obj.y}%`;
  if (obj.w) el.style.width  = `${obj.w}%`;
  if (obj.h) el.style.height = `${obj.h}vmin`;

  if (obj.url) {
    const isSvg = obj.url.toLowerCase().endsWith('.svg');
    if (isSvg) {
      const o  = document.createElement('object');
      o.type   = 'image/svg+xml';
      o.data   = obj.url;
      el.appendChild(o);
    } else {
      const img = document.createElement('img');
      img.src   = obj.url;
      img.alt   = '';
      el.appendChild(img);
    }
  }

  el.addEventListener('contextmenu', e => { e.preventDefault(); if (editActive) removeNode(el, obj); });
  document.getElementById('nv2-canvas').appendChild(el);
  return el;
}

async function _patchRemove(obj) {
  await api(`/api/maps/${activeMapId}/objects/${obj.object_id}`, 'DELETE');
}

/**
 * Wendet Statusfarbe + Badge auf alle Nodes einer Host/Service-Gruppe an.
 */
function applyStatuses(hosts, services) {
  for (const h of hosts) {
    hostCache[h.name] = h;
    document.querySelectorAll(`[data-name="${esc(h.name)}"]`).forEach(el =>
      applyNodeStatus(el, h.state_label, h.acknowledged, h.in_downtime)
    );
  }
  for (const s of services) {
    const key = `${s.host_name}::${s.description}`;
    document.querySelectorAll(`[data-name="${esc(key)}"]`).forEach(el =>
      applyNodeStatus(el, s.state_label, s.acknowledged, s.in_downtime)
    );
  }
}

/**
 * Setzt CSS-Klassen und Badge eines einzelnen Node-Elements.
 */
function applyNodeStatus(el, label, ack, downtime) {
  let cls = 'nv2-node ' + (STATE_CLS[label] ?? 'nv2-unknown');
  if (ack)      cls += ' nv2-ack';
  if (downtime) cls += ' nv2-downtime';
  if (el.className === cls) return;

  const wasUnknown = el.className.includes('nv2-unknown');
  el.className = cls;

  const badge = el.querySelector('.nv2-badge');
  if (badge) {
    badge.textContent = STATE_BADGE[label] ?? '?';
    badge.setAttribute('aria-label', label);
  }

  if (!wasUnknown) {
    el.classList.add('nv2-status-changed');
    setTimeout(() => el.classList.remove('nv2-status-changed'), 500);
  }
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

  const tt = document.createElement('div');
  tt.className = 'nv2-tooltip';
  tt.innerHTML = `
    <div class="tt-name">${esc(obj.name)}</div>
    <div class="tt-row"><span>Status</span><b class="tt-${tc}">${label}</b></div>
    ${h ? `<div class="tt-row"><span>Output</span><b>${esc((h.output ?? '–').substring(0, 48))}</b></div>` : ''}
    ${h ? `<div class="tt-row"><span>Services</span><b>
      <span class="tt-ok">${h.services_ok ?? 0}ok</span>
      <span class="tt-warn"> ${h.services_warn ?? 0}w</span>
      <span class="tt-crit"> ${h.services_crit ?? 0}c</span>
    </b></div>` : ''}
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
//  STATUS PILLS (Topbar)
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

  // Map-Pip in der Sidebar
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
  if (!hosts.length) {
    body.innerHTML = '<div class="empty-hint">Keine Hosts</div>';
    return;
  }
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
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('nv2-status-changed');
  setTimeout(() => el.classList.remove('nv2-status-changed'), 800);
}


// ═══════════════════════════════════════════════════════════════════════
//  EVENT STREAM
// ═══════════════════════════════════════════════════════════════════════

function appendEvents(hosts, services, ts) {
  const items = [
    ...hosts.map(h => ({
      bar:  STATE_CHIP[h.state_label] === 'crit' ? 'crit'
           :STATE_CHIP[h.state_label] === 'warn' ? 'warn'
           :STATE_CHIP[h.state_label] === 'ok'   ? 'ok' : 'info',
      host: h.name,
      msg:  `${h.state_label}: ${(h.output ?? '').substring(0, 60)}`,
      ts,
    })),
    ...services.map(s => ({
      bar:  STATE_CHIP[s.state_label] === 'crit' ? 'crit'
           :STATE_CHIP[s.state_label] === 'warn' ? 'warn'
           :STATE_CHIP[s.state_label] === 'ok'   ? 'ok' : 'info',
      host: `${s.host_name} · ${s.description}`,
      msg:  `${s.state_label}: ${(s.output ?? '').substring(0, 50)}`,
      ts,
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

// Globale Exports
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

  btn.textContent = editActive ? '✓ Fertig' : '✏ Bearbeiten';
  btn.classList.toggle('on', editActive);
  addBtn.style.display = editActive ? 'flex' : 'none';
  banner.classList.toggle('show', editActive);
  canvas.classList.toggle('nv2-edit-mode', editActive);

  if (editActive) {
    document.querySelectorAll('.nv2-node').forEach(makeDraggable);
  }
}

/**
 * Macht einen Node per Maus verschiebbar.
 * Speichert neue Position via PATCH an den Server.
 */
function makeDraggable(el) {
  if (el._nv2drag) return;
  el._nv2drag = true;

  el.addEventListener('mousedown', e => {
    if (!editActive || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    hideTooltip();

    const canvas = document.getElementById('nv2-canvas');
    const rect   = canvas.getBoundingClientRect();
    const x0     = parseFloat(el.style.left);
    const y0     = parseFloat(el.style.top);
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

      await api(
        `/api/maps/${activeMapId}/objects/${el.dataset.objectId}/pos`,
        'PATCH',
        { x: parseFloat(el.style.left), y: parseFloat(el.style.top) }
      );
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

async function removeNode(el, obj) {
  if (!confirm(`"${obj.name}" von der Map entfernen?`)) return;
  await api(`/api/maps/${activeMapId}/objects/${obj.object_id}`, 'DELETE');
  el.remove();
}


// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
//  CANVAS-KLICK → OBJEKT PLATZIEREN
// ═══════════════════════════════════════════════════════════════════════

function onCanvasClick(e) {
  if (!editActive) return;
  if (e.target.closest('.nv2-node, .nv2-textbox, .nv2-container')) return;
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

/** Typ-Chip anklicken → richtige Felder anzeigen */
function selectObjType(type) {
  _activeObjType = type;

  // Chips
  document.querySelectorAll('.type-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.type === type)
  );

  // Felder-Sektionen
  const monTypes = ['host','hostgroup','servicegroup','map'];
  document.getElementById('dlg-fields-monitoring').style.display =
    monTypes.includes(type) ? 'block' : 'none';
  document.getElementById('dlg-fields-service').style.display =
    type === 'service' ? 'block' : 'none';
  document.getElementById('dlg-fields-textbox').style.display =
    type === 'textbox' ? 'block' : 'none';
  document.getElementById('dlg-fields-line').style.display =
    type === 'line' ? 'block' : 'none';
  document.getElementById('dlg-fields-container').style.display =
    type === 'container' ? 'block' : 'none';

  // Label-Hinweis je Typ
  const lbl = { host:'Hostname', hostgroup:'Gruppenname', servicegroup:'Gruppenname', map:'Map-ID' };
  const nameLabel = document.getElementById('dlg-name-label');
  if (nameLabel) nameLabel.textContent = lbl[type] ?? 'Name';
}

/** Objekt hinzufügen bestätigen */
async function confirmAddObject() {
  const type = _activeObjType;
  const pos  = pendingPos ?? {
    x: (15 + Math.random() * 70).toFixed(1),
    y: (15 + Math.random() * 70).toFixed(1),
  };

  let payload = { type, x: parseFloat(pos.x), y: parseFloat(pos.y) };

  if (type === 'service') {
    const hostName = document.getElementById('dlg-svc-host').value.trim();
    const svcName  = document.getElementById('dlg-svc-name').value.trim();
    if (!hostName || !svcName) {
      document.getElementById(!hostName ? 'dlg-svc-host' : 'dlg-svc-name').focus();
      return;
    }
    Object.assign(payload, {
      name:      svcName,
      host_name: hostName,
      iconset:   'default',
      label:     document.getElementById('dlg-svc-label').value.trim() || svcName,
    });

  } else if (['host','hostgroup','servicegroup','map'].includes(type)) {
    const name = document.getElementById('dlg-obj-name').value.trim();
    if (!name) { document.getElementById('dlg-obj-name').focus(); return; }
    Object.assign(payload, {
      name,
      iconset: document.getElementById('dlg-iconset').value,
      label:   document.getElementById('dlg-obj-label').value.trim() || name,
    });

  } else if (type === 'textbox') {
    const text = document.getElementById('dlg-tb-text').value.trim() || 'Text';
    Object.assign(payload, {
      text,
      font_size:    parseInt(document.getElementById('dlg-tb-size').value) || 13,
      bold:         document.getElementById('dlg-tb-bold').checked,
      color:        document.getElementById('dlg-tb-color').value,
      bg_color:     document.getElementById('dlg-tb-bg').value,
      border_color: '',
      w: 14, h: 4,
    });

  } else if (type === 'line') {
    Object.assign(payload, {
      x2:         parseFloat(pos.x) + 20,
      y2:         parseFloat(pos.y),
      line_style: document.getElementById('dlg-ln-style').value,
      line_width: parseInt(document.getElementById('dlg-ln-width').value) || 1,
      color:      document.getElementById('dlg-ln-color').value,
    });

  } else if (type === 'container') {
    const url = document.getElementById('dlg-ct-url').value.trim();
    Object.assign(payload, { url, w: 12, h: 8 });
  }

  const obj = await api(`/api/maps/${activeMapId}/objects`, 'POST', payload);
  if (obj) {
    const el = createNode(obj);
    if (el && editActive) makeDraggable(el);
  }

  closeDlg('dlg-add-object');
  pendingPos = null;
}

/** Neue Map anlegen bestätigen */
async function confirmNewMap() {
  const title = document.getElementById('nm-title').value.trim();
  const mapId = document.getElementById('nm-id')   .value.trim();
  if (!title) { document.getElementById('nm-title').focus(); return; }
  closeDlg('dlg-new-map');
  const created = await api('/api/maps', 'POST', { title, map_id: mapId });
  if (created) openMap(created.id);
}

/** Map löschen */
async function confirmDeleteMap() {
  if (!activeMapId) return;
  if (!confirm(`Map "${activeMapCfg?.title ?? activeMapId}" wirklich löschen?`)) return;
  await api(`/api/maps/${activeMapId}`, 'DELETE');
  showOverview();
}

function dlgNewMap() { openDlg('dlg-new-map'); }

function fillHostDatalist(hosts) {
  const opts = hosts.map(h => `<option value="${esc(h.name)}">`).join('');
  document.getElementById('known-hosts').innerHTML     = opts;
  document.getElementById('known-hosts-svc').innerHTML = opts;
}

// Globale Exports
window.confirmAddObject = confirmAddObject;
window.selectObjType    = selectObjType;
window.confirmNewMap    = confirmNewMap;
window.dlgNewMap        = dlgNewMap;
window.openDlg  = id => document.getElementById(id)?.classList.add('show');
window.closeDlg = id => {
  document.getElementById(id)?.classList.remove('show');
  document.querySelectorAll(`#${id} input[type=text], #${id} textarea`).forEach(i => i.value = '');
};


// ═══════════════════════════════════════════════════════════════════════
//  HINTERGRUNDBILD
// ═══════════════════════════════════════════════════════════════════════

async function uploadBg(file) {
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch(`/api/maps/${activeMapId}/background`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setBg(data.url);
  } catch (err) {
    alert(`Upload fehlgeschlagen: ${err.message}`);
  }
}

function setBg(url) {
  const canvas = document.getElementById('nv2-canvas');
  canvas.style.backgroundImage    = `url('${url}?t=${Date.now()}')`;
  canvas.style.backgroundSize     = 'contain';
  canvas.style.backgroundRepeat   = 'no-repeat';
  canvas.style.backgroundPosition = 'center';
  document.getElementById('upload-prompt').classList.add('hidden');
}

function setupDragDrop() {
  const area = document.getElementById('map-area');
  const box  = document.getElementById('upload-box');
  area.addEventListener('dragenter', e  => { e.preventDefault(); box?.classList.add('drag-over'); });
  area.addEventListener('dragover',  e  => { e.preventDefault(); });
  area.addEventListener('dragleave', () => box?.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    box?.classList.remove('drag-over');
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
  if (chip) {
    chip.textContent = ok ? 'OK' : '!';
    chip.className   = 'nav-chip ' + (ok ? 'ok' : 'crit');
  }
  setSidebarLive(ok, `${h.demo_mode ? 'Demo' : 'Livestatus'} · ${h.status}`);
}


// ═══════════════════════════════════════════════════════════════════════
//  UI-HELFER
// ═══════════════════════════════════════════════════════════════════════

function setStatusBar(msg) {
  document.getElementById('nv2-status-bar').textContent = msg;
}

function setConnDot(state) {
  document.getElementById('nv2-conn-dot').className = `conn-dot ${state}`;
}

function setSidebarLive(ok, txt) {
  const dot = document.getElementById('foot-dot');
  if (dot) dot.className = `foot-dot${ok ? '' : ' off'}`;
  const status = document.getElementById('sidebar-status');
  if (status) status.textContent = txt ?? (ok ? 'verbunden' : 'getrennt');
}

/** Unix-Timestamp → HH:MM:SS */
function fmt(ts) {
  return ts ? new Date(ts * 1000).toLocaleTimeString('de-DE') : '';
}

/** HTML-Sonderzeichen escapen */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// ═══════════════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════════════

function onKeyDown(e) {
  const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

  if (e.key === 'b' && !inInput && !e.ctrlKey && !e.metaKey) {
    toggleSidebar();
  }

  if (e.key === 'Escape') {
    window.closeDlg('dlg-add-object');
    window.closeDlg('dlg-new-map');
    if (editActive) toggleEdit();
    closeSnapin(activeSnapin);
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'e' && activeMapId) {
    e.preventDefault();
    toggleEdit();
  }

  if (e.key === 'r' && activeMapId && !e.ctrlKey && !e.metaKey && !inInput) {
    wsClient?.forceRefresh();
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  API WRAPPER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Einfacher fetch-Wrapper mit JSON-Handling.
 * Gibt null zurück bei Fehlern (kein throw nach oben).
 * @param {string}  path
 * @param {string}  [method='GET']
 * @param {object}  [body=null]
 * @returns {Promise<any|null>}
 */
async function api(path, method = 'GET', body = null) {
  try {
    const opts = { method, headers: {} };
    if (body) {
      opts.body = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
    const r = await fetch(path, opts);
    if (!r.ok) {
      console.warn(`[NV2] API ${method} ${path} → ${r.status}`);
      return null;
    }
    if (method === 'DELETE') return true;
    return r.json();
  } catch (err) {
    console.error('[NV2] api() error:', err);
    return null;
  }
}