// js/gadget-renderer.js

window.createGadget = function(obj) {
  const el = document.createElement('div');
  el.id               = `nv2-${obj.object_id}`;
  el.className        = `nv2-node gadget`;
  el.dataset.objectId = obj.object_id;
  el.dataset.type     = obj.type; // immer 'gadget'
  el.dataset.gadgetType = obj.gadget_config?.type || 'radial';
  el.dataset.backendId  = obj.backend_id || '';

  const cfg  = obj.gadget_config || { type:'radial', value:0, min:0, max:100, unit:'%', warning:70, critical:90 };
  const size = obj.size ?? 100;

  el.innerHTML = _renderGadget(cfg);

  el.style.left     = `${obj.x}%`;
  el.style.top      = `${obj.y}%`;
  el.style.position = 'absolute';
  el.style.transform       = `translate(-50%,-50%) scale(${size/100})`;
  el.style.transformOrigin = 'center center';

  // Auto-Refresh für graph-Gadgets
  if (cfg.type === 'graph' && (cfg.refresh ?? 0) > 0) {
    const tid = setInterval(() => {
      const img = el.querySelector('.g-graph-img');
      const frm = el.querySelector('.g-graph-frame');
      if (img) {
        const sep = img.src.includes('?') ? '&' : '?';
        img.src = img.src.replace(/[&?]_t=\d+/, '') + `${sep}_t=${Date.now()}`;
      }
      if (frm) { frm.src = frm.src; }
    }, cfg.refresh * 1000);
    _graphTimers.set(el.id, tid);
  }

  el.addEventListener('mouseenter', () => { if (window.showTooltip) showTooltip(el, obj); });
  el.addEventListener('mouseleave', () => { if (window.hideTooltip) hideTooltip(); });
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    const _edit = window.editActive ?? false;
    const _ctx  = window.showNodeContextMenu;
    if (_edit && typeof _ctx === 'function') _ctx(e, el, obj);
  });

  const container = (typeof getNodeContainer === 'function')
    ? getNodeContainer()
    : (document.getElementById('map-canvas-wrapper') ?? document.getElementById('nv2-canvas'));
  container?.appendChild(el);
  return el;
};

// Timer-Registry für Graph-Auto-Refresh
const _graphTimers = new Map();

window.updateGadget = function(el, data) {
  const type = el.dataset.gadgetType;
  if (type === 'graph') return;   // graph-Gadgets werden nicht via Perfdata aktualisiert
  if (type === 'rawnumber' || type === 'thermometer' || type === 'linear') {
    // Komplett neu rendern (linear: Orientierung kann sich ändern)
    el.innerHTML = _renderGadget({ ...data, type });
    return;
  }
  if (type === 'sparkline') {
    _updateSparkline(el, data.value, data.warning, data.critical, data.max);
  } else if (type === 'weather') {
    _updateWeather(el, data.value, data.max, data);
  } else {
    // radial
    const arc = el.querySelector('.g-arc');
    const val = el.querySelector('.g-val');
    const pct = _pct(data.value, data.min ?? 0, data.max ?? 100);
    if (arc) { arc.setAttribute('stroke-dasharray', `${pct} 100`); arc.setAttribute('stroke', _color(pct)); }
    if (val) val.textContent = `${_fmt(data.value)}${data.unit||''}`;
  }
};


// ════════════════════════════════════════════════════════
//  RENDER-DISPATCHER
// ════════════════════════════════════════════════════════
function _renderGadget(cfg) {
  switch (cfg.type) {
    case 'linear':      return _linear(cfg);
    case 'sparkline':   return _sparkline(cfg);
    case 'weather':     return _weather(cfg);
    case 'rawnumber':   return _rawNumber(cfg);
    case 'thermometer': return _thermometer(cfg);
    case 'graph':       return _graph(cfg);
    default:            return _radial(cfg);
  }
}


// ════════════════════════════════════════════════════════
//  RADIAL GAUGE  – Kreisdiagramm mit Warn/Crit-Markern
// ════════════════════════════════════════════════════════
function _radial(cfg) {
  const min  = cfg.min  ?? 0;
  const max  = cfg.max  ?? 100;
  const warn = cfg.warning  ?? 70;
  const crit = cfg.critical ?? 90;
  const pct  = _pct(cfg.value, min, max);
  const wPct = _pct(warn, min, max);
  const cPct = _pct(crit, min, max);
  const col  = _color(pct);

  // Warn/Crit als kleine Marker-Dreiecke am Kreisrand
  const wAngle = _arcAngle(wPct);
  const cAngle = _arcAngle(cPct);
  const R = 15.9155;
  const CX = 18, CY = 18;

  function markerPos(angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    const r1 = R + 2.5, r2 = R + 5;
    return {
      x1: (CX + r1 * Math.cos(rad)).toFixed(2),
      y1: (CY + r1 * Math.sin(rad)).toFixed(2),
      x2: (CX + r2 * Math.cos(rad)).toFixed(2),
      y2: (CY + r2 * Math.sin(rad)).toFixed(2),
    };
  }

  const wm = markerPos(wAngle);
  const cm = markerPos(cAngle);

  return `
    <svg viewBox="0 0 36 36" width="56" height="56" style="display:block;margin:0 auto;overflow:visible">
      <!-- Hintergrund-Ring -->
      <circle cx="${CX}" cy="${CY}" r="${R}"
        fill="none" stroke="var(--border-hi)" stroke-width="3.5"
        stroke-dasharray="100 100"
        stroke-dashoffset="-25"
        transform="rotate(-90 ${CX} ${CY})"
        style="stroke-linecap:round"/>
      <!-- Wert-Arc -->
      <circle cx="${CX}" cy="${CY}" r="${R}"
        fill="none" stroke="${col}" stroke-width="3.5"
        stroke-dasharray="${pct.toFixed(1)} 100"
        stroke-dashoffset="-25"
        transform="rotate(-90 ${CX} ${CY})"
        class="g-arc"
        style="stroke-linecap:round;transition:stroke-dasharray .4s,stroke .4s"/>
      <!-- Warn-Marker -->
      <line x1="${wm.x1}" y1="${wm.y1}" x2="${wm.x2}" y2="${wm.y2}"
            stroke="var(--warn)" stroke-width="1.5" stroke-linecap="round" opacity="0.9"/>
      <!-- Crit-Marker -->
      <line x1="${cm.x1}" y1="${cm.y1}" x2="${cm.x2}" y2="${cm.y2}"
            stroke="var(--crit)" stroke-width="1.5" stroke-linecap="round" opacity="0.9"/>
      <!-- Wert-Text -->
      <text x="${CX}" y="${CY + 1.5}" text-anchor="middle" dominant-baseline="middle"
            font-family="monospace" font-size="5.5" fill="var(--text)" class="g-val">
        ${_fmt(cfg.value)}${cfg.unit||''}
      </text>
    </svg>
    <div class="nv2-label">${_gesc(cfg.metric||'Gauge')}</div>`;
}

// Winkel in Grad für einen Prozentwert auf dem Kreisbogen (0% = -25° Offset, also 0°=oben)
function _arcAngle(pct) {
  return (pct / 100) * 360;
}


// ════════════════════════════════════════════════════════
//  LINEAR BAR  – Balken mit Warn/Crit-Linien (horizontal + vertikal)
// ════════════════════════════════════════════════════════
function _linear(cfg) {
  return (cfg.orientation === 'vertical') ? _linearV(cfg) : _linearH(cfg);
}

function _linearH(cfg) {
  const min  = cfg.min  ?? 0;
  const max  = cfg.max  ?? 100;
  const warn = cfg.warning  ?? 70;
  const crit = cfg.critical ?? 90;
  const pct  = _pct(cfg.value, min, max);
  const wPct = _pct(warn, min, max);
  const cPct = _pct(crit, min, max);
  const col  = _color(pct);

  return `
    <div style="padding:4px 2px 2px">
      <!-- Wert + Einheit -->
      <div style="display:flex;justify-content:space-between;align-items:baseline;
                  margin-bottom:3px;font-family:monospace;font-size:9px">
        <span style="color:var(--text-mid)">${_gesc(cfg.metric||'')}</span>
        <span class="g-val" style="color:${col};font-weight:600">
          ${_fmt(cfg.value)}${cfg.unit||''}
        </span>
      </div>
      <!-- Balken -->
      <div style="position:relative;height:8px;background:var(--border);
                  border-radius:2px;overflow:visible;width:100px">
        <div class="g-bar" style="
          height:100%;border-radius:2px;
          width:${pct.toFixed(1)}%;
          background:${col};
          transition:width .4s,background .4s"></div>
        <!-- Warn-Linie -->
        <div style="position:absolute;top:-3px;bottom:-3px;left:${wPct.toFixed(1)}%;
                    width:2px;background:var(--warn);border-radius:1px;opacity:.85"
             title="Warning: ${warn}${cfg.unit||''}"></div>
        <!-- Crit-Linie -->
        <div style="position:absolute;top:-3px;bottom:-3px;left:${cPct.toFixed(1)}%;
                    width:2px;background:var(--crit);border-radius:1px;opacity:.85"
             title="Critical: ${crit}${cfg.unit||''}"></div>
      </div>
      <!-- Min/Max Labels -->
      <div style="display:flex;justify-content:space-between;
                  font-family:monospace;font-size:8px;color:var(--text-dim);margin-top:2px">
        <span>${min}</span><span>${max}${cfg.unit||''}</span>
      </div>
    </div>
    <div class="nv2-label" style="margin-top:2px">${_gesc(cfg.metric||'Linear')}</div>`;
}

function _linearV(cfg) {
  const min  = cfg.min  ?? 0;
  const max  = cfg.max  ?? 100;
  const warn = cfg.warning  ?? 70;
  const crit = cfg.critical ?? 90;
  const pct  = _pct(cfg.value, min, max);
  const wPct = _pct(warn, min, max);
  const cPct = _pct(crit, min, max);
  const col  = _color(pct);

  return `
    <div style="display:inline-flex;flex-direction:column;align-items:center;padding:2px 8px">
      <span style="font-family:monospace;font-size:8px;color:var(--text-dim);margin-bottom:2px">
        ${max}${cfg.unit||''}
      </span>
      <!-- Balken -->
      <div style="position:relative;width:14px;height:80px;background:var(--border);
                  border-radius:3px;overflow:visible">
        <!-- Crit-Linie -->
        <div style="position:absolute;left:-4px;right:-4px;bottom:${cPct.toFixed(1)}%;
                    height:2px;background:var(--crit);border-radius:1px;opacity:.85"
             title="Critical: ${crit}${cfg.unit||''}"></div>
        <!-- Warn-Linie -->
        <div style="position:absolute;left:-4px;right:-4px;bottom:${wPct.toFixed(1)}%;
                    height:2px;background:var(--warn);border-radius:1px;opacity:.85"
             title="Warning: ${warn}${cfg.unit||''}"></div>
        <!-- Füll-Balken von unten -->
        <div class="g-bar" style="
          position:absolute;bottom:0;left:0;right:0;border-radius:3px;
          height:${pct.toFixed(1)}%;
          background:${col};
          transition:height .4s,background .4s"></div>
      </div>
      <span class="g-val" style="font-family:monospace;font-size:9px;color:${col};
                                 font-weight:600;margin-top:3px">
        ${_fmt(cfg.value)}${cfg.unit||''}
      </span>
      <span style="font-family:monospace;font-size:8px;color:var(--text-dim);margin-top:1px">
        ${min}
      </span>
    </div>
    <div class="nv2-label">${_gesc(cfg.metric||'Linear')}</div>`;
}


// ════════════════════════════════════════════════════════
//  SPARKLINE  – korrekt im SVG-Viewport + Warn/Crit-Linien
// ════════════════════════════════════════════════════════
function _sparkline(cfg) {
  const maxPts  = cfg.history_points ?? 25;
  const history = (cfg.history || [cfg.value ?? 0]).slice(-maxPts);
  const max     = Math.max(...history, cfg.max ?? 1, 1);
  const warn    = cfg.warning  ?? max * 0.70;
  const crit    = cfg.critical ?? max * 0.90;

  // SVG-Koordinaten: x=0..96, y=2..38 (Rand: 2px oben/unten)
  const W = 96, H = 36, PAD = 2;
  const points = history.map((v, i) => {
    const x = history.length > 1 ? (i / (history.length - 1)) * W : W / 2;
    const y = PAD + H - (Math.min(v, max) / max) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Warn/Crit Y-Positionen
  const wY = (PAD + H - (warn / max) * H).toFixed(1);
  const cY = (PAD + H - (crit / max) * H).toFixed(1);

  // Aktueller Wert als Punkt
  const lastX = history.length > 1 ? W : W / 2;
  const lastY = PAD + H - (Math.min(history[history.length-1] ?? 0, max) / max) * H;
  const dotCol = _color(_pct(history[history.length-1] ?? 0, 0, max));

  return `
    <svg viewBox="0 0 100 44" width="100" height="44"
         style="display:block;overflow:visible" class="g-sparkline">
      <!-- Warn-Linie -->
      <line x1="2" y1="${wY}" x2="98" y2="${wY}"
            stroke="var(--warn)" stroke-width="0.8" stroke-dasharray="3,2" opacity="0.7"/>
      <!-- Crit-Linie -->
      <line x1="2" y1="${cY}" x2="98" y2="${cY}"
            stroke="var(--crit)" stroke-width="0.8" stroke-dasharray="3,2" opacity="0.7"/>
      <!-- Sparkline -->
      <polyline points="${points}"
                fill="none" stroke="${dotCol}" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"
                class="g-spark-line"/>
      <!-- Letzter Wert Punkt -->
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.5"
              fill="${dotCol}" class="g-spark-dot"/>
      <!-- Aktueller Wert -->
      <text x="98" y="10" text-anchor="end" font-family="monospace"
            font-size="7" fill="${dotCol}" class="g-val">
        ${_fmt(history[history.length-1] ?? 0)}${cfg.unit||''}
      </text>
    </svg>
    <div class="nv2-label">${_gesc(cfg.metric||'Sparkline')}</div>`;
}

function _updateSparkline(el, newVal, warn, crit, max) {
  const svg  = el.querySelector('.g-sparkline');
  if (!svg) return;
  let hist = el.dataset.history ? JSON.parse(el.dataset.history) : [];
  hist.push(newVal);
  if (hist.length > 25) hist.shift();
  el.dataset.history = JSON.stringify(hist);

  const maxV = Math.max(...hist, max ?? 1, 1);
  const W = 96, H = 36, PAD = 2;
  const points = hist.map((v, i) => {
    const x = hist.length > 1 ? (i / (hist.length - 1)) * W : W / 2;
    const y = PAD + H - (Math.min(v, maxV) / maxV) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const col  = _color(_pct(newVal, 0, maxV));
  const lastX = hist.length > 1 ? W : W / 2;
  const lastY = PAD + H - (Math.min(newVal, maxV) / maxV) * H;

  svg.querySelector('.g-spark-line')?.setAttribute('points', points);
  svg.querySelector('.g-spark-line')?.setAttribute('stroke', col);
  const dot = svg.querySelector('.g-spark-dot');
  if (dot) { dot.setAttribute('cx', lastX.toFixed(1)); dot.setAttribute('cy', lastY.toFixed(1)); dot.setAttribute('fill', col); }
  const valEl = svg.querySelector('.g-val');
  if (valEl) valEl.textContent = `${_fmt(newVal)}`;
}


// ════════════════════════════════════════════════════════
//  WEATHER / FLOW  – ein- oder bidirektional
// ════════════════════════════════════════════════════════
function _weather(cfg) {
  const direction = cfg.direction ?? 'out';
  return direction === 'both' ? _weatherBoth(cfg) : _weatherOne(cfg);
}

/** Einfacher unidirektionaler Flow (→ oder ←) */
function _weatherOne(cfg) {
  const max   = cfg.max  || 1000;
  const pct   = _pct(cfg.value, 0, max);
  const thick = Math.min(8, Math.max(1.5, pct / 12));
  const col   = _color(pct);
  const wX = (8  + _pct(cfg.warning  ?? max*.7, 0, max) / 100 * 80).toFixed(1);
  const cX = (8  + _pct(cfg.critical ?? max*.9, 0, max) / 100 * 80).toFixed(1);
  const isIn  = cfg.direction === 'in';
  const utilPct = Math.round(pct);
  const bwLabel = _fmtBw(cfg.value, cfg.unit);
  // Animierte Dash-Linie: Richtung durch animationDirection gesteuert
  const dashLen = 6, gapLen = 4, totalDash = dashLen + gapLen;
  const animDir = isIn ? 'reverse' : 'normal';

  return `
    <svg viewBox="0 0 120 56" width="130" height="56" style="display:block;overflow:visible">
      <defs>
        <style>
          @keyframes wm-flow { from { stroke-dashoffset: ${totalDash}; } to { stroke-dashoffset: 0; } }
          .g-wflow { animation: wm-flow 0.6s linear infinite; animation-direction: ${animDir}; }
        </style>
      </defs>
      <!-- Warn/Crit Marker -->
      <line x1="${wX}" y1="8" x2="${wX}" y2="44" stroke="var(--warn)" stroke-width="1" stroke-dasharray="2,2" opacity="0.7"/>
      <line x1="${cX}" y1="8" x2="${cX}" y2="44" stroke="var(--crit)" stroke-width="1" stroke-dasharray="2,2" opacity="0.7"/>
      <!-- Track (dunkel) -->
      <line x1="8" y1="28" x2="96" y2="28" stroke="${col}" stroke-width="${thick.toFixed(1)}" stroke-linecap="round" opacity="0.2"/>
      <!-- Animierte Flowlinie -->
      <line x1="8" y1="28" x2="96" y2="28"
            stroke="${col}" stroke-width="${thick.toFixed(1)}" stroke-linecap="round"
            stroke-dasharray="${dashLen},${gapLen}" class="g-wflow g-wline"/>
      <!-- Pfeilspitze -->
      ${isIn
        ? `<polygon points="10,21 10,35 22,28" fill="${col}" class="g-warrow"/>`
        : `<polygon points="96,21 110,28 96,35" fill="${col}" class="g-warrow"/>`}
      <!-- Bandbreite oben -->
      <text x="52" y="16" text-anchor="middle" font-family="monospace"
            font-size="8" fill="${col}" class="g-val g-val-bw">${_gesc(bwLabel)}</text>
      <!-- Auslastung % unten -->
      <text x="52" y="50" text-anchor="middle" font-family="monospace"
            font-size="7" fill="${col}" opacity="0.75" class="g-val-pct">${utilPct}%</text>
    </svg>
    <div class="nv2-label">${_gesc(cfg.metric||'Flow')}</div>`;
}

/** Bidirektionaler Flow (⇄) */
function _weatherBoth(cfg) {
  const max    = cfg.max  || 1000;
  const valOut = cfg.value_out ?? cfg.value ?? 0;
  const valIn  = cfg.value_in  ?? 0;
  const pctOut = _pct(valOut, 0, max);
  const pctIn  = _pct(valIn,  0, max);
  const thkOut = Math.min(7, Math.max(1.5, pctOut / 14));
  const thkIn  = Math.min(7, Math.max(1.5, pctIn  / 14));
  const colOut = _color(pctOut);
  const colIn  = _color(pctIn);
  const wX = (12 + _pct(cfg.warning  ?? max*.7, 0, max) / 100 * 76).toFixed(1);
  const cX = (12 + _pct(cfg.critical ?? max*.9, 0, max) / 100 * 76).toFixed(1);
  const unit = cfg.unit || '';
  const bwOut  = _fmtBw(valOut, unit);
  const bwIn   = _fmtBw(valIn,  unit);
  const pctOutR = Math.round(pctOut), pctInR = Math.round(pctIn);
  const dashLen = 5, gapLen = 4;

  return `
    <svg viewBox="0 0 120 70" width="132" height="70" style="display:block;overflow:visible">
      <defs>
        <style>
          @keyframes wm-out { from { stroke-dashoffset: ${dashLen+gapLen}; } to { stroke-dashoffset: 0; } }
          @keyframes wm-in  { from { stroke-dashoffset: 0; } to { stroke-dashoffset: ${dashLen+gapLen}; } }
          .g-wflow-out { animation: wm-out 0.6s linear infinite; }
          .g-wflow-in  { animation: wm-in  0.6s linear infinite; }
        </style>
      </defs>

      <!-- Warn/Crit Marker -->
      <line x1="${wX}" y1="2"  x2="${wX}" y2="68" stroke="var(--warn)" stroke-width="1" stroke-dasharray="2,2" opacity="0.45"/>
      <line x1="${cX}" y1="2"  x2="${cX}" y2="68" stroke="var(--crit)" stroke-width="1" stroke-dasharray="2,2" opacity="0.45"/>

      <!-- ── AUSGEHEND (→) oben ── -->
      <line x1="8" y1="22" x2="96" y2="22" stroke="${colOut}" stroke-width="${thkOut.toFixed(1)}" stroke-linecap="round" opacity="0.2"/>
      <line x1="8" y1="22" x2="96" y2="22" stroke="${colOut}" stroke-width="${thkOut.toFixed(1)}" stroke-linecap="round"
            stroke-dasharray="${dashLen},${gapLen}" class="g-wflow-out g-wline-out"/>
      <polygon points="96,15 112,22 96,29" fill="${colOut}" class="g-warrow-out"/>
      <text x="50" y="13" text-anchor="middle" font-family="monospace" font-size="7.5" fill="${colOut}" class="g-val-out g-val-bw-out">↑ ${_gesc(bwOut)}</text>
      <text x="50" y="33" text-anchor="middle" font-family="monospace" font-size="6.5" fill="${colOut}" opacity="0.7" class="g-val-pct-out">${pctOutR}%</text>

      <!-- Trennlinie -->
      <line x1="4" y1="36" x2="116" y2="36" stroke="var(--border)" stroke-width="0.5" opacity="0.35"/>

      <!-- ── EINGEHEND (←) unten ── -->
      <line x1="112" y1="48" x2="24" y2="48" stroke="${colIn}" stroke-width="${thkIn.toFixed(1)}" stroke-linecap="round" opacity="0.2"/>
      <line x1="112" y1="48" x2="24" y2="48" stroke="${colIn}" stroke-width="${thkIn.toFixed(1)}" stroke-linecap="round"
            stroke-dasharray="${dashLen},${gapLen}" class="g-wflow-in g-wline-in"/>
      <polygon points="24,41 8,48 24,55" fill="${colIn}" class="g-warrow-in"/>
      <text x="62" y="42" text-anchor="middle" font-family="monospace" font-size="7.5" fill="${colIn}" class="g-val-in g-val-bw-in">↓ ${_gesc(bwIn)}</text>
      <text x="62" y="62" text-anchor="middle" font-family="monospace" font-size="6.5" fill="${colIn}" opacity="0.7" class="g-val-pct-in">${pctInR}%</text>

    </svg>
    <div class="nv2-label">${_gesc(cfg.metric||'Flow')}</div>`;
}

function _updateWeather(el, newVal, max, cfg) {
  const svg = el.querySelector('svg');
  if (!svg) return;
  const isBoth = !!svg.querySelector('.g-wline-out');
  const _max   = max || 1000;
  const unit   = cfg?.unit || '';

  if (isBoth) {
    // Bidirektional: newVal = value_out, cfg.value_in für Gegenseite
    const valOut = newVal ?? 0;
    const valIn  = cfg?.value_in ?? 0;
    const pctOut = _pct(valOut, 0, _max), colOut = _color(pctOut);
    const pctIn  = _pct(valIn,  0, _max), colIn  = _color(pctIn);
    const thkOut = Math.min(7, Math.max(1.5, pctOut / 14));
    const thkIn  = Math.min(7, Math.max(1.5, pctIn  / 14));

    for (const cls of ['.g-wline-out', '.g-wflow-out']) {
      const ln = svg.querySelector(cls);
      if (ln) { ln.setAttribute('stroke', colOut); ln.setAttribute('stroke-width', thkOut.toFixed(1)); }
    }
    svg.querySelector('.g-warrow-out')  ?.setAttribute('fill',  colOut);
    svg.querySelector('.g-val-bw-out')  && (svg.querySelector('.g-val-bw-out').textContent  = `↑ ${_fmtBw(valOut, unit)}`);
    svg.querySelector('.g-val-pct-out') && (svg.querySelector('.g-val-pct-out').textContent = `${Math.round(pctOut)}%`);
    for (const cls of ['.g-wline-in', '.g-wflow-in']) {
      const ln = svg.querySelector(cls);
      if (ln) { ln.setAttribute('stroke', colIn); ln.setAttribute('stroke-width', thkIn.toFixed(1)); }
    }
    svg.querySelector('.g-warrow-in')   ?.setAttribute('fill',  colIn);
    svg.querySelector('.g-val-bw-in')   && (svg.querySelector('.g-val-bw-in').textContent   = `↓ ${_fmtBw(valIn,  unit)}`);
    svg.querySelector('.g-val-pct-in')  && (svg.querySelector('.g-val-pct-in').textContent  = `${Math.round(pctIn)}%`);
  } else {
    // Unidirektional
    const pct   = _pct(newVal, 0, _max);
    const col   = _color(pct);
    const thick = Math.min(8, Math.max(1.5, pct / 12));
    for (const cls of ['.g-wline', '.g-wflow']) {
      const ln = svg.querySelector(cls);
      if (ln) { ln.setAttribute('stroke', col); ln.setAttribute('stroke-width', thick.toFixed(1)); }
    }
    svg.querySelector('.g-warrow')   ?.setAttribute('fill', col);
    svg.querySelector('.g-val-bw')   && (svg.querySelector('.g-val-bw').textContent   = _fmtBw(newVal, unit));
    svg.querySelector('.g-val-pct')  && (svg.querySelector('.g-val-pct').textContent  = `${Math.round(pct)}%`);
  }
}


// ════════════════════════════════════════════════════════
//  HILFSFUNKTIONEN
// ════════════════════════════════════════════════════════
function _pct(val, min, max) {
  return Math.min(100, Math.max(0, ((val - min) / ((max - min) || 1)) * 100));
}

function _color(pct) {
  if (pct >= 90) return 'var(--crit)';
  if (pct >= 70) return 'var(--warn)';
  return 'var(--ok)';
}

function _fmt(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return '–';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

/**
 * Bandbreite human-readable formatieren.
 * Erkennt Einheiten: bit/s, Bit/s, bps, B/s, Byte/s, Mbps, Gbps, …
 * Gibt immer eine kompakte Darstellung zurück: "1.2 Gbit/s", "850 Mbit/s", "320 kbit/s"
 */
function _fmtBw(val, unit) {
  const n = parseFloat(val);
  if (isNaN(n)) return '–';
  const u = (unit || '').toLowerCase().replace(/\s/g, '');
  // Faktor zu bit/s normalisieren
  let bits = n;
  if      (u.startsWith('gbit') || u === 'gbps' || u === 'gib/s') bits = n * 1e9;
  else if (u.startsWith('mbit') || u === 'mbps' || u === 'mib/s') bits = n * 1e6;
  else if (u.startsWith('kbit') || u === 'kbps' || u === 'kib/s') bits = n * 1e3;
  else if (u.startsWith('byte') || u === 'b/s')                    bits = n * 8;
  else if (u.startsWith('mbyte')|| u === 'mb/s')                   bits = n * 8e6;
  else if (u.startsWith('gbyte')|| u === 'gb/s')                   bits = n * 8e9;
  // sonst: Wert schon in bit/s (bps, bit/s) oder unbekannte Einheit → direkt verwenden

  if (bits >= 1e9)       return `${(bits / 1e9).toFixed(bits >= 100e9 ? 0 : 1)} Gbit/s`;
  if (bits >= 1e6)       return `${(bits / 1e6).toFixed(bits >= 100e6 ? 0 : 1)} Mbit/s`;
  if (bits >= 1e3)       return `${(bits / 1e3).toFixed(bits >= 100e3 ? 0 : 1)} kbit/s`;
  return `${Math.round(bits)} bit/s`;
}

function _gesc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════════
//  RAW NUMBER  – Wert als große Zahl (wie rawNumbers.php)
//  Zeigt Messwert groß, farbig je Status, mit Einheit + Label
// ════════════════════════════════════════════════════════
function _rawNumber(cfg) {
  const val   = cfg.value ?? 0;
  const unit  = cfg.unit  ?? '';
  const min   = cfg.min   ?? 0;
  const max   = cfg.max   ?? 100;
  const warn  = cfg.warning  ?? 70;
  const crit  = cfg.critical ?? 90;
  const pct   = _pct(val, min, max);
  const col   = _color(pct);

  // Divisor: große Zahlen lesbar machen (z.B. Bytes → MB)
  const divide  = cfg.divide  ?? 1;
  const decimals = cfg.decimals ?? (divide !== 1 ? 1 : 0);
  const dispVal = (val / divide).toFixed(decimals);
  const dispUnit = cfg.display_unit ?? unit;

  // Schriftgröße je Länge des Wertes
  const valStr  = dispVal + dispUnit;
  const fontSize = valStr.length > 8 ? 16
                 : valStr.length > 5 ? 20
                 : 26;

  // Status-Hintergrund
  const bgCol = pct >= _pct(crit, min, max) ? 'var(--crit-bg)'
              : pct >= _pct(warn, min, max) ? 'var(--warn-bg)'
              : 'var(--ok-bg)';
  const borderCol = pct >= _pct(crit, min, max) ? 'var(--crit-border)'
                  : pct >= _pct(warn, min, max) ? 'var(--warn-border)'
                  : 'var(--ok-border)';

  return `
    <div style="
      background:${bgCol};
      border:1px solid ${borderCol};
      border-radius:4px;
      padding:6px 10px;
      min-width:80px;
      text-align:center;
      line-height:1.2;
    ">
      <!-- Hauptwert -->
      <div style="
        font-family:var(--mono);
        font-size:${fontSize}px;
        font-weight:700;
        color:${col};
        white-space:nowrap;
        letter-spacing:-0.5px;
        class="g-val"
      ">${_gesc(dispVal)}<span style="font-size:${Math.round(fontSize*0.6)}px;
        font-weight:400;margin-left:2px;color:${col};opacity:0.85">${_gesc(dispUnit)}</span>
      </div>
      <!-- Warn/Crit Schwellen -->
      <div style="
        display:flex;justify-content:center;gap:8px;
        font-family:var(--mono);font-size:8px;margin-top:3px;
      ">
        <span style="color:var(--warn)">⚠${_fmt(warn / divide)}${_gesc(dispUnit)}</span>
        <span style="color:var(--crit)">✕${_fmt(crit / divide)}${_gesc(dispUnit)}</span>
      </div>
    </div>
    <div class="nv2-label">${_gesc(cfg.metric || 'Wert')}</div>`;
}


// ════════════════════════════════════════════════════════
//  THERMOMETER  – Temperatur / Füllstand als Thermometer-SVG
// ════════════════════════════════════════════════════════
function _thermometer(cfg) {
  const val  = cfg.value ?? 0;
  const min  = cfg.min   ?? 0;
  const max  = cfg.max   ?? 100;
  const warn = cfg.warning  ?? 70;
  const crit = cfg.critical ?? 90;
  const unit = cfg.unit  ?? '°C';
  const pct  = _pct(val, min, max);
  const col  = _color(pct);

  // Thermometer-Geometrie
  const H    = 100;  // Höhe Röhre
  const X    = 20;   // X-Mitte
  const TOP  = 8;    // Y oben
  const BOT  = TOP + H; // Y unten (Kugelzentrum)
  const TUBE_W = 7;  // halbe Röhrenbreite
  const BALL_R = 10; // Kugelradius

  // Füllhöhe (von unten)
  const fillH  = (pct / 100) * H;
  const fillY  = BOT - fillH;

  // Warn/Crit-Markierungen auf der Skala
  const wY = BOT - (_pct(warn, min, max) / 100) * H;
  const cY = BOT - (_pct(crit, min, max) / 100) * H;

  // Skalenbeschriftung (5 Stufen)
  const steps = 5;
  const scale = Array.from({length: steps + 1}, (_, i) => {
    const v   = min + (max - min) * i / steps;
    const y   = BOT - (i / steps) * H;
    return { v: _fmt(v), y };
  });

  return `
    <svg viewBox="0 0 60 ${BOT + BALL_R + 12}"
         width="60" height="${BOT + BALL_R + 12}"
         style="display:block;margin:0 auto;overflow:visible">

      <!-- Röhre Hintergrund -->
      <rect x="${X - TUBE_W}" y="${TOP}" width="${TUBE_W * 2}" height="${H}"
            rx="${TUBE_W}" fill="var(--border)" stroke="var(--border-hi)" stroke-width="0.5"/>

      <!-- Füllung -->
      <rect x="${X - TUBE_W + 1}" y="${fillY}"
            width="${TUBE_W * 2 - 2}" height="${fillH + BALL_R}"
            rx="${TUBE_W - 1}"
            fill="${col}" class="g-thermo-fill"
            style="transition:height .4s,y .4s,fill .4s"/>

      <!-- Kugel Hintergrund -->
      <circle cx="${X}" cy="${BOT}" r="${BALL_R}"
              fill="var(--border)" stroke="var(--border-hi)" stroke-width="0.5"/>
      <!-- Kugel Füllung -->
      <circle cx="${X}" cy="${BOT}" r="${BALL_R - 1}"
              fill="${col}" class="g-thermo-ball"
              style="transition:fill .4s"/>

      <!-- Warn-Linie -->
      <line x1="${X - TUBE_W - 4}" y1="${wY}" x2="${X + TUBE_W + 8}" y2="${wY}"
            stroke="var(--warn)" stroke-width="1" stroke-dasharray="2,1"/>
      <text x="${X + TUBE_W + 10}" y="${wY + 2}" font-family="monospace" font-size="5.5"
            fill="var(--warn)">${_fmt(warn)}</text>

      <!-- Crit-Linie -->
      <line x1="${X - TUBE_W - 4}" y1="${cY}" x2="${X + TUBE_W + 8}" y2="${cY}"
            stroke="var(--crit)" stroke-width="1" stroke-dasharray="2,1"/>
      <text x="${X + TUBE_W + 10}" y="${cY + 2}" font-family="monospace" font-size="5.5"
            fill="var(--crit)">${_fmt(crit)}</text>

      <!-- Skalenbeschriftung links -->
      ${scale.map(s => `
        <line x1="${X - TUBE_W - 2}" y1="${s.y}" x2="${X - TUBE_W}" y2="${s.y}"
              stroke="var(--text-dim)" stroke-width="0.7"/>
        <text x="${X - TUBE_W - 4}" y="${s.y + 2}" text-anchor="end"
              font-family="monospace" font-size="5" fill="var(--text-dim)">${s.v}</text>
      `).join('')}

      <!-- Aktueller Wert -->
      <text x="${X}" y="${TOP - 2}" text-anchor="middle"
            font-family="monospace" font-size="8" font-weight="700"
            fill="${col}" class="g-val">
        ${_fmt(val)}${_gesc(unit)}
      </text>

    </svg>
    <div class="nv2-label">${_gesc(cfg.metric || 'Temperatur')}</div>`;
}


// ════════════════════════════════════════════════════════
//  GRAPH EMBED  – iframe oder <img> für externe Grafiken
// ════════════════════════════════════════════════════════
function _graph(cfg) {
  const w   = cfg.width  ?? 400;
  const h   = cfg.height ?? 200;
  const url = cfg.url || '';
  const lbl = _gesc(cfg.metric || '');

  if (!url) {
    return `<div class="g-graph g-graph-empty" style="width:${w}px;height:${h}px;
              display:flex;align-items:center;justify-content:center;
              border:1px dashed var(--border);border-radius:var(--r)">
              <span style="color:var(--text-dim);font-size:11px">Keine URL konfiguriert</span>
            </div>
            ${lbl ? `<div class="nv2-label">${lbl}</div>` : ''}`;
  }

  const inner = cfg.embed === 'img'
    ? `<img  class="g-graph-img"   src="${_gesc(url)}"
             width="${w}" height="${h}"
             style="display:block;border:0;border-radius:var(--r);max-width:none" alt="Graph">`
    : `<iframe class="g-graph-frame" src="${_gesc(url)}"
               width="${w}" height="${h}" frameborder="0"
               style="display:block;border:0;border-radius:var(--r)"
               sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>`;

  return `<div class="g-graph" style="width:${w}px;height:${h}px;overflow:hidden;border-radius:var(--r)">${inner}</div>
          ${lbl ? `<div class="nv2-label">${lbl}</div>` : ''}`;
}

// Exports für Gadget-Konfigurations-Dialog Vorschau
window._gadgetRadial       = _radial;
window._gadgetLinear       = _linear;
window._gadgetSparkline    = _sparkline;
window._gadgetWeather      = _weather;
window._gadgetRawNumber    = _rawNumber;
window._gadgetThermometer  = _thermometer;
window._gadgetGraph        = _graph;

// Vollständiges Re-Render für _gcSave in app.js
window._renderGadgetHTML = _renderGadget;

// Compat-Aliases
window.createLinearBar  = _linear;
window.createSparkline  = _sparkline;
window.createRadialGauge= _radial;
window.createWeatherLine= _weather;