# NagVis 2 – Todo-Liste

## Authentifizierung

- [ ] Login-UI im Frontend (Formular, Token-Handling)
- [ ] Backend-Endpoints mit JWT absichern (`core/auth.py` existiert, aber kein Endpoint ist geschützt)
- [ ] Token-Refresh-Logik
- [ ] Logout-Funktion im Burger-Menü
- [ ] Kiosk-Token-URLs bleiben ohne Auth (kein Login erforderlich)

---

## OSM / Weltkarte

- [ ] Neuer Canvas-Modus `osm` (OpenStreetMap via Leaflet.js)
- [ ] Leaflet.js ins Frontend integrieren (CDN oder lokal)
- [ ] Koordinatenformat für OSM-Nodes: lat/lng statt x%/y%
- [ ] Nodes auf der Karte per Drag & Drop verschieben (Leaflet-Marker)
- [ ] Tile-Server konfigurierbar machen (OpenStreetMap, eigener Tile-Server)
- [ ] Canvas-Modus-Dialog um `osm`-Option erweitern
- [ ] Zoom/Pan-Logik von Leaflet übernehmen (ersetzt eigenes zoom_pan.js für diesen Modus)
- [ ] Backend: lat/lng in Map-Objekt-Koordinaten speichern
- [ ] Dokumentation: `docs/osm-guide.md` erstellen

---

## Checkmk REST API (Alternative zu Livestatus)

- [ ] Checkmk REST API Connector in `core/` implementieren
- [ ] Umgebungsvariable `MONITORING_TYPE` (z.B. `livestatus` | `checkmk`)
- [ ] Checkmk-spezifische Config-Vars: `CHECKMK_URL`, `CHECKMK_USER`, `CHECKMK_SECRET`
- [ ] Host- und Service-Status über REST API abrufen
- [ ] Autocomplete im Eigenschaften-Dialog aus Checkmk-Daten befüllen
- [ ] Health-Check-Endpoint um Checkmk-Verbindung erweitern
- [ ] Dokumentation: Admin-Guide um Checkmk-Abschnitt erweitern

---

## Gadget-Konfiguration

- [ ] UI für Gadget-Parameter im Eigenschaften-Dialog
  - Radial (CPU, RAM): min/max, Einheit, Farb-Schwellen
  - Linear (Balken): min/max, Einheit, Orientierung
  - Sparkline (Zeitverlauf): Zeitraum, Datenpunkt-Anzahl
  - Thermometer: min/max, Einheit
  - Flow/Weather: Richtung, Einheit
  - Raw-Number: Einheit, Nachkommastellen
- [ ] Gadget-Vorschau im Konfigurationsdialog
- [ ] Metrikwerte aus Livestatus/Checkmk in Gadgets einspeisen (Perfdata-Parsing)
- [ ] Gadget-Werte im WebSocket-Snapshot mitliefern

---

## UX / Frontend

- [ ] Multi-Select: mehrere Nodes gleichzeitig auswählen und verschieben (Shift+Klick oder Lasso)
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

- [ ] Prometheus-Metriken-Endpoint (`/metrics`)
- [ ] Strukturiertes Logging (JSON-Format) für Produktionsbetrieb
- [ ] Liveness- und Readiness-Probes für Kubernetes
- [ ] Docker-Image auf Docker Hub veröffentlichen
- [ ] Helm-Chart für Kubernetes-Deployment

---

## Dokumentation

- [ ] MKDocs implementieren
- [ ] `docs/osm-guide.md` — Weltkarte-Feature (sobald implementiert)
- [ ] `docs/dev-guide.md` — Entwickler-Handbuch (Architektur, lokales Setup, wie man neue Features baut)
- [ ] README.md aktualisieren (Screenshots, Feature-Übersicht)
- [ ] CHANGELOG.md anlegen

---

## Language Support

- [ ] Sprache der user auswählbar default englisch
- [ ] Implementierung Englisch
- [ ] Implementierung Spanisch
- [ ] Implementierung Französisch

---

## UX
- [ ] Host-Priority - Wenn ein Host DOWN ist, sollten die Services auf der Map idealerweise ausgegraut oder kleiner dargestellt werden
- [ ] 
- [ ] 

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
