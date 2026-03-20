"""
NagVis 2 – WebSocket Endpoint
GET /ws/map/{map_id}
"""

import json
import time
import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.config import settings
from core.storage import get_map
from core import livestatus
from ws.manager import manager, start_poller

ws_router = APIRouter()


@ws_router.websocket("/ws/map/{map_id}")
async def ws_map(websocket: WebSocket, map_id: str):
    await websocket.accept()

    # Poller starten falls noch nicht laufend
    start_poller()

    manager.connect(map_id, websocket)

    from ws.demo_data import DEMO_STATUS, DEMO_SERVICES
    is_demo_map = (map_id == "demo-features")

    async def _send_snapshot():
        if settings.DEMO_MODE or is_demo_map:
            await websocket.send_text(json.dumps({
                "event":    "snapshot",
                "ts":       time.time(),
                "hosts":    DEMO_STATUS,
                "services": DEMO_SERVICES,
            }))
        else:
            t0       = time.time()
            hosts    = await livestatus.get_hosts()
            services = await livestatus.get_services()
            elapsed  = int((time.time() - t0) * 1000)
            await websocket.send_text(json.dumps({
                "event":    "snapshot",
                "ts":       time.time(),
                "elapsed":  elapsed,
                "hosts":    hosts,
                "services": services,
            }))

    try:
        # Initialen Snapshot senden
        await _send_snapshot()

        # Client-Nachrichten empfangen
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(raw)

                if msg.get("cmd") == "force_refresh":
                    await _send_snapshot()

            except asyncio.TimeoutError:
                # Heartbeat wenn Client nichts sendet
                await websocket.send_text(json.dumps({
                    "event": "heartbeat",
                    "ts":    time.time(),
                }))

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(map_id, websocket)