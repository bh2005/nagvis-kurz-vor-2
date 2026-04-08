# NagVis 2

**Moderne, schnelle und wartbare Web-Oberfläche für Nagios / Checkmk / Icinga2 / Naemon / Zabbix / SolarWinds**

Eine komplette Neuentwicklung von NagVis mit FastAPI-Backend, WebSocket-Livestatus und einem Vanilla-JS-Frontend ohne Framework-Abhängigkeiten.

[![CI](https://github.com/bh2005/nagvis-kurz-vor-2/actions/workflows/ci.yml/badge.svg)](https://github.com/bh2005/nagvis-kurz-vor-2/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/bh2005/nagvis-kurz-vor-2?label=Release)](https://github.com/bh2005/nagvis-kurz-vor-2/releases/latest)
[![Changelog](https://img.shields.io/badge/Changelog-ansehen-blue)](nagvis2/changelog.txt)
[![Code of Conduct](https://img.shields.io/badge/Code_of_Conduct-2.1-blue)](CODE_OF_CONDUCT.md)
[![Live Demo](https://img.shields.io/badge/Live_Demo-ansehen-brightgreen)](https://nagvis-kurz-vor-2.onrender.com/#/)

> **Live-Demo (Full Stack):** [https://nagvis-kurz-vor-2.onrender.com/#/](https://nagvis-kurz-vor-2.onrender.com/#/)
> ⚠ Gehostet auf Render Free Tier — beim ersten Aufruf kann der Start **30–60 Sekunden** dauern.

---

## Features

| Bereich | Details |
|---|---|
| **Echtzeit-Updates** | WebSocket-Livestatus, automatischer Reconnect, Offline-Banner, Diff-basierte Updates |
| **Edit-Mode** | Drag & Drop, Multi-Select (Lasso + Shift+Klick), Gruppen-Drag, Layer-System |
| **Undo / Redo** | `Ctrl+Z` / `Ctrl+Y`; bis 50 Schritte; Verschieben, Resize, Properties, Löschen, Hinzufügen |
| **Copy / Paste / Duplicate** | `Ctrl+C` / `Ctrl+V` / `Ctrl+D`; Einfügen mit +3 % Versatz; kaskadierendes Mehrfach-Einfügen |
| **Align & Distribute** | Toolbar bei ≥ 2 Nodes: Links / Mitte / Rechts / Oben / Mitte / Unten; Verteilen H/V (≥ 3 Nodes) |
| **Smart Guides** | Automatisches Einrasten an Kanten + Mittelpunkte beim Drag; blaue Hilfslinien |
| **Label-Templates** | Nagios-Macros (`$HOSTNAME$`, `$HOSTSTATE$`, …) + Checkmk-Labels (`$LABEL:os$`) als Node-Beschriftung |
| **Gadgets** | Radial, Linear (H/V), Sparkline, Thermometer, Flow/Weather, Raw-Number, **Graph/iframe** |
| **Graph-Gadget** | Grafana-Panels, Checkmk-Graphen oder beliebige URLs per `<iframe>` / `<img>`; Auto-Refresh |
| **Perfdata** | Nagios/Checkmk Performance-Daten automatisch in Gadgets eingespeist |
| **Weathermap-Linien** | Statusfarbe, Bandbreiten-Labels, bidirektionale Pfeile |
| **Multi-Backend** | Livestatus TCP/Unix, Checkmk REST API, Icinga2 REST API, **Naemon**, Zabbix JSON-RPC, Prometheus/VictoriaMetrics, **SolarWinds Orion** — gemischt, Hot-Add |
| **draw.io Import** | `.drawio`/`.xml`-Diagramme als Map importieren (Shapes → Textboxen/Hosts, Connectors → Linien) |
| **Authentifizierung** | JWT (30 Tage), Auto-Refresh, Login-Overlay, Rollen (viewer/admin), Benutzer-Management |
| **User-Chip** | Klickbarer Topbar-Button: Theme, Einstellungen, Passwort, Benutzerverwaltung, Logout |
| **Kiosk-Modus** | Token-URL, automatische Map-Rotation, Vollbild mit Zoom/Pan, Status-Ticker |
| **OSM / Weltkarte** | Leaflet.js; Nodes auf Lat/Lng positionieren; Cluster-Bubbles; Drag & Drop im Edit-Mode |
| **API-Versionierung** | Alle Endpunkte unter `/api/v1/`; 308-Redirect für Rückwärtskompatibilität |
| **Help-System** | Integriertes MkDocs-Hilfe-System unter `/help/` |
| **Docker** | `docker compose up --build` — fertig |
| **Install-Script** | `install.sh` — vollautomatische Linux-Installation mit Systemd-Service und Upgrade-Option |
| **Theme** | Dark / Light, Standard: Dark + Sidebar ausgeklappt |
| **Mehrsprachigkeit** | DE/EN eingebaut; beliebige Sprachen per JSON-Lang-Pack importierbar; Sprach-Picker in den Einstellungen |
| **WCAG-AA-Kontrast** | Alle sekundären Textelemente erfüllen 4.5:1 auf Panel-Hintergründen |

---

## Schnellstart

### Via Install-Script (empfohlen für Linux-Server)

```bash
# ZIP vom aktuellen Release herunterladen
wget https://github.com/bh2005/nagvis-kurz-vor-2/releases/latest/download/nagvis2.zip

# Installieren (legt Systemd-Service, User, venv an – setzt Berechtigungen)
unzip nagvis2.zip && cd nagvis2
sudo ./install.sh --auth-enabled

# → http://<server>:8008
```

Alle Optionen: `sudo ./install.sh --help`

### Docker

```bash
cd nagvis2
docker compose up --build -d
# → http://localhost:8008
```

### Manuell (Entwicklung)

```bash
git clone https://github.com/bh2005/nagvis-kurz-vor-2
cd nagvis-kurz-vor-2/nagvis2/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py
# → http://localhost:8008
```

Das Frontend wird direkt von FastAPI unter `http://localhost:8008/` ausgeliefert.

---

## Konfiguration (.env)

Kopiere `.env.example` → `.env` im `backend/`-Verzeichnis:

```env
# Backend
LIVESTATUS_TYPE=tcp          # tcp | unix | auto | disabled
LIVESTATUS_HOST=localhost
LIVESTATUS_PORT=6557

# Authentifizierung (optional)
AUTH_ENABLED=false           # true = Login-Overlay + JWT
NAGVIS_SECRET=<random>       # python3 -c "import secrets; print(secrets.token_hex(32))"

# Sonstiges
DEBUG=false
DEMO_MODE=false
WS_POLL_INTERVAL=10
```

Alle Variablen: [`.env.example`](nagvis2/.env.example) · Vollständige Doku: [`docs/admin-guide.md`](nagvis2/docs/admin-guide.md)

Backends über die UI konfigurieren: Burger-Menü → **⚙ Backends verwalten**.

---

## Unterstützte Backends

| Typ | Protokoll | Aktionen |
|---|---|---|
| **Livestatus TCP/Unix** | Nagios/Checkmk/Naemon Socket | ACK, Downtime, Reschedule |
| **Checkmk REST API** | Checkmk v2.0+ REST API v1 | ACK, Downtime, Reschedule |
| **Icinga2 REST API** | Icinga2 2.11+ v1 | ACK, Downtime, Reschedule |
| **Naemon** | Livestatus Unix/TCP oder REST API | ACK, Downtime, Reschedule |
| **Zabbix JSON-RPC** | Zabbix 5.x / 6.0+ | ACK (Maintenance) |
| **Prometheus / VictoriaMetrics** | HTTP API v1 / PromQL | read-only |
| **SolarWinds Orion** | SWIS API Port 17778 | Alert-Suppression, Unmanage, PollNow |
| **Demo** | Statisch | Eingebaute Testdaten |

---

## Hilfe & Dokumentation

| Ressource | Inhalt |
|---|---|
| `http://localhost:8008/help/` | Integriertes Benutzer- und Admin-Handbuch (MkDocs) |
| `http://localhost:8008/api/v1/docs` | Swagger UI (immer verfügbar) |
| `http://localhost:8008/api/v1/health` | System-Status + Backend-Erreichbarkeit |
| [Releases](https://github.com/bh2005/nagvis-kurz-vor-2/releases) | ZIP-Download + Release Notes |
| [changelog.txt](nagvis2/changelog.txt) | Vollständiger Änderungsverlauf |
| [admin-guide.md](nagvis2/docs/admin-guide.md) | Installation, Konfiguration, Auth, Backends |
| [FEATURES.md](FEATURES.md) | Was ist gebaut, was ist geplant |

---

## Ordnerstruktur

```
nagvis2/
├── install.sh                ← Linux-Installationsskript (Systemd, venv, Berechtigungen)
├── build.sh                  ← ZIP-Build-Skript für Releases
├── .env.example
├── docker-compose.yml
├── nginx.conf / nginx.conf.prod
├── mkdocs.yml
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── core/                 ← config, storage, auth, users, audit, perfdata, metrics
│   ├── checkmk/client.py     ← Checkmk REST API Client
│   ├── icinga2/client.py     ← Icinga2 REST API v1 Client
│   ├── naemon/client.py      ← Naemon Livestatus / REST API Client  ← NEU
│   ├── zabbix/client.py      ← Zabbix JSON-RPC Client
│   ├── prometheus/client.py  ← Prometheus / VictoriaMetrics Client
│   ├── solarwinds/client.py  ← SolarWinds Orion SWIS API Client     ← NEU
│   ├── connectors/registry.py← Unified Backend Registry (alle Typen)
│   ├── api/                  ← router.py, auth_router.py
│   └── ws/                   ← manager.py, router.py, demo_data.py
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   ├── lang/                 ← de.json, en.json
│   ├── help/                 ← MkDocs-Output
│   └── js/
│       ├── history.js        ← Undo/Redo + Copy/Paste/Duplicate   ← NEU
│       ├── align.js          ← Align & Distribute + Smart Guides   ← NEU
│       ├── auth.js           ← Login-Overlay, JWT, User-Chip
│       ├── map-core.js       ← Maps, Backends, Clone, draw.io-Import
│       ├── nodes.js          ← Node/Gadget-Dialoge, Drag, Multi-Select
│       ├── gadget-renderer.js← Gadget-Typen inkl. Graph/iframe
│       ├── i18n.js           ← i18n-Engine (t(), setLang(), importLangPack())
│       ├── ui-core.js
│       ├── ws-client.js
│       ├── kiosk.js
│       └── app.js
├── docs/                     ← MkDocs-Quelldateien
├── scripts/
│   └── update_changelog.py
└── data/                     ← Persistente Daten (auto-erstellt)
    ├── maps/
    ├── backgrounds/
    ├── users.json
    ├── backends.json
    └── kiosk_users.json
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

> Stand: April 2026 · ohne `venv/`, `__pycache__/`, `frontend/help/` (Build-Output)

| Sprache | Dateien | Zeilen | Anteil |
|---|---|---|---|
| **Python** | 47 | ~10 200 | 38 % |
| **JavaScript** | 16 | ~9 100 | 34 % |
| **Markdown** (Docs) | 19 | ~3 400 | 13 % |
| **CSS** | 2 | ~1 550 | 6 % |
| **HTML** | 1 | ~1 200 | 4 % |
| **JSON / YAML / Sonstige** | 28 | ~1 450 | 5 % |
| **Gesamt** | **113** | **~26 900** | 100 % |

---

## Aktuelle Highlights (April 2026)

- **Undo/Redo** (`Ctrl+Z` / `Ctrl+Y`) — bis 50 Schritte; Command-Pattern mit vollständigem Before/After-State; unterstützt Verschieben, Resize, Properties, Löschen und Hinzufügen
- **Copy / Paste / Duplicate** (`Ctrl+C` / `Ctrl+V` / `Ctrl+D`) — kaskadierendes Einfügen mit +3 % Versatz
- **Align & Distribute** — 6 Ausrichte- + 2 Verteile-Funktionen; erscheint automatisch bei ≥ 2 selektierten Nodes
- **Smart Guides** — blaue Hilfslinien + Einrasten beim Drag; vergleicht Kanten und Mittelpunkte aller sichtbaren Nodes
- **Naemon Connector** — Livestatus Unix/TCP oder REST API; ACK, Downtime, Reschedule
- **SolarWinds Orion Connector** — SWIS API (Port 17778); SWQL für `Orion.Nodes` + `Orion.APM`; Alert-Suppression, Unmanage, PollNow

---

## Lizenz

Dieses Projekt steht unter der **MIT License** – siehe [LICENSE](LICENSE).

---

**Projektstatus:** Beta (funktioniert stabil, aktive Weiterentwicklung)  
**Autor:** bh2005  
**Version:** 2.3 Beta (April 2026)

---

## Links

| | |
|---|---|
| 🚀 [Aktuelles Release](https://github.com/bh2005/nagvis-kurz-vor-2/releases/latest) | ZIP-Download + SHA256 + Release Notes |
| 📋 [Changelog](nagvis2/changelog.txt) | Vollständiger Änderungsverlauf (UTF-16) |
| 📖 [Changelog (Markdown)](nagvis2/changelog.md) | Changelog als Markdown |
| 📚 [Admin-Handbuch](nagvis2/docs/admin-guide.md) | Installation, Konfiguration, Auth, Betrieb |
| ✨ [Feature-Übersicht](FEATURES.md) | Was ist gebaut, was ist geplant |
| 🎲 [nagvis3d-up-side-down](../nagvis3d-up-side-down/) | 3D-Visualisierung (geplante Integration) |
| 📊 [ui-4-bi](../ui-4-bi/) | Checkmk BI Visual Editor (geplante Integration) |
