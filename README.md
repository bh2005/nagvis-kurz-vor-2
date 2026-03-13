# NagVis 2

Modernes Rewrite von [NagVis](https://www.nagvis.org/) mit einem Vanilla-JS-SPA-Frontend und einer Python/FastAPI-Middleware. Das bestehende PHP/Livestatus-Backend bleibt unangetastet.

> **Stand:** März 2026 · Frontend: ~2700 Zeilen JS · Backend: ~1200 Zeilen Python · 86 Tests

---

## Architektur

```
Browser (Vanilla JS + CSS Custom Properties – kein Framework, kein Build-Step)
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

### Frontend
- **Live-Status** per WebSocket – nur geänderte Objekte werden übertragen (Diff-only)
- **8 Objekttypen**: `host`, `service`, `hostgroup`, `servicegroup`, `map`, `textbox`, `line`, `container`
- **Iconset-System** – Inline SVG Data-URIs, 10 Geräteshapes, kein Dateisystem-Iconset nötig
- **Edit-Mode** (`Ctrl+E`) – Drag & Drop, Rechtsklick-Kontextmenü, Resize-Slider, Iconset-Dialog
- **Linien** – Drag-Handles an Endpunkten, Winkel-Slider (0–359°), Stil/Farbe/Breite
- **Layer-System** – Ein-/Ausblenden von Objektgruppen, Umbenennen, z-Index-Steuerung
- **Kiosk-Modus** (`F11`) – Vollbild, Auto-Refresh, Exit-Button bei Mausbewegung
- **Snap-In Panels** – Hosts (nach Severity), Events (Live-Stream, letzte 60 Änderungen)
- **Burger-Menü** – Map-Verwaltung, Benutzereinstellungen, System – alles an einem Ort
- **Übersicht** – Karten-Grid mit ⋯-Kontextmenü, Parent-Map-Hierarchie, „Alle Maps verwalten"
- **Light/Dark-Theme** – CSS Custom Properties, Checkmk 2.4 Farbpalette, flash-frei
- **Demo-Modus** – funktioniert ohne Nagios/Checkmk, simuliert Statuswechsel

### Backend
- **Multi-Backend**: mehrere Checkmk-Sites parallel (Unix-Socket + TCP)
- **Diff-Poller**: erkennt `state_change`, `ack_change`, `downtime_change`, `output_change`
- **Downtime-Transitions**: Banner bei `downtime_started` / `downtime_ended`
- **Force-Refresh**: Browser löst sofortigen Poll aus
- **JWT-Auth**: Rollen `viewer` / `editor` / `admin`, Token-Revocation, WebSocket-Auth
- **NagVis-1-Migration**: `.cfg`-Dateien hochladen, Dry-Run-Vorschau, alle 8 Objekttypen

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

Das Frontend liegt unter `nagvis2-prototype/`. Vor dem Start in das Serve-Verzeichnis kopieren:

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

## Benutzeroberfläche

### Topbar
| Element | Funktion |
|---|---|
| Logo | Klick → Übersicht |
| Conn-Dot | WebSocket-Status (grün/gelb/rot) |
| Status-Pills | OK / WARN / CRIT – nur wenn Map offen, CRIT blinkt |
| ↻ | Force-Refresh (`R`) |
| ⛶ | Kiosk-Modus (`F11`) |
| ☰ | Burger-Menü |

### Burger-Menü
```
Aktive Map        [nur wenn Map offen]
  ✏ Bearbeiten   Ctrl+E
  🖼 Hintergrund hochladen
  ✎ Umbenennen
  🗺 Parent-Map setzen
  ⛶ Kiosk-Modus  F11
  🗑 Map löschen

Maps verwalten
  ＋ Neue Map erstellen
  ⊟ Alle Maps verwalten
  ↑ NagVis 1 importieren

Benutzereinstellungen
  ☀/☽ Theme-Toggle
  ⚙  Einstellungen…

System
  ⊙ Health-Status
  ⊞ API Docs
```

### Keyboard-Shortcuts
| Taste | Funktion |
|---|---|
| `B` | Sidebar ein-/ausklappen |
| `Ctrl+E` | Edit-Mode toggle |
| `R` | Force-Refresh (wenn Map offen) |
| `F11` | Kiosk-Modus toggle |
| `Esc` | Kiosk beenden / Dialoge schließen / Edit-Mode beenden |

### Kiosk-Modus
- Vollbild via Fullscreen-API
- Exit-Button erscheint bei Mausbewegung, verschwindet nach 2,5 s
- Status-Ticker unten: Map-Titel + Uhrzeit
- Optionen (über ⚙ Einstellungen): Sidebar/Topbar ausblenden, Auto-Refresh, Intervall 30 s–5 min

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

**Server → Browser Events:**
```
snapshot       {hosts[], services[], ts}
status_update  {hosts[], services[], ts, elapsed}
heartbeat      {ts}
object_added   {map_id, object}
object_removed {map_id, object_id}
backend_error  {message}
```

### Maps

| Methode  | Pfad                              | Rolle    |
|----------|-----------------------------------|----------|
| `GET`    | `/api/maps`                       | viewer   |
| `POST`   | `/api/maps`                       | editor   |
| `GET`    | `/api/maps/{id}`                  | viewer   |
| `DELETE` | `/api/maps/{id}`                  | admin    |
| `PUT`    | `/api/maps/{id}/title`            | editor   |
| `PUT`    | `/api/maps/{id}/parent`           | editor   |
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

| Methode | Pfad                        | Beschreibung                        | Auth   |
|---------|-----------------------------|-------------------------------------|--------|
| `GET`   | `/api/health`               | Health + Poller-Stats               | offen  |
| `GET`   | `/api/backends`             | Alle Backends mit Live-Reachability | admin  |
| `GET`   | `/api/status/hosts`         | Host-Status-Snapshot                | viewer |
| `GET`   | `/api/status/hosts/{name}`  | Einzelner Host                      | viewer |

### Migration

| Methode | Pfad           | Beschreibung                          | Rolle  |
|---------|----------------|---------------------------------------|--------|
| `POST`  | `/api/migrate` | NagVis-1-.cfg nach NagVis-2 migrieren | admin  |

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

| Rolle    | Rechte |
|----------|--------|
| `viewer` | Maps und Host-Status lesen, WebSocket verbinden |
| `editor` | + Objekte anlegen/verschieben/löschen, Hintergrund hochladen, Maps erstellen/umbenennen/parent setzen |
| `admin`  | + Maps löschen, Backends verwalten, Tokens verwalten, Migration |

---

## NagVis-1-Migration

**Im Browser:**
1. Übersicht öffnen → Burger-Menü `☰` → **„NagVis 1 importieren"**
2. `.cfg`-Datei wählen oder per Drag & Drop ablegen
3. Canvas-Größe des Hintergrundbilds angeben (Standard: 1200×800 px)
4. Optional: **Dry Run** aktivieren für eine Vorschau ohne Speichern
5. **Importieren** klicken

**Per API:** siehe [Migration](#migration)

**Unterstützte Objekttypen:** `host`, `service`, `hostgroup`, `servicegroup`, `map`, `textbox`, `line`, `container`

**Koordinaten:** NagVis 1 speichert absolute Pixel-Koordinaten – diese werden anhand der angegebenen Canvas-Größe in %-Koordinaten umgerechnet.

**Hintergrundbild:** Der Pfad aus dem `global`-Block wird in der Antwort zurückgemeldet. Das Bild muss anschließend manuell über `POST /api/maps/{id}/background` hochgeladen werden.

---

## Tests

```bash
pytest tests/ --asyncio-mode=auto -v
```

| Datei                    | Tests | Abdeckung                                         |
|--------------------------|-------|---------------------------------------------------|
| `test_core.py`           | 11    | MapStore CRUD, Poller Diff-Logik                  |
| `test_auth.py`           | 22    | JWT, Rollen, Revocation, WebSocket-Auth           |
| `test_ws_manager.py`     | 19    | Connect/Disconnect, Send, Broadcast, Fan-out      |
| `test_migration.py`      | 34    | Parser, alle Objekttypen, Koordinaten, Warnungen  |
| **Gesamt**               | **86**|                                                   |

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
    ├── index.html                  # ~610 Zeilen – reines Markup
    ├── css/
    │   └── styles.css              # ~1700 Zeilen – Design-Tokens, alle Komponenten
    └── js/
        ├── app.js                  # ~2700 Zeilen – komplette App-Logik
        └── gadget-renderer.js      # Gauge, Sparkline, Weather Line
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

### nginx Reverse Proxy (empfohlen)

```nginx
server {
    listen 443 ssl;
    server_name monitoring.example.com;

    location /nagvis2/ {
        proxy_pass         http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";  # WebSocket
        proxy_set_header   Host $host;
    }
}
```

---

## Offene Punkte

| Priorität | Thema | Status |
|-----------|-------|--------|
| 🔴 Hoch | Frontend mit Auth verdrahten (Login-Dialog, Token im Header) | offen |
| 🔴 Hoch | `nagvis2-prototype/` → `frontend/` syncen | offen |
| 🔴 Hoch | CORS auf konkrete Hostnamen einschränken | offen |
| 🟡 Mittel | Zoom & Pan auf der Map (CSS transform) | geplant |
| 🟡 Mittel | Verbindungslinien mit Status-Farbe zwischen Nodes | geplant |
| 🟡 Mittel | Echte Status-Pills in der Übersicht (OK/WARN/CRIT-Zähler) | geplant |
| 🟡 Mittel | Service-Nodes vollständig (Datalist aus WS-Snapshot) | geplant |
| 🟡 Mittel | SQLite statt JSON-Files (MapStore) | offen |
| 🟡 Mittel | Hostgroup/Servicegroup-Aggregation im Frontend | offen |
| 🟡 Mittel | Node-Labels konfigurierbar (`{name} – {output}`) | offen |
| 🟢 Niedrig | URL-Routing (`#/map/id` → Map direkt öffnen) | offen |
| 🟢 Niedrig | Mobile-Ansicht / Touch-Events | offen |
| 🟢 Niedrig | Browser-Push-Benachrichtigungen bei CRITICAL | offen |
| 🟢 Niedrig | Map-Export/Import als ZIP (inkl. Hintergrundbild) | offen |

---

## Lizenz

Dieses Projekt steht unter der [GPL-2.0-Lizenz](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html), analog zu NagVis 1.
