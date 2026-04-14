"""
naemon/client.py
================
Naemon Monitoring – Async Client

Naemon ist ein Nagios-Fork mit aktivem Community-Support.
Unterstützt sowohl den klassischen Livestatus-Socket als auch
die neuere Naemon REST API (ab ~1.2.x).

Verbindungsvarianten:
  livestatus_unix  – Unix-Socket  /var/cache/naemon/live  (Standard)
  livestatus_tcp   – TCP Livestatus  (z. B. MK Livestatus-Proxy)
  rest             – Naemon REST API  (http://host:8080/naemon/api/v1)

Naemon Livestatus-Socket prüfen:
  ls -la /var/cache/naemon/live
  echo -e "GET hosts\\nColumns: name state\\n\\n" | unixcat /var/cache/naemon/live

Naemon REST API aktivieren (naemon.cfg):
  broker_module=/usr/lib/naemon/naemon-livestatus/livestatus.so /var/cache/naemon/live
  # REST-API wird über den eingebetteten HTTP-Server bereitgestellt
"""

from __future__ import annotations

import asyncio
import logging
import socket
import time
from dataclasses import dataclass, field
from typing import Literal

import httpx

from livestatus.client import (
    BackendHealth,
    HostStatus,
    ServiceStatus,
    HOST_STATE_LABEL,
    SERVICE_STATE_LABEL,
    LivestatusClient,
    LivestatusConfig,
)

log = logging.getLogger("nagvis.naemon")

# Naemon-Livestatus liefert die gleichen Statuscodes wie Nagios/Naemon
_HOST_STATE = {0: "UP", 1: "DOWN", 2: "UNREACHABLE"}
_SVC_STATE  = {0: "OK", 1: "WARNING", 2: "CRITICAL", 3: "UNKNOWN"}

# Standard Unix-Socket-Pfad in Naemon
NAEMON_DEFAULT_SOCKET = "/var/cache/naemon/live"


# ── Konfiguration ─────────────────────────────────────────────────────────────

@dataclass
class NaemonConfig:
    backend_id:  str
    # Verbindungstyp: "unix" | "tcp" | "rest"
    conn_type:   Literal["unix", "tcp", "rest"] = "unix"
    # Livestatus Unix-Socket
    socket_path: str  = NAEMON_DEFAULT_SOCKET
    # Livestatus TCP / REST API
    host:        str  = ""
    port:        int  = 6558          # Naemon Livestatus TCP default
    # REST API (nur für conn_type="rest")
    base_url:    str  = ""            # z. B. "http://naemon-host:8080/naemon/api/v1"
    username:    str  = "nagvis2"
    password:    str  = ""
    verify_ssl:  bool = True
    timeout:     float = 10.0
    enabled:     bool  = True


# ── Client ───────────────────────────────────────────────────────────────────

class NaemonClient:
    """
    Naemon Monitoring Client.

    Delegiert Livestatus-basierte Abfragen (unix/tcp) an den bewährten
    LivestatusClient. Bei conn_type="rest" wird die Naemon REST API
    per httpx angesprochen.
    """

    def __init__(self, cfg: NaemonConfig):
        self.cfg = cfg
        self._ls: LivestatusClient | None = None
        self._http: httpx.AsyncClient | None = None

        if cfg.conn_type in ("unix", "tcp"):
            ls_cfg = LivestatusConfig(
                backend_id  = cfg.backend_id,
                socket_path = cfg.socket_path,
                host        = cfg.host,
                port        = cfg.port,
                timeout     = cfg.timeout,
                use_tcp     = (cfg.conn_type == "tcp"),
                enabled     = cfg.enabled,
            )
            self._ls = LivestatusClient(ls_cfg)
        else:
            # REST API – http-Client
            auth = (cfg.username, cfg.password) if cfg.password else None
            self._http = httpx.AsyncClient(
                base_url   = cfg.base_url.rstrip("/"),
                auth       = auth,
                verify     = cfg.verify_ssl,
                timeout    = cfg.timeout,
                headers    = {"Accept": "application/json"},
            )

    # ── Interne REST-Hilfsfunktion ───────────────────────────────────────

    async def _rest_get(self, path: str, params: dict | None = None) -> dict | list:
        assert self._http is not None
        resp = await self._http.get(path, params=params or {})
        resp.raise_for_status()
        return resp.json()

    async def _rest_post(self, path: str, body: dict) -> dict:
        assert self._http is not None
        resp = await self._http.post(path, json=body)
        resp.raise_for_status()
        return resp.json()

    # ── Public API: Daten lesen ──────────────────────────────────────────

    async def get_hosts(self) -> list[HostStatus]:
        if self._ls:
            return await self._ls.get_hosts()
        return await self._rest_get_hosts()

    async def get_services(self) -> list[ServiceStatus]:
        if self._ls:
            return await self._ls.get_services()
        return await self._rest_get_services()

    async def get_hostgroups(self) -> list[dict]:
        if self._ls:
            return await self._ls.get_hostgroups()
        return await self._rest_get_hostgroups()

    # ── REST-Implementierungen ────────────────────────────────────────────

    async def _rest_get_hosts(self) -> list[HostStatus]:
        """GET /hosts – Naemon REST API."""
        try:
            data = await self._rest_get("/hosts")
            hosts = data if isinstance(data, list) else data.get("data", [])
            result = []
            for h in hosts:
                attrs = h.get("attributes", h)
                state_num = int(attrs.get("current_state", 0))
                state_str = _HOST_STATE.get(state_num, "UNREACHABLE")
                result.append(HostStatus(
                    name         = attrs.get("name", h.get("name", "")),
                    display_name = attrs.get("alias") or attrs.get("display_name", ""),
                    state        = state_num,
                    state_label  = HOST_STATE_LABEL.get(state_num, "UNKNOWN"),
                    state_type   = "HARD" if int(attrs.get("state_type", 1)) == 1 else "SOFT",
                    acknowledged = bool(attrs.get("problem_has_been_acknowledged", False)),
                    in_downtime  = bool(attrs.get("scheduled_downtime_depth", 0)),
                    output       = attrs.get("plugin_output", ""),
                    perf_data    = attrs.get("performance_data", ""),
                    backend_id   = self.cfg.backend_id,
                ))
            return result
        except Exception as e:
            log.error("Naemon REST get_hosts fehlgeschlagen: %s", e)
            return []

    async def _rest_get_services(self) -> list[ServiceStatus]:
        """GET /services – Naemon REST API."""
        try:
            data = await self._rest_get("/services")
            svcs = data if isinstance(data, list) else data.get("data", [])
            result = []
            for s in svcs:
                attrs = s.get("attributes", s)
                state_num = int(attrs.get("current_state", 0))
                result.append(ServiceStatus(
                    host_name    = attrs.get("host_name", ""),
                    name         = attrs.get("description", s.get("name", "")),
                    display_name = attrs.get("display_name", ""),
                    state        = state_num,
                    state_label  = SERVICE_STATE_LABEL.get(state_num, "UNKNOWN"),
                    state_type   = "HARD" if int(attrs.get("state_type", 1)) == 1 else "SOFT",
                    acknowledged = bool(attrs.get("problem_has_been_acknowledged", False)),
                    in_downtime  = bool(attrs.get("scheduled_downtime_depth", 0)),
                    output       = attrs.get("plugin_output", ""),
                    perf_data    = attrs.get("performance_data", ""),
                    backend_id   = self.cfg.backend_id,
                ))
            return result
        except Exception as e:
            log.error("Naemon REST get_services fehlgeschlagen: %s", e)
            return []

    async def _rest_get_hostgroups(self) -> list[dict]:
        """GET /hostgroups – Naemon REST API."""
        try:
            data = await self._rest_get("/hostgroups")
            groups = data if isinstance(data, list) else data.get("data", [])
            result = []
            for g in groups:
                attrs = g.get("attributes", g)
                result.append({
                    "name":    attrs.get("name", g.get("name", "")),
                    "alias":   attrs.get("alias", ""),
                    "members": attrs.get("members", []),
                })
            return result
        except Exception as e:
            log.error("Naemon REST get_hostgroups fehlgeschlagen: %s", e)
            return []

    # ── Aktionen ─────────────────────────────────────────────────────────

    async def acknowledge_host(
        self,
        host_name: str,
        comment:   str = "NagVis 2",
        author:    str = "nagvis2",
    ) -> bool:
        if self._ls:
            return await self._ls.acknowledge_host(host_name, comment, author)
        try:
            await self._rest_post(f"/hosts/{host_name}/acknowledge", {
                "comment": comment,
                "author":  author,
                "sticky":  True,
                "notify":  True,
            })
            return True
        except Exception as e:
            log.error("Naemon acknowledge_host '%s' fehlgeschlagen: %s", host_name, e)
            return False

    async def acknowledge_service(
        self,
        host_name:    str,
        service_name: str,
        comment:      str = "NagVis 2",
        author:       str = "nagvis2",
    ) -> bool:
        if self._ls:
            return await self._ls.acknowledge_service(host_name, service_name, comment, author)
        try:
            await self._rest_post(
                f"/hosts/{host_name}/services/{service_name}/acknowledge",
                {"comment": comment, "author": author, "sticky": True, "notify": True},
            )
            return True
        except Exception as e:
            log.error("Naemon acknowledge_service '%s/%s' fehlgeschlagen: %s",
                      host_name, service_name, e)
            return False

    async def schedule_host_downtime(
        self,
        host_name:   str,
        start_time:  int,
        end_time:    int,
        comment:     str  = "NagVis 2",
        author:      str  = "nagvis2",
        child_hosts: bool = False,
    ) -> bool:
        if self._ls:
            return await self._ls.schedule_host_downtime(
                host_name, start_time, end_time, comment, author, child_hosts=child_hosts
            )
        try:
            await self._rest_post(f"/hosts/{host_name}/downtimes", {
                "start_time":  start_time,
                "end_time":    end_time,
                "comment":     comment,
                "author":      author,
                "fixed":       True,
                "child_hosts": "DowntimeTriggeredChildren" if child_hosts else "NoChildDowntimes",
            })
            return True
        except Exception as e:
            log.error("Naemon schedule_host_downtime '%s' fehlgeschlagen: %s", host_name, e)
            return False

    async def schedule_service_downtime(
        self,
        host_name:    str,
        service_name: str,
        start_time:   int,
        end_time:     int,
        comment:      str = "NagVis 2",
        author:       str = "nagvis2",
    ) -> bool:
        if self._ls:
            return await self._ls.schedule_service_downtime(
                host_name, service_name, start_time, end_time, comment, author
            )
        try:
            await self._rest_post(
                f"/hosts/{host_name}/services/{service_name}/downtimes",
                {
                    "start_time": start_time,
                    "end_time":   end_time,
                    "comment":    comment,
                    "author":     author,
                    "fixed":      True,
                },
            )
            return True
        except Exception as e:
            log.error("Naemon schedule_service_downtime '%s/%s' fehlgeschlagen: %s",
                      host_name, service_name, e)
            return False

    async def reschedule_host_check(self, host_name: str) -> bool:
        if self._ls:
            return await self._ls.reschedule_host_check(host_name)
        try:
            await self._rest_post(f"/hosts/{host_name}/reschedule", {
                "check_time": int(time.time()),
                "force":      True,
            })
            return True
        except Exception as e:
            log.error("Naemon reschedule_host_check '%s' fehlgeschlagen: %s", host_name, e)
            return False

    async def remove_host_downtime(self, host_name: str) -> bool:
        if self._ls:
            return await self._ls.remove_host_downtime(host_name)
        log.info("[naemon] remove_host_downtime: REST-Implementierung fehlt noch")
        return False

    async def remove_service_downtime(self, host_name: str, service_description: str) -> bool:
        if self._ls:
            return await self._ls.remove_service_downtime(host_name, service_description)
        log.info("[naemon] remove_service_downtime: REST-Implementierung fehlt noch")
        return False

    # ── Ping / Health ────────────────────────────────────────────────────

    async def ping(self) -> BackendHealth:
        if self._ls:
            return await self._ls.ping()
        # REST: GET /status
        t0 = time.monotonic()
        try:
            data = await self._rest_get("/status")
            ms = round((time.monotonic() - t0) * 1000, 1)
            # Naemon REST gibt typischerweise {"data": {"naemon": {...}}} zurück
            return BackendHealth(
                backend_id = self.cfg.backend_id,
                reachable  = True,
                latency_ms = ms,
            )
        except Exception as e:
            return BackendHealth(
                backend_id = self.cfg.backend_id,
                reachable  = False,
                error      = str(e),
            )

    async def close(self):
        if self._http:
            await self._http.aclose()
