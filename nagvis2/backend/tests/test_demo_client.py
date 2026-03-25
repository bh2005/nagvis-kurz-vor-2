"""
Tests für connectors/demo_client.py – DemoClient
"""

import pytest
from connectors.demo_client import DemoClient, DemoConfig
from ws.demo_data import DEMO_STATUS, DEMO_SERVICES


@pytest.fixture
def cfg():
    return DemoConfig(backend_id="test-demo", enabled=True)


@pytest.fixture
def client(cfg):
    return DemoClient(cfg)


# ── Grundlegende Attribute ────────────────────────────────────────────────────

class TestInit:
    def test_backend_id_stored(self, client):
        assert client.cfg.backend_id == "test-demo"

    def test_default_config(self):
        c = DemoClient(DemoConfig())
        assert c.cfg.backend_id == "demo"
        assert c.cfg.enabled is True


# ── get_hosts ─────────────────────────────────────────────────────────────────

class TestGetHosts:
    async def test_returns_list(self, client):
        hosts = await client.get_hosts()
        assert isinstance(hosts, list)

    async def test_count_matches_demo_data(self, client):
        hosts = await client.get_hosts()
        assert len(hosts) == len(DEMO_STATUS)

    async def test_host_has_correct_fields(self, client):
        hosts = await client.get_hosts()
        h = hosts[0]
        assert hasattr(h, "name")
        assert hasattr(h, "state")
        assert hasattr(h, "state_label")
        assert hasattr(h, "acknowledged")
        assert hasattr(h, "in_downtime")
        assert h.backend_id == "test-demo"

    async def test_host_name_matches_demo_data(self, client):
        hosts = await client.get_hosts()
        host_names = {h.name for h in hosts}
        demo_names = {h["name"] for h in DEMO_STATUS}
        assert host_names == demo_names

    async def test_last_check_is_recent_int(self, client):
        import time
        hosts = await client.get_hosts()
        now = time.time()
        for h in hosts:
            assert isinstance(h.last_check, int)
            assert abs(h.last_check - now) < 5


# ── get_services ──────────────────────────────────────────────────────────────

class TestGetServices:
    async def test_returns_list(self, client):
        svcs = await client.get_services()
        assert isinstance(svcs, list)

    async def test_count_matches_demo_data(self, client):
        svcs = await client.get_services()
        assert len(svcs) == len(DEMO_SERVICES)

    async def test_service_has_correct_fields(self, client):
        svcs = await client.get_services()
        if svcs:
            s = svcs[0]
            assert hasattr(s, "host_name")
            assert hasattr(s, "description")
            assert hasattr(s, "state")
            assert hasattr(s, "state_label")
            assert s.backend_id == "test-demo"

    async def test_service_backend_id(self, client):
        svcs = await client.get_services()
        for s in svcs:
            assert s.backend_id == "test-demo"


# ── get_hostgroups ────────────────────────────────────────────────────────────

class TestGetHostgroups:
    async def test_returns_list(self, client):
        groups = await client.get_hostgroups()
        assert isinstance(groups, list)

    async def test_has_expected_groups(self, client):
        groups = await client.get_hostgroups()
        names = {g["name"] for g in groups}
        assert "web-servers" in names
        assert "db-servers" in names
        assert "all-servers" in names

    async def test_groups_have_members(self, client):
        groups = await client.get_hostgroups()
        for g in groups:
            assert "name" in g
            assert "members" in g
            assert isinstance(g["members"], list)

    async def test_all_servers_contains_multiple(self, client):
        groups = await client.get_hostgroups()
        all_srv = next(g for g in groups if g["name"] == "all-servers")
        assert len(all_srv["members"]) > 1


# ── ping ──────────────────────────────────────────────────────────────────────

class TestPing:
    async def test_ping_is_reachable(self, client):
        health = await client.ping()
        assert health.reachable is True

    async def test_ping_backend_id(self, client):
        health = await client.ping()
        assert health.backend_id == "test-demo"

    async def test_ping_latency_zero(self, client):
        health = await client.ping()
        assert health.latency_ms == 0.0

    async def test_ping_last_ok_is_recent(self, client):
        import time
        health = await client.ping()
        assert abs(health.last_ok - time.time()) < 5


# ── Aktionen (immer True) ─────────────────────────────────────────────────────

class TestActions:
    async def test_schedule_host_downtime(self, client):
        result = await client.schedule_host_downtime("srv1", 0, 3600)
        assert result is True

    async def test_schedule_host_downtime_with_comment(self, client):
        result = await client.schedule_host_downtime(
            "srv1", 0, 3600, comment="Maintenance", author="admin"
        )
        assert result is True

    async def test_schedule_service_downtime(self, client):
        result = await client.schedule_service_downtime("srv1", "HTTP", 0, 3600)
        assert result is True

    async def test_acknowledge_host(self, client):
        result = await client.acknowledge_host("srv1")
        assert result is True

    async def test_acknowledge_host_with_args(self, client):
        result = await client.acknowledge_host("srv1", comment="Fixed", author="admin")
        assert result is True

    async def test_acknowledge_service(self, client):
        result = await client.acknowledge_service("srv1", "HTTP")
        assert result is True

    async def test_reschedule_host_check(self, client):
        result = await client.reschedule_host_check("srv1")
        assert result is True
