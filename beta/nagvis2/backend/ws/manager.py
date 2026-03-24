"""
NagVis 2 – WebSocket Connection Manager
Verwaltet aktive WS-Verbindungen pro Map und pusht Status-Updates.
"""

import asyncio
import json
import logging
import time
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket
from core.config import settings

log = logging.getLogger("nagvis.ws")


# ══════════════════════════════════════════════════════════════════════
#  Connection Registry
# ══════════════════════════════════════════════════════════════════════

class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    def connect(self, map_id: str, ws: WebSocket):
        self._connections[map_id].add(ws)

    def disconnect(self, map_id: str, ws: WebSocket):
        self._connections[map_id].discard(ws)

    async def _send(self, ws: WebSocket, data: dict):
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            pass

    async def broadcast(self, map_id: str, data: dict):
        dead = set()
        for ws in list(self._connections.get(map_id, set())):
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections[map_id].discard(ws)

    async def broadcast_all(self, data: dict):
        for map_id in list(self._connections.keys()):
            await self.broadcast(map_id, data)

    def connection_count(self, map_id: str) -> int:
        return len(self._connections.get(map_id, set()))


manager = ConnectionManager()


# ══════════════════════════════════════════════════════════════════════
#  Status-Poller (läuft als Background-Task)
# ══════════════════════════════════════════════════════════════════════

_poller_task: asyncio.Task | None = None


async def _poll_loop():
    """Pollt alle konfigurierten Backends und pusht Änderungen an alle Clients."""
    from connectors.registry import registry

    interval     = settings.WS_POLL_INTERVAL
    last_hosts:    Dict[str, str] = {}   # "backend_id::name" → state_label
    last_services: Dict[str, str] = {}  # "backend_id::host::desc" → state_label

    while True:
        await asyncio.sleep(interval)

        # Keine Clients verbunden → nichts tun
        total = sum(len(ws) for ws in manager._connections.values())
        if total == 0:
            continue

        try:
            t0 = time.time()

            if settings.DEMO_MODE or registry.is_empty():
                # Demo-Modus: periodisch Demo-Daten pushen (simuliert Live-Updates)
                from ws.demo_data import DEMO_STATUS, DEMO_SERVICES
                demo_hosts = [{**h, "_backend_id": "demo"} for h in DEMO_STATUS]
                demo_svcs  = [{**s, "_backend_id": "demo"} for s in DEMO_SERVICES]
                await manager.broadcast_all({
                    "event":    "status_update",
                    "ts":       t0,
                    "elapsed":  0,
                    "hosts":    demo_hosts,
                    "services": demo_svcs,
                })
                continue

            hosts    = await registry.get_all_hosts_tagged()
            services = await registry.get_all_services_tagged()
            elapsed  = time.time() - t0

            # Prometheus: Poll-Dauer messen
            try:
                from core.metrics import backend_poll_duration
                backend_poll_duration.observe(elapsed)
            except Exception:
                pass

            elapsed_ms = int(elapsed * 1000)

            # Diff: geänderte Hosts (Key = "backend_id::name")
            changed_hosts = []
            for h in hosts:
                key = f"{h['_backend_id']}::{h['name']}"
                if last_hosts.get(key) != h["state_label"]:
                    changed_hosts.append({**h, "change_type": "state_change"})
                last_hosts[key] = h["state_label"]

            # Diff: geänderte Services (Key = "backend_id::host::desc")
            changed_svcs = []
            for s in services:
                key = f"{s['_backend_id']}::{s['host_name']}::{s['description']}"
                if last_services.get(key) != s["state_label"]:
                    changed_svcs.append({**s, "change_type": "state_change"})
                last_services[key] = s["state_label"]

            if changed_hosts or changed_svcs:
                await manager.broadcast_all({
                    "event":    "status_update",
                    "ts":       t0,
                    "elapsed":  elapsed_ms,
                    "hosts":    changed_hosts,
                    "services": changed_svcs,
                })
            else:
                await manager.broadcast_all({
                    "event":   "heartbeat",
                    "ts":      t0,
                    "elapsed": elapsed_ms,
                })

        except asyncio.CancelledError:
            break
        except Exception as e:
            log.error("Poll-Loop Fehler: %s", e)
            try:
                from core.metrics import backend_poll_errors
                backend_poll_errors.labels(backend_id="all").inc()
            except Exception:
                pass
            await manager.broadcast_all({
                "event":   "backend_error",
                "message": str(e),
                "ts":      time.time(),
            })


def _bootstrap_default_backend():
    """
    Erstellt beim ersten Start ein Default-Livestatus-Backend aus den
    LIVESTATUS_* Umgebungsvariablen, falls noch kein Backend konfiguriert ist.
    Rückwärtskompatibilität zu Single-Backend-Deployments.
    """
    from connectors.registry import registry

    if not registry.is_empty() or settings.DEMO_MODE:
        return

    ls_type = settings.LIVESTATUS_TYPE.lower()
    if ls_type == "disabled":
        return

    if ls_type in ("tcp", "auto"):
        entry = {
            "backend_id": "default",
            "type":       "livestatus_tcp",
            "host":       settings.LIVESTATUS_HOST,
            "port":       settings.LIVESTATUS_PORT,
            "enabled":    True,
        }
    else:
        entry = {
            "backend_id":  "default",
            "type":        "livestatus_unix",
            "socket_path": settings.LIVESTATUS_PATH,
            "enabled":     True,
        }

    try:
        registry.add_backend(entry)
        log.info("Default-Backend aus LIVESTATUS_* Vars erstellt: %s", entry.get("type"))
    except Exception as e:
        log.warning("Default-Backend konnte nicht erstellt werden: %s", e)


def start_poller():
    global _poller_task
    _bootstrap_default_backend()
    if _poller_task is None or _poller_task.done():
        _poller_task = asyncio.create_task(_poll_loop())


def stop_poller():
    global _poller_task
    if _poller_task and not _poller_task.done():
        _poller_task.cancel()
