"""
livestatus/client.py
====================
Asynchroner Livestatus-Client mit Multi-Backend-Support.

Architektur
-----------
  LivestatusConfig      – Verbindungsparameter einer einzelnen CMK-Site
  LivestatusClient      – Query-Client für genau eine Site
  BackendRegistry       – Verwaltet n Clients, führt parallele Queries zusammen

Unterstützte Verbindungstypen
  - Unix-Socket  (OMD-Standard: /omd/sites/<site>/tmp/run/live)
  - TCP-Socket   (remote Livestatus, z.B. distributed CMK)

Multi-Backend-Verhalten
  - Alle Backends werden parallel abgefragt (asyncio.gather)
  - Fehler eines Backends werden geloggt, blockieren aber nicht die anderen
  - Ergebnisse werden zusammengeführt; jedes Objekt trägt sein backend_id
  - BackendRegistry.get_all_hosts() liefert deduplizierte Liste
    (bei gleichem Hostnamen gewinnt der erste erreichbare Backend)

Konfigurationsbeispiel (main.py)
  BACKENDS = [
    LivestatusConfig(
        backend_id  = "site-hamburg",
        socket_path = "/omd/sites/hamburg/tmp/run/live",
    ),
    LivestatusConfig(
        backend_id  = "site-berlin",
        use_tcp     = True,
        host        = "mon-berlin.example.com",
        port        = 6557,
    ),
  ]
  registry = BackendRegistry(BACKENDS)
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from enum import IntEnum
from typing import Any

log = logging.getLogger("nagvis.livestatus")


# ── State-Enums & Labels ─────────────────────────────────────────────────────

class HostState(IntEnum):
    UP          = 0
    DOWN        = 1
    UNREACHABLE = 2

class ServiceState(IntEnum):
    OK       = 0
    WARNING  = 1
    CRITICAL = 2
    UNKNOWN  = 3

HOST_STATE_LABEL    = {0: "UP", 1: "DOWN", 2: "UNREACHABLE"}
SERVICE_STATE_LABEL = {0: "OK", 1: "WARNING", 2: "CRITICAL", 3: "UNKNOWN"}

# Worst-State-Ordnung (höher = schlimmer)
HOST_STATE_SEVERITY    = {0: 0, 1: 2, 2: 1}        # UP < UNREACHABLE < DOWN
SERVICE_STATE_SEVERITY = {0: 0, 1: 1, 2: 3, 3: 2}  # OK < WARN < UNKN < CRIT


# ── Datenklassen ─────────────────────────────────────────────────────────────

@dataclass
class LivestatusConfig:
    """Verbindungsparameter für ein Livestatus-Backend."""
    backend_id:  str   = "default"
    socket_path: str   = "/omd/sites/cmk/tmp/run/live"
    host:        str   = ""        # TCP: Hostname oder IP
    port:        int   = 6557
    timeout:     float = 10.0
    use_tcp:     bool  = False
    enabled:     bool  = True      # kann zur Laufzeit deaktiviert werden


@dataclass
class HostStatus:
    name:              str
    alias:             str
    state:             int
    state_label:       str
    plugin_output:     str
    last_check:        int
    acknowledged:      bool
    in_downtime:       bool
    num_services_ok:   int = 0
    num_services_warn: int = 0
    num_services_crit: int = 0
    num_services_unkn: int = 0
    backend_id:        str = "default"

    def to_dict(self) -> dict:
        return {
            "type":          "host",
            "name":          self.name,
            "alias":         self.alias,
            "state":         self.state,
            "state_label":   self.state_label,
            "output":        self.plugin_output,
            "last_check":    self.last_check,
            "acknowledged":  self.acknowledged,
            "in_downtime":   self.in_downtime,
            "services_ok":   self.num_services_ok,
            "services_warn": self.num_services_warn,
            "services_crit": self.num_services_crit,
            "services_unkn": self.num_services_unkn,
            "backend_id":    self.backend_id,
        }


@dataclass
class ServiceStatus:
    host_name:     str
    description:   str
    state:         int
    state_label:   str
    plugin_output: str
    last_check:    int
    acknowledged:  bool
    in_downtime:   bool
    perf_data:     str = ""       # raw Nagios perfdata string
    backend_id:    str = "default"

    def to_dict(self) -> dict:
        from core.perfdata import parse_perfdata
        return {
            "type":         "service",
            "host_name":    self.host_name,
            "description":  self.description,
            "state":        self.state,
            "state_label":  self.state_label,
            "output":       self.plugin_output,
            "last_check":   self.last_check,
            "acknowledged": self.acknowledged,
            "in_downtime":  self.in_downtime,
            "perfdata":     parse_perfdata(self.perf_data),
            "backend_id":   self.backend_id,
        }


@dataclass
class BackendHealth:
    """Laufzeit-Status eines einzelnen Backends."""
    backend_id: str
    reachable:  bool
    latency_ms: float = 0.0
    error:      str   = ""
    last_ok:    float = 0.0   # Unix-Timestamp letzter erfolgreicher Ping


# ── Single-Backend Client ─────────────────────────────────────────────────────

class LivestatusClient:
    """
    Async-Client für genau ein Livestatus-Backend.

    Jede Query öffnet eine eigene Verbindung – Livestatus ist
    verbindungslos per Design. Für serielle 30s-Poll-Zyklen ist
    das ausreichend; ein Connection-Pool wäre erst bei >10 req/s nötig.
    """

    def __init__(self, config: LivestatusConfig):
        self.cfg = config

    # ── Verbindung ──────────────────────────────────────────────────────────

    async def _connect(self) -> tuple[asyncio.StreamReader, asyncio.StreamWriter]:
        if self.cfg.use_tcp:
            log.debug("[%s] TCP connect → %s:%d", self.cfg.backend_id, self.cfg.host, self.cfg.port)
            return await asyncio.wait_for(
                asyncio.open_connection(self.cfg.host, self.cfg.port),
                timeout=self.cfg.timeout,
            )
        log.debug("[%s] Unix-Socket connect → %s", self.cfg.backend_id, self.cfg.socket_path)
        return await asyncio.wait_for(
            asyncio.open_unix_connection(self.cfg.socket_path),
            timeout=self.cfg.timeout,
        )

    # ── Low-Level Query ─────────────────────────────────────────────────────

    async def query(self, query_str: str) -> list[list[Any]]:
        """
        Sendet eine Livestatus-Query, gibt JSON-Antwort zurück.
        ResponseHeader fixed16: "200          1234\\n" (16 Bytes)
        """
        t0 = time.monotonic()
        try:
            reader, writer = await self._connect()
        except Exception as e:
            addr = (f"{self.cfg.host}:{self.cfg.port}" if self.cfg.use_tcp
                    else self.cfg.socket_path)
            log.error("[%s] Verbindung fehlgeschlagen (%s) – %s",
                      self.cfg.backend_id, addr, e)
            raise
        try:
            full_query = (
                query_str.strip()
                + "\nOutputFormat: json"
                + "\nResponseHeader: fixed16"
                + "\n\n"
            )
            writer.write(full_query.encode())
            await writer.drain()

            header = await asyncio.wait_for(
                reader.readexactly(16), timeout=self.cfg.timeout
            )
            try:
                status_code = int(header[:3].decode("ascii"))
                data_len    = int(header[4:15].strip().decode("ascii"))
            except (ValueError, UnicodeDecodeError) as parse_err:
                raise RuntimeError(
                    f"[{self.cfg.backend_id}] Ungültiger Response-Header "
                    f"{header!r} – ResponseHeader: fixed16 nicht unterstützt? "
                    f"({parse_err})"
                )

            if status_code != 200:
                raise RuntimeError(
                    f"Livestatus error {status_code} "
                    f"from backend '{self.cfg.backend_id}'"
                )

            raw = await asyncio.wait_for(
                reader.readexactly(data_len), timeout=self.cfg.timeout
            )
            result = json.loads(raw.decode())
            ms = int((time.monotonic() - t0) * 1000)
            log.debug("[%s] Query OK – %d Zeilen in %dms",
                      self.cfg.backend_id, len(result), ms)
            return result

        except Exception as e:
            log.error("[%s] Query FEHLER – %s", self.cfg.backend_id, e)
            raise
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass

    # ── High-Level API ──────────────────────────────────────────────────────

    async def get_hosts(self, host_filter: str = "") -> list[HostStatus]:
        """Alle Hosts, optional mit Livestatus-Filterzeile."""
        q = (
            "GET hosts\n"
            "Columns: name alias state plugin_output last_check "
            "acknowledged scheduled_downtime_depth "
            "num_services_ok num_services_warn "
            "num_services_crit num_services_unknown\n"
        )
        if host_filter:
            q += host_filter + "\n"

        rows = await self.query(q)
        result = []
        for r in rows:
            (name, alias, state, output, last_check,
             ack, downtime_depth,
             svc_ok, svc_warn, svc_crit, svc_unkn) = r
            result.append(HostStatus(
                name              = name,
                alias             = alias or name,
                state             = state,
                state_label       = HOST_STATE_LABEL.get(state, "UNKNOWN"),
                plugin_output     = output,
                last_check        = last_check,
                acknowledged      = bool(ack),
                in_downtime       = downtime_depth > 0,
                num_services_ok   = svc_ok,
                num_services_warn = svc_warn,
                num_services_crit = svc_crit,
                num_services_unkn = svc_unkn,
                backend_id        = self.cfg.backend_id,
            ))

        log.debug("get_hosts: %d from '%s'", len(result), self.cfg.backend_id)
        return result

    async def get_services(
        self,
        host_name:      str = "",
        service_filter: str = "",
    ) -> list[ServiceStatus]:
        """Services, optional gefiltert nach Host oder eigenem Filter."""
        q = (
            "GET services\n"
            "Columns: host_name description state plugin_output last_check "
            "acknowledged scheduled_downtime_depth perf_data\n"
        )
        if host_name:
            q += f"Filter: host_name = {host_name}\n"
        if service_filter:
            q += service_filter + "\n"

        rows = await self.query(q)
        result = []
        for r in rows:
            host, desc, state, output, last_check, ack, downtime, perf_data = r
            result.append(ServiceStatus(
                host_name     = host,
                description   = desc,
                state         = state,
                state_label   = SERVICE_STATE_LABEL.get(state, "UNKNOWN"),
                plugin_output = output,
                last_check    = last_check,
                acknowledged  = bool(ack),
                in_downtime   = downtime > 0,
                perf_data     = perf_data or "",
                backend_id    = self.cfg.backend_id,
            ))
        return result

    async def get_host_status(self, host_name: str) -> HostStatus | None:
        """Einzelner Host – für Tooltip/Detail."""
        results = await self.get_hosts(f"Filter: name = {host_name}")
        return results[0] if results else None

    async def get_hostgroups(self) -> list[dict]:
        """Alle Hostgruppen mit Mitgliedernamen."""
        rows = await self.query(
            "GET hostgroups\n"
            "Columns: name members\n"
        )
        result = []
        for r in rows:
            if not r or len(r) < 2:
                continue
            name, members = r[0], r[1]
            if isinstance(members, str):
                members = [m.strip() for m in members.split(",") if m.strip()]
            elif not isinstance(members, list):
                members = []
            result.append({"name": name, "members": members})
        log.debug("get_hostgroups: %d from '%s'", len(result), self.cfg.backend_id)
        return result

    async def schedule_service_downtime(
        self,
        host_name:           str,
        service_description: str,
        start_time:          int,
        end_time:            int,
        comment:             str = "NagVis 2",
        author:              str = "nagvis2",
    ) -> bool:
        import time as _time
        cmd = (
            f"SCHEDULE_SVC_DOWNTIME;{host_name};{service_description};"
            f"{start_time};{end_time};1;0;0;{author};{comment}"
        )
        lql = f"COMMAND [{int(_time.time())}] {cmd}\n\n"
        try:
            await self.query(lql)
            return True
        except Exception as e:
            log.error("schedule_service_downtime failed: %s", e)
            return False

    async def ping(self) -> BackendHealth:
        """Verbindungstest mit Latenz-Messung."""
        t0 = time.monotonic()
        try:
            await self.query("GET hosts\nColumns: name\nLimit: 1\n")
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


# ── Multi-Backend Registry ────────────────────────────────────────────────────

class BackendRegistry:
    """
    Verwaltet n LivestatusClients und führt Queries parallel aus.

    Fehler-Isolation
      Schlägt Backend X fehl, liefern die anderen trotzdem ihre Daten.
      X wird im Log vermerkt und taucht in health() als unreachable auf.

    Deduplizierung
      Taucht ein Hostname in mehreren Backends auf, gewinnt der erste
      erreichbare Backend (in Reihenfolge der Konfiguration).
    """

    def __init__(self, configs: list[LivestatusConfig]):
        self._clients: dict[str, LivestatusClient] = {
            cfg.backend_id: LivestatusClient(cfg)
            for cfg in configs
            if cfg.enabled
        }
        log.info(
            "BackendRegistry: %d backend(s): %s",
            len(self._clients),
            list(self._clients.keys()),
        )

    # ── Interne Helpers ──────────────────────────────────────────────────────

    def _clients_list(self) -> list[LivestatusClient]:
        return list(self._clients.values())

    async def _gather(self, coro_factory) -> list[Any]:
        """
        Führt coro_factory(client) für alle Backends parallel aus.
        Fehler eines Backends → leere Liste, kein Exception-Propagation.
        """
        async def safe(client: LivestatusClient):
            try:
                return await coro_factory(client)
            except Exception as e:
                log.error("Backend '%s' failed: %s", client.cfg.backend_id, e)
                return []

        results = await asyncio.gather(*[safe(c) for c in self._clients_list()])
        return [item for sublist in results for item in sublist]

    # ── Public API ────────────────────────────────────────────────────────────

    async def get_all_hosts(self, host_filter: str = "") -> list[HostStatus]:
        """Hosts aller Backends zusammenführen, Duplikate entfernen."""
        all_hosts = await self._gather(lambda c: c.get_hosts(host_filter))
        seen: set[str] = set()
        result = []
        for h in all_hosts:
            if h.name not in seen:
                seen.add(h.name)
                result.append(h)
        return result

    async def get_all_services(
        self,
        host_name:      str = "",
        service_filter: str = "",
    ) -> list[ServiceStatus]:
        """Services aller Backends – host+desc ist eindeutig, keine Deduplizierung."""
        return await self._gather(
            lambda c: c.get_services(host_name, service_filter)
        )

    async def get_host_status(self, host_name: str) -> HostStatus | None:
        """Erster Treffer über alle Backends."""
        results = await asyncio.gather(
            *[c.get_host_status(host_name) for c in self._clients_list()],
            return_exceptions=True,
        )
        for r in results:
            if isinstance(r, HostStatus):
                return r
        return None

    async def health(self) -> list[BackendHealth]:
        """Ping alle Backends parallel."""
        results = await asyncio.gather(
            *[c.ping() for c in self._clients_list()],
            return_exceptions=True,
        )
        out = []
        for r in results:
            if isinstance(r, BackendHealth):
                out.append(r)
            else:
                out.append(BackendHealth(
                    backend_id = "unknown",
                    reachable  = False,
                    error      = str(r),
                ))
        return out

    async def get_worst_host_state(self, host_names: list[str]) -> str:
        """
        Schlimmster State einer Gruppe von Hosts.
        Nützlich für Hostgroup-Nodes auf der Map.
        """
        if not host_names:
            return "UNKNOWN"
        filter_lines = "".join(f"Filter: name = {n}\n" for n in host_names)
        if len(host_names) > 1:
            filter_lines += f"Or: {len(host_names)}\n"
        hosts = await self.get_all_hosts(filter_lines.strip())
        if not hosts:
            return "UNKNOWN"
        worst = max(hosts, key=lambda h: HOST_STATE_SEVERITY.get(h.state, 0))
        return worst.state_label

    async def get_worst_service_state(self, service_descriptions: list[str]) -> str:
        """
        Schlimmster State für eine Liste von Service-Descriptions.
        Nützlich für Servicegroup-Nodes.
        """
        if not service_descriptions:
            return "UNKNOWN"
        filter_lines = "".join(
            f"Filter: description = {d}\n" for d in service_descriptions
        )
        if len(service_descriptions) > 1:
            filter_lines += f"Or: {len(service_descriptions)}\n"
        services = await self.get_all_services(service_filter=filter_lines.strip())
        if not services:
            return "UNKNOWN"
        worst = max(services, key=lambda s: SERVICE_STATE_SEVERITY.get(s.state, 0))
        return worst.state_label

    # ── Runtime-Management ────────────────────────────────────────────────────

    def add_backend(self, config: LivestatusConfig) -> None:
        """Backend zur Laufzeit hinzufügen."""
        if config.backend_id in self._clients:
            log.warning("Backend '%s' already exists.", config.backend_id)
            return
        self._clients[config.backend_id] = LivestatusClient(config)
        log.info("Backend added: %s", config.backend_id)

    def remove_backend(self, backend_id: str) -> bool:
        """Backend zur Laufzeit entfernen."""
        if backend_id in self._clients:
            del self._clients[backend_id]
            log.info("Backend removed: %s", backend_id)
            return True
        return False

    def list_backends(self) -> list[dict]:
        """Info-Dict aller registrierten Backends."""
        return [
            {
                "backend_id": c.cfg.backend_id,
                "type":       "tcp" if c.cfg.use_tcp else "unix",
                "address":    (
                    f"{c.cfg.host}:{c.cfg.port}"
                    if c.cfg.use_tcp
                    else c.cfg.socket_path
                ),
                "enabled":    c.cfg.enabled,
            }
            for c in self._clients.values()
        ]