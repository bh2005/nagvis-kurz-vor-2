"""
NagVis 2 – WebSocket Connection Manager
Verwaltet aktive WS-Verbindungen pro Map und pusht Status-Updates.
"""

import asyncio
import json
import time
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket
from core.config import settings
from core import livestatus


# ══════════════════════════════════════════════════════════════════════
#  Connection Registry
# ══════════════════════════════════════════════════════════════════════

class ConnectionManager:
    def __init__(self):
        # map_id → Set[WebSocket]
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        # map_id → letzter bekannter Host-Status {name: state_label}
        self._last_states: Dict[str, Dict[str, str]] = defaultdict(dict)

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
    """Ruft Livestatus regelmäßig ab und pusht Änderungen an alle Clients."""
    interval = settings.WS_POLL_INTERVAL
    last_hosts: Dict[str, str] = {}      # name → state_label
    last_services: Dict[str, str] = {}   # "host::svc" → state_label

    while True:
        await asyncio.sleep(interval)

        # Wenn keine Clients verbunden: nichts tun
        total = sum(len(ws) for ws in manager._connections.values())
        if total == 0:
            continue

        try:
            t0 = time.time()

            if settings.DEMO_MODE:
                # Im Demo-Modus: Heartbeat senden
                await manager.broadcast_all({
                    "event":   "heartbeat",
                    "ts":      time.time(),
                    "elapsed": 0,
                })
                continue

            hosts    = await livestatus.get_hosts()
            services = await livestatus.get_services()
            elapsed  = int((time.time() - t0) * 1000)

            # Diff: geänderte Hosts
            changed_hosts = []
            for h in hosts:
                key = h["name"]
                if last_hosts.get(key) != h["state_label"]:
                    changed_hosts.append({**h, "change_type": "state_change"})
                last_hosts[key] = h["state_label"]

            # Diff: geänderte Services
            changed_svcs = []
            for s in services:
                key = f"{s['host_name']}::{s['name']}"
                if last_services.get(key) != s["state_label"]:
                    changed_svcs.append({**s, "change_type": "state_change"})
                last_services[key] = s["state_label"]

            if changed_hosts or changed_svcs:
                await manager.broadcast_all({
                    "event":    "status_update",
                    "ts":       time.time(),
                    "elapsed":  elapsed,
                    "hosts":    changed_hosts,
                    "services": changed_svcs,
                })
            else:
                # Heartbeat damit der Client weiß dass wir noch leben
                await manager.broadcast_all({
                    "event":   "heartbeat",
                    "ts":      time.time(),
                    "elapsed": elapsed,
                })

        except asyncio.CancelledError:
            break
        except Exception as e:
            await manager.broadcast_all({
                "event":   "backend_error",
                "message": str(e),
                "ts":      time.time(),
            })


def start_poller():
    global _poller_task
    if _poller_task is None or _poller_task.done():
        _poller_task = asyncio.create_task(_poll_loop())


def stop_poller():
    global _poller_task
    if _poller_task and not _poller_task.done():
        _poller_task.cancel()