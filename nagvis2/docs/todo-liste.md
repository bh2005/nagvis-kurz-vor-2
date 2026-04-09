# NagVis 2 – Todo-Liste

> Stand: 2026-04-08

---

## Offen – Bugs / Technische Schulden

- [x] **CSS-Variablen undefiniert** — `--bg2`, `--bg3`, `--hover`, `--err`, `--accent`, `--bg-base`, `--bg-alt` durch CSS-Alias-Tokens in `styles.css` aufgelöst (kein Breaking Change)
- [x] **`alert()` ersetzen** — alle `alert()`-Aufrufe in `auth.js`, `map-core.js`, `kiosk.js` durch `showToast()` ersetzt
- [x] **`.nv2-type-pill` Kontrast** — `styles.css` auf `--text-dim-surf` umgestellt (WCAG AA ✓)
- [x] **Zoom-Reset-Button** — `disabled` im HTML ist korrekt (Initialzustand); `zoom_pan.js:52` aktiviert den Button dynamisch beim Zoomen/Pannen; Click-Listener vorhanden (`zoom_pan.js:221`)
- [x] **Browser-Notifikationen** — `new Notification()` wird in `ws-client.js:180` aufgerufen; `requestPermission()` in `ui-core.js:325` vorhanden — vollständig implementiert

---

## UX / Frontend

- [x] Multi-Select: mehrere Nodes gleichzeitig auswählen und verschieben (Shift+Klick oder Lasso)
- [x] Multi-Select: Delete/Backspace zum Löschen aller ausgewählten Nodes
- [x] Multi-Select: Escape hebt Selektion auf
- [x] Map-Miniaturbilder in der Übersicht (OffscreenCanvas, POST/DELETE `/api/maps/{id}/thumbnail`)
- [x] Objekt-Reihenfolge: Layer per Drag & Drop umsortieren (zIndex), Layer löschen
- [x] Browser-Benachrichtigungen bei CRITICAL/DOWN (Web Push API + Hinweiston via Web Audio API, in Benutzereinstellungen an/abschaltbar)
- [x] Undo/Redo für Positionsänderungen, Resize, Properties, Löschen, Hinzufügen (Ctrl+Z / Ctrl+Y; bis 50 Schritte)
- [x] Copy / Paste / Duplicate (Ctrl+C / Ctrl+V / Ctrl+D; +3% Versatz, kaskadierendes Einfügen)
- [x] Align & Distribute: Toolbar bei ≥ 2 selektierten Nodes; 6 Ausrichte- + 2 Verteile-Funktionen
- [x] Smart Guides beim Drag: automatisches Einrasten + blaue Hilfslinien
- [x] Suche/Filter in der Sidebar (Maps nach Titel/ID filtern; Objekte der aktiven Map durchsuchen, Click-to-focus)
- [x] Favoriten: bestimmte Maps als Favoriten markieren
- [x] Map-Minimap / Übersichtsfenster bei großen Karten — Floating Panel, Status-Dots, Viewport-Rect, Click-to-pan, Taste M
- [x] Node-Größe per Drag-Handle ändern (statt nur über Dialog)

---

## Datenquellen & Import

- [x] **Import von DRAW.io Diagrammen** – `.drawio`/`.xml`-Dateien als Grundlage für Maps importieren; Nodes aus Shape-Bibliothek zu NagVis-Objekten mappen
- [ ] **Visualisierung von BI (Business Intelligence)** – BI-Aggregationen aus Checkmk als eigenen Node-Typ darstellen; Status aus Checkmk BI REST API abrufen

---

## Backend / API

- [x] Bulk-Operationen: mehrere Objekte in einem Request anlegen/verschieben/löschen → PATCH `/api/maps/{id}/objects/bulk`
- [x] Map-Duplikat-Funktion: Map klonen (POST `/api/maps/{id}/clone`)
- [x] Audit-Log: wer hat was wann geändert (`core/audit.py`, `GET /api/audit`, UI-Dialog)
- [x] Objekt-Kopieren zwischen Maps — Rechtsklick → "Auf andere Map kopieren…"; Multi-Select + Einzel-Node; Dialog mit Map-Auswahl
- [x] API-Versionierung (`/api/v1/`) — Backend-Prefix + 308-Redirect + `api()`-Helper normalisiert Pfade automatisch
- [ ] Rate-Limiting für Action-Endpoints (ACK, Downtime)
- [ ] SQLite statt JSON-Files (SQLAlchemy, Migration per Script)

---

## Multi-Backend

- [x] Checkmk REST API Connector (`checkmk/client.py`)
- [x] Icinga2 REST API Connector (`icinga2/client.py`)
- [x] Naemon Connector (`naemon/client.py`) – Livestatus Unix/TCP + REST API; ACK, Downtime, Reschedule
- [x] Zabbix JSON-RPC Connector (`zabbix/client.py`)
- [x] Prometheus / VictoriaMetrics Connector (`prometheus/client.py`)
- [x] SolarWinds Orion Connector (`solarwinds/client.py`) – SWIS API; Alert-Suppression, Unmanage, PollNow
- [x] Unified Backend Registry (`connectors/registry.py`)
- [x] Backend-Management-UI (Burger-Menü → Backends verwalten; inkl. Naemon + SolarWinds Formulare)
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

- [x] **Mehrsprachigkeit (DE/EN via JSON-Dictionary)** — i18n-Engine, Lang-Packs, Sprach-Picker, localStorage-Cache ✅
- [ ] Map-Vorlagen (Stern, Hierarchie, Rechenzentrum)
- [ ] Mobile-Ansicht (Touch-Events, Pinch-Zoom, responsive Breakpoints)
- [ ] Historische Daten / Verfügbarkeitsdiagramme (Checkmk REST API)

---

## Feature-Ideen (Backlog)

| # | Feature | Nutzen | Aufwand |
|---|---|---|---|
| F1 | **Checkmk BI & Event Console Widgets** | BI-Aggregate und Event-Console-Filter direkt als Gadget auf der Map anzeigen | Mittel |
| F2 | **Checkmk Topology-Import** | Hosts + Verbindungen automatisch aus Checkmk Topology übernehmen (kein manuelles Platzieren) | Hoch |
| ~~F3~~ | ~~**Custom Graph Gadget**~~ ✅ | Checkmk-Graphen (RRDtool) oder Grafana-Panels direkt in die Map einbetten (`<iframe>` oder PNG-URL) | Niedrig |
| F4 | **Auto-Layout (Graphviz / Force-Directed)** | „Arrange selected hosts"-Button — Nodes automatisch anordnen; Graphviz DOT oder D3 Force-Simulation | Mittel |
| ~~F5~~ | ~~**Prometheus & VictoriaMetrics Connector**~~ ✅ | Metrics-Backends für Hybrid-Umgebungen; PromQL-Ergebnis als Gadget-Wert | Mittel |
| F6 | **Versioned Maps + Git-Integration** | Maps in einem Git-Repository speichern und versionieren; Diff-Ansicht, Rollback | Mittel |
| ~~F7~~ | ~~**DRAW.io Import**~~ ✅ | `.drawio`/`.xml`-Dateien als Map-Grundlage importieren; Shapes zu NagVis-Objekten mappen | Mittel |
| F8 | **Visualisierung von BI (Business Intelligence)** | BI-Aggregationen aus Checkmk als eigenen Node-Typ; Status via Checkmk BI REST API | Mittel |
| F9 | **3D Maps** | Räumliche Darstellung (z.B. Über- und Untertage im Bergbau); Godot-Engine als Renderer-Backend oder WebGL-Szene | Sehr hoch |
