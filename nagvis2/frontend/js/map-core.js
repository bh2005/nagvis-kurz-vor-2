// NagVis 2 – map-core.js
// Maps laden & rendern (Sidebar + Overview), openMap, showOverview,
// Canvas-Modus (free/ratio/fixed/background), Hintergrundbild,
// Objekt-Dialog, Map-Dialoge (Neu/Umbenennen/Parent/Canvas),
// Verbindungs-Dialog, Export / ZIP-Import / NagVis-1-Migration.
'use strict';

//  MAPS LADEN & RENDERN
// ═══════════════════════════════════════════════════════════════════════

// Globale Map-Liste – wird von openMap / topbar-Nav genutzt
window._allMaps = [];

// ── Sidebar-Suche ─────────────────────────────────────────────────────
window._sidebarQuery = '';

window.filterSidebarMaps = function(query) {
  window._sidebarQuery = (query || '').trim().toLowerCase();
  renderSidebarMaps(window._allMaps);
  _renderSidebarObjResults();
};

/** Objekt-Suche: passende Objekte der aktiven Map in der Sidebar anzeigen */
function _renderSidebarObjResults() {
  const sec  = document.getElementById('sidebar-obj-section');
  const res  = document.getElementById('sidebar-obj-results');
  if (!sec || !res) return;

  const q    = window._sidebarQuery;
  const objs = window.activeMapCfg?.objects;

  if (!q || !objs?.length) {
    sec.style.display = 'none';
    res.style.display = 'none';
    return;
  }

  const TYPE_ABBR = {
    host:'host', service:'svc', hostgroup:'hgrp',
    servicegroup:'sgrp', map:'map', line:'line',
    textbox:'txt', gadget:'gadget', shape:'shp',
  };

  const matches = objs.filter(o => {
    return [o.name, o.host_name, o.label, o.text]
      .filter(Boolean)
      .some(c => c.toLowerCase().includes(q));
  }).slice(0, 20);

  if (!matches.length) {
    sec.style.display = 'none';
    res.style.display = 'none';
    return;
  }

  sec.style.display = '';
  res.style.display = '';
  res.innerHTML = matches.map(o => {
    const name  = o.host_name || o.name || o.label || o.text || o.type;
    const badge = TYPE_ABBR[o.type] ?? o.type;
    return `<div class="map-entry sidebar-obj-entry"
                 data-obj-id="${esc(o.object_id)}" title="${esc(name)}">
      <div class="map-pip unkn"></div>
      <span class="map-entry-title">${esc(name)}</span>
      <span class="sidebar-obj-type">${esc(badge)}</span>
    </div>`;
  }).join('');

  res.querySelectorAll('.sidebar-obj-entry').forEach(entry => {
    entry.addEventListener('click', () => _focusMapObject(entry.dataset.objId));
  });
}

/** Scrollt zum Objekt auf dem Canvas und pulsiert es kurz an */
function _focusMapObject(objectId) {
  const el = document.getElementById(`nv2-${objectId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('obj-search-highlight'); // Reset falls bereits aktiv
  // Force reflow so die Animation neu startet
  void el.offsetWidth;
  el.classList.add('obj-search-highlight');
  setTimeout(() => el.classList.remove('obj-search-highlight'), 2200);
}

async function loadMaps() {
  const maps = await api('/api/maps') ?? [];
  window._allMaps = maps;
  renderSidebarMaps(maps);
  renderOverview(maps);
}

// Sortiert Maps hierarchisch: Root, dann Kinder des Roots, dann nächster Root …
function _sortMapsHierarchically(maps) {
  const byId     = Object.fromEntries(maps.map(m => [m.id, m]));
  const byParent = {};
  maps.filter(m => m.parent_map && byId[m.parent_map]).forEach(m => {
    (byParent[m.parent_map] ??= []).push(m);
  });
  const roots  = maps.filter(m => !m.parent_map || !byId[m.parent_map]);
  const result = [];
  for (const root of roots) {
    result.push({ ...root, _depth: 0 });
    for (const child of (byParent[root.id] ?? [])) {
      result.push({ ...child, _depth: 1 });
    }
  }
  return result;
}

function _mapEntryHtml(m, favs) {
  const isFav = favs.has(m.id);
  return `
    <div class="map-entry${m._depth ? ' map-entry-child' : ''}" id="smap-${esc(m.id)}"
         data-map-id="${esc(m.id)}" data-title="${esc(m.title)}">
      ${m._depth ? '<span class="map-entry-indent">↳</span>' : ''}
      <div class="map-pip unkn" id="mpip-${esc(m.id)}" title="${esc(m.title)}"></div>
      <span class="map-entry-title">${esc(m.title)}</span>
      <button class="map-fav-btn${isFav ? ' active' : ''}"
              title="${isFav ? 'Aus Favoriten entfernen' : 'Als Favorit markieren'}"
              onclick="event.stopPropagation(); toggleMapFav('${esc(m.id)}')">★</button>
    </div>`;
}

function renderSidebarMaps(maps) {
  const el = document.getElementById('sidebar-maps');

  // ── Suchfilter anwenden ──────────────────────────────────────────
  const q       = window._sidebarQuery || '';
  const display = q
    ? maps.filter(m => m.title.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
    : maps;

  if (!display.length) {
    const msg = q ? t('no_search_results') : t('no_maps');
    el.innerHTML = `<div style="padding:5px 10px 5px 20px;font-size:11px;color:var(--text-dim)">${msg}</div>`;
    renderMapsSnapin(maps);
    return;
  }

  const sorted = _sortMapsHierarchically(display);
  const favs   = _getFavs();

  let html = '';
  if (!q) {
    // Normale Ansicht: Favoriten oben, dann alle
    const favMaps  = sorted.filter(m => favs.has(m.id));
    const restMaps = sorted.filter(m => !favs.has(m.id));
    if (favMaps.length) {
      html += '<div class="sidebar-favs-hdr">★ Favoriten</div>';
      html += favMaps.map(m => _mapEntryHtml(m, favs)).join('');
      if (restMaps.length) html += '<div class="sidebar-favs-hdr sidebar-favs-hdr--all">Alle Maps</div>';
    }
    html += restMaps.map(m => _mapEntryHtml(m, favs)).join('');
  } else {
    // Suchansicht: flache Liste ohne Favoriten-Gruppierung
    html += sorted.map(m => _mapEntryHtml(m, favs)).join('');
  }

  el.innerHTML = html;
  el.querySelectorAll('.map-entry').forEach(entry => {
    entry.addEventListener('click', () => openMap(entry.dataset.mapId));
  });

  renderMapsSnapin(maps);
}

function renderMapsSnapin(maps) {
  const body = document.getElementById('body-maps');
  if (!body) return;
  if (!maps.length) {
    body.innerHTML = `<div class="empty-hint">${t('no_maps')}</div>`;
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

// ── Map-Favoriten ─────────────────────────────────────────────────────
const _FAV_KEY = 'nv2-map-favs';
function _getFavs()       { try { return new Set(JSON.parse(localStorage.getItem(_FAV_KEY)) || []); } catch { return new Set(); } }
function _saveFavs(set)   { localStorage.setItem(_FAV_KEY, JSON.stringify([...set])); }

window.toggleMapFav = function(mapId) {
  const favs = _getFavs();
  if (favs.has(mapId)) favs.delete(mapId); else favs.add(mapId);
  _saveFavs(favs);
  renderSidebarMaps(window._allMaps);
  renderOverview(window._allMaps);
};

// ── Vorschaubild-HTML für eine Map-Karte ──────────────────────────────
function _thumbHtml(m) {
  // Thumbnail (generiertes Vorschaubild) hat Vorrang vor Hintergrundbild
  const imgUrl = m.thumbnail || m.background;
  if (imgUrl) {
    // Cache-Buster damit neu generierte Thumbnails sofort erscheinen
    const src = imgUrl + (imgUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    return `<div class="ov-thumb" style="background-image:url('${src}')"></div>`;
  }
  // Placeholder je nach Canvas-Modus
  const mode = m.canvas?.mode ?? 'free';
  if (mode === 'osm') {
    return `<div class="ov-thumb"><span class="ov-thumb-ico">🗺</span></div>`;
  }
  // Free / Ratio / Fixed: Gitternetz-Placeholder
  return `<div class="ov-thumb"><div class="ov-thumb-grid"></div></div>`;
}

function renderOverview(maps) {
  const grid   = document.getElementById('ov-grid');
  const sorted = _sortMapsHierarchically(maps);
  const byId   = Object.fromEntries(maps.map(m => [m.id, m]));

  const favs  = _getFavs();
  const cards = sorted.map(m => {
    const parentTitle = m.parent_map ? (byId[m.parent_map]?.title ?? m.parent_map) : null;
    const isFav = favs.has(m.id);
    return `
    <div class="ov-card${m._depth ? ' ov-card-child' : ''}" data-map-id="${esc(m.id)}" data-title="${esc(m.title)}"
         data-canvas="${esc(JSON.stringify(m.canvas ?? {}))}">
      ${_thumbHtml(m)}
      <div class="ov-card-header">
        <div class="ov-card-title">${esc(m.title)}</div>
        <button class="ov-fav-btn${isFav ? ' active' : ''}"
                title="${isFav ? 'Aus Favoriten entfernen' : 'Als Favorit markieren'}"
                onclick="event.stopPropagation(); toggleMapFav('${esc(m.id)}')">★</button>
        <button class="ov-card-menu-btn" data-map-id="${esc(m.id)}"
                title="Map-Optionen" onclick="event.stopPropagation(); openCardMenu(event, '${esc(m.id)}', '${esc(m.title)}', this.closest('.ov-card').dataset.canvas)">⋯</button>
      </div>
      <div class="ov-card-meta">${t('objects_count', { count: m.object_count ?? 0 })} · <span class="ov-card-id">${esc(m.id)}</span></div>
      ${parentTitle ? `<div class="ov-card-parent">↳ ${esc(parentTitle)}</div>` : ''}
      <div class="ov-card-pills" id="ov-pills-${esc(m.id)}">
        ${_pillsHtml(m.id)}
      </div>
    </div>`;
  }).join('');

  grid.innerHTML = cards + `
    <div class="ov-new" id="ov-btn-new-map">
      <span style="font-size:18px;line-height:1">＋</span> ${t('new_map_card')}
    </div>`;

  grid.querySelectorAll('.ov-card').forEach(card => {
    card.addEventListener('click', () => openMap(card.dataset.mapId));
    card.addEventListener('contextmenu', e => {
      e.preventDefault();
      openCardMenu(e, card.dataset.mapId, card.dataset.title, card.dataset.canvas);
    });
  });
  const btnNewMap = document.getElementById('ov-btn-new-map');
  if (btnNewMap) {
    btnNewMap.addEventListener('click', dlgNewMap);
    const _role = window.nv2Auth?.currentUser?.role ?? 'viewer';
    const _rank = { viewer: 1, editor: 2, admin: 3 }[_role] ?? 1;
    btnNewMap.style.display = _rank >= 2 ? '' : 'none';
  }
}

function openCardMenu(e, mapId, mapTitle, canvasJson) {
  closeCardMenu();
  let canvasCfg = {};
  try { canvasCfg = JSON.parse(canvasJson ?? '{}'); } catch { /* ignore */ }
  const canvasArg = JSON.stringify(canvasCfg).replace(/"/g, '&quot;');

  const menu = document.createElement('div');
  menu.id = 'card-ctx-menu';
  menu.className = 'ctx-menu';
  // Menü bleibt im Viewport (Rechts-Überlauf vermeiden)
  const x = Math.min(e.clientX, window.innerWidth  - 200);
  const y = Math.min(e.clientY + 4, window.innerHeight - 220);
  menu.style.cssText = `position:fixed;top:${y}px;left:${x}px`;
  menu.innerHTML = `
    <button class="ctx-item" onclick="closeCardMenu(); openMap('${esc(mapId)}')">${t('ctx_open')}</button>
    <div class="ctx-sep"></div>
    <button class="ctx-item" onclick="closeCardMenu(); _renameMapId='${esc(mapId)}';
      document.getElementById('rename-map-title').value='${esc(mapTitle)}';
      openDlg('dlg-rename-map')">${t('ctx_rename')}</button>
    <button class="ctx-item" onclick="closeCardMenu(); _parentMapId='${esc(mapId)}'; openParentMapDlg()">
      ${t('ctx_set_parent')}</button>
    <button class="ctx-item" onclick="closeCardMenu(); openCanvasModeDialog('${esc(mapId)}', '${esc(mapTitle)}', ${canvasArg})">
      ${t('ctx_change_canvas')}</button>
    <div class="ctx-sep"></div>
    <button class="ctx-item" onclick="closeCardMenu(); exportMapById('${esc(mapId)}')">
      ${t('ctx_export_zip')}</button>
    <button class="ctx-item" onclick="closeCardMenu(); cloneMap('${esc(mapId)}', '${esc(mapTitle)} – Kopie').then(() => {})">
      ${t('ctx_duplicate')}</button>
    <button class="ctx-item ctx-danger"
      onclick="closeCardMenu(); _deleteMapId='${esc(mapId)}'; _deleteMapTitle='${esc(mapTitle)}'; confirmDeleteMapById()">
      ${t('ctx_delete')}</button>`;
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', closeCardMenu, { once: true }), 0);
}

function closeCardMenu() {
  document.getElementById('card-ctx-menu')?.remove();
}


async function openMap(mapId, { skipHistory = false } = {}) {
  if (!skipHistory) history.pushState({ mapId }, '', `#/map/${mapId}`);
  activeMapId  = mapId;
  activeMapCfg = await api(`/api/maps/${mapId}`);
  if (!activeMapCfg) { showToast(t('map_not_found'), 'error'); return; }
  window.NV2_HISTORY?.clear();

  document.getElementById('app')?.classList.add('map-open');
  if (sidebarCollapsed) {
    document.getElementById('app').style.gridTemplateColumns = '44px 1fr';
  } else {
    document.getElementById('app').style.gridTemplateColumns = 'var(--sidebar) 1fr';
    document.getElementById('app')?.classList.add('sidebar-expanded');
  }
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
    `${t('objects_count', { count: activeMapCfg.objects?.length ?? 0 })} · ${mapId}`;
  _renderTopbarNav(mapId, activeMapCfg.parent_map);

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

  const isOsm = activeMapCfg.canvas?.mode === 'osm';
  const osmEl  = document.getElementById('osm-map');

  // Vorherigen OSM-Modus aufräumen (falls vorher aktiv)
  if (window.NV2_OSM?.isActive()) NV2_OSM.destroy();

  if (isOsm) {
    canvas.style.display = 'none';
    if (osmEl) {
      osmEl.style.display = 'block';
      void osmEl.offsetHeight; // Reflow erzwingen, damit Leaflet korrekte Containermaße liest
    }
    if (window.NV2_OSM) {
      NV2_OSM.init(activeMapCfg.canvas, activeMapCfg.objects ?? []);
      // Sicherheits-Invalidate nach erstem Paint (falls Container noch 0×0 war)
      setTimeout(() => { if (window.NV2_OSM?.isActive()) NV2_OSM.invalidate(); }, 80);
    }
    initLayers([]);
  } else {
    canvas.style.display = '';
    if (osmEl) osmEl.style.display = 'none';
    for (const obj of activeMapCfg.objects ?? []) {
      const el = createNode(obj);
      if (el && obj.layer != null) el.dataset.layer = obj.layer;
    }
    initLayers(activeMapCfg.objects ?? []);
  }

  // Gruppen-Caches laden wenn entsprechende Nodes auf der Map sind
  const hasHgNodes = (activeMapCfg.objects ?? []).some(o => o.type === 'hostgroup');
  const hasSgNodes = (activeMapCfg.objects ?? []).some(o => o.type === 'servicegroup');
  if (hasHgNodes) loadHostgroups();
  if (hasSgNodes) loadServicegroups();
  _renderSidebarObjResults(); // Objekte-Suche für die neue Map aktualisieren

  if (wsClient) {
    wsClient._dead = true;
    wsClient.ws?.close();
  }
  // Demo-Modus: echten WS nutzen wenn Backend erreichbar (alle Hosts inkl. Europa/AppStack)
  wsClient = (_demoMode && !_backendReachable) ? makeDemoWsClient(mapId) : makeWsClient(mapId);
  wsClient.connect();

  const zoomControls = document.getElementById('nv2-zoom-controls');
  if (isOsm) {
    if (zoomControls) zoomControls.style.display = 'none';
    if (window.NV2_ZOOM) NV2_ZOOM.destroy();
  } else {
    if (zoomControls) zoomControls.style.display = 'flex';
    if (window.NV2_ZOOM) {
      NV2_ZOOM.reset();
      NV2_ZOOM.init(canvas, wrapper);
    }
  }
}

// ── Map-Thumbnail generieren und hochladen ─────────────────────────────
// Wird synchron aufgerufen bevor Canvas versteckt wird – liest DOM-Positionen
// sofort, führt den async Upload danach im Hintergrund durch.
function _captureThumbnail(mapId) {
  if (!mapId || !activeMapCfg) return;
  // OSM-Modus: Leaflet-Canvas nicht trivial erfassbar → überspringen
  if (activeMapCfg.canvas?.mode === 'osm') return;

  const canvasEl = document.getElementById('nv2-canvas');
  if (!canvasEl) return;
  const canvasRect = canvasEl.getBoundingClientRect();
  if (!canvasRect.width || !canvasRect.height) return;

  // Node-Positionen + Status synchron lesen (DOM noch sichtbar)
  const nodes = [];
  document.querySelectorAll('#map-canvas-wrapper .nv2-node').forEach(node => {
    const r  = node.getBoundingClientRect();
    const nx = (r.left + r.width  / 2 - canvasRect.left) / canvasRect.width;
    const ny = (r.top  + r.height / 2 - canvasRect.top)  / canvasRect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return; // außerhalb Canvas
    let status = 'unknown';
    if      (node.classList.contains('nv2-ok'))       status = 'ok';
    else if (node.classList.contains('nv2-warning'))  status = 'warning';
    else if (node.classList.contains('nv2-critical')) status = 'critical';
    else if (node.classList.contains('nv2-down'))     status = 'down';
    nodes.push({ nx, ny, status });
  });

  const bg = activeMapCfg.background ?? null;
  _buildAndUploadThumb(mapId, bg, nodes);
}

async function _buildAndUploadThumb(mapId, bg, nodes) {
  const W = 320, H = 180;
  const offscreen = document.createElement('canvas');
  offscreen.width = W; offscreen.height = H;
  const ctx = offscreen.getContext('2d');

  // Hintergrundfarbe (CSS-Variable auslesen)
  const bgColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--canvas-bg').trim() || '#1a1a2e';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Gitternetz (wie #map-area::before)
  const gridColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--canvas-grid').trim() || 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= W; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Hintergrundbild laden falls vorhanden
  if (bg) {
    await new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => { ctx.drawImage(img, 0, 0, W, H); resolve(); };
      img.onerror = resolve;
      img.src = bg;
    });
  }

  // Nodes als farbige Punkte mit Glow
  const STATUS_COLORS = {
    ok: '#4caf50', warning: '#ff9800', critical: '#f44336',
    down: '#f44336', unknown: '#78909c',
  };
  nodes.forEach(({ nx, ny, status }) => {
    const x = nx * W, y = ny * H;
    const color = STATUS_COLORS[status] || '#78909c';
    ctx.shadowColor = color;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  offscreen.toBlob(async blob => {
    if (!blob) return;
    const fd = new FormData();
    fd.append('file', blob, 'thumbnail.png');
    try {
      const r = await fetch(`/api/maps/${mapId}/thumbnail`, { method: 'POST', body: fd });
      if (!r.ok) return;
      const data = await r.json();
      const thumbUrl = data.url;
      if (!thumbUrl) return;
      // Karte in der Übersicht sofort aktualisieren (kein Reload nötig)
      const card = document.querySelector(`.ov-card[data-map-id="${mapId}"]`);
      if (!card) return;
      const thumbEl = card.querySelector('.ov-thumb');
      if (!thumbEl) return;
      const src = thumbUrl + '?t=' + Date.now();
      thumbEl.style.backgroundImage = `url('${src}')`;
      thumbEl.innerHTML = '';  // Placeholder-Inhalt (Grid/Icon) entfernen
    } catch { /* best-effort */ }
  }, 'image/png');
}

function showOverview({ skipHistory = false } = {}) {
  // Thumbnail erfassen bevor Canvas versteckt wird
  if (activeMapId) _captureThumbnail(activeMapId);

  if (!skipHistory) history.pushState(null, '', '#/');
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
  document.getElementById('tb-sub')  .textContent = t('select_a_map');
  const _tnav = document.getElementById('tb-nav'); if (_tnav) _tnav.innerHTML = '';
  document.getElementById('nav-btn-overview').classList.add('active');
  document.querySelectorAll('.map-entry').forEach(e => e.classList.remove('active'));

  if (wsClient) { wsClient._dead = true; wsClient.ws?.close(); wsClient = null; }
  closeSnapin(activeSnapin);
  hostCache = {};
  serviceCache = {};
  activeMapId = null;
  window.activeMapCfg = null;
  if (editActive) toggleEdit();
  _renderSidebarObjResults();   // Objekte-Sektion zurücksetzen
  window.NV2_MINIMAP?.reset();  // Minimap schließen

  const zoomControls = document.getElementById('nv2-zoom-controls');
  if (zoomControls) zoomControls.style.display = 'none';
  if (window.NV2_ZOOM) NV2_ZOOM.destroy();
  if (window.NV2_OSM?.isActive()) NV2_OSM.destroy();
  const _osmEl = document.getElementById('osm-map');
  if (_osmEl) _osmEl.style.display = 'none';
  document.getElementById('nv2-canvas').style.display = '';

  loadMaps();
}

window.showOverview = showOverview;

// Topbar-Navigation: Eltern-Link (Kind-Map) oder Kind-Chips (Root-Map)
function _renderTopbarNav(mapId, parentMapId) {
  const el = document.getElementById('tb-nav');
  if (!el) return;
  if (parentMapId) {
    // Diese Map hat einen Elternteil → Link nach oben anzeigen
    const parent = _allMaps.find(m => m.id === parentMapId);
    const title  = parent?.title ?? parentMapId;
    el.innerHTML = `<button class="tb-nav-up" onclick="openMap('${esc(parentMapId)}')"
      title="Zur Eltern-Map: ${esc(title)}">↑ ${esc(title)}</button>`;
  } else {
    // Root-Map → Kind-Maps als Chips anzeigen
    const children = _allMaps.filter(m => m.parent_map === mapId);
    el.innerHTML = children.map(c =>
      `<button class="tb-nav-child" onclick="openMap('${esc(c.id)}')"
        title="${esc(c.title)}">↳ ${esc(c.title)}</button>`
    ).join('');
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  STATUS-PILLS – Helper
// ═══════════════════════════════════════════════════════════════════════

function _pillsHtml(mapId) {
  const c = mapStatusCache[mapId];
  if (!c) return `
    <span class="ov-card-pill ok">UP –</span>
    <span class="ov-card-pill warn">W –</span>
    <span class="ov-card-pill crit">C –</span>`;
  return `
    <span class="ov-card-pill ok">UP ${c.ok}</span>
    <span class="ov-card-pill warn">W ${c.warn}</span>
    <span class="ov-card-pill crit ${c.crit > 0 ? 'has-crit' : ''}">C ${c.crit}</span>`;
}

function _updateOverviewCardPills(mapId, counts) {
  const el = document.getElementById(`ov-pills-${mapId}`);
  if (!el) return;
  el.innerHTML = `
    <span class="ov-card-pill ok">UP ${counts.ok}</span>
    <span class="ov-card-pill warn">W ${counts.warn}</span>
    <span class="ov-card-pill crit ${counts.crit > 0 ? 'has-crit' : ''}">C ${counts.crit}</span>`;
}

function _updateSidebarPip(mapId, counts) {
  const pip = document.getElementById(`mpip-${mapId}`);
  if (!pip) return;
  let cls = 'map-pip ';
  if (counts.crit > 0)      cls += 'crit';
  else if (counts.warn > 0) cls += 'warn';
  else if (counts.ok > 0)   cls += 'ok';
  else                      cls += 'unkn';
  pip.className = cls;
}

window._updateOverviewCardPills = _updateOverviewCardPills;
window._updateSidebarPip        = _updateSidebarPip;


// ═══════════════════════════════════════════════════════════════════════
//  HOSTGROUP-CACHE – laden und befüllen
// ═══════════════════════════════════════════════════════════════════════

async function loadHostgroups() {
  const groups = await api('/api/hostgroups') ?? [];
  hostgroupCache = {};
  for (const g of groups) {
    hostgroupCache[g.name] = g.members ?? [];
  }
  if (typeof _applyHostgroupStatuses === 'function') _applyHostgroupStatuses();
}

async function loadServicegroups() {
  const groups = await api('/api/servicegroups') ?? [];
  servicegroupCache = {};
  for (const g of groups) {
    servicegroupCache[g.name] = g.members ?? [];
  }
  if (typeof _applyServicegroupStatuses === 'function') _applyServicegroupStatuses();
}

window.loadHostgroups    = loadHostgroups;
window.loadServicegroups = loadServicegroups;


// ═══════════════════════════════════════════════════════════════════════
//  DIALOGE
// ═══════════════════════════════════════════════════════════════════════

window._activeObjType = 'host';

function selectObjType(type) {
  _activeObjType = type;
  document.querySelectorAll('.type-chip').forEach(c => c.classList.toggle('active', c.dataset.type === type));
  const monTypes = ['host','hostgroup','servicegroup','map'];
  const _sf = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? 'block' : 'none'; };
  _sf('dlg-fields-monitoring', monTypes.includes(type));
  _sf('dlg-fields-service',    type === 'service');
  _sf('dlg-fields-textbox',    type === 'textbox');
  _sf('dlg-fields-line',       type === 'line');
  _sf('dlg-fields-container',  type === 'container');
  _sf('dlg-fields-gadget',     type === 'gadget');
  _sf('dlg-fields-zone',       type === 'zone');
  const lbl = { host:'Hostname', hostgroup:'Gruppenname', servicegroup:'Gruppenname', map:'Map-ID' };
  const nameLabel = document.getElementById('dlg-name-label');
  if (nameLabel) nameLabel.textContent = lbl[type] ?? 'Name';

  // Datalist je Typ mit passenden Namen befüllen
  const dl = document.getElementById('known-hosts');
  if (!dl) return;
  if (type === 'hostgroup') {
    dl.innerHTML = Object.keys(hostgroupCache).map(n => `<option value="${esc(n)}">`).join('');
  } else if (type === 'servicegroup') {
    dl.innerHTML = Object.keys(servicegroupCache).map(n => `<option value="${esc(n)}">`).join('');
    // Falls Cache leer: Servicegruppen nachladen
    if (!Object.keys(servicegroupCache).length) {
      loadServicegroups().then(() => {
        dl.innerHTML = Object.keys(servicegroupCache).map(n => `<option value="${esc(n)}">`).join('');
      });
    }
  } else if (type === 'host') {
    // wird durch fillHostDatalist() gesetzt – keine Änderung nötig
  }
}

async function confirmAddObject() {
  const type = _activeObjType;
  const pos  = pendingPos ?? { x: (15 + Math.random() * 70).toFixed(1), y: (15 + Math.random() * 70).toFixed(1) };
  let payload = { type, x: parseFloat(pos.x), y: parseFloat(pos.y) };

  if (type === 'service') {
    const hostName  = document.getElementById('dlg-svc-host').value.trim();
    const svcName   = document.getElementById('dlg-svc-name').value.trim();
    const perfLabel = document.getElementById('dlg-svc-perf-label').value.trim();
    if (!hostName || !svcName) { document.getElementById(!hostName ? 'dlg-svc-host' : 'dlg-svc-name').focus(); return; }
    Object.assign(payload, { name: svcName, host_name: hostName, iconset: 'default', label: document.getElementById('dlg-svc-label').value.trim() || svcName, ...(perfLabel ? { perf_label: perfLabel } : {}) });
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
  } else if (type === 'gadget') {
    const metric = document.getElementById('dlg-gadget-metric').value.trim() || 'Gadget';
    Object.assign(payload, {
      label: metric,
      gadget_config: { type: 'radial', value: 0, unit: '%', min: 0, max: 100, warning: 70, critical: 90, metric },
    });
  } else if (type === 'zone') {
    Object.assign(payload, {
      text: document.getElementById('dlg-zone-text')?.value.trim() || '',
      bg_color: 'rgba(80,80,80,0.18)',
      border_color: '#888888',
      border_width: 2,
      font_size: 13,
      bold: false,
      w: 20,
      h: 12,
    });
  }

  const obj = await api(`/api/maps/${activeMapId}/objects`, 'POST', payload);
  if (obj) {
    const el = createNode(obj);
    if (el && editActive) makeDraggable(el);
    if (type === 'gadget' && el && typeof openGadgetConfigDialog === 'function') {
      openGadgetConfigDialog(el, obj);
    }
    window.NV2_HISTORY?.push({
      type : 'add',
      mapId: activeMapId,
      items: [{ objectId: obj.object_id, fullObj: JSON.parse(JSON.stringify(obj)) }],
    });
  }
  closeDlg('dlg-add-object');
  pendingPos = null;
}

async function confirmNewMap() {
  const title  = document.getElementById('nm-title').value.trim();
  const mapId  = document.getElementById('nm-id').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!title) { document.getElementById('nm-title').focus(); return; }
  const mode   = document.querySelector('input[name="nm-canvas-mode"]:checked')?.value ?? 'free';
  const canvas = {};
  if (mode === 'ratio') { canvas.mode = 'ratio'; canvas.ratio = document.getElementById('nm-ratio').value; }
  else if (mode === 'fixed') { canvas.mode = 'fixed'; canvas.w = parseInt(document.getElementById('nm-fixed-w').value) || 1920; canvas.h = parseInt(document.getElementById('nm-fixed-h').value) || 1080; }
  else if (mode === 'background') { canvas.mode = 'background'; }
  else if (mode === 'osm') {
    canvas.mode = 'osm';
    canvas.lat  = parseFloat(document.getElementById('nm-osm-lat')?.value)  || 51.0;
    canvas.lng  = parseFloat(document.getElementById('nm-osm-lng')?.value)  || 10.0;
    canvas.zoom = parseInt(document.getElementById('nm-osm-zoom')?.value)   || 6;
  }
  else { canvas.mode = 'free'; }
  closeDlg('dlg-new-map');
  const created = await api('/api/maps', 'POST', { title, map_id: mapId, canvas });
  if (created) {
    await loadMaps();
    try { await openMap(created.id); } catch(e) { console.error('[NV2] openMap Fehler:', e); }
    if (!editActive) toggleEdit();
  }
}

async function confirmDeleteMap() {
  if (!activeMapId) return;
  if (!confirm(`Map „${activeMapCfg?.title ?? activeMapId}" wirklich löschen?`)) return;
  await api(`/api/maps/${activeMapId}`, 'DELETE');
  showOverview();
}

window._deleteMapId = null; window._deleteMapTitle = null;
async function confirmDeleteMapById() {
  if (!_deleteMapId) return;
  if (!confirm(`Map „${_deleteMapTitle ?? _deleteMapId}" wirklich löschen?`)) return;
  await api(`/api/maps/${_deleteMapId}`, 'DELETE');
  _deleteMapId = _deleteMapTitle = null;
  await loadMaps();
}

// ─────────────────────────────────────────────────────────────────────
//  COPY OBJECTS TO ANOTHER MAP
// ─────────────────────────────────────────────────────────────────────

/** Öffnet den Dialog "Auf andere Map kopieren" für die übergebenen Object-IDs */
window.openCopyToMapDlg = function(objectIds) {
  if (!objectIds?.length) return;
  window._copyObjectIds = objectIds;

  // Dropdown mit allen Maps außer der aktuellen befüllen
  const sel = document.getElementById('copy-target-map-sel');
  if (!sel) return;
  const others = (window._allMaps ?? []).filter(m => m.id !== activeMapId);
  if (!others.length) {
    showToast('Keine andere Map vorhanden', 'warn');
    return;
  }
  sel.innerHTML = others.map(m =>
    `<option value="${esc(m.id)}">${esc(m.title)} (${esc(m.id)})</option>`
  ).join('');

  const info = document.getElementById('copy-to-map-info');
  if (info) info.textContent = `${objectIds.length} Objekt${objectIds.length !== 1 ? 'e' : ''} werden kopiert.`;

  // Overlay anzeigen
  const dlg = document.getElementById('dlg-copy-to-map');
  if (dlg) dlg.style.display = 'flex';
};

/** Führt den Kopier-Vorgang aus */
window.execCopyToMap = async function() {
  const sel       = document.getElementById('copy-target-map-sel');
  const targetId  = sel?.value;
  const objectIds = window._copyObjectIds ?? [];
  if (!targetId || !objectIds.length) return;

  const targetMap = (window._allMaps ?? []).find(m => m.id === targetId);
  const objects   = objectIds.map(id =>
    activeMapCfg?.objects?.find(o => o.object_id === id)
  ).filter(Boolean);

  if (!objects.length) {
    showToast('Keine Objekte gefunden', 'error');
    return;
  }

  const dlg = document.getElementById('dlg-copy-to-map');
  if (dlg) dlg.style.display = 'none';

  const results = await Promise.all(objects.map(o => {
    const { object_id, ...payload } = o; // backend vergibt neue ID
    return api(`/api/maps/${targetId}/objects`, 'POST', payload);
  }));

  const ok = results.filter(Boolean).length;
  const mapTitle = targetMap?.title ?? targetId;
  showToast(`${ok} Objekt${ok !== 1 ? 'e' : ''} nach „${mapTitle}" kopiert`, 'success');
  window._copyObjectIds = [];
};

window.closeCopyToMapDlg = function() {
  const dlg = document.getElementById('dlg-copy-to-map');
  if (dlg) dlg.style.display = 'none';
  window._copyObjectIds = [];
};

function dlgNewMap() {
  // Felder zurücksetzen
  document.getElementById('nm-title').value    = '';
  document.getElementById('nm-id').value       = '';
  document.getElementById('nm-tpl-title').value = '';
  document.getElementById('nm-am-title').value  = '';
  const freeRadio = document.querySelector('input[name="nm-canvas-mode"][value="free"]');
  if (freeRadio) { freeRadio.checked = true; _nmUpdateCanvasFields(); }
  // Immer auf Tab "Leer" starten
  _nmTab('blank');
  // Template-Selektion zurücksetzen
  document.querySelectorAll('.nm-template-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.nm-tpl-opts').forEach(o => o.style.display = 'none');
  const okBtn = document.getElementById('nm-tpl-ok');
  if (okBtn) okBtn.disabled = true;
  openDlg('dlg-new-map');
  setTimeout(() => document.getElementById('nm-title').focus(), 80);
}

function _nmUpdateCanvasFields() {
  const mode = document.querySelector('input[name="nm-canvas-mode"]:checked')?.value ?? 'free';
  document.getElementById('nm-fields-ratio')?.style && (document.getElementById('nm-fields-ratio').style.display      = mode === 'ratio'      ? 'flex'  : 'none');
  document.getElementById('nm-fields-fixed')?.style && (document.getElementById('nm-fields-fixed').style.display      = mode === 'fixed'      ? 'grid'  : 'none');
  document.getElementById('nm-fields-background')?.style && (document.getElementById('nm-fields-background').style.display = mode === 'background' ? 'block' : 'none');
  document.getElementById('nm-fields-osm')?.style && (document.getElementById('nm-fields-osm').style.display         = mode === 'osm'        ? 'block' : 'none');
}
window._nmUpdateCanvasFields = _nmUpdateCanvasFields;


// ═══════════════════════════════════════════════════════════════════════
//  NEUE MAP – TAB-SWITCHING
// ═══════════════════════════════════════════════════════════════════════

window._nmTab = function(tab) {
  ['blank', 'template', 'automap'].forEach(t => {
    document.getElementById(`nm-panel-${t}`).style.display  = t === tab ? '' : 'none';
    document.querySelector(`.nm-tab[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
  });
  if (tab === 'automap') _nmAmPopulateBackends();
};

// ═══════════════════════════════════════════════════════════════════════
//  NEUE MAP – VORLAGE
// ═══════════════════════════════════════════════════════════════════════

window._nmSelectTemplate = function(card) {
  document.querySelectorAll('.nm-template-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  const tpl = card.dataset.tpl;
  document.querySelectorAll('.nm-tpl-opts').forEach(o => o.style.display = 'none');
  const opts = document.getElementById(`nm-tpl-opts-${tpl}`);
  if (opts) opts.style.display = '';
  const okBtn = document.getElementById('nm-tpl-ok');
  if (okBtn) okBtn.disabled = false;
};

window.confirmNewMapFromTemplate = async function() {
  const title = document.getElementById('nm-tpl-title').value.trim();
  if (!title) { document.getElementById('nm-tpl-title').focus(); return; }
  const card = document.querySelector('.nm-template-card.selected');
  if (!card) { showToast('Bitte Vorlage auswählen', 'warn'); return; }
  const tpl = card.dataset.tpl;

  closeDlg('dlg-new-map');

  // Map anlegen
  const created = await api('/api/maps', 'POST', { title, canvas: { mode: 'free' } });
  if (!created) return;
  await loadMaps();

  // Objekte gemäß Vorlage erzeugen
  const mid = created.id;
  const objs = _nmBuildTemplateObjects(tpl);
  for (const o of objs) {
    await api(`/api/maps/${mid}/objects`, 'POST', o);
  }

  try { await openMap(mid); } catch(e) { console.error('[NV2] openMap Fehler:', e); }
  if (!editActive) toggleEdit();
  showToast(`Map aus Vorlage „${tpl}" erstellt`, 'success');
};

function _nmBuildTemplateObjects(tpl) {
  const iconset = 'std_small';
  const STEP = 5;

  if (tpl === 'star') {
    const n      = Math.max(1, parseInt(document.getElementById('nm-tpl-star-count')?.value) || 6);
    const center = document.getElementById('nm-tpl-star-center')?.value.trim() || 'Core';
    const r  = Math.max(STEP * 2, n * STEP);
    const cx = 50 + r, cy = 50 + r;
    const objs = [{ type: 'host', name: center, x: cx, y: cy, iconset, size: 32 }];
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * i / n - Math.PI / 2;
      const hx = Math.round(cx + r * Math.cos(a));
      const hy = Math.round(cy + r * Math.sin(a));
      objs.push({ type: 'host', name: `Host-${String(i + 1).padStart(2, '0')}`,
        x: hx, y: hy, iconset, size: 32 });
      objs.push({ type: 'line', name: '', x: cx + 14, y: cy + 14,
        x2: hx + 14, y2: hy + 14,
        line_type: 'line', line_style: 'solid', line_width: 1 });
    }
    return objs;
  }

  if (tpl === 'hierarchy') {
    const cols = Math.max(1, parseInt(document.getElementById('nm-tpl-hier-children')?.value) || 4);
    const root = document.getElementById('nm-tpl-hier-root')?.value.trim() || 'Gruppe';
    const spX = STEP, spY = STEP * 2, marginX = 50, rootY = 50;
    const rootX = Math.round(marginX + (cols - 1) * spX / 2);
    const objs = [{ type: 'hostgroup', name: root, x: rootX, y: rootY, iconset, size: 32 }];
    for (let i = 0; i < cols; i++) {
      const hx = marginX + i * spX;
      const hy = rootY + spY;
      objs.push({ type: 'host', name: `Host-${String(i + 1).padStart(2, '0')}`,
        x: hx, y: hy, iconset, size: 32 });
      objs.push({ type: 'line', name: '', x: rootX + 14, y: rootY + 14,
        x2: hx + 14, y2: hy + 14,
        line_type: 'line', line_style: 'solid', line_width: 1 });
    }
    return objs;
  }

  if (tpl === 'datacenter') {
    const zoneW    = 40;    // Breite je Zone (Icon-Spalte)
    const zoneGap  = 5;     // Lücke zwischen Zonen
    const startX   = 50;
    const labelY   = 50;
    const firstHostY = labelY + STEP * 2;
    const hostSpY  = STEP;

    const zones = [
      { label: 'DMZ',     hosts: ['FW-01', 'Proxy-01', 'Proxy-02', 'VPN-01'] },
      { label: 'Core',    hosts: ['Core-SW-01', 'Core-SW-02', 'Core-RTR-01', 'Mgmt-01'] },
      { label: 'Storage', hosts: ['NAS-01', 'NAS-02', 'Backup-01', 'iSCSI-01'] },
    ];
    const objs = [];
    zones.forEach((zone, zi) => {
      const zx = startX + zi * (zoneW + zoneGap);
      objs.push({
        type: 'textbox', text: zone.label, x: zx, y: labelY,
        font_size: 12, bold: true, color: '#e0e0e0', bg_color: '#2b2b2b',
      });
      zone.hosts.forEach((name, i) => {
        objs.push({ type: 'host', name, x: zx, y: firstHostY + i * hostSpY, iconset, size: 32 });
      });
    });
    return objs;
  }

  return [];
}


// ═══════════════════════════════════════════════════════════════════════
//  NEUE MAP – AUTO-MAP
// ═══════════════════════════════════════════════════════════════════════

async function _nmAmPopulateBackends() {
  const sel = document.getElementById('nm-am-backend');
  if (!sel) return;
  const backends = await api('/api/backends') ?? [];
  const active = backends.filter(b => b.enabled !== false && b.type !== 'demo');
  sel.innerHTML = '<option value="">— Backend wählen —</option>' +
    active.map(b => `<option value="${esc(b.backend_id)}">${esc(b.backend_id)} (${esc(b.type)})</option>`).join('');
}

window._nmAmBackendChanged = async function() {
  const bid = document.getElementById('nm-am-backend')?.value;
  if (!bid) return;
  const source = document.getElementById('nm-am-source')?.value ?? 'all';
  await _nmAmLoadSources(bid, source);
};

window._nmAmSourceChanged = function() {
  const source = document.getElementById('nm-am-source')?.value ?? 'all';
  const filterRow = document.getElementById('nm-am-filter-row');
  if (filterRow) filterRow.style.display = source === 'all' ? 'none' : '';
  const inp = document.getElementById('nm-am-filter');
  if (inp) {
    if      (source === 'hostgroup')    inp.placeholder = 'z.B. linux_servers';
    else if (source === 'servicegroup') inp.placeholder = 'z.B. http-checks';
    else if (source === 'label')        inp.placeholder = 'z.B. location:berlin';
    else if (source === 'tag')          inp.placeholder = 'z.B. production';
    inp.value = '';
  }
  const bid = document.getElementById('nm-am-backend')?.value;
  if (bid) _nmAmLoadSources(bid, source);
};

async function _nmAmLoadSources(bid, source) {
  const info = document.getElementById('nm-am-info');
  try {
    const data = await api(`/api/maps/automap-sources?backend_id=${encodeURIComponent(bid)}`);
    if (!data) return;

    // Datalist befüllen
    const dl = document.getElementById('nm-am-filter-list');
    if (dl) {
      let opts = [];
      if      (source === 'hostgroup')    opts = data.hostgroups    ?? [];
      else if (source === 'servicegroup') opts = data.servicegroups ?? [];
      else if (source === 'label')        opts = (data.label_keys ?? []).map(k => k + ':');
      dl.innerHTML = opts.map(v => `<option value="${esc(v)}">`).join('');
    }

    if (info) {
      info.style.display = '';
      const parts = [`${data.host_count ?? 0} Hosts`];
      if (data.hostgroups?.length)    parts.push(`${data.hostgroups.length} Hostgruppen`);
      if (data.servicegroups?.length) parts.push(`${data.servicegroups.length} Servicegruppen`);
      info.textContent = parts.join(' · ') + ' verfügbar';
    }
  } catch(e) {
    if (info) { info.style.display = ''; info.textContent = 'Fehler beim Laden der Quellen'; }
  }
}

function _centerAutoMap() {
  const nodes = document.querySelectorAll('#nv2-canvas .nv2-node, #nv2-canvas .nv2-textbox');
  if (!nodes.length) return;
  const clip    = document.getElementById('nv2-canvas');         // Clip-Container (wrapper)
  const mapWrap = document.getElementById('map-canvas-wrapper'); // transformiertes Element
  if (!clip || !mapWrap) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    const x = parseFloat(n.style.left) || 0;
    const y = parseFloat(n.style.top)  || 0;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  });

  // Schwerpunkt in % → Pixel (relativ zu #map-canvas-wrapper)
  const cxPx = (minX + maxX) / 2 / 100 * mapWrap.offsetWidth;
  const cyPx = (minY + maxY) / 2 / 100 * mapWrap.offsetHeight;

  // Pan so dass Schwerpunkt in der Mitte des Clip-Containers liegt
  window.NV2_ZOOM?.setState(1, clip.clientWidth / 2 - cxPx, clip.clientHeight / 2 - cyPx);
}

window.confirmAutoMap = async function() {
  const title     = document.getElementById('nm-am-title')?.value.trim();
  const backendId = document.getElementById('nm-am-backend')?.value;
  const source    = document.getElementById('nm-am-source')?.value ?? 'all';
  const filter    = document.getElementById('nm-am-filter')?.value.trim() ?? '';
  const layout    = document.getElementById('nm-am-layout')?.value ?? 'grid';
  const iconset   = document.getElementById('nm-am-iconset')?.value ?? 'std_small';
  const services  = document.getElementById('nm-am-services')?.checked ?? false;

  if (!title)     { document.getElementById('nm-am-title').focus(); return; }
  if (!backendId) { showToast('Bitte Backend auswählen', 'warn'); return; }
  if (source !== 'all' && !filter) {
    showToast('Bitte Filter-Wert eingeben', 'warn');
    document.getElementById('nm-am-filter')?.focus();
    return;
  }

  closeDlg('dlg-new-map');
  showToast('Auto-Map wird generiert…', 'info');


  const result = await api('/api/maps/auto-generate', 'POST', {
    title, backend_id: backendId, source, filter_value: filter,
    layout, iconset, include_services: services,
    canvas: { mode: 'free' },
  });

  if (!result) return;
  await loadMaps();
  showToast(`${result.objects_created} Objekte erstellt`, 'success');
  try {
    await openMap(result.map.id);
    // Kurz warten bis DOM gerendert, dann auf Inhalt zentrieren
    setTimeout(_centerAutoMap, 80);
  } catch(e) { console.error('[NV2] openMap Fehler:', e); }
};


// ═══════════════════════════════════════════════════════════════════════
//  MAP MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

window._renameMapId = null; window._parentMapId = null;

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
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text)">
          <input type="radio" name="cm-mode" value="osm" ${cfg.mode==='osm'?'checked':''} onchange="_cmUpdate()">
          <span>🗺 <b>OpenStreetMap</b> – interaktive Weltkarte (Leaflet)</span>
        </label>
        <div id="cm-fields-osm" style="padding-left:22px;${cfg.mode==='osm'?'':'display:none'}">
          <div style="margin-bottom:6px">
            <label class="f-label" style="font-size:11px">Tile-Server URL <span style="color:var(--text-dim)">(leer = OpenStreetMap-Standard)</span></label>
            <input class="f-input" id="cm-osm-tile" type="text"
                   value="${esc(cfg.tile_url ?? '')}"
                   placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                   style="font-size:11px;font-family:var(--mono)">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 80px;gap:6px">
            <div>
              <label class="f-label" style="font-size:11px">Start-Breitengrad (Lat)</label>
              <input class="f-input" id="cm-osm-lat" type="number" step="0.001"
                     value="${cfg.lat ?? 51.0}">
            </div>
            <div>
              <label class="f-label" style="font-size:11px">Start-Längengrad (Lng)</label>
              <input class="f-input" id="cm-osm-lng" type="number" step="0.001"
                     value="${cfg.lng ?? 10.0}">
            </div>
            <div>
              <label class="f-label" style="font-size:11px">Zoom</label>
              <input class="f-input" id="cm-osm-zoom" type="number"
                     value="${cfg.zoom ?? 6}" min="1" max="18">
            </div>
          </div>
          <p class="f-hint" style="margin-top:6px">Nodes werden mit Breitengrad (x) / Längengrad (y) positioniert statt x%/y%.</p>
        </div>
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
        <div class="f-label" style="margin-bottom:6px">Node-Verhalten an den Grenzen</div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text)">
          <input type="radio" name="cm-overflow" value="clamp" ${(cfg.overflow??'clamp')==='clamp'?'checked':''}>
          <span>🔒 <b>Begrenzt</b> – Nodes bleiben innerhalb der Canvas-Fläche</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text);margin-top:6px">
          <input type="radio" name="cm-overflow" value="free" ${cfg.overflow==='free'?'checked':''}>
          <span>🌐 <b>Frei</b> – Nodes können außerhalb platziert werden (z.B. für Weltkarte)</span>
        </label>
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
  ['ratio','fixed','background','osm'].forEach(k => {
    const el = document.getElementById(`cm-fields-${k}`);
    if (el) el.style.display = mode === k ? (k === 'fixed' ? 'grid' : 'block') : 'none';
  });
};

window._cmSave = async function(mapId) {
  const mode     = document.querySelector('input[name="cm-mode"]:checked')?.value ?? 'free';
  const overflow = document.querySelector('input[name="cm-overflow"]:checked')?.value ?? 'clamp';
  const canvas = { mode, overflow };
  if (mode === 'ratio') canvas.ratio = document.getElementById('cm-ratio').value;
  if (mode === 'fixed') {
    canvas.w = parseInt(document.getElementById('cm-fixed-w').value) || 1920;
    canvas.h = parseInt(document.getElementById('cm-fixed-h').value) || 1080;
  }
  if (mode === 'osm') {
    const tileVal = document.getElementById('cm-osm-tile')?.value?.trim();
    if (tileVal) canvas.tile_url = tileVal;
    canvas.lat  = parseFloat(document.getElementById('cm-osm-lat')?.value)  || 51.0;
    canvas.lng  = parseFloat(document.getElementById('cm-osm-lng')?.value)  || 10.0;
    canvas.zoom = parseInt(document.getElementById('cm-osm-zoom')?.value)   || 6;
  }
  if (_demoMode) {
    const m = _demoMaps.find(m => m.id === mapId);
    if (m) m.canvas = canvas;
  } else {
    await api(`/api/maps/${mapId}/canvas`, 'PUT', canvas);
  }
  document.getElementById('dlg-canvas-mode')?.remove();
  if (mapId === activeMapId) {
    // Wechsel zu/von OSM erfordert vollständigen Map-Reload
    if (mode === 'osm' || window.NV2_OSM?.isActive()) {
      await openMap(mapId);
    } else if (activeMapCfg) {
      activeMapCfg.canvas = canvas;
      applyCanvasMode(document.getElementById('nv2-canvas'), canvas);
    }
  }
  setStatusBar(`Canvas-Format für „${mapId}" gesetzt: ${mode}`);
};

window.openCanvasModeDialog = openCanvasModeDialog;


window.openCardMenu          = openCardMenu;
window.closeCardMenu         = closeCardMenu;
window.confirmDeleteMapById  = confirmDeleteMapById;


// ═══════════════════════════════════════════════════════════════════════
//  NAGVIS-1 MIGRATION
// ═══════════════════════════════════════════════════════════════════════

window._migFile = null;

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

// Service-Datalist aktualisieren wenn Host im Dienst-Dialog eingetippt wird
document.getElementById('dlg-svc-host')?.addEventListener('input', function () {
  const host = this.value.trim();
  const dl   = document.getElementById('known-svc');
  if (!dl) return;
  const svcs = (host && window.serviceCache?.[host]) ?? [];
  dl.innerHTML = svcs.map(s => `<option value="${esc(s)}">`).join('');
  document.getElementById('known-svc-perf').innerHTML = '';
});

// Perfdata-Metrik-Datalist aktualisieren wenn Service im Dienst-Dialog eingetippt wird
document.getElementById('dlg-svc-name')?.addEventListener('input', function () {
  const host = document.getElementById('dlg-svc-host')?.value.trim() ?? '';
  const svc  = this.value.trim();
  const dl   = document.getElementById('known-svc-perf');
  if (!dl) return;
  const pd = (host && svc && window.perfdataCache?.[`${host}::${svc}`]) ?? null;
  dl.innerHTML = pd
    ? Object.entries(pd).sort(([a],[b]) => a.localeCompare(b))
        .map(([k, m]) => `<option value="${esc(k)}" label="${esc(k)} = ${m.value}${m.unit||''}">`)
        .join('')
    : '';
});

window.confirmAddObject = confirmAddObject;
window.selectObjType    = selectObjType;
window.confirmNewMap    = confirmNewMap;
window.exportActiveMap  = exportActiveMap;
window.exportMapById    = exportMapById;
window.dlgImportZip        = dlgImportZip;
window.confirmImportZip    = confirmImportZip;
window.dlgImportDrawio     = dlgImportDrawio;
window.confirmImportDrawio = confirmImportDrawio;
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

window._zipFile = null;

async function exportActiveMap() {
  if (!activeMapId) return;
  try {
    const res = await fetch(`/api/maps/${activeMapId}/export`);
    if (!res.ok) { const err = await res.json().catch(() => ({})); showToast(`Export fehlgeschlagen: ${err.detail || res.statusText}`, 'error'); return; }
    const cd       = res.headers.get('Content-Disposition') ?? '';
    const match    = cd.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `nagvis2-${activeMapId}.zip`;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch (err) { showToast(`Export fehlgeschlagen: ${err.message}`, 'error'); }
}

async function exportMapById(mapId) {
  if (!mapId) return;
  try {
    const res = await fetch(`/api/maps/${mapId}/export`);
    if (!res.ok) { const err = await res.json().catch(() => ({})); showToast(`Export fehlgeschlagen: ${err.detail || res.statusText}`, 'error'); return; }
    const cd       = res.headers.get('Content-Disposition') ?? '';
    const match    = cd.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `nagvis2-${mapId}.zip`;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch (err) { showToast(`Export fehlgeschlagen: ${err.message}`, 'error'); }
}


// ── Map klonen ──────────────────────────────────────────────────────────────

async function cloneActiveMap() {
  if (!activeMapId) return;
  const srcTitle = activeMapCfg?.title ?? activeMapId;
  const newTitle = prompt(`Klon-Name (Kopie von "${srcTitle}"):`, `${srcTitle} – Kopie`);
  if (!newTitle?.trim()) return;
  await cloneMap(activeMapId, newTitle.trim());
}

async function cloneMap(mapId, newTitle) {
  try {
    const r = await api(`/api/maps/${encodeURIComponent(mapId)}/clone`, 'POST', { title: newTitle });
    if (r === null) return null;  // api() zeigt Toast bei Fehler
    await loadMaps();           // Sidebar + Übersicht aktualisieren
    return r;
  } catch (e) {
    showToast(`Netzwerkfehler: ${e}`, 'error');
    return null;
  }
}

window.cloneActiveMap = cloneActiveMap;
window.cloneMap       = cloneMap;


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
//  draw.io / diagrams.net IMPORT
// ═══════════════════════════════════════════════════════════════════════

let _drawioFile = null;

function dlgImportDrawio() {
  _drawioFile = null;
  document.getElementById('drawio-drop-label').textContent = '🗂 .drawio / .xml-Datei wählen oder hier ablegen';
  document.getElementById('drawio-drop-label').style.color = '';
  document.getElementById('drawio-btn-ok').disabled = true;
  document.getElementById('drawio-result').style.display = 'none';
  document.getElementById('drawio-result').textContent   = '';
  document.getElementById('drawio-title').value    = '';
  document.getElementById('drawio-as-hosts').checked = false;
  openDlg('dlg-drawio-import');

  const inp  = document.getElementById('drawio-file-input');
  inp.value  = '';
  inp.onchange = e => _drawioHandleFile(e.target.files[0]);
  const zone = document.getElementById('drawio-drop-zone');
  zone.ondragover  = e => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0]; if (f) _drawioHandleFile(f);
  };
}

function _drawioHandleFile(file) {
  const lbl  = document.getElementById('drawio-drop-label');
  const name = file?.name?.toLowerCase() ?? '';
  if (!file || (!name.endsWith('.drawio') && !name.endsWith('.xml'))) {
    lbl.textContent = '⚠ Nur .drawio oder .xml-Dateien erlaubt';
    lbl.style.color = 'var(--crit)';
    _drawioFile = null;
    document.getElementById('drawio-btn-ok').disabled = true;
    return;
  }
  _drawioFile = file;
  lbl.textContent = `✓ ${file.name}  (${(file.size / 1024).toFixed(0)} KB)`;
  lbl.style.color = 'var(--ok)';
  document.getElementById('drawio-btn-ok').disabled = false;
  const titleField = document.getElementById('drawio-title');
  if (!titleField.value) {
    titleField.value = file.name.replace(/\.(drawio|xml)$/i, '');
  }
}

async function confirmImportDrawio() {
  if (!_drawioFile) return;
  const title     = document.getElementById('drawio-title').value.trim();
  const asHosts   = document.getElementById('drawio-as-hosts').checked;
  const resultBox = document.getElementById('drawio-result');
  resultBox.style.display = 'block';
  resultBox.style.color   = '';
  resultBox.textContent   = '⏳ Importiere…';
  document.getElementById('drawio-btn-ok').disabled = true;
  try {
    const form = new FormData();
    form.append('file', _drawioFile);
    const params = new URLSearchParams({ as_hosts: asHosts });
    if (title) params.set('title', title);
    const res  = await fetch(`/api/maps/import-drawio?${params}`, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) {
      resultBox.style.color = 'var(--crit)';
      resultBox.textContent = '❌ ' + (data.detail ?? 'Unbekannter Fehler');
      document.getElementById('drawio-btn-ok').disabled = false;
      return;
    }
    const lines = [
      `✅ Import erfolgreich`,
      `Map-ID: ${data.map_id}`,
      `Titel:  ${data.title}`,
      `Objekte importiert: ${data.object_count}`,
      ...(data.warnings ?? []).map(w => `⚠ ${w}`),
    ];
    resultBox.style.color = 'var(--ok)';
    resultBox.textContent = lines.join('\n');
    await loadMaps();
    setTimeout(() => { closeDlg('dlg-drawio-import'); openMap(data.map_id); }, 1800);
  } catch (err) {
    resultBox.style.color = 'var(--crit)';
    resultBox.textContent = `❌ Netzwerkfehler: ${err.message}`;
    document.getElementById('drawio-btn-ok').disabled = false;
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  HINTERGRUNDBILD
// ═══════════════════════════════════════════════════════════════════════

function applyCanvasMode(canvas, cfg) {
  const mode = cfg?.mode ?? 'free';
  if (mode === 'osm') return;  // Leaflet übernimmt Zoom/Pan – kein CSS nötig
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

  // Overflow: frei = Nodes dürfen Canvas verlassen, Zoom/Pan zur Navigation
  const freeOverflow = cfg?.overflow === 'free';
  canvas.style.overflow = freeOverflow ? 'visible' : '';
  const wrapper = document.getElementById('map-canvas-wrapper');
  if (wrapper) wrapper.style.overflow = freeOverflow ? 'visible' : '';
}

async function uploadBg(file) {
  const form = new FormData();
  form.append('file', file);
  try {
    const res  = await fetch(`/api/maps/${activeMapId}/background`, { method:'POST', body:form });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setBg(data.url);
  } catch (err) { showToast(`Upload fehlgeschlagen: ${err.message}`, 'error'); }
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
//  BACKEND MANAGEMENT DIALOG
// ═══════════════════════════════════════════════════════════════════════

function openBackendMgmtDlg() {
  document.getElementById('dlg-backend-mgmt')?.remove();
  const dlg = document.createElement('div');
  dlg.id = 'dlg-backend-mgmt';
  dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:580px;max-height:90vh;display:flex;flex-direction:column;gap:0">
      <h3 style="flex-shrink:0;margin-bottom:14px">Datenquellen verwalten</h3>

      <div class="burger-head" style="padding:0 0 6px 0;flex-shrink:0">Konfigurierte Backends</div>
      <div id="bm-list" style="flex-shrink:0;min-height:42px;max-height:220px;overflow-y:auto;
           border:1px solid var(--border);border-radius:var(--r);margin-bottom:16px">
        <div style="padding:12px;text-align:center;color:var(--text-dim);font-size:12px">Lade…</div>
      </div>

      <div style="overflow-y:auto;flex:1">
        <div class="burger-head" id="bm-form-head" style="padding:0 0 8px 0">Datenquelle hinzufügen</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label class="f-label">Backend-ID <span style="color:var(--crit)">*</span></label>
            <input class="f-input" id="bm-id" type="text" placeholder="z.B. prod-checkmk">
          </div>
          <div>
            <label class="f-label">Typ</label>
            <select class="f-select" id="bm-type" onchange="_bmUpdateFields()">
              <option value="checkmk">Checkmk REST API</option>
              <option value="icinga2">Icinga2 REST API</option>
              <option value="naemon">Naemon (Livestatus / REST)</option>
              <option value="zabbix">Zabbix JSON-RPC API</option>
              <option value="prometheus">Prometheus / VictoriaMetrics</option>
              <option value="solarwinds">SolarWinds Orion (SWIS)</option>
              <option value="livestatus_tcp">Livestatus TCP</option>
              <option value="livestatus_unix">Livestatus Unix-Socket</option>
              <option value="demo">Demo (Musterdaten)</option>
            </select>
          </div>
        </div>

        <div id="bm-fields-checkmk">
          <div style="margin-bottom:8px">
            <label class="f-label">API Base-URL <span style="color:var(--crit)">*</span></label>
            <input class="f-input" id="bm-base-url" type="text"
                   placeholder="https://monitoring.example.com/mysite/check_mk/api/1.0">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label class="f-label">Automation User</label>
              <input class="f-input" id="bm-username" type="text" placeholder="automation" value="automation">
            </div>
            <div>
              <label class="f-label">Passwort / Token</label>
              <input class="f-input" id="bm-secret" type="password" placeholder="••••••••">
            </div>
          </div>
          <div style="margin-bottom:8px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-dim)">
              <input type="checkbox" id="bm-verify-ssl" checked> SSL-Zertifikat prüfen
            </label>
          </div>
        </div>

        <div id="bm-fields-icinga2" style="display:none">
          <div style="margin-bottom:8px">
            <label class="f-label">API Base-URL <span style="color:var(--crit)">*</span></label>
            <input class="f-input" id="bm-icinga2-url" type="text"
                   placeholder="https://icinga2.example.com:5665/v1">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label class="f-label">API-Benutzer</label>
              <input class="f-input" id="bm-icinga2-username" type="text" placeholder="nagvis2" value="nagvis2">
            </div>
            <div>
              <label class="f-label">Passwort</label>
              <input class="f-input" id="bm-icinga2-password" type="password" placeholder="••••••••">
            </div>
          </div>
          <div style="margin-bottom:8px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-dim)">
              <input type="checkbox" id="bm-icinga2-verify-ssl"> SSL-Zertifikat prüfen
            </label>
          </div>
        </div>

        <div id="bm-fields-naemon" style="display:none">
          <div style="margin-bottom:8px">
            <label class="f-label">Verbindungsart</label>
            <select class="f-select" id="bm-naemon-conn" onchange="_bmNaemonUpdateConn()">
              <option value="unix">Unix-Socket (lokal)</option>
              <option value="tcp">Livestatus TCP</option>
              <option value="rest">REST API</option>
            </select>
          </div>
          <div id="bm-naemon-fields-unix">
            <div style="margin-bottom:8px">
              <label class="f-label">Socket-Pfad <span style="color:var(--crit)">*</span></label>
              <input class="f-input" id="bm-naemon-socket" type="text"
                     placeholder="/var/cache/naemon/live" value="/var/cache/naemon/live">
            </div>
          </div>
          <div id="bm-naemon-fields-tcp" style="display:none">
            <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">
              <div>
                <label class="f-label">Host / IP <span style="color:var(--crit)">*</span></label>
                <input class="f-input" id="bm-naemon-host" type="text" placeholder="192.168.1.10">
              </div>
              <div>
                <label class="f-label">Port</label>
                <input class="f-input" id="bm-naemon-port" type="number" value="6558" placeholder="6558">
              </div>
            </div>
          </div>
          <div id="bm-naemon-fields-rest" style="display:none">
            <div style="margin-bottom:8px">
              <label class="f-label">REST API URL <span style="color:var(--crit)">*</span></label>
              <input class="f-input" id="bm-naemon-url" type="text"
                     placeholder="http://naemon-host:8080/naemon/api/v1">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <div>
                <label class="f-label">Benutzer</label>
                <input class="f-input" id="bm-naemon-username" type="text" placeholder="nagvis2" value="nagvis2">
              </div>
              <div>
                <label class="f-label">Passwort</label>
                <input class="f-input" id="bm-naemon-password" type="password" placeholder="••••••••">
              </div>
            </div>
            <div style="margin-bottom:8px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-dim)">
                <input type="checkbox" id="bm-naemon-verify-ssl" checked> SSL-Zertifikat prüfen
              </label>
            </div>
          </div>
        </div>

        <div id="bm-fields-solarwinds" style="display:none">
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label class="f-label">Orion-Server <span style="color:var(--crit)">*</span></label>
              <input class="f-input" id="bm-sw-host" type="text" placeholder="orion.example.com">
            </div>
            <div>
              <label class="f-label">Port</label>
              <input class="f-input" id="bm-sw-port" type="number" value="17778" placeholder="17778">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label class="f-label">Benutzer</label>
              <input class="f-input" id="bm-sw-username" type="text" placeholder="admin" value="admin">
            </div>
            <div>
              <label class="f-label">Passwort</label>
              <input class="f-input" id="bm-sw-password" type="password" placeholder="••••••••">
            </div>
          </div>
          <div style="margin-bottom:8px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-dim)">
              <input type="checkbox" id="bm-sw-verify-ssl"> SSL-Zertifikat prüfen
              <span style="color:var(--text-dim)">(Orion nutzt oft selbst-signierte Certs)</span>
            </label>
          </div>
        </div>

        <div id="bm-fields-zabbix" style="display:none">
          <div style="margin-bottom:8px">
            <label class="f-label">Zabbix URL <span style="color:var(--crit)">*</span></label>
            <input class="f-input" id="bm-zabbix-url" type="text"
                   placeholder="https://zabbix.example.com">
          </div>
          <div style="margin-bottom:8px">
            <label class="f-label">API-Token <span style="color:var(--text-dim)">(Zabbix 6.0+, bevorzugt)</span></label>
            <input class="f-input" id="bm-zabbix-token" type="password" placeholder="••••••••">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label class="f-label">Benutzer <span style="color:var(--text-dim)">(Fallback)</span></label>
              <input class="f-input" id="bm-zabbix-username" type="text" placeholder="Admin" value="Admin">
            </div>
            <div>
              <label class="f-label">Passwort <span style="color:var(--text-dim)">(Fallback)</span></label>
              <input class="f-input" id="bm-zabbix-password" type="password" placeholder="••••••••">
            </div>
          </div>
          <div style="margin-bottom:8px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-dim)">
              <input type="checkbox" id="bm-zabbix-verify-ssl" checked> SSL-Zertifikat prüfen
            </label>
          </div>
        </div>

        <div id="bm-fields-prometheus" style="display:none">
          <div style="margin-bottom:8px">
            <label class="f-label">Prometheus URL <span style="color:var(--crit)">*</span></label>
            <input class="f-input" id="bm-prom-url" type="text"
                   placeholder="http://prometheus:9090">
          </div>
          <div style="margin-bottom:8px">
            <label class="f-label">Bearer Token <span style="color:var(--text-dim)">(optional)</span></label>
            <input class="f-input" id="bm-prom-token" type="password" placeholder="••••••••">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label class="f-label">Benutzer <span style="color:var(--text-dim)">(Basic Auth)</span></label>
              <input class="f-input" id="bm-prom-username" type="text" placeholder="">
            </div>
            <div>
              <label class="f-label">Passwort <span style="color:var(--text-dim)">(Basic Auth)</span></label>
              <input class="f-input" id="bm-prom-password" type="password" placeholder="••••••••">
            </div>
          </div>
          <div style="margin-bottom:8px">
            <label class="f-label">Host-Label <span style="color:var(--text-dim)">(Standard: instance)</span></label>
            <input class="f-input" id="bm-prom-host-label" type="text" placeholder="instance" value="instance">
          </div>
          <div style="margin-bottom:8px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-dim)">
              <input type="checkbox" id="bm-prom-verify-ssl" checked> SSL-Zertifikat prüfen
            </label>
          </div>
        </div>

        <div id="bm-fields-tcp" style="display:none">
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label class="f-label">Host / IP <span style="color:var(--crit)">*</span></label>
              <input class="f-input" id="bm-host" type="text" placeholder="192.168.1.10">
            </div>
            <div>
              <label class="f-label">Port</label>
              <input class="f-input" id="bm-port" type="number" value="6557" placeholder="6557">
            </div>
          </div>
        </div>

        <div id="bm-fields-unix" style="display:none">
          <div style="margin-bottom:8px">
            <label class="f-label">Socket-Pfad <span style="color:var(--crit)">*</span></label>
            <input class="f-input" id="bm-socket" type="text"
                   placeholder="/omd/sites/mysite/tmp/run/live">
          </div>
        </div>

        <div id="bm-fields-ls-common" style="display:none">
          <div style="margin-bottom:8px">
            <label class="f-label">Checkmk Web-URL <span style="color:var(--text-dim);font-weight:normal">(optional)</span></label>
            <input class="f-input" id="bm-ls-web-url" type="text"
                   placeholder="http://hostname/sitename/check_mk">
            <div style="font-size:11px;color:var(--text-dim);margin-top:3px">
              Ermöglicht Links aus dem Status-Panel direkt in die Checkmk-Oberfläche.
            </div>
          </div>
        </div>

        <div style="margin-bottom:12px">
          <label class="f-label">Timeout (Sekunden)</label>
          <input class="f-input" id="bm-timeout" type="number" value="15" min="1" max="60"
                 style="width:80px">
        </div>

        <div id="bm-probe-result" style="display:none;margin-bottom:10px;padding:8px;
             background:var(--bg);border-radius:var(--r);font-size:11px;
             font-family:var(--mono);border:1px solid var(--border)"></div>

        <div style="display:flex;gap:8px">
          <button class="btn-cancel" style="flex:1" onclick="_bmProbe()">🔌 Testen</button>
          <button class="btn-cancel" id="bm-cancel-btn" style="flex:1;display:none" onclick="_bmCancelEdit()">✕ Abbrechen</button>
          <button class="btn-ok"     id="bm-save-btn" style="flex:2" onclick="_bmAdd()">＋ Hinzufügen</button>
        </div>
      </div>

      <div class="dlg-actions" style="flex-shrink:0;margin-top:12px">
        <button class="btn-cancel" onclick="document.getElementById('dlg-backend-mgmt').remove()">Schließen</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
  _bmLoad();
}

async function _bmLoad() {
  const list = document.getElementById('bm-list');
  if (!list) return;
  const backends = await api('/api/backends', 'GET');
  if (!backends?.length) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-dim);font-size:12px">Keine Backends konfiguriert</div>';
    return;
  }
  const typeColor = t => t === 'checkmk'
    ? 'background:rgba(59,130,246,.15);color:#3b82f6'
    : t === 'demo'
      ? 'background:rgba(168,85,247,.15);color:#a855f7'
      : 'background:rgba(16,185,129,.15);color:#10b981';
  list.innerHTML = backends.map((b, i) => {
    const disabled = b.enabled === false;
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;
         border-bottom:${i < backends.length - 1 ? '1px solid var(--border)' : 'none'};
         opacity:${disabled ? '0.5' : '1'}">
      <div id="bm-dot-${esc(b.backend_id)}"
           style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${disabled ? 'var(--text-dim)' : 'var(--text-dim)'}"
           title="${disabled ? 'Deaktiviert' : 'Noch nicht getestet'}"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--text)">
          ${esc(b.backend_id)}
          <span style="font-size:9px;margin-left:6px;padding:1px 5px;border-radius:3px;
                       font-family:var(--mono);${typeColor(b.type)}">${esc(b.type)}</span>
          ${disabled ? '<span style="font-size:9px;margin-left:4px;color:var(--text-dim)">(inaktiv)</span>' : ''}
        </div>
        <div style="font-size:10px;color:var(--text-dim);font-family:var(--mono);margin-top:1px;
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(b.address || '')}${b.username ? ' · ' + esc(b.username) : ''}
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="manage-btn" title="${disabled ? 'Aktivieren' : 'Deaktivieren'}"
                onclick="_bmToggle('${esc(b.backend_id)}', ${disabled})">${disabled ? '▶' : '⏸'}</button>
        <button class="manage-btn" title="Bearbeiten"
                onclick="_bmEditLoad('${esc(b.backend_id)}')">✎</button>
        <button class="manage-btn" title="Verbindung testen" ${disabled ? 'disabled style="opacity:.4;cursor:default"' : ''}
                onclick="${disabled ? '' : `_bmTestExisting('${esc(b.backend_id)}')`}">🔌</button>
        <button class="manage-btn manage-btn-danger" title="Entfernen"
                onclick="_bmRemove('${esc(b.backend_id)}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function _bmNaemonUpdateConn() {
  const c = document.getElementById('bm-naemon-conn')?.value;
  document.getElementById('bm-naemon-fields-unix').style.display = c === 'unix' ? '' : 'none';
  document.getElementById('bm-naemon-fields-tcp').style.display  = c === 'tcp'  ? '' : 'none';
  document.getElementById('bm-naemon-fields-rest').style.display = c === 'rest' ? '' : 'none';
}

function _bmUpdateFields() {
  const t = document.getElementById('bm-type')?.value;
  document.getElementById('bm-fields-checkmk').style.display    = t === 'checkmk'          ? '' : 'none';
  document.getElementById('bm-fields-icinga2').style.display    = t === 'icinga2'           ? '' : 'none';
  document.getElementById('bm-fields-naemon').style.display     = t === 'naemon'            ? '' : 'none';
  document.getElementById('bm-fields-solarwinds').style.display = t === 'solarwinds'        ? '' : 'none';
  document.getElementById('bm-fields-zabbix').style.display     = t === 'zabbix'            ? '' : 'none';
  document.getElementById('bm-fields-prometheus').style.display = t === 'prometheus'        ? '' : 'none';
  document.getElementById('bm-fields-tcp').style.display        = t === 'livestatus_tcp'   ? '' : 'none';
  document.getElementById('bm-fields-unix').style.display       = t === 'livestatus_unix'  ? '' : 'none';
  const isLs = t === 'livestatus_tcp' || t === 'livestatus_unix';
  document.getElementById('bm-fields-ls-common').style.display  = isLs ? '' : 'none';
  // Demo hat keine Verbindungsfelder
  const timeoutRow = document.getElementById('bm-timeout')?.closest('div[style]');
  if (timeoutRow) timeoutRow.style.display = t === 'demo' ? 'none' : '';
}

async function _bmTestExisting(backendId) {
  const dot = document.getElementById(`bm-dot-${backendId}`);
  if (dot) { dot.style.background = 'var(--warn)'; dot.title = 'Teste…'; }
  const result = await api(`/api/backends/${encodeURIComponent(backendId)}/test`, 'POST', {});
  if (dot) {
    dot.style.background = result?.reachable ? 'var(--ok)' : 'var(--crit)';
    dot.title = result?.reachable ? `OK · ${result.latency_ms}ms` : (result?.error || 'Nicht erreichbar');
  }
  showToast(
    result?.reachable ? `✓ ${backendId} erreichbar · ${result.latency_ms}ms` : `✗ ${backendId}: ${result?.error || 'Fehler'}`,
    result?.reachable ? 'ok' : 'error'
  );
}

async function _bmRemove(backendId) {
  if (!confirm(`Backend "${backendId}" wirklich entfernen?`)) return;
  const ok = await api(`/api/backends/${encodeURIComponent(backendId)}`, 'DELETE');
  if (ok !== null) {
    showToast(`Backend "${backendId}" entfernt`, 'warn');
    _bmLoad();
  }
}

function _bmBuildEntry() {
  const id   = document.getElementById('bm-id')?.value.trim();
  const type = document.getElementById('bm-type')?.value;
  if (!id) { showToast('Backend-ID fehlt', 'warn'); return null; }
  const timeout = parseFloat(document.getElementById('bm-timeout')?.value || '15');
  const base = { backend_id: id, type, timeout, enabled: true };

  if (type === 'demo') {
    return { backend_id: id, type: 'demo', enabled: true };
  }
  if (type === 'checkmk') {
    const url = document.getElementById('bm-base-url')?.value.trim();
    if (!url) { showToast('API Base-URL fehlt', 'warn'); return null; }
    return {
      ...base,
      base_url:   url,
      username:   document.getElementById('bm-username')?.value.trim() || 'automation',
      secret:     document.getElementById('bm-secret')?.value || '',
      verify_ssl: document.getElementById('bm-verify-ssl')?.checked ?? true,
    };
  }
  if (type === 'icinga2') {
    const url = document.getElementById('bm-icinga2-url')?.value.trim();
    if (!url) { showToast('API Base-URL fehlt', 'warn'); return null; }
    return {
      ...base,
      base_url:   url,
      username:   document.getElementById('bm-icinga2-username')?.value.trim() || 'nagvis2',
      password:   document.getElementById('bm-icinga2-password')?.value || '',
      verify_ssl: document.getElementById('bm-icinga2-verify-ssl')?.checked ?? false,
    };
  }
  if (type === 'naemon') {
    const conn = document.getElementById('bm-naemon-conn')?.value || 'unix';
    if (conn === 'unix') {
      const sock = document.getElementById('bm-naemon-socket')?.value.trim();
      if (!sock) { showToast('Socket-Pfad fehlt', 'warn'); return null; }
      return { ...base, conn_type: 'unix', socket_path: sock };
    }
    if (conn === 'tcp') {
      const host = document.getElementById('bm-naemon-host')?.value.trim();
      if (!host) { showToast('Host / IP fehlt', 'warn'); return null; }
      return { ...base, conn_type: 'tcp', host, port: parseInt(document.getElementById('bm-naemon-port')?.value || '6558') };
    }
    // rest
    const url = document.getElementById('bm-naemon-url')?.value.trim();
    if (!url) { showToast('REST API URL fehlt', 'warn'); return null; }
    return {
      ...base,
      conn_type:  'rest',
      base_url:   url,
      username:   document.getElementById('bm-naemon-username')?.value.trim() || 'nagvis2',
      password:   document.getElementById('bm-naemon-password')?.value || '',
      verify_ssl: document.getElementById('bm-naemon-verify-ssl')?.checked ?? true,
    };
  }
  if (type === 'solarwinds') {
    const host = document.getElementById('bm-sw-host')?.value.trim();
    if (!host) { showToast('Orion-Server fehlt', 'warn'); return null; }
    return {
      ...base,
      host:       host,
      port:       parseInt(document.getElementById('bm-sw-port')?.value || '17778'),
      username:   document.getElementById('bm-sw-username')?.value.trim() || 'admin',
      password:   document.getElementById('bm-sw-password')?.value || '',
      verify_ssl: document.getElementById('bm-sw-verify-ssl')?.checked ?? false,
    };
  }
  if (type === 'zabbix') {
    const url = document.getElementById('bm-zabbix-url')?.value.trim();
    if (!url) { showToast('Zabbix URL fehlt', 'warn'); return null; }
    return {
      ...base,
      url:        url,
      token:      document.getElementById('bm-zabbix-token')?.value || '',
      username:   document.getElementById('bm-zabbix-username')?.value.trim() || 'Admin',
      password:   document.getElementById('bm-zabbix-password')?.value || '',
      verify_ssl: document.getElementById('bm-zabbix-verify-ssl')?.checked ?? true,
    };
  }
  if (type === 'prometheus') {
    const url = document.getElementById('bm-prom-url')?.value.trim();
    if (!url) { showToast('Prometheus URL fehlt', 'warn'); return null; }
    return {
      ...base,
      url:        url,
      token:      document.getElementById('bm-prom-token')?.value || '',
      username:   document.getElementById('bm-prom-username')?.value.trim() || '',
      password:   document.getElementById('bm-prom-password')?.value || '',
      host_label: document.getElementById('bm-prom-host-label')?.value.trim() || 'instance',
      verify_ssl: document.getElementById('bm-prom-verify-ssl')?.checked ?? true,
    };
  }
  if (type === 'livestatus_tcp') {
    const host = document.getElementById('bm-host')?.value.trim();
    if (!host) { showToast('Host / IP fehlt', 'warn'); return null; }
    const web_url = document.getElementById('bm-ls-web-url')?.value.trim() || '';
    return { ...base, host, port: parseInt(document.getElementById('bm-port')?.value || '6557'), web_url };
  }
  if (type === 'livestatus_unix') {
    const sock = document.getElementById('bm-socket')?.value.trim();
    if (!sock) { showToast('Socket-Pfad fehlt', 'warn'); return null; }
    const web_url = document.getElementById('bm-ls-web-url')?.value.trim() || '';
    return { ...base, socket_path: sock, web_url };
  }
  return null;
}

async function _bmProbe() {
  const body = _bmBuildEntry();
  if (!body) return;
  const res = document.getElementById('bm-probe-result');
  res.style.display = '';
  res.style.color   = 'var(--text-dim)';
  res.textContent   = '⏳ Teste Verbindung…';
  const result = await api('/api/backends/probe', 'POST', body);
  if (result?.reachable) {
    res.textContent = `✓ Verbindung erfolgreich · ${result.latency_ms}ms`;
    res.style.color = 'var(--ok)';
  } else {
    res.textContent = `✗ ${result?.error || 'Nicht erreichbar'}`;
    res.style.color = 'var(--crit)';
  }
}

let _bmEditId = null;  // null = Neu-Modus, string = Edit-Modus

async function _bmAdd() {
  const body = _bmBuildEntry();
  if (!body) return;

  if (_bmEditId !== null) {
    // Update: PATCH (delete + re-add unter ggf. neuer ID)
    const result = await api(`/api/backends/${encodeURIComponent(_bmEditId)}`, 'PATCH', body);
    if (result) {
      showToast(`Datenquelle "${body.backend_id}" gespeichert`, 'ok');
      _bmCancelEdit();
      _bmLoad();
      api('/api/backends').then(list => { if (Array.isArray(list)) window.backendList = list; }).catch(() => {});
    }
  } else {
    // Neu anlegen
    const result = await api('/api/backends', 'POST', body);
    if (result) {
      showToast(`Datenquelle "${body.backend_id}" hinzugefügt`, 'ok');
      _bmClearForm();
      _bmLoad();
      api('/api/backends').then(list => { if (Array.isArray(list)) window.backendList = list; }).catch(() => {});
    }
  }
}

async function _bmToggle(backendId, currentlyDisabled) {
  const enable = currentlyDisabled;  // invert: if currently disabled, we enable
  const result = await api(`/api/backends/${encodeURIComponent(backendId)}/enabled`, 'PUT', { enabled: enable });
  if (result !== null) {
    showToast(
      enable ? `Datenquelle "${backendId}" aktiviert` : `Datenquelle "${backendId}" deaktiviert`,
      enable ? 'ok' : 'warn'
    );
    _bmLoad();
  }
}

function _bmClearForm() {
  [
    'bm-id', 'bm-base-url', 'bm-username', 'bm-secret',
    'bm-icinga2-url', 'bm-icinga2-username', 'bm-icinga2-password',
    'bm-naemon-socket', 'bm-naemon-host', 'bm-naemon-url', 'bm-naemon-username', 'bm-naemon-password',
    'bm-sw-host', 'bm-sw-username', 'bm-sw-password',
    'bm-zabbix-url', 'bm-zabbix-token', 'bm-zabbix-username', 'bm-zabbix-password',
    'bm-prom-url', 'bm-prom-token', 'bm-prom-username', 'bm-prom-password', 'bm-prom-host-label',
    'bm-host', 'bm-socket', 'bm-ls-web-url',
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'bm-username')              el.value = 'automation';
    else if (id === 'bm-icinga2-username') el.value = 'nagvis2';
    else if (id === 'bm-naemon-socket')    el.value = '/var/cache/naemon/live';
    else if (id === 'bm-naemon-username')  el.value = 'nagvis2';
    else if (id === 'bm-naemon-port')      el.value = '6558';
    else if (id === 'bm-sw-username')      el.value = 'admin';
    else if (id === 'bm-zabbix-username')  el.value = 'Admin';
    else if (id === 'bm-prom-host-label')  el.value = 'instance';
    else el.value = '';
  });
  const i2ssl = document.getElementById('bm-icinga2-verify-ssl');
  if (i2ssl) i2ssl.checked = false;
  const naemonSsl = document.getElementById('bm-naemon-verify-ssl');
  if (naemonSsl) naemonSsl.checked = true;
  const swSsl = document.getElementById('bm-sw-verify-ssl');
  if (swSsl) swSsl.checked = false;
  const zbssl = document.getElementById('bm-zabbix-verify-ssl');
  if (zbssl) zbssl.checked = true;
  const portEl = document.getElementById('bm-port');
  if (portEl) portEl.value = '6557';
  const naemonPortEl = document.getElementById('bm-naemon-port');
  if (naemonPortEl) naemonPortEl.value = '6558';
  const swPortEl = document.getElementById('bm-sw-port');
  if (swPortEl) swPortEl.value = '17778';
  const naemonConn = document.getElementById('bm-naemon-conn');
  if (naemonConn) { naemonConn.value = 'unix'; _bmNaemonUpdateConn(); }
  document.getElementById('bm-probe-result').style.display = 'none';
}

function _bmCancelEdit() {
  _bmEditId = null;
  const btn = document.getElementById('bm-save-btn');
  const lbl = document.getElementById('bm-form-head');
  const cnl = document.getElementById('bm-cancel-btn');
  if (btn) btn.textContent = '＋ Hinzufügen';
  if (lbl) lbl.textContent = 'Datenquelle hinzufügen';
  if (cnl) cnl.style.display = 'none';
  _bmClearForm();
}

async function _bmEditLoad(backendId) {
  const cfg = await api(`/api/backends/${encodeURIComponent(backendId)}`, 'GET');
  if (!cfg) return;
  _bmEditId = backendId;

  // Typ setzen + Felder einblenden
  const typeEl = document.getElementById('bm-type');
  if (typeEl) { typeEl.value = cfg.type; _bmUpdateFields(); }

  // Felder befüllen
  const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val ?? ''; };
  set('bm-id',       cfg.backend_id);
  set('bm-base-url', cfg.base_url);
  set('bm-username', cfg.username || 'automation');
  set('bm-secret',   cfg.secret);
  set('bm-host',        cfg.host);
  set('bm-port',        cfg.port || 6557);
  set('bm-socket',      cfg.socket_path);
  set('bm-ls-web-url',  cfg.web_url);

  // Icinga2-spezifische Felder
  set('bm-icinga2-url',      cfg.base_url);
  set('bm-icinga2-username', cfg.username || 'nagvis2');
  set('bm-icinga2-password', cfg.password);
  const i2ssl = document.getElementById('bm-icinga2-verify-ssl');
  if (i2ssl) i2ssl.checked = cfg.verify_ssl === true;

  // Naemon-spezifische Felder
  const naemonConn = document.getElementById('bm-naemon-conn');
  if (naemonConn) { naemonConn.value = cfg.conn_type || 'unix'; _bmNaemonUpdateConn(); }
  set('bm-naemon-socket',   cfg.socket_path || '/var/cache/naemon/live');
  set('bm-naemon-host',     cfg.host);
  set('bm-naemon-port',     cfg.port || 6558);
  set('bm-naemon-url',      cfg.base_url);
  set('bm-naemon-username', cfg.username || 'nagvis2');
  set('bm-naemon-password', cfg.password);
  const naemonSsl = document.getElementById('bm-naemon-verify-ssl');
  if (naemonSsl) naemonSsl.checked = cfg.verify_ssl !== false;

  // SolarWinds-spezifische Felder
  set('bm-sw-host',     cfg.host);
  set('bm-sw-port',     cfg.port || 17778);
  set('bm-sw-username', cfg.username || 'admin');
  set('bm-sw-password', cfg.password);
  const swSsl = document.getElementById('bm-sw-verify-ssl');
  if (swSsl) swSsl.checked = cfg.verify_ssl === true;

  // Zabbix-spezifische Felder
  set('bm-zabbix-url',      cfg.url);
  set('bm-zabbix-token',    cfg.token);
  set('bm-zabbix-username', cfg.username || 'Admin');
  set('bm-zabbix-password', cfg.password);
  const zbssl = document.getElementById('bm-zabbix-verify-ssl');
  if (zbssl) zbssl.checked = cfg.verify_ssl !== false;

  // Prometheus-spezifische Felder
  set('bm-prom-url',        cfg.url);
  set('bm-prom-token',      cfg.token);
  set('bm-prom-username',   cfg.username || '');
  set('bm-prom-password',   cfg.password);
  set('bm-prom-host-label', cfg.host_label || 'instance');
  const promssl = document.getElementById('bm-prom-verify-ssl');
  if (promssl) promssl.checked = cfg.verify_ssl !== false;

  const timeoutEl = document.getElementById('bm-timeout');
  if (timeoutEl) timeoutEl.value = cfg.timeout ?? 15;
  const sslEl = document.getElementById('bm-verify-ssl');
  if (sslEl) sslEl.checked = cfg.verify_ssl !== false;

  // Buttons umschalten
  const btn = document.getElementById('bm-save-btn');
  const lbl = document.getElementById('bm-form-head');
  const cnl = document.getElementById('bm-cancel-btn');
  if (btn) btn.textContent = '💾 Speichern';
  if (lbl) lbl.textContent = `Backend bearbeiten: ${backendId}`;
  if (cnl) cnl.style.display = 'inline-flex';
}


// ═══════════════════════════════════════════════════════════════════════

window.showOverview          = showOverview;
window.openCardMenu          = openCardMenu;
window.closeCardMenu         = closeCardMenu;
window.openRenameMapDlg      = openRenameMapDlg;
window.confirmRenameMap      = confirmRenameMap;
window.openParentMapDlg      = openParentMapDlg;
window.confirmSetParentMap   = confirmSetParentMap;
window.openManageMapsOverlay = openManageMapsOverlay;
window.openCanvasModeDialog  = openCanvasModeDialog;
window.confirmAddObject      = confirmAddObject;
window.selectObjType         = selectObjType;
window.confirmNewMap         = confirmNewMap;
window.exportActiveMap       = exportActiveMap;
window.exportMapById         = exportMapById;
window.dlgImportZip          = dlgImportZip;
window.confirmImportZip      = confirmImportZip;
window.dlgNewMap             = dlgNewMap;
window.dlgMigrate            = dlgMigrate;
window.confirmMigrate        = confirmMigrate;
window.confirmDeleteMapById  = confirmDeleteMapById;
window._nmUpdateCanvasFields = _nmUpdateCanvasFields;
window._cmUpdate             = _cmUpdate;
window._cmSave               = _cmSave;
window.openBackendMgmtDlg   = openBackendMgmtDlg;
window._bmUpdateFields      = _bmUpdateFields;
window._bmTestExisting      = _bmTestExisting;
window._bmRemove            = _bmRemove;
window._bmProbe             = _bmProbe;
window._bmAdd               = _bmAdd;
window._bmEditLoad          = _bmEditLoad;
window._bmCancelEdit        = _bmCancelEdit;
window._bmToggle            = _bmToggle;