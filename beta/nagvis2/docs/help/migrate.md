# NagVis 1 Migration (.cfg)

Du kannst bestehende NagVis 1 Maps direkt importieren. Lade dazu einfach die `.cfg` Datei aus deinem alten `etc/maps/` Verzeichnis hoch.

### Was wird migriert?
* **Hosts & Services**: Werden automatisch erkannt und verknüpft.
* **Koordinaten**: Werden basierend auf der von dir angegebenen Ziel-Auflösung umgerechnet.
* **Statische Objekte**: Textboxen und Linien bleiben erhalten.

### Wichtige Hinweise
* **Icons**: NagVis 2 nutzt moderne Iconsets. Alte Pfadangaben zu Icons werden auf Standard-Werte gemappt.
* **Dry-Run**: Nutze die "Vorschau"-Option, um zu sehen, wie viele Objekte erkannt werden, bevor die Map tatsächlich gespeichert wird.