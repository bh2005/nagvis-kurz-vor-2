"""
tests/test_core.py
==================
Unit-Tests für Poller (Change-Detection) und MapStore (CRUD).

Läuft ohne echtes Livestatus dank Mocks.
"""

import asyncio
import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

# ── MapStore Tests ────────────────────────────────────────────

from backend.core.map_store import MapStore


@pytest.fixture
def store(tmp_path):
    """MapStore mit temporärem Verzeichnis."""
    return MapStore(data_dir=tmp_path / "maps")


def test_create_and_get_map(store):
    m = store.create_map("Test Map", "test-map")
    assert m["id"]    == "test-map"
    assert m["title"] == "Test Map"
    assert m["objects"] == []

    loaded = store.get_map("test-map")
    assert loaded == m


def test_list_maps(store):
    store.create_map("Map A", "map-a")
    store.create_map("Map B", "map-b")
    maps = store.list_maps()
    ids = [m["id"] for m in maps]
    assert "map-a" in ids
    assert "map-b" in ids


def test_add_and_remove_object(store):
    store.create_map("Test", "test")
    obj = store.add_object("test", {"type": "host", "name": "srv-web-01", "x": 42.5, "y": 31.2, "iconset": "server"})
    assert obj is not None
    assert obj["name"] == "srv-web-01"
    assert obj["x"]    == 42.5

    cfg = store.get_map("test")
    assert len(cfg["objects"]) == 1

    ok = store.remove_object("test", obj["object_id"])
    assert ok

    cfg = store.get_map("test")
    assert len(cfg["objects"]) == 0


def test_update_position(store):
    store.create_map("Test", "test")
    obj = store.add_object("test", {"type": "host", "name": "router", "x": 10.0, "y": 20.0})
    ok  = store.update_object_position("test", obj["object_id"], 55.5, 66.6)
    assert ok

    cfg = store.get_map("test")
    updated = cfg["objects"][0]
    assert updated["x"] == 55.5
    assert updated["y"] == 66.6


def test_delete_map(store):
    store.create_map("Temp", "temp")
    assert store.get_map("temp") is not None
    store.delete_map("temp")
    assert store.get_map("temp") is None


def test_map_id_sanitization(store):
    # Gefährliche Zeichen werden entfernt
    m = store.create_map("../etc/passwd exploit", "../etc/passwd")
    # Der Pfad muss sicher bleiben
    p = store._path("../etc/passwd")
    assert ".." not in str(p.name)


# ── Poller Tests ──────────────────────────────────────────────

from backend.core.poller       import StatusPoller
from backend.livestatus.client import LivestatusConfig, HostStatus


@pytest.fixture
def poller():
    cfg = LivestatusConfig(socket_path="/nonexistent/live")
    q   = asyncio.Queue()
    return StatusPoller(cfg, interval=999, change_queue=q)


def _make_host(name, state=0, state_label="UP"):
    return HostStatus(
        name=name, alias=name, state=state, state_label=state_label,
        plugin_output="OK", last_check=1234567890,
        acknowledged=False, in_downtime=False,
    )


@pytest.mark.asyncio
async def test_poller_detects_new_host(poller):
    """Neuer Host (nicht im Cache) → muss als Change erscheinen."""
    hosts = [_make_host("srv-web-01", 0, "UP")]

    with patch.object(poller.client, 'get_hosts',    new=AsyncMock(return_value=hosts)), \
         patch.object(poller.client, 'get_services', new=AsyncMock(return_value=[])):

        await poller._poll()

    event = poller.queue.get_nowait()
    assert event["event"]  == "status_update"
    assert len(event["hosts"]) == 1
    assert event["hosts"][0]["name"] == "srv-web-01"


@pytest.mark.asyncio
async def test_poller_no_change_sends_heartbeat(poller):
    """Kein Statuswechsel → Heartbeat statt Update."""
    hosts = [_make_host("srv-web-01", 0, "UP")]

    with patch.object(poller.client, 'get_hosts',    new=AsyncMock(return_value=hosts)), \
         patch.object(poller.client, 'get_services', new=AsyncMock(return_value=[])):

        await poller._poll()   # 1. Poll: Host neu → status_update
        _ = poller.queue.get_nowait()

        await poller._poll()   # 2. Poll: gleicher State → heartbeat

    event = poller.queue.get_nowait()
    assert event["event"] == "heartbeat"


@pytest.mark.asyncio
async def test_poller_detects_state_change(poller):
    """Statuswechsel von UP → DOWN muss erkannt werden."""
    host_up   = [_make_host("srv-web-01", 0, "UP")]
    host_down = [_make_host("srv-web-01", 1, "DOWN")]

    with patch.object(poller.client, 'get_hosts',    new=AsyncMock(return_value=host_up)), \
         patch.object(poller.client, 'get_services', new=AsyncMock(return_value=[])):
        await poller._poll()
        _ = poller.queue.get_nowait()   # erstes status_update wegwerfen

    with patch.object(poller.client, 'get_hosts',    new=AsyncMock(return_value=host_down)), \
         patch.object(poller.client, 'get_services', new=AsyncMock(return_value=[])):
        await poller._poll()

    event = poller.queue.get_nowait()
    assert event["event"] == "status_update"
    assert event["hosts"][0]["state_label"] == "DOWN"


@pytest.mark.asyncio
async def test_poller_error_sends_error_event(poller):
    """Verbindungsfehler → error-Event in die Queue."""
    with patch.object(poller.client, 'get_hosts',
                      new=AsyncMock(side_effect=ConnectionError("socket gone"))):
        await poller._poll()

    event = poller.queue.get_nowait()
    assert event["event"] == "backend_error"
    assert "socket gone" in event["message"]


# ── Snapshot Test ─────────────────────────────────────────────

def test_get_full_snapshot(poller):
    poller._host_cache["router"] = {"name": "router", "state": 0}
    snap = poller.get_full_snapshot()
    assert snap["event"] == "snapshot"
    assert any(h["name"] == "router" for h in snap["hosts"])