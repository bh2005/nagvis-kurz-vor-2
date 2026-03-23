"""
NagVis 2 – Changelog-Updater
==============================
Schreibt changelog.txt (UTF-16) und changelog.md neu.

Aufruf (aus dem Projektverzeichnis):
    python scripts/update_changelog.py

Format changelog.txt:
    [YYYY-MM-DD]   Titel
                   - Detailpunkt
                   Abschnitts-Header:
                   - Detailpunkt

Neue Eintraege am Ende der Variablen TXT_ENTRIES / MD_ENTRIES hinzufuegen.
"""

import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ROOT     = Path(__file__).parent.parent
TXT_PATH = ROOT / 'changelog.txt'
MD_PATH  = ROOT / 'changelog.md'

# ══════════════════════════════════════════════════════════════════════════════
#  PLAIN-TEXT-INHALT  (wird als UTF-16 geschrieben)
# ══════════════════════════════════════════════════════════════════════════════
TXT = """\
NagVis 2 - Changelog
====================

[2026-03-17]   Projekt-Grundstruktur
               - Beta-Verzeichnisstruktur angelegt
               - WebSocket-Grundgeruest (ws/)
               - Docker & API-Vorbereitung
               - README erstellt

[2026-03-18]   Backend-Grundfunktionen
               - nginx.conf (Development, WSL-kompatibel)
               - API-Grundgeruest und Error-Handling
               - Help-System vorbereitet
               - Sprachunterstuetzung als Task erfasst (todo-liste.md)

[2026-03-19]   UX-Aufgaben dokumentiert
               - Host-Anzeige und Sprachunterstuetzung als Tasks erfasst
               - todo-liste.md aktualisiert

[2026-03-20]   Checkmk REST API Connector
               Backend:
               - backend/checkmk/client.py: async HTTP-Client fuer Checkmk REST API v1.0
               - backend/connectors/registry.py: Unified Backend Registry
                 (Livestatus + Checkmk); persistiert in data/backends.json
               - LIVESTATUS_* Env-Vars beim ersten Start auto-importiert
               - REST-API: GET/POST/DELETE /api/backends + Probe-Endpoint
               - httpx>=0.27.0 zu requirements.txt hinzugefuegt
               - ws/manager.py: nutzt Unified Registry statt core.livestatus
               - Service-Diff Bug-Fix: description statt name

[2026-03-20]   Backend-Management-UI
               Frontend:
               - map-core.js: openBackendMgmtDlg() - Dialog zur Verwaltung
               - Backends-Liste mit Typ-Badge, Test- und Entfernen-Button
               - Formular: Checkmk REST API / Livestatus TCP / Unix Socket
               - Test-Button via POST /api/backends/probe
               Backend:
               - connectors/registry.py: probe()-Methode
               - api/router.py: POST /api/backends/probe
               - index.html: Burger-Menue-Eintrag "Backends verwalten"

[2026-03-20]   Gadget-Platzierung & Auto-Edit bei neuer Map
               - Gadget-Typ im "Objekt hinzufuegen"-Dialog ergaenzt
               - Nach Gadget-Platzierung oeffnet Konfigurations-Dialog automatisch
               - Neue Map oeffnet direkt im Edit-Modus
               - serviceCache in state.js eingefuehrt
               - _gcUpdateServices(): Datalist-Autocomplete fuer Service-Feld

[2026-03-20]   Multi-Select fuer Nodes im Edit-Mode
               - Klick selektiert einen Node (blauer Outline-Rahmen)
               - Shift+Klick: Node zur Selektion hinzufuegen / entfernen
               - Lasso: Mousedown auf leerer Canvas-Flaeche zieht Auswahlrechteck
               - Gruppen-Drag: alle selektierten Nodes gemeinsam verschieben
               - Rechtsklick auf Gruppe: Kontext-Menue zum Loeschen
               - Delete/Backspace: alle selektierten Nodes loeschen
               - Escape: Selektion aufheben
               - selectedNodes (window.Set) als globaler State in state.js

[2026-03-20]   Kiosk-Modus: Zoom/Pan-Fix fuer SVG-Linien
               - enterKiosk() / exitKiosk(): #nv2-lines-svg verbleibt in
                 #map-canvas-wrapper (kein explizites DOM-Move mehr)
               - Ursache: DOM-Move unterbrach CSS-Transform-Chain des
                 Zoom-Moduls (NV2_ZOOM arbeitet auf #map-canvas-wrapper)

[2026-03-20]   Gadget-Konfiguration: Host-Feld als Freitext mit Datalist
               - <select> durch <input type="text" list="datalist"> ersetzt
               - Hosts koennen eingetippt werden wenn hostCache noch leer ist
               - Datalist befuellt sich aus hostCache (Live-Daten)

[2026-03-20]   Demo-Features Map & Auto-Fallback
               - data/maps/demo-features.json: Demo-Map mit 14 Objekten
               - ws/router.py: demo-features sendet immer DEMO_STATUS
               - api/router.py: Health-Endpoint mit reachable-Feld pro Backend
               - Frontend detectDemoMode: oeffnet demo-features automatisch
                 wenn kein Backend erreichbar

[2026-03-20]   Burger-Menue: Hilfe-System & Swagger-Link
               - Alle Hilfe-Links oeffnen in neuem Fenster (target=_blank)
               - Swagger-Link (sichtbar nur wenn DEBUG=true)
               - mkdocs.yml: site_dir auf 'frontend/help/' korrigiert

[2026-03-20]   Dokumentation aktualisiert
               - user-guide.md: Multi-Select-Abschnitt + Tastaturkuerzel
               - admin-guide.md: Multi-Backend, Health-Check, Demo-Modus
               - api-reference.md: /api/backends Endpunkte dokumentiert
               - kiosk-guide.md: Zoom & Pan im Kiosk-Modus
               - todo-liste.md: abgeschlossene Eintraege markiert

[2026-03-20]   Gadget-Parameter-UI erweitert
               - Linear: Orientierung konfigurierbar (Horizontal / Vertikal)
               - Sparkline: Datenpunkt-Anzahl konfigurierbar (5-100, Standard 25)
               - Raw-Number: Nachkommastellen-Feld (0-6)
               - Preview-Bug behoben: direction/value_out/value_in fehlten
               - updateGadget: linear zu Full-Rerender-Gruppe hinzugefuegt

[2026-03-20]   Perfdata-Parsing: Gadgets zeigen Live-Metrikwerte
               Backend:
               - NEU: backend/core/perfdata.py - Nagios/Checkmk Perfdata-Parser
                 Unterstuetzt: quoted/unquoted Labels, UOM (%, ms, MB, GB, ...)
               - livestatus/client.py: ServiceStatus.perf_data-Feld ergaenzt
               - checkmk/client.py: perf_data extrahiert
               - ws/demo_data.py: 5 Demo-Services mit Perfdata
               Frontend:
               - state.js: window.perfdataCache = {}
               - nodes.js: applyStatuses() befuellt perfdataCache
               - nodes.js: _applyGadgetPerfdata() verknuepft Gadgets mit Metriken
               - nodes.js: Gadget-Dialog - Feld "Perfdata-Metrik" (perf_label)

[2026-03-20]   OSM / Weltkarte
               - Canvas-Modus 'osm': interaktive OpenStreetMap via Leaflet.js 1.9.4
               - Nodes als Custom-HTML-Marker (x = Breitengrad, y = Laengengrad)
               - Drag & Drop im Edit-Mode mit automatischer Persistierung
               - Tile-Server konfigurierbar (Standard: OpenStreetMap)
               - Canvas-Format-Dialog: OSM-Option mit Tile-URL, Lat/Lng/Zoom
               - Leaflet uebernimmt Zoom/Pan (NV2_ZOOM im OSM-Modus deaktiviert)
               - Status-Updates via WebSocket vollstaendig
               - Kartenposition nach Bewegen in Map-Config gespeichert
               - osm.js: neues Frontend-Modul (window.NV2_OSM)
               - Dokumentation: docs/osm-guide.md

[2026-03-20]   Rechtsklick-Menue auf Map-Karten in der Uebersicht
               - Kontextmenue per Rechtsklick: Oeffnen, Umbenennen,
                 Canvas-Format, Exportieren, Loeschen
               - openCardMenu() wertet data-title und data-canvas aus
               - Menue-Position am Viewport-Rand eingeklemmt

[2026-03-20]   favicon.svg hinzugefuegt
               - NagVis-Hexagon-Logo als SVG (dunkler Hintergrund, Cyan-Akzente)
               - favicon.ico 404 behoben

[2026-03-20]   Prometheus-Monitoring & Kubernetes-Betrieb
               Backend:
               - NEU: core/metrics.py - alle Prometheus-Metriken
                 nagvis2_http_requests_total (Counter, method/path/status)
                 nagvis2_http_request_duration_seconds (Histogram)
                 nagvis2_ws_connections / _per_map (Gauge)
                 nagvis2_backend_reachable (Gauge)
                 nagvis2_backend_poll_duration / _errors (Histogram/Counter)
                 nagvis2_maps_total / nagvis2_objects_total (Gauge)
               - NEU: core/logging_setup.py - strukturiertes Logging
                 LOG_FORMAT=json: python-json-logger (ELK / Loki)
                 LOG_FORMAT=text: menschenlesbares Format (Standard)
                 LOG_LEVEL per Umgebungsvariable
               - main.py: GET /metrics, GET /health/live, GET /health/ready
                 HTTP-Middleware misst alle Requests
               - ws/manager.py: Poll-Dauer und Fehler instrumentiert
               - requirements.txt: prometheus-client>=0.20.0,
                 python-json-logger>=2.0.0
               Helm-Chart:
               - NEU: helm/nagvis2/ - vollstaendiger Helm-Chart
                 Chart.yaml, values.yaml (Ingress, PVC, HPA, ServiceMonitor)
                 Deployment mit Liveness/Readiness-Probes und ConfigMap
                 ServiceMonitor fuer Prometheus Operator (disabled by default)
                 HPA fuer automatisches Skalieren (disabled by default)

[2026-03-20]   Burger-Menue: Log-Viewer & Download
               - "Log anzeigen": Modal-Dialog mit gefilterbarer Log-Tabelle
               - "Log herunterladen": nagvis2.log als Plaintext-Download
               Backend:
               - core/logging_setup.py: In-Memory-Ringpuffer (_RingBufferHandler)
                 speichert letzte 1000 Zeilen (LOG_BUFFER_LINES konfigurierbar)
               - GET /api/logs: Parameter lines (1-2000), level, download
               Frontend:
               - dlg-log: Zeilen-Selector, Level-Dropdown, Freitext-Filter
               - openLogViewer() / loadLog() / downloadLog() in ui-core.js

[2026-03-23]   Bugfix: Merge-Konflikte behoben
               Frontend:
               - index.html: Konflikt im Burger-Menue (Log-Buttons) aufgeloest
                 HEAD-Version (openLogViewer / downloadLog) behalten
               Backend:
               - main.py: Konflikt bei Import-Zeilen (import time / logging)
               - api/router.py: Konflikt beim /api/logs-Endpoint -
                 In-Memory-Version (HEAD) behalten; dateibasierte Variante verworfen

[2026-03-23]   Bugfix: Leaflet JS SRI-Hash korrigiert
               - frontend/index.html: falscher integrity-Hash fuer Leaflet 1.9.4
               - Folge: Browser blockierte Leaflet komplett (ERR_SRI_SIGNATURE_CHECK)
                 window.L war nie gesetzt, NV2_OSM.init() brach sofort ab
               - OSM-Karte ist nun wieder vollstaendig nutzbar

[2026-03-23]   Docker-Container ueberarbeitet
               - backend/Dockerfile: Python 3.12 -> 3.13
                 WORKDIR /app -> /app/backend
                 (BASE_DIR.parent/frontend zeigt korrekt auf /app/frontend)
                 Healthcheck: /health -> /health/live
                 tini als PID-1 fuer sauberes Signal-Handling
                 non-root User (nagvis, UID 1000)
               - docker-compose.yml: Volume /app/data -> /app/backend/data
               - backend/.dockerignore: venv/, __pycache__/, data/ ausgeschlossen

[2026-03-23]   Changelog-Updater als Skript abgelegt
               - scripts/update_changelog.py: schreibt changelog.txt (UTF-16)
                 und changelog.md aus einer einzigen Quelle
               - Aufruf: python scripts/update_changelog.py

[2026-03-23]   Standard-Port auf 8008 geaendert (war 8000)
               - backend/core/config.py: PORT-Default 8000 -> 8008
               - backend/Dockerfile: EXPOSE + uvicorn --port 8008
               - docker-compose.yml: Port-Mapping 8008:8008, CORS_ORIGINS
               - nginx.conf: proxy_pass auf 127.0.0.1:8008
               - package.json: backend:start --port 8008
               - helm/nagvis2/values.yaml + deployment.yaml: port 8008
               - docs/admin-guide.md, api-reference.md, README.md aktualisiert
"""

# ══════════════════════════════════════════════════════════════════════════════
#  MARKDOWN-INHALT
# ══════════════════════════════════════════════════════════════════════════════
MD = """\
# NagVis 2 – Changelog

---

## [2026-03-23]

### Bugfix: Merge-Konflikte behoben
**Frontend**
- `index.html`: Konflikt im Burger-Menü (Log-Buttons) aufgelöst — HEAD-Version (`openLogViewer` / `downloadLog`) behalten

**Backend**
- `main.py`: Konflikt bei Import-Zeilen (`import time` / `logging`)
- `api/router.py`: Konflikt beim `/api/logs`-Endpoint — In-Memory-Version (HEAD) behalten, dateibasierte Variante verworfen

### Bugfix: Leaflet JS SRI-Hash korrigiert
- `frontend/index.html`: falscher `integrity`-Hash für Leaflet 1.9.4
- Folge: Browser blockierte Leaflet (`ERR_SRI_SIGNATURE_CHECK_FAILED`), `window.L` war nie gesetzt, `NV2_OSM.init()` brach sofort ab
- OSM-Karte ist nun wieder vollständig nutzbar

### Docker-Container überarbeitet
- `backend/Dockerfile`: Python 3.12 → 3.13; `WORKDIR /app` → `/app/backend`
  (`BASE_DIR.parent/frontend` zeigt korrekt auf `/app/frontend`);
  Healthcheck `/health` → `/health/live`; `tini` als PID-1; non-root User (nagvis, UID 1000)
- `docker-compose.yml`: Volume `/app/data` → `/app/backend/data`
- `backend/.dockerignore`: `venv/`, `__pycache__/`, `data/` ausgeschlossen

### Changelog-Updater als Skript abgelegt
- `scripts/update_changelog.py` schreibt `changelog.txt` (UTF-16) und `changelog.md` aus einer Quelle
- Aufruf: `python scripts/update_changelog.py`

### Standard-Port auf 8008 geändert (war 8000)
- `backend/core/config.py`: `PORT`-Default `8000` → `8008`
- `backend/Dockerfile`: `EXPOSE` + uvicorn `--port 8008`
- `docker-compose.yml`: Port-Mapping `8008:8008`, `CORS_ORIGINS`
- `nginx.conf`: `proxy_pass` auf `127.0.0.1:8008`
- `package.json`: `backend:start --port 8008`
- `helm/nagvis2/`: `values.yaml` + `deployment.yaml` auf Port 8008
- `docs/admin-guide.md`, `api-reference.md`, `README.md` aktualisiert

---

## [2026-03-20]

### Burger-Menü: Log-Viewer & Download
- „Log anzeigen": Modal-Dialog mit gefilterbarer Log-Tabelle
- „Log herunterladen": `nagvis2.log` als Plaintext-Download

**Backend**
- `core/logging_setup.py`: In-Memory-Ringpuffer (`_RingBufferHandler`) — letzte 1000 Zeilen (`LOG_BUFFER_LINES` konfigurierbar)
- `GET /api/logs`: Parameter `lines` (1–2000), `level`, `download`

**Frontend**
- `dlg-log`: Zeilen-Selector, Level-Dropdown, Freitext-Filter
- `openLogViewer()` / `loadLog()` / `downloadLog()` in `ui-core.js`

### Prometheus-Monitoring & Kubernetes-Betrieb

**Backend**
- NEU: `core/metrics.py` — alle Prometheus-Metriken
  (`nagvis2_http_requests_total`, `nagvis2_http_request_duration_seconds`,
  `nagvis2_ws_connections`, `nagvis2_backend_reachable`, ...)
- NEU: `core/logging_setup.py` — strukturiertes Logging
  (`LOG_FORMAT=json` → python-json-logger; `LOG_FORMAT=text` → Standard)
- `main.py`: `GET /metrics`, `GET /health/live`, `GET /health/ready`, HTTP-Middleware
- `ws/manager.py`: Poll-Dauer und Fehler instrumentiert
- `requirements.txt`: `prometheus-client>=0.20.0`, `python-json-logger>=2.0.0`

**Helm-Chart**
- NEU: `helm/nagvis2/` — vollständiger Helm-Chart
  (Ingress, PVC, HPA, ServiceMonitor konfigurierbar; disabled by default)

### favicon.svg hinzugefügt
- NagVis-Hexagon-Logo als SVG (dunkler Hintergrund, Cyan-Akzente)
- `favicon.ico` 404 behoben

### Rechtsklick-Menü auf Map-Karten
- Kontextmenü per Rechtsklick: Öffnen, Umbenennen, Canvas-Format, Exportieren, Löschen
- Menü-Position am Viewport-Rand eingeklemmt

### OSM / Weltkarte
- Canvas-Modus `osm`: interaktive OpenStreetMap via Leaflet.js 1.9.4
- Nodes als Custom-HTML-Marker (`x` = Breitengrad, `y` = Längengrad)
- Drag & Drop im Edit-Mode mit automatischer API-Persistierung
- Tile-Server konfigurierbar; Kartenposition automatisch gespeichert
- `osm.js`: neues Frontend-Modul (`window.NV2_OSM`)
- Dokumentation: `docs/osm-guide.md`

### Perfdata-Parsing: Gadgets zeigen Live-Metrikwerte
**Backend**
- NEU: `core/perfdata.py` — Nagios/Checkmk Perfdata-Parser
- `livestatus/client.py`: `perf_data`-Feld ergänzt
- `ws/demo_data.py`: 5 Demo-Services mit Perfdata

**Frontend**
- `state.js`: `window.perfdataCache`
- `nodes.js`: `_applyGadgetPerfdata()`, Gadget-Dialog mit `perf_label`-Feld

### Gadget-Parameter-UI erweitert
- Linear: Orientierung konfigurierbar (Horizontal / Vertikal)
- Sparkline: Datenpunkt-Anzahl konfigurierbar (5–100)
- Raw-Number: Nachkommastellen-Feld (0–6)
- Preview-Bug behoben

### Multi-Select für Nodes im Edit-Mode
- Klick / Shift+Klick / Lasso-Selektion
- Gruppen-Drag, Gruppen-Löschen (Rechtsklick / Delete)
- `selectedNodes` (`window.Set`) in `state.js`

### Kiosk-Modus: Zoom/Pan-Fix für SVG-Linien
- `#nv2-lines-svg` verbleibt in `#map-canvas-wrapper` — DOM-Move entfernt

### Demo-Features Map & Auto-Fallback
- `data/maps/demo-features.json`: Demo-Map mit 14 Objekten
- `detectDemoMode`: öffnet demo-features wenn kein Backend erreichbar

### Backend-Management-UI
- `openBackendMgmtDlg()`: Backends verwalten, hinzufügen, testen
- `POST /api/backends/probe`

### Checkmk REST API Connector
- `checkmk/client.py`: async HTTP-Client für Checkmk REST API v1.0
- `connectors/registry.py`: Unified Backend Registry
- `data/backends.json` für Persistenz

---

## [2026-03-19]

- UX-Aufgaben dokumentiert (Host-Anzeige, Sprachunterstützung)
- `todo-liste.md` aktualisiert

---

## [2026-03-18]

- `nginx.conf` (Development, WSL-kompatibel)
- API-Grundgerüst und Error-Handling
- Help-System vorbereitet

---

## [2026-03-17]

- Projekt-Grundstruktur angelegt
- WebSocket-Grundgerüst, Docker-Vorbereitung
- README erstellt
"""


def main():
    # changelog.txt als UTF-16 mit BOM
    TXT_PATH.write_bytes(TXT.encode('utf-16'))
    print(f'changelog.txt geschrieben ({TXT_PATH})')

    # changelog.md als UTF-8
    MD_PATH.write_text(MD, encoding='utf-8')
    print(f'changelog.md  geschrieben ({MD_PATH})')


if __name__ == '__main__':
    main()
