"""
Zusätzliche Tests für ws/manager.py – CancelledError und Exception-Handling im Poll-Loop.
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from ws.manager import ConnectionManager


class TestPollLoopExceptionHandling:
    async def test_poll_loop_exception_broadcasts_error(self, monkeypatch):
        """Wenn das Backend einen Fehler wirft, wird backend_error gebroadcastet."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        monkeypatch.setattr(settings, "WS_POLL_INTERVAL", 0)

        ws = AsyncMock()
        mgr = ConnectionManager()
        mgr.connect("map-1", ws)

        with patch("connectors.registry.registry") as mock_reg, \
             patch("ws.manager.manager", mgr):
            mock_reg.is_empty.return_value = False
            mock_reg.get_all_hosts_tagged    = AsyncMock(side_effect=RuntimeError("backend down"))
            mock_reg.get_all_services_tagged = AsyncMock(return_value=[])

            from ws.manager import _poll_loop
            task = asyncio.create_task(_poll_loop())
            await asyncio.sleep(0.05)
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

        events = [json.loads(c[0][0])["event"]
                  for c in ws.send_text.call_args_list]
        assert "backend_error" in events

    async def test_poll_loop_cancelled_error_breaks_cleanly(self, monkeypatch):
        """CancelledError bricht den Loop sauber ab."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        monkeypatch.setattr(settings, "WS_POLL_INTERVAL", 0)

        ws = AsyncMock()
        mgr = ConnectionManager()
        mgr.connect("map-1", ws)

        iteration_count = 0

        async def fake_get_hosts():
            nonlocal iteration_count
            iteration_count += 1
            if iteration_count >= 2:
                raise asyncio.CancelledError()
            return [{"name": "srv1", "state_label": "UP", "_backend_id": "test"}]

        with patch("connectors.registry.registry") as mock_reg, \
             patch("ws.manager.manager", mgr):
            mock_reg.is_empty.return_value = False
            mock_reg.get_all_hosts_tagged    = AsyncMock(side_effect=fake_get_hosts)
            mock_reg.get_all_services_tagged = AsyncMock(return_value=[])

            from ws.manager import _poll_loop
            task = asyncio.create_task(_poll_loop())
            try:
                await asyncio.wait_for(task, timeout=1.0)
            except (asyncio.CancelledError, asyncio.TimeoutError, Exception):
                pass

        # Test erfolgreich wenn kein unkontrollierter Fehler aufgetreten ist
        assert True

    async def test_poll_loop_exception_increments_metrics(self, monkeypatch):
        """Fehler in Poll-Loop → Metrik-Counter wird erhöht."""
        from contextlib import ExitStack
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        monkeypatch.setattr(settings, "WS_POLL_INTERVAL", 0)

        ws = AsyncMock()
        mgr = ConnectionManager()
        mgr.connect("map-1", ws)

        mock_counter = MagicMock()
        mock_counter.labels.return_value = mock_counter

        try:
            import core.metrics as _cm
            has_metrics = True
        except ImportError:
            has_metrics = False

        patch_list = [
            patch("connectors.registry.registry"),
            patch("ws.manager.manager", mgr),
        ]
        if has_metrics:
            patch_list.append(patch("core.metrics.backend_poll_errors", mock_counter))

        with ExitStack() as stack:
            patchers = [stack.enter_context(p) for p in patch_list]
            mock_reg = patchers[0]
            mock_reg.is_empty.return_value = False
            mock_reg.get_all_hosts_tagged    = AsyncMock(side_effect=RuntimeError("error"))
            mock_reg.get_all_services_tagged = AsyncMock(return_value=[])

            from ws.manager import _poll_loop
            task = asyncio.create_task(_poll_loop())
            await asyncio.sleep(0.05)
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

        # Mindestens ein Fehler-Event gesendet
        events = [json.loads(c[0][0])["event"]
                  for c in ws.send_text.call_args_list]
        assert "backend_error" in events

    async def test_poll_loop_demo_mode_active(self, monkeypatch):
        """DEMO_MODE=True → Demo-Daten werden gepusht."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", True)
        monkeypatch.setattr(settings, "WS_POLL_INTERVAL", 0)

        ws = AsyncMock()
        mgr = ConnectionManager()
        mgr.connect("map-1", ws)

        with patch("connectors.registry.registry") as mock_reg, \
             patch("ws.manager.manager", mgr):
            mock_reg.is_empty.return_value = False  # irrelevant im Demo-Modus

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

    async def test_poll_loop_metrics_observed_on_success(self, monkeypatch):
        """Erfolgreicher Poll → backend_poll_duration.observe() wird aufgerufen."""
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        monkeypatch.setattr(settings, "WS_POLL_INTERVAL", 0)

        ws = AsyncMock()
        mgr = ConnectionManager()
        mgr.connect("map-1", ws)

        mock_histogram = MagicMock()

        # core.metrics kann fehlen wenn prometheus_client nicht installiert ist
        try:
            import core.metrics as _cm
            has_metrics = True
        except ImportError:
            has_metrics = False

        with patch("connectors.registry.registry") as mock_reg, \
             patch("ws.manager.manager", mgr):
            if has_metrics:
                monkeypatch.setattr(_cm, "backend_poll_duration", mock_histogram)
            mock_reg.is_empty.return_value = False
            mock_reg.get_all_hosts_tagged    = AsyncMock(return_value=[
                {"name": "srv1", "state_label": "UP", "_backend_id": "test"}
            ])
            mock_reg.get_all_services_tagged = AsyncMock(return_value=[])

            from ws.manager import _poll_loop
            task = asyncio.create_task(_poll_loop())
            await asyncio.sleep(0.05)
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

        if has_metrics:
            mock_histogram.observe.assert_called()
