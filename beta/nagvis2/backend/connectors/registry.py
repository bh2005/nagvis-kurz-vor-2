"""
connectors/registry.py
======================
Unified Backend Registry – verwaltet Livestatus- und Checkmk-Backends.

Persistenz:  data/backends.json
Laufzeit:    add_backend() / remove_backend() wirken sofort ohne Neustart

Unterstützte Backend-Typen:
  "livestatus_tcp"   – Livestatus via TCP (remote/distributed)
  "livestatus_unix"  – Livestatus via Unix-Socket (lokal / OMD)
  "checkmk"          – Checkmk REST API v1.0

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

log = logging.getLogger("nagvis.registry")

AnyClient = Union[LivestatusClient, CheckmkClient]


class UnifiedRegistry:
    """
    Verwaltet n Backends (Livestatus + Checkmk gemischt).
    Alle Abfragen laufen parallel; Fehler einzelner Backends
    blockieren die anderen nicht.
    """

    def __init__(self, config_path: Path):
        self._path    = config_path
        self._clients: dict[str, AnyClient] = {}
        self._load()

    # ── Persistenz ───────────────────────────────────────────────────────

    def _load(self):
        if not self._path.exists():
            log.info("backends.json nicht gefunden – starte ohne Backends")
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            for entry in data.get("backends", []):
                if not entry.get("enabled", True):
                    continue
                client = self._make_client(entry)
                if client:
                    self._clients[entry["backend_id"]] = client
            log.info("Backends geladen: %s", list(self._clients.keys()))
        except Exception as e:
            log.error("Fehler beim Laden von backends.json: %s", e)

    def _save(self):
        backends = []
        for client in self._clients.values():
            if isinstance(client, LivestatusClient):
                c = client.cfg
                backends.append({
                    "backend_id":  c.backend_id,
                    "type":        "livestatus_tcp" if c.use_tcp else "livestatus_unix",
                    "socket_path": c.socket_path,
                    "host":        c.host,
                    "port":        c.port,
                    "timeout":     c.timeout,
                    "enabled":     c.enabled,
                })
            elif isinstance(client, CheckmkClient):
                c = client.cfg
                backends.append({
                    "backend_id": c.backend_id,
                    "type":       "checkmk",
                    "base_url":   c.base_url,
                    "username":   c.username,
                    "secret":     c.secret,
                    "timeout":    c.timeout,
                    "verify_ssl": c.verify_ssl,
                    "enabled":    c.enabled,
                })
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps({"backends": backends}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def _make_client(self, entry: dict) -> AnyClient | None:
        t = entry.get("type", "")
        try:
            if t == "checkmk":
                return CheckmkClient(CheckmkConfig(
                    backend_id = entry["backend_id"],
                    base_url   = entry.get("base_url", ""),
                    username   = entry.get("username", "automation"),
                    secret     = entry.get("secret", ""),
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

    async def health(self) -> list[dict]:
        """Ping alle Backends parallel."""
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
        if bid in self._clients:
            raise ValueError(f"Backend '{bid}' existiert bereits")
        client = self._make_client(entry)
        if not client:
            raise ValueError(f"Unbekannter Backend-Typ: {entry.get('type')}")
        self._clients[bid] = client
        self._save()
        log.info("Backend hinzugefügt: %s (%s)", bid, entry.get("type"))
        return bid

    def remove_backend(self, backend_id: str) -> bool:
        """Backend entfernen und JSON aktualisieren."""
        if backend_id not in self._clients:
            return False
        del self._clients[backend_id]
        self._save()
        log.info("Backend entfernt: %s", backend_id)
        return True

    def get_backend_info(self, backend_id: str) -> dict | None:
        client = self._clients.get(backend_id)
        if not client:
            return None
        return self._client_info(client)

    def list_backends(self) -> list[dict]:
        return [self._client_info(c) for c in self._clients.values()]

    def _client_info(self, client: AnyClient) -> dict:
        if isinstance(client, LivestatusClient):
            c = client.cfg
            return {
                "backend_id": c.backend_id,
                "type":       "livestatus_tcp" if c.use_tcp else "livestatus_unix",
                "address":    f"{c.host}:{c.port}" if c.use_tcp else c.socket_path,
                "enabled":    c.enabled,
            }
        elif isinstance(client, CheckmkClient):
            c = client.cfg
            return {
                "backend_id": c.backend_id,
                "type":       "checkmk",
                "address":    c.base_url,
                "username":   c.username,
                "enabled":    c.enabled,
            }
        return {}


# ── Singleton ─────────────────────────────────────────────────────────────────

from core.config import settings   # noqa: E402  (nach Klassen-Definition)

registry = UnifiedRegistry(settings.DATA_DIR / "backends.json")
