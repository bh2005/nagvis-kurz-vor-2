# Monitoring-Verbindungen

NagVis 2 benötigt eine Datenquelle, um den Status deiner Objekte (Hosts/Services) anzuzeigen.

### Verbindungstypen
* **Checkmk / OMD**: Optimiert für Checkmk-Instanzen. Gib den Hostnamen und den Namen der Site an.
* **TCP Socket**: Nutzt den Livestatus-TCP-Port (Standard: `6557`). Stelle sicher, dass die Firewall diesen Port für den NagVis-Server freigibt.
* **Unix Socket**: Die performanteste Methode, wenn NagVis auf demselben Server wie das Monitoring läuft. 
    *Beispiel:* `/omd/sites/mysite/tmp/run/live`
* **Demo**: Lädt statische Beispieldaten. Ideal, um das Design zu testen, ohne ein echtes Backend anzubinden.

### Fehlerbehebung
Falls der Punkt in der Liste **rot** leuchtet, prüfe mit dem Button **🔌 Test**, ob der Socket erreichbar ist.