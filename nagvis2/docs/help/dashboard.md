# Willkommen bei NagVis 2

NagVis 2 ist die moderne Visualisierungs-Schicht für dein Monitoring (Checkmk, Nagios, Icinga). Hier erfährst du, wie du in 3 Schritten deine erste Map baust.

### 1. Verbindung herstellen
Bevor du Icons siehst, muss NagVis wissen, woher die Daten kommen.
* Gehe zu **Verbindungen verwalten** (unten links oder im User-Menü).
* Füge eine Verbindung zu deinem Monitoring-Kern hinzu (z.B. Livestatus via TCP oder Unix-Socket).
* Wenn der Punkt **grün** leuchtet, fließen die Daten.

### 2. Die erste Map erstellen
Klicke in der Overview auf das große **＋ Neue Map** Feld.
* **Titel**: Ein sprechender Name (z.B. "Core-Netzwerk").
* **ID**: Ein kurzer technischer Name (nur Kleinbuchstaben und Bindestriche).
* **Canvas**: Wähle "Ratio 16:9" für moderne Monitore oder "Hintergrundbild", wenn du einen fertigen Netzplan hochladen willst.

### 3. Objekte platzieren
In einer offenen Map kannst du mit **Rechtsklick auf das Canvas** neue Objekte hinzufügen:
* **Host**: Überwacht einen kompletten Server/Switch.
* **Service**: Überwacht einen spezifischen Dienst (z.B. HTTP oder CPU-Last).
* **Line**: Verbindet zwei Objekte und zeigt die Bandbreite oder den Status der Verbindung.

---

### 4. Maps strukturieren (optional)

Sobald du mehrere Maps hast, kannst du sie in einer Hierarchie organisieren:

* **Root-Map**: Eine Map ohne übergeordnete Map – erscheint oben in der Sidebar und in der Übersicht.
* **Kind-Map**: Wird über **Burger-Menü → 🗺 Parent-Map setzen** einer Root-Map zugeordnet.
* In der Sidebar und Übersicht erscheinen Kind-Maps eingerückt (↳) direkt unter ihrer Root-Map.
* In der Topbar wird beim Öffnen einer Kind-Map ein `↑ Eltern-Map`-Link angezeigt – bei Root-Maps erscheinen die Kind-Maps als Chips.

---
**Pro-Tipp:** Nutze den **Edit-Modus** (Hotkey `Ctrl+E`), um Objekte per Drag & Drop frei zu verschieben. Die Position wird automatisch gespeichert – kein manuelles Speichern nötig!