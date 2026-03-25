# Projekt-Statistik: NagVis 2
> Stand: 25. März 2026 · Alle Zahlen sind Schätzungen auf Basis von Git-Log, Code-Analyse und Kontext-Protokollen

---

## Projektzeitraum

| | |
|---|---|
| **Erster Commit** | 12. März 2026 |
| **Stand heute** | 25. März 2026 |
| **Laufzeit** | 14 Kalendertage / **10 aktive Arbeitstage** |

### Commit-Aktivität pro Tag

| Datum | Commits | Schwerpunkt |
|---|---|---|
| 12.03. | 7 | Initial Commit, Frontend-Entwurf, Layout |
| 13.03. | 22 | API, Poller, Tests, Backend-Struktur |
| 16.03. | 4 | Refactoring |
| 17.03. | 8 | Feature-Erweiterungen |
| 18.03. | 12 | Auth, Connectors |
| 19.03. | 7 | Bugfixes, Docs |
| 20.03. | 10 | OSM, Layer-System |
| 23.03. | 28 | Kiosk, Gadgets, CI/CD, HTTPS/TLS |
| 24.03. | 24 | Auth komplett, install.sh, Graph-Gadget, draw.io |
| 25.03. | 4 | Demo-Maps, Seed-Mechanismus, Sidebar-Fix |
| **Gesamt** | **126** | |

---

## Codebase-Statistik

| Sprache | Dateien | Zeilen | Anteil |
|---|---|---|---|
| Python (Backend) | 43 | ~8 900 | 38 % |
| JavaScript (Frontend) | 14 | ~7 700 | 33 % |
| Markdown (Docs) | 19 | ~2 900 | 12 % |
| CSS | 2 | ~1 496 | 6 % |
| HTML | 1 | ~1 150 | 5 % |
| JSON / YAML / Sonstige | 28 | ~1 453 | 6 % |
| **Gesamt** | **107** | **~23 600** | 100 % |

---

## Umfang: Was wurde gebaut

### Backend (Python / FastAPI)
- FastAPI-Anwendung mit WebSocket-Livestatus und Poll-Loop
- 5 Monitoring-Backends: Livestatus, Checkmk REST, Icinga2 REST, Zabbix JSON-RPC, Prometheus/VictoriaMetrics
- JWT-Authentifizierung mit Rollen (viewer / editor / admin) + Auto-Refresh
- REST-API (/api/v1) mit vollständiger CRUD für Maps, Objekte, Backends, Benutzer, Kiosk
- Prometheus-Metriken-Endpoint (/metrics), Liveness/Readiness-Probes
- NagVis-1-Import, draw.io-Import, Map-Clone, Map-Export/ZIP
- Audit-Log (JSONL, Rotation), strukturiertes Logging (JSON/Text)
- pytest-Testsuite: 6 Test-Dateien, Coverage ≥ 70 %

### Frontend (Vanilla JS, kein Framework)
- Single Page Application ohne Build-Step
- Map-Editor: Drag & Drop, Multi-Select (Lasso + Shift), Gruppen-Drag, Layer-System
- 7 Objekt-Typen: Host, Service, Hostgroup, Servicegroup, Map, Textbox, Linie, Container, Gadget
- 7 Gadget-Typen: Radial, Linear (H/V), Sparkline, Thermometer, Flow/Weather, Raw-Number, Graph/iframe
- OSM-Integration (Leaflet.js) mit Cluster-Bubbles, Edit-Mode, Lat/Lng-Drag
- Kiosk-Modus (Vollbild, Auto-Refresh, Token-URL)
- Dark/Light-Theme, Browser-Benachrichtigungen, WebAudio-Hinweiston
- Zoom/Pan (CSS Transform), Keyboard-Shortcuts

### DevOps / Infrastruktur
- `install.sh` (vollautomatische Linux-Installation, Systemd, venv, Berechtigungen)
- `build.sh` (ZIP-Release + SHA256)
- `docker-compose.yml` + `Dockerfile` (non-root, tini PID-1)
- `nginx.conf.prod` (TLS 1.2/1.3, HSTS, CSP, OCSP)
- GitHub Actions: CI (pytest), Docker-Build, MkDocs, automatische Releases
- Helm-Chart (Kubernetes, PVC, HPA, ServiceMonitor)
- Render.com-Deploy (render.yml, Live-Demo)

### Dokumentation
- `README.md` + Root-`README.md`, `FEATURES.md`, `statistik.md`
- MkDocs-Hilfe-System: `user-guide.md`, `admin-guide.md`, `dev-guide.md`, `todo-liste.md`
- Automatischer Changelog (`scripts/update_changelog.py` → `changelog.txt` UTF-16 + `changelog.md`)

---

## Zeitaufwand (Schätzung)

### Entwickler (bh2005)
| Tätigkeit | Stunden |
|---|---|
| Anforderungen formulieren, Entscheidungen treffen | ~10 h |
| Code-Review, Testing, Feedback geben | ~15 h |
| Deployment, CI/CD, Render-Setup | ~8 h |
| Git-Workflow, Merges, Korrekturen | ~5 h |
| **Gesamt Entwickler** | **~38 h** |

### Claude (KI-Assistent)
| Tätigkeit | Schätzung |
|---|---|
| Sessions gesamt | ~12–15 Konversationen |
| Durchschnittliche Session-Dauer | ~45–90 min Antwortzeit |
| Code geschrieben / editiert | ~18 000 Zeilen |
| Dateien erstellt / geändert | ~85 Dateien |
| **Gesamt KI-Arbeitszeit (Äquivalent)** | **~120–160 h** |

> **Gesamtprojekt-Äquivalent:** ~160–200 Personenstunden

---

## Kosten-Kalkulation

### Claude API (claude-sonnet-4-6)

| Posten | Schätzung | Preis | Betrag |
|---|---|---|---|
| Input-Token (Kontext, Dateien lesen) | ~2,5 Mio. Tokens | $3,00 / MTok | ~$7,50 |
| Output-Token (Code, Erklärungen) | ~1,0 Mio. Tokens | $15,00 / MTok | ~$15,00 |
| **API-Kosten gesamt** | | | **~$22,50 ≈ €21** |

> Preise basieren auf dem veröffentlichten Tarif für Claude Sonnet 4.6 (Stand März 2026).
> Tatsächliche Kosten hängen von der Abrechnungsmethode (API vs. Claude Code Pro/Max) ab.

### Entwickler-Aufwand (Opportunitätskosten)
| Rolle | Stunden | Satz (intern) | Betrag |
|---|---|---|---|
| Senior Developer / Architect | ~38 h | ~€80/h | ~€3 040 |

### Vergleich: Externe Agentur

Würde der gleiche Umfang bei einer externen Software-Agentur beauftragt:

| Komponente | Aufwand-Schätzung | Tagessatz €900 (8h) |
|---|---|---|
| Backend (FastAPI, 5 Connectors, Auth) | ~120 h / 15 Tage | €13 500 |
| Frontend (SPA, Editor, Gadgets, OSM) | ~100 h / 12,5 Tage | €11 250 |
| DevOps (Docker, CI/CD, Helm, install.sh) | ~40 h / 5 Tage | €4 500 |
| Testing & QA | ~20 h / 2,5 Tage | €2 250 |
| Dokumentation | ~20 h / 2,5 Tage | €2 250 |
| Projektmanagement (10 %) | ~30 h / 3,75 Tage | €3 375 |
| **Gesamt Agentur** | **~330 h / ~41 Tage** | **~€37 125** |

---

## Effizienz-Kennzahlen

| Kennzahl | Wert |
|---|---|
| Code pro aktivem Arbeitstag | ~2 360 Zeilen |
| Features pro Woche | ~10–12 signifikante Features |
| Commits pro Tag (Ø) | 12,6 |
| KI-Hebel (Agentur-Wert / API-Kosten) | **~1 770×** |
| KI-Hebel (Agentur-Wert / Gesamtkosten inkl. Entwickler) | **~12×** |

---

## Fazit

In **14 Kalendertagen** wurde mit ca. **€21 API-Kosten** und **~38 h Entwicklerzeit**
ein vollständiges Monitoring-Frontend gebaut, dessen Marktwert bei externer Vergabe
bei schätzungsweise **€35 000–45 000** liegt.

Der KI-Einsatz hat die Entwicklungsgeschwindigkeit im Vergleich zu klassischer
Solo-Entwicklung (gleicher Entwickler, ohne KI) um den Faktor **5–8×** erhöht –
gemessen an vergleichbaren Projekten dieser Komplexität.

---

*Alle Zahlen sind Schätzungen. Token-Verbrauch wurde aus Kontext-Größen und Session-Anzahl
hochgerechnet. Stunden-Schätzungen basieren auf Commit-Aktivität und Gesprächsprotokollen.*
