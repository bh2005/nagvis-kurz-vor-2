# NagVis 2 (Beta)

**Moderne, schnelle und wartbare Web-Oberfläche für Nagios / Checkmk / Icinga**

Eine komplette Neuentwicklung von NagVis mit FastAPI-Backend, WebSocket-Livestatus und einem Vanilla-JS-Frontend ohne Framework-Abhängigkeiten.

---

## Features

| Bereich | Details |
|---|---|
| **Echtzeit-Updates** | WebSocket-Livestatus, automatischer Reconnect, Offline-Banner |
| **Edit-Mode** | Drag & Drop, Multi-Select (Lasso + Shift+Klick), Gruppen-Drag, Layer-System |
| **Gadgets** | Radial, Linear (H/V), Sparkline, Thermometer, Flow/Weather, Raw-Number |
| **Perfdata** | Nagios/Checkmk Performance-Daten automatisch in Gadgets eingespeist |
| **Weathermap-Linien** | Statusfarbe, Bandbreiten-Labels, bidirektionale Pfeile |
| **Multi-Backend** | Livestatus TCP/Unix + Checkmk REST API gemischt, Hot-Add ohne Neustart |
| **Kiosk-Modus** | Token-URL, automatische Map-Rotation, Vollbild mit Zoom/Pan |
| **Help-System** | Integriertes MkDocs-Hilfe-System unter `/help/` |
| **Docker** | `docker compose up --build` — fertig |
| **Theme** | Dark / Light, responsiv |

---

## Schnellstart

### Docker (empfohlen)

```bash
cd beta/nagvis2
docker compose up --build -d
```

Öffne im Browser: **http://localhost:8080**

---

### Manuell (ohne Docker)

```bash
# 1. Repository klonen
git clone https://github.com/bh2005/nagvis-kurz-vor-2
cd nagvis-kurz-vor-2/beta/nagvis2

# 2. Python-Umgebung anlegen (WSL2 / Linux / macOS)
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Backend starten
python main.py
# → http://localhost:8000
```

Das Frontend wird direkt von FastAPI unter `http://localhost:8000/` ausgeliefert.

---

## Konfiguration (.env)

Kopiere `.env.example` → `.env` im `backend/`-Verzeichnis und passe an:

```env
# Pflicht für Live-Betrieb
LIVESTATUS_TYPE=tcp          # tcp | unix | auto | disabled
LIVESTATUS_HOST=localhost
LIVESTATUS_PORT=6557

# Optional
DEBUG=false                  # true = Swagger-Docs + Auto-Reload
DEMO_MODE=false              # true = statische Testdaten
WS_POLL_INTERVAL=10          # Sekunden zwischen Livestatus-Abfragen
```

Alternativ Checkmk REST API als Backend konfigurieren: Burger-Menü → **⚙ Backends verwalten**.

---

## Hilfe & API-Dokumentation

| URL | Inhalt |
|---|---|
| `http://localhost:8000/help/` | Integriertes Benutzer- und Admin-Handbuch (MkDocs) |
| `http://localhost:8000/api/docs` | Swagger UI (nur wenn `DEBUG=true`) |
| `http://localhost:8000/api/health` | System-Status + Backend-Erreichbarkeit |

---

## Ordnerstruktur

```
nagvis2/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── core/
│   │   ├── config.py
│   │   ├── storage.py
│   │   ├── perfdata.py       ← Nagios Perfdata-Parser
│   │   ├── livestatus.py
│   │   └── migrate.py
│   ├── checkmk/
│   │   └── client.py         ← Checkmk REST API Client
│   ├── connectors/
│   │   └── registry.py       ← Unified Backend Registry
│   ├── api/
│   │   └── router.py
│   └── ws/
│       ├── manager.py
│       ├── router.py
│       └── demo_data.py
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   ├── help/                 ← MkDocs-Output (mkdocs build)
│   └── js/
│       ├── constants.js
│       ├── state.js
│       ├── gadget-renderer.js
│       ├── zoom_pan.js
│       ├── ws-client.js
│       ├── nodes.js
│       ├── map-core.js
│       ├── ui-core.js
│       ├── kiosk.js
│       └── app.js
├── docs/                     ← MkDocs-Quelldateien
├── data/                     ← Persistente Daten (auto-erstellt)
│   ├── maps/
│   ├── backgrounds/
│   ├── backends.json
│   └── kiosk_users.json
├── mkdocs.yml
├── nginx.conf
├── docker-compose.yml
└── .env.example
```

---

## Hilfe-System bauen (MkDocs)

```bash
cd nagvis-kurz-vor-2/beta/nagvis2
pip install mkdocs-material
mkdocs build           # Ausgabe: frontend/help/
```

Danach ist die Hilfe unter `http://localhost:8000/help/` erreichbar.

---

## Lizenz

Dieses Projekt steht unter der **MIT License** – siehe [LICENSE](LICENSE).

---

**Projektstatus:** Beta (funktioniert stabil, aktive Weiterentwicklung)
**Autor:** bh2005
**Version:** 2.0 Beta (März 2026)
