// NagVis 2 – map-core.js
// Maps laden & rendern (Sidebar + Overview), openMap, showOverview,
// Canvas-Modus (free/ratio/fixed/background), Hintergrundbild,
// Objekt-Dialog, Map-Dialoge (Neu/Umbenennen/Parent/Canvas),
// Verbindungs-Dialog, Export / ZIP-Import / NagVis-1-Migration.
'use strict';

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
//  DIALOGE
// ═══════════════════════════════════════════════════════════════════════

window._activeObjType = 'host';

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

window._deleteMapId = null, _deleteMapTitle = null;
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

window._renameMapId = null, _parentMapId = null;

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

window._zipFile = null;

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

window.showOverview          = showOverview;
window.openCardMenu          = openCardMenu;
window.closeCardMenu         = closeCardMenu;
window.openRenameMapDlg      = openRenameMapDlg;
window.confirmRenameMap      = confirmRenameMap;
window.openParentMapDlg      = openParentMapDlg;
window.confirmSetParentMap   = confirmSetParentMap;
window.openManageMapsOverlay = openManageMapsOverlay;
window.openCanvasModeDialog  = openCanvasModeDialog;
window.openConnectionsDlg    = openConnectionsDlg;
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