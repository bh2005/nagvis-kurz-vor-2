# NagVis 2 – Todo-Liste

> Stand: 2026-04-14

---

## Offen – Bugs / Technische Schulden

- [x] **CSS-Variablen undefiniert** — `--bg2`, `--bg3`, `--hover`, `--err`, `--accent`, `--bg-base`, `--bg-alt` durch CSS-Alias-Tokens in `styles.css` aufgelöst (kein Breaking Change)
- [x] **`alert()` ersetzen** — alle `alert()`-Aufrufe in `auth.js`, `map-core.js`, `kiosk.js` durch `showToast()` ersetzt
- [x] **`.nv2-type-pill` Kontrast** — `styles.css` auf `--text-dim-surf` umgestellt (WCAG AA ✓)
- [x] **Zoom-Reset-Button** — `disabled` im HTML ist korrekt (Initialzustand); `zoom_pan.js:52` aktiviert den Button dynamisch beim Zoomen/Pannen; Click-Listener vorhanden (`zoom_pan.js:221`)
- [x] **Browser-Notifikationen** — `new Notification()` wird in `ws-client.js:180` aufgerufen; `requestPermission()` in `ui-core.js:325` vorhanden — vollständig implementiert
- [x] **`+`-Button in Übersichtskarte** — doppelte `id="btn-new-map"` verhinderte Karten-Erstellung aus der Übersicht; ID in `ov-btn-new-map` umbenannt
- [x] **Service-Dropdown leer beim Platzieren** — `serviceCache` wurde nicht ans Platzierungs-Formular gebunden; input-Listener für `dlg-svc-host` und `dlg-svc-name` ergänzt
- [x] **Gadget-Werte nicht angezeigt (Checkmk)** — Checkmk REST API liefert Perfdata als Array; `_to_perf_str()` gab `""` zurück; fix: Array-Elemente mit Leerzeichen verbinden
- [x] **`$HOSTALIAS$` nicht aufgelöst** — Makros funktionierten nur im Label-Template-Feld, nicht im Label-Feld; `_nodeLabel` und `_applyLabelTemplate` erweitert
- [x] **Service-Anzahl im Tooltip immer 0** — Checkmk REST API liefert `num_services_*` in Hosts-Collection nicht; fix: Live-Zählung aus `hostCache`
- [x] **„undefined" in Host/Problem-Panel** — `Object.values(hostCache)` enthält Services ohne `name`; fix: Panels filtern nach `type`
- [x] **Kontextmenü-Aktionen fehlen** — `h` war `null` durch direkten `hostCache`-Lookup; fix: `_resolveStatus` verwenden; `_actionConfig.enabled` Migration für alte localStorage-Stände
- [x] **`backend_id` vs. `_backend_id`** — `applyStatuses` befüllte `backendStatusCache` nie (falscher Feldname); fix: `h.backend_id || h._backend_id`

---

## UX / Frontend

- [x] **Live-Perfdata in Tooltips** — Gadgets und Service-Objekte zeigen Live-Werte aus `perfdataCache`; alle Metriken mit Warn/Crit-Farbcodierung; aktive Metrik fett hervorgehoben
- [x] **Service-Objekte mit `perf_label`** — Perfdata-Metrik pro Service-Objekt konfigurierbar; Live-Wert im Node-Label; Autocomplete für Service + Metrik; `$PERFVALUE$`-Macro
- [x] **Eigenschaften im View-Mode** — „⚙ Eigenschaften" im Rechtsklick-Menü für Rolle `editor`/`admin`
- [x] **Probleme-Panel zeigt auch Services** — nicht nur Host-Probleme, sondern auch Service-Probleme werden angezeigt
- [x] **„Im Monitoring öffnen" automatische URL** — Checkmk: URL aus API-Base-URL abgeleitet; Fallback auf globale URL; ohne Konfig → Konfig-Dialog öffnet sich
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
- [x] Map-Vorlagen (Stern, Hierarchie, Rechenzentrum)
- [x] Mobile-Ansicht (Touch-Events, Pinch-Zoom, responsive Breakpoints)
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

---

## NagVis3D Integration (integration-nv2)

| # | Aufgabe | Details | Aufwand |
|---|---------|---------|---------|
| 3D-1 | **Add-Hosts-UI** | Dialog zum Hinzufügen / Entfernen von Hosts aus der 3D-Szene; Suche über NagVis2-Host-Liste (`GET /api/v1/hosts`); Zuweisung zu Floor + Node-Typ; Speichern via `POST /api/3d/{model_id}/mapping` | 3–4 Tage |
| 3D-2 | **ACK aus 3D-Ansicht** | Rechtsklick-Kontextmenü auf 3D-Node → ACK-Dialog (Pflichtfeld Grund); `POST /api/v1/hosts/{host}/ack`; Node-Badge zeigt ✔ nach Bestätigung | 2–3 Tage |
| 3D-3 | **Downtime aus 3D-Ansicht** | Rechtsklick → Downtime-Dialog (Start/Ende/Grund); `POST /api/v1/hosts/{host}/downtime`; Node zeigt 🔧-Overlay während Downtime | 2–3 Tage |
| 3D-4 | **Link zur Datenquelle (Checkmk)** | „In Checkmk öffnen"-Eintrag im Kontextmenü; URL aus Backend-Konfiguration bauen (`checkmk_url/{site}/...`); öffnet neuen Tab | 1–2 Tage |
| 3D-5 | **Reschedule Check** | Sofortiger Re-Check via `POST /api/v1/hosts/{host}/reschedule`; visuelles Feedback (Spinner am Node) | 1 Tag |
| 3D-6 | **Service-Liste im Inspector** | Aufklapper zeigt alle Services des Hosts mit Status-Badge; Klick auf Service öffnet Checkmk-Link | 2–3 Tage |
