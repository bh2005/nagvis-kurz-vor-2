"""
solarwinds/client.py
====================
SolarWinds Orion – Async Client via SWIS (SolarWinds Information Service)

SolarWinds Orion nutzt eine eigene REST-API (SWIS) unter Port 17778.
Abfragen werden per SWQL (SolarWinds Query Language, SQL-ähnlich) gestellt.

Voraussetzungen:
  - SolarWinds Orion Platform (NPM / SAM)
  - SWIS API aktiviert (Standard seit Orion 2012.x)
  - API-Benutzer mit "SWIS Query" Rechten

Verbindung testen:
  curl -k -u admin:password https://orion-server:17778/SolarWinds/InformationService/v3/Json/Query?query=SELECT+NodeID+FROM+Orion.Nodes

Wichtige SWQL-Tabellen:
  Orion.Nodes            – Hosts/Nodes mit Status
  Orion.NodeApplications – Applikations-Monitoring (ähnlich Services)
  Orion.Groups           – Gruppen
  Core.StatusInfo        – Status-Beschreibungen

Statuscodes (Orion.Nodes.Status):
  1 = Up, 2 = Down, 3 = Warning, 4 = Unknown, 9 = Unmanaged

Doku: https://github.com/solarwinds/orionsdk-python
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import httpx

from livestatus.client import (
    BackendHealth,
    HostStatus,
    ServiceStatus,
    HOST_STATE_LABEL,
    SERVICE_STATE_LABEL,
)

log = logging.getLogger("nagvis.solarwinds")

# SWIS Endpoint
_SWIS_QUERY_PATH = "/SolarWinds/InformationService/v3/Json/Query"
_SWIS_INVOKE_PATH = "/SolarWinds/InformationService/v3/Json/Invoke"

# SolarWinds Orion Status → nagvis state
# Orion: 1=Up, 2=Down, 3=Warning, 4=Unknown, 9=Unmanaged, 14=Critical
_NODE_STATUS_MAP: dict[int, tuple[int, str]] = {
    1:  (0, "UP"),
    2:  (1, "DOWN"),
    3:  (1, "DOWN"),    # Warning → DOWN (no WARNING für Hosts)
    4:  (2, "UNREACHABLE"),
    9:  (2, "UNREACHABLE"),  # Unmanaged
    14: (1, "DOWN"),    # Critical
}

# SolarWinds Application/Component status → service state
_APP_STATUS_MAP: dict[int, tuple[int, str]] = {
    1:  (0, "OK"),
    2:  (2, "CRITICAL"),
    3:  (1, "WARNING"),
    4:  (3, "UNKNOWN"),
    9:  (3, "UNKNOWN"),   # Unmanaged
    14: (2, "CRITICAL"),
}

# SWQL für Hosts
_QUERY_NODES = """
SELECT
  n.NodeID, n.Caption, n.DNS, n.IPAddress,
  n.Status, n.StatusDescription,
  n.Unmanaged, n.UnManageFrom, n.UnManageUntil,
  n.LastBoot, n.LastSystemUpTimePollUtc,
  CASE WHEN n.Acknowledged = 1 THEN 1 ELSE 0 END AS Acknowledged,
  CASE WHEN n.Status = 9 THEN 1 ELSE 0 END AS IsUnmanaged
FROM Orion.Nodes n
ORDER BY n.Caption
""".strip()

# SWQL für Applikationen (Services-Äquivalent)
_QUERY_APPS = """
SELECT
  a.ApplicationID, a.Name, a.NodeID,
  a.Status, a.StatusDescription,
  n.Caption AS NodeCaption
FROM Orion.APM.Application a
INNER JOIN Orion.Nodes n ON a.NodeID = n.NodeID
ORDER BY n.Caption, a.Name
""".strip()

# SWQL für Gruppen
_QUERY_GROUPS = """
SELECT g.ContainerID, g.Name, g.Description
FROM Orion.Container g
ORDER BY g.Name
""".strip()


# ── Konfiguration ─────────────────────────────────────────────────────────────

@dataclass
class SolarWindsConfig:
    backend_id:  str
    host:        str          # Orion-Server Hostname oder IP
    port:        int  = 17778
    username:    str  = "admin"
    password:    str  = ""
    verify_ssl:  bool = False  # Orion nutzt oft selbst-signierte Certs
    timeout:     float = 15.0
    enabled:     bool  = True

    @property
    def base_url(self) -> str:
        return f"https://{self.host}:{self.port}"


# ── Client ───────────────────────────────────────────────────────────────────

class SolarWindsClient:
    """
    SolarWinds Orion SWIS API Client.

    Alle Abfragen laufen über den SWQL Query-Endpoint.
    Aktionen (ACK, Downtime) werden über den Invoke-Endpoint ausgeführt.
    """

    def __init__(self, cfg: SolarWindsConfig):
        self.cfg = cfg
        self._http = httpx.AsyncClient(
            base_url = cfg.base_url,
            auth     = (cfg.username, cfg.password),
            verify   = cfg.verify_ssl,
            timeout  = cfg.timeout,
            headers  = {"Content-Type": "application/json"},
        )

    # ── Interne SWQL-Abfrage ──────────────────────────────────────────────

    async def _query(self, swql: str, params: dict | None = None) -> list[dict]:
        """Führt eine SWQL-Abfrage aus und gibt die Ergebnisliste zurück."""
        payload: dict = {"query": swql}
        if params:
            payload["parameters"] = params
        resp = await self._http.post(_SWIS_QUERY_PATH, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("results", [])

    async def _invoke(self, entity: str, verb: str, args: list) -> object:
        """Ruft eine SWIS-Methode auf (z.B. Orion.Nodes/Acknowledge)."""
        path = f"{_SWIS_INVOKE_PATH}/{entity}/{verb}"
        resp = await self._http.post(path, json=args)
        resp.raise_for_status()
        return resp.json()

    # ── Daten lesen ───────────────────────────────────────────────────────

    async def get_hosts(self) -> list[HostStatus]:
        try:
            rows = await self._query(_QUERY_NODES)
            result = []
            for r in rows:
                sw_status = int(r.get("Status", 4))
                state_num, _state_str = _NODE_STATUS_MAP.get(sw_status, (2, "UNREACHABLE"))
                result.append(HostStatus(
                    name         = r.get("Caption", r.get("DNS", "")),
                    display_name = r.get("Caption", ""),
                    state        = state_num,
                    state_label  = HOST_STATE_LABEL.get(state_num, "UNREACHABLE"),
                    state_type   = "HARD",
                    acknowledged = bool(r.get("Acknowledged", False)),
                    in_downtime  = bool(r.get("IsUnmanaged", False)),
                    output       = r.get("StatusDescription", ""),
                    perf_data    = "",
                    backend_id   = self.cfg.backend_id,
                ))
            return result
        except Exception as e:
            log.error("SolarWinds get_hosts fehlgeschlagen: %s", e)
            return []

    async def get_services(self) -> list[ServiceStatus]:
        """APM Applications als Service-Äquivalent."""
        try:
            rows = await self._query(_QUERY_APPS)
            result = []
            for r in rows:
                sw_status = int(r.get("Status", 4))
                state_num, _state_str = _APP_STATUS_MAP.get(sw_status, (3, "UNKNOWN"))
                result.append(ServiceStatus(
                    host_name    = r.get("NodeCaption", ""),
                    name         = r.get("Name", ""),
                    display_name = r.get("Name", ""),
                    state        = state_num,
                    state_label  = SERVICE_STATE_LABEL.get(state_num, "UNKNOWN"),
                    state_type   = "HARD",
                    acknowledged = False,
                    in_downtime  = False,
                    output       = r.get("StatusDescription", ""),
                    perf_data    = "",
                    backend_id   = self.cfg.backend_id,
                ))
            return result
        except httpx.HTTPStatusError as e:
            # APM-Modul nicht lizenziert → leere Liste statt Fehler
            if e.response.status_code in (400, 403, 404):
                log.debug("SolarWinds APM nicht verfügbar (HTTP %s) – übersprungen",
                          e.response.status_code)
                return []
            log.error("SolarWinds get_services fehlgeschlagen: %s", e)
            return []
        except Exception as e:
            log.error("SolarWinds get_services fehlgeschlagen: %s", e)
            return []

    async def get_hostgroups(self) -> list[dict]:
        """Orion-Container / Gruppen als Hostgruppen."""
        try:
            rows = await self._query(_QUERY_GROUPS)
            return [
                {
                    "name":    r.get("Name", ""),
                    "alias":   r.get("Description", ""),
                    "members": [],
                }
                for r in rows
            ]
        except Exception as e:
            log.error("SolarWinds get_hostgroups fehlgeschlagen: %s", e)
            return []

    # ── NodeID-Lookup (für Aktionen benötigt) ─────────────────────────────

    async def _get_node_id(self, host_name: str) -> str | None:
        """NodeID anhand Caption oder DNS-Name ermitteln."""
        try:
            rows = await self._query(
                "SELECT NodeID FROM Orion.Nodes WHERE Caption = @name OR DNS = @name",
                {"name": host_name},
            )
            if rows:
                return str(rows[0]["NodeID"])
        except Exception as e:
            log.error("SolarWinds _get_node_id '%s' fehlgeschlagen: %s", host_name, e)
        return None

    # ── Aktionen ─────────────────────────────────────────────────────────

    async def acknowledge_host(
        self,
        host_name: str,
        comment:   str = "NagVis 2",
        author:    str = "nagvis2",
    ) -> bool:
        """
        In SolarWinds gibt es kein direktes ACK wie in Nagios.
        Wir setzen das Custom-Property AcknowledgedBy und Status-Info.
        Falls das Custom-Property nicht existiert, wird Mute verwendet.
        """
        node_id = await self._get_node_id(host_name)
        if not node_id:
            log.warning("SolarWinds acknowledge_host: Node '%s' nicht gefunden", host_name)
            return False
        try:
            node_uri = f"swis://{self.cfg.host}/Orion/Orion.Nodes/NodeID={node_id}"
            await self._invoke("Orion.AlertSuppression", "SuppressAlerts", [
                [node_uri],
                None,   # suppress until manual re-enable
            ])
            return True
        except Exception as e:
            log.error("SolarWinds acknowledge_host '%s' fehlgeschlagen: %s", host_name, e)
            return False

    async def acknowledge_service(
        self,
        host_name:    str,
        service_name: str,
        comment:      str = "NagVis 2",
        author:       str = "nagvis2",
    ) -> bool:
        """Application-Alert-Suppression (APM)."""
        try:
            rows = await self._query(
                """SELECT a.ApplicationID FROM Orion.APM.Application a
                   INNER JOIN Orion.Nodes n ON a.NodeID = n.NodeID
                   WHERE n.Caption = @node AND a.Name = @app""",
                {"node": host_name, "app": service_name},
            )
            if not rows:
                log.warning("SolarWinds acknowledge_service: App '%s/%s' nicht gefunden",
                            host_name, service_name)
                return False
            app_id = rows[0]["ApplicationID"]
            app_uri = f"swis://{self.cfg.host}/Orion/Orion.APM.Application/ApplicationID={app_id}"
            await self._invoke("Orion.AlertSuppression", "SuppressAlerts", [
                [app_uri], None
            ])
            return True
        except Exception as e:
            log.error("SolarWinds acknowledge_service '%s/%s' fehlgeschlagen: %s",
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
        """Setzt einen Unmanage-Zeitraum (SolarWinds-Äquivalent für Downtime)."""
        node_id = await self._get_node_id(host_name)
        if not node_id:
            return False
        try:
            # SolarWinds Unmanage: Orion.Nodes/Unmanage(netObjectId, start, end, isRelative)
            node_net_obj = f"N:{node_id}"
            # ISO-8601 Zeitformat
            from datetime import datetime, timezone
            start_iso = datetime.fromtimestamp(start_time, tz=timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%S"
            )
            end_iso = datetime.fromtimestamp(end_time, tz=timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%S"
            )
            await self._invoke("Orion.Nodes", "Unmanage", [
                node_net_obj, start_iso, end_iso, False
            ])
            return True
        except Exception as e:
            log.error("SolarWinds schedule_host_downtime '%s' fehlgeschlagen: %s", host_name, e)
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
        """Unmanage für eine APM-Applikation."""
        try:
            rows = await self._query(
                """SELECT a.ApplicationID FROM Orion.APM.Application a
                   INNER JOIN Orion.Nodes n ON a.NodeID = n.NodeID
                   WHERE n.Caption = @node AND a.Name = @app""",
                {"node": host_name, "app": service_name},
            )
            if not rows:
                return False
            app_id = rows[0]["ApplicationID"]
            from datetime import datetime, timezone
            start_iso = datetime.fromtimestamp(start_time, tz=timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%S"
            )
            end_iso = datetime.fromtimestamp(end_time, tz=timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%S"
            )
            await self._invoke("Orion.APM.Application", "Unmanage", [
                f"A:{app_id}", start_iso, end_iso, False
            ])
            return True
        except Exception as e:
            log.error("SolarWinds schedule_service_downtime '%s/%s' fehlgeschlagen: %s",
                      host_name, service_name, e)
            return False

    async def reschedule_host_check(self, host_name: str) -> bool:
        """SolarWinds: Check sofort neu planen (Poll Now)."""
        node_id = await self._get_node_id(host_name)
        if not node_id:
            return False
        try:
            node_uri = f"swis://{self.cfg.host}/Orion/Orion.Nodes/NodeID={node_id}"
            await self._invoke("Orion.Nodes", "PollNow", [node_uri])
            return True
        except Exception as e:
            log.error("SolarWinds reschedule_host_check '%s' fehlgeschlagen: %s", host_name, e)
            return False

    # ── Ping / Health ─────────────────────────────────────────────────────

    async def ping(self) -> BackendHealth:
        """Verbindungstest: simple SWQL-Abfrage."""
        t0 = time.monotonic()
        try:
            rows = await self._query("SELECT NodeID FROM Orion.Nodes LIMIT 1")
            ms = round((time.monotonic() - t0) * 1000, 1)
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
        await self._http.aclose()
