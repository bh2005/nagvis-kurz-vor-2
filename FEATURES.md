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

---

### Burger-Menü ☰
- Dropdown mit vier Sektionen: Aktive Map · Maps verwalten · Benutzereinstellungen · System
- Außenklick schließt, `on`-Zustand beim Edit-Mode visuell markiert
- Map-Sektion erscheint/verschwindet kontextabhängig (nur wenn Map offen)

---

### Map-Verwaltung
- **Neue Map erstellen** – Titel + optionale ID, POST `/api/maps`
- **Map öffnen** – Sidebar-Eintrag oder Übersichtskarte, WebSocket-Verbindung wird aufgebaut
- **Map umbenennen** – Dialog, PUT `/api/maps/{id}/title`
- **Map löschen** – Bestätigungs-Prompt, aus geöffneter Map und aus Übersicht heraus
- **Parent-Map setzen** – Untermap-Hierarchie, PUT `/api/maps/{id}/parent`
- **Alle Maps verwalten** – Overlay mit Tabellenzeilen, alle Aktionen pro Zeile
- **Übersichtskarte ⋯-Menü** – erscheint bei Hover, öffnet Kontextmenü (Öffnen / Umbenennen / Parent / Löschen)
- **NagVis 1 Import** – `.cfg`-Parser, Canvas-Dimensionen wählbar, Dry-Run-Modus

---

### Map-Canvas
- **Hintergrundbild** – Upload via Burger-Menü oder Drag & Drop auf Canvas (PNG/JPG/SVG/WebP ≤ 20 MB)
- **Node-Koordinaten in %** – responsiv, skaliert mit dem Hintergrundbild
- **Upload-Prompt** – erscheint wenn noch kein Hintergrundbild gesetzt

---

### Objekt-Typen auf der Map
| Typ | Status | Besonderheiten |
|---|---|---|
| **Host** | ✅ | Icon, Label, Status-Badge, Tooltip |
| **Service** | ✅ | Host-Name + Service-Name, Typ-Pill |
| **Hostgroup** | ✅ | Typ-Pill „hg" |
| **Servicegroup** | ✅ | Typ-Pill „sg" |
| **Map (nested)** | ✅ | Typ-Pill „map", klickbar → öffnet Untermap |
| **Textbox** | ✅ | Freier Text, Schriftgröße/Farbe/Fett/Hintergrund |
| **Linie** | ✅ | Stil/Farbe/Breite, Drag-Handles, Winkel-Slider |
| **Container** | ✅ | Bild-URL, resize-fähig |
| **Gadget** | ✅ | Radial-Gauge, Linear-Gauge, Sparkline, Weather Line (gadget-renderer.js) |

---

### Iconset-System
- **Inline SVG Data-URIs** – kein Dateisystem-Iconset erforderlich, funktioniert ohne Server
- **Status-Icons** – farbige Kreise je Status (ok/warning/critical/unknown/pending/down)
- **Shape-Overlays** – 10 Geräteshapes (server/router/switch/firewall/database/storage/ups/ap/map/std_small)
- **Iconset-Dialog** – Grid-Auswahl inkl. Upload-Option
- **Größen-Slider** – 16–96 px via CSS `--node-size`

---

### Node-Status & Live-Updates
- **WebSocket** – reconnect-Loop, Heartbeat, Diff-only Updates
- **Demo-Modus** – funktioniert ohne Nagios/Checkmk, simuliert Statuswechsel alle 8 s
- **Status-Klassen** – `nv2-ok / nv2-warning / nv2-critical / nv2-unknown / nv2-ack / nv2-downtime`
- **Status-Flash-Animation** – kurzes Aufblitzen bei Wechsel
- **CRITICAL-Blink** – pulsierender Top-Stripe bei kritischen Nodes
- **Topbar-Pills** – OK / WARN / CRIT Zähler, CRIT blinkt
- **Tooltip** – Hostname, Status, Plugin-Output, Services-Zusammenfassung

---

### Snap-In Panels
- **Hosts-Panel** – sortiert nach Severity, Klick fokussiert Node auf der Map
- **Events-Panel** – letzten 60 Statusänderungen als Live-Stream via WebSocket
- Slide-in Animation, schließbar via `✕` oder `Esc`

---

### Edit-Mode (`Ctrl+E`)
- **Banner** – unten auf Canvas mit Shortcut-Hinweisen
- **Canvas-Klick** – öffnet Dialog „Objekt platzieren" an geklickter Position
- **Node-Drag** – PATCH `/api/maps/{id}/objects/{oid}/pos` (Koordinaten in %)
- **Rechtsklick-Kontextmenü** auf Nodes – Löschen, Layer zuweisen, Größe ändern, Iconset wechseln
- **Linien-Drag-Handles** – cyanfarbene Kreise an Endpunkten, nur im Edit-Mode sichtbar
- **Linienstil-Dialog** – Farbe, Stil (solid/dashed/dotted), Breite, Winkel-Slider (0–359°)
- **Resize-Panel** – Slider + Pixel-Anzeige für Node- und Gadget-Größe
- **Canvas-Klick-Guard** – verhindert Dialog-Öffnung wenn Resize/Kontextmenü offen

---

### Layer-System
- Layer-State `{ id → { name, visible, zIndex } }` im Speicher
- **Sidebar-Panel** – Checkbox Ein/Aus, Doppelklick umbenennen
- **Layer-Dialog** – Zuweisung zu bestehendem oder neuem Layer
- **Kontextmenü-Eintrag** „◫ Layer zuweisen" auf allen Nodes und Linien
- Collapsed Sidebar: Layer-Panel automatisch ausgeblendet

---

### Kiosk-Modus (`F11`)
- Vollbild-Overlay via Fullscreen API
- Canvas füllt gesamten Bildschirm
- Exit-Button erscheint bei Mausbewegung (fade-out nach 2,5 s), Esc oder F11 zum Beenden
- Status-Ticker unten: Map-Titel + Uhrzeit
- Auto-Refresh nach einstellbarem Intervall (30 s – 5 min)
- Sidebar/Topbar optional ausblendbar (aus Benutzereinstellungen)

---

### Benutzereinstellungen
- Dark/Light Theme-Chips (visuell)
- Sidebar-Startzustand (Expanded/Collapsed)
- Kiosk-Optionen (Sidebar, Topbar, Auto-Refresh, Intervall)
- Persistenz via `nv2-user-settings` in localStorage

---

### Backend (FastAPI)
- Alle CRUD-Endpunkte für Maps + Objekte
- WebSocket Fan-Out (asyncio, mehrere Clients gleichzeitig)
- Diff-Polling gegen Livestatus (nur Änderungen werden gesendet)
- Map-Store als JSON-Files (Zero-Dependency)
- Demo-Modus (`DEMO_MODE=True`) – kein Nagios erforderlich
- Health-Endpunkt mit Demo-Flag
- 11 Unit-Tests (alle grün)

---

## 🔲 Geplant / In Arbeit

*(Prio-Reihenfolge nach Produktionsrelevanz)*

### Sofort geplant (nächste Session)
| # | Feature | Beschreibung |
|---|---|---|
| F1 | **Zoom & Pan** | CSS `transform: scale() translate()` auf Canvas-Wrapper, Mausrad + Drag, Reset-Button, kein Framework |
| F2 | **Verbindungslinien mit Status** | Linie zwischen zwei Nodes, Farbe = worst-state der verbundenen Objekte, automatisch aktualisiert |
| F3 | **Multi-Map-Dashboard** | Echte Status-Pills in Übersichtskarten (OK/WARN/CRIT-Zähler), Status-Pip in Sidebar aktuell |
| F4 | **Service-Nodes vollständig** | Service-Liste per Datalist aus WS-Snapshot, Host-Zuordnung, korrekte Status-Auflösung |

---

### Produktionsbereitschaft
| # | Feature | Beschreibung |
|---|---|---|
| P1 | **Livestatus-Anbindung** | `DEMO_MODE=False`, Pfad `/omd/sites/<site>/tmp/run/live` |
| P2 | **Frontend-Deployment** | `nagvis2-prototype/` → `nagvis2/frontend/`, `main.py` serv bereits `/static/` |
| P3 | **CORS-Härtung** | `allow_origins` von `["*"]` auf konkrete Hostnamen |
| P4 | **Systemd / OMD-Hook** | uvicorn als Dienst, automatischer Start mit OMD-Site |
| P5 | **HTTPS** | TLS-Terminierung via nginx reverse proxy (typisch auf Checkmk-Servern) |
| P6 | **Auth** | Mindest-Absicherung: HTTP Basic Auth oder Session-Cookie via OMD |

---

### Features mit mittlerer Priorität
| # | Feature | Beschreibung |
|---|---|---|
| M1 | **Map-Config-Migration** | `.cfg` → JSON mit %-Koordinaten, Mapper-Script vorhanden (`nvdct_to_nagvis2.py`) |
| M2 | **Hostgroup-Aggregation** | Worst-State aller Hosts einer Gruppe als Node-Status |
| M3 | **SQLite statt JSON-Files** | SQLAlchemy, JSON als Fallback, Migration per Script |
| M4 | **Label-Templates** | Konfigurierbar: `{name} – {output}`, `{status} seit {duration}` |
| M5 | **Node-Verbindungen editierbar** | Linie zwischen zwei Nodes per Klick im Edit-Mode zuordnen |
| M6 | **Downtime planen** | Direktaufruf Checkmk-API für Downtime-Scheduling aus NagVis heraus |
| M7 | **Map-Export/Import** | JSON-Download + Upload einer kompletten Map inkl. Hintergrundbild |

---

### Nice-to-have / Langfristig
| # | Feature | Beschreibung |
|---|---|---|
| N1 | **Login / Benutzerverwaltung** | Grundstruktur (Burger-Menü) vorhanden, noch ohne Funktion |
| N2 | **Mehrsprachigkeit (i18n)** | DE/EN via JSON-Dictionary, kein Framework nötig |
| N3 | **Map-Vorlagen** | Vordefinierte Layouts (Stern, Hierarchie, Rechenzentrum) |
| N4 | **Mobile-Ansicht** | Touch-Events für Drag, Pinch-Zoom, responsive Breakpoints |
| N5 | **Benachrichtigungen** | Browser-Push bei CRITICAL-Statuswechsel (Web Push API) |
| N6 | **Historische Daten** | Verfügbarkeits-Diagramme via Checkmk REST-API |
| N7 | **Test-Coverage** | `ws_manager.py` + `main.py` aktuell bei 0 %, Ziel ≥ 70 % |
| N8 | **Map-Miniaturbilder** | Generierte Vorschaubilder in der Übersicht (canvas → PNG) |
| N9 | **Audit-Log** | Wer hat wann welche Map-Änderung gemacht |
| N10 | **URL-Routing** | `#/map/datacenter-hh` → öffnet Map direkt beim Laden, Bookmark-fähig |

---

## 📊 Fortschritts-Übersicht

```
Frontend-Shell      ████████████████████  100%
Map-Verwaltung      ████████████████░░░░   80%  (Auth fehlt)
Objekt-Typen        ████████████████░░░░   80%  (Service-Vollständigkeit)
Edit-Mode           ████████████████████  100%
Live-Status         ██████████████░░░░░░   70%  (echtes Livestatus fehlt)
Layer-System        ████████████████░░░░   80%
Kiosk-Modus         ████████████████████  100%
Backend API         ████████████░░░░░░░░   60%  (Auth, HTTPS, SQLite)
Tests               ████░░░░░░░░░░░░░░░░   20%  (nur Core-Tests)
Deployment          ██░░░░░░░░░░░░░░░░░░   10%  (Demo läuft, Produktion offen)
```

---

## 💡 Meine Empfehlungen

**Was ich für den größten Hebel halte:**

1. **Zoom & Pan (F1)** – ohne das ist NagVis auf großen Karten nicht nutzbar. Technisch einfach (CSS transform), hoher UX-Gewinn.

2. **Echte Status-Pills in der Übersicht (F3)** – aktuell stehen da immer „UP – / W – / C –". Das sieht unfertig aus und ist für den Betrieb wertlos.

3. **URL-Routing (N10)** – kostet 20 Zeilen, macht die App aber sofort bookmark- und verlinkbar. Sollte vor dem ersten echten Deployment rein.

4. **Auth (P6)** – auch HTTP Basic über nginx reicht für den Anfang. Ohne das darf NagVis 2 nicht im Netz stehen.

5. **Verbindungslinien mit Status (F2)** – das ist das, was NagVis von einem einfachen Dashboard unterscheidet. Eine Linie, die rot wird wenn ein Link down ist, ist ein Kern-Use-Case.