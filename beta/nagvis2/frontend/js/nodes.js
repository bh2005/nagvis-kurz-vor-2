// NagVis 2 – nodes.js
// Node-Rendering (host/service/textbox/line/container/gadget),
// Weathermap-Linien, Layer-System, Tooltip, Edit-Mode,
// Kontext-Menüs (View + Edit), View-Mode-Aktionen (Acknowledge etc.),
// Gadget-Konfigurations-Dialog, Resize/Iconset/Layer-Dialoge.
'use strict';

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
    <div class="nv2-label" title="${esc(obj.label || obj.name)}"
         style="${obj.show_label === false ? 'display:none' : ''}">${esc(obj.label || obj.name)}</div>`;

  el.addEventListener('mouseenter', () => showTooltip(el, obj));
  el.addEventListener('mouseleave', hideTooltip);
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (editActive) showNodeContextMenu(e, el, obj);
    else            showViewContextMenu(e, el, obj);
  });
  _attachSelectHandler(el);

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
  _attachSelectHandler(el);

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
  _attachSelectHandler(el);
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
    if (s.host_name && s.description) {
      if (!serviceCache[s.host_name]) serviceCache[s.host_name] = [];
      if (!serviceCache[s.host_name].includes(s.description))
        serviceCache[s.host_name].push(s.description);
    }
    // Perfdata cachen
    if (s.perfdata && Object.keys(s.perfdata).length) {
      perfdataCache[key] = s.perfdata;
    }
  }
  _applyHostgroupStatuses();
  _updateWeathermapLines();
  _applyGadgetPerfdata();

  // Status-Zähler für aktive Map cachen → Overview-Pills
  if (activeMapId) {
    const counts = { ok: 0, warn: 0, crit: 0, unkn: 0 };
    for (const h of hosts) {
      const l = h.state_label;
      if (l === 'UP' || l === 'OK')                          counts.ok++;
      else if (l === 'WARNING')                              counts.warn++;
      else if (l === 'CRITICAL' || l === 'DOWN' || l === 'UNREACHABLE') counts.crit++;
      else                                                   counts.unkn++;
    }
    for (const s of services) {
      const l = s.state_label;
      if (l === 'OK')                counts.ok++;
      else if (l === 'WARNING')      counts.warn++;
      else if (l === 'CRITICAL')     counts.crit++;
      else                           counts.unkn++;
    }
    mapStatusCache[activeMapId] = counts;
    _updateOverviewCardPills(activeMapId, counts);
    _updateSidebarPip(activeMapId, counts);
  }
}

function _applyHostgroupStatuses() {
  // Für jeden Hostgroup-Node: Worst-State aus Mitglieds-Hosts berechnen
  const HG_SEVERITY = { UP:0, OK:0, WARNING:1, UNKNOWN:2, UNREACHABLE:3, DOWN:4, CRITICAL:4 };

  document.querySelectorAll('.nv2-node[data-type="hostgroup"]').forEach(el => {
    const groupName = el.dataset.name;
    const members   = hostgroupCache[groupName];
    if (!members || !members.length) return;

    let worstLabel = 'UP';
    let worstSev   = -1;
    let anyAck     = false;
    let anyDT      = false;

    for (const hname of members) {
      const h = hostCache[hname];
      if (!h) continue;
      const sev = HG_SEVERITY[h.state_label] ?? 0;
      if (sev > worstSev) { worstSev = sev; worstLabel = h.state_label; }
      if (h.acknowledged) anyAck = true;
      if (h.in_downtime)  anyDT  = true;
    }

    if (worstSev < 0) return; // kein Member im Cache → kein Update
    applyNodeStatus(el, worstLabel, anyAck, anyDT);
  });
}

function _applyGadgetPerfdata() {
  if (!activeMapCfg?.objects) return;
  document.querySelectorAll('.nv2-node.gadget').forEach(el => {
    const obj = activeMapCfg.objects.find(o => o.object_id === el.dataset.objectId);
    const cfg = obj?.gadget_config;
    if (!cfg?.host_name || !cfg?.service_description) return;

    const key = `${cfg.host_name}::${cfg.service_description}`;
    const pd  = perfdataCache[key];
    if (!pd) return;

    // Metrik suchen: perf_label → metric (case-insensitive) → erste Metrik
    const searchLabel = (cfg.perf_label || cfg.metric || '').toLowerCase();
    const metric =
      pd[cfg.perf_label || cfg.metric] ??
      Object.entries(pd).find(([k]) => k.toLowerCase() === searchLabel)?.[1] ??
      Object.values(pd)[0];

    if (!metric || metric.value == null) return;

    // Live-Konfiguration zusammenbauen:
    // Eigene warn/crit/min/max aus Gadget-Config haben Vorrang vor Perfdata-Werten
    const liveCfg = { ...cfg, value: metric.value };
    if (!cfg.unit)                        liveCfg.unit     = metric.unit || '';
    if (cfg.warning  == null && metric.warn != null) liveCfg.warning  = metric.warn;
    if (cfg.critical == null && metric.crit != null) liveCfg.critical = metric.crit;
    if (cfg.min      == null && metric.min  != null) liveCfg.min      = metric.min;
    if (cfg.max      == null && metric.max  != null) liveCfg.max      = metric.max;

    updateGadget(el, liveCfg);
  });
}

function applyNodeStatus(el, label, ack, downtime) {
  const isOsm = el.classList.contains('nv2-osm-marker');
  let cls = 'nv2-node ' + (STATE_CLS[label] ?? 'nv2-unknown');
  if (isOsm)    cls = 'nv2-osm-marker ' + cls;
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
//  GADGET-KONFIGURATIONS-DIALOG
// ═══════════════════════════════════════════════════════════════════════

function openGadgetConfigDialog(el, obj) {
  document.getElementById('dlg-gadget-cfg')?.remove();

  const cfg = obj.gadget_config ?? { type:'radial', metric:'', value:0, unit:'%', min:0, max:100, warning:70, critical:90 };
  const hosts = Object.values(hostCache);
  const hostDatalistOpts = hosts.map(h => `<option value="${esc(h.name)}">`).join('');

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
            <input class="f-input" id="gc-host" type="text" placeholder="(Demo / Statisch)"
                   value="${esc(cfg.host_name || '')}" list="gc-host-list" oninput="_gcUpdateServices()">
            <datalist id="gc-host-list">${hostDatalistOpts}</datalist>
          </div>
          <div>
            <label class="f-label">Service / Metrik</label>
            <input class="f-input" id="gc-service" type="text" placeholder="z.B. CPU Load"
                   value="${esc(cfg.service_description || '')}" oninput="_gcUpdateServices()">
          </div>
        </div>
        <div id="gc-perflabel-row" style="margin-top:6px;${cfg.host_name?'':'display:none'}">
          <label class="f-label">Perfdata-Metrik</label>
          <input class="f-input" id="gc-perf-label" type="text"
                 placeholder="z.B. load1, mem_used_percent, temp"
                 value="${esc(cfg.perf_label || '')}" list="gc-perf-label-list">
          <datalist id="gc-perf-label-list"></datalist>
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
      <div id="gc-orientation-row" style="margin-top:8px;${cfg.type==='linear'?'':'display:none'}">
        <label class="f-label">Orientierung</label>
        <div style="display:flex;gap:12px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="radio" name="gc-orientation" value="horizontal" ${(cfg.orientation??'horizontal')!=='vertical'?'checked':''}><span>↔ Horizontal</span></label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px"><input type="radio" name="gc-orientation" value="vertical" ${cfg.orientation==='vertical'?'checked':''}><span>↕ Vertikal</span></label>
        </div>
      </div>
      <div id="gc-sparkline-row" style="margin-top:8px;${cfg.type==='sparkline'?'':'display:none'}">
        <label class="f-label">Datenpunkte (max.)</label>
        <input class="f-input" id="gc-history-points" type="number" min="5" max="100" step="5" value="${cfg.history_points ?? 25}" style="max-width:80px">
      </div>
      <div id="gc-demo-row" style="margin-top:8px;${cfg.host_name?'display:none':''}">
        <label class="f-label">Demo-Wert</label>
        <input class="f-input" id="gc-demo-value" type="number" value="${cfg.value ?? 0}" min="0" max="9999">
      </div>
      <div id="gc-divide-row" style="margin-top:8px;${cfg.type==='rawnumber'?'':'display:none'}">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div><label class="f-label">Divisor</label><input class="f-input" id="gc-divide" type="number" step="any" value="${cfg.divide ?? 1}" min="0.001"></div>
          <div><label class="f-label">Anzeigeeinheit</label><input class="f-input" id="gc-display-unit" type="text" placeholder="MB, GB, …" value="${cfg.display_unit ?? cfg.unit ?? ''}"></div>
          <div><label class="f-label">Nachkommastellen</label><input class="f-input" id="gc-decimals" type="number" min="0" max="6" value="${cfg.decimals ?? 1}"></div>
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
  _gcUpdatePerfLabels();
  ['gc-metric','gc-unit','gc-min','gc-max','gc-warning','gc-critical','gc-demo-value','gc-size',
   'gc-history-points','gc-decimals','gc-divide','gc-display-unit','gc-value-out','gc-value-in']
    .forEach(id => document.getElementById(id)?.addEventListener('input', _gcUpdatePreview));
  document.getElementById('gc-service')?.addEventListener('input', _gcUpdatePerfLabels);
}

window._gcSelectType = function(btn) {
  document.querySelectorAll('#dlg-gadget-cfg .type-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const type = btn.dataset.gtype;
  const mmRow  = document.getElementById('gc-minmax-row');
  const dirRow = document.getElementById('gc-direction-row');
  const divRow = document.getElementById('gc-divide-row');
  const orRow  = document.getElementById('gc-orientation-row');
  const spkRow = document.getElementById('gc-sparkline-row');
  if (mmRow)  mmRow.style.display  = type === 'sparkline'   ? 'none'  : 'grid';
  if (dirRow) dirRow.style.display = type === 'weather'     ? 'block' : 'none';
  if (divRow) divRow.style.display = type === 'rawnumber'   ? 'block' : 'none';
  if (orRow)  orRow.style.display  = type === 'linear'      ? 'block' : 'none';
  if (spkRow) spkRow.style.display = type === 'sparkline'   ? 'block' : 'none';
  _gcUpdatePreview();
};

document.addEventListener('change', e => {
  if (e.target.name === 'gc-direction') {
    const inout = document.getElementById('gc-inout-row');
    if (inout) inout.style.display = e.target.value === 'both' ? 'grid' : 'none';
    _gcUpdatePreview();
  }
  if (e.target.name === 'gc-orientation') {
    _gcUpdatePreview();
  }
});

window._gcUpdatePreview = function() {
  const preview = document.getElementById('gc-preview');
  if (!preview) return;
  const type        = document.querySelector('#dlg-gadget-cfg .type-chip.active')?.dataset.gtype ?? 'radial';
  const metric      = document.getElementById('gc-metric')?.value || 'Metrik';
  const unit        = document.getElementById('gc-unit')?.value   || '%';
  const min         = parseFloat(document.getElementById('gc-min')?.value)         || 0;
  const max         = parseFloat(document.getElementById('gc-max')?.value)         || 100;
  const warning     = parseFloat(document.getElementById('gc-warning')?.value)     || 70;
  const critical    = parseFloat(document.getElementById('gc-critical')?.value)    || 90;
  const value       = parseFloat(document.getElementById('gc-demo-value')?.value)  || (max * 0.42);
  const size        = parseInt(document.getElementById('gc-size')?.value)          || 100;
  const orientation = document.querySelector('input[name="gc-orientation"]:checked')?.value ?? 'horizontal';
  const direction   = document.querySelector('input[name="gc-direction"]:checked')?.value   ?? 'out';
  const histPoints  = parseInt(document.getElementById('gc-history-points')?.value) || 25;
  const decimals    = parseInt(document.getElementById('gc-decimals')?.value)        || 0;
  const divide      = parseFloat(document.getElementById('gc-divide')?.value)       || 1;
  const displayUnit = document.getElementById('gc-display-unit')?.value?.trim()     || '';
  const valueOut    = parseFloat(document.getElementById('gc-value-out')?.value)    || value;
  const valueIn     = parseFloat(document.getElementById('gc-value-in')?.value)     || 0;

  const _demoHist = [30,45,52,38,61,55,70,65,48,58,72,68,80,75,62,68,55,70,65,78,75,60,65,58,72];
  const tmpCfg = { type, metric, unit, min, max, warning, critical, value,
    orientation, direction, value_out: valueOut, value_in: valueIn,
    decimals, divide: divide !== 1 ? divide : undefined,
    display_unit: displayUnit || undefined,
    history: _demoHist.slice(0, histPoints), history_points: histPoints };

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

window._gcUpdateServices = function() {
  const hostSel  = document.getElementById('gc-host');
  const svcInput = document.getElementById('gc-service');
  if (!hostSel || !svcInput) return;

  const hostName = hostSel.value;
  const listId   = 'gc-service-list';

  // Alten Datalist entfernen
  document.getElementById(listId)?.remove();

  // Demo-Wert-Zeile: ausblenden wenn Host eingegeben, einblenden wenn leer
  const demoRow = document.getElementById('gc-demo-row');
  const perfRow = document.getElementById('gc-perflabel-row');
  if (demoRow) demoRow.style.display = hostName ? 'none' : '';
  if (perfRow) perfRow.style.display = hostName ? ''     : 'none';

  const svcs = (hostName && serviceCache[hostName]) ?? [];
  if (svcs.length) {
    const dl = document.createElement('datalist');
    dl.id = listId;
    svcs.sort().forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      dl.appendChild(opt);
    });
    svcInput.insertAdjacentElement('afterend', dl);
    svcInput.setAttribute('list', listId);
  }

  _gcUpdatePerfLabels();
};

window._gcUpdatePerfLabels = function() {
  const hostSel  = document.getElementById('gc-host');
  const svcInput = document.getElementById('gc-service');
  const dl       = document.getElementById('gc-perf-label-list');
  if (!hostSel || !svcInput || !dl) return;

  const key = `${hostSel.value}::${svcInput.value}`;
  const pd  = (typeof perfdataCache !== 'undefined') ? perfdataCache[key] : null;
  dl.innerHTML = '';
  if (pd) {
    Object.keys(pd).sort().forEach(label => {
      const m   = pd[label];
      const opt = document.createElement('option');
      opt.value = label;
      opt.label = `${label} = ${m.value}${m.unit || ''}`;
      dl.appendChild(opt);
    });
  }
};

window._gcSave = async function(objectId) {
  const type        = document.querySelector('#dlg-gadget-cfg .type-chip.active')?.dataset.gtype ?? 'radial';
  const metric      = document.getElementById('gc-metric')?.value.trim()     || 'Metrik';
  const unit        = document.getElementById('gc-unit')?.value.trim()       || '%';
  const min         = parseFloat(document.getElementById('gc-min')?.value)        || 0;
  const max         = parseFloat(document.getElementById('gc-max')?.value)        || 100;
  const warning     = parseFloat(document.getElementById('gc-warning')?.value)    || 70;
  const critical    = parseFloat(document.getElementById('gc-critical')?.value)   || 90;
  const value       = parseFloat(document.getElementById('gc-demo-value')?.value) || 0;
  const size        = parseInt(document.getElementById('gc-size')?.value)         || 100;
  const hostName    = document.getElementById('gc-host')?.value      || '';
  const svcName     = document.getElementById('gc-service')?.value   || '';
  const perfLabel   = document.getElementById('gc-perf-label')?.value.trim() || '';
  const direction   = document.querySelector('input[name="gc-direction"]:checked')?.value   ?? 'out';
  const orientation = document.querySelector('input[name="gc-orientation"]:checked')?.value ?? 'horizontal';
  const divide      = parseFloat(document.getElementById('gc-divide')?.value)       || 1;
  const displayUnit = document.getElementById('gc-display-unit')?.value.trim()      || '';
  const decimals    = parseInt(document.getElementById('gc-decimals')?.value)        || 0;
  const histPoints  = parseInt(document.getElementById('gc-history-points')?.value)  || 25;
  const valueOut    = parseFloat(document.getElementById('gc-value-out')?.value)    || value;
  const valueIn     = parseFloat(document.getElementById('gc-value-in')?.value)     || 0;

  const newCfg = { type, metric, unit, min, max, warning, critical, value,
    ...(type === 'linear'    ? { orientation: orientation !== 'horizontal' ? orientation : undefined } : {}),
    ...(type === 'sparkline' ? { history_points: histPoints !== 25 ? histPoints : undefined } : {}),
    ...(type === 'rawnumber' ? { divide: divide !== 1 ? divide : undefined, display_unit: displayUnit || undefined, decimals: decimals || undefined } : {}),
    ...(type === 'weather'   ? { direction, ...(direction === 'both' ? { value_out: valueOut, value_in: valueIn } : {}) } : {}),
    ...(hostName  ? { host_name: hostName }                  : {}),
    ...(svcName   ? { service_description: svcName }         : {}),
    ...(perfLabel ? { perf_label: perfLabel }                : {}),
    history: [30,45,52,38,61,55,70,65,48,58,72,68,80,75,62,68,55,70,65,78,75,60,65,58,72],
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
      <div class="tt-row"><span>Typ</span><b>${esc(obj.type)}</b></div>`;
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
//  EDIT MODE
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
//  MULTI-SELECT HELPERS
// ═══════════════════════════════════════════════════════════════════════

function clearSelection() {
  selectedNodes.forEach(n => n.classList.remove('nv2-selected'));
  selectedNodes.clear();
}
window.clearSelection = clearSelection;

function _attachSelectHandler(el) {
  el.addEventListener('click', e => {
    if (!editActive) return;
    if (el._nv2wasDragged) { el._nv2wasDragged = false; return; }
    e.stopPropagation();
    if (e.shiftKey) {
      if (selectedNodes.has(el)) { selectedNodes.delete(el); el.classList.remove('nv2-selected'); }
      else                       { selectedNodes.add(el);    el.classList.add('nv2-selected'); }
    } else {
      clearSelection();
      selectedNodes.add(el);
      el.classList.add('nv2-selected');
    }
  });
}

function toggleEdit() {
  editActive = !editActive;
  if (!editActive) clearSelection();
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
  // OSM-Marker vom Canvas-Drag ausschließen (Leaflet übernimmt das)
  if (editActive) document.querySelectorAll('.nv2-node:not(.nv2-osm-marker), .nv2-textbox, .nv2-container').forEach(makeDraggable);
  if (window.NV2_OSM?.isActive()) NV2_OSM.setEditMode(editActive);
}

function makeDraggable(el) {
  if (el._nv2drag) return;
  el._nv2drag = true;
  el.addEventListener('mousedown', e => {
    if (!editActive || e.button !== 0) return;
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault(); e.stopPropagation();
    hideTooltip();
    el._nv2wasDragged = false;

    const canvas = document.getElementById('nv2-canvas');
    const rect   = canvas.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;

    // Gruppen-Drag: alle selektierten Nodes bewegen
    const isGroup   = selectedNodes.size > 1 && selectedNodes.has(el);
    const dragNodes = isGroup ? [...selectedNodes] : [el];
    dragNodes.forEach(n => { n._dragX0 = parseFloat(n.style.left); n._dragY0 = parseFloat(n.style.top); });
    dragNodes.forEach(n => { n.classList.add('nv2-dragging'); n.style.zIndex = '40'; });

    const onMove = ev => {
      el._nv2wasDragged = true;
      const zs    = window.NV2_ZOOM?.getState?.() ?? { zoom: 1 };
      const clamp = (activeMapCfg?.canvas?.overflow ?? 'clamp') !== 'free';
      const dx = (ev.clientX - sx) / rect.width  * 100 / zs.zoom;
      const dy = (ev.clientY - sy) / rect.height * 100 / zs.zoom;
      dragNodes.forEach(n => {
        const nx = n._dragX0 + dx;
        const ny = n._dragY0 + dy;
        n.style.left = `${(clamp ? Math.max(0, Math.min(100, nx)) : nx).toFixed(2)}%`;
        n.style.top  = `${(clamp ? Math.max(0, Math.min(97,  ny)) : ny).toFixed(2)}%`;
      });
    };
    const onUp = async () => {
      dragNodes.forEach(n => { n.classList.remove('nv2-dragging'); n.style.zIndex = ''; });
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      await Promise.all(dragNodes.map(n =>
        api(`/api/maps/${activeMapId}/objects/${n.dataset.objectId}/pos`, 'PATCH',
          { x: parseFloat(n.style.left), y: parseFloat(n.style.top) })
      ));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

// ── Lasso-Selektion ─────────────────────────────────────────────────────

function onCanvasMouseDown(e) {
  if (!editActive || e.button !== 0) return;
  if (e.target.closest('.nv2-node,.nv2-textbox,.nv2-container,.nv2-line-el,.nv2-wm-line,.line-handle,.ctx-menu')) return;

  const canvas  = document.getElementById('nv2-canvas');
  const rect    = canvas.getBoundingClientRect();
  const startX  = e.clientX - rect.left;
  const startY  = e.clientY - rect.top;
  let lasso = document.createElement('div');
  lasso.id = 'nv2-lasso';
  lasso.style.cssText = `left:${startX}px;top:${startY}px;width:0;height:0`;
  canvas.appendChild(lasso);
  let moved = false;

  const onMove = ev => {
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    const x = Math.min(cx, startX), y = Math.min(cy, startY);
    const w = Math.abs(cx - startX), h = Math.abs(cy - startY);
    if (w > 4 || h > 4) moved = true;
    lasso.style.left = `${x}px`; lasso.style.top  = `${y}px`;
    lasso.style.width = `${w}px`; lasso.style.height = `${h}px`;
  };

  const onUp = ev => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    const lr = lasso.getBoundingClientRect();
    lasso.remove();
    if (!moved) return;
    if (!ev.shiftKey) clearSelection();
    document.querySelectorAll('.nv2-node,.nv2-textbox,.nv2-container').forEach(node => {
      const nr = node.getBoundingClientRect();
      const cx = nr.left + nr.width / 2, cy = nr.top + nr.height / 2;
      if (cx >= lr.left && cx <= lr.right && cy >= lr.top && cy <= lr.bottom) {
        selectedNodes.add(node); node.classList.add('nv2-selected');
      }
    });
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
window.onCanvasMouseDown = onCanvasMouseDown;

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

window._actionConfig = JSON.parse(localStorage.getItem('nv2-action-config') || '{}');
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
  const start_time = Math.floor(new Date(startInput).getTime() / 1000);
  const end_time   = Math.floor(new Date(endInput).getTime()   / 1000);
  document.getElementById('dlg-downtime')?.remove();
  const body = {
    action:     type === 'service' ? 'downtime_service' : 'downtime_host',
    host_name:  hostname,
    type,
    comment,
    start_time,
    end_time,
    ...(service     ? { service_name: service } : {}),
    ...(childHosts  ? { child_hosts: true }     : {}),
  };
  const res = await api('/api/actions', 'POST', body);
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

  // Multi-Select-Menü wenn mehrere Nodes selektiert
  if (selectedNodes.size > 1 && selectedNodes.has(el)) {
    const menu = document.createElement('div');
    menu.id = 'nv2-ctx-menu'; menu.className = 'ctx-menu';
    menu.style.left = `${e.clientX}px`; menu.style.top = `${e.clientY}px`;
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:6px 12px 4px;font-size:10px;color:var(--text-dim);font-weight:600;text-transform:uppercase;letter-spacing:0.5px';
    hdr.textContent = `${selectedNodes.size} Objekte ausgewählt`;
    menu.appendChild(hdr);
    const delBtn = document.createElement('button');
    delBtn.className = 'ctx-item ctx-danger';
    delBtn.textContent = '🗑 Alle entfernen';
    delBtn.onclick = async () => {
      closeContextMenu();
      if (!confirm(`${selectedNodes.size} Objekte entfernen?`)) return;
      const nodes = [...selectedNodes];
      clearSelection();
      await Promise.all(nodes.map(n =>
        api(`/api/maps/${activeMapId}/objects/${n.dataset.objectId}`, 'DELETE').then(() => n.remove())
      ));
    };
    menu.appendChild(delBtn);
    menu.addEventListener('click', ev => ev.stopPropagation());
    document.body.appendChild(menu);
    _ctxMenu = menu;
    setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
    return;
  }

  const menu = document.createElement('div');
  menu.id = 'nv2-ctx-menu'; menu.className = 'ctx-menu';
  menu.style.left = `${e.clientX}px`; menu.style.top = `${e.clientY}px`;
  const isTextbox = obj.type === 'textbox', isGadget = obj.type === 'gadget';
  const isMonitoring = ['host','service','hostgroup','servicegroup','map'].includes(obj.type);
  const items = [
    { label:'✏ Text bearbeiten',      action:() => openTextboxDialog(el, obj),           hide:!isTextbox },
    { label:'⚙ Gadget konfigurieren', action:() => openGadgetConfigDialog(el, obj),       hide:!isGadget },
    { label:'⚙ Eigenschaften',        action:() => openNodePropsDialog(el, obj),          hide:!isMonitoring },
    { label:'⤢ Größe ändern',        action:() => openResizeDialog(el, obj),             hide:isTextbox || isGadget },
    { label:'🖼 Iconset wechseln',    action:() => openIconsetDialog(el, obj),            hide:!isMonitoring },
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

function openNodePropsDialog(el, obj) {
  document.getElementById('dlg-node-props')?.remove();
  const isService = obj.type === 'service';
  const nameLabel = { host:'Hostname', hostgroup:'Hostgruppen-Name', servicegroup:'Servicegruppen-Name', map:'Map-ID' }[obj.type] ?? 'Name';
  const hostOptions = Object.keys(hostCache).filter(k => !k.includes('::')).map(k => `<option value="${esc(k)}">`).join('');

  const dlg = document.createElement('div');
  dlg.id = 'dlg-node-props'; dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:360px">
      <h3>Eigenschaften – ${esc(obj.label || obj.name)}</h3>
      ${isService ? `
        <label class="f-label">Hostname</label>
        <input class="f-input" id="np-host" type="text" value="${esc(obj.host_name ?? '')}"
               list="np-hosts-dl" autocomplete="off">
        <datalist id="np-hosts-dl">${hostOptions}</datalist>
        <label class="f-label" style="margin-top:8px">Service-Name</label>
        <input class="f-input" id="np-name" type="text" value="${esc(obj.name ?? '')}" autocomplete="off">
      ` : `
        <label class="f-label">${nameLabel}</label>
        <input class="f-input" id="np-name" type="text" value="${esc(obj.name ?? '')}"
               list="np-hosts-dl" autocomplete="off">
        <datalist id="np-hosts-dl">${hostOptions}</datalist>
      `}
      <label class="f-label" style="margin-top:8px">
        Label <span style="color:var(--text-dim);font-weight:400">(Anzeigename, leer = Name)</span>
      </label>
      <input class="f-input" id="np-label" type="text"
             value="${esc(obj.label ?? '')}" placeholder="${esc(obj.name ?? '')}">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text);margin-top:8px">
        <input type="checkbox" id="np-show-label" ${obj.show_label !== false ? 'checked' : ''}>
        Label anzeigen
      </label>
      <div class="dlg-actions" style="margin-top:16px">
        <button class="btn-cancel" id="np-cancel">Abbrechen</button>
        <button class="btn-ok"     id="np-ok">Speichern</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  const inName      = dlg.querySelector('#np-name');
  const inHost      = isService ? dlg.querySelector('#np-host') : null;
  const inLabel     = dlg.querySelector('#np-label');
  const inShowLabel = dlg.querySelector('#np-show-label');

  dlg.querySelector('#np-cancel').onclick = () => dlg.remove();
  dlg.querySelector('#np-ok').onclick = async () => {
    const newName      = inName.value.trim();
    const newHost      = inHost?.value.trim() ?? null;
    const newLabel     = inLabel.value.trim() || null;
    const newShowLabel = inShowLabel.checked;
    if (!newName) return;

    const patch = { name: newName, label: newLabel, show_label: newShowLabel };
    if (isService) patch.host_name = newHost;

    obj.name       = newName;
    obj.label      = newLabel;
    obj.show_label = newShowLabel;
    if (isService) obj.host_name = newHost;

    el.dataset.name = isService ? `${newHost}::${newName}` : newName;
    const labelEl = el.querySelector('.nv2-label');
    if (labelEl) {
      labelEl.textContent    = newLabel || newName;
      labelEl.style.display  = newShowLabel ? '' : 'none';
    }

    dlg.remove();
    await api(`/api/maps/${activeMapId}/objects/${obj.object_id}/props`, 'PATCH', patch);
  };

  (inHost ?? inName)?.focus();
  (inHost ?? inName)?.select();
}

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
  clearSelection();

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
//  CANVAS RECHTSKLICK-MENÜ (Edit-Mode)
// ═══════════════════════════════════════════════════════════════════════

function showCanvasContextMenu(e) {
  if (!editActive) return;
  if (e.target.closest('.nv2-node, .nv2-textbox, .nv2-container')) return;
  if (e.target.closest('.nv2-line-el, .nv2-wm-line, .line-handle')) return;
  e.preventDefault();

  const rect  = document.getElementById('nv2-canvas').getBoundingClientRect();
  const state = window.NV2_ZOOM?.getState?.() ?? { zoom: 1, panX: 0, panY: 0 };
  const localX = (e.clientX - rect.left - state.panX) / state.zoom;
  const localY = (e.clientY - rect.top  - state.panY) / state.zoom;
  const pos = {
    x: (localX / rect.width  * 100).toFixed(2),
    y: (localY / rect.height * 100).toFixed(2),
  };

  closeContextMenu();
  const menu = document.createElement('div');
  menu.id = 'nv2-ctx-menu'; menu.className = 'ctx-menu';
  menu.style.left = `${e.clientX}px`; menu.style.top = `${e.clientY}px`;

  const items = [
    { label: '＋ Objekt hier platzieren', action: () => { window.pendingPos = pos; openDlg('dlg-add-object'); } },
    { sep: true },
    { label: '⊡ Canvas-Format ändern',  action: () => openCanvasModeDialog(activeMapId, activeMapCfg?.title ?? activeMapId, activeMapCfg?.canvas) },
    { label: '🖼 Hintergrund hochladen', action: () => document.getElementById('bg-file-input').click() },
  ];

  items.forEach(item => {
    if (item.sep) {
      const hr = document.createElement('div');
      hr.style.cssText = 'height:1px;background:var(--border);margin:3px 0';
      menu.appendChild(hr);
      return;
    }
    const btn = document.createElement('button');
    btn.className = 'ctx-item';
    btn.textContent = item.label;
    btn.onclick = () => { closeContextMenu(); item.action(); };
    menu.appendChild(btn);
  });

  menu.addEventListener('click', e => e.stopPropagation());
  document.body.appendChild(menu);
  _ctxMenu = menu;
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}

// ═══════════════════════════════════════════════════════════════════════

window.showNodeContextMenu    = showNodeContextMenu;
window.showViewContextMenu    = showViewContextMenu;
window.showCanvasContextMenu  = showCanvasContextMenu;
window.openGadgetConfigDialog = openGadgetConfigDialog;
window.openAcknowledgeDlg     = openAcknowledgeDlg;
window.openDowntimeDlg        = openDowntimeDlg;
window.openActionConfigDlg   = openActionConfigDlg;
window.openWeathermapLineDlg = openWeathermapLineDlg;
window.applyNodeStatus       = applyNodeStatus;
window.updateNodeIcon        = updateNodeIcon;
window.getNodeContainer      = getNodeContainer;
window.showTooltip           = showTooltip;
window.hideTooltip           = hideTooltip;