"""
zabbix/client.py
================
Zabbix JSON-RPC API – Async Client

Kompatibilität:  Zabbix 6.0+ (empfohlen), 5.x mit username/password
Authentifizierung:
  - API-Token (Bearer):   Zabbix 6.0+, erzeugt unter User Settings → API tokens
  - username / password:  Ältere Versionen, Session-Token via user.login

Monitoring-Konzepte in NagVis 2:
  Hosts    → Zabbix Hosts (host.get)
  Services → Zabbix Problems (problem.get) – aktive Trigger-Auslösungen
  Gruppen  → Zabbix Host-Gruppen (hostgroup.get)

Zabbix Host-Verfügbarkeit:
  available=1 → UP (state 0)
  available=2 → DOWN (state 1)
  available=0 → UNREACHABLE (state 2)

Zabbix Problem-Schweregrade (priority/severity):
  0=Not classified, 1=Information, 2=Warning → WARNING (state 1)
  3=Average, 4=High, 5=Disaster            → CRITICAL (state 2)

API-Token anlegen (Zabbix 6.0+):
  User Settings → API tokens → Create API token
  Rechte: User-Rolle mit Read-Zugriff auf gewünschte Hosts/Gruppen

Zabbix JSON-RPC Endpunkt:
  POST https://<zabbix>/api_jsonrpc.php
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field

import httpx

from livestatus.client import (
    BackendHealth,
    HostStatus,
    ServiceStatus,
)

log = logging.getLogger("nagvis.zabbix")

# State-Mapping
_HOST_STATE = {0: "UP", 1: "DOWN", 2: "UNREACHABLE"}

# Zabbix host.available → NagVis state (0=unknown→UNREACHABLE, 1=up, 2=down)
_AVAIL_TO_STATE = {0: 2, 1: 0, 2: 1}
_AVAIL_TO_LABEL = {0: "UNREACHABLE", 1: "UP", 2: "DOWN"}

# Zabbix severity → NagVis state
_SEV_TO_STATE = {0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 2}
_SEV_TO_LABEL = {0: "WARNING", 1: "WARNING", 2: "WARNING",
                 3: "CRITICAL", 4: "CRITICAL", 5: "CRITICAL"}
_SEV_LABEL    = {0: "Not classified", 1: "Information", 2: "Warning",
                 3: "Average", 4: "High", 5: "Disaster"}


def _parse_tags(tags) -> dict:
    """Zabbix-Tags (Liste von {tag, value}-Dicts) als Labels-Dict."""
    if not isinstance(tags, list):
        return {}
    result = {}
    for t in tags:
        if isinstance(t, dict):
            k = str(t.get("tag", "")).lower()
            v = str(t.get("value", ""))
            if k:
                result[k] = v
    return result


@dataclass
class ZabbixConfig:
    """Verbindungsparameter für ein Zabbix-Backend."""
    backend_id:  str   = "zabbix-default"
    url:         str   = "https://zabbix.example.com"
    token:       str   = ""       # API-Token (Zabbix 6.0+), bevorzugt
    username:    str   = "Admin"  # Fallback: username/password Login
    password:    str   = ""
    timeout:     float = 15.0
    verify_ssl:  bool  = True
    enabled:     bool  = True


class ZabbixClient:
    """
    Async-Client für genau ein Zabbix-Backend.
    Interface identisch zu LivestatusClient / CheckmkClient / Icinga2Client.
    """

    def __init__(self, config: ZabbixConfig):
        self.cfg = config
        self._session_token: str | None = None   # gecachter Login-Token

    # ── JSON-RPC Helpers ──────────────────────────────────────────────────

    def _api_url(self) -> str:
        return f"{self.cfg.url.rstrip('/')}/api_jsonrpc.php"

    def _bearer_headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.cfg.token}",
        }

    def _session_headers(self) -> dict:
        return {"Content-Type": "application/json"}

    async def _get_auth(self) -> str | None:
        """Gibt den Auth-Token zurück (Bearer oder Session-Token)."""
        if self.cfg.token:
            return None   # Bearer wird über Header gesetzt
        if not self._session_token:
            self._session_token = await self._login()
        return self._session_token

    async def _login(self) -> str | None:
        """user.login → Session-Token (für Zabbix < 6.0 oder ohne API-Token)."""
        payload = {
            "jsonrpc": "2.0",
            "method":  "user.login",
            "params":  {"username": self.cfg.username, "password": self.cfg.password},
            "id":      1,
        }
        try:
            async with httpx.AsyncClient(
                verify=self.cfg.verify_ssl,
                timeout=self.cfg.timeout,
            ) as client:
                r = await client.post(
                    self._api_url(),
                    headers=self._session_headers(),
                    json=payload,
                )
                r.raise_for_status()
                data = r.json()
                if "error" in data:
                    log.error("[%s] user.login Fehler: %s",
                              self.cfg.backend_id, data["error"].get("data"))
                    return None
                token = data.get("result")
                log.debug("[%s] user.login OK, Session-Token erhalten", self.cfg.backend_id)
                return token
        except Exception as e:
            log.error("[%s] user.login fehlgeschlagen: %s", self.cfg.backend_id, e)
            return None

    async def _request(self, method: str, params: dict) -> list | dict | None:
        """JSON-RPC Request; gibt result zurück oder None bei Fehler."""
        auth_token = await self._get_auth()

        if self.cfg.token:
            headers = self._bearer_headers()
            payload = {"jsonrpc": "2.0", "method": method, "params": params, "id": 1}
        else:
            headers = self._session_headers()
            payload = {"jsonrpc": "2.0", "method": method,
                       "params": params, "auth": auth_token, "id": 1}

        log.debug("[%s] RPC %s", self.cfg.backend_id, method)
        try:
            async with httpx.AsyncClient(
                verify=self.cfg.verify_ssl,
                timeout=self.cfg.timeout,
            ) as client:
                r = await client.post(self._api_url(), headers=headers, json=payload)
                r.raise_for_status()
                data = r.json()
                if "error" in data:
                    err = data["error"]
                    # Session abgelaufen → einmal neu einloggen
                    if not self.cfg.token and err.get("code") == -32602:
                        log.warning("[%s] Session abgelaufen – neuer Login", self.cfg.backend_id)
                        self._session_token = None
                        return await self._request(method, params)
                    log.error("[%s] RPC %s Fehler: %s",
                              self.cfg.backend_id, method, err.get("data"))
                    return None
                return data.get("result")
        except Exception as e:
            log.error("[%s] RPC %s FEHLER – %s", self.cfg.backend_id, method, e)
            raise

    # ── Monitoring API ────────────────────────────────────────────────────

    async def get_hosts(self) -> list[HostStatus]:
        result = await self._request("host.get", {
            "output":           ["hostid", "host", "name", "available",
                                 "maintenance_status", "error"],
            "selectTags":       "extend",
            "selectInterfaces": ["ip"],
            "filter":           {"status": 0},   # nur überwachte Hosts
        })
        if not result:
            return []

        out = []
        for h in result:
            avail = int(h.get("available", 0))
            state = _AVAIL_TO_STATE.get(avail, 2)
            output = h.get("error", "") or ""
            out.append(HostStatus(
                name          = h.get("host", ""),
                alias         = h.get("name", "") or h.get("host", ""),
                state         = state,
                state_label   = _AVAIL_TO_LABEL.get(avail, "UNREACHABLE"),
                plugin_output = output,
                last_check    = 0,
                acknowledged  = False,
                in_downtime   = int(h.get("maintenance_status", 0)) == 1,
                backend_id    = self.cfg.backend_id,
                labels        = _parse_tags(h.get("tags", [])),
            ))
        log.debug("get_hosts: %d from '%s'", len(out), self.cfg.backend_id)
        return out

    async def get_services(self) -> list[ServiceStatus]:
        """Aktive Zabbix-Probleme als Service-Einträge."""
        result = await self._request("problem.get", {
            "output":          ["eventid", "objectid", "name", "severity",
                                "acknowledged", "clock", "suppressed"],
            "selectHosts":     ["hostid", "host"],
            "selectTags":      "extend",
            "recent":          False,
            "suppressed":      False,
            "sortfield":       ["severity", "clock"],
            "sortorder":       "DESC",
        })
        if not result:
            return []

        out = []
        for p in result:
            sev    = int(p.get("severity", 2))
            state  = _SEV_TO_STATE.get(sev, 2)
            hosts  = p.get("hosts") or []
            hname  = hosts[0].get("host", "") if hosts else ""
            out.append(ServiceStatus(
                host_name     = hname,
                description   = p.get("name", ""),
                state         = state,
                state_label   = _SEV_TO_LABEL.get(sev, "CRITICAL"),
                plugin_output = f"{_SEV_LABEL.get(sev, '')}",
                last_check    = int(p.get("clock", 0) or 0),
                acknowledged  = str(p.get("acknowledged", "0")) == "1",
                in_downtime   = str(p.get("suppressed", "0")) == "1",
                perf_data     = "",
                backend_id    = self.cfg.backend_id,
                labels        = _parse_tags(p.get("tags", [])),
            ))
        log.debug("get_services: %d from '%s'", len(out), self.cfg.backend_id)
        return out

    async def get_hostgroups(self) -> list[dict]:
        result = await self._request("hostgroup.get", {
            "output":          ["groupid", "name"],
            "selectHosts":     ["host"],
            "monitored_hosts": True,
            "real_hosts":      True,
        })
        if not result:
            return []

        out = []
        for g in result:
            members = [h.get("host", "") for h in (g.get("hosts") or [])]
            out.append({"name": g.get("name", ""), "members": members})
        return out

    # ── Aktionen ──────────────────────────────────────────────────────────

    async def acknowledge_host(
        self,
        host_name: str,
        comment:   str  = "ACK via NagVis 2",
        author:    str  = "nagvis2",
        sticky:    bool = True,
    ) -> bool:
        """ACK auf alle aktiven Probleme des Hosts setzen."""
        events = await self._get_host_event_ids(host_name)
        if not events:
            return False
        result = await self._request("event.acknowledge", {
            "eventids": events,
            "action":   6,       # 2 = acknowledge + 4 = add message
            "message":  comment,
        })
        return result is not None

    async def acknowledge_service(
        self,
        host_name:    str,
        service_name: str,
        comment:      str  = "ACK via NagVis 2",
        author:       str  = "nagvis2",
        sticky:       bool = True,
    ) -> bool:
        """ACK auf ein bestimmtes Problem setzen (Match über Problem-Name)."""
        events = await self._get_host_event_ids(host_name, service_name)
        if not events:
            return False
        result = await self._request("event.acknowledge", {
            "eventids": events,
            "action":   6,
            "message":  comment,
        })
        return result is not None

    async def schedule_host_downtime(
        self,
        host_name:   str,
        start_time:  int,
        end_time:    int,
        comment:     str  = "Downtime via NagVis 2",
        author:      str  = "nagvis2",
        child_hosts: bool = False,
    ) -> bool:
        """Wartungsfenster für einen Host anlegen (Zabbix maintenance)."""
        # Host-ID ermitteln
        hosts = await self._request("host.get", {
            "output": ["hostid"],
            "filter": {"host": host_name},
        })
        if not hosts:
            log.warning("[%s] Host '%s' nicht gefunden für Downtime",
                        self.cfg.backend_id, host_name)
            return False
        hostid = hosts[0]["hostid"]
        result = await self._request("maintenance.create", {
            "name":             f"NagVis2: {host_name}",
            "active_since":     start_time,
            "active_till":      end_time,
            "hostids":          [hostid],
            "groupids":         [],
            "maintenance_type": 0,
            "timeperiods":      [{
                "timeperiod_type": 0,
                "start_date":      start_time,
                "period":          end_time - start_time,
            }],
            "description": comment,
        })
        return result is not None

    async def schedule_service_downtime(
        self,
        host_name:    str,
        service_name: str,
        start_time:   int,
        end_time:     int,
        comment:      str = "Downtime via NagVis 2",
        author:       str = "nagvis2",
    ) -> bool:
        """Zabbix kennt keine Service-Downtimes – wird als Host-Downtime umgesetzt."""
        return await self.schedule_host_downtime(
            host_name, start_time, end_time, comment, author
        )

    async def reschedule_host_check(self, host_name: str) -> bool:
        """Zabbix unterstützt kein manuelles Check-Rescheduling – ignoriert."""
        log.info("[%s] reschedule_host_check: Zabbix unterstützt dies nicht – ignoriert",
                 self.cfg.backend_id)
        return False

    async def ping(self) -> BackendHealth:
        """Verbindungstest via apiinfo.version (kein Auth erforderlich)."""
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(
                verify=self.cfg.verify_ssl,
                timeout=self.cfg.timeout,
            ) as client:
                payload = {
                    "jsonrpc": "2.0",
                    "method":  "apiinfo.version",
                    "params":  {},
                    "id":      1,
                }
                r = await client.post(
                    self._api_url(),
                    headers={"Content-Type": "application/json"},
                    json=payload,
                )
                r.raise_for_status()
                data = r.json()
                version = data.get("result", "?")
                return BackendHealth(
                    backend_id = self.cfg.backend_id,
                    reachable  = True,
                    latency_ms = round((time.monotonic() - t0) * 1000, 1),
                    last_ok    = time.time(),
                    error      = f"Zabbix {version}",
                )
        except Exception as e:
            log.warning("ping failed [%s]: %s", self.cfg.backend_id, e)
            return BackendHealth(
                backend_id = self.cfg.backend_id,
                reachable  = False,
                error      = str(e),
            )

    # ── Interne Hilfsmethoden ─────────────────────────────────────────────

    async def _get_host_event_ids(
        self, host_name: str, problem_name: str | None = None
    ) -> list[str]:
        """Event-IDs aktiver Probleme für einen Host (optional gefiltert nach Name)."""
        params: dict = {
            "output":      ["eventid", "name"],
            "selectHosts": ["host"],
            "recent":      False,
        }
        result = await self._request("problem.get", params)
        if not result:
            return []
        ids = []
        for p in result:
            hosts = p.get("hosts") or []
            if any(h.get("host") == host_name for h in hosts):
                if problem_name is None or p.get("name") == problem_name:
                    ids.append(p["eventid"])
        return ids
