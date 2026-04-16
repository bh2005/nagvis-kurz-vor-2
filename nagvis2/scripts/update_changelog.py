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

import re
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

[2026-03-23]   Map-Miniaturbilder (Thumbnails) in der Uebersicht
               Backend:
               - core/config.py: THUMBS_DIR = data/thumbnails
               - core/storage.py: list_maps() liefert 'thumbnail'-Feld
                 (URL /thumbnails/{id}.png wenn Datei existiert)
               - core/storage.py: delete_map() loescht auch Thumbnail
               - api/router.py: POST /api/maps/{id}/thumbnail (PNG-Upload)
               - api/router.py: DELETE /api/maps/{id}/thumbnail
               - main.py: /thumbnails/ als StaticFiles gemountet
               Frontend:
               - map-core.js: _thumbHtml() - Thumbnail > Hintergrundbild >
                 OSM-Placeholder > Gitternetz-Placeholder
               - map-core.js: _captureThumbnail() - liest Node-Positionen
                 synchron aus dem DOM (vor Canvas-Verstecken)
               - map-core.js: _buildAndUploadThumb() - zeichnet 320x180 Canvas:
                 Hintergrundfarbe, Gitternetz, Hintergrundbild, Nodes als
                 farbige Punkte mit Glow-Effekt; laedt PNG hoch
               - map-core.js: showOverview() ruft _captureThumbnail() auf
               - css/styles.css: .ov-thumb, .ov-thumb-ico, .ov-thumb-grid

[2026-03-23]   Bugfix: Auth-Bypass-Fix (AUTH_ENABLED=false)
               - backend/core/auth.py: _ANON_ADMIN-Singleton; require_auth
                 gibt diesen zurueck wenn AUTH_ENABLED=false
               - frontend/js/auth.js: currentUser = { username:'admin',
                 role:'admin' } wenn Auth deaktiviert; Benutzerverwaltungs-UI
                 erscheint korrekt

[2026-03-23]   Feature: OSM Cluster-Bubbles
               - frontend/index.html: Leaflet.markercluster v1.5.3 (CDN)
               - js/osm.js: _clusterGroup = L.markerClusterGroup(...)
                 Bubble-Farbe = schlechtester Status der Kind-Marker
                 (_STATE_RANK: up/ok/warning/unknown/critical)
                 Edit-Mode deaktiviert Clustering fuer Drag-Unterstuetzung

[2026-03-23]   Bugfix: Thumbnail-Timing-Problem behoben
               - frontend/js/map-core.js: nach erfolgreichem Upload wird
                 .ov-thumb-DOM direkt aktualisiert (kein Map-Listen-Reload)

[2026-03-23]   Feature: Audit-Log (N8) - abgeschlossen
               Backend:
               - NEU: core/audit.py - append-only JSONL-Log in data/audit.jsonl
                 audit_log(request, action, **details) schreibt Eintraege
                 read_audit(limit, map_id, action, user) - gefiltert neueste zuerst
                 _maybe_rotate: Rotation ab 10.000 Eintraegen (20% Aelteste weg)
                 User aus Bearer-Token oder X-NV2-User-Header (Fallback: system)
               - api/router.py: alle mutierenden Endpunkte schreiben Audit
               - api/auth_router.py: user.create/role_change/password_change/delete
               - NEU: GET /api/audit?limit=&map_id=&action=&user=
               Frontend:
               - index.html: Audit-Log-Button im Burger-Menue + dlg-audit Dialog
               - js/auth.js: nv2AuditOpen(), nv2AuditLoad() mit Filtern
               - js/ws-client.js: api() sendet X-NV2-User-Header
               - css/styles.css: Audit-Tabellen-Stile

[2026-03-23]   Feature: Test-Coverage (N6) - Ziel >= 70% erreicht
               - backend/pyproject.toml (NEU): pytest-Konfiguration
               - backend/requirements-dev.txt (NEU): pytest, pytest-asyncio,
                 pytest-cov, anyio
               - backend/tests/conftest.py (NEU): data_dirs + client Fixtures
               - backend/tests/test_ws_manager.py: 25 Tests
               - backend/tests/test_api_maps.py: 34 Tests
               - backend/tests/test_auth.py: 17 Tests
               - backend/tests/test_audit.py: 13 Tests
               - backend/tests/test_storage.py: 25 Tests
               - backend/tests/test_perfdata.py: 18 Tests
               Ergebnis: 137 Tests, alle gruen
               ws/manager.py: 89%, main.py: 76% (Ziel >= 70% erreicht)
               - backend/main.py: import logging.handlers ergaenzt

[2026-03-23]   Feature: Layer-System vervollstaendigt (100%)
               - nodes.js: Layer-Panel zeigt jetzt Drag-Handle (Braille-Zeichen)
               - Drag-to-Reorder: Layer per Drag&Drop umsortieren;
                 zIndex wird neu vergeben (10,20,30,...) und sofort angewendet
               - Loeschen-Button (X): erscheint beim Hover; Objekte werden auf
                 Layer 0 verschoben (mit Bestaetigung wenn Objekte vorhanden)
               - Layer-Liste wird nach zIndex sortiert dargestellt
               - css/styles.css: .layer-drag-handle, .layer-del-btn,
                 .layer-dragging, .layer-drag-over

[2026-03-23]   Feature: Sidebar + Uebersicht Map-Hierarchie
               - map-core.js: _sortMapsHierarchically() - Root-Maps oben,
                 Kind-Maps direkt darunter (depth=1)
               - renderSidebarMaps(): Kind-Maps mit .map-entry-child + Pfeil (ue)
               - renderOverview(): gleiche Sortierung; Kind-Karten mit
                 .ov-card-child (linker Akzentbalken); Eltern-Titel statt ID
               - css/styles.css: .map-entry-child, .map-entry-indent,
                 .ov-card-child

[2026-03-23]   Feature: Topbar-Navigation (Eltern-/Kind-Links)
               - index.html: <div id="tb-nav" class="tb-nav"> zwischen
                 tb-ident und tb-pills
               - map-core.js: _renderTopbarNav(mapId, parentMapId)
                 Kind-Map: zeigt Aufwaerts-Link zur Eltern-Map
                 Root-Map: zeigt Kind-Map-Chips (Pfeil + Titel)
               - showOverview(): leert #tb-nav
               - css/styles.css: .tb-nav, .tb-nav-up, .tb-nav-child

[2026-03-23]   Bugfix: Standard-Defaults konsolidiert
               - ui-core.js: restoreSidebar() liest jetzt loadUserSettings()
                 .sidebarDefault statt separatem nv2-sidebar Key
               - ui-core.js: toggleSidebar() speichert in nv2-user-settings
                 statt nv2-sidebar
               - ui-core.js: setTheme() speichert in nv2-user-settings
                 statt nv2-theme
               - app.js: Theme beim Start aus loadUserSettings().theme
               - index.html FOUC-Snippet: liest nv2-user-settings.theme
               Standard: Dark-Theme + Sidebar ausgeklappt + Uebersicht

[2026-03-23]   Feature: Objekt-Typen 100% – remove_ack + Linien-Aktionsmenue
               Backend:
               - core/livestatus.py: remove_host_ack() -> REMOVE_HOST_ACKNOWLEDGEMENT
               - core/livestatus.py: remove_service_ack() -> REMOVE_SVC_ACKNOWLEDGEMENT
               - api/router.py: remove_ack-Handler (Host + Service)
               - api/router.py: GET /api/v1/hosts fuer Autocomplete-Datalist
               Frontend:
               - nodes.js: openNodePropsDialog() async; befuellt Datalist aus
                 GET /api/hosts nach Dialog-Oeffnen (nicht nur WS-Cache)
               - nodes.js: showLineViewContextMenu() – neues View-Mode-Kontextmenue
                 auf einfachen Linien und Weathermap-Linien
                 Zeigt ACK / Bestätigung aufheben / Wartung / Reschedule
                 fuer host_from und host_to

[2026-03-23]   Feature: GitHub Actions – CI, Docker, MkDocs, Dependabot
               CI (.github/workflows/ci.yml):
               - pytest + Coverage auf Python 3.11 / 3.12 / 3.13
               - --cov-fail-under=70 (schlaegt fehl wenn Coverage < 70%)
               - Coverage-XML als Artifact; PR-Kommentar auf 3.13
               - Trigger: push/PR auf main wenn backend/** geaendert
               Docker (.github/workflows/docker.yml):
               - docker/build-push-action: Multi-Platform (amd64 + arm64)
               - Tags: latest / main / semver (v1.2.3 -> 1.2.3, 1.2, latest)
               - workflow_run-Trigger: laeuft nur wenn CI gruen ist
               - BuildKit-Cache via GitHub Actions Cache
               MkDocs (.github/workflows/docs.yml):
               - mkdocs gh-deploy -> gh-pages Branch
               - concurrency: pages (Cancel-in-Progress)
               - Trigger: push auf docs/** oder mkdocs.yml
               Dependabot (.github/dependabot.yml):
               - pip: wöchentlich montags 07:00 Berlin
                 Gruppen: fastapi-stack, test-tools, observability
               - github-actions: wöchentlich montags 07:00 Berlin

[2026-03-23]   Feature: API-Versionierung /api/v1/
               Backend:
               - api/router.py: prefix /api -> /api/v1
               - api/auth_router.py: prefix /api/auth -> /api/v1/auth
               - main.py: 308-Redirect /api/* -> /api/v1/* (Rueckwaertskompatibilitaet)
               Frontend:
               - ws-client.js: api() normalisiert /api/ -> /api/v1/ vor fetch()
                 Demo-Mode-Handler unveraendert (treffen nie das Backend)
               - auth.js: alle direkten fetch()-Aufrufe auf /api/v1/ aktualisiert

[2026-03-23]   Feature: Swagger immer verfuegbar (nicht mehr DEBUG-abhaengig)
               - backend/main.py: docs_url="/api/v1/docs" ohne DEBUG-Bedingung
               - frontend/index.html: Swagger-Button oeffnet /api/v1/docs
               - docs/admin-guide.md: Hinweis auf DEBUG-Pflicht entfernt
               - README.md: URL-Tabelle aktualisiert
               DEBUG=true steuert jetzt nur noch Auto-Reload

[2026-03-23]   Codebase-Statistik in README.md
               - Neue Sektion "Codebase-Statistik"
               - 101 Quelldateien / 21.798 Zeilen (ohne venv, pycache, help-Build)
               - Anteil: Python 37%, JS 33%, Markdown 11%, CSS 7%, HTML 5%

[2026-03-23]   Feature: About-Dialog im Burger-Menue
               Frontend:
               - index.html: "Ueber"-Abschnitt + "Ueber NagVis 2"-Button im
                 Burger-Menue (unterhalb Einstellungen)
               - index.html: About-Dialog (#dlg-about) mit NagVis-Logo,
                 Versionsnummer (aus /api/v1/health), Beschreibung,
                 GitHub-Link mit SVG-Icon, Changelog-Toggle-Button
               - js/ui-core.js: openAboutDlg() (async)
                 Laedt Version aus GET /api/v1/health
                 Laedt Changelog via GET /api/v1/changelog (UTF-8)
                 Setzt Toggle-State bei jedem Oeffnen zurueck
               - window.openAboutDlg exportiert
               Backend:
               - api/router.py: GET /api/v1/changelog
                 Liest changelog.txt (UTF-16) und liefert UTF-8 text/plain
                 Fallback auf changelog.md

[2026-03-23]   Feature: Label-Templates mit Nagios-Macros + Checkmk-Labels
               Backend:
               - livestatus/client.py: _parse_custom_variables()
                 konvertiert Nagios custom_variables (_OS -> os)
                 Livestatus-Query um custom_variables / host_custom_variables
                 erweitert
               - livestatus/client.py: labels-Feld in HostStatus +
                 ServiceStatus + to_dict()
               - checkmk/client.py: extensions.labels aus Checkmk REST API
                 in labels-Feld uebernommen (host_labels als Fallback)
               - api/router.py: label_template in ObjectProps (PATCH-Endpoint)
               Frontend:
               - nodes.js: resolveMacros(template, obj, status)
                 $HOSTNAME$, $HOSTALIAS$, $HOSTSTATE$, $HOSTOUTPUT$
                 $SERVICEDESC$, $SERVICESTATE$, $SERVICEOUTPUT$
                 $LABEL:key$, $MAPNAME$
               - nodes.js: _nodeLabel(obj, status) - Template hat Vorrang
                 vor statischem Label
               - nodes.js: _applyLabelTemplate(el, obj, status) -
                 aktualisiert DOM bei jedem WS-Status-Update
               - nodes.js: applyStatuses() ruft _applyLabelTemplate auf
                 wenn data-label-template gesetzt
               - nodes.js: Props-Dialog mit Template-Eingabe und
                 Macro-Referenz-Uebersicht

[2026-03-23]   Feature: Icinga2 REST API Connector
               Backend:
               - icinga2/__init__.py: neues Python-Package
               - icinga2/client.py: Icinga2Client + Icinga2Config
                 GET /v1/objects/hosts|services|hostgroups (via POST +
                 X-HTTP-Method-Override: GET); Basic Auth
                 HostStatus: available->state, vars->labels
                 ServiceStatus: state, perf_data (Liste->String)
                 Aktionen: acknowledge, remove_ack, schedule_downtime,
                 reschedule_check, ping (GET /v1)
               - connectors/registry.py: Icinga2Client in AnyClient,
                 _make_client(), _raw_from_client(), _client_info()
               Frontend:
               - map-core.js: Icinga2 REST API im Typ-Dropdown
               - map-core.js: bm-fields-icinga2 (URL, User, Passwort,
                 SSL-Checkbox; verify_ssl=false als Default)
               - map-core.js: _bmUpdateFields(), _bmBuildEntry(),
                 _bmClearForm(), _bmEditLoad() fuer icinga2 erweitert

[2026-03-23]   Feature: Zabbix JSON-RPC Connector
               Backend:
               - zabbix/__init__.py: neues Python-Package
               - zabbix/client.py: ZabbixClient + ZabbixConfig
                 JSON-RPC 2.0 via POST /api_jsonrpc.php
                 Auth: Bearer-Token (Zabbix 6.0+) oder user.login
                 host.get: available->state, maintenance_status->in_downtime
                 problem.get: severity->state, tags->labels
                 hostgroup.get: Gruppen mit Host-Mitgliedern
                 Wartung: maintenance.create (Host-Level)
                 ACK: event.acknowledge (action=6: ack+message)
                 ping: apiinfo.version (kein Auth noetig)
               - connectors/registry.py: ZabbixClient in AnyClient,
                 _make_client(), _raw_from_client(), _client_info()
               Frontend:
               - map-core.js: Zabbix JSON-RPC API im Typ-Dropdown
               - map-core.js: bm-fields-zabbix (URL, API-Token,
                 User/Passwort-Fallback, SSL-Checkbox)
               - map-core.js: _bmUpdateFields(), _bmBuildEntry(),
                 _bmClearForm(), _bmEditLoad() fuer zabbix erweitert

[2026-03-24]   Bugfix: Poll-Loop Absturz 'expected string or bytes-like object'
               - core/perfdata.py: parse_perfdata() prueft isinstance(raw, str)
                 vor re.finditer(); gibt {} zurueck wenn kein String
               - checkmk/client.py: _to_perf_str() stellt sicher dass
                 performance_data (kann Dict sein) immer als "" uebergeben wird

[2026-03-24]   Feature: Authentifizierung vollstaendig (P1)
               Backend:
               - api/auth_router.py: POST /api/v1/auth/refresh
                 erstellt neues Token fuer eingeloggten User (7 Tage)
               - api/auth_router.py: PATCH /api/v1/auth/me
                 eigenes Passwort aendern (min. 6 Zeichen, jede Rolle)
               Frontend:
               - auth.js: Bugfix - nv2AuthChangeRole / nv2AuthChangePw /
                 nv2AuthDeleteUser verwendeten /api/auth/ statt /api/v1/auth/
               - auth.js: _scheduleRefresh() / _doRefresh()
                 JWT-Ablaufdatum aus Payload lesen; 1 Tag vor Ablauf
                 automatisch via POST /api/v1/auth/refresh erneuern
               - auth.js: nv2AuthChangeOwnPw()
                 eigenes Passwort aendern via PATCH /api/v1/auth/me
               - auth.js: _applyRoleUI(role)
                 editor-Pflicht: btn-new-map, btn-import-map/-zip, btn-edit
                 admin-Pflicht: btn-delete-map, btn-backend-mgmt,
                 btn-action-config, btn-kiosk-users
               - index.html: IDs an Burger-Menu-Buttons ergaenzt
               - index.html: Burger-Menu: Passwort-aendern-Button im
                 Konto-Abschnitt (btn-change-own-pw)

[2026-03-24]   Bugfix: Logout + Auth-UI-Sichtbarkeit
               - auth.js: Logout-Button nur sichtbar wenn AUTH_ENABLED=true
                 (bei deaktivierter Auth nach Reload sofort wieder Admin ->
                 Logout waere sinnlos / verwirrend)
               - auth.js: Benutzerverwaltung + Passwort-aendern bleiben
                 auch bei AUTH_ENABLED=false sichtbar (Rolle=admin)
               - auth.js: ucd-divider-auth korrekt ein-/ausgeblendet

[2026-03-24]   Dokumentation: .env.example + admin-guide.md
               - .env.example: komplett ueberarbeitet
                 Fehlende Variablen ergaenzt: LIVESTATUS_TYPE/PATH/SITE,
                 WS_POLL_INTERVAL, LOG_FORMAT/LEVEL/LOG_BUFFER_LINES
                 AUTH_ENABLED + NAGVIS_SECRET (war faelschlich SECRET_KEY)
                 Port korrigiert: 8000 -> 8008
               - docs/admin-guide.md: neuer Abschnitt "Installation via
                 Install-Script" (Schnellstart, Optionen, Berechtigungskonzept,
                 Service-Befehle)
               - docs/admin-guide.md: neuer Abschnitt "Authentifizierung &
                 Benutzerverwaltung" (Modi, Aktivierung, Rollen, REST-API,
                 users.json-Format)
               - docs/admin-guide.md: Konfigurationstabelle um AUTH_ENABLED
                 + NAGVIS_SECRET erweitert

[2026-03-24]   Feature: install.sh - Bash-Installationsskript
               - install.sh: vollstaendiges Install-Script fuer Linux
                 Optionen: --zip, --install-dir, --user, --port,
                 --auth-enabled, --no-systemd, --no-start, --upgrade,
                 --uninstall
               Schritte: Voraussetzungen pruefen (Python 3.11+, pip, unzip)
                 System-User/Group 'nagvis2' anlegen
                 ZIP entpacken oder Quellverzeichnis direkt nutzen
                 Python venv erstellen + requirements.txt installieren
                 data/-Unterverzeichnisse anlegen
                 .env aus .env.example erstellen (NAGVIS_SECRET auto-generiert)
                 Berechtigungen: Code root:nagvis2 755/644,
                 data/ nagvis2:nagvis2 750, .env 600
               Systemd: /etc/systemd/system/nagvis2.service
                 Security-Hardening: NoNewPrivileges, PrivateTmp,
                 ProtectSystem=strict, RestrictAddressFamilies
               Upgrade: Backup data/ + .env vor Update, danach wiederherstellen
               Uninstall: Service + Dateien + User entfernen

[2026-03-24]   Feature: build.sh - Build-Skript fuer ZIP-Distribution
               - build.sh: erstellt nagvis2-<version>.zip + .sha256
                 Optionen: --version, --out, --no-docs
                 Version aus changelog.txt oder git describe
               Inkludiert: frontend/, backend/ (ohne venv/data/__pycache__),
                 docs/, helm/, scripts/, install.sh, .env.example,
                 docker-compose.yml, nginx.conf*, mkdocs.yml, README,
                 changelog*, FEATURES.md
               Baut MkDocs-Hilfe vor dem Packen (falls mkdocs vorhanden)
               ZIP-Wurzel immer nagvis2/ -> install.sh erkennt Struktur auto.

[2026-03-24]   Feature: GitHub Action - Automatische Releases
               - .github/workflows/release.yml: NEU
                 Trigger: Git-Tag v*.*.* oder manuell (workflow_dispatch)
               Job 1 (test): pytest laeuft, Release schlaegt fehl wenn rot
               Job 2 (build): MkDocs + build.sh -> ZIP als Artifact
               Job 3 (release): GitHub Release mit ZIP + SHA256 als Assets
                 Release-Notes aus changelog.md automatisch extrahiert
                 Install-Befehl direkt im Release-Body
                 Pre-Release-Flag: automatisch wenn Tag alpha/beta/rc enthaelt

[2026-03-24]   Feature: M2 Map-Duplikat
               Backend:
               - core/storage.py: clone_map(source_id, new_title)
                 Deep-Copy der Map-JSON, neue slugifizierte ID
                 (Kollisions-Vermeidung mit Zaehler-Suffix)
                 parent_map = None im Klon; Hintergrundbild wird mitkopiert
               - api/router.py: MapCloneRequest (Pydantic)
               - api/router.py: POST /api/v1/maps/{id}/clone (status 201)
                 Audit-Log-Eintrag map.clone
               Frontend:
               - map-core.js: cloneActiveMap() - prompt fuer neuen Namen,
                 Default "<Titel> - Kopie"; ruft cloneMap() auf
               - map-core.js: cloneMap(mapId, newTitle) - POST /clone,
                 loadMaps() nach Erfolg (Sidebar + Uebersicht aktualisiert)
               - index.html: Burger-Menue -> Aktive Map: "Map duplizieren"
                 (btn-clone-map) vor "Map exportieren"
               - map-core.js: Uebersicht-Kontextmenue: "Duplizieren"-Eintrag

[2026-03-24]   Feature: User-Chip als klickbarer Button mit Dropdown
               - index.html: #nv2-user-chip: <span> -> <button class=user-chip-btn>
                 in <div id=user-chip-wrap> (position:relative)
               Dropdown #user-chip-dropdown:
                 Header: Rollenicon + Username + Rolle
                 Immer: Theme-Toggle (Icon + Label synchron mit Burger-Menue)
                 Immer: Einstellungen... (oeffnet dlg-user-settings)
                 Auth-only: Passwort aendern, Benutzer verwalten (admin),
                 Abmelden (nur AUTH_ENABLED=true)
               - auth.js: _updateAuthUI() verdrahtet alle Dropdown-Elemente
               - auth.js: toggleUserChip() / closeUserChip()
                 schliesst Burger-Menue wenn Chip-Dropdown aufgeht
               - auth.js: Aussenklick schliesst Dropdown
               - ui-core.js: setTheme() aktualisiert auch ucd-theme-ico/label
               - css/styles.css: .user-chip-btn + :hover-Stil

[2026-03-24]   Feature: P2 HTTPS/TLS fuer Produktionsbetrieb
               - nginx.conf.prod: vollstaendige TLS-Produktionskonfiguration
                 HTTP -> HTTPS Redirect (301)
                 TLS 1.2 + 1.3, moderne Cipher-Suites
                 OCSP Stapling + Session-Cache
                 Security-Header: HSTS (2 Jahre + preload), CSP,
                 X-Frame-Options, X-Content-Type-Options
                 /metrics nur von 127.0.0.1 erreichbar
               - scripts/setup-tls.sh: TLS-Setup-Skript
                 Standard: selbstsigniertes RSA-4096-Zertifikat mit SAN
                 Option --certbot: Let's Encrypt via certbot (inkl. nginx-Plugin)
                 Speichert Zertifikat nach /etc/nagvis2/tls/
                 Laedt nginx nach Zertifikat-Erstellung neu
               - docs/admin-guide.md: neuer Abschnitt "HTTPS / TLS"
                 Option A selbstsigniert + Browser-Ausnahme
                 Option B Let's Encrypt / certbot
                 Firewall-Hinweise (ufw / firewall-cmd)

[2026-03-24]   Feature: P3 OMD-Hook / Systemd-Integration
               - omd/nagvis2: OMD init.d-Hook-Skript
                 Kommandos: start | stop | restart | status | version
                 Liest PORT aus $OMD_ROOT/etc/nagvis2/.env
                 PID-Datei in $OMD_ROOT/tmp/run/nagvis2.pid
                 Log nach $OMD_ROOT/var/log/nagvis2.log
               - scripts/install-omd-hook.sh: Hook-Installer
                 Patcht NAGVIS2_DIR im Hook-Skript auf aktuellen Pfad
                 Setzt Eigentuemer auf OMD-Site-User
                 Option --uninstall: entfernt Hook aus OMD-Site
               - docs/admin-guide.md: neuer Abschnitt "OMD / Checkmk-Integration"
                 Voraussetzungen, Installation, Verwendung (omd start/stop nagvis2)
                 .env-Konfiguration fuer OMD-Betrieb, Deinstallation

[2026-03-24]   Feature: Erweiterte Test-Coverage (Ziel >= 70%)
               - tests/test_api_maps.py: 27 neue Tests
                 TestCloneMapApi (6): clone 201, Kollision, Objekte, parent_map=None
                 TestThumbnailApi (5): Upload PNG/JPEG, invalid type, 404, Delete
                 TestChangelogEndpoint (1): GET /api/changelog
                 TestMiscEndpoints (15): hosts, hostgroups, logs, kiosk CRUD,
                 backends, parent/canvas 404
               - tests/test_storage.py: TestCloneMap (6)
                 clone_map: neuer Map, Deep-Copy, parent_map=None,
                 nonexistent=None, Kollision, Persistenz
               - tests/test_auth_router.py: NEU (22 Tests)
                 AuthConfig, Login (valid/wrong pw/unknown),
                 Me GET/PATCH (short pw -> 400), Refresh, Logout (Token revoke),
                 UserCrud: list, create (dup 409, empty 400), patch role/pw,
                 delete (self 400, ghost 404), admin-only check
               Gesamt: 137 -> 192 Tests
               Erwartete Coverage: >= 70%

[2026-03-24]   Bugfix: GitHub Actions - Node 20 Deprecation
               - .github/workflows/ci.yml: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24
                 entfernt (Node 24 ist jetzt Standard; Flag war temporaerer Opt-in)
               - .github/workflows/docker.yml: ebenso
               - .github/workflows/docs.yml: ebenso
               - .github/workflows/release.yml: ebenso

[2026-03-24]   Dokumentation: README.md + FEATURES.md aktualisiert
               README.md:
               - CI / Release / Changelog-Badges hinzugefuegt
               - Features-Tabelle: Map-Duplikat, Auth, User-Chip, Install-Script
               - Schnellstart: install.sh als primaere Option
               - .env-Sektion: AUTH_ENABLED + NAGVIS_SECRET
               - Ordnerstruktur: install.sh, build.sh, auth.js, auth_router.py,
                 users.json, kiosk_users.json
               - Links-Sektion: Release, changelog.txt/md, admin-guide, FEATURES.md
               FEATURES.md:
               - M2 als erledigt markiert (durchgestrichen)
               - Neue Sektionen: Map-Duplikat, User-Chip, Distribution & Betrieb
               - P2 + P3 in Geplant-Tabelle als erledigt markiert
               - Fortschritts-Balken: Monitoring/Betrieb 100%, Backend API 100%

[2026-03-24]   Feature: backend_id pro Node (Datenquelle explizit waehlbar)
               Problem: gleicher Hostname (z.B. server01) existiert in Checkmk,
                 Zabbix, Icinga2 und mehreren Checkmk-Instanzen gleichzeitig;
                 bisher wurde immer der erste Treffer verwendet.
               Backend:
               - connectors/registry.py: get_all_hosts_tagged() +
                 get_all_services_tagged() - liefern alle Eintraege aller
                 Backends mit _backend_id-Feld (keine Deduplizierung)
               - ws/manager.py: nutzt *_tagged()-Methoden; Diff-Keys sind
                 jetzt "backend_id::name" statt "name"; Demo-Modus
                 erhaelt _backend_id: "demo"
               - api/router.py: backend_id: Optional[str] in ObjectCreate
                 und ObjectProps (wird persistiert und zurueckgeliefert)
               Frontend:
               - state.js: window.backendStatusCache = {} (backend_id ->
                 {cacheKey: statusDict}); window.backendList = []
               - nodes.js: _resolveStatus(backendId, cacheKey) - sucht
                 zuerst in backendStatusCache[backendId], Fallback hostCache
               - nodes.js: _renderMonitoringNode() setzt
                 el.dataset.backendId = obj.backend_id || ''
               - nodes.js: applyStatuses() befuellt backendStatusCache;
                 filtert DOM-Updates nach backendId; speichert Perfdata unter
                 "backend_id\x1ehost::service" (ASCII-RS als Trenner)
               - nodes.js: _applyHostgroupStatuses() + _applyGadgetPerfdata()
                 nutzen _resolveStatus() bzw. backend-spezifische Perfdata-Keys
               - nodes.js: openNodePropsDialog() - neues <select id="np-backend-id">
                 (beliebig / konfigurierte Backends); befuellt via GET /api/backends;
                 pre-selektiert obj.backend_id; patch enthaelt backend_id;
                 el.dataset.backendId nach Speichern aktualisiert
               - nodes.js: openGadgetConfigDialog() - analoges Dropdown
                 fuer Gadgets (Host/Service-Datenquelle)
               - gadget-renderer.js: createGadget() setzt
                 el.dataset.backendId = obj.backend_id || ''
               Rueckwaertskompatibilitaet: Nodes ohne backend_id nutzen
                 hostCache wie bisher (kein Breaking Change)

[2026-03-24]   Feature: Browser-Benachrichtigungen + Hinweiston bei CRITICAL (N4)
               Frontend:
               - ws-client.js: _checkCriticalNotify(hosts, services)
                 Wird nach jedem status_update-Event aufgerufen
                 Filtert hosts mit DOWN/CRITICAL/UNREACHABLE und
                 services mit CRITICAL
                 Debounce: max. 1 Benachrichtigung alle 15 Sekunden
               - ws-client.js: _playCriticalSound()
                 Web Audio API (Square-Wave Oscillator, 880->440 Hz, 0.45 s)
                 Kein externer Asset erforderlich (in-memory generiert)
               - ws-client.js: Notification API
                 tag='nagvis2-critical' (ersetzt vorherige Benachrichtigung)
                 renotify=true (Ton auch bei Ersatz-Notification)
               - ui-core.js: defaultUserSettings() um notifyOnCritical:false
                 und notifySound:true erweitert
               - ui-core.js: saveUserSettings() liest us-notify-critical +
                 us-notify-sound; fordert Berechtigung an wenn gerade aktiviert
               - ui-core.js: openUserSettingsDlg() setzt Checkboxen +
                 ruft _updateNotifyStatus() auf
               - ui-core.js: _updateNotifyStatus() zeigt Berechtigung-Status
                 (erteilt / verweigert / ausstehend) mit Farbcodierung
               - ui-core.js: _requestNotifyPermission() - Berechtigung manuell
                 anfordern via Notification.requestPermission()
               - index.html: dlg-user-settings - neue Sektion "Benachrichtigungen"
                 Checkbox "Bei CRITICAL/DOWN Browser-Benachrichtigung anzeigen"
                 Checkbox "Hinweiston abspielen"
                 Button "Berechtigung erteilen" + Statusanzeige
               Einstellungen persistiert in nv2-user-settings (localStorage)

[2026-03-24]   Dokumentation: admin-guide.md um Zabbix + Icinga2 erweitert
               - docs/admin-guide.md: Voraussetzungen-Tabelle um Zabbix + Icinga2
               - Tabelle "Unterstuetzte Backend-Typen" um Zabbix + Icinga2 ergaenzt
               - Neue Unterabschnitte: Checkmk REST API, Zabbix, Icinga2
                 (je: Parameter-Tabelle, Einrichtung, Konzept-Mapping)
               - Icinga2: vollstaendige ApiUser-Konfiguration mit Permissions
               - Zabbix: Schweregrad-Mapping (Priority -> WARNING/CRITICAL)
               - Verzeichnisstruktur: zabbix/ und icinga2/ ergaenzt
               - todo-liste.md: bereinigt (erledigte Items als [x] markiert)
                 Neue Eintraege: DRAW.io-Import, BI-Visualisierung

[2026-03-24]   Refactor: Projektverzeichnis von beta/nagvis2 nach nagvis2 verschoben
               - Verzeichnis beta/nagvis2 -> nagvis2 (eine Ebene hoeher)
               - .github/workflows/ci.yml: alle Pfade aktualisiert
               - .github/workflows/docker.yml: context + file Pfade aktualisiert
               - .github/workflows/docs.yml: path-trigger + working-directory aktualisiert
               - .github/workflows/release.yml: alle 7 Pfadvorkommen aktualisiert
               - .github/dependabot.yml: pip directory aktualisiert
               - scripts/make_changelog.py: Input-/Output-Pfade aktualisiert

[2026-03-24]   Feature: F5 Prometheus & VictoriaMetrics Connector
               - backend/prometheus/client.py: Async HTTP-Client fuer Prometheus HTTP API v1
               - Hosts aus up-Metrik abgeleitet (host_label konfigurierbar, Standard: instance)
               - Services aus firing/pending Alerts (GET /api/v1/alerts)
               - Hostgruppen aus job-Label
               - Severity-Mapping: critical/page/error -> CRITICAL, warning/warn/info -> WARNING
               - Auth: Bearer Token + Basic Auth (beide optional)
               - ping() via /api/v1/status/buildinfo (kein Auth noetig)
               - VictoriaMetrics: identische API, volle Kompatibilitaet
               - connectors/registry.py: PrometheusClient eingebunden (5 neue Stellen)
               - frontend/js/map-core.js: Prometheus-Option + Felder im Backend-Dialog
               - Aktionen (ACK, Downtime) geben False zurueck (Prometheus ist read-only)

[2026-03-24]   Dokumentation: dev-guide.md erstellt
               - docs/dev-guide.md: Vollstaendiges Entwickler-Handbuch
               - Stack & Abhaengigkeiten, lokales Setup, Projektstruktur
               - Backend-Architektur (Request-Flow, WebSocket-Flow, Konfiguration)
               - Frontend-Architektur (Ladereihenfolge, Globale Variablen, api()-Wrapper)
               - Schritt-fuer-Schritt: Neuen Connector / API-Endpoint / Dialog hinzufuegen
               - Tests (pytest, Vitest, Playwright), Code-Konventionen, Release-Prozess
               - mkdocs.yml: dev-guide.md in Navigation eingetragen

[2026-03-24]   Feature: F7 draw.io / diagrams.net Import
               - backend/api/router.py: POST /api/maps/import-drawio Endpoint
               - XML-Parser (ElementTree): Unterstuetzt .drawio und .xml-Format
               - Komprimierter Inhalt wird automatisch dekodiert (URL-Decode + Base64 + raw-deflate)
               - Vertices → Textboxen (Standard) oder Monitoring-Hosts (Checkbox)
               - Edges / Verbindungen → NagVis-Linien mit Quell-/Zielkoordinaten
               - Bounding-Box-Normalisierung: absolute Pixel → 5-95 % Map-Koordinaten
               - Audit-Log-Eintrag bei jedem Import
               - frontend/index.html: Burger-Menue-Eintrag + dlg-drawio-import Dialog
               - map-core.js: dlgImportDrawio(), _drawioHandleFile(), confirmImportDrawio()
               - Drag & Drop + Datei-Picker; Validierung: nur .drawio und .xml

[2026-03-24]   Feature: F3 Custom Graph Gadget – Grafana & Checkmk Panels einbetten
               - gadget-renderer.js: neuer Gadget-Typ 'graph' (_graph()-Renderer)
               - Einbettung via <iframe> (Standard) oder <img> (fuer PNG-Render-APIs)
               - Konfigurierbare Breite/Hoehe in Pixeln (unabhaengig vom Scale-Faktor)
               - Auto-Refresh: konfigurierbares Intervall in Sekunden (Standard: aus)
               - nodes.js: Gadget-Konfig-Dialog um '📊 Graph / Iframe'-Chip erweitert
               - Dynamische Sichtbarkeit: Datenquellen-/Minmax-Felder verschwinden fuer Graph-Typ
               - Vorschau im Dialog zeigt Leer-Platzhalter oder Live-iframe/img
               - _gcSave() speichert url, embed, width, height, refresh in gadget_config
               - Demo-Map: Grafana-Play-Beispiel-Gadget hinzugefuegt
               - Test-Coverage: Tests fuer prometheus/client.py hinzugefuegt (>= 70%)
               - Python 3.9-Kompatibilitaet: from __future__ import annotations in 10 Dateien

[2026-03-25]   Feature: Demo-Maps & Live-Demo auf Render
               - Live-Demo-URL in README.md eingebaut (nagvis-kurz-vor-2.onrender.com)
               - Zwei neue Demo-Maps: demo-europe (OSM, 10 Hosts in Europa) + demo-appstack (NagVis2-Stack)
               - demo-features.json: Map-Links, Keyboard-Shortcuts-Textbox, neue Gadgets (Linear V, Graph img)
               - seed_maps/-Mechanismus: Demo-Maps werden beim Start immer in data/maps/ kopiert
               - seed_maps/ liegt ausserhalb des Docker-Volumes, sichert Maps bei jedem Deploy
               - main.py: _seed_maps() ueberschreibt demo-* Maps immer (kein 'nur wenn fehlend')
               - ws/demo_data.py: DEMO_STATUS um Europa- und App-Stack-Hosts erweitert
               - statistik.md: Projektkalkulation (Zeit, Kosten, KI-Hebel)

[2026-03-25]   Bugfix: Sidebar beim ersten Start nicht aufgeklappt
               - map-core.js openMap(): pruefte sidebarCollapsed nicht, setzte immer 44px-Breite
               - Fix: gridTemplateColumns und sidebar-expanded-Klasse abhaengig von sidebarCollapsed

[2026-03-25]   Bugfix: Demo-Modus blockierte echte API-Aufrufe trotz laufendem Backend
               - ws-client.js fing /api/maps GET im Demo-Modus ab und gab hardcodierte JS-Daten zurueck
               - Folge: demo-europe und demo-appstack erschienen nie in der Seitenleiste auf Render
               - Fix: _backendReachable-Flag; wenn Backend erreichbar, werden Map-Calls ans echte Backend weitergeleitet
               - Fallback-Daten bleiben fuer rein statisches Frontend ohne Backend (nagvis2-frontend.onrender.com)

[2026-04-14]   Bugfix: "Im Monitoring oeffnen" -- falsche URLs fuer Host, Hostgroup, Servicegroup
               - Host-Link verwendete faelschlich index.py?start_url=...-Wrapper
               - Korrekt: view.py?host={name}&site={site}&view_name=host
               - Hostgroup:    view.py?hostgroup={name}&site={site}&view_name=hostgroup
               - Servicegroup: view.py?servicegroup={name}&site={site}&view_name=servicegroup
               - js/nodes.js: _buildMonitoringUrl komplett ueberarbeitet (switch ueber obj.type)
               - Gleiche URL-Muster im Checkmk- und globalen Fallback-Pfad

[2026-04-14]   Feature: Live-Perfdata in Tooltips (Gadgets + Service-Objekte)
               - Gadgets: Mouseover zeigt Live-Wert aus perfdataCache, alle Metriken, Service-Status
               - Service-Objekte: Perfdata-Metriken mit Warn/Crit-Farben; aktive Metrik fett
               - js/nodes.js: showTooltip komplett ueberarbeitet

[2026-04-14]   Feature: Service-Objekte mit Perfdata-Metrik (perf_label)
               - Service-Objekte koennen eine Perfdata-Metrik konfigurieren
               - Live-Wert erscheint im Node-Label: "Label: 1.234ms"
               - Autocomplete fuer Service-Name und Metrik-Name + aktuellen Wert
               - $PERFVALUE$-Macro in Label-Templates
               - backend/api/router.py: ObjectProps um perf_label erweitert

[2026-04-14]   Feature: Eigenschaften-Dialog im View-Mode (Editor/Admin)
               - Rechtsklick-Kontextmenue zeigt "Eigenschaften" fuer Rolle editor/admin

[2026-04-14]   Feature: "Im Monitoring oeffnen" -- automatische URL pro Backend (Checkmk)
               - Immer sichtbar (war: nur wenn monitoring_url konfiguriert)
               - Checkmk: URL automatisch aus API-Base-URL abgeleitet (kein manuelles Konfigurieren)
               - js/nodes.js: neue Funktion _buildMonitoringUrl(obj, h)

[2026-04-14]   Feature: Probleme-Panel zeigt Host- UND Service-Probleme
               - Bisher: nur Hosts; jetzt: auch Services als "hostname / service_description"
               - js/ui-core.js: renderProblemsPanel erkennt h.type === 'service'
               - js/ws-client.js: snapshot + status_update uebergeben alle Cache-Eintraege

[2026-04-14]   Feature: Makros im Label-Feld ($HOSTALIAS$, $HOSTSTATE$, etc.)
               - Macros funktionieren jetzt auch im Label-Feld (nicht nur im Label-Template-Feld)
               - js/nodes.js: _nodeLabel, _applyLabelTemplate, applyStatuses erweitert

[2026-04-14]   Bugfix: + Schaltflaeche in Uebersichtskarte oeffnete keine neue Map
               - Ursache: doppelte id="btn-new-map" (Burger-Menue + Uebersichtskarte)
               - Fix: Uebersichtskarte verwendet id="ov-btn-new-map"

[2026-04-14]   Bugfix: Service-Dropdown leer beim Platzieren
               - serviceCache war nicht ans Platzierungs-Formular gebunden
               - js/map-core.js: input-Listener fuer dlg-svc-host und dlg-svc-name ergaenzt

[2026-04-14]   Bugfix: Gadget-Werte nicht angezeigt (Checkmk Perfdata als Liste)
               - Checkmk REST API liefert performance_data teils als Array
               - backend/checkmk/client.py: _to_perf_str verbindet Array-Elemente mit Leerzeichen
               - alias = ext.get("alias") or name (leerer Alias-String als Fallback)

[2026-04-14]   Bugfix: Service-Anzahl im Host-Tooltip immer 0
               - Checkmk REST API liefert num_services_* in Hosts-Collection nicht
               - js/nodes.js: showTooltip zaehlt live aus hostCache; Fallback auf Backend-Daten

[2026-04-14]   Bugfix: "undefined" in Hosts- und Probleme-Panel nach Status-Update
               - Object.values(hostCache) enthaelt Host- und Service-Eintraege
               - Services haben kein name-Feld -> "undefined" in der Liste
               - js/ws-client.js: Panels filtern getrennt nach type === 'host'

[2026-04-14]   Bugfix: Kontextmenue-Aktionen (ACK, DT, ...) erschienen nicht
               - h war null durch direkten hostCache-Lookup statt _resolveStatus
               - _actionConfig.enabled aus altem localStorage fehlten neue Standard-IDs
               - js/nodes.js: showViewContextMenu + _actionConfig-Migration

[2026-04-14]   Bugfix: backend_id vs. _backend_id in Status-Cache
               - applyStatuses befuellte backendStatusCache nie (falscher Feldname)
               - js/nodes.js: h.backend_id || h._backend_id

[2026-04-16]   Bugfix: Lasso-Selektion wurde durch nachfolgenden Click-Event geleert
               - Browser feuert click nach mouseup; click-Handler loeschte Selektion
               - Fix: window._nv2LassoDone-Flag in onUp gesetzt; onCanvasClick prueft und loescht Flag
               - js/nodes.js: onUp, onCanvasClick

[2026-04-16]   Bugfix: "Im Monitoring oeffnen" aus Snap-Tabs nicht funktionsfaehig
               - _openInMonitoringOrFocus fand kein Backend (Livestatus hat kein http://-Praeffix)
               - Fix: 5-stufige Backend-Suche (backend_id+checkmk, backend_id+web_url, checkmk, web_url, http)
               - js/ui-core.js: _openInMonitoringOrFocus

[2026-04-16]   Feature: web_url-Feld fuer Livestatus-Backends
               - Livestatus TCP/Unix koennen optional eine Checkmk-Web-URL konfigurieren
               - Wird fuer "Im Monitoring oeffnen" und Topbar-Pills genutzt
               - Backend: LivestatusConfig.web_url, BackendCreate.web_url, connectors/registry.py
               - Frontend: map-core.js: bm-ls-web-url Feld im Backend-Dialog

[2026-04-16]   Bugfix: web_url wurde nicht gespeichert (BackendCreate-Modell unvollstaendig)
               - BackendCreate deklarierte web_url nicht -> model_dump() verwarf es stillschweigend
               - Fix: web_url: Optional[str] = None in BackendCreate ergaenzt
               - backend/api/router.py: BackendCreate

[2026-04-16]   Feature: Topbar-Pills klickbar -- oeffnet Checkmk Problems-Dashboard
               - Klick auf tb-pill-Elemente oeffnet Checkmk Problems-Dashboard
               - URL-Aufbau: {web_url}/index.py?start_url=.../dashboard.py?name=problems&owner=
               - js/ui-core.js: openMonitoringDashboard(), _monitoringSiteBase()
               - css/styles.css: .pill cursor:pointer + hover-Effekt

[2026-04-16]   Feature: CLAUDE.md Entwicklerdokumentation
               - Befehle, Backend-/Frontend-Architektur, Test-Details fuer Claude Code
               - nagvis2/CLAUDE.md

[2026-04-16]   Bugfix: GitHub Pages Pipeline (static.yml) schlug fehl
               - docs.yml (mkdocs gh-deploy) konkurrierte mit static.yml um Concurrency-Gruppe
               - Fix: docs.yml auf workflow_dispatch umgestellt; MkDocs-Build in static.yml integriert
               - changelog.md wird vor Build nach docs/ und frontend/ kopiert
               - .github/workflows/static.yml, .github/workflows/docs.yml

[2026-04-16]   Bugfix: CI Vitest-Test -- SyntaxError: Unexpected identifier 'globalThis'
               - nodes.js war ueber Zeile 51 hinausgewachsen; slice(0,51) schnitt Template-Literal
               - Fix: dynamisches findIndex nach erstem }-Zeichen auf Spalte 0 nach Zeile 30
               - frontend/tests/unit/setup.js

[2026-04-16]   Bugfix: Auto-Map Abstaende zu gross; Grid nicht zentriert nach Erstellung
               - Kreis/Stern-Radius-Formel: r = max(STEP*3, n*STEP) statt STEP*n*1.5
               - _centerAutoMap(): berechnet Bounding-Box aller Nodes, zentriert Canvas
               - js/map-core.js: _centerAutoMap(), setTimeout nach openMap()
               - backend/api/router.py: Radius-Formel angepasst

[2026-04-16]   Feature: Auto-Map Layouts Kreis und Stern entfernt
               - Nur noch Grid und Hierarchie verfuegbar (Kreis/Stern waren instabil)
               - backend/api/router.py: _circle(), _star() entfernt; AutoMapRequest.layout aktualisiert
               - frontend/index.html: Optionen aus #nm-am-layout-Select entfernt

[2026-04-16]   Bugfix: Backend-Liste nicht aktualisiert nach Datasource-Aenderung
               - window.backendList wurde nur beim App-Start geladen (kein Refresh nach Aenderung)
               - Fix: nach POST/PATCH Backend sofortiger Refresh aus /api/backends
               - js/map-core.js: _bmAdd()

[2026-04-16]   Bugfix: Changelog im About-Dialog konnte nicht geladen werden (Docker)
               - changelog.txt/md befanden sich nicht im Docker-Container (/app fehlt Volumes)
               - Fix: Volume-Mounts fuer changelog.* in docker-compose.yml
               - Fallback-Fetch auf /changelog.md wenn /api/v1/changelog nicht erreichbar
               - docker-compose.yml, js/ui-core.js

[2026-04-16]   Feature: Auto-Layout (F4) -- Grid-Sortierung nach Objektgroesse
               - F4-Button sortiert selektierte (oder alle) Nodes automatisch im Raster
               - Sortierung nach Pixel-Flaeche (groesste Objekte links oben)
               - Spaltenanzahl: round(sqrt(n)); Zellengroesse: Nodegroesse + 8px Abstand
               - Ohne Selektion: Zentriert auf Canvas-Mitte (50%/50%)
               - Mit Teilselektion: Zentriert auf Schwerpunkt der aktuellen Positionen
               - Align-Toolbar: immer sichtbar im Edit-Mode (nicht nur bei >= 2 Nodes)
               - js/align.js, frontend/index.html

[2026-04-16]   Feature: Zonen-Objekt (Rechteck) als Hintergrund-Layer
               - Neuer Objekt-Typ "zone" -- farbiges Rechteck hinter allen anderen Objekten
               - Konfigurierbar: Beschriftung, Hintergrundfarbe (RGBA), Rahmenfarbe, Rahmenbreite
               - Im Edit-Mode verschiebbar (Drag) und groessenveraenderbar (Resize-Handle)
               - Z-Index: 1 (hinter .nv2-node, .nv2-textbox, .nv2-container bei z-index 10)
               - DOM-Einfuerung immer vor dem ersten Nicht-Zonen-Element (visuelle Layering)
               - Lasso-Selektion, Ctrl+A, Kontextmenue, Undo/Redo unterstuetzt
               - js/nodes.js, js/map-core.js, css/styles.css, frontend/index.html, backend/api/router.py
"""

# ══════════════════════════════════════════════════════════════════════════════
#  MARKDOWN-INHALT
# ══════════════════════════════════════════════════════════════════════════════
MD = """\
# NagVis 2 – Changelog

---

## [2026-03-25]

### Feature: Demo-Maps & Live-Demo auf Render

**Demo-Maps**
- Zwei neue Demo-Maps: `demo-europe` (OSM-Karte, 10 Hosts in Europa) und `demo-appstack` (NagVis2-Applikationsstack)
- `demo-features.json`: Map-Links zu den neuen Maps, Keyboard-Shortcuts-Textbox, neue Gadgets (Linear vertikal, Graph-img-Embed, Container, Zone-B-Label)
- `ws/demo_data.py`: `DEMO_STATUS` um 10 Europa-Hosts (Madrid=DOWN, Wien=DT) und App-Stack-Hosts mit Perfdata erweitert
- `statistik.md`: Projektkalkulation mit Zeit-, Kosten- und KI-Hebelschätzung erstellt

**Seed-Mechanismus**
- `backend/seed_maps/`: neues Verzeichnis außerhalb des Docker-Volumes mit allen Demo-Maps
- `main.py`: `_seed_maps()` kopiert beim Start fehlende Maps und überschreibt `demo-*` Maps immer
- Stellt sicher, dass neue Demo-Maps nach jedem Render-Deploy / `docker compose up --build` erscheinen

**Live-Demo**
- Live-Demo-URL in `README.md` eingebaut: `https://nagvis-kurz-vor-2.onrender.com`

### Bugfix: Sidebar beim ersten Start nicht aufgeklappt

- `map-core.js` `openMap()`: setzte `gridTemplateColumns` immer auf `44px 1fr`, ignorierte `sidebarCollapsed`
- Fix: Breite und `sidebar-expanded`-Klasse werden jetzt korrekt nach User-Präferenz gesetzt

### Bugfix: Demo-Modus blockierte echte API-Aufrufe trotz laufendem Backend

- `ws-client.js`: im Demo-Modus wurden `/api/maps`-Calls abgefangen und hardcodierte JS-Daten zurückgegeben
- Folge: `demo-europe` und `demo-appstack` erschienen nie in der Seitenleiste auf `nagvis-kurz-vor-2.onrender.com`
- Fix: `_backendReachable`-Flag — wenn Backend erreichbar, werden Map-Calls ans echte Backend weitergeleitet
- Fallback-Daten bleiben für rein statisches Frontend ohne Backend (`nagvis2-frontend.onrender.com`)

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

### Feature: Layer-System vervollständigt ✅
- `js/nodes.js`: Layer-Panel mit Drag-Handle (`⠿`) vor jeder Zeile
- Drag-to-Reorder: Layer per Drag & Drop umsortieren; zIndex neu vergeben (10, 20, 30, …) und sofort angewendet
- Löschen-Button (`✕`, erscheint beim Hover): Layer entfernen; Objekte werden auf Layer 0 verschoben (Bestätigung wenn belegt)
- Layer-Liste wird nach zIndex sortiert dargestellt
- `css/styles.css`: `.layer-drag-handle`, `.layer-del-btn`, `.layer-dragging`, `.layer-drag-over`

### Feature: Sidebar + Übersicht Map-Hierarchie ✅
- `js/map-core.js`: `_sortMapsHierarchically()` — Root-Maps oben, Kind-Maps direkt darunter (`_depth=1`)
- `renderSidebarMaps()`: Kind-Maps mit `.map-entry-child` + `↳`-Pfeil eingerückt
- `renderOverview()`: gleiche Sortierung; Kind-Karten `.ov-card-child` (linker Akzentbalken); Eltern-Titel statt ID
- `css/styles.css`: `.map-entry-child`, `.map-entry-indent`, `.ov-card-child`

### Feature: Topbar-Navigation (Eltern-/Kind-Links) ✅
- `index.html`: `<div id="tb-nav" class="tb-nav">` zwischen `tb-ident` und `tb-pills`
- `js/map-core.js`: `_renderTopbarNav(mapId, parentMapId)`
  - Kind-Map: zeigt `↑ Eltern-Map-Titel`-Button
  - Root-Map: zeigt Kind-Map-Chips (`↳ Titel`)
- `showOverview()`: leert `#tb-nav`
- `css/styles.css`: `.tb-nav`, `.tb-nav-up`, `.tb-nav-child`

### Bugfix: Standard-Defaults konsolidiert ✅
- `js/ui-core.js`: `restoreSidebar()` liest `loadUserSettings().sidebarDefault` (Standard: `'expanded'`)
- `js/ui-core.js`: `toggleSidebar()` speichert in `nv2-user-settings` statt `nv2-sidebar`
- `js/ui-core.js`: `setTheme()` speichert in `nv2-user-settings` statt `nv2-theme`
- `js/app.js`: Theme beim Start aus `loadUserSettings().theme` (Standard: `'dark'`)
- `index.html` FOUC-Snippet: liest `nv2-user-settings.theme`
- Erstbesuch / Inkognito → immer: **Dark-Theme + Sidebar ausgeklappt + Übersicht**

### Feature: Objekt-Typen 100 % ✅ – remove_ack + Linien-Aktionsmenü

**Backend**
- `core/livestatus.py`: `remove_host_ack()` → `REMOVE_HOST_ACKNOWLEDGEMENT`
- `core/livestatus.py`: `remove_service_ack()` → `REMOVE_SVC_ACKNOWLEDGEMENT`
- `api/router.py`: `remove_ack`-Handler (Host + Service)
- `api/router.py`: `GET /api/v1/hosts` — vollständige Host-Liste für Autocomplete

**Frontend**
- `js/nodes.js`: `openNodePropsDialog()` async — befüllt Datalist nach Dialog-Öffnen aus `GET /api/hosts` (nicht mehr nur WS-Cache)
- `js/nodes.js`: `showLineViewContextMenu()` — View-Mode-Kontextmenü auf einfachen Linien und Weathermap-Linien; zeigt ACK / Bestätigung aufheben / Wartung / Reschedule für `host_from` und `host_to`

### Feature: GitHub Actions – CI, Docker, MkDocs, Dependabot ✅

**CI** (`.github/workflows/ci.yml`)
- pytest + Coverage auf Python 3.11 / 3.12 / 3.13; `--cov-fail-under=70`
- Coverage-XML als Artifact; PR-Kommentar (nur 3.13)
- Trigger: push/PR auf `main` wenn `backend/**` geändert

**Docker** (`.github/workflows/docker.yml`)
- Multi-Platform Build (`linux/amd64` + `linux/arm64`); Push zu Docker Hub
- Tags: `latest` / `main` / SemVer (`v1.2.3` → `1.2.3`, `1.2`, `latest`)
- `workflow_run`-Trigger: läuft nur wenn CI grün ist
- BuildKit-Cache via GitHub Actions Cache

**MkDocs → GitHub Pages** (`.github/workflows/docs.yml`)
- `mkdocs gh-deploy` → `gh-pages` Branch; `concurrency: pages`
- Trigger: push auf `docs/**` oder `mkdocs.yml`

**Dependabot** (`.github/dependabot.yml`)
- `pip`: wöchentlich montags 07:00 Berlin; Gruppen `fastapi-stack`, `test-tools`, `observability`
- `github-actions`: wöchentlich montags 07:00 Berlin

### Feature: API-Versionierung `/api/v1/` ✅

**Backend**
- `api/router.py`: `prefix="/api"` → `"/api/v1"`
- `api/auth_router.py`: `prefix="/api/auth"` → `"/api/v1/auth"`
- `main.py`: `308 Permanent Redirect` `/api/*` → `/api/v1/*` für Rückwärtskompatibilität

**Frontend**
- `js/ws-client.js`: `api()` normalisiert `/api/` → `/api/v1/` vor `fetch()` — Demo-Mode-Handler unverändert
- `js/auth.js`: alle direkten `fetch()`-Aufrufe auf `/api/v1/` aktualisiert (8 Stellen)

### Feature: Swagger immer verfügbar ✅
- `backend/main.py`: `docs_url="/api/v1/docs"` — keine `DEBUG`-Bedingung mehr
- `frontend/index.html`: Swagger-Button öffnet `/api/v1/docs`
- `docs/admin-guide.md`: Hinweis auf `DEBUG=true`-Pflicht entfernt, URL aktualisiert
- `README.md`: URL-Tabelle aktualisiert
- `DEBUG=true` steuert jetzt nur noch Auto-Reload

### Codebase-Statistik in README.md
- Neue Sektion „Codebase-Statistik": 101 Quelldateien / 21 798 Zeilen
- Anteil: Python 37 %, JavaScript 33 %, Markdown 11 %, CSS 7 %, HTML 5 %
- Basis: ohne `venv/`, `__pycache__/`, `frontend/help/` (Build-Output)

### Feature: About-Dialog im Burger-Menü ✅

**Frontend**
- `index.html`: „Über"-Abschnitt + „Über NagVis 2"-Button im Burger-Menü (unterhalb Einstellungen)
- `index.html`: About-Dialog (`#dlg-about`) mit NagVis-Logo (⬡), Versionsnummer (aus `GET /api/v1/health`),
  Beschreibung, GitHub-Link mit SVG-Icon, Changelog-Toggle-Button
- `js/ui-core.js`: `openAboutDlg()` (async)
  - Lädt Version aus `GET /api/v1/health`
  - Lädt Changelog via `GET /api/v1/changelog` (UTF-8, kein ArrayBuffer-Trick mehr)
  - Setzt Toggle-State bei jedem Öffnen zurück
- `window.openAboutDlg` exportiert

**Backend**
- `api/router.py`: `GET /api/v1/changelog` — liest `changelog.txt` (UTF-16) und gibt `text/plain; charset=utf-8` zurück; Fallback auf `changelog.md`

### Feature: Label-Templates mit Nagios-Macros + Checkmk-Labels ✅

**Backend**
- `livestatus/client.py`: `_parse_custom_variables()` — konvertiert Nagios Custom-Variables (`_OS` → `os`);
  Livestatus-Query um `custom_variables` / `host_custom_variables` erweitert
- `livestatus/client.py`: `labels`-Feld in `HostStatus` + `ServiceStatus` + `to_dict()`
- `checkmk/client.py`: `extensions.labels` aus Checkmk REST API übernommen (`host_labels` als Fallback)
- `api/router.py`: `label_template: Optional[str]` in `ObjectProps` (PATCH-Endpoint)

**Frontend**
- `js/nodes.js`: `resolveMacros(template, obj, status)` — löst auf:
  `$HOSTNAME$`, `$HOSTALIAS$`, `$HOSTSTATE$`, `$HOSTOUTPUT$`,
  `$SERVICEDESC$`, `$SERVICESTATE$`, `$SERVICEOUTPUT$`,
  `$LABEL:key$` (Checkmk-Labels / Custom-Variables), `$MAPNAME$`
- `js/nodes.js`: `_nodeLabel(obj, status)` — Template hat Vorrang vor statischem Label
- `js/nodes.js`: `_applyLabelTemplate(el, obj, status)` — aktualisiert DOM bei jedem WS-Status-Update
- `js/nodes.js`: `applyStatuses()` — ruft `_applyLabelTemplate` auf wenn `data-label-template` gesetzt
- `js/nodes.js`: Props-Dialog mit Template-Eingabefeld und Macro-Referenz-Übersicht

### Feature: Icinga2 REST API Connector ✅

**Backend**
- `icinga2/__init__.py`: neues Python-Package
- `icinga2/client.py`: `Icinga2Client` + `Icinga2Config`
  - `GET /v1/objects/hosts|services|hostgroups` (via `POST` + `X-HTTP-Method-Override: GET`)
  - Basic Auth; `verify_ssl=False` als Default (selbstsignierte Zertifikate)
  - `HostStatus`: `available` → state, `vars.*` → labels
  - `ServiceStatus`: state, `perf_data` (Liste → String), labels
  - Aktionen: `acknowledge_host/service`, `remove_host/service_ack`,
    `schedule_host/service_downtime`, `reschedule_check`, `ping`
- `connectors/registry.py`: `Icinga2Client` in `AnyClient`, `_make_client()`,
  `_raw_from_client()`, `_client_info()`

**Frontend**
- `map-core.js`: „Icinga2 REST API" im Typ-Dropdown
- `map-core.js`: `bm-fields-icinga2` (URL, Benutzer, Passwort, SSL-Checkbox)
- `map-core.js`: `_bmUpdateFields()`, `_bmBuildEntry()`, `_bmClearForm()`, `_bmEditLoad()` erweitert

### Feature: Zabbix JSON-RPC Connector ✅

**Backend**
- `zabbix/__init__.py`: neues Python-Package
- `zabbix/client.py`: `ZabbixClient` + `ZabbixConfig`
  - JSON-RPC 2.0 via `POST /api_jsonrpc.php`
  - Auth: Bearer-Token (Zabbix 6.0+) oder `user.login` (Fallback)
  - `host.get`: `available` → state, `maintenance_status` → in_downtime, Tags → labels
  - `problem.get`: `severity` → state (0–2=WARNING, 3–5=CRITICAL), Tags → labels
  - `hostgroup.get`: Gruppen mit Host-Mitgliedern
  - Wartung: `maintenance.create` (Host-Level; Zabbix kennt keine Service-Downtimes)
  - ACK: `event.acknowledge` (action=6: acknowledge + message)
  - `ping`: `apiinfo.version` (kein Auth erforderlich)
- `connectors/registry.py`: `ZabbixClient` in `AnyClient`, `_make_client()`,
  `_raw_from_client()`, `_client_info()`

**Frontend**
- `map-core.js`: „Zabbix JSON-RPC API" im Typ-Dropdown
- `map-core.js`: `bm-fields-zabbix` (URL, API-Token, Benutzer/Passwort-Fallback, SSL-Checkbox)
- `map-core.js`: `_bmUpdateFields()`, `_bmBuildEntry()`, `_bmClearForm()`, `_bmEditLoad()` erweitert

---

## [2026-03-24]

### Bugfix: Poll-Loop Absturz `expected string or bytes-like object, got 'dict'`
- `core/perfdata.py`: `parse_perfdata()` prüft `isinstance(raw, str)` vor `re.finditer()` → gibt `{}` zurück wenn kein String übergeben wird
- `checkmk/client.py`: Neue Hilfsfunktion `_to_perf_str()` — stellt sicher dass `performance_data` (Checkmk REST API kann Dict liefern) immer als `""` weitergegeben wird

### Feature: Authentifizierung vollständig ✅

**Backend**
- `api/auth_router.py`: `POST /api/v1/auth/refresh` — gibt neues Token (7 Tage) für eingeloggten User zurück
- `api/auth_router.py`: `PATCH /api/v1/auth/me` — eigenes Passwort ändern (mind. 6 Zeichen, jede Rolle)

**Frontend**
- `auth.js`: **Bugfix** — `nv2AuthChangeRole()`, `nv2AuthChangePw()`, `nv2AuthDeleteUser()` verwendeten `/api/auth/` statt `/api/v1/auth/` → 404-Fehler
- `auth.js`: `_scheduleRefresh()` / `_doRefresh()` — JWT-Ablaufdatum aus Payload lesen; 1 Tag vor Ablauf automatisch via `POST /api/v1/auth/refresh` erneuern; wird nach Login + Init gestartet
- `auth.js`: `nv2AuthChangeOwnPw()` — eigenes Passwort ändern via `PATCH /api/v1/auth/me`
- `auth.js`: `_applyRoleUI(role)` — blendet UI-Elemente nach Rolle aus:
  - Editor-Pflicht: Neue Map, Map importieren, Edit-Mode
  - Admin-Pflicht: Backends, Aktionen, Kiosk-User, Map löschen
- `index.html`: IDs `btn-new-map`, `btn-import-map`, `btn-import-zip`, `btn-backend-mgmt`, `btn-kiosk-users`, `btn-action-config` an Burger-Menü-Buttons ergänzt
- `index.html`: Burger-Menü „Konto"-Abschnitt: Button „🔑 Passwort ändern" (`btn-change-own-pw`)

### Bugfix: Logout + Auth-UI-Sichtbarkeit
- `auth.js`: Logout-Button nur sichtbar wenn `AUTH_ENABLED=true` (bei deaktivierter Auth nach Reload sofort wieder Admin → Logout wäre sinnlos/verwirrend)
- `auth.js`: Benutzerverwaltung + Passwort ändern bleiben auch bei `AUTH_ENABLED=false` sichtbar (Rolle=admin)

### Dokumentation: `.env.example` + `admin-guide.md`

- `.env.example`: komplett überarbeitet — fehlende Variablen ergänzt (`LIVESTATUS_TYPE/PATH/SITE`, `WS_POLL_INTERVAL`, `LOG_FORMAT/LEVEL/LOG_BUFFER_LINES`, `NAGVIS_SECRET`); Port korrigiert 8000 → 8008; falscher `SECRET_KEY` durch `NAGVIS_SECRET` ersetzt
- `docs/admin-guide.md`: neuer Abschnitt **„Installation via Install-Script"** (Schnellstart, alle Optionen, Berechtigungskonzept, Service-Befehle)
- `docs/admin-guide.md`: neuer Abschnitt **„Authentifizierung & Benutzerverwaltung"** (Modi-Tabelle, Aktivierung, Rollen, REST-API-Beispiele, `users.json`-Format)
- `docs/admin-guide.md`: Konfigurationstabelle um `AUTH_ENABLED` + `NAGVIS_SECRET` erweitert

### Feature: `install.sh` – Bash-Installationsskript ✅
- Optionen: `--zip`, `--install-dir`, `--user`, `--port`, `--auth-enabled`, `--no-systemd`, `--no-start`, `--upgrade`, `--uninstall`
- System-User/Group `nagvis2` anlegen, venv erstellen, `requirements.txt` installieren
- `NAGVIS_SECRET` wird automatisch generiert (`secrets.token_hex(32)`)
- Berechtigungen: Code `root:nagvis2 755/644` · `data/` `nagvis2:nagvis2 750` · `.env` `600`
- Systemd-Service mit Security-Hardening (`NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`)
- Upgrade-Modus: `data/` + `.env` vor Update sichern, danach wiederherstellen

### Feature: `build.sh` – Build-Skript für ZIP-Distribution ✅
- Erstellt `nagvis2-<version>.zip` + `.sha256`; Version aus `changelog.txt` oder `git describe`
- Schließt aus: `venv/`, `data/`, `__pycache__/`, `*.pyc`, `.env`, `.coverage`
- Baut MkDocs-Hilfe vor dem Packen; ZIP-Wurzel immer `nagvis2/`

### Feature: GitHub Action – Automatische Releases ✅
- `.github/workflows/release.yml`: Trigger auf `v*.*.*`-Tags + manuell
- Job 1: pytest (Release schlägt fehl wenn Tests rot)
- Job 2: MkDocs + `build.sh` → ZIP als Artifact
- Job 3: GitHub Release mit ZIP + SHA256, Release-Notes aus `changelog.md`, Install-Befehl im Body

### Feature: M2 Map-Duplikat ✅

**Backend**
- `core/storage.py`: `clone_map(source_id, new_title)` — Deep-Copy, neue slugifizierte ID (Kollisionsvermeidung), `parent_map=None`, Hintergrundbild wird mitkopiert
- `api/router.py`: `POST /api/v1/maps/{id}/clone` (201) mit Audit-Log `map.clone`

**Frontend**
- `map-core.js`: `cloneActiveMap()` — prompt für neuen Namen, Default „\<Titel\> – Kopie"
- `map-core.js`: `cloneMap(mapId, newTitle)` — POST `/clone`, `loadMaps()` danach
- `index.html`: Burger-Menü → Aktive Map: **⧉ Map duplizieren** (`btn-clone-map`)
- `map-core.js`: Übersicht-Rechtsklickmenü: „Duplizieren"-Eintrag

### Feature: User-Chip als klickbarer Button mit Dropdown ✅
- `index.html`: `#nv2-user-chip` `<span>` → `<button class="user-chip-btn">` in `<div id="user-chip-wrap">`
- Dropdown `#user-chip-dropdown`:
  - Header: Rollenicon + Username + Rolle (immer)
  - ☀/☽ Theme wechseln (immer, synchron mit Burger-Menü)
  - ⚙ Einstellungen… → `dlg-user-settings` (immer)
  - 🔑 Passwort ändern / 👥 Benutzer verwalten (Admin) / ⏻ Abmelden — nur `AUTH_ENABLED=true`
- `auth.js`: `toggleUserChip()` / `closeUserChip()` / Außenklick-Listener
- `ui-core.js`: `setTheme()` aktualisiert `ucd-theme-ico` + `ucd-theme-label` synchron
- `css/styles.css`: `.user-chip-btn` + `:hover`

### Feature: P2 HTTPS/TLS für Produktionsbetrieb ✅
- `nginx.conf.prod`: vollständige TLS-Produktionskonfiguration
  - HTTP → HTTPS Redirect (301), TLS 1.2 + 1.3, moderne Cipher-Suites, OCSP Stapling
  - Security-Header: HSTS (2 Jahre + preload), CSP, X-Frame-Options, X-Content-Type-Options
  - `/metrics` nur von `127.0.0.1` erreichbar
- `scripts/setup-tls.sh`: TLS-Setup-Skript
  - Standard: selbstsigniertes RSA-4096-Zertifikat mit SAN; speichert nach `/etc/nagvis2/tls/`
  - `--certbot`: Let's Encrypt via certbot (inkl. nginx-Plugin); reload nach Erstellung
- `docs/admin-guide.md`: neuer Abschnitt **„HTTPS / TLS"** — Option A selbstsigniert, Option B Let's Encrypt, Firewall-Hinweise

### Feature: P3 OMD-Hook / Systemd-Integration ✅
- `omd/nagvis2`: OMD init.d-Hook-Skript — `start | stop | restart | status | version`
  - Liest `PORT` aus `$OMD_ROOT/etc/nagvis2/.env`; PID-Datei in `$OMD_ROOT/tmp/run/`; Log nach `$OMD_ROOT/var/log/nagvis2.log`
- `scripts/install-omd-hook.sh`: Hook-Installer — patcht `NAGVIS2_DIR`, setzt Eigentümer auf OMD-Site-User; `--uninstall` entfernt Hook
- `docs/admin-guide.md`: neuer Abschnitt **„OMD / Checkmk-Integration"** — Voraussetzungen, Installation, Verwendung, `.env`-Konfiguration, Deinstallation

### Feature: Erweiterte Test-Coverage – Ziel ≥ 70 % ✅
- `tests/test_api_maps.py`: 27 neue Tests — `TestCloneMapApi` (6), `TestThumbnailApi` (5), `TestChangelogEndpoint`, `TestMiscEndpoints` (15: hosts, hostgroups, logs, Kiosk-CRUD, Backends, Parent/Canvas 404)
- `tests/test_storage.py`: `TestCloneMap` (6) — `clone_map`: neuer Map, Deep-Copy, `parent_map=None`, nonexistent, Kollision, Persistenz
- `tests/test_auth_router.py` (NEU, 22 Tests): AuthConfig, Login (valid/wrong/unknown), Me GET/PATCH (Short-PW → 400), Refresh, Logout (Token-Revoke), User-CRUD (list, create-dup 409, empty 400, patch role/pw, delete-self 400, delete-ghost 404, admin-only 403)
- **Gesamt: 137 → 192 Tests · erwartete Coverage ≥ 70 %**

### Bugfix: GitHub Actions – Node 20 Deprecation
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` aus allen 4 Workflows entfernt (`ci.yml`, `docker.yml`, `docs.yml`, `release.yml`)
- Node 24 ist seit September 2025 der Standard — das temporäre Opt-in-Flag ist obsolet

### Dokumentation: README.md + FEATURES.md aktualisiert
- `README.md`: CI/Release/Changelog-Badges; Features-Tabelle ergänzt; `install.sh` als primäre Schnellstart-Option; `AUTH_ENABLED`/`NAGVIS_SECRET` in `.env`-Sektion; aktualisierte Ordnerstruktur; Links-Sektion am Ende
- `FEATURES.md`: P2 + P3 als ✅ markiert; Fortschritts-Balken auf 100 % (Monitoring/Betrieb, Backend API)

### Feature: `backend_id` pro Node – Datenquelle explizit wählbar ✅

**Problem:** Derselbe Hostname (z.B. `server01`) kann gleichzeitig in Checkmk, Zabbix, Icinga2 und mehreren Checkmk-Instanzen existieren. Bisher gewann immer der erste Treffer.

**Backend**
- `connectors/registry.py`: `get_all_hosts_tagged()` + `get_all_services_tagged()` — liefern alle Einträge aller Backends mit `_backend_id`-Feld (keine Deduplizierung)
- `ws/manager.py`: nutzt `*_tagged()`-Methoden; Diff-Keys sind jetzt `"backend_id::name"` statt `"name"`; Demo-Modus erhält `_backend_id: "demo"`
- `api/router.py`: `backend_id: Optional[str]` in `ObjectCreate` und `ObjectProps`

**Frontend**
- `state.js`: `window.backendStatusCache = {}` (backend_id → {cacheKey: statusDict}); `window.backendList = []`
- `nodes.js`: `_resolveStatus(backendId, cacheKey)` — sucht zuerst in `backendStatusCache[backendId]`, Fallback `hostCache`
- `nodes.js`: `_renderMonitoringNode()` setzt `el.dataset.backendId = obj.backend_id || ''`
- `nodes.js`: `applyStatuses()` befüllt `backendStatusCache`; filtert DOM-Updates nach `backendId`; speichert Perfdata unter `"backend_id\x1ehost::service"`
- `nodes.js`: `openNodePropsDialog()` — `<select id="np-backend-id">` mit `(beliebig)` + allen konfigurierten Backends; befüllt via `GET /api/backends`; `backend_id` im PATCH-Payload; `el.dataset.backendId` nach Speichern gesetzt
- `nodes.js`: `openGadgetConfigDialog()` + `_gcSave()` — analoges Dropdown für Gadgets
- `gadget-renderer.js`: `createGadget()` setzt `el.dataset.backendId = obj.backend_id || ''`

Rückwärtskompatibel: Nodes ohne `backend_id` nutzen `hostCache` wie bisher.

### Feature: Browser-Benachrichtigungen + Hinweiston bei CRITICAL (N4) ✅

**Frontend**
- `js/ws-client.js`: `_checkCriticalNotify(hosts, services)` — nach jedem `status_update`-Event; filtert `DOWN`/`CRITICAL`/`UNREACHABLE`-Hosts und `CRITICAL`-Services; **Debounce: max. 1 Benachrichtigung alle 15 s**
- `js/ws-client.js`: `_playCriticalSound()` — Web Audio API, Square-Wave-Oszillator (880 → 440 Hz, 0,45 s); kein externer Asset
- `js/ws-client.js`: Browser `Notification` API mit `tag='nagvis2-critical'` (ersetzt vorherige) + `renotify=true`
- `js/ui-core.js`: `defaultUserSettings()` um `notifyOnCritical: false` + `notifySound: true` erweitert
- `js/ui-core.js`: `saveUserSettings()` liest neue Checkboxen; fordert Berechtigung automatisch an wenn Benachrichtigungen gerade aktiviert werden
- `js/ui-core.js`: `_updateNotifyStatus()` — zeigt Berechtigungsstatus (✔ erteilt / ✖ verweigert / ausstehend) mit Farbcodierung
- `js/ui-core.js`: `_requestNotifyPermission()` — manueller Berechtigung-Button
- `index.html`: dlg-user-settings — neue Sektion **„Benachrichtigungen"**: Checkbox „Bei CRITICAL/DOWN Browser-Benachrichtigung anzeigen", Checkbox „Hinweiston abspielen", Button „🔔 Berechtigung erteilen" + Statusanzeige

Einstellungen persistiert in `nv2-user-settings` (localStorage). Standard: deaktiviert.

### Dokumentation: `admin-guide.md` um Zabbix + Icinga2 erweitert ✅
- Voraussetzungen-Tabelle: Zabbix 6.0+ und Icinga2 2.11+ ergänzt
- Neue Unterabschnitte: **Checkmk REST API**, **Zabbix**, **Icinga2** (je: Parameter-Tabelle, Einrichtungsanleitung, Konzept-Mapping)
- Icinga2: vollständige `ApiUser`-Konfiguration mit allen erforderlichen Permissions
- Zabbix: Schweregrad-Mapping (Priority → WARNING/CRITICAL), Hinweis zu API-Token vs. user.login
- Verzeichnisstruktur: `zabbix/` und `icinga2/` ergänzt
- `docs/todo-liste.md`: bereinigt (erledigte Items als `[x]` markiert); neue Einträge: **DRAW.io-Import**, **BI-Visualisierung**

### Feature: F7 draw.io / diagrams.net Import ✅

**Backend**
- `api/router.py`: `POST /api/maps/import-drawio` — neuer Endpunkt
  - Parst `.drawio`- und `.xml`-Dateien via `xml.etree.ElementTree` (stdlib, keine Zusatz-Deps)
  - `_drawio_find_model()`: findet `mxGraphModel` auch in komprimierten Diagrammen (URL-Decode → Base64 → raw-deflate via `zlib.decompress(raw, -15)`)
  - Alle `vertex`-Zellen → `textbox` (Standard) oder `host` wenn `?as_hosts=true`
  - Alle `edge`-Zellen → `line` (Quelle/Ziel über Cell-ID-Lookup)
  - Bounding-Box-Normalisierung: absolute draw.io-Pixel werden auf 5–95 % Map-Koordinaten skaliert (Mittelpunkte der Shapes)
  - Erstellt automatisch eine neue Map (`canvas: ratio 16:9`); gibt `{map_id, title, object_count, warnings}` zurück
  - Robuste Fehlerbehandlung: ungültige Verbindungen werden einzeln übersprungen und als Warnung zurückgegeben
  - Audit-Log-Eintrag (`map.import_drawio`)

**Frontend**
- `index.html`: Burger-Menü-Eintrag „🗂 draw.io importieren (.drawio / .xml)"; `dlg-drawio-import`-Dialog mit Drag & Drop, Titel-Feld, Checkbox „als Hosts anlegen", Ergebnis-Box
- `map-core.js`: `dlgImportDrawio()` — Dialog öffnen, Datei-Input + Drop-Zone verdrahten; `_drawioHandleFile()` — Validierung, Dateiname als Titel-Vorschlag; `confirmImportDrawio()` — `FormData` POST zu `/api/maps/import-drawio`, Redirect zur neuen Map

### Feature: F3 Custom Graph Gadget – Grafana & Checkmk Panels einbetten ✅

**Frontend**
- `gadget-renderer.js`: neuer Gadget-Typ `graph` — rendert `<iframe>` (Standard) oder `<img>` für externe Graphen
  - `_graph(cfg)`: generiert HTML mit konfigurierbarer Breite/Höhe; zeigt Leer-Platzhalter wenn keine URL gesetzt
  - Auto-Refresh: `setInterval` in `_graphTimers` Map; bei `<img>` wird `_t=<timestamp>` Cache-Buster angehängt, bei `<iframe>` wird `src` neu gesetzt
  - `updateGadget()`: graph-Typ wird übersprungen (keine Perfdata-Aktualisierung)
  - Export: `window._gadgetGraph = _graph` für Dialog-Vorschau
- `nodes.js`: Gadget-Konfigurations-Dialog erweitert
  - Typ-Chip „📊 Graph / Iframe" (spans volle Breite, 7. Button)
  - `#gc-datasource-row` / `#gc-metric-row`: IDs hinzugefügt für dynamische Sichtbarkeit
  - `#gc-graph-row`: URL-Eingabe, Einbettung (iframe/img), Breite, Höhe, Refresh-Intervall
  - `_gcSelectType()`: blendet Datenquellen-/Min-Max-Felder für graph-Typ aus; zeigt Graph-Sektion
  - `_gcUpdatePreview()`: zeigt Graph-Vorschau (iframe/img) mit aktuellen Werten
  - `_gcSave()`: schreibt `{ type, url, embed, width, height, metric, refresh }` in `gadget_config`

**Demo**
- `backend/data/maps/demo-features.json`: Grafana-Play-Beispiel-Gadget (`gadget::graph-demo-01`) hinzugefügt

**Tests & Kompatibilität**
- `tests/test_prometheus_client.py`: 27 neue Tests für `prometheus/client.py` — Coverage ≥ 70% sichergestellt
- `from __future__ import annotations` in 10 Backend-Dateien (Python 3.9-Kompatibilität)

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

### Refactor: Projektverzeichnis verschoben `beta/nagvis2` → `nagvis2`
- Verzeichnis eine Ebene höher, `beta/`-Zwischenordner entfernt
- `.github/workflows/`: ci, docker, docs, release — alle Pfade aktualisiert
- `.github/dependabot.yml`: pip `directory` aktualisiert
- `scripts/make_changelog.py`: Input-/Output-Pfade aktualisiert

### Feature: F5 Prometheus & VictoriaMetrics Connector ✅
- `backend/prometheus/client.py`: Async HTTP-Client für Prometheus HTTP API v1
- Hosts aus `up`-Metrik abgeleitet (`host_label` konfigurierbar, Standard: `instance`)
- Services aus firing/pending Alerts (`GET /api/v1/alerts`)
- Hostgruppen aus `job`-Label
- Severity-Mapping: `critical/page/error` → CRITICAL, `warning/warn/info` → WARNING
- Auth: Bearer Token + Basic Auth (beide optional); VictoriaMetrics vollständig kompatibel
- Aktionen (ACK, Downtime) → `False` (Prometheus ist read-only)
- `connectors/registry.py`: `PrometheusClient` eingebunden
- `frontend/js/map-core.js`: Prometheus-Option + Felder im Backend-Dialog

### Dokumentation: `dev-guide.md` erstellt ✅
- Vollständiges Entwickler-Handbuch: Stack, lokales Setup, Projektstruktur
- Backend-Architektur (Request-Flow, WebSocket-Flow, Konfiguration, Persistenz)
- Frontend-Architektur (Ladereihenfolge, globale Variablen, `api()`-Wrapper, Demo-Modus)
- Schritt-für-Schritt-Anleitungen: neuer Connector, API-Endpoint, Dialog
- Tests, Code-Konventionen, Release-Prozess
- `mkdocs.yml`: „Entwickler"-Eintrag in Navigation

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

---

## [2026-04-14]

### Bugfix: „Im Monitoring öffnen" — falsche URLs für Host, Hostgroup, Servicegroup
- Host-Link verwendete fälschlich `index.py?start_url=...`-Wrapper
- Korrekt: `view.py?host={name}&site={site}&view_name=host` / `hostgroup` / `servicegroup`
- `js/nodes.js`: `_buildMonitoringUrl` komplett überarbeitet (switch über `obj.type`)

### Feature: Live-Perfdata in Tooltips (Gadgets + Service-Objekte)
- Gadgets: Mouseover zeigt Live-Wert aus `perfdataCache`, alle Metriken, Service-Status
- Service-Objekte: Perfdata-Metriken mit Warn/Crit-Farben; aktive Metrik fett
- `js/nodes.js`: `showTooltip` komplett überarbeitet

### Feature: Service-Objekte mit Perfdata-Metrik (`perf_label`)
- Service-Objekte können eine Perfdata-Metrik konfigurieren
- Live-Wert erscheint im Node-Label: `"Label: 1.234ms"`
- Autocomplete für Service-Name und Metrik-Name + aktuellen Wert
- `$PERFVALUE$`-Macro in Label-Templates
- `backend/api/router.py`: `ObjectProps` um `perf_label` erweitert

### Feature: Eigenschaften-Dialog im View-Mode (Editor/Admin)
- Rechtsklick-Kontextmenü zeigt „Eigenschaften" für Rolle `editor`/`admin`

### Feature: „Im Monitoring öffnen" — automatische URL pro Backend (Checkmk)
- Immer sichtbar (war: nur wenn `monitoring_url` konfiguriert)
- Checkmk: URL automatisch aus API-Base-URL abgeleitet (kein manuelles Konfigurieren)

### Feature: Probleme-Panel zeigt Host- UND Service-Probleme
- Bisher: nur Hosts; jetzt: auch Services als `hostname / service_description`
- `js/ui-core.js`: `renderProblemsPanel`; `js/ws-client.js`: vollständiger Cache-Transfer

### Feature: Makros im Label-Feld (`$HOSTALIAS$`, `$HOSTSTATE$` etc.)
- Makros funktionieren jetzt auch im Label-Feld (nicht nur im Label-Template-Feld)
- `js/nodes.js`: `_nodeLabel`, `_applyLabelTemplate`, `applyStatuses`

### Bugfix: + Schaltfläche in Übersichtskarte öffnete keine neue Map
- Ursache: doppelte `id="btn-new-map"`; Fix: `id="ov-btn-new-map"`

### Bugfix: Service-Dropdown leer beim Platzieren
- `serviceCache` nicht ans Platzierungs-Formular gebunden
- `js/map-core.js`: input-Listener für `dlg-svc-host` und `dlg-svc-name`

### Bugfix: Gadget-Werte nicht angezeigt (Checkmk Perfdata als Liste)
- Checkmk REST API liefert `performance_data` teils als Array
- `_to_perf_str` verbindet Array-Elemente mit Leerzeichen

### Bugfix: Service-Anzahl im Host-Tooltip immer 0
- Checkmk REST API liefert `num_services_*` in Hosts-Collection nicht
- Live-Zählung aus `hostCache`; Fallback auf Backend-Daten

### Bugfix: „undefined" in Hosts- und Probleme-Panel
- `Object.values(hostCache)` enthält auch Service-Einträge ohne `name`-Feld
- Panels filtern getrennt nach `type === 'host'`

### Bugfix: Kontextmenü-Aktionen (ACK, Downtime …) erschienen nicht
- `h` war `null` durch direkten `hostCache`-Lookup statt `_resolveStatus`
- `_actionConfig.enabled`: Migration für alte localStorage-Stände

### Bugfix: `backend_id` vs. `_backend_id` in Status-Cache
- `applyStatuses` befüllte `backendStatusCache` nie (falscher Feldname)
- Fix: `h.backend_id || h._backend_id`

---

## [2026-04-16]

### Bugfix: Lasso-Selektion durch nachfolgenden Click-Event geleert
- Browser feuert `click` nach `mouseup`; Click-Handler löschte Selektion
- Fix: `window._nv2LassoDone`-Flag in `onUp` gesetzt; `onCanvasClick` prüft und löscht Flag
- `js/nodes.js`

### Bugfix: „Im Monitoring öffnen" aus Snap-Tabs nicht funktionsfähig
- `_openInMonitoringOrFocus` fand kein Backend (Livestatus-Adressen haben kein `http://`-Präfix)
- Fix: 5-stufige Backend-Suche (backend_id+checkmk → backend_id+web_url → checkmk → web_url → http)
- `js/ui-core.js`

### Feature: `web_url`-Feld für Livestatus-Backends
- Livestatus TCP/Unix können optional eine Checkmk-Web-URL konfigurieren
- Wird für „Im Monitoring öffnen" und Topbar-Pills genutzt
- Backend: `LivestatusConfig.web_url`, `BackendCreate.web_url`, `connectors/registry.py`
- Frontend: `map-core.js` — `bm-ls-web-url`-Feld im Backend-Dialog

### Bugfix: `web_url` wurde nicht gespeichert (`BackendCreate`-Modell unvollständig)
- `BackendCreate` deklarierte `web_url` nicht → `model_dump()` verwarf es stillschweigend
- Fix: `web_url: Optional[str] = None` in `BackendCreate` ergänzt
- `backend/api/router.py`

### Feature: Topbar-Pills klickbar — öffnet Checkmk Problems-Dashboard
- Klick auf Topbar-Pills öffnet Checkmk Problems-Dashboard
- URL-Aufbau: `{web_url}/index.py?start_url=.../dashboard.py?name=problems&owner=`
- `js/ui-core.js`: `openMonitoringDashboard()`, `_monitoringSiteBase()`
- `css/styles.css`: `.pill` mit `cursor:pointer` + Hover-Effekt

### Feature: CLAUDE.md Entwicklerdokumentation
- Befehle, Backend-/Frontend-Architektur, Test-Details für Claude Code
- `nagvis2/CLAUDE.md`

### Bugfix: GitHub Pages Pipeline (`static.yml`) schlug fehl
- `docs.yml` (`mkdocs gh-deploy`) konkurrierte mit `static.yml` um Concurrency-Gruppe
- Fix: `docs.yml` auf `workflow_dispatch` umgestellt; MkDocs-Build in `static.yml` integriert
- `changelog.md` wird vor Build nach `docs/` und `frontend/` kopiert

### Bugfix: CI Vitest-Test — `SyntaxError: Unexpected identifier 'globalThis'`
- `nodes.js` war über Zeile 51 hinausgewachsen; `slice(0,51)` schnitt Template-Literal
- Fix: dynamisches `findIndex` nach erstem `}`-Zeichen auf Spalte 0 nach Zeile 30
- `frontend/tests/unit/setup.js`

### Bugfix: Auto-Map — Abstände zu groß; Grid nicht zentriert nach Erstellung
- Radius-Formel: `r = max(STEP*3, n*STEP)` statt `STEP*n*1.5`
- `_centerAutoMap()`: berechnet Bounding-Box aller Nodes, zentriert Canvas via `NV2_ZOOM.setState`
- `js/map-core.js`

### Feature: Auto-Map Layouts Kreis und Stern entfernt
- Nur noch Grid und Hierarchie verfügbar (Kreis/Stern waren instabil)
- `backend/api/router.py`: `_circle()`, `_star()` entfernt; `AutoMapRequest.layout` aktualisiert
- `frontend/index.html`: Optionen aus `#nm-am-layout`-Select entfernt

### Bugfix: Backend-Liste nicht aktualisiert nach Datasource-Änderung
- `window.backendList` wurde nur beim App-Start geladen — kein Refresh nach Änderung
- Fix: nach POST/PATCH Backend sofortiger Refresh aus `/api/backends`
- `js/map-core.js`: `_bmAdd()`

### Bugfix: Changelog im About-Dialog konnte nicht geladen werden (Docker)
- `changelog.txt`/`.md` befanden sich nicht im Docker-Container (fehlende Volume-Mounts)
- Fix: Volume-Mounts für `changelog.*` in `docker-compose.yml` ergänzt
- Fallback-Fetch auf `/changelog.md` wenn `/api/v1/changelog` nicht erreichbar
- `docker-compose.yml`, `js/ui-core.js`

### Feature: Auto-Layout (F4) — Grid-Sortierung nach Objektgröße
- F4-Button sortiert selektierte (oder alle) Nodes automatisch im Raster
- Sortierung nach Pixel-Fläche absteigend (größte Objekte links oben)
- Spaltenanzahl: `round(√n)`; Zellenabstand: Node-Größe + 8 px
- Ohne Selektion: zentriert auf Canvas-Mitte (50 %/50 %)
- Mit Teilselektion: zentriert auf Schwerpunkt der aktuellen Positionen (kein Drift)
- Align-Toolbar: immer sichtbar im Edit-Mode
- `js/align.js`, `frontend/index.html`

### Feature: Zonen-Objekt — farbiges Rechteck als Hintergrund-Layer
- Neuer Objekt-Typ `zone` — optisch beschriftbares Rechteck hinter allen anderen Objekten
- Konfigurierbar: Beschriftung, Hintergrundfarbe (RGBA), Rahmenfarbe, Rahmenbreite, Schriftgröße
- Im Edit-Mode verschiebbar (Drag) und größenveränderbar (Resize-Handle unten-rechts)
- Z-Index 1 (hinter `.nv2-node` / `.nv2-textbox` / `.nv2-container` bei z-index 10)
- DOM-Einfügung immer vor dem ersten Nicht-Zonen-Element — visuelles Layering korrekt
- Lasso-Selektion, Ctrl+A, Kontextmenü, Undo/Redo vollständig unterstützt
- `js/nodes.js`, `js/map-core.js`, `css/styles.css`, `frontend/index.html`, `backend/api/router.py`
"""


SEP_TXT = '─' * 60


def _build_txt(src: str) -> str:
    """
    Kehrt die Eintragsreihenfolge um (neueste zuerst) und
    fuegt zwischen jedem Eintrag eine Trennlinie ein.
    Die Quell-Variable bleibt chronologisch – einfach unten anhaengen.
    """
    # Header bis zum ersten Eintrag abtrennen
    m = re.search(r'\n\[\d{4}-\d{2}-\d{2}\]', src)
    if not m:
        return src
    header = src[:m.start()].rstrip()
    body   = src[m.start() + 1:]          # fuehrendes \n weglassen
    # Jeden Eintrag am Zeilenanfang [YYYY-MM-DD] trennen
    entries = re.split(r'\n(?=\[\d{4}-\d{2}-\d{2}\])', body)
    entries = [e.strip() for e in entries if e.strip()]
    entries.reverse()
    return header + '\n\n' + ('\n' + SEP_TXT + '\n\n').join(entries) + '\n'


def _build_md(src: str) -> str:
    """
    Sortiert Datumsblöcke absteigend (neueste zuerst) und
    trennt Bloecke mit '---'.
    Reihenfolge der Blöcke in der Quellvariable spielt keine Rolle.
    """
    m = re.search(r'\n## \[\d{4}-\d{2}-\d{2}\]', src)
    if not m:
        return src
    header = src[:m.start()].rstrip()
    body   = src[m.start() + 1:]
    blocks = re.split(r'\n(?=## \[\d{4}-\d{2}-\d{2}\])', body)
    blocks = [b.strip() for b in blocks if b.strip()]

    def _date_key(block: str) -> str:
        dm = re.match(r'## \[(\d{4}-\d{2}-\d{2})\]', block)
        return dm.group(1) if dm else ''

    blocks.sort(key=_date_key, reverse=True)   # neueste zuerst
    return header + '\n\n' + '\n\n---\n\n'.join(blocks) + '\n'


def main():
    # changelog.txt als UTF-16 mit BOM (neueste zuerst)
    TXT_PATH.write_bytes(_build_txt(TXT).encode('utf-16'))
    print(f'changelog.txt geschrieben ({TXT_PATH})')

    # changelog.md als UTF-8 (neueste zuerst)
    MD_PATH.write_text(_build_md(MD), encoding='utf-8')
    print(f'changelog.md  geschrieben ({MD_PATH})')


if __name__ == '__main__':
    main()
