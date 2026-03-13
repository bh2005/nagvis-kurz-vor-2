# NagVis 2

Modernes Rewrite von [NagVis](https://www.nagvis.org/) mit einem Vanilla-JS-SPA-Frontend und einer Python/FastAPI-Middleware. Das bestehende PHP/Livestatus-Backend bleibt unangetastet.

---

## Architektur

```
Browser (Vanilla JS + CSS Custom Properties)
  ├── WebSocket  →  Live-Status-Updates (Diffs, Heartbeat, Downtime-Events)
  └── Fetch API  →  Map-CRUD, Objekte, Background-Upload, Migration

Middleware: Python 3.12 · FastAPI · asyncio · Livestatus-Bridge
  ├── backend/core/
  │   ├── auth.py           JWT-Auth, Rollen, Token-Verwaltung
  │   ├── cfg_migration.py  NagVis-1-.cfg → NagVis-2-JSON
  │   ├── map_store.py      Map-CRUD (JSON-Dateien)
  │   ├── poller.py         Async Livestatus-Poller mit Diff-Erkennung
  │   └── ws_manager.py     WebSocket Fan-out, Snapshot, Reconnect
  └── backend/livestatus/
      └── client.py         LivestatusClient + BackendRegistry (Multi-Site)

Backend (unangetastet): PHP + Livestatus (CMK / Nagios / Icinga)
```

---

## Features

- **Live-Status** per WebSocket – nur geänderte Objekte werden übertragen
- **8 Objekttypen**: `host`, `service`, `hostgroup`, `servicegroup`, `map`, `textbox`, `line`, `container`
- **Multi-Backend**: mehrere Checkmk-Sites parallel abfragen (Unix-Socket + TCP)
- **Diff-Poller**: erkennt `state_change`, `ack_change`, `downtime_change`, `output_change`
- **Downtime-Transitions**: Browser zeigt Downtime-Banner bei `downtime_started` / `downtime_ended`
- **Force-Refresh**: Browser kann sofortigen Poll auslösen (`{ cmd: "force_refresh" }`)
- **JWT-Auth**: Rollen `viewer` / `editor` / `admin`, Token-Revocation, WebSocket-Auth via Query-Parameter
- **NagVis-1-Migration**: `.cfg`-Dateien per Upload migrieren, inkl. Dry-Run-Vorschau
- **Checkmk 2.4 Design**: Light/Dark-Theme via CSS Custom Properties

---

## Voraussetzungen

- Python 3.12+
- Checkmk / Nagios / Icinga mit erreichbarem Livestatus-Socket
- Moderner Browser (ES2020+)

---

## Installation

```bash
git clone https://github.com/your-org/nagvis2.git
cd nagvis2

pip install -r requirements.txt
```

### Frontend einrichten

Das Frontend-Prototype liegt unter `nagvis2-prototype/`. Vor dem Start in das Serve-Verzeichnis kopieren:

```bash
cp -r nagvis2-prototype/* frontend/
```

---

## Konfiguration

### Livestatus-Backends (`main.py`)

```python
BACKENDS: list[LivestatusConfig] = [
    LivestatusConfig(
        backend_id  = "default",
        socket_path = "/omd/sites/cmk/tmp/run/live",  # OMD-Standard
        timeout     = 8.0,
    ),
    # Zweite CMK-Site per TCP:
    # LivestatusConfig(
    #     backend_id = "site-berlin",
    #     use_tcp    = True,
    #     host       = "mon-berlin.example.com",
    #     port       = 6557,
    # ),
]
```

### Demo-Modus

Für lokale Entwicklung ohne echtes Livestatus:

```python
DEMO_MODE = True   # main.py, Zeile ~84
```

### Umgebungsvariablen

| Variable         | Beschreibung                              | Pflicht |
|------------------|-------------------------------------------|---------|
| `NAGVIS_SECRET`  | Secret Key für JWT-Signierung             | **Ja**  |

```bash
export NAGVIS_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
```

> **Achtung:** Ohne `NAGVIS_SECRET` wird ein unsicherer Dev-Key verwendet. Niemals in Produktion einsetzen.

---

## Start

```bash
export NAGVIS_SECRET="dein-geheimer-schluessel"

uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

Aufruf im Browser: `http://localhost:8080`

API-Dokumentation: `http://localhost:8080/docs`

---

## Erstes Admin-Token erzeugen

```bash
python3 -c "
from backend.core.auth import AuthManager
am = AuthManager()
print(am.create_token('admin', 'admin'))
"
```

Danach weitere Tokens über die API:

```bash
curl -X POST http://localhost:8080/api/auth/tokens \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "role": "editor"}'
```

---

## API-Übersicht

### WebSocket

| Endpunkt              | Beschreibung                          | Auth       |
|-----------------------|---------------------------------------|------------|
| `WS /ws/map/{id}`     | Live-Updates für eine Map             | `?token=`  |
| `WS /ws/global`       | Alle Events (Admin/Debug)             | `?token=` (admin) |

**Browser → Server Kommandos:**
```json
{ "cmd": "force_refresh" }
{ "cmd": "ping" }
```

### Maps

| Methode  | Pfad                              | Rolle    |
|----------|-----------------------------------|----------|
| `GET`    | `/api/maps`                       | viewer   |
| `POST`   | `/api/maps`                       | editor   |
| `GET`    | `/api/maps/{id}`                  | viewer   |
| `DELETE` | `/api/maps/{id}`                  | admin    |
| `PUT`    | `/api/maps/{id}/title`            | editor   |
| `POST`   | `/api/maps/{id}/background`       | editor   |

### Objekte

| Methode   | Pfad                                          | Rolle  |
|-----------|-----------------------------------------------|--------|
| `POST`    | `/api/maps/{id}/objects`                      | editor |
| `PATCH`   | `/api/maps/{id}/objects/{oid}/pos`            | editor |
| `PATCH`   | `/api/maps/{id}/objects/{oid}/size`           | editor |
| `PATCH`   | `/api/maps/{id}/objects/{oid}/props`          | editor |
| `DELETE`  | `/api/maps/{id}/objects/{oid}`                | editor |

### Auth

| Methode   | Pfad                        | Rolle  |
|-----------|-----------------------------|--------|
| `POST`    | `/api/auth/tokens`          | admin  |
| `GET`     | `/api/auth/tokens`          | admin  |
| `DELETE`  | `/api/auth/tokens/{jti}`    | admin  |
| `GET`     | `/api/auth/me`              | viewer |

### System

| Methode | Pfad               | Beschreibung                          | Auth   |
|---------|--------------------|---------------------------------------|--------|
| `GET`   | `/api/health`      | Health + Poller-Stats                 | offen  |
| `GET`   | `/api/backends`    | Alle Backends mit Live-Reachability   | admin  |
| `GET`   | `/api/status/hosts`         | Host-Status-Snapshot       | viewer |
| `GET`   | `/api/status/hosts/{name}`  | Einzelner Host             | viewer |

### Migration

| Methode | Pfad           | Beschreibung                        | Rolle  |
|---------|----------------|-------------------------------------|--------|
| `POST`  | `/api/migrate` | NagVis-1-.cfg nach NagVis-2 migrieren | admin |

```bash
# Dry-Run (Vorschau ohne Speichern)
curl -X POST "http://localhost:8080/api/migrate?dry_run=true&canvas_w=1200&canvas_h=800" \
  -H "Authorization: Bearer <admin-token>" \
  -F "file=@my-map.cfg"

# Produktiv-Import
curl -X POST "http://localhost:8080/api/migrate?canvas_w=1200&canvas_h=800" \
  -H "Authorization: Bearer <admin-token>" \
  -F "file=@my-map.cfg"
```

---

## Rollen

| Rolle    | Rechte                                                      |
|----------|-------------------------------------------------------------|
| `viewer` | Maps und Host-Status lesen, WebSocket verbinden             |
| `editor` | + Objekte anlegen/verschieben/löschen, Hintergrund hochladen, Maps erstellen/umbenennen |
| `admin`  | + Maps löschen, Backends verwalten, Tokens verwalten, Migration |

---

## NagVis-1-Migration

1. Im Browser die Übersicht öffnen → **„NagVis 1 importieren"**
2. `.cfg`-Datei wählen oder per Drag & Drop ablegen
3. Canvas-Größe des Hintergrundbilds angeben (Standard: 1200×800 px)
4. Optional: **Dry Run** aktivieren für eine Vorschau ohne Speichern
5. **Importieren** klicken

**Unterstützte Objekttypen:** `host`, `service`, `hostgroup`, `servicegroup`, `map`, `textbox`, `line`, `container`

**Koordinaten:** NagVis-1 speichert absolute Pixel-Koordinaten. Diese werden auf Basis der angegebenen Canvas-Größe in %-Koordinaten umgerechnet.

**Hintergrundbild:** Der Pfad aus dem `global`-Block wird in der Antwort zurückgemeldet. Das Bild muss anschließend manuell über `POST /api/maps/{id}/background` hochgeladen werden.

---

## Tests

```bash
pytest tests/ --asyncio-mode=auto -v
```

| Datei                    | Tests | Abdeckung                                      |
|--------------------------|-------|------------------------------------------------|
| `test_core.py`           | 11    | MapStore CRUD, Poller Diff-Logik               |
| `test_auth.py`           | 22    | JWT, Rollen, Revocation, WebSocket-Auth        |
| `test_ws_manager.py`     | 19    | Connect/Disconnect, Send, Broadcast, Fan-out   |
| `test_migration.py`      | 34    | Parser, alle Objekttypen, Koordinaten, Warnungen |
| **Gesamt**               | **86**|                                                |

---

## Projektstruktur

```
nagvis2/
├── main.py                         # FastAPI-App, alle Endpunkte
├── requirements.txt
├── backend/
│   ├── core/
│   │   ├── auth.py                 # JWT-Auth, Rollen, Token-Store
│   │   ├── cfg_migration.py        # NagVis-1-.cfg Parser + Konverter
│   │   ├── map_store.py            # Map-CRUD (JSON-Dateien)
│   │   ├── poller.py               # Async Livestatus-Poller
│   │   └── ws_manager.py           # WebSocket Fan-out
│   └── livestatus/
│       └── client.py               # LivestatusClient + BackendRegistry
├── frontend/                       # Wird aus nagvis2-prototype/ befüllt
├── data/
│   ├── maps/                       # Map-JSON-Dateien
│   ├── backgrounds/                # Hintergrundbilder
│   └── tokens.json                 # Token-Metadaten + Revocation-Liste
├── tests/
│   ├── test_auth.py
│   ├── test_core.py
│   ├── test_migration.py
│   └── test_ws_manager.py
└── nagvis2-prototype/              # Frontend-Quelldateien
    ├── index.html
    ├── css/styles.css
    └── js/app.js
```

---

## Produktion

### CORS einschränken (`main.py`)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins = ["https://monitoring.example.com"],
    ...
)
```

### DEMO_MODE deaktivieren

```python
DEMO_MODE = False   # main.py
```

### Systemd-Service

```ini
[Unit]
Description=NagVis 2
After=network.target

[Service]
User=nagvis
WorkingDirectory=/opt/nagvis2
Environment=NAGVIS_SECRET=<secret>
ExecStart=/opt/nagvis2/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8080
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now nagvis2
```

---

## Offene Punkte

| Priorität | Thema                                         |
|-----------|-----------------------------------------------|
| Hoch      | Frontend mit Auth verdrahten (Login-Dialog)   |
| Hoch      | `nagvis2-prototype/` → `frontend/` syncen     |
| Mittel    | SQLite statt JSON-Files (MapStore)            |
| Mittel    | Hostgroup/Servicegroup-Aggregation im Frontend|
| Mittel    | Node-Labels konfigurierbar                    |
| Niedrig   | Map-Zoom/Pan                                  |
| Niedrig   | Multi-Map-Dashboard                           |

---

## Lizenz

Dieses Projekt steht unter der [GPL-2.0-Lizenz](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html), analog zu NagVis 1.