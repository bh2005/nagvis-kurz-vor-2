# NagVis 2 – Todo-Liste

## UX / Frontend

- [x] Multi-Select: mehrere Nodes gleichzeitig auswählen und verschieben (Shift+Klick oder Lasso)
- [x] Multi-Select: Delete/Backspace zum Löschen aller ausgewählten Nodes
- [x] Multi-Select: Escape hebt Selektion auf
- [x] Map-Miniaturbilder in der Übersicht (OffscreenCanvas, POST/DELETE `/api/maps/{id}/thumbnail`)
- [x] Objekt-Reihenfolge: Layer per Drag & Drop umsortieren (zIndex), Layer löschen
- [x] Browser-Benachrichtigungen bei CRITICAL/DOWN (Web Push API + Hinweiston via Web Audio API, in Benutzereinstellungen an/abschaltbar)
- [ ] Undo/Redo für Positionsänderungen (Ctrl+Z / Ctrl+Y)
- [ ] Suche/Filter in der Sidebar (Maps und Hosts durchsuchen)
- [ ] Favoriten: bestimmte Maps als Favoriten markieren
- [ ] Map-Minimap / Übersichtsfenster bei großen Karten
- [ ] Node-Größe per Drag-Handle ändern (statt nur über Dialog)

---

## Datenquellen & Import

- [ ] **Import von DRAW.io Diagrammen** – `.drawio`/`.xml`-Dateien als Grundlage für Maps importieren; Nodes aus Shape-Bibliothek zu NagVis-Objekten mappen
- [ ] **Visualisierung von BI (Business Intelligence)** – BI-Aggregationen aus Checkmk als eigenen Node-Typ darstellen; Status aus Checkmk BI REST API abrufen

---

## Backend / API

- [x] Bulk-Operationen: mehrere Objekte in einem Request anlegen/verschieben/löschen → PATCH `/api/maps/{id}/objects/bulk`
- [x] Map-Duplikat-Funktion: Map klonen (POST `/api/maps/{id}/clone`)
- [x] Audit-Log: wer hat was wann geändert (`core/audit.py`, `GET /api/audit`, UI-Dialog)
- [ ] Objekt-Kopieren zwischen Maps
- [ ] API-Versionierung (z.B. `/api/v1/`)
- [ ] Rate-Limiting für Action-Endpoints (ACK, Downtime)
- [ ] SQLite statt JSON-Files (SQLAlchemy, Migration per Script)

---

## Multi-Backend

- [x] Checkmk REST API Connector (`checkmk/client.py`)
- [x] Icinga2 REST API Connector (`icinga2/client.py`)
- [x] Zabbix JSON-RPC Connector (`zabbix/client.py`)
- [x] Unified Backend Registry (`connectors/registry.py`)
- [x] Backend-Management-UI (Burger-Menü → Backends verwalten)
- [x] `_backend_id`-Tag in WS-Status-Broadcasts → backend-spezifische Statusauflösung
- [x] Node-Eigenschaft `backend_id`: Datenquelle pro Node explizit wählbar (Host/Service/Gruppe/Gadget)

---

## Authentifizierung

- [x] Login-UI im Frontend (Formular, Token-Handling)
- [x] Backend-Endpoints mit JWT absichern
- [x] Token-Refresh-Logik (Auto-Refresh 1 Tag vor Ablauf)
- [x] Logout-Funktion im Burger-Menü
- [x] Kiosk-Token-URLs bleiben ohne Auth

---

## Monitoring & Betrieb

- [x] Prometheus-Metriken-Endpoint (`/metrics`)
- [x] Strukturiertes Logging (JSON-Format) für Produktionsbetrieb
- [x] Liveness- und Readiness-Probes für Kubernetes
- [x] Helm-Chart für Kubernetes-Deployment
- [x] HTTPS/TLS (`nginx.conf.prod`, `scripts/setup-tls.sh`)
- [x] OMD/Checkmk-Hook (`omd/nagvis2`, `scripts/install-omd-hook.sh`)
- [ ] Docker-Image auf Docker Hub veröffentlichen

---

## Dokumentation

- [x] `docs/admin-guide.md` (inkl. Zabbix, Icinga2, Multi-Backend)
- [x] `docs/user-guide.md`
- [x] `docs/kiosk-guide.md`
- [x] `docs/api-reference.md`
- [x] `docs/osm-guide.md`
- [x] `docs/dev-guide.md` — Entwickler-Handbuch (Architektur, lokales Setup, wie man neue Features baut)

---

## Nice-to-have / Langfristig

- [ ] Mehrsprachigkeit (DE/EN via JSON-Dictionary)
- [ ] Map-Vorlagen (Stern, Hierarchie, Rechenzentrum)
- [ ] Mobile-Ansicht (Touch-Events, Pinch-Zoom, responsive Breakpoints)
- [ ] Historische Daten / Verfügbarkeitsdiagramme (Checkmk REST API)

---

## Feature-Ideen (Backlog)

| # | Feature | Nutzen | Aufwand |
|---|---|---|---|
| F1 | **Checkmk BI & Event Console Widgets** | BI-Aggregate und Event-Console-Filter direkt als Gadget auf der Map anzeigen | Mittel |
| F2 | **Checkmk Topology-Import** | Hosts + Verbindungen automatisch aus Checkmk Topology übernehmen (kein manuelles Platzieren) | Hoch |
| F3 | **Custom Graph Gadget** | Checkmk-Graphen (RRDtool) oder Grafana-Panels direkt in die Map einbetten (`<iframe>` oder PNG-URL) | Niedrig |
| F4 | **Auto-Layout (Graphviz / Force-Directed)** | „Arrange selected hosts"-Button — Nodes automatisch anordnen; Graphviz DOT oder D3 Force-Simulation | Mittel |
| ~~F5~~ | ~~**Prometheus & VictoriaMetrics Connector**~~ ✅ | Metrics-Backends für Hybrid-Umgebungen; PromQL-Ergebnis als Gadget-Wert | Mittel |
| F6 | **Versioned Maps + Git-Integration** | Maps in einem Git-Repository speichern und versionieren; Diff-Ansicht, Rollback | Mittel |
| F7 | **DRAW.io Import** | `.drawio`/`.xml`-Dateien als Map-Grundlage importieren; Shapes zu NagVis-Objekten mappen | Mittel |
| F8 | **Visualisierung von BI (Business Intelligence)** | BI-Aggregationen aus Checkmk als eigenen Node-Typ; Status via Checkmk BI REST API | Mittel |
| F9 | **3D Maps** | Räumliche Darstellung (z.B. Über- und Untertage im Bergbau); Godot-Engine als Renderer-Backend oder WebGL-Szene | Sehr hoch |
