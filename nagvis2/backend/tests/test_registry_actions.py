"""
Tests für die neuen Aktions-Methoden in connectors/registry.py:
  - acknowledge_host / acknowledge_service
  - reschedule_check
  - schedule_downtime mit child_hosts

Außerdem: checkmk child_hosts-Parameter in allen Client-Signaturen.
"""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from connectors.registry import UnifiedRegistry


@pytest.fixture
def reg(tmp_path):
    """Leere Registry ohne persistierte Backends."""
    return UnifiedRegistry(tmp_path / "backends.json")


def _make_mock_client(backend_id: str = "test") -> MagicMock:
    """Mock-Client der alle Action-Methoden hat."""
    c = MagicMock()
    c.cfg = MagicMock()
    c.cfg.backend_id = backend_id
    c.acknowledge_host         = AsyncMock(return_value=True)
    c.acknowledge_service      = AsyncMock(return_value=True)
    c.reschedule_host_check    = AsyncMock(return_value=True)
    c.schedule_host_downtime   = AsyncMock(return_value=True)
    c.schedule_service_downtime = AsyncMock(return_value=True)
    return c


# ── acknowledge_host ──────────────────────────────────────────────────────────

class TestAcknowledgeHost:
    async def test_calls_all_backends(self, reg):
        c1 = _make_mock_client("b1")
        c2 = _make_mock_client("b2")
        reg._clients = {"b1": c1, "b2": c2}
        ok = await reg.acknowledge_host("srv1", "comment", "user")
        assert ok is True
        c1.acknowledge_host.assert_called_once_with("srv1", "comment", "user")
        c2.acknowledge_host.assert_called_once_with("srv1", "comment", "user")

    async def test_empty_registry_returns_false(self, reg):
        ok = await reg.acknowledge_host("srv1")
        assert ok is False

    async def test_exception_in_one_backend_returns_partial(self, reg):
        c1 = _make_mock_client("b1")
        c1.acknowledge_host = AsyncMock(side_effect=Exception("err"))
        c2 = _make_mock_client("b2")
        reg._clients = {"b1": c1, "b2": c2}
        ok = await reg.acknowledge_host("srv1")
        assert ok is True  # c2 erfolgreich


# ── acknowledge_service ───────────────────────────────────────────────────────

class TestAcknowledgeService:
    async def test_calls_all_backends(self, reg):
        c = _make_mock_client()
        reg._clients = {"b": c}
        ok = await reg.acknowledge_service("srv1", "CPU", "cmnt", "u")
        assert ok is True
        c.acknowledge_service.assert_called_once_with("srv1", "CPU", "cmnt", "u")

    async def test_empty_registry_returns_false(self, reg):
        assert await reg.acknowledge_service("srv1", "CPU") is False

    async def test_all_fail_returns_false(self, reg):
        c = _make_mock_client()
        c.acknowledge_service = AsyncMock(return_value=False)
        reg._clients = {"b": c}
        assert await reg.acknowledge_service("srv1", "CPU") is False


# ── reschedule_check ──────────────────────────────────────────────────────────

class TestRescheduleCheck:
    async def test_calls_all_backends(self, reg):
        c = _make_mock_client()
        reg._clients = {"b": c}
        ok = await reg.reschedule_check("srv1")
        assert ok is True
        c.reschedule_host_check.assert_called_once_with("srv1")

    async def test_empty_registry_returns_false(self, reg):
        assert await reg.reschedule_check("srv1") is False


# ── schedule_downtime mit child_hosts ─────────────────────────────────────────

class TestScheduleDowntimeChildHosts:
    async def test_child_hosts_passed_to_schedule_host_downtime(self, reg):
        c = _make_mock_client()
        reg._clients = {"b": c}
        await reg.schedule_downtime(
            "srv1", 1000, 2000, child_hosts=True
        )
        c.schedule_host_downtime.assert_called_once_with(
            "srv1", 1000, 2000, "NagVis 2", "nagvis2", child_hosts=True
        )

    async def test_child_hosts_false_by_default(self, reg):
        c = _make_mock_client()
        reg._clients = {"b": c}
        await reg.schedule_downtime("srv1", 1000, 2000)
        c.schedule_host_downtime.assert_called_once_with(
            "srv1", 1000, 2000, "NagVis 2", "nagvis2", child_hosts=False
        )

    async def test_service_downtime_not_affected_by_child_hosts(self, reg):
        c = _make_mock_client()
        reg._clients = {"b": c}
        await reg.schedule_downtime(
            "srv1", 1000, 2000, service_name="CPU", child_hosts=True
        )
        c.schedule_service_downtime.assert_called_once_with(
            "srv1", "CPU", 1000, 2000, "NagVis 2", "nagvis2"
        )


# ── child_hosts in Checkmk-Client ─────────────────────────────────────────────

class TestCheckmkChildHosts:
    async def test_child_hosts_false_uses_host_type(self):
        from checkmk.client import CheckmkClient, CheckmkConfig
        c = CheckmkClient(CheckmkConfig(base_url="http://x", verify_ssl=False))
        with patch.object(c, "_post", AsyncMock(return_value=None)) as mock_post:
            await c.schedule_host_downtime("srv1", 0, 3600, child_hosts=False)
        assert mock_post.call_args[0][1]["downtime_type"] == "host"

    async def test_child_hosts_true_uses_host_and_services_type(self):
        from checkmk.client import CheckmkClient, CheckmkConfig
        c = CheckmkClient(CheckmkConfig(base_url="http://x", verify_ssl=False))
        with patch.object(c, "_post", AsyncMock(return_value=None)) as mock_post:
            await c.schedule_host_downtime("srv1", 0, 3600, child_hosts=True)
        assert mock_post.call_args[0][1]["downtime_type"] == "host_and_related_services"


# ── child_hosts Signaturen der anderen Clients ────────────────────────────────

class TestChildHostsSignatures:
    """Alle Clients müssen child_hosts=False als Parameter akzeptieren."""

    async def test_icinga2_accepts_child_hosts(self):
        from icinga2.client import Icinga2Client, Icinga2Config
        c = Icinga2Client(Icinga2Config(base_url="https://x:5665/v1",
                                        username="x", password="x", verify_ssl=False))
        with patch.object(c, "_action", AsyncMock(return_value=True)):
            ok = await c.schedule_host_downtime("srv1", 0, 3600, child_hosts=True)
        assert ok is True

    async def test_demo_accepts_child_hosts(self):
        from connectors.demo_client import DemoClient, DemoConfig
        c = DemoClient(DemoConfig(backend_id="demo"))
        ok = await c.schedule_host_downtime("srv1", 0, 3600, child_hosts=True)
        assert ok is True

    async def test_zabbix_accepts_child_hosts(self):
        from zabbix.client import ZabbixClient, ZabbixConfig
        c = ZabbixClient(ZabbixConfig(url="http://x", verify_ssl=False))
        # Zabbix braucht API-Call – mocken wir _request
        with patch.object(c, "_request", AsyncMock(return_value=[{"hostid": "1"}])):
            # maintenance.create auch mocken
            call_count = 0
            async def fake_req(method, params):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    return [{"hostid": "1"}]
                return {"maintenanceids": ["1"]}
            c._request = fake_req
            ok = await c.schedule_host_downtime("srv1", 0, 3600, child_hosts=True)
        assert ok is True

    async def test_prometheus_accepts_child_hosts(self):
        from prometheus.client import PrometheusClient, PrometheusConfig
        c = PrometheusClient(PrometheusConfig(url="http://x", verify_ssl=False))
        ok = await c.schedule_host_downtime("srv1", 0, 3600, child_hosts=True)
        assert ok is False  # Prometheus ist read-only
