# NagVis 2 – Developer Guide

Dieses Dokument beschreibt Architektur, lokales Setup und alles was man braucht um Features beizutragen oder das Projekt zu erweitern.

---

## Inhaltsverzeichnis

1. [Stack & Abhängigkeiten](#1-stack--abhängigkeiten)
2. [Lokales Setup](#2-lokales-setup)
3. [Projektstruktur](#3-projektstruktur)
4. [Backend-Architektur](#4-backend-architektur)
5. [Frontend-Architektur](#5-frontend-architektur)
6. [Neuen Backend-Connector hinzufügen](#6-neuen-backend-connector-hinzufügen)
7. [Neuen Import-Endpoint hinzufügen (Datei-Upload)](#7-neuen-import-endpoint-hinzufügen-datei-upload)
8. [Neuen API-Endpoint hinzufügen](#8-neuen-api-endpoint-hinzufügen)
9. [Neuen Frontend-Dialog hinzufügen](#9-neuen-frontend-dialog-hinzufügen)
10. [Neuen Gadget-Typ hinzufügen](#10-neuen-gadget-typ-hinzufügen)
11. [Tests](#11-tests)
12. [Code-Konventionen](#12-code-konventionen)
13. [Release-Prozess](#13-release-prozess)

---

## 1. Stack & Abhängigkeiten

| Schicht | Technologie |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn, httpx |
| WebSocket | FastAPI WebSocket, asyncio |
| Frontend | Vanilla JS (kein Framework), keine Build-Tools |
| Daten | JSON-Files in `data/` (kein DB-Server nötig) |
| Docs | MkDocs + Material Theme |
| Tests | pytest (Backend), Vitest + Playwright (Frontend) |
| CI | GitHub Actions |

**Keine Build-Tools im Frontend** — alle `.js`-Dateien werden direkt als `<script>`-Tags eingebunden. Kein Webpack, kein Vite, kein TypeScript-Compiler.

---

## 2. Lokales Setup

### Voraussetzungen

- Python 3.11+
- Git

### Setup

```bash
git clone https://github.com/bh2005/nagvis-kurz-vor-2
cd nagvis-kurz-vor-2/nagvis2/backend

# Virtuelle Umgebung
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Abhängigkeiten
pip install -r requirements-dev.txt

# Konfiguration (optional – Demo-Modus geht ohne .env)
cp .env.example .env
# Datei anpassen (LIVESTATUS_HOST, AUTH_ENABLED, ...)

# Starten
python main.py
# → http://localhost:8008
```

Im **Demo-Modus** (kein Monitoring-Backend nötig):

```bash
DEMO_MODE=true python main.py
```

### Mit Docker

```bash
cd nagvis-kurz-vor-2/nagvis2
docker compose up --build
# → http://localhost:8008
```

---

## 3. Projektstruktur

```
nagvis2/
├── backend/
│   ├── main.py                   ← FastAPI App, Startup, StaticFiles
│   ├── requirements.txt          ← Produktions-Abhängigkeiten
│   ├── requirements-dev.txt      ← + pytest, httpx[async], ruff
│   ├── .env.example
│   ├── Dockerfile
│   │
│   ├── core/
│   │   ├── config.py             ← Settings via pydantic-settings (.env)
│   │   ├── storage.py            ← Map CRUD, clone_map()
│   │   ├── auth.py               ← JWT, require_auth, require_admin
│   │   ├── users.py              ← Benutzerverwaltung (bcrypt, users.json)
│   │   ├── audit.py              ← Audit-Log (JSONL, Rotation)
│   │   ├── perfdata.py           ← Nagios Perfdata-Parser
│   │   ├── livestatus.py         ← Livestatus TCP/Unix Client
│   │   ├── logging_setup.py      ← Strukturiertes Logging, In-Memory-Buffer
│   │   └── metrics.py            ← Prometheus-Metriken
│   │
│   ├── checkmk/client.py         ← Checkmk REST API v1.0
│   ├── icinga2/client.py         ← Icinga2 REST API v1
│   ├── zabbix/client.py          ← Zabbix JSON-RPC API
│   ├── prometheus/client.py      ← Prometheus / VictoriaMetrics HTTP API
│   │
│   ├── connectors/
│   │   ├── registry.py           ← Unified Backend Registry (Singleton)
│   │   └── demo_client.py        ← Demo-Client mit statischen Testdaten
│   │
│   ├── api/
│   │   ├── router.py             ← Maps, Objekte, Backends, Logs, Aktionen
│   │   └── auth_router.py        ← Login, Refresh, User-CRUD
│   │
│   ├── ws/
│   │   ├── manager.py            ← WebSocket-Verbindungsverwaltung
│   │   ├── router.py             ← WS-Endpoint /ws/map/{map_id}
│   │   └── demo_data.py          ← Statische Demo-Daten für Demo-Modus
│   │
│   └── tests/
│       ├── conftest.py
│       ├── test_storage.py
│       ├── test_auth.py
│       ├── test_auth_router.py
│       ├── test_api_maps.py
│       ├── test_audit.py
│       ├── test_perfdata.py
│       ├── test_ws_manager.py
│       └── test_prometheus_client.py
│
├── frontend/
│   ├── index.html                ← Einzige HTML-Datei; lädt alle JS + CSS
│   ├── css/styles.css
│   ├── lang/
│   │   ├── de.json               ← Deutsches Sprachpaket
│   │   └── en.json               ← Englisches Sprachpaket
│   └── js/
│       ├── i18n.js               ← i18n-Engine (ZUERST laden!) — t(), setLang(), importLangPack()
│       ├── gadget-renderer.js    ← Gadget-Rendering inkl. graph/iframe-Typ
│       ├── zoom_pan.js           ← Zoom/Pan-Modul (NICHT ANFASSEN)
│       ├── constants.js          ← STATE_CLS, ICON_SVG, svgToDataUri, iconSrc
│       ├── state.js              ← Alle globalen Laufzeit-Variablen
│       ├── ui-core.js            ← Theme, Dialoge, Benutzereinstellungen
│       ├── ws-client.js          ← WebSocket, api()-Wrapper, Demo-Mode-Handler
│       ├── nodes.js              ← Node-Rendering, Edit-Mode, Gadgets
│       ├── map-core.js           ← Map-Verwaltung, Backend-Dialog, Export
│       ├── kiosk.js              ← Kiosk-Modus, Token-Login, Map-Rotation
│       └── app.js                ← DOMContentLoaded – bindet alles zusammen
│
├── docs/                         ← MkDocs-Quelldateien
│   ├── admin-guide.md
│   ├── user-guide.md
│   ├── dev-guide.md              ← diese Datei
│   ├── api-reference.md
│   ├── kiosk-guide.md
│   └── osm-guide.md
│
├── scripts/
│   └── update_changelog.py       ← Changelog-Generator (TXT UTF-16 + MD)
│
├── data/                         ← Persistente Daten (auto-erstellt, in .gitignore)
│   ├── maps/
│   ├── backgrounds/
│   ├── backends.json
│   └── users.json
│
├── docker-compose.yml
├── nginx.conf
├── mkdocs.yml
├── build.sh
└── install.sh
```

---

## 4. Backend-Architektur

### Request-Flow

```
Browser → FastAPI (main.py)
           ├── /api/v1/*   → api/router.py      (Maps, Backends, Aktionen)
           ├── /api/v1/auth/* → api/auth_router.py
           ├── /ws/map/{id}  → ws/router.py      (WebSocket)
           ├── /metrics      → metrics.py
           └── /*            → StaticFiles → frontend/
```

### WebSocket-Flow

```
ws/router.py → ws/manager.py → poll_loop()
                                  └── registry.get_all_hosts_tagged()
                                      registry.get_all_services_tagged()
                                      → broadcast status_update an alle Clients
```

Der Poll-Loop läuft als Background-Task, `WS_POLL_INTERVAL` (Standard: 10s) konfigurierbar.

### Konfiguration

Alle Einstellungen via `core/config.py` (pydantic-settings, liest `.env`):

```python
from core.config import settings
settings.DATA_DIR          # Path zu data/
settings.AUTH_ENABLED      # bool
settings.DEMO_MODE         # bool
settings.WS_POLL_INTERVAL  # int (Sekunden)
```

### Datenpersistenz

Maps werden als JSON in `data/maps/<id>.json` gespeichert. Kein ORM, kein DB-Server.
`core/storage.py` bietet: `load_map()`, `save_map()`, `list_maps()`, `delete_map()`, `clone_map()`.

---

## 5. Frontend-Architektur

### Warum kein Framework?

Bewusste Entscheidung: keine Build-Tools, kein npm für den Produktivbetrieb. Das Frontend läuft direkt aus dem Repository-Verzeichnis ohne Compilation.

### Script-Ladereihenfolge

Die Reihenfolge in `index.html` ist strikt einzuhalten:

```html
<script src="js/i18n.js"></script>             <!-- 1. i18n-Engine (ZUERST — t() muss vor allen anderen Modulen verfügbar sein) -->
<script src="js/gadget-renderer.js"></script>  <!-- 2. Gadget-Renderer (extern) -->
<script src="js/zoom_pan.js"></script>          <!-- 3. Zoom/Pan (extern) -->
<script src="js/constants.js"></script>         <!-- 4. Konstanten -->
<script src="js/state.js"></script>             <!-- 5. Globaler State -->
<script src="js/ui-core.js"></script>           <!-- 6. UI-Grundfunktionen -->
<script src="js/ws-client.js"></script>         <!-- 7. WebSocket + api() -->
<script src="js/nodes.js"></script>             <!-- 8. Node-Rendering -->
<script src="js/map-core.js"></script>          <!-- 9. Map-Verwaltung -->
<script src="js/kiosk.js"></script>             <!-- 10. Kiosk-Modus -->
<script src="js/app.js"></script>               <!-- 11. Init (ZULETZT) -->
```

### Globale Variablen

**Kritisch:** `let` in einem `<script>`-Block ist **nicht** in anderen Dateien sichtbar. Alle öffentlichen Funktionen und Variablen müssen als `window.xyz = ...` gesetzt werden.

```javascript
// FALSCH – nicht sichtbar in anderen Dateien:
let activeMapId = null;

// RICHTIG:
window.activeMapId = null;
```

### api()-Wrapper

Alle REST-Calls über den `api()`-Wrapper aus `ws-client.js`:

```javascript
// GET
const data = await api('/api/maps');

// POST mit Body
const result = await api('/api/maps', 'POST', { title: 'Neue Map' });

// PATCH
await api(`/api/maps/${id}/objects/${oid}/props`, 'PATCH', { name: 'Server1' });
```

Gibt bei Fehler `null` zurück (kein throw). Im Demo-Modus werden alle Schreiboperationen über Handler in `ws-client.js` auf localStorage umgeleitet.

### Demo-Modus

`detectDemoMode()` in `ws-client.js` versucht `GET /api/health`. Schlägt das nach 600ms fehl, wird `window.DEMO_MODE = true` gesetzt. Alle `api()`-Aufrufe gehen dann gegen localStorage-Handler statt gegen den echten Backend.

### i18n (Mehrsprachigkeit)

`i18n.js` wird als **erstes** Script geladen und stellt `window.t()` für alle anderen Module bereit.

**Schlüssel-basierte Übersetzung:**

```javascript
// Einfach
t('overview')                          // → "Übersicht" (DE) / "Overview" (EN)

// Mit Variablen
t('objects_count', { count: 42 })      // → "42 Objekte"
t('snapshot_status', { time: '12:00', count: 3 })
```

**Statische HTML-Texte** via `data-i18n`-Attribute (kein JS nötig):

```html
<span data-i18n="overview">Übersicht</span>
<input data-i18n-placeholder="search_placeholder">
<button data-i18n-title="btn_tooltip">...</button>
```

`applyI18n()` wird in `app.js` nach `await _i18nReady` aufgerufen und setzt alle Attribute.

**Neuen Übersetzungs-Schlüssel hinzufügen:**

1. Schlüssel in `frontend/lang/de.json` → `strings`-Objekt eintragen
2. Gleichen Schlüssel in `frontend/lang/en.json` eintragen
3. Im JS: `t('mein_schluessel')` oder `t('mein_schluessel', { var: wert })` verwenden
4. Im HTML: `data-i18n="mein_schluessel"` am Element

**Neue Sprache hinzufügen** (ohne Code-Änderung):

```json
{
  "meta": { "lang": "fr", "name": "Français", "version": "1" },
  "strings": {
    "overview": "Vue d'ensemble",
    "maps": "Cartes",
    ...
  }
}
```

Datei in **⚙ Einstellungen → Lang-Pack importieren** hochladen — sofort aktiv.

**Oder** als Built-in: `frontend/lang/fr.json` ablegen + Option im `<select>` in `index.html` ergänzen.

---

## 6. Neuen Backend-Connector hinzufügen

Am Beispiel eines neuen Connectors für "MyMonitoring":

### Schritt 1: Client implementieren

Neue Datei `backend/mymonitoring/__init__.py` (leer) und `backend/mymonitoring/client.py`:

```python
from dataclasses import dataclass
from livestatus.client import BackendHealth, HostStatus, ServiceStatus

@dataclass
class MyMonitoringConfig:
    backend_id: str   = "mymon-default"
    url:        str   = "http://mymon:8080"
    token:      str   = ""
    timeout:    float = 15.0
    verify_ssl: bool  = True
    enabled:    bool  = True

class MyMonitoringClient:
    def __init__(self, config: MyMonitoringConfig):
        self.cfg = config

    async def get_hosts(self) -> list[HostStatus]: ...
    async def get_services(self) -> list[ServiceStatus]: ...
    async def get_hostgroups(self) -> list[dict]: ...
    async def acknowledge_host(self, ...) -> bool: ...
    async def acknowledge_service(self, ...) -> bool: ...
    async def schedule_host_downtime(self, ...) -> bool: ...
    async def schedule_service_downtime(self, ...) -> bool: ...
    async def ping(self) -> BackendHealth: ...
```

**Interface-Pflicht:** Alle 8 Methoden müssen implementiert sein (NotImplemented-Backends können `return False` / `return []` zurückgeben).

### Schritt 2: Registry einbinden

In `backend/connectors/registry.py` 4 Stellen ergänzen:

```python
# 1. Import
from mymonitoring.client import MyMonitoringClient, MyMonitoringConfig

# 2. AnyClient Union
AnyClient = Union[..., MyMonitoringClient, DemoClient]

# 3. _raw_from_client() – neuen isinstance-Block
if isinstance(client, MyMonitoringClient):
    c = client.cfg
    return { "backend_id": c.backend_id, "type": "mymonitoring", "url": c.url, ... }

# 4. _make_client() – neuen elif-Block
elif t == "mymonitoring":
    return MyMonitoringClient(MyMonitoringConfig(
        backend_id = entry["backend_id"],
        url        = entry.get("url", ""),
        ...
    ))

# 5. _client_info() – neuen isinstance-Block
if isinstance(client, MyMonitoringClient):
    return { "backend_id": ..., "type": "mymonitoring", "address": ..., "enabled": True }
```

### Schritt 3: Frontend (map-core.js)

4 Stellen in `frontend/js/map-core.js`:

```javascript
// 1. <option> im Typ-Dropdown hinzufügen
<option value="mymonitoring">MyMonitoring API</option>

// 2. HTML-Felder (neues <div id="bm-fields-mymonitoring">)

// 3. _bmUpdateFields() – display-Zeile ergänzen
document.getElementById('bm-fields-mymonitoring').style.display = t === 'mymonitoring' ? '' : 'none';

// 4. _bmBuildEntry() – neues if-Block
if (type === 'mymonitoring') {
    const url = document.getElementById('bm-mym-url')?.value.trim();
    return { ...base, url, token: ..., verify_ssl: ... };
}

// 5. _bmClearForm() – neue IDs in die Array aufnehmen
// 6. _bmEditLoad() – neue set()-Aufrufe
```

### Schritt 4: Dokumentation

Neuen Abschnitt unter "Multi-Backend-Unterstützung → Backends" in `docs/admin-guide.md` hinzufügen.

> **Referenz-Implementierung:** Der Prometheus-Connector (`backend/prometheus/client.py`) ist ein vollständiges Beispiel für einen read-only HTTP-Connector mit Bearer-Token, Basic-Auth und SSL-Konfiguration.

---

## 7. Neuen Import-Endpoint hinzufügen (Datei-Upload)

Für Datei-Upload-Endpoints (z.B. draw.io-Import):

```python
@api_router.post("/maps/import-myformat", status_code=201)
async def api_import_myformat(
    file:    UploadFile = File(...),
    title:   str        = Query(""),
    request: Request    = None,
):
    content = await file.read()
    # Verarbeitung ...
    new_map = create_map({"title": title or file.filename, "canvas": {"mode": "ratio", "ratio": "16:9"}})
    # Objekte anlegen ...
    audit_log(request, "map.import_myformat", map_id=new_map["id"])
    return {"map_id": new_map["id"], "object_count": ..., "warnings": []}
```

**Pattern:** Query-Parameter statt Form-Felder verwenden — dann ist kein `python-multipart`-Import in den Typen nötig und der Endpoint ist direkt mit `?param=value` erreichbar.

**Frontend-Anbindung** (Beispiel aus draw.io-Import):
```javascript
const form = new FormData();
form.append('file', file);
const params = new URLSearchParams({ title: 'Mein Import' });
const res = await fetch(`/api/maps/import-myformat?${params}`, { method: 'POST', body: form });
```

---

## 8. Neuen API-Endpoint hinzufügen

Alle Endpoints in `backend/api/router.py` (oder `auth_router.py` für Auth).

```python
@router.get("/maps/{map_id}/myfeature")
async def get_my_feature(map_id: str, user=Depends(require_auth)):
    # Implementierung
    return {"result": "..."}
```

Versionierung: alle Endpoints laufen unter `/api/v1/`. In `main.py` ist der Router mit `prefix="/api/v1"` eingebunden. Ein 308-Redirect von `/api/` auf `/api/v1/` ist für Rückwärtskompatibilität aktiv.

**Demo-Mode:** Falls der Endpoint schreibt oder liest aus dem Dateisystem, einen entsprechenden Handler in `ws-client.js` unter `DEMO_HANDLERS` ergänzen:

```javascript
const DEMO_HANDLERS = {
  'POST /api/maps': async (body) => { /* localStorage */ },
  'GET /api/maps/myfeature': async () => { /* statische Daten */ },
};
```

---

## 9. Neuen Frontend-Dialog hinzufügen

### HTML (index.html)

```html
<div id="dlg-my-dialog" class="dlg" style="display:none">
  <div class="dlg-head">
    <span>Mein Dialog</span>
    <button class="dlg-close" onclick="closeDlg('dlg-my-dialog')">✕</button>
  </div>
  <div class="dlg-body">
    <!-- Inhalt -->
    <label class="f-label">Name</label>
    <input class="f-input" id="my-input" type="text">
  </div>
  <div class="dlg-foot">
    <button class="btn-cancel" onclick="closeDlg('dlg-my-dialog')">Abbrechen</button>
    <button class="btn-primary" onclick="myDialogSave()">Speichern</button>
  </div>
</div>
```

### JavaScript (z.B. in ui-core.js oder nodes.js)

```javascript
function openMyDialog(data) {
  document.getElementById('my-input').value = data?.name || '';
  openDlg('dlg-my-dialog');
}

async function myDialogSave() {
  const name = document.getElementById('my-input').value.trim();
  const result = await api('/api/myendpoint', 'POST', { name });
  if (result !== null) {
    closeDlg('dlg-my-dialog');
    showToast('Gespeichert', 'ok');
  }
}

// Am Ende der Datei exportieren:
window.openMyDialog  = openMyDialog;
window.myDialogSave  = myDialogSave;
```

### Hilfsfunktionen

| Funktion | Beschreibung |
|---|---|
| `openDlg(id)` | Dialog öffnen (zentriert, Overlay) |
| `closeDlg(id)` | Dialog schließen |
| `showToast(msg, type)` | Toast-Nachricht (`'ok'`, `'warn'`, `'error'`) |
| `esc(s)` | HTML-Escaping für dynamische Strings im DOM |
| `api(path, method, body)` | REST-Call, gibt `null` bei Fehler |

---

## 10. Neuen Gadget-Typ hinzufügen

Am Beispiel eines neuen Typs `"mytype"`:

### Schritt 1: Renderer in `gadget-renderer.js`

```javascript
// 1. Render-Funktion
function _mytype(cfg) {
  return `<div class="g-mytype" style="width:${cfg.width??200}px;height:${cfg.height??100}px">
    <span>${cfg.metric || 'Wert'}: ${cfg.value ?? 0}${cfg.unit || ''}</span>
  </div>`;
}

// 2. Dispatcher-Switch ergänzen
case 'mytype': return _mytype(cfg);

// 3. Export für Dialog-Vorschau
window._gadgetMytype = _mytype;
```

### Schritt 2: Konfigurations-Dialog in `nodes.js`

```javascript
// 1. Chip hinzufügen (in openGadgetConfigDialog HTML-String):
<button class="type-chip ..." data-gtype="mytype" onclick="_gcSelectType(this)">🔷 MeinTyp</button>

// 2. Typ-spezifische Felder-Div (mit id="gc-mytype-row")
// 3. _gcSelectType(): show/hide gc-mytype-row
// 4. _gcUpdatePreview(): case 'mytype': rendered.innerHTML = window._gadgetMytype?.(tmpCfg)
// 5. _gcSave(): Felder auslesen und in newCfg schreiben
```

### Hinweise

- Gadgets ohne Live-Datenanbindung: `updateGadget()` per `if (type === 'mytype') return;` überspringen
- Auto-Refresh-Logik (wie beim `graph`-Typ): `_graphTimers`-Map verwenden oder eigene Map anlegen
- Reine Anzeige-Gadgets (kein Host/Service nötig): `gc-datasource-row` und `gc-minmax-row` bei Typ-Wechsel ausblenden

---

## 11. Tests

### Backend (pytest)

```bash
cd nagvis-kurz-vor-2/nagvis2/backend
pytest -v
pytest --cov=. --cov-report=term-missing    # mit Coverage
pytest tests/test_prometheus_client.py -v   # einzelne Datei
pytest -k "test_poll_loop"                  # nach Name filtern
```

**Coverage-Schwelle:** `--cov-fail-under=70` in `pyproject.toml`. CI schlägt fehl wenn die Gesamtabdeckung darunter liegt.

**Python 3.9-Kompatibilität:** Alle Backend-Dateien mit `X | None`-Typen brauchen `from __future__ import annotations` als erste Import-Zeile.

Konfiguration in `pyproject.toml` (Projekt-Root):

```toml
[tool.pytest.ini_options]
testpaths   = ["backend/tests"]
pythonpath  = ["backend"]
```

### Frontend Unit-Tests (Vitest)

```bash
cd nagvis-kurz-vor-2/nagvis2
npm test:unit
npm test:unit:watch    # watch mode
npm test:unit:cov      # mit Coverage
```

Tests liegen in `frontend/tests/unit/`. Da kein ESM, werden JS-Dateien via `readFileSync` + indirektem `eval()` in jsdom geladen.

### Frontend E2E (Playwright)

```bash
npm test:e2e           # startet Backend automatisch (DEMO_MODE=true)
npm test:e2e:ui        # Playwright UI-Modus
npx playwright install chromium   # Einmalig: Browser-Binary installieren
```

Tests liegen in `frontend/tests/e2e/`.

### CI

GitHub Actions führt bei jedem Push auf `main` und bei PRs automatisch `pytest` aus (`.github/workflows/ci.yml`). Coverage-Schwellwert: 70%.

---

## 12. Code-Konventionen

### Python

- **Formatter/Linter:** `ruff` (konfiguriert in `pyproject.toml`)
- **Python-Version:** 3.11+ (Type Hints: `str | None`, kein `Optional`)
- **Async:** Alle I/O-Operationen müssen `async`/`await` verwenden
- **Logging:** `log = logging.getLogger("nagvis.<modulname>")`, kein `print()`
- **Fehlerbehandlung:** Exceptions fangen, loggen, sinnvollen Fallback zurückgeben — kein blindes `raise`

```bash
# Linting + Formatierung
ruff check backend/
ruff format backend/
```

### JavaScript

- **Kein Framework, kein TypeScript**
- **`'use strict';`** am Anfang jeder Datei
- **Globale Exports immer via `window.xyz = xyz`** am Dateiende
- **`esc(s)`** für alle dynamischen HTML-Strings (XSS-Schutz)
- **Kein `console.log` im Commit** — stattdessen kommentieren oder entfernen
- **Kommentare** nur wo die Logik nicht selbsterklärend ist

### Git

- **Commit-Messages:** `<typ>: <Was wurde geändert>` (feat, fix, docs, refactor, chore)
- **Branches:** Feature-Branches von `main`, PR → `main`
- **Changelog:** `scripts/update_changelog.py` nach jedem bedeutenden Feature/Fix ausführen

---

## 13. Release-Prozess

```bash
# 1. Changelog aktualisieren
python scripts/update_changelog.py

# 2. Testen
cd backend && pytest -v

# 3. Tag setzen (triggert GitHub Action release.yml)
git tag v2.1.0
git push origin v2.1.0

# GitHub Action erledigt automatisch:
# - Tests (Release schlägt fehl wenn rot)
# - mkdocs build
# - build.sh → ZIP + SHA256
# - GitHub Release mit Release-Notes aus changelog.md
```

Der manuelle Release via `workflow_dispatch` ist ebenfalls möglich (Actions → Release → Run workflow).
