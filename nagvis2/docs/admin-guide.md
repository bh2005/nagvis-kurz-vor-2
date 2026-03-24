# NagVis 2 – Administrator-Handbuch

## Voraussetzungen

| Komponente | Mindestversion |
|---|---|
| Python | 3.11 |
| Docker / Docker Compose | 24.x / 2.x |
| Nagios / Checkmk | mit Livestatus-Modul oder Checkmk REST API |
| Zabbix | 6.0+ (empfohlen), 5.x mit Username/Password |
| Icinga2 | 2.11+ mit aktivierter REST API |

---

## Installation via Install-Script (empfohlen)

Das mitgelieferte `install.sh` übernimmt alle Schritte automatisch:
Service-User anlegen, Dateien entpacken, venv erstellen, Berechtigungen setzen, Systemd-Service einrichten.

### Schnellstart

```bash
# ZIP herunterladen/bereitstellen, dann:
sudo ./install.sh
# → installiert nach /opt/nagvis2, startet nagvis2.service
```

### Optionen

```bash
sudo ./install.sh [OPTIONEN]

  --zip FILE           Pfad zur nagvis2.zip       (Standard: nagvis2.zip im CWD)
  --install-dir DIR    Zielverzeichnis             (Standard: /opt/nagvis2)
  --user USER          Service-User/Gruppe         (Standard: nagvis2)
  --port PORT          HTTP-Port                   (Standard: 8008)
  --auth-enabled       AUTH_ENABLED=true in .env
  --no-systemd         Kein Systemd-Service
  --no-start           Service nicht automatisch starten
  --upgrade            Bestehende Installation aktualisieren (Daten bleiben)
  --uninstall          Installation vollständig entfernen
```

### Beispiele

```bash
# Standard-Installation mit Auth und Port 8080
sudo ./install.sh --zip /tmp/nagvis2.zip --port 8080 --auth-enabled

# Upgrade (Daten/Config bleiben erhalten, Code wird aktualisiert)
sudo ./install.sh --upgrade --zip /tmp/nagvis2_v2.1.zip

# Nur Dateien, kein Systemd (z.B. für Docker/OMD-Integration)
sudo ./install.sh --no-systemd --no-start

# Deinstallation
sudo ./install.sh --uninstall
```

### Was das Script macht

| Schritt | Beschreibung |
|---|---|
| Voraussetzungen | Python 3.11+, pip, unzip prüfen |
| User/Group | `nagvis2` System-User + Gruppe anlegen |
| Dateien | ZIP entpacken → Zielverzeichnis |
| venv | Python venv erstellen + `requirements.txt` installieren |
| Datenverzeichnisse | `data/{maps,backgrounds,thumbnails,kiosk,logs}` anlegen |
| `.env` | Aus `.env.example` erstellen, Secret Key auto-generieren |
| Berechtigungen | Code: `root:nagvis2 755/644` · Daten: `nagvis2:nagvis2 750` · `.env`: `600` |
| Systemd | `/etc/systemd/system/nagvis2.service` erstellen + aktivieren |

### Berechtigungskonzept

```
/opt/nagvis2/                  root:nagvis2   755   ← Code nicht schreibbar für Service
/opt/nagvis2/backend/          root:nagvis2   755
/opt/nagvis2/backend/.env      nagvis2:nagvis2 600  ← Secrets nur für Service-User lesbar
/opt/nagvis2/backend/data/     nagvis2:nagvis2 750  ← Service darf schreiben
/opt/nagvis2/backend/venv/     root:nagvis2   755
/opt/nagvis2/frontend/         root:nagvis2   755
```

### Service verwalten

```bash
systemctl status  nagvis2        # Status anzeigen
systemctl restart nagvis2        # Neu starten (nach .env-Änderungen)
systemctl stop    nagvis2        # Stoppen
journalctl -u nagvis2 -f         # Live-Log verfolgen
journalctl -u nagvis2 --since today   # Log von heute
```

---

## Installation (manuell / ohne Script)

```bash
# 1. Repository klonen
git clone https://github.com/bh2005/nagvis-kurz-vor-2
cd nagvis-kurz-vor-2/nagvis2

# 2. Python-Umgebung anlegen
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Konfiguration
cp .env.example .env
# .env anpassen (siehe Abschnitt Konfiguration)

# 4. Backend starten
python main.py
# → http://localhost:8008
```

Das Frontend wird automatisch unter `http://localhost:8008/` ausgeliefert.
API-Dokumentation (Swagger): `http://localhost:8008/api/v1/docs`

---

## Installation (Docker)

```bash
cd nagvis-kurz-vor-2/nagvis2

# Alle Dienste starten
docker-compose up --build -d

# Logs verfolgen
docker-compose logs -f

# Stoppen
docker-compose down
```

Die `docker-compose.yml` startet:
- **backend** – FastAPI auf Port 8008
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

```bash
cp .env.example .env
# .env anpassen, dann Backend neu starten
```

### Umgebung

| Variable | Standard | Beschreibung |
|---|---|---|
| `ENVIRONMENT` | `development` | `development` oder `production` |
| `DEBUG` | `true` | Auto-Reload aktivieren |
| `DEMO_MODE` | `false` | Statische Testdaten, kein Backend nötig |

### Logging

| Variable | Standard | Beschreibung |
|---|---|---|
| `LOG_FORMAT` | `text` | `text` (menschenlesbar) oder `json` (ELK/Loki) |
| `LOG_LEVEL` | `INFO` | `DEBUG` \| `INFO` \| `WARNING` \| `ERROR` \| `CRITICAL` |
| `LOG_BUFFER_LINES` | `1000` | Anzahl Zeilen im In-Memory-Log-Puffer (0 = deaktiviert) |

### Server

| Variable | Standard | Beschreibung |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind-Adresse |
| `PORT` | `8008` | HTTP-Port |
| `UVICORN_WORKERS` | `1` | Anzahl Worker-Prozesse (nur Production) |
| `CORS_ORIGINS` | `http://localhost:8008,...` | Erlaubte Origins (kommagetrennt) |

### Authentifizierung

| Variable | Standard | Beschreibung |
|---|---|---|
| `AUTH_ENABLED` | `false` | `true`: Login-Overlay + JWT-Prüfung; `false`: offen (kein Login) |
| `NAGVIS_SECRET` | *(leer)* | JWT-Signing-Key – **muss in Produktion gesetzt werden!** |

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

## Monitoring & Observability

### Prometheus-Metriken

NagVis 2 stellt einen Prometheus-kompatiblen Scrape-Endpunkt bereit:

```
GET /metrics
```

| Metrik | Typ | Beschreibung |
|---|---|---|
| `nagvis2_http_requests_total` | Counter | HTTP-Requests nach Method, Path, Status |
| `nagvis2_http_request_duration_seconds` | Histogram | Request-Dauer |
| `nagvis2_ws_connections` | Gauge | Aktive WebSocket-Verbindungen gesamt |
| `nagvis2_ws_connections_per_map` | Gauge | WebSocket-Verbindungen je Map |
| `nagvis2_backend_reachable` | Gauge | 1 = erreichbar, 0 = nicht erreichbar |
| `nagvis2_backend_poll_duration_seconds` | Histogram | Dauer des Status-Poll-Zyklus |
| `nagvis2_backend_poll_errors_total` | Counter | Fehler im Poll-Zyklus |
| `nagvis2_maps_total` | Gauge | Anzahl konfigurierter Maps |
| `nagvis2_objects_total` | Gauge | Anzahl aller Objekte auf allen Maps |

**Prometheus `scrape_config`:**
```yaml
scrape_configs:
  - job_name: nagvis2
    static_configs:
      - targets: ['nagvis2-host:8008']
    metrics_path: /metrics
```

**Helm-Chart mit Prometheus Operator:**
```bash
helm install nagvis2 ./helm/nagvis2 \
  --set serviceMonitor.enabled=true \
  --set serviceMonitor.labels.release=prometheus
```

### Kubernetes Health-Probes

| Endpoint | Typ | Antwort |
|---|---|---|
| `GET /health/live` | Liveness | Immer `200 {"status":"alive"}` |
| `GET /health/ready` | Readiness | `200` wenn Backend erreichbar, `503` sonst |

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8008
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8008
  initialDelaySeconds: 15
  periodSeconds: 20
```

### Strukturiertes Logging (JSON)

Für Produktionsumgebungen mit ELK-Stack oder Loki:

```env
LOG_FORMAT=json
LOG_LEVEL=INFO
```

Beispiel-Ausgabe:
```json
{"ts": "2026-03-20T10:00:00", "level": "INFO", "logger": "nagvis.ws", "message": "Poll-Loop gestartet"}
```

Voraussetzung: `python-json-logger` muss installiert sein (in `requirements.txt` enthalten).

---

### Log-Viewer (Burger-Menü)

Über **Burger-Menü → System → 📋 Log anzeigen** lassen sich die letzten Anwendungs-Logs direkt im Browser einsehen:

- **Zeilen:** 100 bis 2000 letzte Zeilen auswählbar
- **Level-Filter:** Alle / DEBUG / INFO / WARNING / ERROR / CRITICAL
- **Textsuche:** Freitext-Filter (client-seitig, ohne neuen Request)
- **Download:** Log als `nagvis2.log` herunterladen

Der Puffer hält standardmäßig **1000 Zeilen** im RAM (konfigurierbar via `LOG_BUFFER_LINES`).

REST-API direkt:
```bash
# Letzte 200 Zeilen als JSON
GET /api/logs?lines=200

# Nur ERROR-Einträge
GET /api/logs?lines=500&level=ERROR

# Als Datei herunterladen
GET /api/logs?lines=1000&download=true
```

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
    │   ├── migrate.py
    │   ├── metrics.py       ← Prometheus-Metriken (Gauges, Counter, Histogramme)
    │   └── logging_setup.py ← Log-Format (text/json), In-Memory-Ringpuffer
    ├── checkmk/
    │   └── client.py        ← Checkmk REST API Client
    ├── zabbix/
    │   └── client.py        ← Zabbix JSON-RPC API Client
    ├── icinga2/
    │   └── client.py        ← Icinga2 REST API Client
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
| **Zabbix** | URL (z.B. `https://zabbix.example.com`), API-Token (Zabbix 6.0+) oder Username/Password |
| **Icinga2** | URL (z.B. `https://icinga2:5665/v1`), API-User + Passwort |

### Checkmk REST API

**Voraussetzungen:**
- Checkmk 2.0+ (Raw, Free oder Enterprise Edition)
- Automation-User unter *Setup → Users → Automation user* angelegt

**Konfigurationsparameter:**

| Parameter | Beispiel | Beschreibung |
|---|---|---|
| `url` | `http://checkmk:5000/mysite/check_mk/api/1.0` | REST-API-Basis-URL (inkl. Site-Name) |
| `username` | `automation` | Automation-User-Name |
| `secret` | `abc123xyz...` | Automation-Secret (aus Checkmk-UI kopieren) |
| `verify_ssl` | `true` | TLS-Zertifikat prüfen (bei Self-Signed: `false`) |

**Automation-User anlegen (Checkmk UI):**
```
Setup → Users → Add user
→ Automation user aktivieren
→ Secret kopieren und in NagVis 2 eintragen
```

---

### Zabbix

**Voraussetzungen:**
- Zabbix 6.0+ (empfohlen; Zabbix 5.x mit Username/Passwort möglich)
- API-Token unter *User Settings → API tokens* erstellt

**Konfigurationsparameter:**

| Parameter | Beispiel | Beschreibung |
|---|---|---|
| `url` | `https://zabbix.example.com` | Zabbix-Frontend-URL (ohne `/api_jsonrpc.php`) |
| `token` | `abc123...` | API-Token (Zabbix 6.0+, bevorzugt) |
| `username` | `Admin` | Fallback-Login (nur ohne Token, Zabbix 5.x) |
| `password` | `geheim` | Fallback-Passwort |
| `verify_ssl` | `true` | TLS-Zertifikat prüfen |

**API-Token anlegen (Zabbix 6.0+):**
```
User Settings → API tokens → Create API token
→ User-Rolle mit Read-Zugriff auf gewünschte Hosts/Gruppen
```

**Konzept-Mapping Zabbix → NagVis 2:**

| NagVis 2 | Zabbix | Hinweis |
|---|---|---|
| Hosts | `host.get` | `available`: 1=UP, 2=DOWN, 0=UNREACHABLE |
| Services | `problem.get` | Aktive Trigger-Auslösungen |
| Hostgruppen | `hostgroup.get` | |

**Schweregrad-Mapping:**

| Zabbix Severity | NagVis 2 State |
|---|---|
| 0 Not classified, 1 Information, 2 Warning | WARNING |
| 3 Average, 4 High, 5 Disaster | CRITICAL |

---

### Icinga2

**Voraussetzungen:**
- Icinga2 2.11+
- Icinga2 REST API aktiviert (`icinga2 api setup`)
- API-Benutzer in `/etc/icinga2/conf.d/api-users.conf` angelegt

**Konfigurationsparameter:**

| Parameter | Beispiel | Beschreibung |
|---|---|---|
| `base_url` | `https://icinga2.example.com:5665/v1` | REST-API-URL (Port 5665) |
| `username` | `nagvis2` | API-Benutzer-Name |
| `password` | `geheim` | API-Benutzer-Passwort |
| `verify_ssl` | `false` | TLS prüfen (Icinga2 nutzt oft Self-Signed-Certs) |

**API-Benutzer anlegen** (`/etc/icinga2/conf.d/api-users.conf`):

```
object ApiUser "nagvis2" {
  password = "geheimes-passwort"
  permissions = [
    "objects/query/Host",
    "objects/query/Service",
    "objects/query/HostGroup",
    "actions/acknowledge-problem",
    "actions/remove-acknowledgement",
    "actions/schedule-downtime",
    "actions/reschedule-check"
  ]
}
```

Nach der Änderung Icinga2 neu laden:
```bash
systemctl reload icinga2
```

**Konzept-Mapping Icinga2 → NagVis 2:**

| NagVis 2 | Icinga2 Endpoint | Hinweis |
|---|---|---|
| Hosts | `GET /v1/objects/hosts` | state: 0=UP, 1=DOWN, 2=UNREACHABLE |
| Services | `GET /v1/objects/services` | state: 0=OK, 1=WARNING, 2=CRITICAL, 3=UNKNOWN |
| Hostgruppen | `GET /v1/objects/hostgroups` | |

Icinga2 Custom-Vars (`host.vars.*`) werden automatisch als Labels übernommen (nur einfache Datentypen: String, Zahl, Bool).

---

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

## Authentifizierung & Benutzerverwaltung

### Überblick

NagVis 2 unterstützt zwei Betriebsmodi:

| Modus | `AUTH_ENABLED` | Beschreibung |
|---|---|---|
| **Offen** (Standard) | `false` | Kein Login erforderlich. Alle Benutzer haben implizit Admin-Rechte. Schutz über nginx / OMD-Basis-Auth empfohlen. |
| **Auth-Modus** | `true` | Login-Overlay beim ersten Aufruf. Alle API-Endpunkte prüfen JWT-Bearer-Token. Rollen-basierter Zugriff. |

### Auth-Modus aktivieren

1. `.env` anlegen (oder `.env.example` kopieren):

```env
AUTH_ENABLED=true
NAGVIS_SECRET=<langer-zufälliger-schluessel>
```

Secret erzeugen:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

2. Backend neu starten – beim nächsten Aufruf erscheint das Login-Overlay.

3. Ersten Admin-Benutzer anlegen (Swagger UI oder curl):
```bash
# Ersten User via API anlegen (nur solange noch kein Admin existiert)
curl -X POST http://localhost:8008/api/v1/auth/users \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "sicher123", "role": "admin"}'
```

> **Hinweis:** Alternativ direkt `data/users.json` anlegen — Passwörter müssen bcrypt-gehasht sein.

### Rollen

| Rolle | Rechte |
|---|---|
| `viewer` | Maps anzeigen, Monitoring-Daten lesen |
| `editor` | Zusätzlich: Maps und Objekte bearbeiten, Map importieren |
| `admin` | Zusätzlich: Maps anlegen/löschen, Backends verwalten, Benutzer verwalten, Aktionen konfigurieren |

### Benutzerverwaltung im Browser

Burger-Menü → **👤 Benutzer verwalten** (nur sichtbar als Admin):

- Neue Benutzer anlegen (Name, Passwort, Rolle)
- Rolle bestehender Benutzer ändern
- Passwort zurücksetzen
- Benutzer löschen

Eigenes Passwort ändern: Burger-Menü → **🔑 Passwort ändern** (für alle eingeloggten Benutzer).

### Token-Verwaltung

- Tokens sind **7 Tage** gültig
- Das Frontend erneuert den Token automatisch **1 Tag vor Ablauf** (Auto-Refresh)
- Logout widerruft das aktuelle Token serverseitig (`POST /api/v1/auth/logout`)
- Widerrufene Tokens werden in `data/tokens.json` gespeichert

### REST-API Authentifizierung

```bash
# Login → JWT-Token holen
TOKEN=$(curl -s -X POST http://localhost:8008/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"sicher123"}' | jq -r .token)

# Geschützte Endpunkte aufrufen
curl -H "Authorization: Bearer $TOKEN" http://localhost:8008/api/v1/auth/me

# Alle Benutzer auflisten (admin only)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8008/api/v1/auth/users
```

### Benutzerdaten

Benutzer werden in `data/users.json` gespeichert (bcrypt-Hashes, kein Klartext):
```json
[
  {"username": "admin", "password": "$2b$12$...", "role": "admin"},
  {"username": "readonly", "password": "$2b$12$...", "role": "viewer"}
]
```

Die Datei wird beim ersten Start automatisch angelegt. **Backup empfohlen** (zusammen mit `data/backends.json`).

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
curl http://localhost:8008/api/health
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
cd nagvis-kurz-vor-2/nagvis2
pip install mkdocs-material
mkdocs build
# Ausgabe: frontend/help/
```

Erreichbar unter: `http://localhost:8008/help/`

### Direktlinks im Burger-Menü

Alle Hilfe-Links öffnen in einem neuen Fenster/Tab.

| Link | Ziel |
|---|---|
| Canvas | `/help/help/canvas-modes/` |
| Verbindungen | `/help/help/connections/` |
| Dashboard | `/help/help/dashboard/` |
| Migration | `/help/help/migrate/` |
| Swagger UI | `/api/v1/docs` |

---

## API-Dokumentation (Swagger)

Swagger UI ist immer verfügbar unter:

```
http://localhost:8008/api/v1/docs
```

`DEBUG=true` aktiviert zusätzlich den Auto-Reload des Backends.

---

---

## HTTPS / TLS

### Option A: Self-Signed (internes Netz / Entwicklung)

```bash
# Zertifikat erzeugen (SAN mit Hostname + IP, 10 Jahre gültig)
sudo bash scripts/setup-tls.sh

# nginx-Konfiguration aktivieren
sudo cp nginx.conf.prod /etc/nginx/sites-available/nagvis2
sudo ln -s /etc/nginx/sites-available/nagvis2 /etc/nginx/sites-enabled/nagvis2
sudo nginx -t && sudo systemctl reload nginx
```

Browser zeigt Zertifikatswarnung → einmalig akzeptieren (intern akzeptabel).

### Option B: Let's Encrypt / Certbot (öffentlich erreichbarer Server)

```bash
# certbot installieren
sudo apt install certbot python3-certbot-nginx

# nginx-Konfiguration aktivieren (vorher HTTP, certbot ergänzt TLS)
sudo cp nginx.conf.prod /etc/nginx/sites-available/nagvis2
sudo ln -s /etc/nginx/sites-available/nagvis2 /etc/nginx/sites-enabled/nagvis2

# Zertifikat anfordern + nginx automatisch konfigurieren
sudo bash scripts/setup-tls.sh --certbot nagvis.example.com --email admin@example.com
```

Auto-Renewal läuft via systemd-Timer `certbot.timer` (wird von certbot eingerichtet).

### Port 443 in Firewall öffnen

```bash
# UFW
sudo ufw allow 443/tcp

# firewalld (RHEL/CentOS)
sudo firewall-cmd --permanent --add-service=https && sudo firewall-cmd --reload
```

---

## OMD / Checkmk-Integration (P3)

NagVis 2 kann als OMD-Service registriert werden und startet dann automatisch mit der Checkmk-Site.

### Voraussetzungen

- OMD/Checkmk-Site bereits vorhanden (`omd create mysite`)
- NagVis 2 via `install.sh` installiert (Standard: `/opt/nagvis2`)

### Hook installieren

```bash
# Hook in OMD-Site registrieren
sudo bash scripts/install-omd-hook.sh --site mysite

# Optionaler abweichender Install-Pfad
sudo bash scripts/install-omd-hook.sh --site mysite --nagvis2-dir /opt/nagvis2
```

### Verwendung

```bash
omd start  mysite          # startet alle Services inkl. NagVis 2
omd stop   mysite          # stoppt alle Services
omd status mysite          # zeigt Status aller Services

# Nur NagVis 2 steuern
omd start  mysite nagvis2
omd stop   mysite nagvis2
omd status mysite nagvis2
```

### Konfiguration im OMD-Kontext

Der Hook liest `/opt/nagvis2/backend/.env`. Wichtig für OMD-Betrieb:

```env
# Livestatus-Socket der OMD-Site direkt nutzen
LIVESTATUS_TYPE=unix
LIVESTATUS_PATH=/omd/sites/mysite/tmp/run/live
LIVESTATUS_SITE=mysite

# Kein DEMO_MODE, kein DEBUG
DEMO_MODE=false
DEBUG=false
```

### Hook deinstallieren

```bash
sudo bash scripts/install-omd-hook.sh --site mysite --uninstall
```

---

## Produktions-Empfehlungen

- `DEBUG=false` setzen (deaktiviert Auto-Reload)
- `ENVIRONMENT=production` setzen
- `AUTH_ENABLED=true` + starkes `NAGVIS_SECRET` setzen (oder nginx-Basis-Auth als Alternative)
- `NAGVIS_SECRET` mit `python3 -c "import secrets; print(secrets.token_hex(32))"` erzeugen
- nginx als Reverse Proxy verwenden (TLS-Terminierung, Security-Header)
- `CORS_ORIGINS` auf tatsächliche Domains einschränken
- `data/`-Verzeichnis regelmäßig sichern (Maps, Backends, Benutzer, Kiosk)
- `LIVESTATUS_SITE` explizit setzen (schnellerer Start)
- `UVICORN_WORKERS` auf CPU-Kernanzahl setzen (ab 2 Workers)
- `LOG_FORMAT=json` für Log-Aggregation (ELK, Loki, Splunk)
- `/metrics` hinter einem Reverse-Proxy absichern (nicht öffentlich exponieren)
- `LOG_BUFFER_LINES=500` in Produktionsumgebungen (RAM sparen)
