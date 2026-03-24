"""
prometheus/client.py
====================
Prometheus & VictoriaMetrics HTTP API – Async Client

Kompatibilität:  Prometheus 2.x, VictoriaMetrics (identische API)
Authentifizierung:
  - Bearer Token:  Authorization: Bearer <token>
  - Basic Auth:    username / password
  - Keine Auth:    häufig in internen Umgebungen

Monitoring-Konzepte in NagVis 2:
  Hosts    → Prometheus Targets (via `up`-Metrik)
             host_label (Standard: "instance") → Host-Name
             up=1 → UP, up=0 → DOWN, Target fehlt → UNREACHABLE
  Services → Prometheus Alerts (GET /api/v1/alerts)
             firing + severity=critical → CRITICAL
             firing + severity=warning  → WARNING
             pending                    → WARNING
  Gruppen  → `job`-Label gruppiert Targets (Hostgruppen)

Prometheus API-Endpunkte:
  GET /api/v1/query?query=up        → Targets + Status
  GET /api/v1/alerts                → Aktive Alerts
  GET /api/v1/status/buildinfo      → Verbindungstest (kein Auth nötig)
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
)

log = logging.getLogger("nagvis.prometheus")

# Prometheus alert severity → NagVis state
_SEV_TO_STATE: dict[str, int] = {
    "critical":  2,
    "page":      2,
    "error":     2,
    "warning":   1,
    "warn":      1,
    "info":      1,
}
_SEV_TO_LABEL: dict[str, str] = {
    "critical":  "CRITICAL",
    "page":      "CRITICAL",
    "error":     "CRITICAL",
    "warning":   "WARNING",
    "warn":      "WARNING",
    "info":      "WARNING",
}


@dataclass
class PrometheusConfig:
    """Verbindungsparameter für ein Prometheus/VictoriaMetrics-Backend."""
    backend_id:  str   = "prometheus-default"
    url:         str   = "http://prometheus:9090"
    token:       str   = ""        # Bearer Token (optional)
    username:    str   = ""        # Basic Auth (optional)
    password:    str   = ""
    host_label:  str   = "instance"   # Welches Label als Host-Name verwendet wird
    timeout:     float = 15.0
    verify_ssl:  bool  = True
    enabled:     bool  = True


class PrometheusClient:
    """
    Async-Client für ein Prometheus- oder VictoriaMetrics-Backend.
    Interface identisch zu LivestatusClient / CheckmkClient / Icinga2Client.
    """

    def __init__(self, config: PrometheusConfig):
        self.cfg = config

    # ── HTTP Helpers ──────────────────────────────────────────────────────

    def _base(self) -> str:
        return self.cfg.url.rstrip("/")

    def _headers(self) -> dict:
        h = {"Accept": "application/json"}
        if self.cfg.token:
            h["Authorization"] = f"Bearer {self.cfg.token}"
        return h

    def _auth(self):
        if self.cfg.username:
            return (self.cfg.username, self.cfg.password)
        return None

    async def _get(self, path: str, params: dict | None = None) -> dict | None:
        url = f"{self._base()}{path}"
        try:
            async with httpx.AsyncClient(
                verify=self.cfg.verify_ssl,
                timeout=self.cfg.timeout,
                auth=self._auth(),
            ) as client:
                r = await client.get(url, headers=self._headers(), params=params or {})
                r.raise_for_status()
                data = r.json()
                if data.get("status") != "success":
                    log.error("[%s] Prometheus Fehler: %s", self.cfg.backend_id, data.get("error"))
                    return None
                return data.get("data")
        except Exception as e:
            log.error("[%s] GET %s fehlgeschlagen: %s", self.cfg.backend_id, path, e)
            raise

    # ── Monitoring API ────────────────────────────────────────────────────

    async def get_hosts(self) -> list[HostStatus]:
        """
        Hosts aus der `up`-Metrik ableiten.
        Jede einzigartige Kombination aus host_label-Wert gilt als ein Host.
        Bei mehreren Jobs mit demselben host_label-Wert: schlechtester Status gewinnt.
        """
        data = await self._get("/api/v1/query", {"query": "up"})
        if not data:
            return []

        # host_name → (state, state_label, labels, output) – schlechtester Wert
        merged: dict[str, dict] = {}

        for series in data.get("result", []):
            metric = series.get("metric", {})
            value  = series.get("value", [None, "0"])
            up_val = int(float(value[1])) if len(value) > 1 else 0

            host_name = metric.get(self.cfg.host_label, metric.get("instance", ""))
            if not host_name:
                continue

            state       = 0 if up_val == 1 else 1
            state_label = "UP" if up_val == 1 else "DOWN"
            job         = metric.get("job", "")
            output      = f"job={job}" if job else ""

            # Labels: alle Prometheus-Labels übernehmen (lowercase)
            labels = {k.lower(): v for k, v in metric.items()}

            if host_name not in merged:
                merged[host_name] = {
                    "state":       state,
                    "state_label": state_label,
                    "output":      output,
                    "labels":      labels,
                }
            else:
                # Schlechtester Status gewinnt (DOWN > UP)
                if state > merged[host_name]["state"]:
                    merged[host_name]["state"]       = state
                    merged[host_name]["state_label"] = state_label
                    merged[host_name]["output"]      = output

        out = []
        for name, info in merged.items():
            out.append(HostStatus(
                name          = name,
                alias         = name,
                state         = info["state"],
                state_label   = info["state_label"],
                plugin_output = info["output"],
                last_check    = 0,
                acknowledged  = False,
                in_downtime   = False,
                backend_id    = self.cfg.backend_id,
                labels        = info["labels"],
            ))

        log.debug("get_hosts: %d from '%s'", len(out), self.cfg.backend_id)
        return out

    async def get_services(self) -> list[ServiceStatus]:
        """
        Aktive Prometheus Alerts als Services.
        Firing + severity=critical → CRITICAL, rest → WARNING.
        Inactive/resolved Alerts werden ignoriert.
        """
        data = await self._get("/api/v1/alerts")
        if not data:
            return []

        out = []
        for alert in data.get("alerts", []):
            state_str = alert.get("state", "")   # firing | pending | inactive
            if state_str == "inactive":
                continue

            labels   = alert.get("labels", {})
            annots   = alert.get("annotations", {})
            name     = labels.get("alertname", "unknown")
            severity = labels.get("severity", "warning").lower()

            if state_str == "pending":
                state       = 1
                state_label = "WARNING"
            else:
                state       = _SEV_TO_STATE.get(severity, 1)
                state_label = _SEV_TO_LABEL.get(severity, "WARNING")

            host_name  = labels.get(self.cfg.host_label, labels.get("instance", ""))
            output     = annots.get("summary", annots.get("description", ""))
            nv_labels  = {k.lower(): v for k, v in labels.items()}

            out.append(ServiceStatus(
                host_name     = host_name,
                description   = name,
                state         = state,
                state_label   = state_label,
                plugin_output = output,
                last_check    = 0,
                acknowledged  = False,
                in_downtime   = False,
                perf_data     = "",
                backend_id    = self.cfg.backend_id,
                labels        = nv_labels,
            ))

        log.debug("get_services: %d alerts from '%s'", len(out), self.cfg.backend_id)
        return out

    async def get_hostgroups(self) -> list[dict]:
        """
        Job-Labels als Hostgruppen.
        Alle Targets mit demselben `job`-Label bilden eine Gruppe.
        """
        data = await self._get("/api/v1/query", {"query": "up"})
        if not data:
            return []

        groups: dict[str, set] = {}
        for series in data.get("result", []):
            metric    = series.get("metric", {})
            job       = metric.get("job", "")
            host_name = metric.get(self.cfg.host_label, metric.get("instance", ""))
            if job and host_name:
                groups.setdefault(job, set()).add(host_name)

        return [{"name": job, "members": sorted(members)} for job, members in groups.items()]

    # ── Aktionen (Prometheus ist read-only) ───────────────────────────────

    async def acknowledge_host(self, host_name: str, comment: str = "", author: str = "", sticky: bool = True) -> bool:
        log.info("[%s] acknowledge_host: Prometheus ist read-only – ignoriert", self.cfg.backend_id)
        return False

    async def acknowledge_service(self, host_name: str, service_name: str, comment: str = "", author: str = "", sticky: bool = True) -> bool:
        log.info("[%s] acknowledge_service: Prometheus ist read-only – ignoriert", self.cfg.backend_id)
        return False

    async def schedule_host_downtime(self, host_name: str, start_time: int, end_time: int, comment: str = "", author: str = "") -> bool:
        log.info("[%s] schedule_host_downtime: Prometheus ist read-only – ignoriert", self.cfg.backend_id)
        return False

    async def schedule_service_downtime(self, host_name: str, service_name: str, start_time: int, end_time: int, comment: str = "", author: str = "") -> bool:
        log.info("[%s] schedule_service_downtime: Prometheus ist read-only – ignoriert", self.cfg.backend_id)
        return False

    # ── Ping ──────────────────────────────────────────────────────────────

    async def ping(self) -> BackendHealth:
        """Verbindungstest via /api/v1/status/buildinfo."""
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(
                verify=self.cfg.verify_ssl,
                timeout=self.cfg.timeout,
                auth=self._auth(),
            ) as client:
                r = await client.get(
                    f"{self._base()}/api/v1/status/buildinfo",
                    headers=self._headers(),
                )
                r.raise_for_status()
                data    = r.json()
                version = data.get("data", {}).get("version", "?")
                return BackendHealth(
                    backend_id = self.cfg.backend_id,
                    reachable  = True,
                    latency_ms = round((time.monotonic() - t0) * 1000, 1),
                    last_ok    = time.time(),
                    error      = f"Prometheus {version}",
                )
        except Exception as e:
            log.warning("ping failed [%s]: %s", self.cfg.backend_id, e)
            return BackendHealth(
                backend_id = self.cfg.backend_id,
                reachable  = False,
                error      = str(e),
            )
