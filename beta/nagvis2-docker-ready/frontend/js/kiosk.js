// NagVis 2 – kiosk.js
// Kiosk-User-Verwaltung (CRUD, localStorage + Backend-Sync),
// Token-Login (?kiosk=<token>), Map-Rotation, Admin-Dialog,
// F11-Fullscreen-Kiosk (enterKiosk / exitKiosk).
'use strict';

//  KIOSK-USER-VERWALTUNG (localStorage + Backend-Sync)
// ════════════════════════════════════════════════════════════════════════

async function _loadKioskUsers() {
  try {
    const remote = await api('/api/kiosk-users');
    if (remote) {
      _kioskUsers = remote;
      localStorage.setItem('nv2-kiosk-users', JSON.stringify(_kioskUsers));
      return;
    }
  } catch { /* offline – Fallback */ }
  _kioskUsers = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
}

async function _persistKioskUser(user) {
  const idx = _kioskUsers.findIndex(u => u.id === user.id);
  if (idx >= 0) _kioskUsers[idx] = user;
  else          _kioskUsers.push(user);
  localStorage.setItem('nv2-kiosk-users', JSON.stringify(_kioskUsers));

  if (_demoMode) return user;
  try {
    if (idx >= 0) return await api(`/api/kiosk-users/${user.id}`, 'PUT', user);
    else          return await api('/api/kiosk-users', 'POST', user);
  } catch { return user; }
}

async function _removeKioskUser(uid) {
  _kioskUsers = _kioskUsers.filter(u => u.id !== uid);
  localStorage.setItem('nv2-kiosk-users', JSON.stringify(_kioskUsers));
  if (!_demoMode) {
    try { await api(`/api/kiosk-users/${uid}`, 'DELETE'); } catch { }
  }
}


// ════════════════════════════════════════════════════════════════════════
//  KIOSK-SESSION (Token-Login via ?kiosk=<token>)
// ════════════════════════════════════════════════════════════════════════

async function _initKioskSession(token) {
  let user = null;

  // 1. Restliche App-Init durchführen (brauchen wir für openMap etc.)
  document.getElementById('btn-refresh')   ?.addEventListener('click', () => wsClient?.forceRefresh());
  document.getElementById('btn-add-host')  ?.addEventListener('click', () => openDlg('dlg-add-object'));
  document.getElementById('btn-kiosk')     ?.addEventListener('click', toggleKiosk);
  document.getElementById('bg-file-input') ?.addEventListener('change', e => {
    if (e.target.files[0]) uploadBg(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btn-sidebar-toggle-foot')?.addEventListener('click', toggleSidebar);
  document.addEventListener('click', e => {
    if (_burgerOpen && !e.target.closest('#burger-wrap')) closeBurgerMenu();
  });
  document.getElementById('nv2-canvas')?.addEventListener('click', onCanvasClick);
  setupDragDrop();
  document.addEventListener('keydown', onKeyDown);
  document.getElementById('btn-zoom-in') ?.addEventListener('click', () => NV2_ZOOM.zoomIn());
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => NV2_ZOOM.zoomOut());

  await detectDemoMode();

  // 2. Token auflösen
  if (!_demoMode) {
    try {
      const r = await fetch(
        `/api/kiosk-users/resolve?token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (r.ok) user = await r.json();
    } catch { /* Backend nicht erreichbar */ }
  }
  if (!user) {
    const local = JSON.parse(localStorage.getItem('nv2-kiosk-users') || '[]');
    user = local.find(u => u.token === token) || null;
  }

  // 3. Ungültiger Token
  if (!user) {
    document.body.innerHTML = `
      <div style="display:grid;place-items:center;height:100vh;
                  font-family:var(--mono,monospace);
                  color:var(--crit,#f44336);background:var(--bg,#1a1a1a)">
        <div style="text-align:center">
          <div style="font-size:48px;margin-bottom:16px">⛔</div>
          <div style="font-size:16px;font-weight:600">Ungültiger Kiosk-Token</div>
          <div style="font-size:11px;color:var(--text-dim,#555);margin-top:8px">
            Token: ${esc(token.substring(0, 8))}…
          </div>
        </div>
      </div>`;
    return;
  }

  _kioskSession = user;

  // 4. Maps laden
  await loadMaps();

  // 5. UI in Kiosk-Modus versetzen
  _applyKioskSessionUI();

  // 6. Rotation starten
  _startKioskRotation();

  pollHealth();
  setInterval(pollHealth, 30_000);
}

function _applyKioskSessionUI() {
  // Edit-Mode dauerhaft sperren
  editActive = false;

  // Bearbeitungs-UI ausblenden
  const hideIds = [
    'btn-edit', 'btn-add-host', 'btn-menu',
    'burger-btn-rename', 'btn-delete-map', 'btn-bg-upload',
  ];
  hideIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Kiosk-Badge in Topbar
  const chip = document.createElement('span');
  chip.id = 'kiosk-session-badge';
  chip.textContent = `⬛ ${_kioskSession.label}`;
  document.getElementById('topbar')?.appendChild(chip);

  // Fortschrittsbalken (Linie am unteren Rand)
  const prog = document.createElement('div');
  prog.id = 'kiosk-rot-progress';
  prog.innerHTML = `<div id="kiosk-rot-bar"></div>`;
  document.body.appendChild(prog);
  _kioskProgress = prog;

  // Kontextmenüs deaktivieren (readonly)
  window.showNodeContextMenu = () => {};
  window.showViewContextMenu = () => {};
}


// ════════════════════════════════════════════════════════════════════════
//  KIOSK-ROTATION
// ════════════════════════════════════════════════════════════════════════

function _startKioskRotation() {
  if (_kioskRotTimer) clearInterval(_kioskRotTimer);

  const u     = _kioskSession;
  const order = (u.order?.length ? u.order : u.maps) || [];

  if (order.length === 0) {
    setStatusBar('⚠ Kiosk: keine Maps in der Rotations-Liste');
    return;
  }

  _kioskRotIdx = 0;
  _loadKioskMap(order[0]);

  const ms = Math.max(5000, (u.interval || 30) * 1000);
  _animateKioskProgress(ms);

  _kioskRotTimer = setInterval(() => {
    _kioskRotIdx = (_kioskRotIdx + 1) % order.length;
    _loadKioskMap(order[_kioskRotIdx]);
    _animateKioskProgress(ms);
  }, ms);
}

function _loadKioskMap(mapId) {
  openMap(mapId);
}

function _stopKioskRotation() {
  if (_kioskRotTimer) { clearInterval(_kioskRotTimer); _kioskRotTimer = null; }
}

function _animateKioskProgress(durationMs) {
  const bar = document.getElementById('kiosk-rot-bar');
  if (!bar) return;
  bar.style.transition = 'none';
  bar.style.width      = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.style.transition = `width ${durationMs}ms linear`;
    bar.style.width      = '100%';
  }));
}


// ════════════════════════════════════════════════════════════════════════
//  KIOSK-USER-VERWALTUNGS-DIALOG (für Admins)
// ════════════════════════════════════════════════════════════════════════

async function openKioskUsersDlg() {
  await _loadKioskUsers();
  const maps = (await api('/api/maps')) || [];

  document.getElementById('dlg-kiosk-users')?.remove();

  const dlg = document.createElement('div');
  dlg.id = 'dlg-kiosk-users';
  dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:660px;max-height:82vh;
         display:flex;flex-direction:column;gap:0">

      <h3 style="flex-shrink:0">⬛ Kiosk-User verwalten</h3>

      <div id="kiosk-user-list" style="flex:1;overflow-y:auto;min-height:60px;
           border:1px solid var(--border);border-radius:var(--r);margin-bottom:14px">
      </div>

      <div style="flex-shrink:0;border-top:1px solid var(--border);padding-top:12px">
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;
             text-transform:uppercase;color:var(--text-dim);margin-bottom:8px">
          Neuen Kiosk-User anlegen
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label class="f-label">Name / Label</label>
            <input id="ki-label" class="f-input" type="text"
                   placeholder="z.B. Leitwarte TV-1">
          </div>
          <div>
            <label class="f-label">Intervall (Sekunden)</label>
            <input id="ki-interval" class="f-input" type="number"
                   value="30" min="5" max="3600">
          </div>
        </div>

        <label class="f-label">Maps (Whitelist &amp; Rotations-Reihenfolge)</label>
        <div id="ki-map-list" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;
             padding:8px;background:var(--bg);border:1px solid var(--border);
             border-radius:var(--r);min-height:36px">
          ${maps.map(m => `
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;
                padding:3px 8px;border-radius:var(--r-sm);background:var(--bg-surf);
                border:1px solid var(--border);font-size:11px;user-select:none">
              <input type="checkbox" value="${esc(m.id)}"
                     style="accent-color:var(--acc)">
              ${esc(m.title)}
            </label>`).join('')}
          ${!maps.length ? '<span style="font-size:11px;color:var(--text-dim)">Keine Maps vorhanden</span>' : ''}
        </div>
      </div>

      <div class="dlg-foot" style="flex-shrink:0;margin-top:10px">
        <button class="btn-cancel"
                onclick="document.getElementById('dlg-kiosk-users').remove()">
          Schließen
        </button>
        <button class="btn-ok" onclick="_kioskCreateUser(this)">
          ＋ User anlegen
        </button>
      </div>
    </div>`;

  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
  document.body.appendChild(dlg);
  _renderKioskUserList(maps);
}

function _renderKioskUserList(maps) {
  const el = document.getElementById('kiosk-user-list');
  if (!el) return;

  if (!_kioskUsers.length) {
    el.innerHTML = `<div class="empty-hint">Noch keine Kiosk-User angelegt.</div>`;
    return;
  }

  el.innerHTML = _kioskUsers.map(u => {
    const mapLabels = (u.maps || []).map(mid => {
      const m = maps.find(x => x.id === mid);
      return m ? esc(m.title) : esc(mid);
    }).join(', ') || '–';

    const tokenBase = `${location.origin}${location.pathname}`;
    const tokenUrl  = u.token ? `${tokenBase}?kiosk=${u.token}` : '(nur serverseitig)';
    const hasToken  = !!u.token;

    return `
      <div style="background:var(--bg-surf);border-bottom:1px solid var(--border);
          padding:10px 14px;transition:background var(--t)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12.5px;font-weight:600;color:var(--text)">
              ${esc(u.label)}
            </div>
            <div style="font-size:10px;color:var(--text-dim);font-family:var(--mono);
                 margin-top:2px">
              ${mapLabels}
              <span style="color:var(--border-hi)"> · </span>
              ${u.interval || 30}s Intervall
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="manage-btn" title="Bearbeiten"
                    onclick="_kioskEditUser('${esc(u.id)}')">✏</button>
            <button class="manage-btn manage-btn-danger" title="Löschen"
                    onclick="_kioskDeleteUser('${esc(u.id)}')">🗑</button>
          </div>
        </div>
        ${hasToken ? `
        <div style="display:flex;align-items:center;gap:6px;margin-top:7px">
          <input readonly value="${esc(tokenUrl)}" onclick="this.select()"
            style="flex:1;font-size:10px;font-family:var(--mono);
                   background:var(--bg);border:1px solid var(--border);
                   border-radius:var(--r-sm);padding:3px 7px;color:var(--text-mid);
                   cursor:text;outline:none">
          <button class="manage-btn" title="URL kopieren"
                  onclick="navigator.clipboard.writeText('${esc(tokenUrl)}')
                    .then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='📋',1200)})
                    .catch(()=>this.textContent='!')">📋</button>
          <a href="${esc(tokenUrl)}" target="_blank" class="manage-btn"
             title="Im neuen Tab öffnen" style="text-decoration:none;display:flex;
             align-items:center;justify-content:center">⬛</a>
        </div>` : `
        <div style="font-size:9px;color:var(--text-dim);font-family:var(--mono);margin-top:5px">
          Token serverseitig gespeichert
        </div>`}
      </div>`;
  }).join('');
}

window._kioskCreateUser = async function(btn) {
  const label    = document.getElementById('ki-label')?.value.trim();
  const interval = parseInt(document.getElementById('ki-interval')?.value) || 30;
  const checked  = [...document.querySelectorAll('#ki-map-list input:checked')]
                     .map(i => i.value);

  if (!label)          { document.getElementById('ki-label')?.focus(); return; }
  if (!checked.length) { alert('Bitte mindestens eine Map auswählen.'); return; }

  const localToken = Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map(b => b.toString(36)).join('').slice(0, 24);

  const newUser = {
    id: (typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36),
    token:    localToken,
    label, interval,
    maps:  checked,
    order: checked,
  };

  const saved = await _persistKioskUser(newUser);
  if (saved?.id) Object.assign(newUser, saved);

  const maps = (await api('/api/maps')) || [];
  _renderKioskUserList(maps);

  const lbl = document.getElementById('ki-label');
  if (lbl) lbl.value = '';
  document.querySelectorAll('#ki-map-list input[type=checkbox]')
    .forEach(c => c.checked = false);
  setStatusBar(`✔ Kiosk-User „${label}" angelegt`);
};

window._kioskDeleteUser = async function(uid) {
  if (!confirm('Kiosk-User wirklich löschen?\nDie Token-URL wird ungültig.')) return;
  await _removeKioskUser(uid);
  const maps = (await api('/api/maps')) || [];
  _renderKioskUserList(maps);
};

window._kioskEditUser = async function(uid) {
  const user = _kioskUsers.find(u => u.id === uid);
  if (!user) return;
  const maps = (await api('/api/maps')) || [];

  document.getElementById('dlg-kiosk-edit')?.remove();
  const dlg = document.createElement('div');
  dlg.id = 'dlg-kiosk-edit';
  dlg.className = 'dlg-overlay show';
  dlg.innerHTML = `
    <div class="dlg-box" style="width:500px">
      <h3>✏ Kiosk-User bearbeiten</h3>

      <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:10px">
        <div>
          <label class="f-label">Name / Label</label>
          <input id="kie-label" class="f-input" value="${esc(user.label)}">
        </div>
        <div>
          <label class="f-label">Intervall (Sekunden)</label>
          <input id="kie-interval" class="f-input" type="number"
                 value="${user.interval || 30}" min="5">
        </div>
      </div>

      <label class="f-label">Maps &amp; Rotations-Reihenfolge</label>
      <p style="font-size:9px;color:var(--text-dim);font-family:var(--mono);
         margin:3px 0 6px">
        Reihenfolge der Häkchen = Rotations-Reihenfolge
      </p>
      <div id="kie-map-list"
           style="display:flex;flex-direction:column;gap:3px;padding:8px;
                  background:var(--bg);border:1px solid var(--border);
                  border-radius:var(--r);max-height:260px;overflow-y:auto">
        ${maps.map(m => {
          const inList = user.maps?.includes(m.id);
          const pos    = user.order?.indexOf(m.id) ?? -1;
          return `
          <label style="display:flex;align-items:center;gap:8px;padding:5px 8px;
              border-radius:var(--r-sm);background:var(--bg-surf);
              border:1px solid var(--border);cursor:pointer;user-select:none">
            <input type="checkbox" value="${esc(m.id)}"
                   ${inList ? 'checked' : ''}
                   style="accent-color:var(--acc)">
            <span style="flex:1;font-size:12px">${esc(m.title)}</span>
            <span style="font-size:9px;color:var(--text-dim);font-family:var(--mono)">
              ${inList && pos >= 0 ? `#${pos + 1}` : ''}
            </span>
          </label>`;
        }).join('')}
        ${!maps.length ? '<div class="empty-hint">Keine Maps</div>' : ''}
      </div>

      <div class="dlg-foot" style="margin-top:12px">
        <button class="btn-cancel"
                onclick="document.getElementById('dlg-kiosk-edit').remove()">
          Abbrechen
        </button>
        <button class="btn-ok"
                onclick="_kioskSaveEdit('${esc(uid)}', this)">
          💾 Speichern
        </button>
      </div>
    </div>`;

  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.remove(); });
  document.body.appendChild(dlg);
};

window._kioskSaveEdit = async function(uid, btn) {
  const user = _kioskUsers.find(u => u.id === uid);
  if (!user) return;

  const label    = document.getElementById('kie-label')?.value.trim();
  const interval = parseInt(document.getElementById('kie-interval')?.value) || 30;
  const checked  = [...document.querySelectorAll('#kie-map-list input:checked')]
                     .map(i => i.value);

  if (!label) { document.getElementById('kie-label')?.focus(); return; }

  user.label    = label;
  user.interval = interval;
  user.maps     = checked;
  user.order    = checked;

  await _persistKioskUser(user);
  btn.closest('.dlg-overlay')?.remove();

  const maps = (await api('/api/maps')) || [];
  _renderKioskUserList(maps);
  setStatusBar(`✔ Kiosk-User „${label}" gespeichert`);
};

window.openKioskUsersDlg = openKioskUsersDlg;

// ═══════════════════════════════════════════════════════════════════════
//  KIOSK-MODUS (F11 / manueller Toggle)
// ═══════════════════════════════════════════════════════════════════════

let _kioskActive = false, _kioskRefreshTimer = null;

function toggleKiosk() { _kioskActive ? exitKiosk() : enterKiosk(); }

function enterKiosk() {
  if (!activeMapId) return;
  _kioskActive = true;
  const settings = loadUserSettings();
  const overlay  = document.getElementById('kiosk-overlay');
  const wrap     = document.getElementById('kiosk-canvas-wrap');
  const canvas   = document.getElementById('nv2-canvas');
  const svg      = document.getElementById('nv2-lines-svg');
  const banner   = document.getElementById('nv2-edit-banner');
  const snapCont = document.getElementById('snapin-container');
  const snapTabs = document.getElementById('snap-tabs');
  wrap.appendChild(canvas);
  if (svg)      wrap.appendChild(svg);
  if (banner)   wrap.appendChild(banner);
  if (snapCont) wrap.appendChild(snapCont);
  if (snapTabs) wrap.appendChild(snapTabs);
  overlay.style.display = 'flex';
  if (settings.kioskHideSidebar) document.getElementById('sidebar').style.display = 'none';
  if (settings.kioskHideTopbar)  document.getElementById('topbar').style.display  = 'none';
  const lbl = document.getElementById('burger-kiosk-label');
  if (lbl) lbl.textContent = 'Kiosk beenden';
  document.getElementById('btn-kiosk')?.classList.add('on');
  _updateKioskStatus();
  if (settings.kioskAutoRefresh) {
    _kioskRefreshTimer = setInterval(() => { wsClient?.forceRefresh(); _updateKioskStatus(); }, settings.kioskInterval * 1000);
  }
  document.documentElement.requestFullscreen?.().catch(() => {});
  _setupKioskMouseHide();
}

function exitKiosk() {
  _kioskActive = false;
  clearInterval(_kioskRefreshTimer);
  _kioskRefreshTimer = null;
  const overlay  = document.getElementById('kiosk-overlay');
  const mapArea  = document.getElementById('map-area');
  const canvas   = document.getElementById('nv2-canvas');
  const svg      = document.getElementById('nv2-lines-svg');
  const banner   = document.getElementById('nv2-edit-banner');
  const snapCont = document.getElementById('snapin-container');
  const snapTabs = document.getElementById('snap-tabs');
  mapArea.appendChild(canvas);
  if (svg)      mapArea.appendChild(svg);
  if (banner)   mapArea.appendChild(banner);
  if (snapCont) mapArea.appendChild(snapCont);
  if (snapTabs) mapArea.appendChild(snapTabs);
  overlay.style.display = 'none';
  document.getElementById('sidebar').style.display = '';
  document.getElementById('topbar').style.display  = '';
  const lbl = document.getElementById('burger-kiosk-label');
  if (lbl) lbl.textContent = 'Kiosk-Modus';
  document.getElementById('btn-kiosk')?.classList.remove('on');
  if (document.fullscreenElement) document.exitFullscreen?.();
}

function _updateKioskStatus() {
  const bar = document.getElementById('kiosk-status-bar');
  if (!bar) return;
  const now = new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  bar.textContent = `${activeMapCfg?.title ?? ''} · ${now}`;
}

let _kioskMouseTimer = null;
function _setupKioskMouseHide() {
  const overlay = document.getElementById('kiosk-overlay');
  const exitBtn = document.getElementById('kiosk-exit-btn');
  const showUI  = () => {
    exitBtn.classList.add('visible');
    clearTimeout(_kioskMouseTimer);
    _kioskMouseTimer = setTimeout(() => exitBtn.classList.remove('visible'), 2500);
  };
  overlay.addEventListener('mousemove', showUI);
  overlay.addEventListener('touchstart', showUI);
}

window.toggleKiosk = toggleKiosk;
window.exitKiosk   = exitKiosk;


// ═══════════════════════════════════════════════════════════════════════

window.toggleKiosk        = toggleKiosk;
window.exitKiosk          = exitKiosk;
window.openKioskUsersDlg  = openKioskUsersDlg;