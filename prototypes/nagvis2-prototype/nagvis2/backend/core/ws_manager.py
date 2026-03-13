"""
core/ws_manager.py
==================
WebSocket Connection Manager.

Verwaltet alle aktiven Browser-Verbindungen und
broadcastet Events vom Poller an alle Clients.

Architektur:
  Poller → asyncio.Queue → ws_manager → [WS1, WS2, WS3, ...]

Pro Map kann ein Client eine "room" subscriben –
dann bekommt er nur Events die seine Map betreffen.
(Für MVP: alle Clients bekommen alle Events.)
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Callable

from fastapi import WebSocket

log = logging.getLogger("nagvis.ws_manager")


@dataclass
class WSConnection:
    websocket: WebSocket
    client_id: str
    map_id:    str        = ""        # "" = alle Maps
    connected_at: float  = field(default_factory=time.time)
    messages_sent: int   = 0
    messages_failed: int = 0


class WebSocketManager:
    """
    Hält alle aktiven WebSocket-Verbindungen und
    verteilt Events vom Poller an Browser-Clients.
    """

    def __init__(self):
        self._connections: dict[str, WSConnection] = {}
        self._lock = asyncio.Lock()

    # ── Verbindungs-Lifecycle ─────────────────────────────────

    async def connect(
        self,
        websocket: WebSocket,
        client_id: str,
        map_id: str = "",
    ) -> WSConnection:
        await websocket.accept()
        conn = WSConnection(
            websocket    = websocket,
            client_id    = client_id,
            map_id       = map_id,
        )
        async with self._lock:
            self._connections[client_id] = conn

        log.info("WS connected: %s (map=%s) – total: %d",
                 client_id, map_id or "*", len(self._connections))
        return conn

    async def disconnect(self, client_id: str):
        async with self._lock:
            conn = self._connections.pop(client_id, None)
        if conn:
            log.info("WS disconnected: %s – total: %d",
                     client_id, len(self._connections))

    # ── Senden ───────────────────────────────────────────────

    async def send(self, client_id: str, data: dict) -> bool:
        """Sendet ein Event an einen einzelnen Client."""
        async with self._lock:
            conn = self._connections.get(client_id)
        if not conn:
            return False

        try:
            await conn.websocket.send_text(json.dumps(data))
            conn.messages_sent += 1
            return True
        except Exception as e:
            log.warning("WS send failed for %s: %s", client_id, e)
            conn.messages_failed += 1
            await self.disconnect(client_id)
            return False

    async def broadcast(self, data: dict, map_id: str = ""):
        """
        Broadcastet ein Event an alle Clients.
        Wenn map_id angegeben: nur Clients die diese Map subscribed haben.

        Sendet parallel (asyncio.gather) um Latenzen zu minimieren.
        """
        async with self._lock:
            targets = list(self._connections.values())

        if map_id:
            targets = [c for c in targets if not c.map_id or c.map_id == map_id]

        if not targets:
            return

        payload = json.dumps(data)

        async def _send_one(conn: WSConnection):
            try:
                await conn.websocket.send_text(payload)
                conn.messages_sent += 1
            except Exception as e:
                log.debug("Broadcast failed for %s: %s", conn.client_id, e)
                conn.messages_failed += 1
                # Kaputte Verbindung aus der Liste nehmen
                await self.disconnect(conn.client_id)

        await asyncio.gather(*[_send_one(c) for c in targets], return_exceptions=True)

    # ── Fan-out Loop (läuft als Background-Task) ─────────────

    async def fanout_loop(
        self,
        queue:    asyncio.Queue,
        get_snapshot: Callable[[], dict],
    ):
        """
        Liest Events aus der Poller-Queue und broadcastet sie.
        Wird als asyncio.create_task() gestartet.

        get_snapshot: Callable der den vollen State zurückgibt –
                      wird beim Connect eines neuen Clients verwendet.
        """
        self._get_snapshot = get_snapshot
        log.info("Fan-out loop started")

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=60.0)
                await self.broadcast(event)
                queue.task_done()
            except asyncio.TimeoutError:
                # Nichts in der Queue – kurzer Heartbeat
                pass
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error("Fan-out error: %s", e)

    async def send_snapshot(self, client_id: str):
        """
        Sendet den vollen State-Snapshot an einen neu verbundenen Client.
        Damit sieht der Browser sofort den aktuellen Status ohne
        auf den nächsten Poll-Zyklus zu warten.
        """
        if hasattr(self, '_get_snapshot'):
            snapshot = self._get_snapshot()
            await self.send(client_id, snapshot)

    # ── Stats ────────────────────────────────────────────────

    @property
    def stats(self) -> dict:
        connections = []
        for conn in self._connections.values():
            connections.append({
                "client_id":     conn.client_id,
                "map_id":        conn.map_id,
                "connected_at":  conn.connected_at,
                "messages_sent": conn.messages_sent,
            })
        return {
            "total_connections": len(self._connections),
            "connections":       connections,
        }