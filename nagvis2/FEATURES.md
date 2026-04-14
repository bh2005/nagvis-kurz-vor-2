# NagVis 2 – Feature-Übersicht

Vollständige Liste aller implementierten Features, geordnet nach Bereich.

---

## Echtzeit-Monitoring

| Feature | Details |
|---|---|
| WebSocket-Livestatus | Permanente Verbindung zum Backend; Diff-basierte Updates (nur geänderte Hosts/Services werden übertragen) |
| Automatischer Reconnect | Exponentieller Backoff bei Verbindungsunterbrechung |
| Offline-Banner | Sichtbarer Hinweis bei fehlender WS-Verbindung |
| Erster Poll vollständig | Beim Start werden alle Hosts/Services gesendet, unabhängig von vorherigem Zustand |
| Heartbeat | Regelmäßige Lebenszeichen-Nachricht wenn keine Statusänderungen vorliegen |
| Status-Badge | Farbcodiertes Badge (UP/DOWN/CRITICAL/WARNING/UNKNOWN/UNREACHABLE) auf jedem Node |
| ACK / Downtime | Visuelle Kennzeichnung (gedimmt + Symbol) für bestätigte Probleme und Wartungsfenster |
| Live-Tooltips | Mouseover zeigt Status, Plugin-Ausgabe, Service-Anzahl (Live-Zählung), Perfdata-Metriken mit Warn/Crit-Farbcodierung |
| Probleme-Panel | Zeigt Host- UND Service-Probleme in Echtzeit |

---

## Multi-Backend-Unterstützung

| Backend | Protokoll | Besonderheiten |
|---|---|---|
| **Livestatus TCP** | Nagios/Checkmk TCP-Socket | Host, Port; Standard-Port 6557 |
| **Livestatus Unix** | Nagios/Checkmk Unix-Socket | Socket-Pfad (z.B. OMD) |
| **Checkmk REST API** | Checkmk v2.0+ REST API v1 | Automation-User + Secret; Perfdata direkt aus API |
| **Zabbix JSON-RPC** | Zabbix 5.x / 6.0+ | API-Token (6.0+) oder Benutzername/Passwort; Severity-Mapping |
| **Icinga2 REST API** | Icinga2 2.11+ v1 | Basic Auth; Custom-Vars als Labels; ACK + Downtime-Aktionen |
| **Naemon** | Livestatus Unix/TCP oder REST API | Socket `/var/cache/naemon/live`; 3 Verbindungsarten; ACK + Downtime + Reschedule |
| **Prometheus / VictoriaMetrics** | HTTP API v1 | `up`-Metrik als Hosts; Alerts als Services; `job`-Label als Hostgruppe; read-only |
| **SolarWinds Orion** | SWIS API Port 17778 | SWQL für `Orion.Nodes` + `Orion.APM`; Alert-Suppression als ACK; Unmanage als Downtime |
| **Demo** | Statisch | Eingebaute Testdaten ohne Verbindung; für Präsentationen |

- Alle Backends gleichzeitig aktiv (Hot-Add, kein Neustart nötig)
- Persistenz in `data/backends.json`
- Pro Node wählbar: welches Backend für Status zuständig ist (`backend_id`)
- `_backend_id`-Tag in WS-Broadcasts → korrekte Zuordnung bei gleichnamigen Hosts

---

## Karten-Editor (Edit-Mode)

| Feature | Details |
|---|---|
| Drag & Drop | Alle Node-Typen per Maus verschieben |
| Multi-Select | Lasso-Selektion oder Shift+Klick; Gruppen-Drag |
| Delete | Ausgewählte Nodes mit Delete/Backspace löschen |
| Kontextmenü | Rechtsklick auf Node öffnet typspezifische Aktionen inkl. Duplizieren |
| **Undo/Redo** | `Ctrl+Z` / `Ctrl+Y`; bis 50 Schritte; Verschieben, Resize, Properties, Löschen, Hinzufügen |
| **Copy / Paste / Duplicate** | `Ctrl+C` / `Ctrl+V` / `Ctrl+D`; Einfügen mit +3 % Versatz; Mehrfach-Einfügen kaskadierend |
| **Align & Distribute** | Toolbar bei ≥ 2 Nodes: Links/Mitte/Rechts/Oben/Mitte/Unten; Verteilen H/V (≥ 3 Nodes) |
| **Smart Guides** | Einrasten an Kanten + Mittelpunkte beim Drag; blaue Hilfslinien |
| Layer-System | Nodes auf verschiedene Layer (0–9) verteilen; Layer ein-/ausblenden; per Drag & Drop umsortieren |
| Objekt-Typen | Host, Service, Hostgruppe, Servicegruppe, Map (nested), Textbox, Linie, Container, Gadget |
| Iconsets | `std_small`, `server`, `router`, `switch`, `firewall`, `storage`, `database`, `ups`, `ap` |
| Canvas-Formate | Frei, Seitenverhältnis (16:9 / 4:3 / 21:9 / 3:2 / 1:1), Feste Auflösung, Hintergrundbild |
| Hintergrundbild | Upload per Datei-Dialog oder Drag & Drop (PNG, JPG, SVG, WebP) |
| Node-Eigenschaften | Label-Templates mit Nagios-Macros (`$HOSTNAME$`, `$OUTPUT$`, `$STATEID$`, Labels) |
| Größenänderung | Größe über Dialog-Slider |

---

## Objekt-Typen (Detail)

### Monitoring-Nodes

- **Host / Service / Hostgruppe / Servicegruppe** — Statusanzeige mit farbigen Icons, Badge, Tooltip
- **Map (nested)** — referenziert eine andere Map; zeigt schlechtesten Status der Ziel-Map
- **Service `perf_label`** — Service-Objekte können eine Perfdata-Metrik konfigurieren; Live-Wert wird automatisch im Node-Label angezeigt (`"Label: 1.234ms"`)
- **`$PERFVALUE$`-Macro** — Label-Template-Macro gibt den Live-Wert der konfigurierten Metrik zurück

### Visuelle Elemente

- **Textbox** — Freitext, konfigurierbar: Schriftgröße, Farbe, Hintergrund, Fettschrift, Link
- **Linie** — einfache Verbindungslinie (Farbe, Strichart, Breite)
- **Weathermap-Linie** — Statusfarbe nach Host-Zustand; Bandbreiten-Labels; uni-/bidirektionale Pfeile
- **Container** — zeigt Bild (PNG/SVG) auf der Karte

### Gadgets

| Typ | Beschreibung |
|---|---|
| ⏱ Radial | Kreisförmige Anzeige mit Warn/Crit-Markern |
| ▬ Linear (H/V) | Horizontaler oder vertikaler Balken |
| 〜 Sparkline | Zeitverlaufskurve (konfigurierbarer History-Puffer) |
| 🌡 Thermometer | Füllstand / Temperatur |
| → Flow / Weather | Uni- oder bidirektionale Durchflussanzeige |
| 🔢 Raw-Number | Numerischer Wert (Divisor, Einheit, Nachkommastellen) |
| 📊 Graph / iframe | Externe Grafik einbetten (Grafana-Panel, Checkmk-Graph, beliebige URL) |

Alle Gadgets:
- Datenquelle: Live-Perfdata (Monitoring-Host + Service + Perfdata-Metrik) oder statischer Demo-Wert
- Backend pro Gadget wählbar
- Live-Vorschau im Konfigurations-Dialog
- **Live-Tooltip**: Mouseover zeigt aktuellen Wert aus `perfdataCache`, alle Metriken des Services, Service-Status und Plugin-Ausgabe

**Graph-Gadget** zusätzlich:
- Einbettung via `<iframe>` (Standard) oder `<img>` (für PNG-Render-APIs)
- Konfigurierbare Breite und Höhe in Pixeln
- Auto-Refresh mit einstellbarem Intervall (Sekunden)

---

## View-Mode Aktionen

Rechtsklick auf einen Monitoring-Node öffnet ein Aktionsmenü:

| Aktion | Beschreibung |
|---|---|
| 🔍 Im Monitoring öffnen | Öffnet Host/Service direkt in der Monitoring-UI; URL wird automatisch pro Backend abgeleitet (Checkmk: aus API-URL; Fallback: globale URL) |
| ✔ Problem bestätigen | ACK mit Kommentar, sticky, Benachrichtigung (nur bei Problem-Zustand) |
| ✖ Bestätigung aufheben | Remove-ACK (nur wenn bereits ACK gesetzt) |
| 🔧 Wartung einplanen | Downtime mit Start-/Endzeit und Kommentar |
| 🔧 Wartung aufheben | Remove-Downtime (nur wenn Downtime aktiv) |
| ↻ Check erzwingen | Reschedule-Check |
| 🖥 SSH / 🌐 HTTP / 🔒 HTTPS | Direkte Verbindung zum Host |
| 📊 Grafana öffnen | Grafana-Dashboard per konfigurierter URL |
| ⚙ Eigenschaften | Öffnet Eigenschaften-Dialog (nur für Rolle `editor`/`admin`) |

Aktionen konfigurierbar: Burger-Menü → ⚡ Aktionen konfigurieren

**„Im Monitoring öffnen" — URL-Ableitung pro Backend:**

| Backend | URL-Quelle |
|---|---|
| Checkmk REST API | Automatisch aus API-Base-URL: `view.py?host=…&view_name=host` / `view.py?host=…&service=…&view_name=service` / `view.py?hostgroup=…` / `view.py?servicegroup=…` |
| Andere Backends | Globale `monitoring_url` aus Aktions-Konfig |
| Nicht konfiguriert | Aktions-Konfig-Dialog öffnet sich automatisch |

---

## Map-Verwaltung

| Feature | Details |
|---|---|
| Map erstellen | Titel + Canvas-Format wählen |
| Map umbenennen | Über Burger-Menü |
| Map duplizieren / klonen | Vollständige Kopie inklusive aller Objekte |
| Map exportieren | ZIP-Archiv (map.json + Hintergrundbild) |
| Map importieren (.zip) | NagVis-2-Format mit optionalem dry-run |
| NagVis-1-Migration | `.cfg`-Datei importieren und Objekte konvertieren |
| **draw.io Import** | `.drawio`/`.xml`-Dateien importieren: Shapes → Textboxen oder Hosts, Verbindungen → Linien |
| Thumbnails | Automatisch erzeugte Vorschaubilder in der Map-Übersicht |
| Map-Hierarchie | Parent/Child-Beziehungen; Breadcrumb-Navigation in Topbar |
| OSM / Weltkarte | OpenStreetMap als Hintergrund (Leaflet.js); Nodes auf Lat/Lng positionieren |

---

## Authentifizierung & Benutzer

| Feature | Details |
|---|---|
| Optionale Authentifizierung | `AUTH_ENABLED=false` (Standard) — offen; `true` — Login mit JWT |
| JWT-Bearer-Token | RS256, 30-Tage-Gültigkeit, Auto-Refresh 1 Tag vor Ablauf |
| Rollen | `admin` (vollständig), `viewer` (nur lesen) |
| Benutzer-Verwaltung | Über Swagger UI / API oder Burger-Menü (Admin) |
| Kiosk-Token | Permanente Token-URLs ohne Login für Kiosk-Displays |
| Passwort-Hashing | bcrypt |

---

## Kiosk-Modus

| Feature | Details |
|---|---|
| Token-URL | `?token=<kiosk-token>` — keine Anmeldung nötig |
| Map-Rotation | Mehrere Maps automatisch durchschalten (konfigurierbares Intervall) |
| Vollbild | F11-Taste oder `?fullscreen=1` |
| Zoom/Pan | Funktioniert vollständig im Kiosk-Modus |

---

## Betrieb & Observability

| Feature | Details |
|---|---|
| Prometheus-Metriken | `/metrics` — HTTP-Requests, WS-Verbindungen, Backend-Erreichbarkeit, Poll-Dauer |
| Strukturiertes Logging | JSON-Format (`LOG_FORMAT=json`) oder Text; In-Memory-Ringpuffer; Download via UI |
| Liveness/Readiness | `/health/live`, `/health/ready` für Kubernetes |
| Helm-Chart | Vollständiger Helm-Chart inkl. Ingress, PVC, HPA, ServiceMonitor |
| HTTPS/TLS | nginx-Reverse-Proxy-Konfiguration inkl. TLS-Setup-Script |
| OMD/Checkmk-Hook | Direkte Integration in OMD-Sites; Systemd-Service |
| Audit-Log | Wer hat was wann geändert (`GET /api/audit`) |

---

## API

| Bereich | Details |
|---|---|
| REST API | Vollständige CRUD-API für Maps, Objekte, Backends, Benutzer |
| Versionierung | Alle Endpoints unter `/api/v1/`; 308-Redirect von `/api/` |
| Swagger UI | Immer verfügbar unter `/api/v1/docs` |
| draw.io Import | `POST /api/maps/import-drawio` — serverseitiger XML-Parser |
| Bulk-Operationen | `PATCH /api/maps/{id}/objects/bulk` — mehrere Objekte in einem Request |

---

## Frontend-Technik

| Feature | Details |
|---|---|
| Kein Framework | Vanilla JavaScript (ES2022), kein React/Vue/Angular |
| Dark/Light-Theme | Persistiert in localStorage |
| Zoom/Pan | CSS-Transform-basiert; funktioniert mit allen Node-Typen inkl. SVG-Linien |
| Offline-Modus | Demo-Mode läuft vollständig im Browser (localStorage-basiert) |
| Browser-Benachrichtigungen | Bei CRITICAL/DOWN — Web-Push-API + Hinweiston (Web Audio API) |
| Label-Templates | Nagios-Macros (`$HOSTNAME$`, `$HOSTALIAS$`, `$HOSTSTATE$`, `$PERFVALUE$` etc.) + Monitoring-Labels in Node-Beschriftungen; funktionieren auch im regulären Label-Feld |
| **Mehrsprachigkeit (i18n)** | `window.t(key, vars)` — Schlüssel-basierte Übersetzung mit `{var}`-Interpolation; DE + EN eingebaut; beliebige Sprachen per JSON-Lang-Pack-Import erweiterbar; `data-i18n`-Attribute im DOM; localStorage-Cache für blitzschnellen Warm-Start ohne Flash |

---

## Mehrsprachigkeit (i18n)

| Feature | Details |
|---|---|
| Sprachpakete | DE (`de.json`) und EN (`en.json`) eingebaut; Format: `{ meta, strings }` |
| Erweiterbar | Beliebige Sprache als JSON-Datei hochladbar — kein Build-Schritt nötig |
| Sprach-Picker | Dropdown in **⚙ Einstellungen**; Umschalten wirkt sofort ohne Seiten-Reload |
| Kein Flash | Synchrone Cache-Ladung aus localStorage im Boot; Async-Fetch im Hintergrund |
| DOM-Attribute | `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` für statische HTML-Texte |
| Pluralisierung | `{suffix}`-Pattern; sprachabhängig DE (`'en'`/`''`) vs. EN (`'s'`/`''`) |
| Dynamische UI | `_refreshDynamicUI()` nach Sprachwechsel aktualisiert Theme-Labels, Maps, Host-Panel |

---

## Tests & Qualität

| Feature | Details |
|---|---|
| pytest | Backend-Unit- und Integrationstests |
| Coverage ≥ 70 % | CI schlägt fehl bei Unterschreitung |
| Python 3.9–3.13 | `from __future__ import annotations` für Rückwärtskompatibilität |
| GitHub Actions CI | Lint, Tests, Coverage-Check bei jedem Push/PR |
| Docker-Build-CI | Automatischer Docker-Image-Build und -Push |
| MkDocs-Docs-CI | Automatisches Bauen und Deployen der Dokumentation |
| Release-Automation | Automatische GitHub-Release-Erstellung via Tag |
