"""
tests/test_ws_manager.py
========================
Unit-Tests für backend/core/ws_manager.py.

Abgedeckt
---------
  connect / disconnect        – Verbindungs-Lifecycle, Zählerstände
  send()                      – Erfolg, Client nicht verbunden, Fehler → disconnect
  broadcast()                 – alle Clients, map_id-Filter, paralleles Senden
  fanout_loop()               – Events aus Queue werden broadcastet
  send_snapshot()             – Snapshot geht nur an neu verbundenen Client
  stats                       – Zähler korrekt nach Senden
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.core.ws_manager import WebSocketManager, WSConnection


# ── Hilfsfunktionen ───────────────────────────────────────────────────────────

def _mock_ws(client_id: str = "test-client") -> MagicMock:
    """Minimaler WebSocket-Mock der send_text aufzeichnet."""
    ws = MagicMock()
    ws.accept     = AsyncMock()
    ws.send_text  = AsyncMock()
    ws.close      = AsyncMock()
    return ws


async def _connect(manager: WebSocketManager, ws, client_id: str, map_id: str = ""):
    """Hilfsfunktion: verbindet einen Mock-WS und gibt die Verbindung zurück."""
    return await manager.connect(ws, client_id, map_id=map_id)


# ── connect / disconnect ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_connect_accepts_websocket():
    mgr = WebSocketManager()
    ws  = _mock_ws()
    await _connect(mgr, ws, "c1")
    ws.accept.assert_called_once()


@pytest.mark.asyncio
async def test_connect_registers_client():
    mgr = WebSocketManager()
    ws  = _mock_ws()
    await _connect(mgr, ws, "c1")
    assert mgr.stats["total_connections"] == 1


@pytest.mark.asyncio
async def test_disconnect_removes_client():
    mgr = WebSocketManager()
    ws  = _mock_ws()
    await _connect(mgr, ws, "c1")
    await mgr.disconnect("c1")
    assert mgr.stats["total_connections"] == 0


@pytest.mark.asyncio
async def test_disconnect_unknown_client_is_silent():
    """Disconnect eines nicht-verbundenen Clients darf keinen Fehler werfen."""
    mgr = WebSocketManager()
    await mgr.disconnect("ghost")   # kein Exception erwartet


@pytest.mark.asyncio
async def test_multiple_clients_tracked():
    mgr = WebSocketManager()
    for i in range(3):
        await _connect(mgr, _mock_ws(), f"c{i}")
    assert mgr.stats["total_connections"] == 3

    await mgr.disconnect("c1")
    assert mgr.stats["total_connections"] == 2


# ── send ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_send_delivers_json():
    mgr = WebSocketManager()
    ws  = _mock_ws()
    await _connect(mgr, ws, "c1")
    ok  = await mgr.send("c1", {"event": "test", "value": 42})
    assert ok is True
    ws.send_text.assert_called_once()
    sent = json.loads(ws.send_text.call_args[0][0])
    assert sent["event"] == "test"
    assert sent["value"] == 42


@pytest.mark.asyncio
async def test_send_returns_false_for_unknown_client():
    mgr = WebSocketManager()
    ok  = await mgr.send("ghost", {"event": "x"})
    assert ok is False


@pytest.mark.asyncio
async def test_send_disconnects_on_error():
    """Wenn send_text wirft, wird die Verbindung automatisch entfernt."""
    mgr = WebSocketManager()
    ws  = _mock_ws()
    ws.send_text = AsyncMock(side_effect=RuntimeError("connection reset"))
    await _connect(mgr, ws, "c1")

    ok = await mgr.send("c1", {"event": "x"})
    assert ok is False
    assert mgr.stats["total_connections"] == 0


@pytest.mark.asyncio
async def test_send_increments_messages_sent():
    mgr  = WebSocketManager()
    ws   = _mock_ws()
    conn = await _connect(mgr, ws, "c1")
    await mgr.send("c1", {"event": "a"})
    await mgr.send("c1", {"event": "b"})
    assert conn.messages_sent == 2


# ── broadcast ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_broadcast_reaches_all_clients():
    mgr = WebSocketManager()
    ws1 = _mock_ws()
    ws2 = _mock_ws()
    await _connect(mgr, ws1, "c1")
    await _connect(mgr, ws2, "c2")
    await mgr.broadcast({"event": "heartbeat"})
    ws1.send_text.assert_called_once()
    ws2.send_text.assert_called_once()


@pytest.mark.asyncio
async def test_broadcast_map_filter_targets_correct_client():
    """Broadcast mit map_id darf nur Clients dieser Map treffen."""
    mgr = WebSocketManager()
    ws_a = _mock_ws()
    ws_b = _mock_ws()
    await _connect(mgr, ws_a, "c-map-a", map_id="map-a")
    await _connect(mgr, ws_b, "c-map-b", map_id="map-b")

    await mgr.broadcast({"event": "update"}, map_id="map-a")
    ws_a.send_text.assert_called_once()
    ws_b.send_text.assert_not_called()


@pytest.mark.asyncio
async def test_broadcast_no_map_filter_reaches_all():
    """Broadcast ohne map_id erreicht alle Clients unabhängig von ihrer map_id."""
    mgr  = WebSocketManager()
    ws_a = _mock_ws()
    ws_b = _mock_ws()
    await _connect(mgr, ws_a, "c-map-a", map_id="map-a")
    await _connect(mgr, ws_b, "c-global", map_id="")
    await mgr.broadcast({"event": "x"})
    ws_a.send_text.assert_called_once()
    ws_b.send_text.assert_called_once()


@pytest.mark.asyncio
async def test_broadcast_skips_failed_clients():
    """Fehler bei einem Client darf andere nicht blockieren."""
    mgr  = WebSocketManager()
    ws_ok  = _mock_ws()
    ws_bad = _mock_ws()
    ws_bad.send_text = AsyncMock(side_effect=RuntimeError("broken pipe"))
    await _connect(mgr, ws_ok,  "ok")
    await _connect(mgr, ws_bad, "bad")

    await mgr.broadcast({"event": "x"})
    ws_ok.send_text.assert_called_once()
    # bad wurde nach Fehler disconnected
    assert mgr.stats["total_connections"] == 1


@pytest.mark.asyncio
async def test_broadcast_empty_room_is_silent():
    """Broadcast an leere Connection-Liste wirft keinen Fehler."""
    mgr = WebSocketManager()
    await mgr.broadcast({"event": "x"})   # kein Exception erwartet


# ── fanout_loop ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fanout_loop_delivers_event():
    """fanout_loop liest ein Event aus der Queue und broadcastet es."""
    mgr   = WebSocketManager()
    ws    = _mock_ws()
    await _connect(mgr, ws, "c1")

    queue    = asyncio.Queue()
    snapshot = lambda: {"event": "snapshot", "hosts": [], "services": []}

    # Loop als Task starten
    task = asyncio.create_task(mgr.fanout_loop(queue, snapshot))

    # Ein Event einreihen
    await queue.put({"event": "heartbeat", "ts": 9999})
    await asyncio.sleep(0.05)   # Loop Zeit zum Verarbeiten geben

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    ws.send_text.assert_called_once()
    sent = json.loads(ws.send_text.call_args[0][0])
    assert sent["event"] == "heartbeat"


@pytest.mark.asyncio
async def test_fanout_loop_delivers_multiple_events():
    mgr   = WebSocketManager()
    ws    = _mock_ws()
    await _connect(mgr, ws, "c1")

    queue    = asyncio.Queue()
    snapshot = lambda: {"event": "snapshot", "hosts": [], "services": []}
    task     = asyncio.create_task(mgr.fanout_loop(queue, snapshot))

    for i in range(3):
        await queue.put({"event": "update", "seq": i})

    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert ws.send_text.call_count == 3


# ── send_snapshot ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_send_snapshot_delivers_to_single_client():
    mgr  = WebSocketManager()
    ws1  = _mock_ws()
    ws2  = _mock_ws()
    await _connect(mgr, ws1, "c1")
    await _connect(mgr, ws2, "c2")

    snapshot_data = {"event": "snapshot", "hosts": [{"name": "router"}], "services": []}
    # _get_snapshot registrieren wie fanout_loop es tut
    mgr._get_snapshot = lambda: snapshot_data

    await mgr.send_snapshot("c1")

    ws1.send_text.assert_called_once()
    ws2.send_text.assert_not_called()   # nur c1 bekommt den Snapshot

    sent = json.loads(ws1.send_text.call_args[0][0])
    assert sent["event"] == "snapshot"
    assert sent["hosts"][0]["name"] == "router"


@pytest.mark.asyncio
async def test_send_snapshot_without_snapshot_registered_is_silent():
    """send_snapshot vor fanout_loop-Start darf keinen Fehler werfen."""
    mgr = WebSocketManager()
    ws  = _mock_ws()
    await _connect(mgr, ws, "c1")
    await mgr.send_snapshot("c1")   # _get_snapshot noch nicht gesetzt → silent


# ── stats ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_stats_structure():
    mgr  = WebSocketManager()
    ws   = _mock_ws()
    conn = await _connect(mgr, ws, "c1", map_id="map-x")
    await mgr.send("c1", {"event": "x"})

    stats = mgr.stats
    assert stats["total_connections"] == 1
    assert stats["connections"][0]["client_id"] == "c1"
    assert stats["connections"][0]["map_id"]    == "map-x"
    assert stats["connections"][0]["messages_sent"] == 1