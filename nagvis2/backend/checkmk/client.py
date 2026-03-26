"""
checkmk/client.py
=================
Checkmk REST API v1.0 – Async Client

Kompatibilität:  Checkmk 2.1+ (Raw, Standard, Enterprise, Cloud)
Authentifizierung: Automation User – Header: Authorization: Bearer <user> <secret>

Monitoring-Endpoints (Lesen):
  GET /domain-types/host/collections/all     → Alle Hosts
    • state-Felder verfügbar ab Checkmk 2.2+
    • Ältere Versionen liefern ggf. nur Config-Daten (state=3/PENDING)
  GET /domain-types/service/collections/all  → Alle Services mit State
  GET /version                               → Ping / Verbindungstest

Aktions-Endpoints (Schreiben):
  POST /domain-types/acknowledge/collections/host
  POST /domain-types/acknowledge/collections/service
  POST /domain-types/downtime/collections/host
  POST /domain-types/downtime/collections/service
  POST /objects/host/{name}/actions/reschedule_check/invoke
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from livestatus.client import (
    BackendHealth,
    HostStatus,
    ServiceStatus,
    HOST_STATE_LABEL,
    SERVICE_STATE_LABEL,
)

log = logging.getLogger("nagvis.checkmk")

# Checkmk REST API liefert State teils als Integer, teils als String
_CMK_HOST_STATE: dict[str, int] = {
    "up": 0, "down": 1, "unreachable": 2, "pending": 3,
}
_CMK_SVC_STATE: dict[str, int] = {
    "ok": 0, "warning": 1, "critical": 2, "unknown": 3, "pending": 3,
}


def _parse_host_state(val) -> int:
    if isinstance(val, int):
        return val
    if isinstance(val, str):
        return _CMK_HOST_STATE.get(val.lower(), 3)
    return 3


def _parse_svc_state(val) -> int:
    if isinstance(val, int):
        return val
    if isinstance(val, str):
        return _CMK_SVC_STATE.get(val.lower(), 3)
    return 3


def _to_perf_str(val) -> str:
    """Stellt sicher, dass perf_data immer ein String ist.
    Checkmk REST API kann performance_data als Dict oder String liefern."""
    if val is None:
        return ""
    if isinstance(val, str):
        return val
    return ""   # Dict/Liste → leer; parse_perfdata kann das nicht verwenden


def _parse_timestamp(val) -> int:
    """Konvertiert ISO-String oder Unix-Timestamp (int/float) auf int."""
    if not val:
        return 0
    if isinstance(val, (int, float)):
        return int(val)
    try:
        return int(datetime.fromisoformat(str(val)).timestamp())
    except Exception:
        return 0


@dataclass
class CheckmkConfig:
    """Verbindungsparameter für ein Checkmk-Backend (REST API)."""
    backend_id:  str   = "checkmk-default"
    base_url:    str   = "http://localhost/mysite/check_mk/api/1.0"
    username:    str   = "automation"
    secret:      str   = ""
    timeout:     float = 15.0
    verify_ssl:  bool  = True
    enabled:     bool  = True


class CheckmkClient:
    """
    Async-Client für genau ein Checkmk-Backend.
    Interface identisch zu LivestatusClient (get_hosts / get_services / ping).
    """

    def __init__(self, config: CheckmkConfig):
        self.cfg = config

    # ── HTTP Helpers ─────────────────────────────────────────────────────

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.cfg.username} {self.cfg.secret}",
            "Accept":        "application/json",
            "Content-Type":  "application/json",
        }

    def _url(self, path: str) -> str:
        return f"{self.cfg.base_url.rstrip('/')}/{path.lstrip('/')}"

    async def _get(self, path: str, params: dict | None = None) -> dict:
        url = self._url(path)
        log.debug("[%s] GET %s", self.cfg.backend_id, url)
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(
                verify=self.cfg.verify_ssl,
                timeout=self.cfg.timeout,
            ) as client:
                r = await client.get(url, headers=self._headers(), params=params or {})
                ms = int((time.monotonic() - t0) * 1000)
                log.debug("[%s] GET %s → HTTP %d in %dms",
                          self.cfg.backend_id, url, r.status_code, ms)
                r.raise_for_status()
                return r.json()
        except Exception as e:
            log.error("[%s] GET %s FEHLER – %s", self.cfg.backend_id, url, e)
            raise

    async def _post(self, path: str, body: dict) -> dict | None:
        url = self._url(path)
        log.debug("[%s] POST %s", self.cfg.backend_id, url)
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(
                verify=self.cfg.verify_ssl,
                timeout=self.cfg.timeout,
            ) as client:
                r = await client.post(url, headers=self._headers(), json=body)
                ms = int((time.monotonic() - t0) * 1000)
                log.debug("[%s] POST %s → HTTP %d in %dms",
                          self.cfg.backend_id, url, r.status_code, ms)
                if r.status_code == 204:
                    return None
                r.raise_for_status()
                return r.json()
        except Exception as e:
            log.error("[%s] POST %s FEHLER – %s", self.cfg.backend_id, url, e)
            raise

    # ── Monitoring API ───────────────────────────────────────────────────

    async def get_hosts(self) -> list[HostStatus]:
        """
        Alle Hosts mit Monitoring-State.

        Checkmk 2.2+ liefert state, output, acknowledged, in_downtime im
        extensions-Objekt. Ältere Versionen liefern nur Config-Daten –
        in diesem Fall wird state=3 (PENDING) gesetzt.
        """
        data = await self._get("/domain-types/host/collections/all")
        result = []
        for item in data.get("value", []):
            ext  = item.get("extensions", {})
            name = ext.get("name") or item.get("id", "")
            if not name:
                continue
            state = _parse_host_state(ext.get("state", 3))
            # Checkmk-Labels: {"os": "linux", "location": "hamburg"}
            raw_labels = ext.get("labels") or item.get("extensions", {}).get("labels") or {}
            labels = {str(k).lower(): str(v) for k, v in raw_labels.items()}
            result.append(HostStatus(
                name              = name,
                alias             = ext.get("alias", name),
                state             = state,
                state_label       = HOST_STATE_LABEL.get(state, "PENDING"),
                plugin_output     = ext.get("output") or ext.get("plugin_output", ""),
                last_check        = _parse_timestamp(ext.get("last_check")),
                acknowledged      = bool(ext.get("acknowledged", False)),
                in_downtime       = bool(ext.get("in_downtime", False)),
                num_services_ok   = int(ext.get("num_services_ok",   0) or 0),
                num_services_warn = int(ext.get("num_services_warn",  0) or 0),
                num_services_crit = int(ext.get("num_services_crit",  0) or 0),
                num_services_unkn = int(ext.get("num_services_unkn",  0) or 0),
                backend_id        = self.cfg.backend_id,
                labels            = labels,
            ))
        log.debug("get_hosts: %d from '%s'", len(result), self.cfg.backend_id)
        return result

    async def get_services(self) -> list[ServiceStatus]:
        """
        Alle Services mit Monitoring-State.
        Verlässlicher als get_hosts() – state-Felder sind ab Checkmk 2.0 verfügbar.
        """
        data = await self._get("/domain-types/service/collections/all")
        result = []
        for item in data.get("value", []):
            ext  = item.get("extensions", {})
            host = ext.get("host_name", "")
            desc = ext.get("description", "")
            if not host or not desc:
                continue
            state = _parse_svc_state(ext.get("state", 3))
            # Service-Labels aus Checkmk (host_labels oder service_labels)
            raw_labels = ext.get("labels") or ext.get("host_labels") or {}
            labels = {str(k).lower(): str(v) for k, v in raw_labels.items()}
            result.append(ServiceStatus(
                host_name     = host,
                description   = desc,
                state         = state,
                state_label   = SERVICE_STATE_LABEL.get(state, "UNKNOWN"),
                plugin_output = ext.get("output") or ext.get("plugin_output", ""),
                last_check    = _parse_timestamp(ext.get("last_check")),
                acknowledged  = bool(ext.get("acknowledged", False)),
                in_downtime   = bool(ext.get("in_downtime", False)),
                perf_data     = _to_perf_str(ext.get("perf_data") or ext.get("performance_data")),
                backend_id    = self.cfg.backend_id,
                labels        = labels,
            ))
        log.debug("get_services: %d from '%s'", len(result), self.cfg.backend_id)
        return result

    async def ping(self) -> BackendHealth:
        """Verbindungstest mit Latenz-Messung."""
        t0 = time.monotonic()
        try:
            await self._get("/version")
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

    # ── Aktionen ─────────────────────────────────────────────────────────

    async def acknowledge_host(
        self,
        host_name: str,
        comment:   str = "NagVis 2",
        author:    str = "nagvis2",
    ) -> bool:
        try:
            await self._post("/domain-types/acknowledge/collections/host", {
                "acknowledge_type": "host",
                "host_name":        host_name,
                "comment":          comment,
                "sticky":           True,
                "persistent":       False,
                "notify":           False,
            })
            return True
        except Exception as e:
            log.error("acknowledge_host failed [%s]: %s", self.cfg.backend_id, e)
            return False

    async def acknowledge_service(
        self,
        host_name:           str,
        service_description: str,
        comment:             str = "NagVis 2",
        author:              str = "nagvis2",
    ) -> bool:
        try:
            await self._post("/domain-types/acknowledge/collections/service", {
                "acknowledge_type":   "service",
                "host_name":          host_name,
                "service_description": service_description,
                "comment":            comment,
                "sticky":             True,
                "persistent":         False,
                "notify":             False,
            })
            return True
        except Exception as e:
            log.error("acknowledge_service failed [%s]: %s", self.cfg.backend_id, e)
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
        # child_hosts=True → Checkmk-Typ "host_and_related_services" (Host + alle Services)
        downtime_type = "host_and_related_services" if child_hosts else "host"
        try:
            await self._post("/domain-types/downtime/collections/host", {
                "downtime_type": downtime_type,
                "host_name":     host_name,
                "start_time":    datetime.fromtimestamp(start_time, tz=timezone.utc).isoformat(),
                "end_time":      datetime.fromtimestamp(end_time,   tz=timezone.utc).isoformat(),
                "comment":       comment,
            })
            return True
        except Exception as e:
            log.error("schedule_host_downtime failed [%s]: %s", self.cfg.backend_id, e)
            return False

    async def get_hostgroups(self) -> list[dict]:
        """Alle Hostgruppen mit Mitgliedernamen via Checkmk REST API."""
        try:
            data = await self._get("/domain-types/host_group_config/collections/all")
            result = []
            for item in data.get("value", []):
                name = item.get("id", "")
                if not name:
                    continue
                # Mitglieder: extensions.members oder leer
                members = item.get("extensions", {}).get("members", [])
                if isinstance(members, str):
                    members = [m.strip() for m in members.split(",") if m.strip()]
                result.append({"name": name, "members": members})
            log.debug("get_hostgroups: %d from '%s'", len(result), self.cfg.backend_id)
            return result
        except Exception as e:
            log.warning("get_hostgroups failed [%s]: %s", self.cfg.backend_id, e)
            return []

    async def schedule_service_downtime(
        self,
        host_name:           str,
        service_description: str,
        start_time:          int,
        end_time:            int,
        comment:             str = "NagVis 2",
        author:              str = "nagvis2",
    ) -> bool:
        try:
            await self._post("/domain-types/downtime/collections/service", {
                "downtime_type":       "service",
                "host_name":           host_name,
                "service_description": service_description,
                "start_time":          datetime.fromtimestamp(start_time, tz=timezone.utc).isoformat(),
                "end_time":            datetime.fromtimestamp(end_time,   tz=timezone.utc).isoformat(),
                "comment":             comment,
            })
            return True
        except Exception as e:
            log.error("schedule_service_downtime failed [%s]: %s", self.cfg.backend_id, e)
            return False

    async def reschedule_host_check(self, host_name: str) -> bool:
        try:
            await self._post(
                f"/objects/host/{host_name}/actions/reschedule_check/invoke",
                {},
            )
            return True
        except Exception as e:
            log.error("reschedule_host_check failed [%s]: %s", self.cfg.backend_id, e)
            return False
