# NagVis 2 (Beta)

**Moderne, schnelle und wartbare Web-Oberfläche für Nagios / Checkmk / Icinga2 / Zabbix**

Eine komplette Neuentwicklung von NagVis mit FastAPI-Backend, WebSocket-Livestatus und einem Vanilla-JS-Frontend ohne Framework-Abhängigkeiten.

[![CI](https://github.com/bh2005/nagvis-kurz-vor-2/actions/workflows/ci.yml/badge.svg)](https://github.com/bh2005/nagvis-kurz-vor-2/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/bh2005/nagvis-kurz-vor-2?label=Release)](https://github.com/bh2005/nagvis-kurz-vor-2/releases/latest)
[![Changelog](https://img.shields.io/badge/Changelog-ansehen-blue)](beta/nagvis2/changelog.txt)
[![Code of Conduct](https://img.shields.io/badge/Code_of_Conduct-2.1-blue)](CODE_OF_CONDUCT.md)

---

## Features

| Bereich | Details |
|---|---|
| **Echtzeit-Updates** | WebSocket-Livestatus, automatischer Reconnect, Offline-Banner |
| **Edit-Mode** | Drag & Drop, Multi-Select (Lasso + Shift+Klick), Gruppen-Drag, Layer-System |
| **Map-Duplikat** | Map klonen inkl. aller Objekte + Hintergrundbild (`POST /api/v1/maps/{id}/clone`) |
| **Label-Templates** | Nagios-Macros (`$HOSTNAME$`, `$HOSTSTATE$`, …) + Checkmk-Labels (`$LABEL:os$`) als Node-Beschriftung |
| **Gadgets** | Radial, Linear (H/V), Sparkline, Thermometer, Flow/Weather, Raw-Number |
| **Perfdata** | Nagios/Checkmk Performance-Daten automatisch in Gadgets eingespeist |
| **Weathermap-Linien** | Statusfarbe, Bandbreiten-Labels, bidirektionale Pfeile |
| **Multi-Backend** | Livestatus, Checkmk REST API, **Icinga2 REST API**, **Zabbix JSON-RPC** gemischt, Hot-Add ohne Neustart |
| **Authentifizierung** | JWT (7 Tage), Auto-Refresh, Login-Overlay, Rollen (viewer/editor/admin), Benutzer-Management |
| **User-Chip** | Klickbarer Topbar-Button: Theme, Einstellungen, Passwort, Benutzerverwaltung, Logout |
| **Kiosk-Modus** | Token-URL, automatische Map-Rotation, Vollbild mit Zoom/Pan |
| **API-Versionierung** | Alle Endpunkte unter `/api/v1/`; 308-Redirect für Rückwärtskompatibilität |
| **Help-System** | Integriertes MkDocs-Hilfe-System unter `/help/` |
| **Docker** | `docker compose up --build` — fertig |
| **Install-Script** | `install.sh` — vollautomatische Linux-Installation mit Systemd-Service |
| **Theme** | Dark / Light, Standard: Dark + Sidebar ausgeklappt |

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
cd beta/nagvis2
docker compose up --build -d
# → http://localhost:8008
```

### Manuell (Entwicklung)

```bash
git clone https://github.com/bh2005/nagvis-kurz-vor-2
cd nagvis-kurz-vor-2/beta/nagvis2/backend
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

Alle Variablen: [`.env.example`](beta/nagvis2/.env.example) · Vollständige Doku: [`docs/admin-guide.md`](beta/nagvis2/docs/admin-guide.md)

Backends über die UI konfigurieren: Burger-Menü → **⚙ Backends verwalten**.

---

## Hilfe & Dokumentation

| Ressource | Inhalt |
|---|---|
| `http://localhost:8008/help/` | Integriertes Benutzer- und Admin-Handbuch (MkDocs) |
| `http://localhost:8008/api/v1/docs` | Swagger UI (immer verfügbar) |
| `http://localhost:8008/api/v1/health` | System-Status + Backend-Erreichbarkeit |
| [Releases](https://github.com/bh2005/nagvis-kurz-vor-2/releases) | ZIP-Download + Release Notes |
| [changelog.txt](beta/nagvis2/changelog.txt) | Vollständiger Änderungsverlauf |
| [admin-guide.md](beta/nagvis2/docs/admin-guide.md) | Installation, Konfiguration, Auth |

---

## Ordnerstruktur

```
nagvis2/
├── install.sh                ← Linux-Installationsskript (Systemd, venv, Berechtigungen)
├── build.sh                  ← ZIP-Build-Skript für Releases
├── .env.example              ← Alle Konfigurationsvariablen mit Kommentaren
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
│   ├── checkmk/client.py     ← Checkmk REST API Client
│   ├── icinga2/client.py     ← Icinga2 REST API v1 Client
│   ├── zabbix/client.py      ← Zabbix JSON-RPC Client
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
│   ├── help/                 ← MkDocs-Output (mkdocs build)
│   └── js/
│       ├── auth.js           ← Login-Overlay, JWT, User-Chip-Dropdown
│       ├── map-core.js       ← Maps, Backends, Clone
│       ├── nodes.js
│       ├── ui-core.js
│       ├── ws-client.js
│       ├── kiosk.js
│       └── app.js
├── docs/                     ← MkDocs-Quelldateien (admin-guide, user-guide, …)
├── scripts/
│   └── update_changelog.py  ← Changelog-Generator (TXT + MD)
└── data/                     ← Persistente Daten (auto-erstellt)
    ├── maps/
    ├── backgrounds/
    ├── users.json            ← Benutzerdaten (bcrypt-Hashes)
    ├── backends.json
    └── kiosk_users.json
```

---

## Hilfe-System bauen (MkDocs)

```bash
cd nagvis-kurz-vor-2/beta/nagvis2
pip install mkdocs-material
mkdocs build           # Ausgabe: frontend/help/
```

Danach ist die Hilfe unter `http://localhost:8008/help/` erreichbar.

---

## Codebase-Statistik

> Stand: März 2026 · ohne `venv/`, `__pycache__/`, `frontend/help/` (Build-Output)

| Sprache | Dateien | Zeilen | Anteil |
|---|---|---|---|
| **Python** | 40 | 8 078 | 37 % |
| **JavaScript** | 13 | 7 200 | 33 % |
| **Markdown** (Docs) | 17 | 2 478 | 11 % |
| **CSS** | 2 | 1 496 | 7 % |
| **HTML** | 1 | 1 093 | 5 % |
| **JSON** (Config/Data) | 12 | 651 | 3 % |
| **YAML** (Docker/Helm) | 12 | 431 | 2 % |
| **Sonstige** | 4 | 371 | 2 % |
| **Gesamt** | **101** | **21 798** | 100 % |

---

## Lizenz

Dieses Projekt steht unter der **MIT License** – siehe [LICENSE](LICENSE).

---

**Projektstatus:** Beta (funktioniert stabil, aktive Weiterentwicklung)
**Autor:** bh2005
**Version:** 2.0 Beta (März 2026)

---

## Links

| | |
|---|---|
| 🚀 [Aktuelles Release](https://github.com/bh2005/nagvis-kurz-vor-2/releases/latest) | ZIP-Download + SHA256 + Release Notes |
| 📋 [Changelog](beta/nagvis2/changelog.txt) | Vollständiger Änderungsverlauf (UTF-16) |
| 📖 [Changelog (Markdown)](beta/nagvis2/changelog.md) | Changelog als Markdown |
| 📚 [Admin-Handbuch](beta/nagvis2/docs/admin-guide.md) | Installation, Konfiguration, Auth, Betrieb |
| ✨ [Feature-Übersicht](FEATURES.md) | Was ist gebaut, was ist geplant |
