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
**Pro-Tipp:** Nutze den **Edit-Modus** (Hotkey `E`), um Objekte per Drag & Drop frei zu verschieben. Vergiss nicht, am Ende zu speichern!