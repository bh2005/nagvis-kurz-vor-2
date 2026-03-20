# NagVis 2 – Todo-Liste

## Authentifizierung

- [ ] Login-UI im Frontend (Formular, Token-Handling)
- [ ] Backend-Endpoints mit JWT absichern (`core/auth.py` existiert, aber kein Endpoint ist geschützt)
- [ ] Token-Refresh-Logik
- [ ] Logout-Funktion im Burger-Menü
- [ ] Kiosk-Token-URLs bleiben ohne Auth (kein Login erforderlich)

---

## OSM / Weltkarte

- [x] Neuer Canvas-Modus `osm` (OpenStreetMap via Leaflet.js)
- [x] Leaflet.js ins Frontend integrieren (CDN)
- [x] Koordinatenformat für OSM-Nodes: lat/lng statt x%/y%
- [x] Nodes auf der Karte per Drag & Drop verschieben (Leaflet-Marker)
- [x] Tile-Server konfigurierbar machen (OpenStreetMap, eigener Tile-Server)
- [x] Canvas-Modus-Dialog um `osm`-Option erweitern
- [x] Zoom/Pan-Logik von Leaflet übernehmen (ersetzt eigenes zoom_pan.js für diesen Modus)
- [x] Backend: lat/lng in Map-Objekt-Koordinaten speichern (x=lat, y=lng – kein Umbau nötig)
- [x] Dokumentation: `docs/osm-guide.md` erstellt

---

## Checkmk REST API (Alternative zu Livestatus)

- [x] Checkmk REST API Connector in `checkmk/client.py` implementiert
- [x] Unified Backend Registry in `connectors/registry.py` (Livestatus + Checkmk gemischt)
- [x] Backends werden in `data/backends.json` persistiert (kein Neustart nötig)
- [x] LIVESTATUS_* Umgebungsvariablen werden beim ersten Start auto-importiert (Rückwärtskompatibilität)
- [x] Host- und Service-Status über REST API abrufbar (state ab Checkmk 2.2+)
- [x] Health-Check-Endpoint zeigt alle konfigurierten Backends
- [x] REST-API für Backend-Management: `GET/POST/DELETE /api/backends`, `POST /api/backends/{id}/test`
- [ ] Autocomplete im Eigenschaften-Dialog aus Checkmk-Daten befüllen
- [ ] Dokumentation: Admin-Guide um Checkmk/Multi-Backend-Abschnitt erweitern

---

## Gadget-Konfiguration

- [x] UI für Gadget-Parameter im Eigenschaften-Dialog
  - Radial: min/max, Einheit, Warning/Critical-Schwellen
  - Linear: min/max, Einheit, Orientierung (Horizontal/Vertikal)
  - Sparkline: Datenpunkt-Anzahl konfigurierbar (5–100)
  - Thermometer: min/max, Einheit, Warning/Critical
  - Flow/Weather: Richtung (aus/ein/bidirektional)
  - Raw-Number: Divisor, Anzeigeeinheit, Nachkommastellen
- [x] Gadget-Vorschau im Konfigurationsdialog
- [x] Metrikwerte aus Livestatus/Checkmk in Gadgets einspeisen (Perfdata-Parsing)
- [x] Gadget-Werte im WebSocket-Snapshot mitliefern

---

## UX / Frontend

- [x] Multi-Select: mehrere Nodes gleichzeitig auswählen und verschieben (Shift+Klick oder Lasso)
- [x] Multi-Select: Delete/Backspace zum Löschen aller ausgewählten Nodes
- [x] Multi-Select: Escape hebt Selektion auf (vor anderen Escape-Aktionen)
- [ ] Undo/Redo für Positionsänderungen (Ctrl+Z / Ctrl+Y)
- [ ] Objekt-Reihenfolge ändern (Layer-Management im Edit-Mode)
- [ ] Suche/Filter in der Sidebar (Maps und Hosts durchsuchen)
- [ ] Favoriten: bestimmte Maps als Favoriten markieren
- [ ] Map-Minimap / Übersichtsfenster bei großen Karten
- [ ] Node-Größe per Drag-Handle ändern (statt nur über Dialog)

---

## Backend / API

- [ ] Bulk-Operationen: mehrere Objekte in einem Request anlegen/verschieben/löschen
- [ ] Map-Duplikat-Funktion: bestehende Map klonen
- [ ] Objekt-Kopieren zwischen Maps
- [ ] API-Versionierung (z.B. `/api/v1/`)
- [ ] Rate-Limiting für Action-Endpoints (ACK, Downtime)
- [ ] Audit-Log: wer hat was wann geändert

---

## Monitoring / Betrieb

- [x] Prometheus-Metriken-Endpoint (`/metrics`)
- [x] Strukturiertes Logging (JSON-Format) für Produktionsbetrieb (`LOG_FORMAT=json`)
- [x] Liveness- und Readiness-Probes für Kubernetes (`/health/live`, `/health/ready`)
- [x] Helm-Chart für Kubernetes-Deployment (`helm/nagvis2/`)
- [ ] Docker-Image auf Docker Hub veröffentlichen

---

## Dokumentation

- [x] `docs/osm-guide.md` — Weltkarte-Feature
- [ ] `docs/dev-guide.md` — Entwickler-Handbuch (Architektur, lokales Setup, wie man neue Features baut)
- [ ] README.md aktualisieren (Screenshots, Feature-Übersicht)
- [ ] CHANGELOG.md anlegen

---

## Erledigt ✅

- [x] `api/router.py` vollständig implementiert (Objekte CRUD, Background-Upload, Actions)
- [x] WebSocket-Broadcasts für Objektänderungen (`object_added`, `object_updated`, `object_removed`, `map_reloaded`)
- [x] Script-Pfade in `index.html` korrigiert (`src/` → `js/`)
- [x] Frontend-Pfad in `main.py` korrigiert
- [x] Canvas-Overflow-Option (clamp vs. frei) in Map-Eigenschaften
- [x] Rechtsklick-Kontextmenü auf freier Canvas-Fläche im Edit-Mode
- [x] Position (x%/y%) aus Node-Tooltip entfernt
- [x] Label ein-/ausblenden im Eigenschaften-Dialog
- [x] Toast-Benachrichtigungssystem (ok / warn / error / info)
- [x] Offline-Banner + Node-Dimming bei WS-Verbindungsabbruch
- [x] Dokumentation: `docs/admin-guide.md`
- [x] Dokumentation: `docs/user-guide.md`
- [x] Dokumentation: `docs/kiosk-guide.md` (ersetzt altes kiosk-integration.md)
- [x] Dokumentation: `docs/api-reference.md`
- [x] Altes `docs/kiosk-integration.md` gelöscht
- [x] Checkmk REST API Connector (`checkmk/client.py`)
- [x] Unified Backend Registry (`connectors/registry.py`) – Livestatus + Checkmk mixed
- [x] Backend-Management API (`GET/POST/DELETE /api/backends`, Test-Endpoint)
- [x] `httpx` zu requirements.txt hinzugefügt
- [x] Health-Endpoint: `reachable`-Feld pro Backend (Frontend-Fallback auf Demo-Map)
- [x] Demo-Features Map (`data/maps/demo-features.json`) – immer DEMO_STATUS über WS
- [x] Kiosk-Modus: Zoom/Pan-Fix für SVG-Linien und Weathermap-Linien
- [x] Gadget-Konfigurations-Dialog: Host-Feld als Text-Input mit Datalist-Autocomplete
- [x] Burger-Menü: Hilfe-Links öffnen in neuem Fenster + Swagger-Link
- [x] mkdocs.yml: site_dir auf `frontend/help/` korrigiert
- [x] Dokumentation: user-guide.md, admin-guide.md, kiosk-guide.md, api-reference.md aktualisiert
