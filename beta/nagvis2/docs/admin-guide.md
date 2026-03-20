# NagVis 2 – Administrator-Handbuch

## Voraussetzungen

| Komponente | Mindestversion |
|---|---|
| Python | 3.11 |
| Docker / Docker Compose | 24.x / 2.x |
| Nagios / Checkmk / Icinga | mit Livestatus-Modul oder Checkmk REST API |

---

## Installation (ohne Docker)

```bash
# 1. Repository klonen
git clone https://github.com/bh2005/nagvis-kurz-vor-2
cd nagvis-kurz-vor-2/beta/nagvis2

# 2. Python-Umgebung anlegen
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Konfiguration (optional – Standardwerte funktionieren für lokale Tests)
cp .env.example .env
# .env anpassen (siehe Abschnitt Konfiguration)

# 4. Backend starten
python main.py
# → http://localhost:8000
```

Das Frontend wird automatisch unter `http://localhost:8000/` ausgeliefert.
API-Dokumentation (nur im Debug-Modus): `http://localhost:8000/api/docs`

---

## Installation (Docker)

```bash
cd nagvis-kurz-vor-2/beta/nagvis2

# Alle Dienste starten
docker-compose up --build -d

# Logs verfolgen
docker-compose logs -f

# Stoppen
docker-compose down
```

Die `docker-compose.yml` startet:
- **backend** – FastAPI auf Port 8000
- **nginx** – Reverse Proxy auf Port 80, leitet WebSocket-Verbindungen weiter

Persistente Daten liegen in `./data/` (wird automatisch angelegt):
```
data/
├── maps/            ← Map-Konfigurationen (*.json)
├── backgrounds/     ← Hintergrundbilder
├── backends.json    ← Backend-Konfigurationen
└── kiosk_users.json ← Kiosk-User
```

---

## Konfiguration

Alle Einstellungen erfolgen über Umgebungsvariablen (oder `.env`-Datei im `backend/`-Verzeichnis).

### Umgebung

| Variable | Standard | Beschreibung |
|---|---|---|
| `ENVIRONMENT` | `development` | `development` oder `production` |
| `DEBUG` | `true` | Swagger-Docs aktivieren, Auto-Reload |
| `DEMO_MODE` | `false` | Statische Testdaten, kein Livestatus |

### Server

| Variable | Standard | Beschreibung |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind-Adresse |
| `PORT` | `8000` | HTTP-Port |
| `UVICORN_WORKERS` | `1` | Anzahl Worker-Prozesse (nur Production) |
| `CORS_ORIGINS` | `http://localhost:8000,...` | Erlaubte Origins (kommagetrennt) |

### Livestatus

| Variable | Standard | Beschreibung |
|---|---|---|
| `LIVESTATUS_TYPE` | `auto` | `auto` \| `tcp` \| `unix` \| `disabled` |
| `LIVESTATUS_HOST` | `localhost` | TCP-Host |
| `LIVESTATUS_PORT` | `6557` | TCP-Port |
| `LIVESTATUS_PATH` | `/var/run/nagios/live` | Unix-Socket-Pfad |
| `LIVESTATUS_SITE` | *(leer)* | OMD-Site-Name (beschleunigt Auto-Detect) |

### WebSocket

| Variable | Standard | Beschreibung |
|---|---|---|
| `WS_POLL_INTERVAL` | `10` | Sekunden zwischen Livestatus-Abfragen |

### Livestatus Auto-Detect (`LIVESTATUS_TYPE=auto`)

NagVis 2 sucht automatisch in dieser Reihenfolge:

1. OMD-Sites: `/omd/sites/<site>/tmp/run/live`
2. Nagios-Standard: `/var/run/nagios/live`, `/var/lib/nagios3/rw/live`
3. TCP: `LIVESTATUS_HOST:LIVESTATUS_PORT`

---

## Verzeichnisstruktur

```
nagvis2/
├── docker-compose.yml
├── nginx.conf
├── mkdocs.yml
├── .env.example
├── docs/                    ← MkDocs-Quelldateien
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   ├── help/                ← MkDocs-Output (mkdocs build)
│   └── js/
│       ├── gadget-renderer.js
│       ├── zoom_pan.js
│       ├── constants.js
│       ├── state.js
│       ├── ui-core.js
│       ├── ws-client.js
│       ├── nodes.js
│       ├── map-core.js
│       ├── kiosk.js
│       └── app.js
└── backend/
    ├── main.py
    ├── requirements.txt
    ├── Dockerfile
    ├── core/
    │   ├── config.py
    │   ├── storage.py
    │   ├── perfdata.py      ← Nagios/Checkmk Perfdata-Parser
    │   ├── livestatus.py
    │   └── migrate.py
    ├── checkmk/
    │   └── client.py        ← Checkmk REST API Client
    ├── connectors/
    │   └── registry.py      ← Unified Backend Registry
    ├── api/
    │   └── router.py
    ├── ws/
    │   ├── manager.py
    │   ├── router.py
    │   └── demo_data.py
    └── data/                ← auto-erstellt
        ├── maps/
        ├── backgrounds/
        ├── backends.json    ← Backend-Konfigurationen
        └── kiosk_users.json
```

---

## Multi-Backend-Unterstützung

NagVis 2 unterstützt mehrere Monitoring-Backends gleichzeitig: **Livestatus (TCP/Unix)** und **Checkmk REST API**.

### Backends verwalten

Burger-Menü → **⚙ Backends verwalten**

| Funktion | Beschreibung |
|---|---|
| Backend hinzufügen | Typ wählen (Checkmk REST API / Livestatus TCP / Unix), URL/Pfad + Credentials eingeben |
| Backend testen | „Test"-Button prüft die Verbindung ohne zu speichern (`POST /api/backends/probe`) |
| Backend entfernen | Backend dauerhaft löschen |

### Unterstützte Backend-Typen

| Typ | Konfiguration |
|---|---|
| **Checkmk REST API** | URL (z.B. `http://checkmk:5000/mysite/check_mk/api/1.0`), Automation-User, Secret |
| **Livestatus TCP** | Host + Port (Standard: 6557) |
| **Livestatus Unix** | Socket-Pfad (z.B. `/omd/sites/mysite/tmp/run/live`) |

### Backend-Persistenz

Konfigurierte Backends werden in `data/backends.json` gespeichert — kein Neustart erforderlich.

Beim ersten Start werden `LIVESTATUS_*`-Umgebungsvariablen automatisch als „default"-Backend importiert (Rückwärtskompatibilität zu bestehenden Deployments).

### REST-API für Backends

```bash
# Alle Backends auflisten (mit Erreichbarkeitsstatus)
GET /api/backends

# Backend hinzufügen
POST /api/backends

# Backend löschen
DELETE /api/backends/{id}

# Verbindung testen (ohne Speichern)
POST /api/backends/probe
```

---

## Perfdata-Verarbeitung

NagVis 2 parst Nagios/Checkmk Performance-Daten automatisch und stellt sie für Gadgets bereit.

### Format

```
'label'=value[UOM];[warn];[crit];[min];[max]
```

Beispiele:
```
load1=0.42;70;90;0;100
mem_used_percent=78.0%;75;90;0;100
rta=1.234ms;3000;5000;0;
'Used Space'=14.2GB;80%;90%;0%;100%
```

### Unterstützte UOM (Units of Measure)

`%`, `s`, `ms`, `us`, `B`, `KB`, `MB`, `GB`, `TB`, `PB`, `c` (Counter)

### Zuordnung zu Gadgets

Im Gadget-Konfigurationsdialog:
1. **Host** und **Service** eintragen
2. **Perfdata-Metrik** aus der Datalist wählen (wird automatisch aus dem WS-Snapshot befüllt)
3. Eigene `Warning`/`Critical`/`Min`/`Max`-Werte überschreiben die Perfdata-Werte

---

## Health-Check

```bash
curl http://localhost:8000/api/health
```

Antwort (Beispiel mit konfigurierten Backends):
```json
{
  "status": "ok",
  "environment": "development",
  "demo_mode": false,
  "livestatus": {
    "connected": true,
    "demo": false,
    "error": null
  },
  "backends": [
    {
      "backend_id": "default",
      "type": "livestatus_tcp",
      "label": "Livestatus (localhost:6557)",
      "reachable": true
    },
    {
      "backend_id": "checkmk-prod",
      "type": "checkmk_rest",
      "label": "Checkmk Production",
      "reachable": false
    }
  ],
  "version": "2.0-beta"
}
```

---

## Demo-Modus

Der vollständige Demo-Modus aktiviert sich wenn `DEMO_MODE=true` gesetzt ist.

Wenn kein Backend konfiguriert ist oder alle Backends nicht erreichbar sind:
- Die Demo-Map **„NagVis 2 – Feature Demo"** wird automatisch geöffnet (Fallback)
- Alle anderen Maps und CRUD-Operationen bleiben verfügbar
- Ein blauer Demo-Banner am unteren Bildschirmrand wird angezeigt
- Demo-Services mit vollständiger Perfdata werden im WebSocket-Snapshot mitgesendet

Im vollständigen Demo-Modus (`DEMO_MODE=true`):
- Alle Aktionen (ACK, Downtime etc.) werden simuliert
- Maps und Objekte können normal bearbeitet werden

---

## Hilfe-System (MkDocs)

Die integrierte Hilfe liegt unter `frontend/help/` und wird von FastAPI statisch ausgeliefert.

### Hilfe neu bauen

```bash
cd nagvis-kurz-vor-2/beta/nagvis2
pip install mkdocs-material
mkdocs build
# Ausgabe: frontend/help/
```

Erreichbar unter: `http://localhost:8000/help/`

### Direktlinks im Burger-Menü

Alle Hilfe-Links öffnen in einem neuen Fenster/Tab.

| Link | Ziel |
|---|---|
| Canvas | `/help/help/canvas-modes/` |
| Verbindungen | `/help/help/connections/` |
| Dashboard | `/help/help/dashboard/` |
| Migration | `/help/help/migrate/` |
| Swagger UI | `/api/docs` (nur `DEBUG=true`) |

---

## API-Dokumentation (Swagger)

Swagger UI ist nur im Debug-Modus aktiv:

```env
DEBUG=true
```

Erreichbar unter: `http://localhost:8000/api/docs`

Für Produktiv-Deployments `DEBUG=false` setzen.

---

## Produktions-Empfehlungen

- `DEBUG=false` setzen (deaktiviert Swagger UI und Auto-Reload)
- `ENVIRONMENT=production` setzen
- nginx als Reverse Proxy verwenden (TLS-Terminierung, Security-Header)
- `CORS_ORIGINS` auf tatsächliche Domains einschränken
- `data/`-Verzeichnis regelmäßig sichern (Maps, Backends, Kiosk-User)
- `LIVESTATUS_SITE` explizit setzen (schnellerer Start)
- `UVICORN_WORKERS` auf CPU-Kernanzahl setzen (ab 2 Workers)
