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
| Statusleiste | Letztes Update, Heartbeat, Fehler |
| Pills (●OK ●WARN ●CRIT) | Schnellübersicht aller Hosts |
| Zoom-Buttons (+ −) | Canvas vergrößern/verkleinern |
| Burger-Menü (☰) | Alle Funktionen |

### Sidebar

- **Übersicht** – zeigt alle Maps als Kachelansicht
- **Maps-Liste** – direkter Zugriff auf einzelne Maps
- **Farbpunkte** – zeigen den schlechtesten Status der jeweiligen Map
- Sidebar ein-/ausklappen: Taste **B** oder Button unten links

### Snap-Ins (rechte Seite)

| Tab | Inhalt |
|---|---|
| Maps | Schnellnavigation zu allen Maps |
| Hosts | Live-Liste aller Hosts mit Status |
| Events | Stream von Statusänderungen |

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
- **Label** – Anzeigename unter dem Icon (leer = Name wird verwendet)
- **Label anzeigen** – Checkbox zum Ein-/Ausblenden des Labels

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

Visualisiert Metrikwerte grafisch:

| Typ | Beschreibung |
|---|---|
| Radial | Kreisförmige Anzeige (CPU, RAM) |
| Linear | Balkenanzeige |
| Sparkline | Zeitverlauf-Kurve |
| Thermometer | Temperaturanzeige |
| Flow/Weather | Bidirektionale Durchflussanzeige |
| Raw-Number | Numerischer Wert mit Einheit |

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

---

## Tastaturkürzel

| Taste | Funktion |
|---|---|
| **B** | Sidebar ein-/ausklappen |
| **Ctrl+E** | Edit-Mode umschalten |
| **R** | Status-Refresh erzwingen |
| **F11** | Kiosk-Modus / Vollbild |
| **Esc** | Auswahl aufheben / Dialog schließen / Edit-Mode beenden |
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

Blauer Banner am unteren Bildschirmrand zeigt an, dass keine Live-Daten vorhanden sind.

---

## Benutzereinstellungen

Burger-Menü → ⚙ Einstellungen:

- **Erscheinungsbild** – Dark / Light Theme
- **Sidebar beim Start** – ausgeklappt oder eingeklappt
- **Kiosk-Modus** – Sidebar/Topbar ausblenden, Auto-Refresh-Intervall
