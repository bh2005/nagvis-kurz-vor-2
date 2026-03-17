"""
NagVis 2 – Demo-Daten (Backend)
Statische Host/Service-Daten für den Demo-Modus.
"""

DEMO_STATUS = [
    {
        "name": "srv-web-01", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "PING OK - 1.4ms",
        "services_ok": 8, "services_warn": 0, "services_crit": 1, "services_unkn": 0,
    },
    {
        "name": "srv-db-01", "state": 0, "state_label": "UP",
        "acknowledged": True, "in_downtime": True,
        "output": "PING OK - 0.8ms",
        "services_ok": 5, "services_warn": 1, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "srv-backup", "state": 1, "state_label": "DOWN",
        "acknowledged": False, "in_downtime": False,
        "output": "Connection refused",
        "services_ok": 0, "services_warn": 0, "services_crit": 3, "services_unkn": 0,
    },
    {
        "name": "srv-monitor", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "PING OK - 2.1ms",
        "services_ok": 12, "services_warn": 2, "services_crit": 0, "services_unkn": 0,
    },
]