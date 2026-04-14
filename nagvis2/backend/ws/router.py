"""
NagVis 2 – WebSocket Endpoint
GET /ws/map/{map_id}
"""

import json
import time
import asyncio
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.config import settings
from core.storage import get_map
from ws.manager import manager, start_poller

ws_router = APIRouter()


@ws_router.websocket("/ws/map/{map_id}")
async def ws_map(websocket: WebSocket, map_id: str):
    client_id = str(uuid.uuid4())

    # WebSocket-Handshake akzeptieren, dann im Manager registrieren
    await websocket.accept()
    manager.connect(map_id, websocket)

    # Poller starten falls noch nicht laufend
    start_poller()

    from ws.demo_data import DEMO_STATUS, DEMO_SERVICES
    from connectors.registry import registry

    async def _send_snapshot():
        # Demo-Modus: kein Backend konfiguriert ODER DEMO_MODE Flag ODER demo-*-Map
        use_demo = (
            settings.DEMO_MODE
            or registry.is_empty()
            or map_id.startswith("demo-")
        )
        if use_demo:
            await websocket.send_text(json.dumps({
                "event":    "snapshot",
                "ts":       time.time(),
                "hosts":    [{**h, "_backend_id": "demo"} for h in DEMO_STATUS],
                "services": [{**s, "_backend_id": "demo"} for s in DEMO_SERVICES],
            }))
        else:
            t0       = time.time()
            # get_all_hosts_tagged() liefert Dicts mit _backend_id – konsistent
            # mit dem Poll-Loop, damit backendStatusCache sofort befüllt wird.
            hosts    = await registry.get_all_hosts_tagged()
            services = await registry.get_all_services_tagged()
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