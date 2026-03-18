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

    try:
        # Initialen Snapshot senden
        if settings.DEMO_MODE:
            from ws.demo_data import DEMO_STATUS
            await websocket.send_text(json.dumps({
                "event":    "snapshot",
                "ts":       time.time(),
                "hosts":    DEMO_STATUS,
                "services": [],
            }))
        else:
            t0      = time.time()
            hosts   = await livestatus.get_hosts()
            services= await livestatus.get_services()
            elapsed = int((time.time() - t0) * 1000)
            await websocket.send_text(json.dumps({
                "event":    "snapshot",
                "ts":       time.time(),
                "elapsed":  elapsed,
                "hosts":    hosts,
                "services": services,
            }))

        # Client-Nachrichten empfangen
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(raw)

                if msg.get("cmd") == "force_refresh":
                    if settings.DEMO_MODE:
                        from ws.demo_data import DEMO_STATUS
                        await websocket.send_text(json.dumps({
                            "event":    "snapshot",
                            "ts":       time.time(),
                            "hosts":    DEMO_STATUS,
                            "services": [],
                        }))
                    else:
                        hosts    = await livestatus.get_hosts()
                        services = await livestatus.get_services()
                        await websocket.send_text(json.dumps({
                            "event":    "snapshot",
                            "ts":       time.time(),
                            "hosts":    hosts,
                            "services": services,
                        }))

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