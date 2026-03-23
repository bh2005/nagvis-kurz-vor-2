# NagVis 2 – Feature-Übersicht
> Stand: März 2026

---

## ✅ Gebaut

### Shell & Navigation
- **Single Page Application** – kein Build-Step, kein Framework, reines Vanilla JS
- **CSS Grid Layout** – Topbar (volle Breite) + Sidebar + Content
- **Light/Dark Theme** – CSS Custom Properties, Flash-freier Start via `<head>`-Snippet, persistiert in localStorage
- **Sidebar** – 216 px expanded / 44 px collapsed, Transition animiert, Toggle via Footer-Button oder Taste `B`
- **Topbar** – Logo (klickbar → Übersicht), Conn-Dot, Map-Titel, Status-Pills, Map-Toolbar, Burger-Menü
- **Keyboard-Shortcuts** – `B` Sidebar, `Ctrl+E` Edit-Mode, `R` Force-Refresh, `F11` Kiosk, `Esc` alles schließen
- **URL-Routing** – `#/map/datacenter-hh` öffnet Map direkt beim Laden, Bookmark- und verlinkbar

---

### Burger-Menü ☰
- Dropdown mit Sektionen: Aktive Map · Maps verwalten · System · Hilfe · Konto · Über
- Außenklick schließt, `on`-Zustand beim Edit-Mode visuell markiert
- Map-Sektion erscheint/verschwindet kontextabhängig (nur wenn Map offen)
- **Log-Viewer** – gefilterbarer In-Memory-Log-Dialog (Level, Zeilenanzahl, Freitext)
- **Log-Download** – `nagvis2.log` als Plaintext herunterladen
- **Swagger-Link** – immer sichtbar (öffnet `/api/v1/docs`)
- **Backends verwalten** – Dialog zum Hinzufügen/Testen/Entfernen von Backends
- **Audit-Log** – Dialog mit Filterung nach Map, Benutzer, Aktion; alle Änderungen nachvollziehbar
- **Über NagVis 2** – Version, GitHub-Link, integrierten Changelog-Viewer

---

### Map-Verwaltung
- **Neue Map erstellen** – Titel + optionale ID, Canvas-Modus wählbar (Free / Ratio / Fixed / OSM)
- **Map öffnen** – Sidebar-Eintrag oder Übersichtskarte, WebSocket-Verbindung wird aufgebaut
- **Map umbenennen** – Dialog, PUT `/api/maps/{id}/title`
- **Map löschen** – Bestätigungs-Prompt, aus geöffneter Map und aus Übersicht heraus
- **Parent-Map setzen** – Untermap-Hierarchie, PUT `/api/maps/{id}/parent`
- **Rechtsklick-Kontextmenü** auf Übersichtskarten – Öffnen, Umbenennen, Parent, Canvas-Format ändern, Exportieren, Löschen
- **Map-Export/Import** – ZIP-Download + Upload (Map-JSON + Hintergrundbild)
- **NagVis 1 Import** – `.cfg`-Parser, Canvas-Dimensionen wählbar, Dry-Run-Modus
- **Sidebar-Hierarchie** – Root-Maps oben, Kind-Maps darunter eingerückt (↳); gleiche Sortierung in der Übersicht
- **Topbar-Navigation** – Kind-Map geöffnet: `↑ Eltern-Map`-Link; Root-Map: Kind-Map-Chips

---

### Map-Canvas & Canvas-Modi
- **Free / Ratio / Fixed** – klassische Pixel- oder Prozent-Layouts
- **Hintergrundbild** – Upload via Burger-Menü oder Drag & Drop (PNG/JPG/SVG/WebP ≤ 20 MB)
- **Node-Koordinaten in %** – responsiv, skaliert mit dem Hintergrundbild
- **OSM / Weltkarte** – interaktive OpenStreetMap via Leaflet.js 1.9.4
  - Nodes als Custom-HTML-Marker (`x` = Breitengrad, `y` = Längengrad)
  - Drag & Drop im Edit-Mode mit automatischer API-Persistierung
  - Tile-Server konfigurierbar (Standard: OpenStreetMap, eigener Server möglich)
  - Kartenposition (Lat/Lng/Zoom) automatisch in Map-Config gespeichert
  - Status-Updates via WebSocket vollständig unterstützt
  - **Cluster-Bubbles** – Leaflet.markercluster: Nodes bündeln sich beim Herauszoomen; Bubble-Farbe zeigt schlechtesten Status der enthaltenen Nodes; Edit-Mode deaktiviert Clustering für Drag-Support

---

### Objekt-Typen auf der Map
| Typ | Status | Besonderheiten |
|---|---|---|
| **Host** | ✅ | Icon, Label, Status-Badge, Tooltip, Label-Template mit Macros |
| **Service** | ✅ | Host-Name + Service-Name, Typ-Pill, Datalist-Autocomplete, Label-Template |
| **Hostgroup** | ✅ | Worst-State-Aggregation aller Hosts, Typ-Pill „hg" |
| **Servicegroup** | ✅ | Typ-Pill „sg" |
| **Map (nested)** | ✅ | Typ-Pill „map", klickbar → öffnet Untermap |
| **Textbox** | ✅ | Freier Text, Schriftgröße/Farbe/Fett/Hintergrund |
| **Linie** | ✅ | Stil/Farbe/Breite, Drag-Handles, Winkel-Slider, Statusfarbe, View-Mode-Aktionsmenü |
| **Container** | ✅ | Bild-URL, resize-fähig |
| **Gadget** | ✅ | Radial, Linear (H/V), Sparkline, Thermometer, Flow/Weather, Raw-Number |

### Label-Template-System
- **Nagios-Macros** – `$HOSTNAME$`, `$HOSTALIAS$`, `$HOSTSTATE$`, `$HOSTOUTPUT$`, `$SERVICEDESC$`, `$SERVICESTATE$`, `$SERVICEOUTPUT$`, `$MAPNAME$`
- **Checkmk/Nagios-Labels** – `$LABEL:os$`, `$LABEL:location$`, `$LABEL:env$`, … (beliebiger Key)
- **Datenquellen** – Livestatus: `custom_variables` → Labels; Checkmk REST API: `extensions.labels`
- **Live-Aktualisierung** – Template wird bei jedem WebSocket-Status-Update neu aufgelöst
- **Konfiguration** – Eigenschaften-Dialog im Edit-Mode; separates Feld für Template vs. statisches Label

---

### Iconset-System
- **Inline SVG Data-URIs** – kein Dateisystem-Iconset erforderlich
- **Status-Icons** – farbige Kreise je Status (ok/warning/critical/unknown/pending/down)
- **Shape-Overlays** – 10 Geräteshapes (server/router/switch/firewall/database/storage/ups/ap/map/std_small)
- **Iconset-Dialog** – Grid-Auswahl inkl. Upload-Option
- **Größen-Slider** – 16–96 px via CSS `--node-size`

---

### Gadget-System
- **Radial-Gauge** – kreisförmige Anzeige mit warn/crit-Farbzonen
- **Linear-Gauge** – Balken horizontal oder vertikal (konfigurierbar)
- **Sparkline** – Zeitreihenlinie, Datenpunkt-Anzahl konfigurierbar (5–100)
- **Thermometer** – vertikale Füllstandsanzeige
- **Flow/Weather-Line** – bidirektionale Bandbreiten-Linie mit Statusfarbe
- **Raw-Number** – numerischer Wert mit Einheit und konfigurierbaren Nachkommastellen
- **Perfdata-Integration** – Nagios/Checkmk Performance-Daten automatisch eingespeist
  - Parser unterstützt quoted/unquoted Labels, UOM (%, ms, MB, GB, ...)
  - `perf_label`-Feld im Gadget-Dialog mit Datalist-Autocomplete
  - Eigene warn/crit/min/max-Werte haben Vorrang vor Perfdata

---

### Node-Status & Live-Updates
- **WebSocket** – reconnect-Loop, Heartbeat, Diff-only Updates
- **Demo-Modus** – funktioniert ohne Nagios/Checkmk, simuliert Statuswechsel alle 8 s
- **Demo-Features-Map** – vollständige Demo-Map mit 14 Objekten (Hosts, Services, Linien, Gadgets)
- **Auto-Fallback** – öffnet Demo-Map automatisch wenn kein Backend erreichbar
- **Status-Klassen** – `nv2-ok / nv2-warning / nv2-critical / nv2-unknown / nv2-ack / nv2-downtime`
- **Status-Flash-Animation** – kurzes Aufblitzen bei Wechsel
- **CRITICAL-Blink** – pulsierender Top-Stripe bei kritischen Nodes
- **Topbar-Pills** – OK / WARN / CRIT Zähler, CRIT blinkt
- **Tooltip** – Hostname, Status, Plugin-Output, Services-Zusammenfassung

---

### Edit-Mode (`Ctrl+E`)
- **Banner** – unten auf Canvas mit Shortcut-Hinweisen
- **Canvas-Klick** – öffnet Dialog „Objekt platzieren" an geklickter Position
- **Node-Drag** – PATCH `/api/maps/{id}/objects/{oid}` (Koordinaten in %)
- **Multi-Select** – Klick / Shift+Klick / Lasso-Rechteck
  - Gruppen-Drag: alle selektierten Nodes gemeinsam verschieben
  - Gruppen-Löschen via Rechtsklick oder Delete/Backspace
- **Rechtsklick-Kontextmenü** – Löschen, Layer zuweisen, Größe ändern, Iconset wechseln
- **Linien-Drag-Handles** – cyanfarbene Kreise an Endpunkten
- **Linienstil-Dialog** – Farbe, Stil (solid/dashed/dotted), Breite, Winkel-Slider
- **Resize-Panel** – Slider + Pixel-Anzeige für Node- und Gadget-Größe
- **OSM Edit-Mode** – Klick auf Karte öffnet Add-Object-Dialog mit Lat/Lng, Marker verschiebbar

---

### Zoom & Pan
- CSS `transform: scale() translate()` auf `#map-canvas-wrapper`
- Mausrad-Zoom, Drag-Pan, Reset-Button
- Zoom-Controls (+ / − / ⊙) in der Toolbar
- Im OSM-Modus übernimmt Leaflet Zoom/Pan (NV2_ZOOM deaktiviert)

---

### Layer-System
- Layer-State `{ id → { name, visible, zIndex } }` im Speicher
- **Sidebar-Panel** – Checkbox Ein/Aus, Doppelklick umbenennen
- **Drag-to-Reorder** – Layer per ⠿-Handle umsortieren; zIndex wird automatisch neu vergeben und sofort auf alle Nodes angewendet
- **Layer löschen** – ✕-Button (hover); Objekte werden auf Layer 0 verschoben (mit Bestätigungs-Dialog)
- **Layer-Dialog** – Zuweisung zu bestehendem oder neuem Layer
- **Kontextmenü-Eintrag** „◫ Layer zuweisen" auf allen Nodes und Linien

---

### Snap-In Panels
- **Hosts-Panel** – sortiert nach Severity, Klick fokussiert Node auf der Map
- **Events-Panel** – letzten 60 Statusänderungen als Live-Stream via WebSocket
- Slide-in Animation, schließbar via `✕` oder `Esc`

---

### Kiosk-Modus (`F11`)
- Vollbild-Overlay via Fullscreen API, Canvas füllt gesamten Bildschirm
- Exit-Button erscheint bei Mausbewegung (fade-out nach 2,5 s)
- Status-Ticker unten: Map-Titel + Uhrzeit
- Auto-Refresh nach einstellbarem Intervall (30 s – 5 min)
- Token-URL für passwortfreien Kiosk-Zugang
- Zoom/Pan-Fix: SVG-Linien korrekt im CSS-Transform-Chain

---

### Benutzereinstellungen
- Dark/Light Theme-Chips (visuell) – **Standard: Dark**
- Sidebar-Startzustand (Expanded/Collapsed) – **Standard: Expanded**
- Kiosk-Optionen (Sidebar, Topbar, Auto-Refresh, Intervall)
- Persistenz via `nv2-user-settings` in localStorage (einzige Quelle; `nv2-theme` / `nv2-sidebar` entfernt)

---

### Multi-Backend
- **Livestatus TCP/Unix** – direkte Nagios/Checkmk-Verbindung
- **Checkmk REST API** – async HTTP-Client für Checkmk REST API v1.0
- **Unified Registry** – Backends gemischt nutzbar, Hot-Add ohne Neustart
- **Persistenz** – `data/backends.json`, LIVESTATUS_* Env-Vars werden auto-importiert
- **Backend-Management-UI** – Burger-Menü → Backends verwalten (hinzufügen, testen, entfernen)
- **Probe-Endpoint** – Verbindungstest ohne permanenten Eintrag (`POST /api/backends/probe`)

---

### Monitoring & Betrieb
- **Prometheus** – `GET /metrics` Scrape-Endpoint mit vollständigem Metrik-Set
  (`nagvis2_http_requests_total`, `_http_request_duration_seconds`, `_ws_connections`,
  `_backend_reachable`, `_backend_poll_duration_seconds`, `_maps_total`, ...)
- **Liveness-Probe** – `GET /health/live` (immer 200)
- **Readiness-Probe** – `GET /health/ready` (503 wenn kein Backend erreichbar)
- **Strukturiertes Logging** – `LOG_FORMAT=json` → python-json-logger (ELK/Loki), `LOG_FORMAT=text` → Standard
- **Log-Viewer** – In-Memory-Ringpuffer (1000 Zeilen), abrufbar über Burger-Menü oder `GET /api/logs`
- **Helm-Chart** – `helm/nagvis2/` mit Ingress, PVC, HPA, ServiceMonitor (Prometheus Operator)
- **Docker** – `docker compose up --build` → http://localhost:8008/, non-root User, tini PID-1

---

### Help-System
- Integriertes MkDocs-Hilfe-System unter `/help/`
- Abgedeckt: User-Guide, Admin-Guide, API-Reference, Kiosk-Guide, OSM-Guide, Dev-Guide (WIP)

---

## 🔲 Geplant / In Arbeit

*(Prio-Reihenfolge nach Produktionsrelevanz)*

### Hohe Priorität
| # | Feature | Beschreibung |
|---|---|---|
| P1 | **Authentifizierung** | Login-UI, JWT, Token-Refresh, Benutzer-Management |
| P2 | **HTTPS / TLS** | nginx Reverse-Proxy-Konfiguration für Produktion |
| P3 | **Systemd / OMD-Hook** | uvicorn als Dienst, automatischer Start mit OMD-Site |

### Mittlere Priorität
| # | Feature | Beschreibung |
|---|---|---|
| M1 | **Suche/Filter-Sidebar** | Hosts/Services/Maps filtern, Volltextsuche |
| M2 | **Map-Duplikat-Funktion** | Map klonen inkl. aller Objekte |
| M3 | **SQLite statt JSON-Files** | SQLAlchemy, JSON als Fallback, Migration per Script |
| ~~M4~~ | ~~**Label-Templates**~~ | ✅ Nagios-Macros + Checkmk-Labels; Live-Auflösung per WS-Update |
| M5 | **Downtime planen** | Direktaufruf Checkmk-API aus NagVis heraus |

### Nice-to-have / Langfristig
| # | Feature | Beschreibung |
|---|---|---|
| N1 | **Mehrsprachigkeit (i18n)** | DE/EN via JSON-Dictionary |
| N2 | **Map-Vorlagen** | Vordefinierte Layouts (Stern, Hierarchie, Rechenzentrum) |
| N3 | **Mobile-Ansicht** | Touch-Events für Drag, Pinch-Zoom, responsive Breakpoints |
| N4 | **Benachrichtigungen** | Browser-Push bei CRITICAL-Statuswechsel (Web Push API) |
| N5 | **Historische Daten** | Verfügbarkeits-Diagramme via Checkmk REST-API |
| N6 | ~~**Test-Coverage**~~ | ✅ `ws_manager.py` 89 %, `main.py` 76 % – Ziel ≥ 70 % erreicht |
| ~~N7~~ | ~~**Map-Miniaturbilder**~~ | ✅ canvas → PNG, Upload, automatisch beim Schließen einer Map |
| N8 | ~~**Audit-Log**~~ | ✅ JSONL-Log, Rotation, REST-API, UI-Dialog mit Filtern |

---

## 📊 Fortschritts-Übersicht

```
Frontend-Shell      ████████████████████  100%
Map-Verwaltung      ██████████████████░░   90%  (Auth fehlt)
Objekt-Typen        ████████████████████  100%  (Label-Templates, remove_ack, Linien-Aktionsmenü)
Edit-Mode           ████████████████████  100%
Live-Status         ██████████████████░░   90%  (Livestatus + Checkmk)
Layer-System        ████████████████████  100%
Kiosk-Modus         ████████████████████  100%
OSM / Weltkarte     ████████████████████  100%
Gadget-System       ████████████████████  100%
Monitoring/Betrieb  ████████████████░░░░   80%  (Systemd/OMD offen)
Backend API         █████████████████░░░   85%  (Auth, HTTPS offen)
Docker/Helm         ██████████████████░░   90%
Tests               ████████████████░░░░   80%  (ws_manager 89%, main 76%)
GitHub Actions      ████████████████████  100%  (CI, Docker, MkDocs, Dependabot)
```
