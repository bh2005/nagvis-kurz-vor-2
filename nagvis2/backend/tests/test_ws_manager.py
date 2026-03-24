"""
Tests für ws/manager.py – ConnectionManager + Poll-Loop.
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from ws.manager import ConnectionManager


# ── ConnectionManager Unit-Tests ──────────────────────────────────────────────

class TestConnectionManager:
    @pytest.fixture
    def mgr(self):
        return ConnectionManager()

    def test_connect_and_count(self, mgr):
        ws = MagicMock()
        mgr.connect("map-1", ws)
        assert mgr.connection_count("map-1") == 1

    def test_disconnect_reduces_count(self, mgr):
        ws = MagicMock()
        mgr.connect("map-1", ws)
        mgr.disconnect("map-1", ws)
        assert mgr.connection_count("map-1") == 0

    def test_disconnect_unknown_ws_safe(self, mgr):
        """Disconnect eines nie verbundenen WS darf keinen Fehler werfen."""
        ws = MagicMock()
        mgr.disconnect("map-1", ws)  # kein Fehler

    def test_connection_count_unknown_map(self, mgr):
        assert mgr.connection_count("ghost-map") == 0

    def test_multiple_clients_same_map(self, mgr):
        ws1, ws2, ws3 = MagicMock(), MagicMock(), MagicMock()
        for ws in (ws1, ws2, ws3):
            mgr.connect("shared-map", ws)
        assert mgr.connection_count("shared-map") == 3

    def test_multiple_maps_independent(self, mgr):
        ws_a = MagicMock()
        ws_b = MagicMock()
        mgr.connect("map-a", ws_a)
        mgr.connect("map-b", ws_b)
        assert mgr.connection_count("map-a") == 1
        assert mgr.connection_count("map-b") == 1


class TestBroadcast:
    @pytest.fixture
    def mgr(self):
        return ConnectionManager()

    async def test_broadcast_sends_json(self, mgr):
        ws = AsyncMock()
        mgr.connect("map-1", ws)
        await mgr.broadcast("map-1", {"event": "heartbeat", "ts": 1})
        ws.send_text.assert_called_once()
        sent = json.loads(ws.send_text.call_args[0][0])
        assert sent["event"] == "heartbeat"

    async def test_broadcast_to_empty_map_safe(self, mgr):
        """Broadcast an eine Map ohne Clients darf keinen Fehler werfen."""
        await mgr.broadcast("empty-map", {"event": "test"})

    async def test_broadcast_removes_dead_connections(self, mgr):
        ws_ok   = AsyncMock()
        ws_dead = AsyncMock()
        ws_dead.send_text.side_effect = Exception("connection closed")

        mgr.connect("map-1", ws_ok)
        mgr.connect("map-1", ws_dead)
        assert mgr.connection_count("map-1") == 2

        await mgr.broadcast("map-1", {"event": "test"})

        # Tote Verbindung muss entfernt worden sein
        assert mgr.connection_count("map-1") == 1

    async def test_broadcast_all(self, mgr):
        ws_a = AsyncMock()
        ws_b = AsyncMock()
        mgr.connect("map-a", ws_a)
        mgr.connect("map-b", ws_b)
        await mgr.broadcast_all({"event": "ping"})
        ws_a.send_text.assert_called_once()
        ws_b.send_text.assert_called_once()

    async def test_send_ignores_error(self, mgr):
        """_send() darf bei Exception den Broadcast nicht abbrechen."""
        ws = AsyncMock()
        ws.send_text.side_effect = RuntimeError("network error")
        # _send() intern – kein Fehler nach außen
        await mgr._send(ws, {"event": "test"})


# ── Poller-Logik ──────────────────────────────────────────────────────────────

class TestPollerBootstrap:
    def test_bootstrap_with_demo_mode_skips(self, monkeypatch):
        """Im Demo-Modus wird kein Default-Backend angelegt."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", True)

        with patch("connectors.registry.registry") as mock_registry:
            mock_registry.is_empty.return_value = True
            from ws.manager import _bootstrap_default_backend
            _bootstrap_default_backend()
            mock_registry.add_backend.assert_not_called()

    def test_bootstrap_with_existing_backend_skips(self, monkeypatch):
        """Wenn bereits ein Backend existiert, wird nichts hinzugefügt."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)

        with patch("connectors.registry.registry") as mock_registry:
            mock_registry.is_empty.return_value = False
            from ws.manager import _bootstrap_default_backend
            _bootstrap_default_backend()
            mock_registry.add_backend.assert_not_called()

    def test_bootstrap_livestatus_disabled_skips(self, monkeypatch):
        """LIVESTATUS_TYPE=disabled → kein Backend."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE",        False)
        monkeypatch.setattr(settings, "LIVESTATUS_TYPE",  "disabled")

        with patch("connectors.registry.registry") as mock_registry:
            mock_registry.is_empty.return_value = True
            from ws.manager import _bootstrap_default_backend
            _bootstrap_default_backend()
            mock_registry.add_backend.assert_not_called()


class TestPollLoopDemo:
    async def test_poll_loop_sends_demo_update_when_registry_empty(self, monkeypatch):
        """Poll-Loop schickt Demo-Daten wenn kein Backend konfiguriert ist."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        monkeypatch.setattr(settings, "WS_POLL_INTERVAL", 0)

        ws = AsyncMock()
        mgr = ConnectionManager()
        mgr.connect("test-map", ws)

        with patch("connectors.registry.registry") as mock_reg, \
             patch("ws.manager.manager", mgr):
            mock_reg.is_empty.return_value = True

            from ws.manager import _poll_loop
            task = asyncio.create_task(_poll_loop())
            await asyncio.sleep(0.05)   # eine Iteration abwarten
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

        ws.send_text.assert_called()
        sent = json.loads(ws.send_text.call_args_list[0][0][0])
        assert sent["event"] == "status_update"


# ── Bootstrap-Pfade ────────────────────────────────────────────────────────────

class TestPollerBootstrapPaths:
    def test_bootstrap_tcp_type_adds_backend(self, monkeypatch):
        """LIVESTATUS_TYPE=tcp → TCP-Backend wird angelegt."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE",        False)
        monkeypatch.setattr(settings, "LIVESTATUS_TYPE",  "tcp")
        monkeypatch.setattr(settings, "LIVESTATUS_HOST",  "localhost")
        monkeypatch.setattr(settings, "LIVESTATUS_PORT",  6557)

        with patch("connectors.registry.registry") as mock_registry:
            mock_registry.is_empty.return_value = True
            from ws.manager import _bootstrap_default_backend
            _bootstrap_default_backend()
            mock_registry.add_backend.assert_called_once()
            call_arg = mock_registry.add_backend.call_args[0][0]
            assert call_arg["type"] == "livestatus_tcp"
            assert call_arg["backend_id"] == "default"

    def test_bootstrap_unix_type_adds_backend(self, monkeypatch):
        """LIVESTATUS_TYPE=unix → Unix-Socket-Backend wird angelegt."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE",        False)
        monkeypatch.setattr(settings, "LIVESTATUS_TYPE",  "unix")
        monkeypatch.setattr(settings, "LIVESTATUS_PATH",  "/var/run/live")

        with patch("connectors.registry.registry") as mock_registry:
            mock_registry.is_empty.return_value = True
            from ws.manager import _bootstrap_default_backend
            _bootstrap_default_backend()
            mock_registry.add_backend.assert_called_once()
            call_arg = mock_registry.add_backend.call_args[0][0]
            assert call_arg["type"] == "livestatus_unix"

    def test_bootstrap_add_exception_logged(self, monkeypatch):
        """Fehler bei add_backend wird abgefangen und nicht nach außen gegeben."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE",       False)
        monkeypatch.setattr(settings, "LIVESTATUS_TYPE", "tcp")

        with patch("connectors.registry.registry") as mock_registry:
            mock_registry.is_empty.return_value = True
            mock_registry.add_backend.side_effect = RuntimeError("failed")
            from ws.manager import _bootstrap_default_backend
            _bootstrap_default_backend()   # darf keinen Fehler werfen


# ── start_poller / stop_poller ─────────────────────────────────────────────────

class TestPollerLifecycle:
    async def test_start_poller_creates_task(self, monkeypatch):
        """start_poller legt einen asyncio-Task an."""
        import ws.manager as _mgr
        monkeypatch.setattr(_mgr, "_poller_task", None)

        with patch("ws.manager._bootstrap_default_backend"), \
             patch("ws.manager._poll_loop", new=AsyncMock(side_effect=asyncio.CancelledError)):
            _mgr.start_poller()
            assert _mgr._poller_task is not None
            _mgr._poller_task.cancel()
            try:
                await _mgr._poller_task
            except (asyncio.CancelledError, Exception):
                pass

    async def test_stop_poller_cancels_task(self, monkeypatch):
        """stop_poller bricht den laufenden Task ab."""
        import ws.manager as _mgr

        async def _never_end():
            await asyncio.sleep(9999)

        task = asyncio.create_task(_never_end())
        monkeypatch.setattr(_mgr, "_poller_task", task)
        _mgr.stop_poller()
        assert task.cancelled() or task.cancelling() > 0
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass

    def test_stop_poller_no_task_safe(self, monkeypatch):
        """stop_poller ohne laufenden Task darf keinen Fehler werfen."""
        import ws.manager as _mgr
        monkeypatch.setattr(_mgr, "_poller_task", None)
        _mgr.stop_poller()   # kein Fehler


# ── Poll-Loop Randfälle ────────────────────────────────────────────────────────

class TestPollLoopEdgeCases:
    async def test_poll_loop_skips_when_no_clients(self, monkeypatch):
        """Wenn keine Clients verbunden sind, wird kein Broadcast gesendet."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE",        False)
        monkeypatch.setattr(settings, "WS_POLL_INTERVAL", 0)

        mgr = ConnectionManager()   # keine Clients

        with patch("connectors.registry.registry") as mock_reg, \
             patch("ws.manager.manager", mgr):
            mock_reg.is_empty.return_value = True

            from ws.manager import _poll_loop
            task = asyncio.create_task(_poll_loop())
            await asyncio.sleep(0.05)
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

        # registry.is_empty darf nie abgefragt worden sein, da keine Clients da
        mock_reg.is_empty.assert_not_called()

    async def test_poll_loop_real_backend_changed_hosts(self, monkeypatch):
        """Wenn ein echtes Backend geänderte Hosts hat, wird status_update gesendet."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE",        False)
        monkeypatch.setattr(settings, "WS_POLL_INTERVAL", 0)

        ws = AsyncMock()
        mgr = ConnectionManager()
        mgr.connect("map-1", ws)

        host_mock = MagicMock()
        host_mock.to_dict.return_value = {"name": "srv1", "state_label": "up"}
        svc_mock = MagicMock()
        svc_mock.to_dict.return_value = {
            "host_name": "srv1", "description": "ping", "state_label": "ok"
        }

        with patch("connectors.registry.registry") as mock_reg, \
             patch("ws.manager.manager", mgr):
            mock_reg.is_empty.return_value = False
            mock_reg.get_all_hosts    = AsyncMock(return_value=[host_mock])
            mock_reg.get_all_services = AsyncMock(return_value=[svc_mock])

            from ws.manager import _poll_loop
            task = asyncio.create_task(_poll_loop())
            await asyncio.sleep(0.05)
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

        ws.send_text.assert_called()
        sent = json.loads(ws.send_text.call_args_list[0][0][0])
        assert sent["event"] == "status_update"

    async def test_poll_loop_real_backend_heartbeat_when_no_changes(self, monkeypatch):
        """Nach unverändertem zweitem Poll: heartbeat."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE",        False)
        monkeypatch.setattr(settings, "WS_POLL_INTERVAL", 0)

        ws = AsyncMock()
        mgr = ConnectionManager()
        mgr.connect("map-1", ws)

        host_mock = MagicMock()
        host_mock.to_dict.return_value = {"name": "srv1", "state_label": "up"}

        with patch("connectors.registry.registry") as mock_reg, \
             patch("ws.manager.manager", mgr):
            mock_reg.is_empty.return_value = False
            mock_reg.get_all_hosts    = AsyncMock(return_value=[host_mock])
            mock_reg.get_all_services = AsyncMock(return_value=[])

            from ws.manager import _poll_loop
            task = asyncio.create_task(_poll_loop())
            await asyncio.sleep(0.15)   # mehrere Iterationen
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

        events = [json.loads(c[0][0])["event"]
                  for c in ws.send_text.call_args_list]
        # Erste: status_update, danach heartbeat
        assert "status_update" in events
        if len(events) >= 2:
            assert "heartbeat" in events
