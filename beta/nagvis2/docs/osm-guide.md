# NagVis 2 – OpenStreetMap / Weltkarte

## Übersicht

Der Canvas-Modus **OpenStreetMap** ersetzt das normale Canvas durch eine interaktive Leaflet-Karte. Nodes werden anhand geographischer Koordinaten (Breitengrad / Längengrad) auf der Karte positioniert statt mit x%/y%-Prozentangaben.

---

## Voraussetzungen

Der OSM-Modus benötigt eine Internet-Verbindung zum Standard-Tile-Server (`tile.openstreetmap.org`) – oder einen intern erreichbaren Tile-Server (z.B. einen selbst gehosteten OSM-Stack mit [tile-server-ubuntu](https://github.com/Overv/openstreetmap-tile-server)).

---

## Map auf OSM-Modus umstellen

1. Map öffnen
2. Burger-Menü → **⊡ Canvas-Format ändern**
3. Option **🗺 OpenStreetMap** wählen
4. Optional: Tile-Server URL, Start-Koordinaten (Lat/Lng) und Zoom-Stufe eintragen
5. **Übernehmen** klicken – die Map wird neu geladen

---

## Nodes positionieren

### Koordinatenformat

Im OSM-Modus werden die Felder `x` und `y` eines Objekts als geographische Koordinaten interpretiert:

| Feld | Bedeutung | Beispiel |
|---|---|---|
| `x` | Breitengrad (Latitude) | `51.5074` (London) |
| `y` | Längengrad (Longitude) | `-0.1278` (London) |

### Node platzieren (Edit-Mode)

1. **Ctrl+E** → Edit-Mode aktivieren
2. Klick auf die Karte an der gewünschten Position → Add-Object-Dialog öffnet sich
3. Typ und Name eintragen → **Platzieren**

### Node verschieben (Edit-Mode)

Im Edit-Mode ist jeder Marker per **Drag & Drop** verschiebbar. Die neue Position wird automatisch über die API gespeichert (kein manuelles Speichern nötig).

---

## Tile-Server konfigurieren

### OpenStreetMap (Standard)

Tile-URL-Feld leer lassen – NagVis 2 verwendet automatisch:
```
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

### Eigener Tile-Server

Tile-URL mit den Leaflet-Platzhaltern `{z}`, `{x}`, `{y}` und optional `{s}` für Subdomains:

```
http://tiles.intern.example.com/{z}/{x}/{y}.png
http://a.tiles.intern.example.com/{z}/{x}/{y}.png
```

---

## Zoom & Pan

Leaflet übernimmt im OSM-Modus die komplette Zoom/Pan-Steuerung:

| Aktion | Methode |
|---|---|
| Zoomen | Mausrad oder Leaflet-Zoom-Buttons (+ / −) |
| Schwenken | Maus gedrückt halten + ziehen |
| Doppelklick | Zoom-In zum Punkt |
| Touch / Pinch | Pinch-Zoom auf Touchscreens |

Die NagVis-Topbar-Zoom-Buttons (+ − ⊙) sind im OSM-Modus ausgeblendet.

---

## Status-Anzeige

Nodes zeigen denselben Status wie im normalen Canvas-Modus:

| Status | Farbe |
|---|---|
| UP / OK | Grün |
| DOWN / CRITICAL | Rot |
| WARNING | Gelb |
| UNKNOWN / UNREACHABLE | Orange |
| ACK (bestätigt) | Gedimmt + Häkchen |
| Downtime | Gedimmt + Schraubenschlüssel |

Rechtsklick auf einen Node öffnet das gewohnte Aktions-Menü (ACK, Downtime, SSH, ...).

---

## Kartenpositon speichern

Wenn der Benutzer die Karte verschiebt oder zoomt, wird die aktuelle Ansicht (Lat, Lng, Zoom) automatisch in der Map-Konfiguration gespeichert – die Map öffnet beim nächsten Aufruf am selben Ort.

---

## Einschränkungen im OSM-Modus

| Feature | Status |
|---|---|
| Linien / Weathermap | ✖ Nicht verfügbar (canvas-basiert) |
| Gadgets | ✖ Nicht verfügbar (canvas-basiert) |
| Container (SVG/Bild) | ✖ Nicht verfügbar |
| Hintergrundbild | ✖ Nicht relevant (Karte ist der Hintergrund) |
| Hosts, Services, Gruppen, Map-Nodes | ✔ Vollständig |
| Textbox | ✖ Nicht verfügbar |
| Kiosk-Modus | ✔ Funktioniert |
| Echtzeit-Status via WebSocket | ✔ Funktioniert |
| Multi-Select / Layer | ✖ Nicht verfügbar |

---

## Wechsel zurück zum normalen Canvas

Burger-Menü → **⊡ Canvas-Format ändern** → **Frei**, **Seitenverhältnis** oder **Feste Auflösung** wählen → **Übernehmen**.

> **Hinweis:** Die Nodes behalten ihre lat/lng-Werte als x/y. Im normalen Canvas-Modus werden diese als Prozentangaben interpretiert (z.B. `51.0` → 51%). Eine manuelle Positionskorrektur kann nötig sein.
