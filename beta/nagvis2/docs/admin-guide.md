# NagVis 2 – Administrator-Handbuch

## Voraussetzungen

| Komponente | Mindestversion |
|---|---|
| Python | 3.11 |
| Docker / Docker Compose | 24.x / 2.x |
| Nagios / Checkmk / Icinga | mit Livestatus-Modul |

---

## Installation (ohne Docker)

```bash
# 1. Repository klonen
git clone https://github.com/bh2005/nagvis-kurz-vor-2
cd nagvis-kurz-vor-2/beta/nagvis2

# 2. Python-Umgebung anlegen
cd backend
python3 -m venv venv
source venv/bin/activate
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
└── kiosk_users.json ← Kiosk-User
```

---

## Konfiguration

Alle Einstellungen erfolgen über Umgebungsvariablen (oder `.env`-Datei im `backend/`-Verzeichnis).

### Umgebung

| Variable | Standard | Beschreibung |
|---|---|---|
| `ENVIRONMENT` | `development` | `development` oder `production` |
| `DEBUG` | `true` | API-Docs aktivieren, Auto-Reload |
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

Wenn kein Livestatus gefunden wird, aktiviert sich automatisch der **Demo-Modus** mit statischen Testdaten.

---

## Verzeichnisstruktur

```
nagvis2/
├── docker-compose.yml
├── nginx.conf
├── .env.example
├── docs/                    ← Dokumentation
├── frontend/
│   ├── index.html
│   ├── css/styles.css
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
    │   ├── livestatus.py
    │   └── migrate.py
    ├── api/
    │   └── router.py
    ├── ws/
    │   ├── manager.py
    │   ├── router.py
    │   └── demo_data.py
    └── data/                ← auto-erstellt
        ├── maps/
        ├── backgrounds/
        └── kiosk_users.json
```

---

## Health-Check

```bash
curl http://localhost:8000/api/health
```

Antwort (Beispiel mit Livestatus):
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
  "version": "2.0-beta"
}
```

---

## Demo-Modus

Der Demo-Modus aktiviert sich automatisch wenn:
- `DEMO_MODE=true` gesetzt ist, **oder**
- kein Livestatus-Socket gefunden wird

Im Demo-Modus:
- Statische Beispiel-Hosts werden angezeigt
- Die Demo-Map „NagVis 2 – Feature Demo" wird automatisch geöffnet
- Alle Aktionen (ACK, Downtime etc.) werden simuliert
- Maps und Objekte können normal bearbeitet werden

---

## Produktions-Empfehlungen

- `DEBUG=false` setzen (deaktiviert API-Docs und Auto-Reload)
- `ENVIRONMENT=production` setzen
- nginx als Reverse Proxy verwenden (TLS-Terminierung, Security-Header)
- `CORS_ORIGINS` auf tatsächliche Domains einschränken
- `data/`-Verzeichnis regelmäßig sichern
- `LIVESTATUS_SITE` explizit setzen (schnellerer Start)
