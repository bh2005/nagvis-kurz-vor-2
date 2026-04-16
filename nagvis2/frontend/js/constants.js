// NagVis 2 – constants.js
// Konstanten + Helper-Funktionen. Alles auf window.* für Cross-Script-Sichtbarkeit.
'use strict';

window.STATE_CLS = {
  UP:'nv2-ok', OK:'nv2-ok', WARNING:'nv2-warning', CRITICAL:'nv2-critical',
  UNKNOWN:'nv2-unknown', DOWN:'nv2-critical', UNREACHABLE:'nv2-critical', PENDING:'nv2-unknown',
};
window.STATE_BADGE = {
  UP:'✓', OK:'✓', WARNING:'!', CRITICAL:'✕',
  UNKNOWN:'?', DOWN:'↓', UNREACHABLE:'↕', PENDING:'…',
};
window.STATE_CHIP = {
  UP:'ok', OK:'ok', WARNING:'warn', CRITICAL:'crit',
  DOWN:'crit', UNREACHABLE:'crit', UNKNOWN:'unkn', PENDING:'unkn',
};
window.ICONS_FALLBACK = {
  server:'🖥', router:'🌐', switch:'🔀', firewall:'🔥',
  storage:'💾', database:'🗄', ups:'⚡', ap:'📡', map:'🗺', default:'⬡',
};
window.KNOWN_ICONSETS = ['std_small','server','router','switch','firewall','database','storage','ups','ap'];
window.customIconsets = JSON.parse(localStorage.getItem('nv2-custom-iconsets') || '[]');

window.ICON_SVG = {
  ok:       `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#13d38e"/><path d="M11 18l5 5 9-9" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  warning:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#ffa726"/><text x="18" y="24" text-anchor="middle" font-size="20" font-weight="bold" fill="#fff">!</text></svg>`,
  critical: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#f44336"/><path d="M12 12l12 12M24 12l-12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  unknown:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#9e9e9e"/><text x="18" y="24" text-anchor="middle" font-size="20" font-weight="bold" fill="#fff">?</text></svg>`,
  pending:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#9e9e9e"/><text x="18" y="24" text-anchor="middle" font-size="16" fill="#fff">…</text></svg>`,
  down:     `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#f44336"/><text x="18" y="24" text-anchor="middle" font-size="18" font-weight="bold" fill="#fff">↓</text></svg>`,
  downtime: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#42a5f5"/><rect x="12" y="11" width="5" height="14" rx="2" fill="#fff"/><rect x="19" y="11" width="5" height="14" rx="2" fill="#fff"/></svg>`,
};
window.ICONSET_SHAPE = {
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

function iconSrc(iconset, stateLabel, inDowntime) {
  if (inDowntime) return { type: 'img', src: svgToDataUri(ICON_SVG.downtime) };
  const stateKey = !stateLabel ? 'unknown'
    : stateLabel === 'UP' || stateLabel === 'OK'        ? 'ok'
    : stateLabel === 'WARNING'                           ? 'warning'
    : stateLabel === 'CRITICAL' || stateLabel === 'DOWN' ? 'critical'
    : stateLabel === 'UNREACHABLE'                       ? 'critical'
    : stateLabel === 'PENDING'                           ? 'pending'
    : 'unknown';
  return { type: 'img', src: svgToDataUri(ICON_SVG[stateKey] ?? ICON_SVG.unknown) };
}

function updateNodeIcon(el, stateLabel, inDowntime) {
  const ring = el.querySelector('.nv2-ring');
  if (!ring) return;
  const { src } = iconSrc(null, stateLabel, inDowntime);
  const img = ring.querySelector('img.nv2-icon');
  if (img) img.src = src;
}

// 'use strict' + indirektes eval legt function-Deklarationen nicht auf globalThis →
// explizit exportieren damit Tests und andere Scripts sie als window.* finden
window.svgToDataUri   = svgToDataUri;
window.iconSrc        = iconSrc;
window.updateNodeIcon = updateNodeIcon;