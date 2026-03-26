"""
connectors/demo_client.py
=========================
Demo-Backend – liefert statische Musterdaten ohne echte Verbindung.

Kann als Datenquelle mit type="demo" in backends.json eingetragen werden.
Nützlich für Präsentationen, Tests und als Fallback ohne Monitoring-System.
"""

import time
from dataclasses import dataclass

from livestatus.client import BackendHealth, HostStatus, ServiceStatus
from ws.demo_data import DEMO_STATUS, DEMO_SERVICES


@dataclass
class DemoConfig:
    backend_id: str  = "demo"
    enabled:    bool = True


class DemoClient:
    """
    Pseudo-Client mit statischen Demo-Daten.
    Interface identisch zu LivestatusClient / CheckmkClient.
    """

    def __init__(self, config: DemoConfig):
        self.cfg = config

    async def get_hosts(self) -> list[HostStatus]:
        return [
            HostStatus(
                name              = h["name"],
                alias             = h["name"],
                state             = h["state"],
                state_label       = h["state_label"],
                plugin_output     = h.get("output", ""),
                last_check        = int(time.time()),
                acknowledged      = h.get("acknowledged", False),
                in_downtime       = h.get("in_downtime", False),
                num_services_ok   = h.get("services_ok",   0),
                num_services_warn = h.get("services_warn",  0),
                num_services_crit = h.get("services_crit",  0),
                num_services_unkn = h.get("services_unkn",  0),
                backend_id        = self.cfg.backend_id,
            )
            for h in DEMO_STATUS
        ]

    async def get_services(self) -> list[ServiceStatus]:
        return [
            ServiceStatus(
                host_name     = s["host_name"],
                description   = s["description"],
                state         = s["state"],
                state_label   = s["state_label"],
                plugin_output = s.get("output", ""),
                last_check    = int(time.time()),
                acknowledged  = s.get("acknowledged", False),
                in_downtime   = s.get("in_downtime", False),
                perf_data     = s.get("perfdata", ""),
                backend_id    = self.cfg.backend_id,
            )
            for s in DEMO_SERVICES
        ]

    async def get_hostgroups(self) -> list[dict]:
        return [
            {"name": "web-servers", "members": ["srv-web-01"]},
            {"name": "db-servers",  "members": ["srv-db-01"]},
            {"name": "all-servers", "members": ["srv-web-01", "srv-db-01", "srv-backup", "srv-monitor"]},
        ]

    async def ping(self) -> BackendHealth:
        return BackendHealth(
            backend_id = self.cfg.backend_id,
            reachable  = True,
            latency_ms = 0.0,
            last_ok    = time.time(),
        )

    async def schedule_host_downtime(
        self, host_name: str, start_time: int, end_time: int,
        comment: str = "NagVis 2", author: str = "nagvis2", child_hosts: bool = False,
    ) -> bool:
        return True

    async def schedule_service_downtime(
        self, host_name: str, service_description: str,
        start_time: int, end_time: int,
        comment: str = "NagVis 2", author: str = "nagvis2",
    ) -> bool:
        return True

    async def acknowledge_host(
        self, host_name: str, comment: str = "NagVis 2", author: str = "nagvis2",
    ) -> bool:
        return True

    async def acknowledge_service(
        self, host_name: str, service_description: str,
        comment: str = "NagVis 2", author: str = "nagvis2",
    ) -> bool:
        return True

    async def reschedule_host_check(self, host_name: str) -> bool:
        return True
