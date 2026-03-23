# NagVis 2 – Benutzer-Handbuch

## Übersicht

NagVis 2 visualisiert den Status deiner Monitoring-Umgebung (Nagios / Checkmk / Icinga) auf interaktiven Karten. Nodes auf der Karte zeigen den aktuellen Status von Hosts, Services, Hostgruppen und mehr in Echtzeit via WebSocket.

---

## Oberfläche

```
┌─────────────┬──────────────────────────────────────────┐
│             │  Topbar (Logo · Status · Zoom · Menü)     │
│  Sidebar    ├──────────────────────────────────────────┤
│             │                                           │
│  Navigation │            Map-Canvas                     │
│  Maps       │         (Nodes / Objekte)                 │
│             │                                           │
│             ├──────────────────────────────────────────┤
│             │  Snap-Ins: Maps | Hosts | Events          │
└─────────────┴──────────────────────────────────────────┘
```

### Topbar

| Element | Funktion |
|---|---|
| Logo | Zurück zur Übersicht |
| Verbindungspunkt | Grün = Livestatus verbunden |
| Map-Titel / Untertitel | Name und Objekt-Anzahl der aktiven Map |
| **Navigation** | Bei Kind-Map: `↑ Eltern-Map` als Link; bei Root-Map: `↳ Kind1` `↳ Kind2` als Chips |
| Pills (●OK ●WARN ●CRIT) | Schnellübersicht aller Hosts |
| Zoom-Buttons (+ −) | Canvas vergrößern/verkleinern |
| Burger-Menü (☰) | Alle Funktionen |

### Sidebar

- **Übersicht** – zeigt alle Maps als Kachelansicht
- **Maps-Liste** – direkter Zugriff auf einzelne Maps; Root-Maps oben, Kind-Maps darunter eingerückt (↳)
- **Farbpunkte** – zeigen den schlechtesten Status der jeweiligen Map
- **Layer-Panel** – erscheint beim Öffnen einer Map; Layer ein-/ausblenden, umbenennen, per Drag umsortieren und löschen
- Sidebar ein-/ausklappen: Taste **B** oder Button unten links

### Snap-Ins (rechte Seite)

| Tab | Inhalt |
|---|---|
| Maps | Schnellnavigation zu allen Maps |
| Hosts | Live-Liste aller Hosts mit Status |
| Events | Stream von Statusänderungen |

### Burger-Menü (☰)

| Eintrag | Beschreibung |
|---|---|
| ＋ Neue Map erstellen | Neue Map anlegen |
| ✏ Bearbeiten / Fertig | Edit-Mode umschalten |
| 🖼 Hintergrund hochladen | Hintergrundbild für aktive Map |
| ✎ Umbenennen | Titel der aktiven Map ändern |
| 🗺 Parent-Map setzen | Map in Hierarchie einordnen |
| ⊡ Canvas-Format ändern | Format + Node-Verhalten anpassen |
| 📤 Map exportieren | ZIP-Archiv herunterladen |
| 📥 Map importieren | ZIP-Archiv einspielen |
| ↑ NagVis 1 importieren | .cfg-Datei migrieren |
| 🗑 Map löschen | Aktive Map dauerhaft löschen |
| ⛶ Kiosk / Vollbild | Kiosk-Modus umschalten |
| ⬛ Kiosk-User verwalten | Token-URLs für Displays anlegen |
| ⚙ Backends verwalten | Monitoring-Backends konfigurieren |
| ⚡ Aktionen konfigurieren | URL-Templates für Monitoring-Aktionen |
| ⚙ Einstellungen | Theme, Sidebar, Kiosk-Optionen |
| ☰ Hilfe | Handbücher (öffnen im neuen Fenster) |
| </> Swagger UI | REST-API-Dokumentation (`/api/v1/docs`) |
| ℹ Über NagVis 2 | Version, GitHub-Link, Changelog-Viewer |

---

## Maps

### Map erstellen

1. Burger-Menü → **＋ Neue Map erstellen**
2. Titel eingeben (ID wird automatisch aus dem Titel abgeleitet)
3. Canvas-Format wählen:
   - **Frei** – füllt das Fenster, responsiv
   - **Seitenverhältnis** – 16:9, 4:3, 21:9, etc.
   - **Feste Auflösung** – z.B. 1920×1080 px
   - **Hintergrundbild** – Canvas passt sich an das Bild an

Die neue Map öffnet sich direkt im Edit-Mode.

### Map öffnen

Klick auf den Map-Namen in der Sidebar oder in der Übersicht.

### Map verwalten

Über das **Burger-Menü** (☰) stehen folgende Aktionen für die aktive Map bereit:

| Aktion | Beschreibung |
|---|---|
| ✏ Bearbeiten | Edit-Mode aktivieren (Ctrl+E) |
| 🖼 Hintergrund hochladen | PNG, JPG, SVG, WebP als Hintergrundbild |
| ✎ Umbenennen | Titel der Map ändern |
| 🗺 Parent-Map setzen | Map in Hierarchie einordnen |
| ⊡ Canvas-Format ändern | Format nachträglich anpassen |
| 📤 Map exportieren | ZIP-Archiv mit Map + Hintergrundbild |
| 🗑 Map löschen | Map und Hintergrundbild dauerhaft löschen |

### Map importieren / migrieren

- **ZIP-Import** (NagVis-2-Format): Burger → 📥 Map importieren
- **NagVis-1-Migration** (.cfg-Datei): Burger → ↑ NagVis 1 importieren

---

## Edit-Mode

### Aktivieren / Deaktivieren

- Taste **Ctrl+E**
- Burger-Menü → ✏ Bearbeiten / Fertig

Im Edit-Mode erscheint ein blauer Banner oben auf der Karte.

### Objekt platzieren

**Option A:** Linksklick auf freie Canvas-Fläche → Dialog öffnet sich
**Option B:** Rechtsklick auf freie Canvas-Fläche → Kontext-Menü → **＋ Objekt hier platzieren**
**Option C:** Topbar-Button **＋ Objekt**

### Objekt verschieben

Im Edit-Mode: Objekt per **Drag & Drop** verschieben. Die Position wird automatisch gespeichert.

> **Hinweis:** Standardmäßig bleiben Nodes innerhalb der Canvas-Fläche (0–100%).
> Dieses Verhalten kann unter **Canvas-Format ändern → Node-Verhalten** auf **Frei** umgestellt werden.

### Multi-Select

Mehrere Objekte gleichzeitig auswählen und bearbeiten:

| Aktion | Methode |
|---|---|
| Einzelne Auswahl | Klick auf ein Objekt (blauer Rahmen) |
| Zur Auswahl hinzufügen | **Shift+Klick** auf weiteres Objekt |
| Aus Auswahl entfernen | **Shift+Klick** auf bereits gewähltes Objekt |
| Lasso-Auswahl | Mousedown auf **leerer Canvas-Fläche** → Rechteck aufziehen |
| Auswahl aufheben | **Esc** oder Klick auf leere Fläche |
| Gruppe verschieben | Beliebiges ausgewähltes Objekt ziehen – alle bewegen sich mit |
| Gruppe löschen | **Delete** / **Backspace** oder Rechtsklick → Gruppe löschen |

### Objekt-Kontext-Menü (Edit-Mode)

Rechtsklick auf ein Objekt im Edit-Mode:

| Eintrag | Verfügbar für |
|---|---|
| ⚙ Eigenschaften | Host, Service, Hostgruppe, Servicegruppe, Map |
| ⤢ Größe ändern | Alle außer Textbox, Gadget |
| 🖼 Iconset wechseln | Host, Service, Hostgruppe, Servicegruppe, Map |
| ◫ Layer zuweisen | Alle |
| ✏ Text bearbeiten | Textbox |
| ⚙ Gadget konfigurieren | Gadget |
| 🗑 Entfernen | Alle |

### Eigenschaften-Dialog (Monitoring-Nodes)

Über **⚙ Eigenschaften** im Kontext-Menü:
- **Name** – Hostname, Hostgruppen-Name oder Map-ID (mit Autocomplete aus Livestatus)
- **Hostname + Service-Name** – bei Services
- **Label-Template** – dynamische Beschriftung mit Nagios-Macros und Checkmk-Labels (siehe unten)
- **Statisches Label** – fester Anzeigename; wird ignoriert wenn ein Template gesetzt ist
- **Label anzeigen** – Checkbox zum Ein-/Ausblenden des Labels

### Label-Templates

Nodes können dynamische Beschriftungen erhalten, die bei jedem Status-Update neu aufgelöst werden.

**Verfügbare Macros:**

| Macro | Wert |
|---|---|
| `$HOSTNAME$` | Host-Name |
| `$HOSTALIAS$` | Alias des Hosts |
| `$HOSTSTATE$` | `UP` / `DOWN` / `UNREACHABLE` |
| `$HOSTOUTPUT$` | Plugin-Ausgabe des Hosts |
| `$SERVICEDESC$` | Service-Beschreibung |
| `$SERVICESTATE$` | `OK` / `WARNING` / `CRITICAL` / `UNKNOWN` |
| `$SERVICEOUTPUT$` | Plugin-Ausgabe des Services |
| `$LABEL:key$` | Checkmk-Label oder Nagios-Custom-Variable (lowercase) |
| `$MAPNAME$` | ID der aktiven Map |

**Beispiele:**

```
$HOSTNAME$ ($HOSTSTATE$)          → "webserver-01 (DOWN)"
$HOSTALIAS$                       → "Webserver Hamburg"
$LABEL:os$ / $LABEL:location$     → "linux / hamburg"
$LABEL:env$ – $HOSTNAME$          → "production – webserver-01"
$SERVICESTATE$: $SERVICEOUTPUT$   → "CRITICAL: HTTP timeout after 30s"
```

**Checkmk-Labels** werden automatisch aus `extensions.labels` der Checkmk REST API bzw. aus `custom_variables` (Livestatus) importiert. Der führende Unterstrich wird entfernt: `_OS` → `$LABEL:os$`.

### Canvas Rechtsklick-Menü

Rechtsklick auf freie Fläche im Edit-Mode:

| Eintrag | Funktion |
|---|---|
| ＋ Objekt hier platzieren | Dialog mit vorausgefüllter Position |
| ⊡ Canvas-Format ändern | Canvas-Einstellungen öffnen |
| 🖼 Hintergrund hochladen | Datei-Auswahl |

---

## Objekt-Typen

### Host / Service / Hostgruppe / Servicegruppe

Zeigen den aktuellen Monitoring-Status mit farbigen Icons:

| Status | Farbe |
|---|---|
| UP / OK | Grün |
| DOWN / CRITICAL | Rot |
| WARNING | Gelb |
| UNKNOWN / UNREACHABLE | Orange |
| ACK (bestätigt) | Gedimmt + Häkchen |
| Downtime | Gedimmt + Schraubenschlüssel |

Verfügbare Iconsets: `std_small`, `server`, `router`, `switch`, `firewall`, `storage`, `database`, `ups`, `ap`

### Map (nested)

Referenziert eine andere NagVis-2-Map. Der Status zeigt den schlechtesten Status aller Objekte auf der Ziel-Map.

### Textbox

Beschriftungsfeld auf der Karte. Konfigurierbar: Text, Schriftgröße, Farbe, Hintergrund, Fettschrift, Link.

### Linie

Einfache Verbindungslinie zwischen zwei Punkten.
Mit Option **🌡 Weathermap**: Linie färbt sich nach dem Status der verknüpften Hosts.

### Container

Zeigt ein Bild (PNG, SVG) an einem festen Punkt auf der Karte.

### Gadget

Visualisiert Metrikwerte grafisch — entweder als statischer Demo-Wert oder mit Live-Daten aus Performance-Daten (Perfdata).

| Typ | Beschreibung |
|---|---|
| ⏱ Radial | Kreisförmige Anzeige (CPU, RAM, ...) |
| ▬ Linear Horizontal | Balken von links nach rechts |
| ▬ Linear Vertikal | Balken von unten nach oben |
| 〜 Sparkline | Zeitverlauf-Kurve mit konfigurierbarer Datenpunkt-Anzahl |
| 🌡 Thermometer | Temperatur / Füllstand |
| → Flow / Weather | Uni- oder bidirektionale Durchflussanzeige |
| 🔢 Raw-Number | Numerischer Wert mit Divisor und Einheit |

#### Gadget konfigurieren

Rechtsklick auf Gadget → **⚙ Gadget konfigurieren**:

| Feld | Beschreibung |
|---|---|
| **Anzeigetyp** | Typ des Gadgets wählen |
| **Host** | Monitoring-Host (Autocomplete aus Live-Daten) |
| **Service** | Service-Description (Autocomplete) |
| **Perfdata-Metrik** | Perfdata-Schlüssel des Monitoring-Checks (z.B. `load1`, `mem_used_percent`) |
| **Bezeichnung** | Anzeige-Label unter dem Gadget |
| **Einheit** | Maßeinheit (z.B. `%`, `°C`, `Mbps`) |
| **Min / Max** | Skalierungsbereich |
| **Warning / Critical** | Schwellenwerte (Warn = gelb, Crit = rot) |
| **Orientierung** | Horizontal oder Vertikal (nur Linear) |
| **Datenpunkte** | Maximale History-Länge (nur Sparkline, 5–100) |
| **Divisor / Anzeigeeinheit / Nachkommastellen** | Wertumrechnung (nur Raw-Number) |
| **Richtung** | Ausgehend / Eingehend / Bidirektional (nur Flow) |
| **Demo-Wert** | Statischer Testwert wenn kein Host konfiguriert |
| **Anzeigegröße** | Skalierung des Gadgets (40–300%) |

> **Perfdata-Vorrang:** Wenn Host + Service gesetzt sind, werden `warn`/`crit`/`min`/`max` aus den Perfdata automatisch übernommen — eigene Werte im Dialog haben jedoch immer Vorrang.

Die **Live-Vorschau** am unteren Dialogrand aktualisiert sich bei jeder Änderung sofort.

---

## View-Mode Aktionen (Rechtsklick auf Hosts/Services)

Im normalen Anzeigemodus (kein Edit-Mode) öffnet Rechtsklick auf einen Host/Service ein Aktionsmenü:

| Aktion | Bedingung |
|---|---|
| 🔍 Im Monitoring öffnen | Monitoring-URL konfiguriert |
| ✔ Problem bestätigen (ACK) | Status nicht OK, nicht bereits ACK |
| ✖ Bestätigung aufheben | Bereits ACK |
| 🔧 Wartung einplanen | Immer verfügbar |
| ↻ Check jetzt erzwingen | Immer verfügbar |
| 🖥 SSH / 🌐 HTTP / 🔒 HTTPS | Immer verfügbar |
| 📊 Grafana öffnen | Grafana-URL konfiguriert |

Aktionen konfigurieren: Burger-Menü → ⚡ Aktionen konfigurieren

---

## Zoom & Pan

| Aktion | Methode |
|---|---|
| Vergrößern | Topbar **＋** oder Mausrad |
| Verkleinern | Topbar **−** oder Mausrad |
| Schwenken | Maus gedrückt halten + ziehen |
| Zoom zurücksetzen | Topbar **⊙** |

Zoom und Pan funktionieren identisch im normalen Modus und im Kiosk-Modus — alle Objekte (Nodes, SVG-Linien, Weathermap) werden gemeinsam transformiert.

---

## Tastaturkürzel

| Taste | Funktion |
|---|---|
| **B** | Sidebar ein-/ausklappen |
| **Ctrl+E** | Edit-Mode umschalten |
| **R** | Status-Refresh erzwingen |
| **F11** | Kiosk-Modus / Vollbild |
| **Esc** | Auswahl aufheben → Dialog schließen → Edit-Mode beenden |
| **Shift+Klick** | Node zur Multi-Selektion hinzufügen (Edit-Mode) |
| **Delete** / **Backspace** | Ausgewählte Nodes löschen (Edit-Mode) |

---

## Status-Anzeige

### Verbindungspunkt (Topbar)

| Farbe | Bedeutung |
|---|---|
| Grün | Livestatus verbunden |
| Grau | Verbindung wird hergestellt |
| Rot | Getrennt |

### Offline-Banner

Wenn die WebSocket-Verbindung unterbrochen wird, erscheint ein roter Banner auf der Karte. Nodes werden gedimmt um anzuzeigen dass die Daten veraltet sein könnten. Der Banner verschwindet automatisch bei Wiederverbindung.

### Demo-Modus-Banner

Blauer Banner am unteren Bildschirmrand zeigt an, dass keine Live-Daten vorhanden sind. Die Demo-Map **„NagVis 2 – Feature Demo"** öffnet sich automatisch und zeigt alle Gadget-Typen mit Demo-Perfdata.

### Toast-Benachrichtigungen

Kurze Statusmeldungen oben rechts:

| Typ | Farbe | Beispiel |
|---|---|---|
| OK | Grün | „Gadget CPU Load aktualisiert" |
| Info | Blau | „Map gespeichert" |
| Warning | Gelb | „Verbindung unterbrochen" |
| Error | Rot | „Backend nicht erreichbar" |

---

## Layer-System

Auf jeder Map können Objekte verschiedenen **Layern** zugewiesen werden, um Sichtbarkeit und Render-Reihenfolge zu steuern.

### Layer-Panel (Sidebar)

Das Layer-Panel erscheint in der Sidebar, sobald eine Map geöffnet wird. Pro Layer gibt es:

| Element | Funktion |
|---|---|
| ⠿ Drag-Handle | Layer per Drag & Drop umsortieren → ändert den Z-Index aller zugehörigen Objekte |
| 👁 / 🚫 Checkbox | Layer ein- oder ausblenden |
| Name (Doppelklick) | Layer umbenennen |
| Z-Index-Anzeige | Aktueller Z-Index (10, 20, 30, …) |
| ✕ Löschen | Layer entfernen; Objekte werden auf Layer 0 verschoben (mit Bestätigung) |

### Layer zuweisen

Im Edit-Mode: Rechtsklick auf ein Objekt → **◫ Layer zuweisen** → vorhandenen Layer wählen oder neue Layer-ID + Name eingeben.

---

## Map-Hierarchie

### Sidebar

Root-Maps (keine übergeordnete Map) erscheinen direkt in der Liste. Kind-Maps sind eingerückt und mit einem `↳` markiert:

```
◉ Rechenzentrum Nord
  ↳ Server-Raum A
  ↳ Server-Raum B
◉ Standort Frankfurt
  ↳ DMZ
```

### Übersicht (Kachelansicht)

Die Kacheln folgen derselben Reihenfolge. Kind-Karten haben einen dezenten linken Akzentbalken und zeigen den Titel der Eltern-Map an.

### Topbar-Navigation

- **Kind-Map geöffnet** → `↑ Eltern-Map-Titel`-Button in der Topbar → Klick öffnet die Eltern-Map
- **Root-Map geöffnet** → Kind-Map-Chips erscheinen in der Topbar → Klick öffnet die jeweilige Kind-Map

### Parent-Map setzen

Burger-Menü → **🗺 Parent-Map setzen** → gewünschte Root-Map wählen.

---

## Benutzereinstellungen

Burger-Menü → ⚙ Einstellungen:

- **Erscheinungsbild** – Dark / Light Theme (Standard: **Dark**)
- **Sidebar beim Start** – ausgeklappt oder eingeklappt (Standard: **ausgeklappt**)
- **Kiosk-Modus** – Sidebar/Topbar ausblenden, Auto-Refresh-Intervall (30s / 1min / 2min / 5min)
