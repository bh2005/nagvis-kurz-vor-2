"""
icinga2/client.py
=================
Icinga2 REST API v1 – Async Client

Kompatibilität:  Icinga2 2.11+
Authentifizierung: Basic Auth (API-User + Passwort)
                   Benutzer anlegen: icinga2 api setup + objects.conf

Monitoring-Endpoints (Lesen):
  GET /v1/objects/hosts      → Alle Hosts mit Status
  GET /v1/objects/services   → Alle Services mit Status
  GET /v1/objects/hostgroups → Alle Hostgruppen

Aktions-Endpoints (Schreiben):
  POST /v1/actions/acknowledge-problem    → ACK setzen
  POST /v1/actions/remove-acknowledgement → ACK aufheben
  POST /v1/actions/schedule-downtime      → Wartung planen
  POST /v1/actions/reschedule-check       → Check neu planen

Icinga2 API-Benutzer anlegen (Beispiel /etc/icinga2/conf.d/api-users.conf):
  object ApiUser "nagvis2" {
    password = "geheimes-passwort"
    permissions = [ "objects/query/Host", "objects/query/Service",
                    "objects/query/HostGroup",
                    "actions/acknowledge-problem",
                    "actions/remove-acknowledgement",
                    "actions/schedule-downtime",
                    "actions/reschedule-check" ]
  }
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import httpx

from livestatus.client import (
    BackendHealth,
    HostStatus,
    ServiceStatus,
    HOST_STATE_LABEL,
    SERVICE_STATE_LABEL,
)

log = logging.getLogger("nagvis.icinga2")

# Icinga2 State-Konstanten
_HOST_STATE = {0: "UP", 1: "DOWN", 2: "UNREACHABLE"}
_SVC_STATE  = {0: "OK", 1: "WARNING", 2: "CRITICAL", 3: "UNKNOWN"}

# Benötigte Attribute für Host-Query (reduziert Datenmenge)
_HOST_ATTRS = [
    "name", "display_name", "state", "state_type",
    "last_check_result", "acknowledgement", "downtime_depth",
    "num_services_ok", "num_services_warning",
    "num_services_critical", "num_services_unknown",
    "vars",
]
_SVC_ATTRS = [
    "name", "host_name", "display_name", "state", "state_type",
    "last_check_result", "acknowledgement", "downtime_depth",
    "vars",
]
_HG_ATTRS = ["name", "display_name", "members"]


def _parse_perfdata(raw: list) -> str:
    """
    Icinga2 liefert performance_data als Liste von Strings im Nagios-Format.
    Wir geben sie als einzelnen String zurück – kompatibel mit parse_perfdata().
    """
    if not raw:
        return ""
    if isinstance(raw, list):
        return " ".join(str(p) for p in raw)
    return str(raw)


def _parse_labels(vars_dict) -> dict:
    """
    Icinga2 custom vars (host.vars.*) als Labels.
    Nur String-Werte werden übernommen; Dict/List-Werte werden übersprungen.
    """
    if not isinstance(vars_dict, dict):
        return {}
    return {
        str(k).lower(): str(v)
        for k, v in vars_dict.items()
        if isinstance(v, (str, int, float, bool)) and v != ""
    }


@dataclass
class Icinga2Config:
    """Verbindungsparameter für ein Icinga2-Backend."""
    backend_id:  str   = "icinga2-default"
    base_url:    str   = "https://localhost:5665/v1"
    username:    str   = "nagvis2"
    password:    str   = ""
    timeout:     float = 15.0
    verify_ssl:  bool  = False   # Icinga2 nutzt oft selbstsignierte Zertifikate
    enabled:     bool  = True


class Icinga2Client:
    """
    Async-Client für genau ein Icinga2-Backend.
    Interface identisch zu LivestatusClient + CheckmkClient.
    """

    def __init__(self, config: Icinga2Config):
        self.cfg = config

    # ── HTTP Helpers ─────────────────────────────────────────────────────

    def _url(self, path: str) -> str:
        return f"{self.cfg.base_url.rstrip('/')}/{path.lstrip('/')}"

    def _auth(self) -> tuple[str, str]:
        return (self.cfg.username, self.cfg.password)

    def _headers(self) -> dict:
        return {
            "Accept":       "application/json",
            "Content-Type": "application/json",
            # Icinga2 erwartet diesen Header für API-Requests
            "X-HTTP-Method-Override": "GET",
        }

    async def _query(self, path: str, attrs: list[str]) -> list[dict]:
        """
        Icinga2 Objects-Query via POST mit X-HTTP-Method-Override: GET.
        Gibt die 'results'-Liste zurück.
        """
        url = self._url(path)
        body = {"attrs": attrs}
        log.debug("[%s] QUERY %s attrs=%s", self.cfg.backend_id, url, attrs)
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(
                verify=self.cfg.verify_ssl,
                timeout=self.cfg.timeout,
            ) as client:
                r = await client.post(
                    url,
                    auth=self._auth(),
                    headers=self._headers(),
                    json=body,
                )
                ms = int((time.monotonic() - t0) * 1000)
                log.debug("[%s] %s → HTTP %d in %dms",
                          self.cfg.backend_id, url, r.status_code, ms)
                r.raise_for_status()
                return r.json().get("results", [])
        except Exception as e:
            log.error("[%s] QUERY %s FEHLER – %s", self.cfg.backend_id, url, e)
            raise

    async def _action(self, action: str, body: dict) -> bool:
        """Icinga2 Actions-Endpoint."""
        url = self._url(f"actions/{action}")
        log.debug("[%s] ACTION %s body=%s", self.cfg.backend_id, action, body)
        try:
            async with httpx.AsyncClient(
                verify=self.cfg.verify_ssl,
                timeout=self.cfg.timeout,
            ) as client:
                r = await client.post(
                    url,
                    auth=self._auth(),
                    headers={"Accept": "application/json",
                             "Content-Type": "application/json"},
                    json=body,
                )
                r.raise_for_status()
                return True
        except Exception as e:
            log.error("[%s] ACTION %s FEHLER – %s", self.cfg.backend_id, action, e)
            return False

    # ── Monitoring API ────────────────────────────────────────────────────

    async def get_hosts(self) -> list[HostStatus]:
        results = await self._query("objects/hosts", _HOST_ATTRS)
        out = []
        for r in results:
            a = r.get("attrs", {})
            state = int(a.get("state", 2))
            lcr   = a.get("last_check_result") or {}
            out.append(HostStatus(
                name              = a.get("name", r.get("name", "")),
                alias             = a.get("display_name") or a.get("name", ""),
                state             = state,
                state_label       = _HOST_STATE.get(state, "UNREACHABLE"),
                plugin_output     = lcr.get("output", ""),
                last_check        = int(lcr.get("execution_end", 0) or 0),
                acknowledged      = int(a.get("acknowledgement", 0)) > 0,
                in_downtime       = int(a.get("downtime_depth", 0)) > 0,
                num_services_ok   = int(a.get("num_services_ok",       0) or 0),
                num_services_warn = int(a.get("num_services_warning",  0) or 0),
                num_services_crit = int(a.get("num_services_critical", 0) or 0),
                num_services_unkn = int(a.get("num_services_unknown",  0) or 0),
                backend_id        = self.cfg.backend_id,
                labels            = _parse_labels(a.get("vars")),
            ))
        log.debug("get_hosts: %d from '%s'", len(out), self.cfg.backend_id)
        return out

    async def get_services(self) -> list[ServiceStatus]:
        results = await self._query("objects/services", _SVC_ATTRS)
        out = []
        for r in results:
            a     = r.get("attrs", {})
            state = int(a.get("state", 3))
            lcr   = a.get("last_check_result") or {}
            out.append(ServiceStatus(
                host_name     = a.get("host_name", ""),
                description   = a.get("display_name") or a.get("name", ""),
                state         = state,
                state_label   = _SVC_STATE.get(state, "UNKNOWN"),
                plugin_output = lcr.get("output", ""),
                last_check    = int(lcr.get("execution_end", 0) or 0),
                acknowledged  = int(a.get("acknowledgement", 0)) > 0,
                in_downtime   = int(a.get("downtime_depth", 0)) > 0,
                perf_data     = _parse_perfdata(lcr.get("performance_data", [])),
                backend_id    = self.cfg.backend_id,
                labels        = _parse_labels(a.get("vars")),
            ))
        log.debug("get_services: %d from '%s'", len(out), self.cfg.backend_id)
        return out

    async def get_hostgroups(self) -> list[dict]:
        results = await self._query("objects/hostgroups", _HG_ATTRS)
        out = []
        for r in results:
            a = r.get("attrs", {})
            name = a.get("name", r.get("name", ""))
            # members ist eine Liste von Host-Object-Namen
            members = [
                m.split("!")[0] if "!" in m else m
                for m in (a.get("members") or [])
            ]
            out.append({"name": name, "members": members})
        return out

    # ── Aktionen ──────────────────────────────────────────────────────────

    async def acknowledge_host(
        self,
        host_name: str,
        comment:   str = "ACK via NagVis 2",
        author:    str = "nagvis2",
        sticky:    bool = True,
    ) -> bool:
        return await self._action("acknowledge-problem", {
            "type":    "Host",
            "filter":  f'host.name=="{host_name}"',
            "author":  author,
            "comment": comment,
            "sticky":  sticky,
        })

    async def acknowledge_service(
        self,
        host_name:    str,
        service_name: str,
        comment:      str  = "ACK via NagVis 2",
        author:       str  = "nagvis2",
        sticky:       bool = True,
    ) -> bool:
        return await self._action("acknowledge-problem", {
            "type":    "Service",
            "filter":  f'host.name=="{host_name}" && service.name=="{service_name}"',
            "author":  author,
            "comment": comment,
            "sticky":  sticky,
        })

    async def remove_host_ack(self, host_name: str) -> bool:
        return await self._action("remove-acknowledgement", {
            "type":   "Host",
            "filter": f'host.name=="{host_name}"',
        })

    async def remove_service_ack(self, host_name: str, service_name: str) -> bool:
        return await self._action("remove-acknowledgement", {
            "type":   "Service",
            "filter": f'host.name=="{host_name}" && service.name=="{service_name}"',
        })

    async def schedule_host_downtime(
        self,
        host_name:   str,
        start_time:  int,
        end_time:    int,
        comment:     str  = "Downtime via NagVis 2",
        author:      str  = "nagvis2",
        child_hosts: bool = False,
    ) -> bool:
        return await self._action("schedule-downtime", {
            "type":       "Host",
            "filter":     f'host.name=="{host_name}"',
            "author":     author,
            "comment":    comment,
            "start_time": start_time,
            "end_time":   end_time,
            "duration":   end_time - start_time,
            "fixed":      True,
        })

    async def schedule_service_downtime(
        self,
        host_name:    str,
        service_name: str,
        start_time:   int,
        end_time:     int,
        comment:      str = "Downtime via NagVis 2",
        author:       str = "nagvis2",
    ) -> bool:
        return await self._action("schedule-downtime", {
            "type":       "Service",
            "filter":     f'host.name=="{host_name}" && service.name=="{service_name}"',
            "author":     author,
            "comment":    comment,
            "start_time": start_time,
            "end_time":   end_time,
            "duration":   end_time - start_time,
            "fixed":      True,
        })

    async def reschedule_host_check(self, host_name: str) -> bool:
        """Alias für das einheitliche Backend-Interface."""
        return await self.reschedule_check(host_name)

    async def reschedule_check(self, host_name: str, service_name: str = "") -> bool:
        if service_name:
            return await self._action("reschedule-check", {
                "type":   "Service",
                "filter": f'host.name=="{host_name}" && service.name=="{service_name}"',
            })
        return await self._action("reschedule-check", {
            "type":   "Host",
            "filter": f'host.name=="{host_name}"',
        })

    async def ping(self) -> BackendHealth:
        """Verbindungstest via GET /v1 (liefert API-Version)."""
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(
                verify=self.cfg.verify_ssl,
                timeout=self.cfg.timeout,
            ) as client:
                r = await client.get(
                    self._url(""),
                    auth=self._auth(),
                    headers={"Accept": "application/json"},
                )
                r.raise_for_status()
                return BackendHealth(
                    backend_id = self.cfg.backend_id,
                    reachable  = True,
                    latency_ms = round((time.monotonic() - t0) * 1000, 1),
                    last_ok    = time.time(),
                )
        except Exception as e:
            log.warning("ping failed [%s]: %s", self.cfg.backend_id, e)
            return BackendHealth(
                backend_id = self.cfg.backend_id,
                reachable  = False,
                error      = str(e),
            )
