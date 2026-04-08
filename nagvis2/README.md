# NagVis 2 (Beta)

**Moderne, schnelle und wartbare Web-Oberfläche für Nagios / Checkmk / Icinga2 / Naemon / Zabbix / SolarWinds**

Eine komplette Neuentwicklung von NagVis mit FastAPI-Backend, WebSocket-Livestatus und einem Vanilla-JS-Frontend ohne Framework-Abhängigkeiten.

---

## Features

| Bereich | Details |
|---|---|
| **Echtzeit-Updates** | WebSocket-Livestatus, automatischer Reconnect, Offline-Banner |
| **Edit-Mode** | Drag & Drop, Multi-Select, Gruppen-Drag, Layer-System, **Undo/Redo**, **Copy/Paste/Duplicate**, **Align & Distribute**, **Smart Guides** |
| **Map-Duplikat** | Map klonen inkl. aller Objekte + Hintergrundbild |
| **Label-Templates** | Nagios-Macros (`$HOSTNAME$`, `$HOSTSTATE$`) + Checkmk-Labels als Node-Beschriftung |
| **Gadgets** | Radial, Linear (H/V), Sparkline, Thermometer, Flow/Weather, Raw-Number, **Graph/iframe** |
| **Graph-Gadget** | Grafana-Panels, Checkmk-Graphen oder beliebige URLs per `<iframe>` / `<img>` einbetten |
| **Perfdata** | Nagios/Checkmk Performance-Daten automatisch in Gadgets eingespeist |
| **Weathermap-Linien** | Statusfarbe, Bandbreiten-Labels, bidirektionale Pfeile |
| **Multi-Backend** | Livestatus, Checkmk REST API, Icinga2 REST API, **Naemon** (Livestatus/REST), Zabbix JSON-RPC, Prometheus / VictoriaMetrics, **SolarWinds Orion** (SWIS) |
| **draw.io Import** | `.drawio`/`.xml`-Diagramme direkt als Map importieren |
| **Authentifizierung** | JWT (7 Tage), Auto-Refresh, Login-Overlay, Rollen (viewer/editor/admin) |
| **Benutzerverwaltung** | Lokale Benutzer, LDAP/AD, Checkmk-Auth-Kette; Admin-UI im Browser |
| **Audit-Log** | Wer hat was wann geändert (JSONL, Rotation, Download) |
| **Kiosk-Modus** | Token-URL, automatische Map-Rotation, Vollbild mit Zoom/Pan |
| **Help-System** | Integriertes MkDocs-Hilfe-System unter `/help/` |
| **Docker** | `docker compose up --build` — fertig |
| **Theme** | Dark / Light, Standard: Dark |
| **Mehrsprachigkeit** | DE/EN eingebaut; beliebige Sprachen per JSON-Lang-Pack importierbar |
| **WCAG-AA-Kontrast** | Alle sekundären Textelemente erfüllen 4.5:1 auf Panel-Hintergründen |

---

## Schnellstart

### Docker (empfohlen)

```bash
cd nagvis2
docker compose up --build -d
# → http://localhost:8008
```

### Manuell (ohne Docker)

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
# Pflicht für Live-Betrieb
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

Backends über die UI konfigurieren: Burger-Menü → **⚙ Backends verwalten**.

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
├── install.sh                ← Linux-Installationsskript (Systemd, venv, Berechtigungen)
├── build.sh                  ← ZIP-Build-Skript für Releases
├── .env.example
├── docker-compose.yml
├── nginx.conf
├── mkdocs.yml
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── core/
│   │   ├── config.py
│   │   ├── storage.py        ← Maps + clone_map()
│   │   ├── auth.py           ← JWT, require_auth, require_admin
│   │   ├── users.py          ← Benutzerverwaltung (bcrypt, data/users.json)
│   │   ├── audit.py          ← Audit-Log (JSONL, Rotation)
│   │   ├── perfdata.py       ← Nagios Perfdata-Parser
│   │   ├── livestatus.py
│   │   └── metrics.py        ← Prometheus-Metriken
│   ├── checkmk/client.py
│   ├── icinga2/client.py
│   ├── zabbix/client.py
│   ├── prometheus/client.py
│   ├── connectors/registry.py← Unified Backend Registry
│   ├── api/
│   │   ├── router.py         ← Maps, Objekte, Backends, Logs
│   │   └── auth_router.py    ← Login, Refresh, User-CRUD
│   └── ws/
│       ├── manager.py
│       ├── router.py
│       └── demo_data.py
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   ├── lang/
│   │   ├── de.json           ← Deutsches Sprachpaket
│   │   └── en.json           ← Englisches Sprachpaket
│   ├── help/                 ← MkDocs-Output (mkdocs build)
│   └── js/
│       ├── auth.js           ← Login-Overlay, JWT, User-Chip-Dropdown
│       ├── i18n.js           ← i18n-Engine (t(), setLang(), importLangPack())
│       ├── map-core.js       ← Maps, Backends, Clone, draw.io-Import
│       ├── nodes.js          ← Node-Dialog, Gadget-Config-Dialog
│       ├── gadget-renderer.js
│       ├── ui-core.js        ← Sidebar, Theme, Panels, Shortcuts
│       ├── ws-client.js
│       ├── kiosk.js
│       └── app.js
├── docs/                     ← MkDocs-Quelldateien
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

---

## Codebase-Statistik

> Stand: April 2026 · ohne `venv/`, `__pycache__/`, `frontend/help/`

| Sprache | Dateien | Zeilen | Anteil |
|---|---|---|---|
| **Python** | 44 | 8 900 | 37 % |
| **JavaScript** | 14 | 7 700 | 32 % |
| **Markdown** (Docs) | 19 | 2 900 | 12 % |
| **CSS** | 2 | 1 500 | 6 % |
| **HTML** | 1 | 1 190 | 5 % |
| **JSON** (Config/Data) | 12 | 680 | 3 % |
| **YAML** (Docker/Helm) | 12 | 431 | 2 % |
| **Sonstige** | 4 | 371 | 2 % |
| **Gesamt** | **108** | **23 672** | 100 % |

---

## Lizenz

Dieses Projekt steht unter der **MIT License** – siehe [LICENSE](LICENSE).

---

**Projektstatus:** Beta (funktioniert stabil, aktive Weiterentwicklung)
**Autor:** bh2005
**Version:** 2.2 Beta (April 2026)

---

## Neu in 2.2

- **Mehrsprachigkeit (i18n)** — DE/EN eingebaut; beliebige Sprachen per JSON-Lang-Pack importierbar; kein Flash of Untranslated Content dank localStorage-Cache
- **WCAG-AA-Kontrast-Fixes** — 5 sekundäre Textelemente auf Panel-Oberflächen korrigiert (`--text-dim-surf`-Token); alle Kontrastverhältnisse ≥ 4.5:1 auch auf dunklen Panel-Hintergründen

## Neu in 2.1

- **Prometheus / VictoriaMetrics Connector** — Targets als Hosts, Alerts als Services
- **Graph-Gadget** — Grafana-Panels / Checkmk-Graphen per `<iframe>` oder `<img>` einbetten mit Auto-Refresh
- **draw.io Import** — `.drawio`/`.xml`-Diagramme direkt als NagVis-Map importieren
- **Authentifizierung** — JWT, LDAP/AD, Checkmk-Auth-Kette, Rollen-System
