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

  localStorage.setItem('nv2-sidebar', sidebarCollapsed ? '1' : '0');
}

function restoreSidebar() {
  if (localStorage.getItem('nv2-sidebar') === '1') {
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
  if (label) label.textContent = currentTheme === 'dark' ? 'Light-Theme' : 'Dark-Theme';
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
  if (label) label.textContent = theme === 'dark' ? 'Light-Theme' : 'Dark-Theme';
  if (save) localStorage.setItem('nv2-theme', theme);
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
//  BENUTZEREINSTELLUNGEN
// ═══════════════════════════════════════════════════════════════════════

window.USER_SETTINGS_KEY = 'nv2-user-settings';

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
  const sd  = document.getElementById('us-sidebar-default');    if (sd)  sd.value    = s.sidebarDefault;
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

function getNodeContainer() {
  return document.getElementById('map-canvas-wrapper') ?? document.getElementById('nv2-canvas');
}


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
    closeResizeDialog(); closeContextMenu();
    if (editActive) toggleEdit();
    closeSnapin(activeSnapin);
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && editActive && selectedNodes?.size && !inInput) {
    e.preventDefault();
    const nodes = [...selectedNodes];
    if (!confirm(`${nodes.length} Objekte entfernen?`)) return;
    clearSelection();
    Promise.all(nodes.map(n =>
      api(`/api/maps/${activeMapId}/objects/${n.dataset.objectId}`, 'DELETE').then(() => n.remove())
    ));
  }
  if (e.key === 'F11' && activeMapId) { e.preventDefault(); toggleKiosk(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'e' && activeMapId) { e.preventDefault(); toggleEdit(); }
  if (e.key === 'r' && activeMapId && !e.ctrlKey && !e.metaKey && !inInput) wsClient?.forceRefresh();
}


// ═══════════════════════════════════════════════════════════════════════

window.toggleBurgerMenu    = toggleBurgerMenu;
window.closeBurgerMenu     = closeBurgerMenu;
window.toggleSnapin        = toggleSnapin;
window.closeSnapin         = closeSnapin;
window.openUserSettingsDlg = openUserSettingsDlg;
window.saveUserSettings    = saveUserSettings;
window.updateThemeChips    = updateThemeChips;
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