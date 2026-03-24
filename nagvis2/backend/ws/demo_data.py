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

# Demo-Services mit Perfdata (für Gadget Live-Werte auf der demo-features Map)
DEMO_SERVICES = [
    {
        "host_name": "srv-web-01", "description": "CPU Load",
        "state": 0, "state_label": "OK",
        "output": "OK - load average: 0.42, 0.38, 0.31",
        "acknowledged": False, "in_downtime": False, "last_check": 0,
        "perfdata": {
            "load1":  {"value": 42.0, "unit": "%", "warn": 70.0, "crit": 90.0, "min": 0.0, "max": 100.0},
            "load5":  {"value": 38.0, "unit": "%", "warn": 70.0, "crit": 90.0, "min": 0.0, "max": 100.0},
            "load15": {"value": 31.0, "unit": "%", "warn": 70.0, "crit": 90.0, "min": 0.0, "max": 100.0},
        },
    },
    {
        "host_name": "srv-web-01", "description": "Memory",
        "state": 1, "state_label": "WARNING",
        "output": "WARNING: RAM 78% used",
        "acknowledged": False, "in_downtime": False, "last_check": 0,
        "perfdata": {
            "mem_used_percent": {"value": 78.0, "unit": "%", "warn": 75.0, "crit": 90.0, "min": 0.0, "max": 100.0},
        },
    },
    {
        "host_name": "srv-web-01", "description": "Traffic",
        "state": 0, "state_label": "OK",
        "output": "OK - In: 68 Mbps, Out: 42 Mbps",
        "acknowledged": False, "in_downtime": False, "last_check": 0,
        "perfdata": {
            "traffic_in":  {"value": 68.0,  "unit": "Mbps", "warn": 800.0, "crit": 950.0, "min": 0.0, "max": 1000.0},
            "traffic_out": {"value": 42.0,  "unit": "Mbps", "warn": 800.0, "crit": 950.0, "min": 0.0, "max": 1000.0},
        },
    },
    {
        "host_name": "srv-db-01", "description": "Disk I/O",
        "state": 0, "state_label": "OK",
        "output": "OK - Read: 3.6 MB/s, Write: 1.2 MB/s",
        "acknowledged": False, "in_downtime": False, "last_check": 0,
        "perfdata": {
            "read_bytes":  {"value": 3752960.0,  "unit": "B/s", "warn": 157286400.0, "crit": 188743680.0, "min": 0.0, "max": 209715200.0},
            "write_bytes": {"value": 1258291.0,  "unit": "B/s", "warn": 157286400.0, "crit": 188743680.0, "min": 0.0, "max": 209715200.0},
        },
    },
    {
        "host_name": "srv-monitor", "description": "CPU Temp",
        "state": 0, "state_label": "OK",
        "output": "OK - CPU temperature: 62°C",
        "acknowledged": False, "in_downtime": False, "last_check": 0,
        "perfdata": {
            "temp": {"value": 62.0, "unit": "°C", "warn": 70.0, "crit": 85.0, "min": 0.0, "max": 100.0},
        },
    },
]