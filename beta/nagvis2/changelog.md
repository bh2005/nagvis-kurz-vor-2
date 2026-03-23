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

### Map-Miniaturbilder (Thumbnails) in der Übersicht

**Backend**
- `core/config.py`: `THUMBS_DIR = data/thumbnails`
- `core/storage.py`: `list_maps()` liefert `thumbnail`-Feld (URL `/thumbnails/{id}.png` wenn Datei existiert)
- `core/storage.py`: `delete_map()` löscht auch Thumbnail-Datei
- `api/router.py`: `POST /api/maps/{id}/thumbnail` (PNG/JPEG/WebP Upload)
- `api/router.py`: `DELETE /api/maps/{id}/thumbnail`
- `main.py`: `/thumbnails/` als `StaticFiles` gemountet

**Frontend**
- `map-core.js`: `_thumbHtml()` — Thumbnail > Hintergrundbild > OSM-Placeholder > Gitternetz-Placeholder
- `map-core.js`: `_captureThumbnail()` — liest Node-Positionen synchron aus DOM (vor Canvas-Verstecken)
- `map-core.js`: `_buildAndUploadThumb()` — zeichnet 320×180 Canvas (Hintergrundfarbe, Gitternetz,
  Hintergrundbild, Nodes als farbige Punkte mit Glow); lädt PNG hoch
- `map-core.js`: `showOverview()` ruft `_captureThumbnail()` automatisch auf
- `css/styles.css`: `.ov-thumb`, `.ov-thumb-ico`, `.ov-thumb-grid`

### Bugfix: Auth-Bypass (AUTH_ENABLED=false)
- `backend/core/auth.py`: `_ANON_ADMIN`-Singleton — `require_auth` gibt diesen zurück wenn `AUTH_ENABLED=false`
- `frontend/js/auth.js`: `currentUser = { username:'admin', role:'admin' }` wenn Auth deaktiviert → Benutzerverwaltungs-UI erscheint korrekt

### Feature: OSM Cluster-Bubbles ✅
- `frontend/index.html`: Leaflet.markercluster v1.5.3 (CDN, CSS + JS)
- `js/osm.js`: `_clusterGroup = L.markerClusterGroup(...)` — Bubble-Farbe zeigt schlechtesten Status der Kind-Marker; Edit-Mode deaktiviert Clustering für Drag-Support

### Bugfix: Thumbnail-Timing-Problem
- `frontend/js/map-core.js`: nach erfolgreichem Upload wird `.ov-thumb`-DOM direkt aktualisiert (kein Map-Listen-Reload nötig)

### Feature: Audit-Log (N8) ✅
**Backend**
- NEU: `core/audit.py` — append-only JSONL-Log in `data/audit.jsonl`
  - `audit_log(request, action, **details)` — schreibt Eintrag mit Timestamp, User, Action, Details
  - `read_audit(limit, map_id, action, user)` — filterbares Lesen, neueste zuerst
  - `_maybe_rotate` — Rotation ab 10.000 Einträgen (20 % älteste gelöscht)
  - User aus Bearer-Token oder `X-NV2-User`-Header, Fallback `"system"`
- `api/router.py`: alle mutierenden Endpunkte schreiben Audit-Einträge
- `api/auth_router.py`: `user.create`, `user.role_change`, `user.password_change`, `user.delete`
- NEU: `GET /api/audit?limit=&map_id=&action=&user=`

**Frontend**
- `index.html`: „📜 Audit-Log"-Button im Burger-Menü + `<div id="dlg-audit">`
- `js/auth.js`: `nv2AuditOpen()`, `nv2AuditLoad()` mit Filterfeldern
- `js/ws-client.js`: `api()` sendet `X-NV2-User`-Header
- `css/styles.css`: Audit-Tabellen-Stile

### Feature: Test-Coverage (N6) ✅ — Ziel ≥ 70 % erreicht
- `backend/pyproject.toml` (NEU): pytest-Konfiguration (`asyncio_mode = "auto"`)
- `backend/requirements-dev.txt` (NEU): pytest, pytest-asyncio, pytest-cov, anyio
- `backend/tests/conftest.py` (NEU): `data_dirs` + `client` Fixtures mit vollständiger Isolation
- Neue Test-Dateien: `test_ws_manager.py` (25), `test_api_maps.py` (34), `test_auth.py` (17), `test_audit.py` (13), `test_storage.py` (25), `test_perfdata.py` (18)
- **137 Tests, alle grün** — `ws/manager.py` **89 %**, `main.py` **76 %**
- `backend/main.py`: `import logging.handlers` ergänzt (fehlte → 34 Test-Fehler)

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
