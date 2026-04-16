# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Backend starten (Port 8008, Auto-Reload)
npm run backend:start
# oder direkt:
cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8008 --reload

# Backend-Tests (pytest, aus Root oder backend/)
pytest
cd backend && pytest

# Frontend-Unit-Tests (Vitest)
npm run test:unit           # einmalig
npm run test:unit:watch     # Watch-Modus
npm run test:unit:cov       # mit Coverage-Report

# E2E-Tests (Playwright, startet Backend mit DEMO_MODE=true automatisch)
npm run test:e2e
npm run test:e2e:ui         # interaktive UI

# Einzelnen Backend-Test ausführen
pytest backend/tests/test_api_maps.py::TestMapCreate::test_create_map

# Docker
docker compose up --build -d

# Docs (MkDocs → frontend/help/)
npm run docs:build
npm run docs:serve
```

## Architektur

### Backend (FastAPI, Python 3.11+)

`backend/main.py` ist der Einstiegspunkt. Er mountet:
- `/api/v1/*` → `api/router.py` (Maps, Objects, Backends, Kiosk, Actions, Export)
- `/api/v1/auth/*` → `api/auth_router.py` (Login, JWT, User-CRUD, LDAP)
- `/ws/map/<map_id>` → `ws/router.py` (WebSocket, Status-Updates)
- `/` → `frontend/` (Vanilla-JS SPA als statische Dateien)
- `/api/*` → 308-Redirect zu `/api/v1/*`

**Konfiguration:** Ausschließlich über Umgebungsvariablen (siehe `backend/core/config.py`). Template: `backend/.env.example`. Relevante Variablen: `AUTH_ENABLED`, `NAGVIS_SECRET`, `DEMO_MODE`, `WS_POLL_INTERVAL`, `LIVESTATUS_*`, `PORT`.

**Persistence:** Kein ORM, kein Datenbankserver. Alles als JSON-Dateien in `backend/data/`:
- `maps/<map_id>.json` – Kartendefinitionen
- `backends.json` – Backend-Konfigurationen
- `users.json` – Lokale Benutzer (bcrypt)
- `tokens.json` – JWT-Metadaten
- `kiosk_users.json`, `ldap.json`, `presets.json`, `audit.jsonl`

**Multi-Backend-System (`connectors/registry.py`):**
Das Herzstück der Datenbeschaffung. `registry` (Singleton) verwaltet alle konfigurierten Backends parallel:
- Typen: `livestatus_tcp`, `livestatus_unix`, `checkmk`, `icinga2`, `naemon`, `zabbix`, `prometheus`, `solarwinds`, `demo`
- Jeder Client-Typ hat seinen eigenen Unterordner (`checkmk/`, `livestatus/`, `icinga2/`, …)
- `registry.get_all_hosts_tagged()` / `get_all_services_tagged()` queried alle Backends via `asyncio.gather()` und taggt Ergebnisse mit `_backend_id`
- Config wird in `data/backends.json` persistiert; Laufzeit-Methoden: `add_backend()`, `remove_backend()`, `toggle_backend()`
- **`BackendCreate`-Pydantic-Modell** in `api/router.py` bestimmt, welche Felder über die API angenommen werden. Neue Backend-Felder müssen dort deklariert werden, sonst werden sie von `model_dump()` ignoriert.

**WebSocket-Polling (`ws/manager.py`):**
`ConnectionManager` hält alle aktiven WS-Verbindungen (gruppiert nach `map_id`). Der Hintergrund-Poller fragt alle Backends im Interval `WS_POLL_INTERVAL` ab, vergleicht mit dem letzten Snapshot (diff-basiert) und sendet nur Änderungen. Nachrichtentypen: `snapshot`, `status_update`, `heartbeat`, `backend_error`.

**Auth:** `AUTH_ENABLED=false` (Default) → App läuft offen, Absicherung via nginx/OMD. `AUTH_ENABLED=true` → JWT Bearer-Token, Rollen: `viewer` / `editor` / `admin`. Dependency Injection: `require_auth()`, `require_editor()`, `require_admin()`.

### Frontend (Vanilla JS, kein Build-Schritt)

Die Dateien in `frontend/` werden direkt von FastAPI ausgeliefert. Kein Bundler, kein Build-Schritt. Änderungen sind sofort im Browser sichtbar.

**Globaler State (`frontend/js/state.js`):**  
Alle geteilten Zustände leben als `window.*`-Variablen:
- `window.activeMapId`, `window.activeMapCfg` – aktuell geöffnete Karte
- `window.editActive` – Edit-Modus
- `window.selectedNodes` – Set der selektierten DOM-Elemente
- `window.hostCache`, `window.serviceCache`, `window.perfdataCache` – Live-Status-Cache (befüllt vom WebSocket)
- `window.backendList` – aus `/api/backends` geladen (für Monitoring-Links)
- `window.hostgroupCache`, `window.servicegroupCache` – für Auto-Map-Dialog

**Wichtige JS-Dateien:**
| Datei | Funktion |
|---|---|
| `app.js` | DOMContentLoaded, Routing via URL-Hash (`#/map/<id>`), Event-Listener |
| `state.js` | Deklaration aller globalen `window.*`-Variablen |
| `map-core.js` | `openMap()`, `showOverview()`, Map-Templates, Auto-Map-Dialog, Backend-Mgmt-Dialog |
| `nodes.js` | Node-Rendering, Lasso-Selektion, Drag & Drop, Kontextmenüs, `resolveMacros()`, Monitoring-URL-Bau |
| `ui-core.js` | Topbar-Pills, Sidebar-Panels (Problems/Hosts/Events), Theme, `openMonitoringDashboard()`, `_openInMonitoringOrFocus()` |
| `ws-client.js` | WebSocket-Verbindung, `applyStatuses()` |
| `gadget-renderer.js` | Canvas-Rendering (Gauge, Sparkline, Thermometer, Graph) |
| `constants.js` | SVG-Icons, Zustands-Farben, Objekt-Typ-Konstanten |
| `history.js` | Undo/Redo (Command-Pattern) |

**Monitoring-Links:**
`_openInMonitoringOrFocus()` in `ui-core.js` baut URLs für Checkmk-Links aus dem Status-Panel. Priorität der Basis-URL: `backend.web_url` (manuell eingetragen bei Livestatus-Backends) → `backend.address` minus `/api/1.0` (Checkmk-REST-Backends) → beliebige HTTP-Adresse als Fallback.

**Lasso-Selektion:**
`onCanvasMouseDown()` in `nodes.js` zeichnet das Lasso. Nach dem Drag wird `window._nv2LassoDone = true` gesetzt, damit der anschließende `click`-Event in `onCanvasClick()` die Selektion nicht sofort wieder löscht.

### Tests

**Backend-Tests** (`backend/tests/`) mit pytest + asyncio. Fixtures in `conftest.py` setzen isolierte `tmp_path`-Verzeichnisse. Coverage-Mindestanforderung: 70%.

**Frontend-Unit-Tests** (`frontend/tests/unit/`): Vitest + jsdom. Das Setup-File `frontend/tests/unit/setup.js` lädt `constants.js` und den `resolveMacros`-Block aus `nodes.js` via indirektem `eval()` in den globalen Scope. Der Slice aus `nodes.js` endet dynamisch an der ersten `}`-Zeile auf Spalte 0 nach Zeile 30 (= Ende von `resolveMacros`). Falls die Funktion in `nodes.js` wächst, muss **nur** diese Logik in `setup.js` angepasst werden.

**Changelog:** `changelog.txt` ist UTF-16 kodiert. Änderungen immer via Python-Script vornehmen, nie direkt editieren.
