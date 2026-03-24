# NagVis 2 (Beta)

**Moderne, schnelle und wartbare Web-Oberfläche für Nagios / Checkmk / Icinga**

Eine komplette Neuentwicklung von NagVis mit FastAPI-Backend, WebSocket-Livestatus und einem Vanilla-JS-Frontend ohne Framework-Abhängigkeiten.

---

## Features

| Bereich | Details |
|---|---|
| **Echtzeit-Updates** | WebSocket-Livestatus, automatischer Reconnect, Offline-Banner |
| **Edit-Mode** | Drag & Drop, Multi-Select (Lasso + Shift+Klick), Gruppen-Drag, Layer-System |
| **Gadgets** | Radial, Linear (H/V), Sparkline, Thermometer, Flow/Weather, Raw-Number, **Graph/iframe** |
| **Graph-Gadget** | Grafana-Panels, Checkmk-Graphen oder beliebige URLs per `<iframe>` oder `<img>` einbetten |
| **Perfdata** | Nagios/Checkmk Performance-Daten automatisch in Gadgets eingespeist |
| **Weathermap-Linien** | Statusfarbe, Bandbreiten-Labels, bidirektionale Pfeile |
| **Multi-Backend** | Livestatus, Checkmk REST API, Zabbix, Icinga2, **Prometheus / VictoriaMetrics** — gemischt, Hot-Add |
| **draw.io Import** | `.drawio`/`.xml`-Diagramme direkt als Map importieren (Shapes → Textboxen/Hosts, Connectors → Linien) |
| **Kiosk-Modus** | Token-URL, automatische Map-Rotation, Vollbild mit Zoom/Pan |
| **Help-System** | Integriertes MkDocs-Hilfe-System unter `/help/` |
| **Docker** | `docker compose up --build` — fertig |
| **Theme** | Dark / Light, responsiv |

---

## Schnellstart

### Docker (empfohlen)

```bash
cd nagvis2
docker compose up --build -d
```

Öffne im Browser: **http://localhost:8080**

---

### Manuell (ohne Docker)

```bash
# 1. Repository klonen
git clone https://github.com/bh2005/nagvis-kurz-vor-2
cd nagvis-kurz-vor-2/nagvis2

# 2. Python-Umgebung anlegen (WSL2 / Linux / macOS)
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Backend starten
python main.py
# → http://localhost:8008
```

Das Frontend wird direkt von FastAPI unter `http://localhost:8008/` ausgeliefert.

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

Alternativ Checkmk REST API, Zabbix, Icinga2 oder Prometheus als Backend konfigurieren: Burger-Menü → **⚙ Backends verwalten**.

---

## Hilfe & API-Dokumentation

| URL | Inhalt |
|---|---|
| `http://localhost:8008/help/` | Integriertes Benutzer- und Admin-Handbuch (MkDocs) |
| `http://localhost:8008/api/v1/docs` | Swagger UI (immer verfügbar) |
| `http://localhost:8008/api/v1/health` | System-Status + Backend-Erreichbarkeit |

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
│   ├── checkmk/client.py     ← Checkmk REST API Client
│   ├── icinga2/client.py     ← Icinga2 REST API Client
│   ├── zabbix/client.py      ← Zabbix JSON-RPC Client
│   ├── prometheus/client.py  ← Prometheus / VictoriaMetrics Client
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
cd nagvis-kurz-vor-2/nagvis2
pip install mkdocs-material
mkdocs build           # Ausgabe: frontend/help/
```

Danach ist die Hilfe unter `http://localhost:8008/help/` erreichbar.

---

## Codebase-Statistik

> Stand: März 2026 · ohne `venv/`, `__pycache__/`, `frontend/help/` (Build-Output)

| Sprache | Dateien | Zeilen | Anteil |
|---|---|---|---|
| **Python** | 44 | 8 900 | 37 % |
| **JavaScript** | 13 | 7 600 | 32 % |
| **Markdown** (Docs) | 18 | 2 700 | 11 % |
| **CSS** | 2 | 1 500 | 6 % |
| **HTML** | 1 | 1 150 | 5 % |
| **JSON** (Config/Data) | 12 | 680 | 3 % |
| **YAML** (Docker/Helm) | 12 | 431 | 2 % |
| **Sonstige** | 4 | 371 | 2 % |
| **Gesamt** | **106** | **23 332** | 100 % |

---

## Lizenz

Dieses Projekt steht unter der **MIT License** – siehe [LICENSE](LICENSE).

---

**Projektstatus:** Beta (funktioniert stabil, aktive Weiterentwicklung)
**Autor:** bh2005
**Version:** 2.1 Beta (März 2026)

---

## Neu in 2.1

- **Prometheus / VictoriaMetrics Connector** — Targets als Hosts, Alerts als Services
- **Graph-Gadget** — Grafana-Panels / Checkmk-Graphen per `<iframe>` oder `<img>` einbetten mit Auto-Refresh
- **draw.io Import** — `.drawio`/`.xml`-Diagramme direkt als NagVis-Map importieren
- **Test-Coverage ≥ 70 %** — CI schlägt fehl bei Unterschreitung
