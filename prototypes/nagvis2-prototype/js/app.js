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
/** Emoji-Fallback wenn kein Iconset-Bild vorhanden */
const ICONS_FALLBACK = {
  server:'🖥', router:'🌐', switch:'🔀', firewall:'🔥',
  storage:'💾', database:'🗄', ups:'⚡', ap:'📡', map:'🗺', default:'⬡',
};

/** Bekannte Iconsets (Verzeichnisse unter assets/icons/) */
const KNOWN_ICONSETS = ['std_small','server','router','switch','firewall','database','storage','ups','ap'];

/** Upload-Cache für benutzerdefinierte Iconsets */
let customIconsets = JSON.parse(localStorage.getItem('nv2-custom-iconsets') || '[]');

/**
 * Liefert die Icon-URL für ein Iconset + State.
 * Fällt auf Emoji zurück wenn kein Bild bekannt.
 * @returns {{ type: 'img'|'emoji', src: string }}
 */
function iconSrc(iconset, stateLabel) {
  const all = [...KNOWN_ICONSETS, ...customIconsets];
  const set = all.includes(iconset) ? iconset : null;
  if (!set) return { type: 'emoji', src: ICONS_FALLBACK[iconset] ?? ICONS_FALLBACK.default };
  const state = stateLabel
    ? (stateLabel === 'UP' || stateLabel === 'OK' ? 'ok'
      : stateLabel === 'WARNING'   ? 'warning'
      : stateLabel === 'CRITICAL' || stateLabel === 'DOWN' ? 'critical'
      : stateLabel === 'UNKNOWN'   ? 'unknown'
      : stateLabel === 'PENDING'   ? 'pending'
      : 'unknown')
    : 'unknown';
  return { type: 'img', src: `assets/icons/${set}/${state}.svg` };
}

/**
 * Aktualisiert das Icon-Bild eines Node-Elements nach Statuswechsel.
 */
function updateNodeIcon(el, stateLabel) {
  const iconset = el.dataset.iconset;
  if (!iconset) return;
  const ring = el.querySelector('.nv2-ring');
  if (!ring) return;
  const { type, src } = iconSrc(iconset, stateLabel);
  const existing = ring.querySelector('img.nv2-icon, span.nv2-icon-emoji');
  if (type === 'img') {
    if (existing?.tagName === 'IMG') {
      existing.src = src;
    } else {
      const img = document.createElement('img');
      img.className = 'nv2-icon';
      img.src = src;
      img.alt = '';
      existing?.remove();
      ring.insertBefore(img, ring.firstChild);
    }
  } else {
    if (existing?.tagName !== 'IMG') {
      existing.textContent = src;
    }
  }
}


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

  // Demo-Modus erkennen (kein Backend → statische Daten)
  await detectDemoMode();

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
    </div>
    <div class="ov-new ov-import" id="btn-migrate-map">
      <span style="font-size:18px;line-height:1">↑</span> NagVis&#x202F;1 importieren
    </div>`;

  // Click-Handler
  grid.querySelectorAll('.ov-card').forEach(card => {
    card.addEventListener('click', () => openMap(card.dataset.mapId));
  });
  document.getElementById('btn-new-map')?.addEventListener('click', dlgNewMap);
  document.getElementById('btn-migrate-map')?.addEventListener('click', dlgMigrate);
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
  }

  // Nodes platzieren
  for (const obj of activeMapCfg.objects ?? []) {
    createNode(obj);
  }

  // WebSocket (oder Demo-Ersatz)
  if (wsClient) {
    wsClient._dead = true;
    wsClient.ws?.close();
  }
  wsClient = _demoMode ? makeDemoWsClient(mapId) : makeWsClient(mapId);
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
      // Downtime-Transitions → kurzer Hinweis-Banner
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
    case 'gadget':
      return createGadget(obj);
    default:
      console.warn('[NV2] createNode: unbekannter Typ', obj.type);
      return null;
  }
}

/** Monitoring-Knoten (host / service / hostgroup / servicegroup / map) */
function _renderMonitoringNode(obj) {
  const { type: iconType, src: iconSrcVal } = iconSrc(obj.iconset ?? 'std_small', null);
  const size = obj.size ?? 32;

  const el = document.createElement('div');
  el.id               = `nv2-${obj.object_id}`;
  el.className        = 'nv2-node nv2-unknown';
  el.dataset.objectId = obj.object_id;
  el.dataset.name     = obj.type === 'service'
    ? `${obj.host_name}::${obj.name}` : obj.name;
  el.dataset.type     = obj.type;
  el.dataset.iconset  = obj.iconset ?? 'std_small';
  el.style.left       = `${obj.x}%`;
  el.style.top        = `${obj.y}%`;
  el.style.setProperty('--node-size', `${size}px`);

  const typeBadge = { service:'svc', hostgroup:'hg', servicegroup:'sg', map:'map' };
  const typePill  = typeBadge[obj.type]
    ? `<span class="nv2-type-pill">${typeBadge[obj.type]}</span>` : '';

  const iconHtml = iconType === 'img'
    ? `<img class="nv2-icon" src="${esc(iconSrcVal)}" alt="" width="${size}" height="${size}">`
    : `<span class="nv2-icon-emoji" aria-hidden="true">${iconSrcVal}</span>`;

  el.innerHTML = `
    ${typePill}
    <div class="nv2-ring" style="width:${size}px;height:${size}px">
      ${iconHtml}
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

  // Sofort Status aus Cache
  const cacheKey = obj.type === 'service'
    ? `${obj.host_name}::${obj.name}` : obj.name;
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
  const scale = (obj.size ?? 100) / 100;
  el.style.transform  = scale !== 1 ? `scale(${scale})` : '';
  el.style.fontSize   = `${obj.font_size ?? 13}px`;
  el.style.fontWeight = obj.bold ? '700' : '400';
  el.style.color      = obj.color      || 'var(--text)';
  el.style.background = obj.bg_color   || '';
  el.style.border     = obj.border_color ? `1px solid ${obj.border_color}` : '';
  if (obj.w) el.style.width  = `${obj.w}%`;
  el.textContent = obj.text ?? '';

  el.addEventListener('contextmenu', e => { e.preventDefault(); if (editActive) showNodeContextMenu(e, el, obj); });
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

  line.addEventListener('contextmenu', e => { e.preventDefault(); if (editActive) showNodeContextMenu(e, line, obj); });
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

  el.addEventListener('contextmenu', e => { e.preventDefault(); if (editActive) showNodeContextMenu(e, el, obj); });
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
  // Icon-Bild nach Statuswechsel aktualisieren
  if (el.dataset.iconset) updateNodeIcon(el, label);
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

  // Upload-Prompt: liegt nicht auf dem Canvas – Upload läuft über Toolbar-Button
  // (kein classList-Toggle nötig)

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
  if (!confirm(`"${obj.name ?? obj.object_id}" von der Map entfernen?`)) return;
  await api(`/api/maps/${activeMapId}/objects/${obj.object_id}`, 'DELETE');
  el.remove();
}

/**
 * Kontextmenü für Edit-Mode – Rechtsklick auf beliebiges Objekt.
 */
let _ctxMenu = null;
function showNodeContextMenu(e, el, obj) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.id = 'nv2-ctx-menu';
  menu.className = 'ctx-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top  = `${e.clientY}px`;

  const items = [
    { label: '⤢ Größe ändern', action: () => openResizeDialog(el, obj) },
    { label: '🖼 Iconset wechseln', action: () => openIconsetDialog(el, obj),
      hide: !['host','service','hostgroup','servicegroup','map'].includes(obj.type) },
    { label: '🗑 Entfernen', action: () => removeNode(el, obj), cls: 'ctx-danger' },
  ];

  items.forEach(item => {
    if (item.hide) return;
    const btn = document.createElement('button');
    btn.className = 'ctx-item' + (item.cls ? ' ' + item.cls : '');
    btn.textContent = item.label;
    btn.onclick = () => { closeContextMenu(); item.action(); };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  _ctxMenu = menu;
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}

function closeContextMenu() {
  _ctxMenu?.remove();
  _ctxMenu = null;
}

/**
 * Größe-Dialog: Slider von 16–128px (Nodes) oder 50–200% (alles andere).
 */
function openResizeDialog(el, obj) {
  closeResizeDialog();
  const isNode    = ['host','service','hostgroup','servicegroup','map'].includes(obj.type);
  const isGadget  = obj.type === 'gadget';
  const isLine    = obj.type === 'line';

  const cur = isNode
    ? parseInt(el.style.getPropertyValue('--node-size') || '32')
    : isGadget
    ? parseInt(el.style.getPropertyValue('--gadget-size') || '100')
    : parseInt(el.style.transform?.match(/scale\(([\d.]+)\)/)?.[1] * 100 || '100');

  const panel = document.createElement('div');
  panel.id = 'nv2-resize-panel';
  panel.className = 'resize-panel';

  const rect = el.getBoundingClientRect();
  const cvRect = document.getElementById('nv2-canvas').getBoundingClientRect();
  panel.style.left = `${rect.left - cvRect.left + rect.width + 8}px`;
  panel.style.top  = `${rect.top  - cvRect.top}px`;

  const unit   = isNode ? 'px' : '%';
  const min    = isNode ? 16  : 40;
  const max    = isNode ? 128 : 300;
  const step   = isNode ? 4   : 10;

  panel.innerHTML = `
    <div class="rp-head">
      <span>Größe</span>
      <button class="rp-close" id="rp-close-btn">✕</button>
    </div>
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

  // Live-Preview
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value);
    valLbl.textContent = v + unit;
    applySize(el, obj, v, isNode, isGadget);
  });

  panel.querySelector('#rp-close-btn').onclick  =
  panel.querySelector('#rp-cancel-btn').onclick = () => {
    applySize(el, obj, cur, isNode, isGadget); // revert
    closeResizeDialog();
  };

  panel.querySelector('#rp-ok-btn').onclick = async () => {
    const v = parseInt(slider.value);
    closeResizeDialog();
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/props`, 'PATCH',
      { size: v });
    obj.size = v;
  };
}

function applySize(el, obj, v, isNode, isGadget) {
  if (isNode) {
    el.style.setProperty('--node-size', `${v}px`);
    const ring = el.querySelector('.nv2-ring');
    if (ring) { ring.style.width = `${v}px`; ring.style.height = `${v}px`; }
    const img = el.querySelector('img.nv2-icon');
    if (img)  { img.width = v; img.height = v; }
    const emoji = el.querySelector('.nv2-icon-emoji');
    if (emoji) emoji.style.fontSize = `${Math.round(v * 0.65)}px`;
  } else if (isGadget) {
    el.style.setProperty('--gadget-size', `${v}%`);
    el.style.transform = `scale(${v / 100})`;
    el.style.transformOrigin = 'top left';
  } else {
    const s = v / 100;
    el.style.transform = `scale(${s})`;
    el.style.transformOrigin = 'top left';
  }
}

function closeResizeDialog() {
  document.getElementById('nv2-resize-panel')?.remove();
}

/**
 * Iconset-Dialog: bekannte Sets auswählen oder eigenes hochladen.
 */
function openIconsetDialog(el, obj) {
  const all = [...['std_small','server','router','switch','firewall','database','storage','ups','ap'],
               ...customIconsets];

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
            <img src="assets/icons/${esc(s)}/warning.svg" width="24" height="24" alt="" style="opacity:.7">
            <img src="assets/icons/${esc(s)}/critical.svg" width="24" height="24" alt="" style="opacity:.7">
            <div class="iconset-name">${esc(s)}</div>
          </div>`).join('')}
        <div class="iconset-card iconset-upload" id="iconset-upload-card" title="Eigenes Iconset hochladen">
          <div style="font-size:22px">📂</div>
          <div class="iconset-name">Upload…</div>
          <input type="file" id="iconset-zip-input" accept=".zip" style="display:none">
        </div>
      </div>
      <p class="f-hint" style="margin-top:8px">
        Upload: ZIP mit ok.svg, warning.svg, critical.svg, unknown.svg, down.svg
      </p>
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
      card.classList.add('active');
      selected = card.dataset.set;
    });
  });

  // Upload-Button
  const uploadCard = dlg.querySelector('#iconset-upload-card');
  const zipInput   = dlg.querySelector('#iconset-zip-input');
  uploadCard.addEventListener('click', () => zipInput.click());
  zipInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const setName = file.name.replace(/\.zip$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    // In Demo-Mode: nur registrieren (keine echte Serverübertragung)
    if (!customIconsets.includes(setName)) {
      customIconsets.push(setName);
      localStorage.setItem('nv2-custom-iconsets', JSON.stringify(customIconsets));
    }
    // Karte hinzufügen
    const card = document.createElement('div');
    card.className = 'iconset-card';
    card.dataset.set = setName;
    card.innerHTML = `<div style="font-size:22px">📦</div><div class="iconset-name">${esc(setName)}</div>`;
    card.addEventListener('click', () => {
      dlg.querySelectorAll('.iconset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selected = setName;
    });
    uploadCard.before(card);
    card.click();
  });

  dlg.querySelector('#iconset-cancel').onclick = () => dlg.remove();
  dlg.querySelector('#iconset-ok').onclick = async () => {
    dlg.remove();
    if (selected === cur) return;
    el.dataset.iconset = selected;
    obj.iconset = selected;
    updateNodeIcon(el, hostCache[obj.name]?.state_label ?? null);
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/props`, 'PATCH',
      { iconset: selected });
  };
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
      size:    parseInt(document.getElementById('dlg-iconsize')?.value ?? '32'),
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

// ═══════════════════════════════════════════════════════════════════════
//  MIGRATION – NagVis 1 .cfg Import
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

  // File-Input Listener (einmalig registrieren)
  const inp = document.getElementById('cfg-file-input');
  inp.value = '';
  inp.onchange = e => _migHandleFile(e.target.files[0]);

  // Drag & Drop
  const zone = document.getElementById('cfg-drop-zone');
  zone.ondragover = e => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) _migHandleFile(f);
  };
}

function _migHandleFile(file) {
  if (!file || !file.name.endsWith('.cfg')) {
    document.getElementById('cfg-drop-label').textContent = '⚠ Nur .cfg-Dateien erlaubt';
    return;
  }
  _migFile = file;
  document.getElementById('cfg-drop-label').textContent = `✓ ${file.name}`;
  document.getElementById('mig-btn-ok').disabled = false;
  // Map-ID aus Dateiname vorschlagen
  const suggestedId = file.name.replace(/\.cfg$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const idField = document.getElementById('mig-id');
  if (!idField.value) idField.value = suggestedId;
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

  const form = new FormData();
  form.append('file', _migFile);

  const params = new URLSearchParams({
    map_id:   mapId,
    canvas_w: canvasW,
    canvas_h: canvasH,
    dry_run:  dryRun,
  });

  try {
    const res  = await fetch(`/api/migrate?${params}`, { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) {
      resultBox.textContent = `❌ ${data.detail || 'Fehler beim Import'}`;
      return;
    }

    const lines = [
      dryRun ? '📋 VORSCHAU (nicht gespeichert)' : '✅ Import erfolgreich',
      `Map-ID: ${data.map_id}`,
      `Titel:  ${data.title}`,
      `Objekte: ${data.object_count}`,
      data.skipped  ? `⚠ Übersprungen: ${data.skipped}` : null,
      ...(data.warnings ?? []).map(w => `⚠ ${w.type}.${w.field}: ${w.message}`),
      data.note ? `ℹ ${data.note}` : null,
    ].filter(Boolean);
    resultBox.textContent = lines.join('\n');

    if (!dryRun) {
      // Übersicht neu laden damit neue Map erscheint
      setTimeout(() => {
        closeDlg('dlg-migrate');
        showOverview();
      }, 1800);
    }
  } catch (err) {
    resultBox.textContent = `❌ Netzwerkfehler: ${err.message}`;
  }
}

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
window.dlgMigrate       = dlgMigrate;
window.confirmMigrate   = confirmMigrate;
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
}

function setupDragDrop() {
  const area = document.getElementById('map-area');
  area.addEventListener('dragenter', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragover',  e => { e.preventDefault(); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
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

/**
 * Zeigt kurzen Downtime-Banner oben auf dem Canvas an.
 * started=true → Downtime begonnen, false → Downtime beendet.
 * Blendet sich nach 4s automatisch aus.
 */
let _dtBannerTimer = null;
function showDowntimeBanner(hostNames, started) {
  let banner = document.getElementById('nv2-dt-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'nv2-dt-banner';
    banner.className = 'nv2-dt-banner';
    document.getElementById('nv2-canvas')?.appendChild(banner);
  }
  const verb  = started ? 'Downtime gestartet' : 'Downtime beendet';
  const names = hostNames.slice(0, 3).map(esc).join(', ')
                + (hostNames.length > 3 ? ` +${hostNames.length - 3}` : '');
  banner.textContent = `🔧 ${verb}: ${names}`;
  banner.classList.add('show');

  clearTimeout(_dtBannerTimer);
  _dtBannerTimer = setTimeout(() => banner.classList.remove('show'), 4000);
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
//  DEMO MODE – statische Daten wenn kein Backend erreichbar
//  (VS Code Live Server, file://, GitHub Pages, etc.)
// ═══════════════════════════════════════════════════════════════════════

const DEMO_MAP = {
  "id": "demo-features",
  "title": "NagVis 2 – Feature Demo",
  "background": null,
  "objects": [
    { "object_id": "host::srv-web-01::abc123", "type": "host", "name": "srv-web-01",
      "x": 15, "y": 20, "iconset": "server", "label": "Webserver 01 (OK)" },
    { "object_id": "host::srv-db-01::def456", "type": "host", "name": "srv-db-01",
      "x": 35, "y": 20, "iconset": "database", "label": "Datenbank (ACK + DT)" },
    { "object_id": "service::srv-web-01::HTTP Response Time", "type": "service",
      "host_name": "srv-web-01", "name": "HTTP Response Time",
      "x": 15, "y": 35, "iconset": "default", "label": "HTTP (CRITICAL)" },
    { "object_id": "hostgroup::webservers", "type": "hostgroup", "name": "webservers",
      "x": 55, "y": 20, "iconset": "default", "label": "Alle Webserver" },
    { "object_id": "textbox::zone-a", "type": "textbox",
      "text": "Zone A – Produktion", "x": 8, "y": 8, "w": 18, "h": 5,
      "font_size": 16, "bold": true, "color": "#0ea5e9", "bg_color": "rgba(14,165,233,0.08)" },
    { "object_id": "line::connection-1", "type": "line",
      "x": 30, "y": 30, "x2": 70, "y2": 70,
      "line_style": "dashed", "line_width": 2, "color": "#475569" },
    { "object_id": "container::network-plan", "type": "container",
      "x": 75, "y": 10, "w": 20, "h": 15,
      "url": "https://placehold.co/400x200/1e293b/0ea5e9/png?text=Netzwerk+Plan" },
    { "object_id": "map::datacenter-b", "type": "map", "name": "datacenter-b",
      "x": 75, "y": 35, "iconset": "map", "label": "Datacenter B (nested)" },
    { "object_id": "gadget::cpu-01", "type": "gadget", "x": 25, "y": 50,
      "gadget_config": { "type": "radial", "metric": "cpu_usage", "value": 42,
        "unit": "%", "min": 0, "max": 100, "warning": 70, "critical": 90 },
      "label": "CPU Load" },
    { "object_id": "gadget::memory-01", "type": "gadget", "x": 45, "y": 50,
      "gadget_config": { "type": "linear", "metric": "memory_used", "value": 82,
        "unit": "%", "min": 0, "max": 100, "warning": 75, "critical": 90 },
      "label": "RAM" },
    { "object_id": "gadget::traffic-spark", "type": "gadget", "x": 25, "y": 65,
      "gadget_config": { "type": "sparkline", "metric": "ifOutOctets", "value": 68,
        "history": [45,52,61,58,72,68,80,75,62,68,55,70,65,78,82,60,68,74,71,69] },
      "label": "Outbound Traffic" },
    { "object_id": "gadget::backbone-flow", "type": "gadget", "x": 50, "y": 65,
      "gadget_config": { "type": "weather", "metric": "traffic_1g", "value": 920, "unit": "Mbps" },
      "label": "Backbone 1 Gbit/s" }
  ]
};

const DEMO_STATUS = [
  { name: "srv-web-01",  state: 0, state_label: "UP",       acknowledged: false, in_downtime: false,
    output: "PING OK - 1.4ms", services_ok: 8, services_warn: 0, services_crit: 1, services_unkn: 0 },
  { name: "srv-db-01",   state: 0, state_label: "UP",       acknowledged: true,  in_downtime: true,
    output: "PING OK - 0.8ms", services_ok: 5, services_warn: 1, services_crit: 0, services_unkn: 0 },
  { name: "srv-backup",  state: 1, state_label: "DOWN",     acknowledged: false, in_downtime: false,
    output: "Connection refused", services_ok: 0, services_warn: 0, services_crit: 3, services_unkn: 0 },
  { name: "srv-monitor", state: 0, state_label: "UP",       acknowledged: false, in_downtime: false,
    output: "PING OK - 2.1ms", services_ok: 12, services_warn: 2, services_crit: 0, services_unkn: 0 },
];

/** true wenn wir im statischen Modus laufen (kein FastAPI erreichbar) */
let _demoMode = false;
let _demoMaps = [
  { id: "demo-features", title: "NagVis 2 – Feature Demo", background: null, object_count: DEMO_MAP.objects.length }
];

/**
 * Prüft beim Start ob das Backend erreichbar ist.
 * Wenn nicht → Demo-Modus aktivieren.
 */
async function detectDemoMode() {
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(1500) });
    if (r.ok) { _demoMode = false; return; }
  } catch { /* kein Backend */ }
  _demoMode = true;
  console.info('[NV2] Kein Backend gefunden – Demo-Modus aktiv');
  setSidebarLive(true, 'Demo-Modus · kein Backend');
  setStatusBar('Demo-Modus · statische Daten');
  document.getElementById('nv2-conn-dot').className = 'conn-dot connected';
}

/** Demo-WebSocket-Ersatz: simuliert Snapshots + periodische Status-Updates */
function makeDemoWsClient(mapId) {
  let _interval = null;
  let _dead = false;

  return {
    mapId, ws: null, _dead: false,

    connect() {
      if (this._dead) return;
      // Sofortiger Snapshot
      setTimeout(() => {
        if (this._dead) return;
        onWsMsg({ event: 'snapshot', ts: Date.now() / 1000,
          hosts: DEMO_STATUS, services: [] });
        onWsOpen();
      }, 200);

      // Alle 8s simulierter Status-Update mit zufälliger Änderung
      _interval = setInterval(() => {
        if (this._dead) { clearInterval(_interval); return; }
        const changed = DEMO_STATUS[Math.floor(Math.random() * DEMO_STATUS.length)];
        const states  = ['UP', 'UP', 'UP', 'DOWN', 'WARNING'];
        const newState = states[Math.floor(Math.random() * states.length)];
        const fake = { ...changed, state_label: newState,
          output: newState === 'UP' ? 'PING OK' : 'Check failed',
          change_type: 'state_change' };
        onWsMsg({ event: 'status_update', ts: Date.now() / 1000,
          elapsed: Math.floor(Math.random() * 30) + 5,
          hosts: [fake], services: [] });
      }, 8000);
    },

    forceRefresh() {
      onWsMsg({ event: 'snapshot', ts: Date.now() / 1000,
        hosts: DEMO_STATUS, services: [] });
    },

    disconnect() {
      this._dead = true;
      clearInterval(_interval);
    },
  };
}


// ═══════════════════════════════════════════════════════════════════════
//  API WRAPPER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Im Demo-Modus werden API-Calls gegen die lokalen DEMO_*-Objekte
 * aufgelöst. Im normalen Betrieb wird fetch() verwendet.
 */
async function api(path, method = 'GET', body = null) {

  // ── DEMO-MODUS ──────────────────────────────────────────────
  if (_demoMode) {
    // GET /api/maps
    if (path === '/api/maps' && method === 'GET')
      return [..._demoMaps];

    // GET /api/maps/:id
    const mGet = path.match(/^\/api\/maps\/([\w-]+)$/);
    if (mGet && method === 'GET') {
      if (mGet[1] === 'demo-features') return JSON.parse(JSON.stringify(DEMO_MAP));
      return null;
    }

    // POST /api/maps
    if (path === '/api/maps' && method === 'POST') {
      const id  = body.map_id || body.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const map = { id, title: body.title, background: null, objects: [] };
      _demoMaps.push({ ...map, object_count: 0 });
      return { ...map };
    }

    // DELETE /api/maps/:id
    const mDel = path.match(/^\/api\/maps\/([\w-]+)$/);
    if (mDel && method === 'DELETE') {
      _demoMaps = _demoMaps.filter(m => m.id !== mDel[1]);
      return true;
    }

    // POST /api/maps/:id/objects
    const mObj = path.match(/^\/api\/maps\/([\w-]+)\/objects$/);
    if (mObj && method === 'POST') {
      const obj = { ...body,
        object_id: `${body.type}::${body.name || ''}::${Math.random().toString(36).slice(2, 8)}` };
      const map = _demoMaps.find(m => m.id === mObj[1]);
      if (map) map.object_count = (map.object_count || 0) + 1;
      return obj;
    }

    // PATCH pos/size/props + DELETE object → still response
    if (method === 'PATCH' || (method === 'DELETE' && path.includes('/objects/')))
      return method === 'DELETE' ? true : body;

    // GET /api/health
    if (path === '/api/health')
      return { status: 'ok', demo_mode: true };

    console.warn('[NV2] Demo: unhandled API call', method, path);
    return null;
  }

  // ── NORMALER MODUS ───────────────────────────────────────────
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