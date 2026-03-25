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
    # Applikations-Stack (demo-appstack Map)
    {
        "name": "nagvis2-frontend", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "HTTP OK - 200 in 4ms",
        "services_ok": 3, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "nagvis2-backend", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "Process running, PID 1 - FastAPI/Uvicorn",
        "services_ok": 3, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "nagvis2-auth", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "JWT Auth OK - 2 active sessions",
        "services_ok": 1, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "nagvis2-mapstore", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "OK - 5 maps, data/ writable",
        "services_ok": 1, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "nagvis2-ws", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "OK - 3 active WebSocket connections",
        "services_ok": 1, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "nagvis2-livestatus", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "Livestatus TCP OK - 0.8ms",
        "services_ok": 1, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "nagvis2-checkmk", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "Checkmk REST API OK - 200",
        "services_ok": 1, "services_warn": 1, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "nagvis2-icinga2", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "Icinga2 REST API OK - 200",
        "services_ok": 1, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "nagvis2-zabbix", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "Zabbix JSON-RPC OK - auth token valid",
        "services_ok": 1, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "nagvis2-prometheus", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "Prometheus API OK - 247 active series",
        "services_ok": 1, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    # Europa-Standorte (demo-europe OSM Map)
    {
        "name": "srv-eu-fra-01", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "PING OK - 0.3ms",
        "services_ok": 14, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "srv-eu-ams-01", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "PING OK - 2.1ms",
        "services_ok": 11, "services_warn": 1, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "srv-eu-lon-01", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "PING OK - 3.8ms",
        "services_ok": 9, "services_warn": 2, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "srv-eu-par-01", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "PING OK - 1.7ms",
        "services_ok": 10, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "rt-eu-mad-01", "state": 1, "state_label": "DOWN",
        "acknowledged": False, "in_downtime": False,
        "output": "ICMP CRITICAL - 100% packet loss",
        "services_ok": 0, "services_warn": 0, "services_crit": 2, "services_unkn": 0,
    },
    {
        "name": "srv-eu-mil-01", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "PING OK - 1.2ms",
        "services_ok": 7, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "srv-eu-war-01", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "PING OK - 4.5ms",
        "services_ok": 8, "services_warn": 1, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "sw-eu-vie-01", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": True,
        "output": "PING OK - 0.9ms",
        "services_ok": 6, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "srv-eu-sto-01", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "PING OK - 5.2ms",
        "services_ok": 9, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
    },
    {
        "name": "fw-eu-lis-01", "state": 0, "state_label": "UP",
        "acknowledged": False, "in_downtime": False,
        "output": "PING OK - 6.1ms",
        "services_ok": 5, "services_warn": 0, "services_crit": 0, "services_unkn": 0,
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
    # nagvis2-backend Services (demo-appstack Map)
    {
        "host_name": "nagvis2-backend", "description": "REST API /api/v1",
        "state": 0, "state_label": "OK",
        "output": "OK - HTTP 200, avg 12ms, 1240 req/s",
        "acknowledged": False, "in_downtime": False, "last_check": 0,
        "perfdata": {
            "requests_per_sec": {"value": 1240.0, "unit": "req/s", "warn": 5000.0, "crit": 8000.0, "min": 0.0, "max": 10000.0},
            "response_time_ms": {"value": 12.0,   "unit": "ms",    "warn": 500.0,  "crit": 2000.0, "min": 0.0, "max": 5000.0},
        },
    },
    {
        "host_name": "nagvis2-backend", "description": "WebSocket /ws",
        "state": 0, "state_label": "OK",
        "output": "OK - 3 active connections, 10 req/s",
        "acknowledged": False, "in_downtime": False, "last_check": 0,
        "perfdata": {
            "ws_connections": {"value": 3.0,  "unit": "",      "warn": 500.0,  "crit": 1000.0, "min": 0.0, "max": 1000.0},
            "ws_messages":    {"value": 10.0, "unit": "msg/s", "warn": 1000.0, "crit": 5000.0, "min": 0.0, "max": 10000.0},
        },
    },
    {
        "host_name": "nagvis2-backend", "description": "Prometheus Metrics",
        "state": 0, "state_label": "OK",
        "output": "OK - /metrics reachable, 247 series",
        "acknowledged": False, "in_downtime": False, "last_check": 0,
        "perfdata": {
            "metric_series": {"value": 247.0, "unit": "", "warn": 5000.0, "crit": 10000.0, "min": 0.0, "max": 10000.0},
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