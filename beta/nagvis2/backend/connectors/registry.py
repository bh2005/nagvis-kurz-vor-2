"""
connectors/registry.py
======================
Unified Backend Registry – verwaltet Livestatus-, Checkmk-, Icinga2- und Demo-Backends.

Persistenz:  data/backends.json
Laufzeit:    add_backend() / remove_backend() / toggle_backend() wirken sofort

Unterstützte Backend-Typen:
  "livestatus_tcp"   – Livestatus via TCP (remote/distributed)
  "livestatus_unix"  – Livestatus via Unix-Socket (lokal / OMD)
  "checkmk"          – Checkmk REST API v1.0
  "icinga2"          – Icinga2 REST API v1
  "zabbix"           – Zabbix JSON-RPC API (6.0+ empfohlen)
  "demo"             – Statische Demo-Daten ohne Verbindung

Singleton-Instanz:
  from connectors.registry import registry
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Union

from livestatus.client import (
    BackendHealth,
    HostStatus,
    LivestatusClient,
    LivestatusConfig,
    ServiceStatus,
)
from checkmk.client import CheckmkClient, CheckmkConfig
from icinga2.client import Icinga2Client, Icinga2Config
from connectors.demo_client import DemoClient, DemoConfig
from zabbix.client import ZabbixClient, ZabbixConfig

log = logging.getLogger("nagvis.registry")

AnyClient = Union[LivestatusClient, CheckmkClient, Icinga2Client, ZabbixClient, DemoClient]


class UnifiedRegistry:
    """
    Verwaltet n Backends (Livestatus + Checkmk + Demo gemischt).
    Aktive Backends laufen parallel; deaktivierte werden persistiert
    aber nicht abgefragt.
    """

    def __init__(self, config_path: Path):
        self._path     = config_path
        self._clients:  dict[str, AnyClient] = {}   # enabled backends
        self._disabled: dict[str, dict]      = {}   # raw config of disabled backends
        self._load()

    # ── Persistenz ───────────────────────────────────────────────────────

    def _load(self):
        if not self._path.exists():
            log.info("backends.json nicht gefunden – starte ohne Backends")
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            for entry in data.get("backends", []):
                if entry.get("enabled", True):
                    client = self._make_client(entry)
                    if client:
                        self._clients[entry["backend_id"]] = client
                else:
                    self._disabled[entry["backend_id"]] = entry
            log.info("Backends geladen: aktiv=%s deaktiviert=%s",
                     list(self._clients.keys()), list(self._disabled.keys()))
        except Exception as e:
            log.error("Fehler beim Laden von backends.json: %s", e)

    def _save(self):
        backends = []
        for client in self._clients.values():
            raw = self._raw_from_client(client)
            raw["enabled"] = True
            backends.append(raw)
        for entry in self._disabled.values():
            backends.append(entry)   # already has enabled: False
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps({"backends": backends}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def _raw_from_client(self, client: AnyClient) -> dict:
        """Rohe Konfiguration aus einem Client-Objekt rekonstruieren."""
        if isinstance(client, LivestatusClient):
            c = client.cfg
            return {
                "backend_id":  c.backend_id,
                "type":        "livestatus_tcp" if c.use_tcp else "livestatus_unix",
                "socket_path": c.socket_path,
                "host":        c.host,
                "port":        c.port,
                "timeout":     c.timeout,
                "enabled":     c.enabled,
            }
        if isinstance(client, CheckmkClient):
            c = client.cfg
            return {
                "backend_id": c.backend_id,
                "type":       "checkmk",
                "base_url":   c.base_url,
                "username":   c.username,
                "secret":     c.secret,
                "timeout":    c.timeout,
                "verify_ssl": c.verify_ssl,
                "enabled":    c.enabled,
            }
        if isinstance(client, Icinga2Client):
            c = client.cfg
            return {
                "backend_id": c.backend_id,
                "type":       "icinga2",
                "base_url":   c.base_url,
                "username":   c.username,
                "password":   c.password,
                "timeout":    c.timeout,
                "verify_ssl": c.verify_ssl,
                "enabled":    c.enabled,
            }
        if isinstance(client, ZabbixClient):
            c = client.cfg
            return {
                "backend_id": c.backend_id,
                "type":       "zabbix",
                "url":        c.url,
                "token":      c.token,
                "username":   c.username,
                "password":   c.password,
                "timeout":    c.timeout,
                "verify_ssl": c.verify_ssl,
                "enabled":    c.enabled,
            }
        if isinstance(client, DemoClient):
            c = client.cfg
            return {
                "backend_id": c.backend_id,
                "type":       "demo",
                "enabled":    c.enabled,
            }
        return {}

    def _make_client(self, entry: dict) -> AnyClient | None:
        t = entry.get("type", "")
        try:
            if t == "demo":
                return DemoClient(DemoConfig(
                    backend_id = entry["backend_id"],
                    enabled    = bool(entry.get("enabled", True)),
                ))
            elif t == "checkmk":
                return CheckmkClient(CheckmkConfig(
                    backend_id = entry["backend_id"],
                    base_url   = entry.get("base_url", ""),
                    username   = entry.get("username", "automation"),
                    secret     = entry.get("secret", ""),
                    timeout    = float(entry.get("timeout", 15.0)),
                    verify_ssl = bool(entry.get("verify_ssl", True)),
                    enabled    = bool(entry.get("enabled", True)),
                ))
            elif t == "icinga2":
                return Icinga2Client(Icinga2Config(
                    backend_id = entry["backend_id"],
                    base_url   = entry.get("base_url", "https://localhost:5665/v1"),
                    username   = entry.get("username", "nagvis2"),
                    password   = entry.get("password", ""),
                    timeout    = float(entry.get("timeout", 15.0)),
                    verify_ssl = bool(entry.get("verify_ssl", False)),
                    enabled    = bool(entry.get("enabled", True)),
                ))
            elif t == "zabbix":
                return ZabbixClient(ZabbixConfig(
                    backend_id = entry["backend_id"],
                    url        = entry.get("url", "https://zabbix.example.com"),
                    token      = entry.get("token", ""),
                    username   = entry.get("username", "Admin"),
                    password   = entry.get("password", ""),
                    timeout    = float(entry.get("timeout", 15.0)),
                    verify_ssl = bool(entry.get("verify_ssl", True)),
                    enabled    = bool(entry.get("enabled", True)),
                ))
            elif t in ("livestatus_tcp", "livestatus_unix"):
                return LivestatusClient(LivestatusConfig(
                    backend_id  = entry["backend_id"],
                    socket_path = entry.get("socket_path", "/omd/sites/cmk/tmp/run/live"),
                    host        = entry.get("host", ""),
                    port        = int(entry.get("port", 6557)),
                    timeout     = float(entry.get("timeout", 10.0)),
                    use_tcp     = (t == "livestatus_tcp"),
                    enabled     = bool(entry.get("enabled", True)),
                ))
        except Exception as e:
            log.error("Fehler beim Erstellen von Backend '%s': %s",
                      entry.get("backend_id"), e)
        return None

    # ── Parallel Gather ──────────────────────────────────────────────────

    async def _gather_hosts(self) -> list[HostStatus]:
        async def safe(client: AnyClient):
            try:
                return await client.get_hosts()
            except Exception as e:
                bid = getattr(getattr(client, "cfg", None), "backend_id", "?")
                log.error("Backend '%s' get_hosts fehlgeschlagen: %s", bid, e)
                return []
        results = await asyncio.gather(*[safe(c) for c in self._clients.values()])
        return [item for sub in results for item in sub]

    async def _gather_services(self) -> list[ServiceStatus]:
        async def safe(client: AnyClient):
            try:
                return await client.get_services()
            except Exception as e:
                bid = getattr(getattr(client, "cfg", None), "backend_id", "?")
                log.error("Backend '%s' get_services fehlgeschlagen: %s", bid, e)
                return []
        results = await asyncio.gather(*[safe(c) for c in self._clients.values()])
        return [item for sub in results for item in sub]

    # ── Public API ───────────────────────────────────────────────────────

    async def get_all_hosts(self) -> list[HostStatus]:
        """Hosts aller Backends zusammenführen, Duplikate nach Name entfernen."""
        all_hosts = await self._gather_hosts()
        seen: set[str] = set()
        result = []
        for h in all_hosts:
            if h.name not in seen:
                seen.add(h.name)
                result.append(h)
        return result

    async def get_all_services(self) -> list[ServiceStatus]:
        """Services aller Backends."""
        return await self._gather_services()

    async def get_all_hosts_tagged(self) -> list[dict]:
        """Alle Hosts aller Backends als Dicts mit _backend_id-Tag (keine Deduplizierung)."""
        async def safe(bid: str, client: AnyClient):
            try:
                hosts = await client.get_hosts()
                return [{**h.to_dict(), "_backend_id": bid} for h in hosts]
            except Exception as e:
                log.error("Backend '%s' get_hosts fehlgeschlagen: %s", bid, e)
                return []
        results = await asyncio.gather(
            *[safe(bid, c) for bid, c in self._clients.items()]
        )
        return [item for sub in results for item in sub]

    async def get_all_services_tagged(self) -> list[dict]:
        """Alle Services aller Backends als Dicts mit _backend_id-Tag."""
        async def safe(bid: str, client: AnyClient):
            try:
                svcs = await client.get_services()
                return [{**s.to_dict(), "_backend_id": bid} for s in svcs]
            except Exception as e:
                log.error("Backend '%s' get_services fehlgeschlagen: %s", bid, e)
                return []
        results = await asyncio.gather(
            *[safe(bid, c) for bid, c in self._clients.items()]
        )
        return [item for sub in results for item in sub]

    async def health(self) -> list[dict]:
        """Ping alle aktiven Backends parallel."""
        async def safe_ping(client: AnyClient):
            try:
                return await client.ping()
            except Exception as e:
                bid = getattr(getattr(client, "cfg", None), "backend_id", "?")
                return BackendHealth(backend_id=bid, reachable=False, error=str(e))

        results = await asyncio.gather(*[safe_ping(c) for c in self._clients.values()])
        return [
            {
                "backend_id": r.backend_id,
                "reachable":  r.reachable,
                "latency_ms": r.latency_ms,
                "error":      r.error,
                "last_ok":    r.last_ok,
            }
            for r in results
        ]

    async def get_all_hostgroups(self) -> list[dict]:
        """Hostgruppen aus allen Backends zusammenführen (nach Name dedupliziert)."""
        async def safe(client: AnyClient):
            try:
                return await client.get_hostgroups()
            except Exception as e:
                bid = getattr(getattr(client, "cfg", None), "backend_id", "?")
                log.error("Backend '%s' get_hostgroups fehlgeschlagen: %s", bid, e)
                return []
        results = await asyncio.gather(*[safe(c) for c in self._clients.values()])
        seen: set[str] = set()
        merged = []
        for sub in results:
            for hg in sub:
                if hg["name"] not in seen:
                    seen.add(hg["name"])
                    merged.append(hg)
        return merged

    async def schedule_downtime(
        self,
        host_name:    str,
        start_time:   int,
        end_time:     int,
        comment:      str = "NagVis 2",
        author:       str = "nagvis2",
        service_name: str | None = None,
        child_hosts:  bool = False,
    ) -> bool:
        """Wartung an alle aktiven Backends schicken – True wenn mindestens eines erfolgreich."""
        async def _one(client: AnyClient) -> bool:
            try:
                if service_name:
                    return await client.schedule_service_downtime(
                        host_name, service_name, start_time, end_time, comment, author
                    )
                return await client.schedule_host_downtime(
                    host_name, start_time, end_time, comment, author
                )
            except Exception as e:
                log.error("schedule_downtime failed on %s: %s",
                          getattr(getattr(client, "cfg", None), "backend_id", "?"), e)
                return False

        if self.is_empty():
            return False
        results = await asyncio.gather(*[_one(c) for c in self._clients.values()])
        return any(results)

    def is_empty(self) -> bool:
        return len(self._clients) == 0

    async def probe(self, entry: dict) -> BackendHealth:
        """Testet eine Verbindung ohne sie zu registrieren (für den Probe-Endpoint)."""
        client = self._make_client(entry)
        if not client:
            return BackendHealth(
                backend_id = entry.get("backend_id", "probe"),
                reachable  = False,
                error      = f"Unbekannter Typ: {entry.get('type')}",
            )
        return await client.ping()

    # ── Runtime-Management ───────────────────────────────────────────────

    def add_backend(self, entry: dict) -> str:
        """Backend hinzufügen, Client erstellen und in JSON persistieren."""
        bid = entry.get("backend_id")
        if not bid:
            raise ValueError("backend_id fehlt")
        if bid in self._clients or bid in self._disabled:
            raise ValueError(f"Backend '{bid}' existiert bereits")
        client = self._make_client(entry)
        if not client:
            raise ValueError(f"Unbekannter Backend-Typ: {entry.get('type')}")
        self._clients[bid] = client
        self._save()
        log.info("Backend hinzugefügt: %s (%s)", bid, entry.get("type"))
        return bid

    def remove_backend(self, backend_id: str) -> bool:
        """Backend entfernen (aktiv oder deaktiviert) und JSON aktualisieren."""
        if backend_id in self._clients:
            del self._clients[backend_id]
            self._save()
            log.info("Backend entfernt: %s", backend_id)
            return True
        if backend_id in self._disabled:
            del self._disabled[backend_id]
            self._save()
            log.info("Backend (deaktiviert) entfernt: %s", backend_id)
            return True
        return False

    def toggle_backend(self, backend_id: str, enabled: bool) -> bool:
        """Aktiviert oder deaktiviert ein Backend ohne es zu entfernen."""
        if enabled:
            if backend_id in self._clients:
                return True   # bereits aktiv
            entry = self._disabled.pop(backend_id, None)
            if not entry:
                return False
            entry["enabled"] = True
            client = self._make_client(entry)
            if not client:
                self._disabled[backend_id] = entry   # rollback
                log.error("toggle_backend: konnte Client für '%s' nicht erstellen", backend_id)
                return False
            self._clients[backend_id] = client
            self._save()
            log.info("Backend '%s' aktiviert", backend_id)
            return True
        else:
            if backend_id in self._disabled:
                return True   # bereits deaktiviert
            client = self._clients.pop(backend_id, None)
            if not client:
                return False
            raw = self._raw_from_client(client)
            raw["enabled"] = False
            self._disabled[backend_id] = raw
            self._save()
            log.info("Backend '%s' deaktiviert", backend_id)
            return True

    def get_backend_info(self, backend_id: str) -> dict | None:
        client = self._clients.get(backend_id)
        if client:
            return self._client_info(client)
        if backend_id in self._disabled:
            return self._entry_info(self._disabled[backend_id])
        return None

    def get_raw_config(self, backend_id: str) -> dict | None:
        """Vollständige Konfiguration aus backends.json (inkl. secret) – für Edit-Dialog."""
        if not self._path.exists():
            return None
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            for entry in data.get("backends", []):
                if entry.get("backend_id") == backend_id:
                    return entry
        except Exception:
            pass
        return None

    def list_backends(self) -> list[dict]:
        active   = [self._client_info(c) for c in self._clients.values()]
        disabled = [self._entry_info(e)  for e in self._disabled.values()]
        return active + disabled

    def _client_info(self, client: AnyClient) -> dict:
        if isinstance(client, LivestatusClient):
            c = client.cfg
            return {
                "backend_id": c.backend_id,
                "type":       "livestatus_tcp" if c.use_tcp else "livestatus_unix",
                "address":    f"{c.host}:{c.port}" if c.use_tcp else c.socket_path,
                "enabled":    True,
            }
        if isinstance(client, CheckmkClient):
            c = client.cfg
            return {
                "backend_id": c.backend_id,
                "type":       "checkmk",
                "address":    c.base_url,
                "username":   c.username,
                "enabled":    True,
            }
        if isinstance(client, Icinga2Client):
            c = client.cfg
            return {
                "backend_id": c.backend_id,
                "type":       "icinga2",
                "address":    c.base_url,
                "username":   c.username,
                "enabled":    True,
            }
        if isinstance(client, ZabbixClient):
            c = client.cfg
            return {
                "backend_id": c.backend_id,
                "type":       "zabbix",
                "address":    c.url,
                "username":   c.username if not c.token else "(API-Token)",
                "enabled":    True,
            }
        if isinstance(client, DemoClient):
            return {
                "backend_id": client.cfg.backend_id,
                "type":       "demo",
                "address":    "—",
                "enabled":    True,
            }
        return {}

    def _entry_info(self, entry: dict) -> dict:
        """Info-Dict für einen deaktivierten Backend-Eintrag."""
        t   = entry.get("type", "")
        adr = (
            entry.get("base_url")
            or entry.get("socket_path")
            or (f"{entry.get('host','')}:{entry.get('port','')}" if entry.get("host") else "—")
        )
        info: dict = {
            "backend_id": entry["backend_id"],
            "type":       t,
            "address":    adr,
            "enabled":    False,
        }
        if entry.get("username"):
            info["username"] = entry["username"]
        return info


# ── Singleton ─────────────────────────────────────────────────────────────────

from core.config import settings   # noqa: E402  (nach Klassen-Definition)

registry = UnifiedRegistry(settings.DATA_DIR / "backends.json")
