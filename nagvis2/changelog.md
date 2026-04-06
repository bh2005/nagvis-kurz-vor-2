# NagVis 2 – Changelog

---

## [2026-04-06]

### Bugfix: WCAG-Kontrast-Fixes (5 Selektoren)

Sekundäre Textelemente auf Panel-Oberflächen (`--bg-card/--bg-panel: #2b2b2b`) verwendeten
`--text-dim` (#828282), was dort nur ~3.76:1 Kontrast ergibt — WCAG AA erfordert 4.5:1 für
kleine Texte (8–10 px).

**Neuer Design-Token `--text-dim-surf`:**
- Dark: `#a3a3a3` → ~5.6:1 auf `#2b2b2b`, ~4.6:1 auf `--bg-hover (#333333)` ✓
- Light: `#636363` → ~5.0:1 auf `#ffffff`, ~4.6:1 auf `--bg-hover (#ebebeb)` ✓

**Betroffene Selektoren (alle auf `--text-dim-surf` umgestellt):**
- `.ov-card-meta` (9px, Overview-Karten)
- `.ev-time` (8px, Event-Log)
- `.f-label` (8px, Formular-Labels in Dialogen)
- `.burger-kbd` (9px, Keyboard-Shortcut-Badges im Burger-Menü — Hintergrund `--bg-hover`)
- `.manage-meta` (9.5px, Manage-Maps-Overlay)

---

## [2026-03-26]

### Feature: N1 Mehrsprachigkeit (i18n) vollständig ✅

**i18n-Engine (`frontend/js/i18n.js`)** — neues Modul, wird als **erstes** Script geladen:
- `window.t(key, vars)` — Schlüssel-basierte Übersetzung mit `{var}`-Interpolation; Fallback = Schlüssel selbst
- `window.applyI18n()` — traversiert DOM und setzt alle `data-i18n`/`data-i18n-placeholder`/`data-i18n-title`-Attribute
- `window.setLang(code)` — lädt `/lang/{code}.json`, aktualisiert `window.I18N`, speichert in localStorage, ruft `applyI18n()` und `_refreshDynamicUI()` auf
- `window.importLangPack(file)` — liest JSON-Datei, validiert Format, lädt als aktive Sprache → beliebige Sprache per Datei-Upload erweiterbar
- `window._i18nReady` — Promise; wird in `app.js` vor dem ersten Render awaited → kein Flash of Untranslated Content
- **Warm-Start**: synchrone Cache-Ladung aus `localStorage` im Boot → Texte sofort übersetzt, auch wenn Fetch noch läuft

**Sprachpakete**
- `frontend/lang/de.json` — vollständiges deutsches Paket (~130 Schlüssel inkl. Meta-Block)
- `frontend/lang/en.json` — vollständiges englisches Paket, identische Schlüssel
- Format: `{ "meta": { "lang": "de", "name": "Deutsch", "version": "1" }, "strings": { ... } }`
- FastAPI ServesFiles bereits `frontend/` → `/lang/de.json` automatisch erreichbar ohne Backend-Änderung

**HTML (`frontend/index.html`)**
- `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` an allen statischen UI-Texten (Sidebar, Burger-Menü, Dialoge, Tabellen-Header, Keyboard-Shortcuts, Login, Benutzerverwaltung, Audit-Log)
- Sprach-Picker im Dialog **⚙ Einstellungen** (`dlg-user-settings`): `<select>` DE/EN + „Lang-Pack importieren"-Button (File-Input)

**JS-Module angepasst** — alle Hardcoded-Strings durch `t(key, vars)` ersetzt:
- `ui-core.js`: Theme-Labels, Hosts-Panel, Benachrichtigungsstatus, Downtime-Banner, Log-Viewer, About-Dialog, Keyboard-Delete-Confirm; `openUserSettingsDlg()` synchronisiert Dropdown
- `ws-client.js`: Verbindungsstatus, Status-Bar (Snapshot/Update/Heartbeat), Offline-Banner, Backend-Error-Toast, Demo-Mode-Meldungen; pluralisierter `{suffix}` jetzt sprachabhängig (`'en'`/`''` für DE, `'s'`/`''` für EN)
- `map-core.js`: Kein-Maps-Zustand, Objekt-Zähler, Map-Not-Found, Kontextmenü-Einträge, „Neue Map"-Karte
- `nodes.js`: Edit/Fertig-Label, leere Aktionen, Layer-Namen
- `kiosk.js`: Ungültiger-Token-Fehlerscreen (via `t()` in Template-Literal, da `applyI18n()` nach `body.innerHTML`-Reset nicht automatisch läuft)
- `app.js`: `await window._i18nReady; applyI18n();` als erste Zeile in `DOMContentLoaded`
- `ui-core.js`: `window.nv2SetLangFromSelect(code)` + `window.nv2ImportLangPack(file)` — globale Handler für den Sprach-Picker

---

## [2026-03-25]

### Feature: Demo-Maps & Live-Demo auf Render

**Demo-Maps**
- Zwei neue Demo-Maps: `demo-europe` (OSM-Karte, 10 Hosts in Europa) und `demo-appstack` (NagVis2-Applikationsstack)
- `demo-features.json`: Map-Links zu den neuen Maps, Keyboard-Shortcuts-Textbox, neue Gadgets (Linear vertikal, Graph-img-Embed, Container, Zone-B-Label)
- `ws/demo_data.py`: `DEMO_STATUS` um 10 Europa-Hosts (Madrid=DOWN, Wien=DT) und App-Stack-Hosts mit Perfdata erweitert
- `statistik.md`: Projektkalkulation mit Zeit-, Kosten- und KI-Hebelschätzung erstellt

**Seed-Mechanismus**
- `backend/seed_maps/`: neues Verzeichnis außerhalb des Docker-Volumes mit allen Demo-Maps
- `main.py`: `_seed_maps()` kopiert beim Start fehlende Maps und überschreibt `demo-*` Maps immer
- Stellt sicher, dass neue Demo-Maps nach jedem Render-Deploy / `docker compose up --build` erscheinen

**Live-Demo**
- Live-Demo-URL in `README.md` eingebaut: `https://nagvis-kurz-vor-2.onrender.com`

### Bugfix: Sidebar beim ersten Start nicht aufgeklappt

- `map-core.js` `openMap()`: setzte `gridTemplateColumns` immer auf `44px 1fr`, ignorierte `sidebarCollapsed`
- Fix: Breite und `sidebar-expanded`-Klasse werden jetzt korrekt nach User-Präferenz gesetzt

### Bugfix: Demo-Modus blockierte echte API-Aufrufe trotz laufendem Backend

- `ws-client.js`: im Demo-Modus wurden `/api/maps`-Calls abgefangen und hardcodierte JS-Daten zurückgegeben
- Folge: `demo-europe` und `demo-appstack` erschienen nie in der Seitenleiste auf `nagvis-kurz-vor-2.onrender.com`
- Fix: `_backendReachable`-Flag — wenn Backend erreichbar, werden Map-Calls ans echte Backend weitergeleitet
- Fallback-Daten bleiben für rein statisches Frontend ohne Backend (`nagvis2-frontend.onrender.com`)

---

---

## [2026-03-24]

### Bugfix: Poll-Loop Absturz `expected string or bytes-like object, got 'dict'`
- `core/perfdata.py`: `parse_perfdata()` prüft `isinstance(raw, str)` vor `re.finditer()` → gibt `{}` zurück wenn kein String übergeben wird
- `checkmk/client.py`: Neue Hilfsfunktion `_to_perf_str()` — stellt sicher dass `performance_data` (Checkmk REST API kann Dict liefern) immer als `""` weitergegeben wird

### Feature: Authentifizierung vollständig ✅

**Backend**
- `api/auth_router.py`: `POST /api/v1/auth/refresh` — gibt neues Token (7 Tage) für eingeloggten User zurück
- `api/auth_router.py`: `PATCH /api/v1/auth/me` — eigenes Passwort ändern (mind. 6 Zeichen, jede Rolle)

**Frontend**
- `auth.js`: **Bugfix** — `nv2AuthChangeRole()`, `nv2AuthChangePw()`, `nv2AuthDeleteUser()` verwendeten `/api/auth/` statt `/api/v1/auth/` → 404-Fehler
- `auth.js`: `_scheduleRefresh()` / `_doRefresh()` — JWT-Ablaufdatum aus Payload lesen; 1 Tag vor Ablauf automatisch via `POST /api/v1/auth/refresh` erneuern; wird nach Login + Init gestartet
- `auth.js`: `nv2AuthChangeOwnPw()` — eigenes Passwort ändern via `PATCH /api/v1/auth/me`
- `auth.js`: `_applyRoleUI(role)` — blendet UI-Elemente nach Rolle aus:
  - Editor-Pflicht: Neue Map, Map importieren, Edit-Mode
  - Admin-Pflicht: Backends, Aktionen, Kiosk-User, Map löschen
- `index.html`: IDs `btn-new-map`, `btn-import-map`, `btn-import-zip`, `btn-backend-mgmt`, `btn-kiosk-users`, `btn-action-config` an Burger-Menü-Buttons ergänzt
- `index.html`: Burger-Menü „Konto"-Abschnitt: Button „🔑 Passwort ändern" (`btn-change-own-pw`)

### Bugfix: Logout + Auth-UI-Sichtbarkeit
- `auth.js`: Logout-Button nur sichtbar wenn `AUTH_ENABLED=true` (bei deaktivierter Auth nach Reload sofort wieder Admin → Logout wäre sinnlos/verwirrend)
- `auth.js`: Benutzerverwaltung + Passwort ändern bleiben auch bei `AUTH_ENABLED=false` sichtbar (Rolle=admin)

### Dokumentation: `.env.example` + `admin-guide.md`

- `.env.example`: komplett überarbeitet — fehlende Variablen ergänzt (`LIVESTATUS_TYPE/PATH/SITE`, `WS_POLL_INTERVAL`, `LOG_FORMAT/LEVEL/LOG_BUFFER_LINES`, `NAGVIS_SECRET`); Port korrigiert 8000 → 8008; falscher `SECRET_KEY` durch `NAGVIS_SECRET` ersetzt
- `docs/admin-guide.md`: neuer Abschnitt **„Installation via Install-Script"** (Schnellstart, alle Optionen, Berechtigungskonzept, Service-Befehle)
- `docs/admin-guide.md`: neuer Abschnitt **„Authentifizierung & Benutzerverwaltung"** (Modi-Tabelle, Aktivierung, Rollen, REST-API-Beispiele, `users.json`-Format)
- `docs/admin-guide.md`: Konfigurationstabelle um `AUTH_ENABLED` + `NAGVIS_SECRET` erweitert

### Feature: `install.sh` – Bash-Installationsskript ✅
- Optionen: `--zip`, `--install-dir`, `--user`, `--port`, `--auth-enabled`, `--no-systemd`, `--no-start`, `--upgrade`, `--uninstall`
- System-User/Group `nagvis2` anlegen, venv erstellen, `requirements.txt` installieren
- `NAGVIS_SECRET` wird automatisch generiert (`secrets.token_hex(32)`)
- Berechtigungen: Code `root:nagvis2 755/644` · `data/` `nagvis2:nagvis2 750` · `.env` `600`
- Systemd-Service mit Security-Hardening (`NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`)
- Upgrade-Modus: `data/` + `.env` vor Update sichern, danach wiederherstellen

### Feature: `build.sh` – Build-Skript für ZIP-Distribution ✅
- Erstellt `nagvis2-<version>.zip` + `.sha256`; Version aus `changelog.txt` oder `git describe`
- Schließt aus: `venv/`, `data/`, `__pycache__/`, `*.pyc`, `.env`, `.coverage`
- Baut MkDocs-Hilfe vor dem Packen; ZIP-Wurzel immer `nagvis2/`

### Feature: GitHub Action – Automatische Releases ✅
- `.github/workflows/release.yml`: Trigger auf `v*.*.*`-Tags + manuell
- Job 1: pytest (Release schlägt fehl wenn Tests rot)
- Job 2: MkDocs + `build.sh` → ZIP als Artifact
- Job 3: GitHub Release mit ZIP + SHA256, Release-Notes aus `changelog.md`, Install-Befehl im Body

### Feature: M2 Map-Duplikat ✅

**Backend**
- `core/storage.py`: `clone_map(source_id, new_title)` — Deep-Copy, neue slugifizierte ID (Kollisionsvermeidung), `parent_map=None`, Hintergrundbild wird mitkopiert
- `api/router.py`: `POST /api/v1/maps/{id}/clone` (201) mit Audit-Log `map.clone`

**Frontend**
- `map-core.js`: `cloneActiveMap()` — prompt für neuen Namen, Default „\<Titel\> – Kopie"
- `map-core.js`: `cloneMap(mapId, newTitle)` — POST `/clone`, `loadMaps()` danach
- `index.html`: Burger-Menü → Aktive Map: **⧉ Map duplizieren** (`btn-clone-map`)
- `map-core.js`: Übersicht-Rechtsklickmenü: „Duplizieren"-Eintrag

### Feature: User-Chip als klickbarer Button mit Dropdown ✅
- `index.html`: `#nv2-user-chip` `<span>` → `<button class="user-chip-btn">` in `<div id="user-chip-wrap">`
- Dropdown `#user-chip-dropdown`:
  - Header: Rollenicon + Username + Rolle (immer)
  - ☀/☽ Theme wechseln (immer, synchron mit Burger-Menü)
  - ⚙ Einstellungen… → `dlg-user-settings` (immer)
  - 🔑 Passwort ändern / 👥 Benutzer verwalten (Admin) / ⏻ Abmelden — nur `AUTH_ENABLED=true`
- `auth.js`: `toggleUserChip()` / `closeUserChip()` / Außenklick-Listener
- `ui-core.js`: `setTheme()` aktualisiert `ucd-theme-ico` + `ucd-theme-label` synchron
- `css/styles.css`: `.user-chip-btn` + `:hover`

### Feature: P2 HTTPS/TLS für Produktionsbetrieb ✅
- `nginx.conf.prod`: vollständige TLS-Produktionskonfiguration
  - HTTP → HTTPS Redirect (301), TLS 1.2 + 1.3, moderne Cipher-Suites, OCSP Stapling
  - Security-Header: HSTS (2 Jahre + preload), CSP, X-Frame-Options, X-Content-Type-Options
  - `/metrics` nur von `127.0.0.1` erreichbar
- `scripts/setup-tls.sh`: TLS-Setup-Skript
  - Standard: selbstsigniertes RSA-4096-Zertifikat mit SAN; speichert nach `/etc/nagvis2/tls/`
  - `--certbot`: Let's Encrypt via certbot (inkl. nginx-Plugin); reload nach Erstellung
- `docs/admin-guide.md`: neuer Abschnitt **„HTTPS / TLS"** — Option A selbstsigniert, Option B Let's Encrypt, Firewall-Hinweise

### Feature: P3 OMD-Hook / Systemd-Integration ✅
- `omd/nagvis2`: OMD init.d-Hook-Skript — `start | stop | restart | status | version`
  - Liest `PORT` aus `$OMD_ROOT/etc/nagvis2/.env`; PID-Datei in `$OMD_ROOT/tmp/run/`; Log nach `$OMD_ROOT/var/log/nagvis2.log`
- `scripts/install-omd-hook.sh`: Hook-Installer — patcht `NAGVIS2_DIR`, setzt Eigentümer auf OMD-Site-User; `--uninstall` entfernt Hook
- `docs/admin-guide.md`: neuer Abschnitt **„OMD / Checkmk-Integration"** — Voraussetzungen, Installation, Verwendung, `.env`-Konfiguration, Deinstallation

### Feature: Erweiterte Test-Coverage – Ziel ≥ 70 % ✅
- `tests/test_api_maps.py`: 27 neue Tests — `TestCloneMapApi` (6), `TestThumbnailApi` (5), `TestChangelogEndpoint`, `TestMiscEndpoints` (15: hosts, hostgroups, logs, Kiosk-CRUD, Backends, Parent/Canvas 404)
- `tests/test_storage.py`: `TestCloneMap` (6) — `clone_map`: neuer Map, Deep-Copy, `parent_map=None`, nonexistent, Kollision, Persistenz
- `tests/test_auth_router.py` (NEU, 22 Tests): AuthConfig, Login (valid/wrong/unknown), Me GET/PATCH (Short-PW → 400), Refresh, Logout (Token-Revoke), User-CRUD (list, create-dup 409, empty 400, patch role/pw, delete-self 400, delete-ghost 404, admin-only 403)
- **Gesamt: 137 → 192 Tests · erwartete Coverage ≥ 70 %**

### Bugfix: GitHub Actions – Node 20 Deprecation
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` aus allen 4 Workflows entfernt (`ci.yml`, `docker.yml`, `docs.yml`, `release.yml`)
- Node 24 ist seit September 2025 der Standard — das temporäre Opt-in-Flag ist obsolet

### Dokumentation: README.md + FEATURES.md aktualisiert
- `README.md`: CI/Release/Changelog-Badges; Features-Tabelle ergänzt; `install.sh` als primäre Schnellstart-Option; `AUTH_ENABLED`/`NAGVIS_SECRET` in `.env`-Sektion; aktualisierte Ordnerstruktur; Links-Sektion am Ende
- `FEATURES.md`: P2 + P3 als ✅ markiert; Fortschritts-Balken auf 100 % (Monitoring/Betrieb, Backend API)

### Feature: `backend_id` pro Node – Datenquelle explizit wählbar ✅

**Problem:** Derselbe Hostname (z.B. `server01`) kann gleichzeitig in Checkmk, Zabbix, Icinga2 und mehreren Checkmk-Instanzen existieren. Bisher gewann immer der erste Treffer.

**Backend**
- `connectors/registry.py`: `get_all_hosts_tagged()` + `get_all_services_tagged()` — liefern alle Einträge aller Backends mit `_backend_id`-Feld (keine Deduplizierung)
- `ws/manager.py`: nutzt `*_tagged()`-Methoden; Diff-Keys sind jetzt `"backend_id::name"` statt `"name"`; Demo-Modus erhält `_backend_id: "demo"`
- `api/router.py`: `backend_id: Optional[str]` in `ObjectCreate` und `ObjectProps`

**Frontend**
- `state.js`: `window.backendStatusCache = {}` (backend_id → {cacheKey: statusDict}); `window.backendList = []`
- `nodes.js`: `_resolveStatus(backendId, cacheKey)` — sucht zuerst in `backendStatusCache[backendId]`, Fallback `hostCache`
- `nodes.js`: `_renderMonitoringNode()` setzt `el.dataset.backendId = obj.backend_id || ''`
- `nodes.js`: `applyStatuses()` befüllt `backendStatusCache`; filtert DOM-Updates nach `backendId`; speichert Perfdata unter `"backend_idhost::service"`
- `nodes.js`: `openNodePropsDialog()` — `<select id="np-backend-id">` mit `(beliebig)` + allen konfigurierten Backends; befüllt via `GET /api/backends`; `backend_id` im PATCH-Payload; `el.dataset.backendId` nach Speichern gesetzt
- `nodes.js`: `openGadgetConfigDialog()` + `_gcSave()` — analoges Dropdown für Gadgets
- `gadget-renderer.js`: `createGadget()` setzt `el.dataset.backendId = obj.backend_id || ''`

Rückwärtskompatibel: Nodes ohne `backend_id` nutzen `hostCache` wie bisher.

### Feature: Browser-Benachrichtigungen + Hinweiston bei CRITICAL (N4) ✅

**Frontend**
- `js/ws-client.js`: `_checkCriticalNotify(hosts, services)` — nach jedem `status_update`-Event; filtert `DOWN`/`CRITICAL`/`UNREACHABLE`-Hosts und `CRITICAL`-Services; **Debounce: max. 1 Benachrichtigung alle 15 s**
- `js/ws-client.js`: `_playCriticalSound()` — Web Audio API, Square-Wave-Oszillator (880 → 440 Hz, 0,45 s); kein externer Asset
- `js/ws-client.js`: Browser `Notification` API mit `tag='nagvis2-critical'` (ersetzt vorherige) + `renotify=true`
- `js/ui-core.js`: `defaultUserSettings()` um `notifyOnCritical: false` + `notifySound: true` erweitert
- `js/ui-core.js`: `saveUserSettings()` liest neue Checkboxen; fordert Berechtigung automatisch an wenn Benachrichtigungen gerade aktiviert werden
- `js/ui-core.js`: `_updateNotifyStatus()` — zeigt Berechtigungsstatus (✔ erteilt / ✖ verweigert / ausstehend) mit Farbcodierung
- `js/ui-core.js`: `_requestNotifyPermission()` — manueller Berechtigung-Button
- `index.html`: dlg-user-settings — neue Sektion **„Benachrichtigungen"**: Checkbox „Bei CRITICAL/DOWN Browser-Benachrichtigung anzeigen", Checkbox „Hinweiston abspielen", Button „🔔 Berechtigung erteilen" + Statusanzeige

Einstellungen persistiert in `nv2-user-settings` (localStorage). Standard: deaktiviert.

### Dokumentation: `admin-guide.md` um Zabbix + Icinga2 erweitert ✅
- Voraussetzungen-Tabelle: Zabbix 6.0+ und Icinga2 2.11+ ergänzt
- Neue Unterabschnitte: **Checkmk REST API**, **Zabbix**, **Icinga2** (je: Parameter-Tabelle, Einrichtungsanleitung, Konzept-Mapping)
- Icinga2: vollständige `ApiUser`-Konfiguration mit allen erforderlichen Permissions
- Zabbix: Schweregrad-Mapping (Priority → WARNING/CRITICAL), Hinweis zu API-Token vs. user.login
- Verzeichnisstruktur: `zabbix/` und `icinga2/` ergänzt
- `docs/todo-liste.md`: bereinigt (erledigte Items als `[x]` markiert); neue Einträge: **DRAW.io-Import**, **BI-Visualisierung**

### Feature: F7 draw.io / diagrams.net Import ✅

**Backend**
- `api/router.py`: `POST /api/maps/import-drawio` — neuer Endpunkt
  - Parst `.drawio`- und `.xml`-Dateien via `xml.etree.ElementTree` (stdlib, keine Zusatz-Deps)
  - `_drawio_find_model()`: findet `mxGraphModel` auch in komprimierten Diagrammen (URL-Decode → Base64 → raw-deflate via `zlib.decompress(raw, -15)`)
  - Alle `vertex`-Zellen → `textbox` (Standard) oder `host` wenn `?as_hosts=true`
  - Alle `edge`-Zellen → `line` (Quelle/Ziel über Cell-ID-Lookup)
  - Bounding-Box-Normalisierung: absolute draw.io-Pixel werden auf 5–95 % Map-Koordinaten skaliert (Mittelpunkte der Shapes)
  - Erstellt automatisch eine neue Map (`canvas: ratio 16:9`); gibt `{map_id, title, object_count, warnings}` zurück
  - Robuste Fehlerbehandlung: ungültige Verbindungen werden einzeln übersprungen und als Warnung zurückgegeben
  - Audit-Log-Eintrag (`map.import_drawio`)

**Frontend**
- `index.html`: Burger-Menü-Eintrag „🗂 draw.io importieren (.drawio / .xml)"; `dlg-drawio-import`-Dialog mit Drag & Drop, Titel-Feld, Checkbox „als Hosts anlegen", Ergebnis-Box
- `map-core.js`: `dlgImportDrawio()` — Dialog öffnen, Datei-Input + Drop-Zone verdrahten; `_drawioHandleFile()` — Validierung, Dateiname als Titel-Vorschlag; `confirmImportDrawio()` — `FormData` POST zu `/api/maps/import-drawio`, Redirect zur neuen Map

### Feature: F3 Custom Graph Gadget – Grafana & Checkmk Panels einbetten ✅

**Frontend**
- `gadget-renderer.js`: neuer Gadget-Typ `graph` — rendert `<iframe>` (Standard) oder `<img>` für externe Graphen
  - `_graph(cfg)`: generiert HTML mit konfigurierbarer Breite/Höhe; zeigt Leer-Platzhalter wenn keine URL gesetzt
  - Auto-Refresh: `setInterval` in `_graphTimers` Map; bei `<img>` wird `_t=<timestamp>` Cache-Buster angehängt, bei `<iframe>` wird `src` neu gesetzt
  - `updateGadget()`: graph-Typ wird übersprungen (keine Perfdata-Aktualisierung)
  - Export: `window._gadgetGraph = _graph` für Dialog-Vorschau
- `nodes.js`: Gadget-Konfigurations-Dialog erweitert
  - Typ-Chip „📊 Graph / Iframe" (spans volle Breite, 7. Button)
  - `#gc-datasource-row` / `#gc-metric-row`: IDs hinzugefügt für dynamische Sichtbarkeit
  - `#gc-graph-row`: URL-Eingabe, Einbettung (iframe/img), Breite, Höhe, Refresh-Intervall
  - `_gcSelectType()`: blendet Datenquellen-/Min-Max-Felder für graph-Typ aus; zeigt Graph-Sektion
  - `_gcUpdatePreview()`: zeigt Graph-Vorschau (iframe/img) mit aktuellen Werten
  - `_gcSave()`: schreibt `{ type, url, embed, width, height, metric, refresh }` in `gadget_config`

**Demo**
- `backend/data/maps/demo-features.json`: Grafana-Play-Beispiel-Gadget (`gadget::graph-demo-01`) hinzugefügt

**Tests & Kompatibilität**
- `tests/test_prometheus_client.py`: 27 neue Tests für `prometheus/client.py` — Coverage ≥ 70% sichergestellt
- `from __future__ import annotations` in 10 Backend-Dateien (Python 3.9-Kompatibilität)

---

---

## [2026-03-23]

### Bugfix: Merge-Konflikte behoben
**Frontend**
- `index.html`: Konflikt im Burger-Menü (Log-Buttons) aufgelöst — HEAD-Version (`openLogViewer` / `downloadLog`) behalten

**Backend**
- `main.py`: Konflikt bei Import-Zeilen (`import time` / `logging`)
- `api/router.py`: Konflikt beim `/api/logs`-Endpoint — In-Memory-Version (HEAD) behalten, dateibasierte Variante verworfen

### Bugfix: Leaflet JS SRI-Hash korrigiert
- `frontend/index.html`: falscher `integrity`-Hash für Leaflet 1.9.4
- Folge: Browser blockierte Leaflet (`ERR_SRI_SIGNATURE_CHECK_FAILED`), `window.L` war nie gesetzt, `NV2_OSM.init()` brach sofort ab
- OSM-Karte ist nun wieder vollständig nutzbar

### Docker-Container überarbeitet
- `backend/Dockerfile`: Python 3.12 → 3.13; `WORKDIR /app` → `/app/backend`
  (`BASE_DIR.parent/frontend` zeigt korrekt auf `/app/frontend`);
  Healthcheck `/health` → `/health/live`; `tini` als PID-1; non-root User (nagvis, UID 1000)
- `docker-compose.yml`: Volume `/app/data` → `/app/backend/data`
- `backend/.dockerignore`: `venv/`, `__pycache__/`, `data/` ausgeschlossen

### Changelog-Updater als Skript abgelegt
- `scripts/update_changelog.py` schreibt `changelog.txt` (UTF-16) und `changelog.md` aus einer Quelle
- Aufruf: `python scripts/update_changelog.py`

### Standard-Port auf 8008 geändert (war 8000)
- `backend/core/config.py`: `PORT`-Default `8000` → `8008`
- `backend/Dockerfile`: `EXPOSE` + uvicorn `--port 8008`
- `docker-compose.yml`: Port-Mapping `8008:8008`, `CORS_ORIGINS`
- `nginx.conf`: `proxy_pass` auf `127.0.0.1:8008`
- `package.json`: `backend:start --port 8008`
- `helm/nagvis2/`: `values.yaml` + `deployment.yaml` auf Port 8008
- `docs/admin-guide.md`, `api-reference.md`, `README.md` aktualisiert

### Map-Miniaturbilder (Thumbnails) in der Übersicht

**Backend**
- `core/config.py`: `THUMBS_DIR = data/thumbnails`
- `core/storage.py`: `list_maps()` liefert `thumbnail`-Feld (URL `/thumbnails/{id}.png` wenn Datei existiert)
- `core/storage.py`: `delete_map()` löscht auch Thumbnail-Datei
- `api/router.py`: `POST /api/maps/{id}/thumbnail` (PNG/JPEG/WebP Upload)
- `api/router.py`: `DELETE /api/maps/{id}/thumbnail`
- `main.py`: `/thumbnails/` als `StaticFiles` gemountet

**Frontend**
- `map-core.js`: `_thumbHtml()` — Thumbnail > Hintergrundbild > OSM-Placeholder > Gitternetz-Placeholder
- `map-core.js`: `_captureThumbnail()` — liest Node-Positionen synchron aus DOM (vor Canvas-Verstecken)
- `map-core.js`: `_buildAndUploadThumb()` — zeichnet 320×180 Canvas (Hintergrundfarbe, Gitternetz,
  Hintergrundbild, Nodes als farbige Punkte mit Glow); lädt PNG hoch
- `map-core.js`: `showOverview()` ruft `_captureThumbnail()` automatisch auf
- `css/styles.css`: `.ov-thumb`, `.ov-thumb-ico`, `.ov-thumb-grid`

### Bugfix: Auth-Bypass (AUTH_ENABLED=false)
- `backend/core/auth.py`: `_ANON_ADMIN`-Singleton — `require_auth` gibt diesen zurück wenn `AUTH_ENABLED=false`
- `frontend/js/auth.js`: `currentUser = { username:'admin', role:'admin' }` wenn Auth deaktiviert → Benutzerverwaltungs-UI erscheint korrekt

### Feature: OSM Cluster-Bubbles ✅
- `frontend/index.html`: Leaflet.markercluster v1.5.3 (CDN, CSS + JS)
- `js/osm.js`: `_clusterGroup = L.markerClusterGroup(...)` — Bubble-Farbe zeigt schlechtesten Status der Kind-Marker; Edit-Mode deaktiviert Clustering für Drag-Support

### Bugfix: Thumbnail-Timing-Problem
- `frontend/js/map-core.js`: nach erfolgreichem Upload wird `.ov-thumb`-DOM direkt aktualisiert (kein Map-Listen-Reload nötig)

### Feature: Audit-Log (N8) ✅
**Backend**
- NEU: `core/audit.py` — append-only JSONL-Log in `data/audit.jsonl`
  - `audit_log(request, action, **details)` — schreibt Eintrag mit Timestamp, User, Action, Details
  - `read_audit(limit, map_id, action, user)` — filterbares Lesen, neueste zuerst
  - `_maybe_rotate` — Rotation ab 10.000 Einträgen (20 % älteste gelöscht)
  - User aus Bearer-Token oder `X-NV2-User`-Header, Fallback `"system"`
- `api/router.py`: alle mutierenden Endpunkte schreiben Audit-Einträge
- `api/auth_router.py`: `user.create`, `user.role_change`, `user.password_change`, `user.delete`
- NEU: `GET /api/audit?limit=&map_id=&action=&user=`

**Frontend**
- `index.html`: „📜 Audit-Log"-Button im Burger-Menü + `<div id="dlg-audit">`
- `js/auth.js`: `nv2AuditOpen()`, `nv2AuditLoad()` mit Filterfeldern
- `js/ws-client.js`: `api()` sendet `X-NV2-User`-Header
- `css/styles.css`: Audit-Tabellen-Stile

### Feature: Test-Coverage (N6) ✅ — Ziel ≥ 70 % erreicht
- `backend/pyproject.toml` (NEU): pytest-Konfiguration (`asyncio_mode = "auto"`)
- `backend/requirements-dev.txt` (NEU): pytest, pytest-asyncio, pytest-cov, anyio
- `backend/tests/conftest.py` (NEU): `data_dirs` + `client` Fixtures mit vollständiger Isolation
- Neue Test-Dateien: `test_ws_manager.py` (25), `test_api_maps.py` (34), `test_auth.py` (17), `test_audit.py` (13), `test_storage.py` (25), `test_perfdata.py` (18)
- **137 Tests, alle grün** — `ws/manager.py` **89 %**, `main.py` **76 %**
- `backend/main.py`: `import logging.handlers` ergänzt (fehlte → 34 Test-Fehler)

### Feature: Layer-System vervollständigt ✅
- `js/nodes.js`: Layer-Panel mit Drag-Handle (`⠿`) vor jeder Zeile
- Drag-to-Reorder: Layer per Drag & Drop umsortieren; zIndex neu vergeben (10, 20, 30, …) und sofort angewendet
- Löschen-Button (`✕`, erscheint beim Hover): Layer entfernen; Objekte werden auf Layer 0 verschoben (Bestätigung wenn belegt)
- Layer-Liste wird nach zIndex sortiert dargestellt
- `css/styles.css`: `.layer-drag-handle`, `.layer-del-btn`, `.layer-dragging`, `.layer-drag-over`

### Feature: Sidebar + Übersicht Map-Hierarchie ✅
- `js/map-core.js`: `_sortMapsHierarchically()` — Root-Maps oben, Kind-Maps direkt darunter (`_depth=1`)
- `renderSidebarMaps()`: Kind-Maps mit `.map-entry-child` + `↳`-Pfeil eingerückt
- `renderOverview()`: gleiche Sortierung; Kind-Karten `.ov-card-child` (linker Akzentbalken); Eltern-Titel statt ID
- `css/styles.css`: `.map-entry-child`, `.map-entry-indent`, `.ov-card-child`

### Feature: Topbar-Navigation (Eltern-/Kind-Links) ✅
- `index.html`: `<div id="tb-nav" class="tb-nav">` zwischen `tb-ident` und `tb-pills`
- `js/map-core.js`: `_renderTopbarNav(mapId, parentMapId)`
  - Kind-Map: zeigt `↑ Eltern-Map-Titel`-Button
  - Root-Map: zeigt Kind-Map-Chips (`↳ Titel`)
- `showOverview()`: leert `#tb-nav`
- `css/styles.css`: `.tb-nav`, `.tb-nav-up`, `.tb-nav-child`

### Bugfix: Standard-Defaults konsolidiert ✅
- `js/ui-core.js`: `restoreSidebar()` liest `loadUserSettings().sidebarDefault` (Standard: `'expanded'`)
- `js/ui-core.js`: `toggleSidebar()` speichert in `nv2-user-settings` statt `nv2-sidebar`
- `js/ui-core.js`: `setTheme()` speichert in `nv2-user-settings` statt `nv2-theme`
- `js/app.js`: Theme beim Start aus `loadUserSettings().theme` (Standard: `'dark'`)
- `index.html` FOUC-Snippet: liest `nv2-user-settings.theme`
- Erstbesuch / Inkognito → immer: **Dark-Theme + Sidebar ausgeklappt + Übersicht**

### Feature: Objekt-Typen 100 % ✅ – remove_ack + Linien-Aktionsmenü

**Backend**
- `core/livestatus.py`: `remove_host_ack()` → `REMOVE_HOST_ACKNOWLEDGEMENT`
- `core/livestatus.py`: `remove_service_ack()` → `REMOVE_SVC_ACKNOWLEDGEMENT`
- `api/router.py`: `remove_ack`-Handler (Host + Service)
- `api/router.py`: `GET /api/v1/hosts` — vollständige Host-Liste für Autocomplete

**Frontend**
- `js/nodes.js`: `openNodePropsDialog()` async — befüllt Datalist nach Dialog-Öffnen aus `GET /api/hosts` (nicht mehr nur WS-Cache)
- `js/nodes.js`: `showLineViewContextMenu()` — View-Mode-Kontextmenü auf einfachen Linien und Weathermap-Linien; zeigt ACK / Bestätigung aufheben / Wartung / Reschedule für `host_from` und `host_to`

### Feature: GitHub Actions – CI, Docker, MkDocs, Dependabot ✅

**CI** (`.github/workflows/ci.yml`)
- pytest + Coverage auf Python 3.11 / 3.12 / 3.13; `--cov-fail-under=70`
- Coverage-XML als Artifact; PR-Kommentar (nur 3.13)
- Trigger: push/PR auf `main` wenn `backend/**` geändert

**Docker** (`.github/workflows/docker.yml`)
- Multi-Platform Build (`linux/amd64` + `linux/arm64`); Push zu Docker Hub
- Tags: `latest` / `main` / SemVer (`v1.2.3` → `1.2.3`, `1.2`, `latest`)
- `workflow_run`-Trigger: läuft nur wenn CI grün ist
- BuildKit-Cache via GitHub Actions Cache

**MkDocs → GitHub Pages** (`.github/workflows/docs.yml`)
- `mkdocs gh-deploy` → `gh-pages` Branch; `concurrency: pages`
- Trigger: push auf `docs/**` oder `mkdocs.yml`

**Dependabot** (`.github/dependabot.yml`)
- `pip`: wöchentlich montags 07:00 Berlin; Gruppen `fastapi-stack`, `test-tools`, `observability`
- `github-actions`: wöchentlich montags 07:00 Berlin

### Feature: API-Versionierung `/api/v1/` ✅

**Backend**
- `api/router.py`: `prefix="/api"` → `"/api/v1"`
- `api/auth_router.py`: `prefix="/api/auth"` → `"/api/v1/auth"`
- `main.py`: `308 Permanent Redirect` `/api/*` → `/api/v1/*` für Rückwärtskompatibilität

**Frontend**
- `js/ws-client.js`: `api()` normalisiert `/api/` → `/api/v1/` vor `fetch()` — Demo-Mode-Handler unverändert
- `js/auth.js`: alle direkten `fetch()`-Aufrufe auf `/api/v1/` aktualisiert (8 Stellen)

### Feature: Swagger immer verfügbar ✅
- `backend/main.py`: `docs_url="/api/v1/docs"` — keine `DEBUG`-Bedingung mehr
- `frontend/index.html`: Swagger-Button öffnet `/api/v1/docs`
- `docs/admin-guide.md`: Hinweis auf `DEBUG=true`-Pflicht entfernt, URL aktualisiert
- `README.md`: URL-Tabelle aktualisiert
- `DEBUG=true` steuert jetzt nur noch Auto-Reload

### Codebase-Statistik in README.md
- Neue Sektion „Codebase-Statistik": 101 Quelldateien / 21 798 Zeilen
- Anteil: Python 37 %, JavaScript 33 %, Markdown 11 %, CSS 7 %, HTML 5 %
- Basis: ohne `venv/`, `__pycache__/`, `frontend/help/` (Build-Output)

### Feature: About-Dialog im Burger-Menü ✅

**Frontend**
- `index.html`: „Über"-Abschnitt + „Über NagVis 2"-Button im Burger-Menü (unterhalb Einstellungen)
- `index.html`: About-Dialog (`#dlg-about`) mit NagVis-Logo (⬡), Versionsnummer (aus `GET /api/v1/health`),
  Beschreibung, GitHub-Link mit SVG-Icon, Changelog-Toggle-Button
- `js/ui-core.js`: `openAboutDlg()` (async)
  - Lädt Version aus `GET /api/v1/health`
  - Lädt Changelog via `GET /api/v1/changelog` (UTF-8, kein ArrayBuffer-Trick mehr)
  - Setzt Toggle-State bei jedem Öffnen zurück
- `window.openAboutDlg` exportiert

**Backend**
- `api/router.py`: `GET /api/v1/changelog` — liest `changelog.txt` (UTF-16) und gibt `text/plain; charset=utf-8` zurück; Fallback auf `changelog.md`

### Feature: Label-Templates mit Nagios-Macros + Checkmk-Labels ✅

**Backend**
- `livestatus/client.py`: `_parse_custom_variables()` — konvertiert Nagios Custom-Variables (`_OS` → `os`);
  Livestatus-Query um `custom_variables` / `host_custom_variables` erweitert
- `livestatus/client.py`: `labels`-Feld in `HostStatus` + `ServiceStatus` + `to_dict()`
- `checkmk/client.py`: `extensions.labels` aus Checkmk REST API übernommen (`host_labels` als Fallback)
- `api/router.py`: `label_template: Optional[str]` in `ObjectProps` (PATCH-Endpoint)

**Frontend**
- `js/nodes.js`: `resolveMacros(template, obj, status)` — löst auf:
  `$HOSTNAME$`, `$HOSTALIAS$`, `$HOSTSTATE$`, `$HOSTOUTPUT$`,
  `$SERVICEDESC$`, `$SERVICESTATE$`, `$SERVICEOUTPUT$`,
  `$LABEL:key$` (Checkmk-Labels / Custom-Variables), `$MAPNAME$`
- `js/nodes.js`: `_nodeLabel(obj, status)` — Template hat Vorrang vor statischem Label
- `js/nodes.js`: `_applyLabelTemplate(el, obj, status)` — aktualisiert DOM bei jedem WS-Status-Update
- `js/nodes.js`: `applyStatuses()` — ruft `_applyLabelTemplate` auf wenn `data-label-template` gesetzt
- `js/nodes.js`: Props-Dialog mit Template-Eingabefeld und Macro-Referenz-Übersicht

### Feature: Icinga2 REST API Connector ✅

**Backend**
- `icinga2/__init__.py`: neues Python-Package
- `icinga2/client.py`: `Icinga2Client` + `Icinga2Config`
  - `GET /v1/objects/hosts|services|hostgroups` (via `POST` + `X-HTTP-Method-Override: GET`)
  - Basic Auth; `verify_ssl=False` als Default (selbstsignierte Zertifikate)
  - `HostStatus`: `available` → state, `vars.*` → labels
  - `ServiceStatus`: state, `perf_data` (Liste → String), labels
  - Aktionen: `acknowledge_host/service`, `remove_host/service_ack`,
    `schedule_host/service_downtime`, `reschedule_check`, `ping`
- `connectors/registry.py`: `Icinga2Client` in `AnyClient`, `_make_client()`,
  `_raw_from_client()`, `_client_info()`

**Frontend**
- `map-core.js`: „Icinga2 REST API" im Typ-Dropdown
- `map-core.js`: `bm-fields-icinga2` (URL, Benutzer, Passwort, SSL-Checkbox)
- `map-core.js`: `_bmUpdateFields()`, `_bmBuildEntry()`, `_bmClearForm()`, `_bmEditLoad()` erweitert

### Feature: Zabbix JSON-RPC Connector ✅

**Backend**
- `zabbix/__init__.py`: neues Python-Package
- `zabbix/client.py`: `ZabbixClient` + `ZabbixConfig`
  - JSON-RPC 2.0 via `POST /api_jsonrpc.php`
  - Auth: Bearer-Token (Zabbix 6.0+) oder `user.login` (Fallback)
  - `host.get`: `available` → state, `maintenance_status` → in_downtime, Tags → labels
  - `problem.get`: `severity` → state (0–2=WARNING, 3–5=CRITICAL), Tags → labels
  - `hostgroup.get`: Gruppen mit Host-Mitgliedern
  - Wartung: `maintenance.create` (Host-Level; Zabbix kennt keine Service-Downtimes)
  - ACK: `event.acknowledge` (action=6: acknowledge + message)
  - `ping`: `apiinfo.version` (kein Auth erforderlich)
- `connectors/registry.py`: `ZabbixClient` in `AnyClient`, `_make_client()`,
  `_raw_from_client()`, `_client_info()`

**Frontend**
- `map-core.js`: „Zabbix JSON-RPC API" im Typ-Dropdown
- `map-core.js`: `bm-fields-zabbix` (URL, API-Token, Benutzer/Passwort-Fallback, SSL-Checkbox)
- `map-core.js`: `_bmUpdateFields()`, `_bmBuildEntry()`, `_bmClearForm()`, `_bmEditLoad()` erweitert

---

---

## [2026-03-20]

### Burger-Menü: Log-Viewer & Download
- „Log anzeigen": Modal-Dialog mit gefilterbarer Log-Tabelle
- „Log herunterladen": `nagvis2.log` als Plaintext-Download

**Backend**
- `core/logging_setup.py`: In-Memory-Ringpuffer (`_RingBufferHandler`) — letzte 1000 Zeilen (`LOG_BUFFER_LINES` konfigurierbar)
- `GET /api/logs`: Parameter `lines` (1–2000), `level`, `download`

**Frontend**
- `dlg-log`: Zeilen-Selector, Level-Dropdown, Freitext-Filter
- `openLogViewer()` / `loadLog()` / `downloadLog()` in `ui-core.js`

### Prometheus-Monitoring & Kubernetes-Betrieb

**Backend**
- NEU: `core/metrics.py` — alle Prometheus-Metriken
  (`nagvis2_http_requests_total`, `nagvis2_http_request_duration_seconds`,
  `nagvis2_ws_connections`, `nagvis2_backend_reachable`, ...)
- NEU: `core/logging_setup.py` — strukturiertes Logging
  (`LOG_FORMAT=json` → python-json-logger; `LOG_FORMAT=text` → Standard)
- `main.py`: `GET /metrics`, `GET /health/live`, `GET /health/ready`, HTTP-Middleware
- `ws/manager.py`: Poll-Dauer und Fehler instrumentiert
- `requirements.txt`: `prometheus-client>=0.20.0`, `python-json-logger>=2.0.0`

**Helm-Chart**
- NEU: `helm/nagvis2/` — vollständiger Helm-Chart
  (Ingress, PVC, HPA, ServiceMonitor konfigurierbar; disabled by default)

### favicon.svg hinzugefügt
- NagVis-Hexagon-Logo als SVG (dunkler Hintergrund, Cyan-Akzente)
- `favicon.ico` 404 behoben

### Rechtsklick-Menü auf Map-Karten
- Kontextmenü per Rechtsklick: Öffnen, Umbenennen, Canvas-Format, Exportieren, Löschen
- Menü-Position am Viewport-Rand eingeklemmt

### OSM / Weltkarte
- Canvas-Modus `osm`: interaktive OpenStreetMap via Leaflet.js 1.9.4
- Nodes als Custom-HTML-Marker (`x` = Breitengrad, `y` = Längengrad)
- Drag & Drop im Edit-Mode mit automatischer API-Persistierung
- Tile-Server konfigurierbar; Kartenposition automatisch gespeichert
- `osm.js`: neues Frontend-Modul (`window.NV2_OSM`)
- Dokumentation: `docs/osm-guide.md`

### Perfdata-Parsing: Gadgets zeigen Live-Metrikwerte
**Backend**
- NEU: `core/perfdata.py` — Nagios/Checkmk Perfdata-Parser
- `livestatus/client.py`: `perf_data`-Feld ergänzt
- `ws/demo_data.py`: 5 Demo-Services mit Perfdata

**Frontend**
- `state.js`: `window.perfdataCache`
- `nodes.js`: `_applyGadgetPerfdata()`, Gadget-Dialog mit `perf_label`-Feld

### Gadget-Parameter-UI erweitert
- Linear: Orientierung konfigurierbar (Horizontal / Vertikal)
- Sparkline: Datenpunkt-Anzahl konfigurierbar (5–100)
- Raw-Number: Nachkommastellen-Feld (0–6)
- Preview-Bug behoben

### Multi-Select für Nodes im Edit-Mode
- Klick / Shift+Klick / Lasso-Selektion
- Gruppen-Drag, Gruppen-Löschen (Rechtsklick / Delete)
- `selectedNodes` (`window.Set`) in `state.js`

### Kiosk-Modus: Zoom/Pan-Fix für SVG-Linien
- `#nv2-lines-svg` verbleibt in `#map-canvas-wrapper` — DOM-Move entfernt

### Demo-Features Map & Auto-Fallback
- `data/maps/demo-features.json`: Demo-Map mit 14 Objekten
- `detectDemoMode`: öffnet demo-features wenn kein Backend erreichbar

### Backend-Management-UI
- `openBackendMgmtDlg()`: Backends verwalten, hinzufügen, testen
- `POST /api/backends/probe`

### Checkmk REST API Connector
- `checkmk/client.py`: async HTTP-Client für Checkmk REST API v1.0
- `connectors/registry.py`: Unified Backend Registry
- `data/backends.json` für Persistenz

### Refactor: Projektverzeichnis verschoben `beta/nagvis2` → `nagvis2`
- Verzeichnis eine Ebene höher, `beta/`-Zwischenordner entfernt
- `.github/workflows/`: ci, docker, docs, release — alle Pfade aktualisiert
- `.github/dependabot.yml`: pip `directory` aktualisiert
- `scripts/make_changelog.py`: Input-/Output-Pfade aktualisiert

### Feature: F5 Prometheus & VictoriaMetrics Connector ✅
- `backend/prometheus/client.py`: Async HTTP-Client für Prometheus HTTP API v1
- Hosts aus `up`-Metrik abgeleitet (`host_label` konfigurierbar, Standard: `instance`)
- Services aus firing/pending Alerts (`GET /api/v1/alerts`)
- Hostgruppen aus `job`-Label
- Severity-Mapping: `critical/page/error` → CRITICAL, `warning/warn/info` → WARNING
- Auth: Bearer Token + Basic Auth (beide optional); VictoriaMetrics vollständig kompatibel
- Aktionen (ACK, Downtime) → `False` (Prometheus ist read-only)
- `connectors/registry.py`: `PrometheusClient` eingebunden
- `frontend/js/map-core.js`: Prometheus-Option + Felder im Backend-Dialog

### Dokumentation: `dev-guide.md` erstellt ✅
- Vollständiges Entwickler-Handbuch: Stack, lokales Setup, Projektstruktur
- Backend-Architektur (Request-Flow, WebSocket-Flow, Konfiguration, Persistenz)
- Frontend-Architektur (Ladereihenfolge, globale Variablen, `api()`-Wrapper, Demo-Modus)
- Schritt-für-Schritt-Anleitungen: neuer Connector, API-Endpoint, Dialog
- Tests, Code-Konventionen, Release-Prozess
- `mkdocs.yml`: „Entwickler"-Eintrag in Navigation

---

---

## [2026-03-19]

- UX-Aufgaben dokumentiert (Host-Anzeige, Sprachunterstützung)
- `todo-liste.md` aktualisiert

---

---

## [2026-03-18]

- `nginx.conf` (Development, WSL-kompatibel)
- API-Grundgerüst und Error-Handling
- Help-System vorbereitet

---

---

## [2026-03-17]

- Projekt-Grundstruktur angelegt
- WebSocket-Grundgerüst, Docker-Vorbereitung
- README erstellt
