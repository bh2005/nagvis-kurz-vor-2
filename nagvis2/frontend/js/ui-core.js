// NagVis 2 – ui-core.js
// Theme, Sidebar, Burger-Menü, Status-Bar, Snap-In-Panels,
// Benutzereinstellungen, Health-Check, UI-Helfer, Keyboard-Shortcuts.
'use strict';

//  SIDEBAR TOGGLE
// ═══════════════════════════════════════════════════════════════════════

window.sidebarCollapsed = false;

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

  // Sidebar-Zustand in User-Settings persistieren
  const s = loadUserSettings();
  s.sidebarDefault = sidebarCollapsed ? 'collapsed' : 'expanded';
  localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(s));
}

function restoreSidebar() {
  // User-Settings sind die einzige Quelle für den Sidebar-Startzustand
  const pref = loadUserSettings().sidebarDefault;  // Default: 'expanded'
  if (pref === 'collapsed') {
    sidebarCollapsed = true;
    document.getElementById('sidebar').classList.add('collapsed');
    document.getElementById('app').style.gridTemplateColumns = '44px 1fr';
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  BURGER MENÜ
// ═══════════════════════════════════════════════════════════════════════

window._burgerOpen = false;

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
  if (label) label.textContent = currentTheme === 'dark' ? t('light_theme') : t('dark_theme');
  const ucdIco   = document.getElementById('ucd-theme-ico');
  const ucdLabel = document.getElementById('ucd-theme-label');
  if (ucdIco)   ucdIco.textContent   = currentTheme === 'dark' ? '☀' : '☽';
  if (ucdLabel) ucdLabel.textContent = currentTheme === 'dark' ? t('light_theme') : t('dark_theme');
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
// showNodeContextMenu wird in nodes.js auf window exportiert

function setTheme(theme, save = true) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const ico   = document.getElementById('burger-theme-ico');
  const label = document.getElementById('burger-theme-label');
  if (ico)   ico.textContent   = theme === 'dark' ? '☀' : '☽';
  if (label) label.textContent = theme === 'dark' ? t('light_theme') : t('dark_theme');
  // Chip-Dropdown synchron halten
  const ucdIco   = document.getElementById('ucd-theme-ico');
  const ucdLabel = document.getElementById('ucd-theme-label');
  if (ucdIco)   ucdIco.textContent   = theme === 'dark' ? '☀' : '☽';
  if (ucdLabel) ucdLabel.textContent = theme === 'dark' ? t('light_theme') : t('dark_theme');
  if (save) {
    const s = loadUserSettings();
    s.theme = theme;
    localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(s));
  }
  updateThemeChips();
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

function renderProblemsPanel(hosts) {
  const body = document.getElementById('body-problems');
  if (!body) return;
  const problems = hosts.filter(h => {
    const l = h.state_label;
    return l !== 'UP' && l !== 'OK';
  }).sort((a, b) => b.state - a.state);

  const tab = document.getElementById('tab-problems');
  if (!problems.length) {
    body.innerHTML = `<div class="empty-hint" style="color:var(--ok)">&#10003; Keine Probleme</div>`;
    tab?.classList.remove('has-problems');
    return;
  }
  body.innerHTML = problems.map(h => {
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
  tab?.classList.toggle('has-problems', problems.some(h => (STATE_CHIP[h.state_label] ?? '') === 'crit'));
}

window.renderProblemsPanel = renderProblemsPanel;


// ═══════════════════════════════════════════════════════════════════════
//  NODE INSPECTOR
// ═══════════════════════════════════════════════════════════════════════

function openNodeInspector(obj, status) {
  const panel = document.getElementById('node-inspector');
  if (!panel) return;

  const state = status?.state_label ?? 'UNKNOWN';
  const c     = STATE_CHIP[state] ?? 'unkn';

  document.getElementById('ins-name').textContent = obj.label || obj.name || '–';

  const badge = document.getElementById('ins-state-badge');
  badge.textContent = state;
  badge.className   = `hr-tag ${c}`;

  document.getElementById('ins-output').textContent = status?.output ?? '–';

  const meta  = document.getElementById('ins-meta');
  const lines = [];
  if (status?.last_check) lines.push(`Last check: ${fmt(status.last_check)}`);
  if (obj.type)            lines.push(`Type: ${obj.type}`);
  if (obj.host_name)       lines.push(`Host: ${obj.host_name}`);
  meta.innerHTML = lines.map(l => `<div>${esc(l)}</div>`).join('');

  const actions = document.getElementById('ins-actions');
  const types   = ['host', 'service', 'hostgroup', 'servicegroup'];
  if (types.includes(obj.type)) {
    const n = esc(obj.name);
    const tp = esc(obj.type);
    actions.innerHTML =
      `<button class="tb-btn" onclick="openAcknowledgeDlg('${n}','${tp}')">&#10003; ACK</button>` +
      `<button class="tb-btn" onclick="openDowntimeDlg('${n}','${tp}')">&#128295; DT</button>`;
  } else {
    actions.innerHTML = '';
  }

  panel.classList.add('open');
}

function closeNodeInspector() {
  document.getElementById('node-inspector')?.classList.remove('open');
}

window.openNodeInspector  = openNodeInspector;
window.closeNodeInspector = closeNodeInspector;


function renderHostsPanel(hosts) {
  const body = document.getElementById('body-hosts');
  if (!hosts.length) { body.innerHTML = `<div class="empty-hint">${t('no_hosts')}</div>`; return; }
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
//  BENUTZEREINSTELLUNGEN
// ═══════════════════════════════════════════════════════════════════════

window.USER_SETTINGS_KEY = 'nv2-user-settings';

function defaultUserSettings() {
  return { theme:'dark', sidebarDefault:'expanded', kioskHideSidebar:false, kioskHideTopbar:false, kioskAutoRefresh:true, kioskInterval:60,
           notifyOnCritical:false, notifySound:true };
}

function loadUserSettings() {
  try { return { ...defaultUserSettings(), ...JSON.parse(localStorage.getItem(USER_SETTINGS_KEY) ?? '{}') }; }
  catch { return defaultUserSettings(); }
}

function saveUserSettings() {
  const notifyEnabled = document.getElementById('us-notify-critical')?.checked ?? false;
  const s = {
    theme:            currentTheme,
    sidebarDefault:   document.getElementById('us-sidebar-default')?.value    ?? 'expanded',
    kioskHideSidebar: document.getElementById('us-kiosk-hide-sidebar')?.checked ?? false,
    kioskHideTopbar:  document.getElementById('us-kiosk-hide-topbar')?.checked  ?? false,
    kioskAutoRefresh: document.getElementById('us-kiosk-auto-refresh')?.checked ?? true,
    kioskInterval:    parseInt(document.getElementById('us-kiosk-interval')?.value ?? '60'),
    notifyOnCritical: notifyEnabled,
    notifySound:      document.getElementById('us-notify-sound')?.checked ?? true,
  };
  // Berechtigung anfragen wenn gerade aktiviert
  if (notifyEnabled && Notification.permission === 'default') {
    Notification.requestPermission().then(_updateNotifyStatus);
  }
  localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(s));
  closeDlg('dlg-user-settings');
}

function openUserSettingsDlg() {
  const s = loadUserSettings();
  updateThemeChips();
  // Aktive Sprache im Dropdown vorauswählen
  const langSel = document.getElementById('us-lang-select');
  if (langSel) langSel.value = window._nv2Lang ?? 'de';
  const sd  = document.getElementById('us-sidebar-default');    if (sd)  sd.value    = s.sidebarDefault;
  const khs = document.getElementById('us-kiosk-hide-sidebar'); if (khs) khs.checked = s.kioskHideSidebar;
  const kht = document.getElementById('us-kiosk-hide-topbar');  if (kht) kht.checked = s.kioskHideTopbar;
  const kar = document.getElementById('us-kiosk-auto-refresh'); if (kar) kar.checked = s.kioskAutoRefresh;
  const ki  = document.getElementById('us-kiosk-interval');     if (ki)  ki.value    = String(s.kioskInterval);
  const nc  = document.getElementById('us-notify-critical');    if (nc)  nc.checked  = s.notifyOnCritical;
  const ns  = document.getElementById('us-notify-sound');       if (ns)  ns.checked  = s.notifySound;
  _updateNotifyStatus();
  openDlg('dlg-user-settings');
}

function _updateNotifyStatus() {
  const el = document.getElementById('us-notify-status');
  if (!el) return;
  if (!('Notification' in window)) {
    el.textContent = t('notify_not_supported');
    el.style.color = 'var(--warn)';
    return;
  }
  const perm = Notification.permission;
  if (perm === 'granted') {
    el.textContent = t('notify_granted');
    el.style.color = 'var(--ok)';
  } else if (perm === 'denied') {
    el.textContent = t('notify_denied');
    el.style.color = 'var(--crit)';
  } else {
    el.textContent = t('notify_pending');
    el.style.color = 'var(--text-dim)';
  }
}

window._requestNotifyPermission = function() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(_updateNotifyStatus);
};

function updateThemeChips() {
  document.getElementById('theme-chip-dark') ?.classList.toggle('active', currentTheme === 'dark');
  document.getElementById('theme-chip-light')?.classList.toggle('active', currentTheme === 'light');
}

window.openUserSettingsDlg = openUserSettingsDlg;
window.saveUserSettings    = saveUserSettings;
window.updateThemeChips    = updateThemeChips;


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
  const verb  = started ? t('downtime_started') : t('downtime_ended');
  const names = hostNames.slice(0, 3).map(esc).join(', ') + (hostNames.length > 3 ? ` +${hostNames.length - 3}` : '');
  banner.textContent = `🔧 ${verb}: ${names}`;
  banner.classList.add('show');
  clearTimeout(_dtBannerTimer);
  _dtBannerTimer = setTimeout(() => banner.classList.remove('show'), 4000);
}

function fmt(ts) { return ts ? new Date(ts * 1000).toLocaleTimeString(window._nv2Lang ?? 'de') : ''; }

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getNodeContainer() {
  return document.getElementById('map-canvas-wrapper') ?? document.getElementById('nv2-canvas');
}


// ═══════════════════════════════════════════════════════════════════════
//  UNDO / REDO – Positionsänderungen
// ═══════════════════════════════════════════════════════════════════════

window.NV2_HISTORY = (() => {
  const MAX = 100;
  let _undo = [], _redo = [];

  function _reapplyDOM(objectId, data, endpoint) {
    const el = document.getElementById(`nv2-${objectId}`);
    if (!el) return;
    if (endpoint === 'props' && 'size' in data) {
      const isNode   = ['host','service','hostgroup','servicegroup','map'].includes(el.dataset.type);
      const isGadget = el.dataset.type === 'gadget';
      if (typeof applySize === 'function') applySize(el, null, data.size, isNode, isGadget);
      const obj = activeMapCfg?.objects?.find(o => o.object_id === objectId);
      if (obj) obj.size = data.size;
      return;
    }
    if (el.classList.contains('nv2-line-el')) {
      el.setAttribute('x1', `${data.x}%`);  el.setAttribute('y1', `${data.y}%`);
      el.setAttribute('x2', `${data.x2}%`); el.setAttribute('y2', `${data.y2}%`);
      const vis = el.previousElementSibling;
      if (vis?.tagName?.toLowerCase() === 'line') {
        vis.setAttribute('x1', `${data.x}%`);  vis.setAttribute('y1', `${data.y}%`);
        vis.setAttribute('x2', `${data.x2}%`); vis.setAttribute('y2', `${data.y2}%`);
      }
    } else if (!el.classList.contains('nv2-wm-line')) {
      el.style.left = `${data.x}%`;
      el.style.top  = `${data.y}%`;
    }
  }

  async function _apply(entry, dir) {
    await Promise.all(entry.items.map(async item => {
      const data     = item[dir];
      const endpoint = item.endpoint ?? 'pos';
      await api(`/api/maps/${entry.mapId}/objects/${item.objectId}/${endpoint}`, 'PATCH', data);
      _reapplyDOM(item.objectId, data, endpoint);
    }));
  }

  return {
    push(entry) {
      if (!entry?.items?.length) return;
      _undo.push(entry);
      if (_undo.length > MAX) _undo.shift();
      _redo = [];
    },
    async undo() {
      if (!_undo.length) { showToast('Nichts rückgängig zu machen', 'info'); return; }
      const e = _undo.pop(); _redo.push(e);
      await _apply(e, 'before');
      showToast('Rückgängig', 'info');
    },
    async redo() {
      if (!_redo.length) { showToast('Nichts wiederherzustellen', 'info'); return; }
      const e = _redo.pop(); _undo.push(e);
      await _apply(e, 'after');
      showToast('Wiederhergestellt', 'info');
    },
    clear() { _undo = []; _redo = []; },
  };
})();


// ═══════════════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════════════

function onKeyDown(e) {
  const inInput = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
  if (e.key === 'b' && !inInput && !e.ctrlKey && !e.metaKey) toggleSidebar();
  if (e.key === 'Escape') {
    if (_kioskActive) { exitKiosk(); return; }
    if (selectedNodes?.size) { clearSelection(); return; }
    closeBurgerMenu();
    window.closeDlg('dlg-add-object'); window.closeDlg('dlg-new-map'); window.closeDlg('dlg-user-settings');
    window.closeCopyToMapDlg?.();
    closeResizeDialog(); closeContextMenu();
    if (editActive) toggleEdit();
    closeSnapin(activeSnapin);
    closeNodeInspector();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && editActive && selectedNodes?.size && !inInput) {
    e.preventDefault();
    const nodes = [...selectedNodes];
    if (!confirm(t('confirm_delete_nodes', { count: nodes.length }))) return;
    // Snapshots vor dem Löschen sichern
    const snapshots = nodes.map(n => {
      const obj = activeMapCfg?.objects?.find(o => o.object_id === n.dataset.objectId);
      return obj ? { objectId: n.dataset.objectId, fullObj: JSON.parse(JSON.stringify(obj)) } : null;
    }).filter(Boolean);
    clearSelection();
    Promise.all(nodes.map(n =>
      api(`/api/maps/${activeMapId}/objects/${n.dataset.objectId}`, 'DELETE').then(() => n.remove())
    )).then(() => {
      if (snapshots.length) window.NV2_HISTORY?.push({ type: 'delete', mapId: activeMapId, items: snapshots });
    });
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && editActive && !inInput) { e.preventDefault(); window.NV2_HISTORY?.undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y' && editActive && !inInput) { e.preventDefault(); window.NV2_HISTORY?.redo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'c' && editActive && !inInput) { e.preventDefault(); window.NV2_CLIPBOARD?.copy(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'v' && editActive && !inInput) { e.preventDefault(); window.NV2_CLIPBOARD?.paste(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd' && editActive && !inInput) { e.preventDefault(); window.NV2_CLIPBOARD?.duplicate(); return; }
  if (e.key === 'F11' && activeMapId) { e.preventDefault(); toggleKiosk(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'e' && activeMapId) { e.preventDefault(); toggleEdit(); }
  if (e.key === 'r' && activeMapId && !e.ctrlKey && !e.metaKey && !inInput) wsClient?.forceRefresh();
  if (e.key === 'm' && activeMapId && !e.ctrlKey && !e.metaKey && !inInput) window.NV2_MINIMAP?.toggle();
}


// ═══════════════════════════════════════════════════════════════════════

window.toggleBurgerMenu    = toggleBurgerMenu;
window.closeBurgerMenu     = closeBurgerMenu;
window.toggleSnapin        = toggleSnapin;
window.closeSnapin         = closeSnapin;
window.openUserSettingsDlg   = openUserSettingsDlg;
window.saveUserSettings      = saveUserSettings;
window.updateThemeChips      = updateThemeChips;
window._updateNotifyStatus   = _updateNotifyStatus;
window.loadUserSettings      = loadUserSettings;
window.openDlg  = id => document.getElementById(id)?.classList.add('show');
window.closeDlg = id => {
  document.getElementById(id)?.classList.remove('show');
  document.querySelectorAll(`#${id} input[type=text], #${id} textarea`).forEach(i => i.value = '');
};


// ═══════════════════════════════════════════════════════════════════════
//  TOAST-BENACHRICHTIGUNGEN
// ═══════════════════════════════════════════════════════════════════════

function showToast(msg, type = 'ok', duration = 3500) {
  let container = document.getElementById('nv2-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'nv2-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `nv2-toast nv2-toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

window.showToast = showToast;


// ═══════════════════════════════════════════════════════════════════════
//  LOG VIEWER
// ═══════════════════════════════════════════════════════════════════════

async function openLogViewer() {
  openDlg('dlg-log');
  await loadLog();
}

async function loadLog() {
  const lines     = document.getElementById('log-lines-sel')?.value   || 500;
  const levelSel  = document.getElementById('log-level-sel')?.value   || '';
  const textFilter = document.getElementById('log-text-filter')?.value || '';
  const pre       = document.getElementById('log-pre');
  const info      = document.getElementById('log-info');

  if (pre) pre.textContent = t('loading');

  try {
    const params = new URLSearchParams({ lines });
    if (levelSel) params.set('level', levelSel);
    const r    = await fetch('/api/logs?' + params.toString());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();

    let logLines = data.lines || [];

    // Clientseitiger Freitext-Filter
    if (textFilter) {
      const f = textFilter.toLowerCase();
      logLines = logLines.filter(l => l.toLowerCase().includes(f));
    }

    if (pre) {
      pre.textContent = logLines.length ? logLines.join('\n') : t('log_no_entries');
      // Ans Ende scrollen
      pre.scrollTop = pre.scrollHeight;
    }
    if (info) {
      info.textContent = t('log_lines_shown', { count: logLines.length, buffered: data.buffered });
    }
  } catch (e) {
    if (pre)  pre.textContent  = t('log_error', { msg: e.message });
    if (info) info.textContent = '';
  }
}

function downloadLog() {
  const lines    = document.getElementById('log-lines-sel')?.value || 500;
  const levelSel = document.getElementById('log-level-sel')?.value || '';
  const params   = new URLSearchParams({ lines, download: 'true' });
  if (levelSel) params.set('level', levelSel);
  window.open('/api/logs?' + params.toString(), '_blank');
}

window.openLogViewer = openLogViewer;
window.loadLog       = loadLog;

// ═══════════════════════════════════════════════════════════════════════
//  ABOUT-DIALOG
// ═══════════════════════════════════════════════════════════════════════

async function openAboutDlg() {
  const dlg = document.getElementById('dlg-about');
  if (!dlg) return;

  // Version aus Health-Endpoint laden
  try {
    const h = await api('/api/v1/health');
    const vEl = document.getElementById('about-version');
    if (vEl && h?.version) vEl.textContent = h.version;
  } catch { /* bleibt bei "2.0-beta" */ }

  // Changelog-Button: toggle
  const btn  = document.getElementById('about-changelog-btn');
  const view = document.getElementById('about-changelog-view');
  let clLoaded = false;

  btn.onclick = async () => {
    if (view.style.display === 'none') {
      if (!clLoaded) {
        view.textContent = t('loading');
        try {
          const r = await fetch('/api/v1/changelog');
          if (!r.ok) throw new Error(r.status);
          view.textContent = await r.text();
        } catch {
          view.textContent = t('changelog_failed');
        }
        clLoaded = true;
      }
      view.style.display = 'block';
      btn.textContent = t('changelog_hide');
    } else {
      view.style.display = 'none';
      btn.textContent = t('changelog_show');
    }
  };

  // Reset bei erneutem Öffnen
  view.style.display = 'none';
  btn.textContent = t('changelog_show');
  clLoaded = false;

  dlg.style.display = 'flex';
}

window.openAboutDlg = openAboutDlg;
window.downloadLog   = downloadLog;

// ═══════════════════════════════════════════════════════════════════════
//  SPRACH-PICKER (aufgerufen aus index.html)
// ═══════════════════════════════════════════════════════════════════════

window.nv2SetLangFromSelect = async function(code) {
  try {
    const result = await setLang(code);
    showToast(t('lang_applied', { name: result.name }), 'ok');
  } catch {
    showToast(t('lang_error', { code }), 'error');
  }
};

window.nv2ImportLangPack = async function(file) {
  if (!file) return;
  const result = await importLangPack(file);
  if (result.success) {
    showToast(t('lang_pack_imported', { name: result.name, count: result.count }), 'ok');
    const sel = document.getElementById('us-lang-select');
    if (sel) {
      if (!sel.querySelector(`option[value="${result.code}"]`)) {
        const opt = document.createElement('option');
        opt.value = result.code;
        opt.textContent = result.name;
        sel.appendChild(opt);
      }
      sel.value = result.code;
    }
  } else {
    showToast(result.error ?? t('lang_pack_invalid'), 'error');
  }
};