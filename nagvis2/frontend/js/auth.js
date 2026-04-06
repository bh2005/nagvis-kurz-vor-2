// NagVis 2 – auth.js
// Lokale Benutzerverwaltung: Login-Overlay, Token-Management, User-CRUD.
// Wird VOR allen anderen NV2-Modulen geladen.
'use strict';

// ═══════════════════════════════════════════════════════════════════════
//  Konstanten
// ═══════════════════════════════════════════════════════════════════════

const NV2_TOKEN_KEY   = 'nagvis2-token';
const NV2_USER_KEY    = 'nagvis2-user';


// ═══════════════════════════════════════════════════════════════════════
//  nv2Auth – öffentliche API (window.nv2Auth)
// ═══════════════════════════════════════════════════════════════════════

window.nv2Auth = {
  enabled:     false,   // wird in init() gesetzt
  currentUser: null,    // { username, role } oder null

  // ── Token ──────────────────────────────────────────────────────────

  getToken() {
    return localStorage.getItem(NV2_TOKEN_KEY) ?? null;
  },

  _setSession(token, username, role) {
    localStorage.setItem(NV2_TOKEN_KEY, token);
    localStorage.setItem(NV2_USER_KEY, JSON.stringify({ username, role }));
    this.currentUser = { username, role };
    _updateAuthUI();
  },

  _clearSession() {
    localStorage.removeItem(NV2_TOKEN_KEY);
    localStorage.removeItem(NV2_USER_KEY);
    this.currentUser = null;
    _updateAuthUI();
  },

  // ── Initialisierung ────────────────────────────────────────────────

  async init() {
    // Prüfen ob Auth serverseitig aktiviert ist
    try {
      const r    = await fetch('/api/v1/auth/config');
      const data = await r.json();
      this.enabled = !!data.auth_enabled;
    } catch {
      this.enabled = false;
    }

    if (!this.enabled) {
      // Auth deaktiviert – als lokaler Admin behandeln (offener Betrieb)
      this.currentUser = { username: 'admin', role: 'admin' };
      _updateAuthUI();
      return; // keine Login-Pflicht
    }

    // Auth aktiviert: Token validieren
    const token = this.getToken();
    if (token) {
      const ok = await _verifyToken(token);
      if (ok) {
        const saved = localStorage.getItem(NV2_USER_KEY);
        try { this.currentUser = JSON.parse(saved); } catch { /* ignore */ }
        _updateAuthUI();
        _scheduleRefresh();   // Auto-Refresh vor Ablauf
        return; // bereits eingeloggt
      }
      // Token ungültig → Session löschen + Login zeigen
      this._clearSession();
    }

    // Login-Overlay anzeigen und warten bis eingeloggt
    await _showLoginOverlay();
  },

  // ── Logout ─────────────────────────────────────────────────────────

  async logout() {
    const token = this.getToken();
    if (token) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* ignore network errors */ }
    }
    this._clearSession();
    location.reload();   // immer neu laden – stellt sauberen Zustand sicher
  },

  // ── 401-Handler (aus ws-client.js aufgerufen) ──────────────────────

  handleUnauthorized() {
    if (!this.enabled) return;
    this._clearSession();
    _showLoginOverlay();
  },

  // ── Benutzerverwaltung (Admin) ─────────────────────────────────────

  async openUserMgmtDlg() {
    await _renderUserMgmt();
    document.getElementById('dlg-user-mgmt').style.display = 'flex';
  },
};


// ═══════════════════════════════════════════════════════════════════════
//  Internes – Login-Overlay
// ═══════════════════════════════════════════════════════════════════════

function _showLoginOverlay() {
  return new Promise(resolve => {
    const el = document.getElementById('nv2-login-overlay');
    if (!el) return resolve(); // Overlay fehlt → nicht blockieren
    el.style.display = 'flex';
    el._resolve = resolve;

    // Enter in Passwort-Feld triggert Login
    const pwEl = document.getElementById('login-password');
    pwEl?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _doLogin();
    }, { once: false });

    document.getElementById('login-username')?.focus();
  });
}

function _hideLoginOverlay() {
  const el = document.getElementById('nv2-login-overlay');
  if (!el) return;
  el.style.display = 'none';
  if (el._resolve) { el._resolve(); el._resolve = null; }
}

async function _doLogin() {
  const username = document.getElementById('login-username')?.value?.trim() ?? '';
  const password = document.getElementById('login-password')?.value ?? '';
  const errEl    = document.getElementById('login-error');

  if (!username || !password) {
    if (errEl) errEl.textContent = 'Benutzername und Passwort eingeben.';
    return;
  }

  const btnLogin = document.getElementById('btn-login-submit');
  if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = 'Anmelden…'; }
  if (errEl) errEl.textContent = '';

  try {
    const r = await fetch('/api/v1/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      if (errEl) errEl.textContent = j.detail ?? 'Login fehlgeschlagen.';
      return;
    }

    const data = await r.json();
    nv2Auth._setSession(data.token, data.username, data.role);
    document.getElementById('login-password').value = '';
    _hideLoginOverlay();
    _scheduleRefresh();
  } catch {
    if (errEl) errEl.textContent = 'Netzwerkfehler – Backend nicht erreichbar.';
  } finally {
    if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = 'Anmelden'; }
  }
}

// Globale Funktion damit onclick= im HTML funktioniert
window.nv2DoLogin = _doLogin;

async function _verifyToken(token) {
  try {
    const r = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return false;
    const data = await r.json();
    // User-Daten aktualisieren
    localStorage.setItem(NV2_USER_KEY, JSON.stringify({
      username: data.username,
      role:     data.role,
    }));
    return true;
  } catch {
    return false;
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  Internes – UI-Updates nach Login/Logout
// ═══════════════════════════════════════════════════════════════════════

function _updateAuthUI() {
  const u     = nv2Auth.currentUser;
  const chip  = document.getElementById('nv2-user-chip');
  const btnMgmt   = document.getElementById('btn-manage-users');
  const btnLogout = document.getElementById('btn-logout');
  const lblUser   = document.getElementById('burger-username');
  const authDiv   = document.getElementById('auth-burger-section');

  if (chip) {
    if (u) {
      chip.textContent = `${_roleIcon(u.role)} ${u.username}`;
      chip.style.display = 'inline-flex';
    } else {
      chip.style.display = 'none';
    }
  }

  // User-Chip-Dropdown Items
  const ucdHeader    = document.getElementById('user-chip-header');
  const ucdOwnPw     = document.getElementById('ucd-own-pw');
  const ucdMgmt      = document.getElementById('ucd-manage-users');
  const ucdLogout    = document.getElementById('ucd-logout');
  const ucdDivider   = document.getElementById('ucd-divider-logout');
  const ucdDivAuth   = document.getElementById('ucd-divider-auth');

  if (ucdHeader) ucdHeader.textContent = u
    ? `${_roleIcon(u.role)} ${u.username}  ·  ${u.role}`
    : '';
  if (ucdDivAuth) ucdDivAuth.style.display = (nv2Auth.enabled && u) ? 'block' : 'none';
  if (ucdOwnPw)   ucdOwnPw.style.display  = (nv2Auth.enabled && u) ? 'flex' : 'none';
  if (ucdMgmt)    ucdMgmt.style.display   = (nv2Auth.enabled && u?.role === 'admin') ? 'flex' : 'none';
  if (ucdDivider) ucdDivider.style.display = (nv2Auth.enabled && u) ? 'block' : 'none';
  if (ucdLogout)  ucdLogout.style.display  = (nv2Auth.enabled && u) ? 'flex' : 'none';

  if (authDiv) authDiv.style.display = u ? 'block' : 'none';

  const btnOwnPw = document.getElementById('btn-change-own-pw');

  if (btnMgmt)   btnMgmt.style.display   = (u?.role === 'admin') ? 'flex' : 'none';
  if (btnOwnPw)  btnOwnPw.style.display  = u ? 'flex' : 'none';
  // Logout nur anzeigen wenn Auth tatsächlich aktiviert ist (sonst sinnlos)
  if (btnLogout) btnLogout.style.display  = (nv2Auth.enabled && u) ? 'flex' : 'none';
  if (lblUser)   lblUser.textContent      = u?.username ?? '';

  _applyRoleUI(u?.role ?? 'viewer');
}

// ── User-Chip Dropdown ──────────────────────────────────────────────────────

window.toggleUserChip = function() {
  const dd = document.getElementById('user-chip-dropdown');
  if (!dd) return;
  const isOpen = dd.style.display !== 'none';
  // Burger schließen falls offen
  const burger = document.getElementById('burger-dropdown');
  if (burger) burger.style.display = 'none';
  dd.style.display = isOpen ? 'none' : 'block';
};

window.closeUserChip = function() {
  const dd = document.getElementById('user-chip-dropdown');
  if (dd) dd.style.display = 'none';
};

// Außenklick schließt Dropdown
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('user-chip-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('user-chip-dropdown');
    if (dd) dd.style.display = 'none';
  }
});


/**
 * Versteckt UI-Elemente je nach Rolle.
 * viewer  → kann keine Maps/Objekte bearbeiten
 * editor  → darf Objekte bearbeiten, aber keine Maps anlegen/löschen/Backends
 * admin   → alles sichtbar
 */
function _applyRoleUI(role) {
  const rank = { viewer: 1, editor: 2, admin: 3 }[role] ?? 1;

  // Elemente die mindestens editor-Rolle erfordern
  const editorIds = [
    'btn-new-map',         // Neue Map erstellen
    'btn-import-map',      // NagVis 1 importieren
    'btn-import-zip',      // Map importieren (.zip)
    'btn-edit',            // Bearbeiten / Edit-Mode
  ];
  // Elemente die admin erfordern
  const adminIds = [
    'btn-delete-map',      // Map löschen
    'btn-backend-mgmt',    // Backends verwalten
    'btn-action-config',   // Aktionen konfigurieren
    'btn-kiosk-users',     // Kiosk-User verwalten
  ];

  editorIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = rank >= 2 ? '' : 'none';
  });
  adminIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = rank >= 3 ? '' : 'none';
  });
}

function _roleIcon(role) {
  return role === 'admin' ? '⬡' : role === 'editor' ? '✎' : '◎';
}


// ═══════════════════════════════════════════════════════════════════════
//  Benutzerverwaltungs-Dialog
// ═══════════════════════════════════════════════════════════════════════

async function _renderUserMgmt() {
  const token = nv2Auth.getToken();
  const body  = document.getElementById('user-mgmt-list');
  if (!body) return;
  body.innerHTML = '<div style="color:var(--text-dim);font-size:12px">Lade…</div>';

  try {
    const r = await fetch('/api/v1/auth/users', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) { body.innerHTML = '<div style="color:var(--err)">Kein Zugriff.</div>'; return; }
    const users = await r.json();

    body.innerHTML = users.map(u => `
      <div class="user-mgmt-row" data-uname="${_esc(u.username)}">
        <span class="user-mgmt-name">${_esc(u.username)}</span>
        <select class="user-mgmt-role f-select" onchange="nv2AuthChangeRole('${_esc(u.username)}', this.value)">
          ${['viewer','editor','admin'].map(r =>
            `<option value="${r}"${u.role===r?' selected':''}>${r}</option>`
          ).join('')}
        </select>
        <button class="btn-icon" title="Passwort ändern"
                onclick="nv2AuthChangePw('${_esc(u.username)}')">🔑</button>
        <button class="btn-icon btn-danger" title="Löschen"
                onclick="nv2AuthDeleteUser('${_esc(u.username)}')">🗑</button>
      </div>`).join('') || '<div style="color:var(--text-dim);font-size:12px">Noch keine Benutzer.</div>';
  } catch {
    body.innerHTML = '<div style="color:var(--err)">Fehler beim Laden.</div>';
  }
}

function _esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

// ── Globale Funktionen für onclick= im Dialog ──────────────────────────────

window.nv2AuthCloseUserMgmt = function() {
  document.getElementById('dlg-user-mgmt').style.display = 'none';
};

window.nv2AuthCreateUser = async function() {
  const username = document.getElementById('new-user-name')?.value?.trim();
  const password = document.getElementById('new-user-pw')?.value;
  const role     = document.getElementById('new-user-role')?.value ?? 'viewer';
  if (!username || !password) { showToast('Name und Passwort erforderlich.', 'error'); return; }

  const token = nv2Auth.getToken();
  const r = await fetch('/api/v1/auth/users', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body:    JSON.stringify({ username, password, role }),
  });
  if (!r.ok) { const j = await r.json().catch(()=>({})); showToast(j.detail ?? 'Fehler', 'error'); return; }
  document.getElementById('new-user-name').value = '';
  document.getElementById('new-user-pw').value   = '';
  await _renderUserMgmt();
};

window.nv2AuthChangeRole = async function(username, role) {
  const token = nv2Auth.getToken();
  const r = await fetch(`/api/v1/auth/users/${encodeURIComponent(username)}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body:    JSON.stringify({ role }),
  });
  if (!r.ok) { const j = await r.json().catch(()=>({})); showToast(j.detail ?? 'Fehler', 'error'); await _renderUserMgmt(); }
};

window.nv2AuthChangePw = async function(username) {
  const pw = prompt(`Neues Passwort für ${username} (min. 6 Zeichen):`);
  if (!pw) return;
  const token = nv2Auth.getToken();
  const r = await fetch(`/api/v1/auth/users/${encodeURIComponent(username)}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body:    JSON.stringify({ password: pw }),
  });
  if (!r.ok) { const j = await r.json().catch(()=>({})); showToast(j.detail ?? 'Fehler', 'error'); }
  else showToast('Passwort geändert.', 'ok');
};

window.nv2AuthDeleteUser = async function(username) {
  if (!confirm(`Benutzer '${username}' wirklich löschen?`)) return;
  const token = nv2Auth.getToken();
  const r = await fetch(`/api/v1/auth/users/${encodeURIComponent(username)}`, {
    method:  'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) { const j = await r.json().catch(()=>({})); showToast(j.detail ?? 'Fehler', 'error'); return; }
  await _renderUserMgmt();
};


// ═══════════════════════════════════════════════════════════════════════
//  Token Auto-Refresh
// ═══════════════════════════════════════════════════════════════════════

let _refreshTimer = null;

function _scheduleRefresh() {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  if (!nv2Auth.enabled) return;

  // expires_at aus JWT lesen (Payload ist base64url-kodiert, kein Verify nötig)
  const token = nv2Auth.getToken();
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return;   // kein Ablaufdatum → kein Refresh nötig

    // 1 Tag vor Ablauf erneuern; frühestens in 60 Sekunden
    const refreshAt = (payload.exp - 86400) * 1000;
    const delay     = Math.max(60_000, refreshAt - Date.now());

    _refreshTimer = setTimeout(_doRefresh, delay);
  } catch { /* ignore parse errors */ }
}

async function _doRefresh() {
  const token = nv2Auth.getToken();
  if (!token) return;
  try {
    const r = await fetch('/api/v1/auth/refresh', {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const data = await r.json();
    nv2Auth._setSession(data.token, data.username, data.role);
    _scheduleRefresh();   // nächsten Refresh planen
  } catch { /* Netzwerkfehler – beim nächsten Init erneut versuchen */ }
}


// ═══════════════════════════════════════════════════════════════════════
//  Eigenes Passwort ändern
// ═══════════════════════════════════════════════════════════════════════

window.nv2AuthChangeOwnPw = async function() {
  const pw = prompt('Neues Passwort (min. 6 Zeichen):');
  if (!pw) return;
  if (pw.length < 6) { showToast('Passwort muss mindestens 6 Zeichen lang sein.', 'error'); return; }
  const token = nv2Auth.getToken();
  const r = await fetch('/api/v1/auth/me', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body:    JSON.stringify({ password: pw }),
  });
  if (!r.ok) { const j = await r.json().catch(()=>({})); showToast(j.detail ?? 'Fehler', 'error'); }
  else showToast('Passwort erfolgreich geändert.', 'ok');
};


// ═══════════════════════════════════════════════════════════════════════
//  System-Logs Dialog
// ═══════════════════════════════════════════════════════════════════════

window.nv2LogOpen = function() {
  document.getElementById('dlg-system-logs').style.display = 'flex';
  nv2LogLoad();
};

window.nv2LogLoad = async function() {
  const source = document.getElementById('log-source-sel')?.value ?? 'app';
  const lines  = document.getElementById('log-lines-sel')?.value  ?? '200';
  const out    = document.getElementById('log-output');
  const lbl    = document.getElementById('log-path-lbl');
  if (!out) return;
  out.textContent = 'Lade…';

  const token = nv2Auth.getToken();
  try {
    const r = await fetch(`/api/v1/logs?source=${source}&lines=${lines}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) {
      out.textContent = `Fehler ${r.status}: ${await r.text()}`;
      return;
    }
    const data = await r.json();
    if (lbl) lbl.textContent = data.path ?? '';
    out.textContent = (data.lines ?? []).join('\n') || '(keine Einträge)';
    // ans Ende scrollen
    out.scrollTop = out.scrollHeight;
  } catch (e) {
    out.textContent = `Netzwerkfehler: ${e}`;
  }
};


// ═══════════════════════════════════════════════════════════════════════
//  Audit-Log Dialog
// ═══════════════════════════════════════════════════════════════════════

const _AUDIT_ACTION_LABELS = {
  'map.create':           '🗺 Map angelegt',
  'map.delete':           '🗑 Map gelöscht',
  'map.rename':           '✎ Map umbenannt',
  'map.canvas_update':    '⊡ Canvas geändert',
  'map.background_upload':'🖼 Hintergrund hochgeladen',
  'map.import':           '📥 Map importiert',
  'map.migrate':          '🔄 Migration',
  'map.parent_set':       '↳ Parent gesetzt',
  'object.create':        '＋ Objekt angelegt',
  'object.update':        '✎ Objekt geändert',
  'object.move':          '↔ Objekt verschoben',
  'object.delete':        '🗑 Objekt gelöscht',
  'backend.add':          '⊕ Backend hinzugefügt',
  'backend.update':       '✎ Backend geändert',
  'backend.delete':       '🗑 Backend entfernt',
  'user.create':          '👤 Benutzer angelegt',
  'user.delete':          '🗑 Benutzer gelöscht',
  'user.role_change':     '⬡ Rolle geändert',
  'user.password_change': '🔑 Passwort geändert',
};

window.nv2AuditOpen = function() {
  document.getElementById('dlg-audit').style.display = 'flex';
  nv2AuditLoad();
};

window.nv2AuditLoad = async function() {
  const tbody   = document.getElementById('audit-rows');
  const countLbl = document.getElementById('audit-count-lbl');
  if (!tbody) return;

  const mapId  = document.getElementById('audit-filter-map')?.value?.trim()  || '';
  const user   = document.getElementById('audit-filter-user')?.value?.trim() || '';
  const action = document.getElementById('audit-filter-action')?.value || '';
  const limit  = document.getElementById('audit-limit-sel')?.value || '200';

  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:16px">Lade…</td></tr>';

  const params = new URLSearchParams({ limit });
  if (mapId)  params.set('map_id', mapId);
  if (user)   params.set('user',   user);
  if (action) params.set('action', action);

  try {
    const token = nv2Auth.getToken();
    const r = await fetch(`/api/v1/audit?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--err);padding:16px">Fehler ${r.status}</td></tr>`;
      return;
    }
    const entries = await r.json();
    if (countLbl) countLbl.textContent = `${entries.length} Einträge`;

    if (!entries.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:16px">Keine Einträge gefunden.</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map(e => {
      const dt      = new Date(e.ts * 1000);
      const tsStr   = dt.toLocaleString('de-DE', { dateStyle:'short', timeStyle:'medium' });
      const label   = _AUDIT_ACTION_LABELS[e.action] ?? e.action;
      const mapCell = e.map_id ? `<code>${_esc(e.map_id)}</code>` : '—';
      const det     = Object.entries(e.details ?? {})
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `<span class="audit-detail"><b>${_esc(k)}</b>: ${_esc(String(v))}</span>`)
        .join(' ');
      const actionCls = e.action.includes('delete') ? 'audit-act-del'
                      : e.action.includes('create') ? 'audit-act-add' : '';
      return `<tr>
        <td style="white-space:nowrap;font-size:11px">${_esc(tsStr)}</td>
        <td><code>${_esc(e.user)}</code></td>
        <td class="${actionCls}">${label}</td>
        <td>${mapCell}</td>
        <td style="font-size:11px">${det}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--err);padding:16px">Netzwerkfehler: ${_esc(String(err))}</td></tr>`;
  }
};
