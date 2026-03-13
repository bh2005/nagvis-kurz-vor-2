// js/gadget-renderer.js
// Reine CSS + SVG – Linear, Sparkline, Weather-Line + Radial
// 100% Vanilla, perfekt für Checkmk-Style Dark/Light

export function createGadget(obj) {
  const el = document.createElement('div');
  el.id = `nv2-${obj.object_id}`;
  el.className = `nv2-node gadget ${obj.gadget_config?.type || 'radial'}`;
  el.dataset.objectId = obj.object_id;
  el.dataset.type = obj.gadget_config?.type || 'radial';
  el.dataset.metric = obj.gadget_config?.metric || '';

  const cfg = obj.gadget_config || { value: 0, min: 0, max: 100, unit: '%', warning: 70, critical: 90 };

  switch (cfg.type) {
    case 'linear':
      el.innerHTML = createLinearBar(cfg);
      break;
    case 'sparkline':
      el.innerHTML = createSparkline(cfg);
      break;
    case 'weather':
      el.innerHTML = createWeatherLine(cfg, obj);
      break;
    default: // radial
      el.innerHTML = createRadialGauge(cfg);
  }

  el.addEventListener('mouseenter', () => showTooltip(el, obj));
  return el;
}

export function updateGadget(el, data) {
  const type = el.dataset.type;
  if (type === 'linear') {
    const bar = el.querySelector('.bar');
    const label = el.querySelector('.label');
    bar.style.width = `${Math.min(100, data.value)}%`;
    label.textContent = `${Math.round(data.value)}${data.unit || ''}`;
  } else if (type === 'sparkline') {
    updateSparkline(el, data.value);
  } else if (type === 'weather') {
    updateWeatherLine(el, data.value);
  } else {
    // radial
    const fg = el.querySelector('.fg');
    const val = el.querySelector('.value');
    const pct = Math.min(100, Math.max(0, (data.value - 0) / 100 * 100));
    fg.style.strokeDasharray = `${pct}, 100`;
    fg.style.stroke = getGaugeColor(pct);
    val.textContent = `${Math.round(data.value)}${data.unit || ''}`;
  }
}

// ── Hilfsfunktionen ─────────────────────────────────────────────

function createLinearBar(cfg) {
  const w = Math.min(100, ((cfg.value - cfg.min) / (cfg.max - cfg.min)) * 100);
  return `
    <div class="linear-gauge">
      <div class="bar" style="width:${w}%"></div>
      <div class="threshold warning" style="left:${cfg.warning}%"></div>
      <div class="threshold critical" style="left:${cfg.critical}%"></div>
      <span class="label">${Math.round(cfg.value)}${cfg.unit || ''}</span>
    </div>
    <div class="nv2-label">${esc(cfg.metric || 'Linear')}</div>`;
}

function createSparkline(cfg) {
  const history = cfg.history || [cfg.value];
  const points = history.map((v,i) => `${i*5},${40 - v/2.5}`).join(' ');
  return `
    <svg class="sparkline" viewBox="0 0 100 40">
      <polyline points="${points}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <div class="nv2-label">${esc(cfg.metric || 'Sparkline')}</div>`;
}

function createWeatherLine(cfg, obj) {
  // obj muss fromX, fromY, toX, toY haben (in %)
  const thickness = Math.min(8, Math.max(1, cfg.value / 20)); // Wert = Traffic → Dicke
  return `
    <svg class="weather-line" viewBox="0 0 100 100" style="width:120px;height:80px">
      <line x1="${obj.fromX || 20}" y1="${obj.fromY || 50}" 
            x2="${obj.toX || 80}" y2="${obj.toY || 50}" 
            stroke="${getGaugeColor(cfg.value)}" stroke-width="${thickness}" stroke-linecap="round"/>
      <polygon points="90,45 100,50 90,55" fill="${getGaugeColor(cfg.value)}"/>
    </svg>
    <div class="nv2-label">${esc(cfg.metric || 'Flow')}</div>`;
}

function createRadialGauge(cfg) {
  const pct = Math.min(100, ((cfg.value - cfg.min) / (cfg.max - cfg.min)) * 100);
  return `
    <div class="radial-gauge">
      <svg viewBox="0 0 36 36">
        <path class="bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        <path class="fg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              style="stroke-dasharray: ${pct}, 100; stroke: ${getGaugeColor(pct)}"/>
        <text x="18" y="20.5" class="value">${Math.round(cfg.value)}${cfg.unit || ''}</text>
      </svg>
    </div>
    <div class="nv2-label">${esc(cfg.metric || 'Gauge')}</div>`;
}

function updateSparkline(el, newValue) {
  const svg = el.querySelector('svg');
  let history = el.dataset.history ? JSON.parse(el.dataset.history) : [];
  history.push(newValue);
  if (history.length > 20) history.shift();
  el.dataset.history = JSON.stringify(history);

  const points = history.map((v,i) => `${i*5},${40 - v/2.5}`).join(' ');
  svg.querySelector('polyline').setAttribute('points', points);
}

function updateWeatherLine(el, newValue) {
  const line = el.querySelector('line');
  const arrow = el.querySelector('polygon');
  const color = getGaugeColor(newValue);
  const thickness = Math.min(8, Math.max(1, newValue / 20));

  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', thickness);
  arrow.setAttribute('fill', color);
}

function getGaugeColor(pct) {
  if (pct > 85) return 'var(--crit)';
  if (pct > 65) return 'var(--warn)';
  return 'var(--ok)';
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}