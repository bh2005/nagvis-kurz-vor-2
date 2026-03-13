# deploy/

Deployment-Dateien für NagVis 2.

```
deploy/
├── install.sh          Installations-Skript (erkennt Umgebung automatisch)
├── nagvis2.service     Systemd-Unit (standalone)
└── omd-hook/
    └── nagvis2         OMD rc.d Hook (Checkmk-Sites)
```

## Schnellstart

```bash
# Automatische Erkennung (OMD wenn vorhanden, sonst systemd)
sudo bash deploy/install.sh

# Explizit OMD
sudo bash deploy/install.sh --mode omd --site cmk

# Explizit systemd
sudo bash deploy/install.sh --mode systemd

# Anderer Port / Host
sudo bash deploy/install.sh --port 8080 --host 0.0.0.0

# Deinstallation
sudo bash deploy/install.sh --uninstall
```

## Nach der Installation

### OMD
```bash
omd start <site>              # startet auch NagVis 2
omd start <site> nagvis2      # nur NagVis 2
omd status <site>
tail -f /omd/sites/<site>/var/log/nagvis2.log
```

### Systemd
```bash
systemctl status nagvis2
journalctl -u nagvis2 -f
systemctl restart nagvis2
```

## Startreihenfolge (OMD)

Der Hook heißt `85-nagvis2`. OMD führt rc.d-Skripte in alphanumerischer
Reihenfolge aus:

| Priorität | Dienst        |
|-----------|---------------|
| 10        | omd core      |
| 20        | rrdcached     |
| 80        | livestatus    |
| **85**    | **nagvis2**   |
| 90        | apache        |

NagVis 2 startet also nach Livestatus (notwendig) und vor Apache.

## Sicherheit

- Das NAGVIS_SECRET wird beim ersten Start automatisch erzeugt
  und in einer nur für den Service-User lesbaren Datei gespeichert.
- **OMD**: `$OMD_ROOT/etc/nagvis2/secret` (Modus 600, Besitz: site-user)
- **Systemd**: `/etc/nagvis2/secret` (Modus 600, Besitz: nagvis2)