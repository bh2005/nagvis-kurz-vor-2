"""
Tests für prometheus/client.py – PrometheusClient
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from prometheus.client import PrometheusClient, PrometheusConfig


@pytest.fixture
def cfg():
    return PrometheusConfig(
        backend_id="test-prom",
        url="http://prometheus:9090",
        token="",
        username="",
        password="",
        host_label="instance",
        enabled=True,
    )


@pytest.fixture
def client(cfg):
    return PrometheusClient(cfg)


# ── Helpers ───────────────────────────────────────────────────────────────────

class TestHelpers:
    def test_base_strips_trailing_slash(self):
        c = PrometheusClient(PrometheusConfig(url="http://prom:9090/"))
        assert c._base() == "http://prom:9090"

    def test_base_no_trailing_slash(self):
        c = PrometheusClient(PrometheusConfig(url="http://prom:9090"))
        assert c._base() == "http://prom:9090"

    def test_headers_no_auth(self, client):
        h = client._headers()
        assert h["Accept"] == "application/json"
        assert "Authorization" not in h

    def test_headers_with_bearer_token(self):
        c = PrometheusClient(PrometheusConfig(token="mytoken"))
        h = c._headers()
        assert h["Authorization"] == "Bearer mytoken"

    def test_auth_none_without_credentials(self, client):
        assert client._auth() is None

    def test_auth_tuple_with_username(self):
        c = PrometheusClient(PrometheusConfig(username="user", password="pass"))
        assert c._auth() == ("user", "pass")


# ── Read-only Aktionen ─────────────────────────────────────────────────────────

class TestReadonlyActions:
    async def test_acknowledge_host_returns_false(self, client):
        result = await client.acknowledge_host("srv1", "test comment")
        assert result is False

    async def test_acknowledge_service_returns_false(self, client):
        result = await client.acknowledge_service("srv1", "ping", "comment")
        assert result is False

    async def test_schedule_host_downtime_returns_false(self, client):
        result = await client.schedule_host_downtime("srv1", 0, 3600)
        assert result is False

    async def test_schedule_service_downtime_returns_false(self, client):
        result = await client.schedule_service_downtime("srv1", "ping", 0, 3600)
        assert result is False


# ── get_hosts ─────────────────────────────────────────────────────────────────

class TestGetHosts:
    async def test_empty_data_returns_empty(self, client):
        with patch.object(client, "_get", new=AsyncMock(return_value=None)):
            result = await client.get_hosts()
        assert result == []

    async def test_up_target_is_up(self, client):
        data = {"result": [{"metric": {"instance": "srv1", "job": "web"}, "value": [0, "1"]}]}
        with patch.object(client, "_get", new=AsyncMock(return_value=data)):
            hosts = await client.get_hosts()
        assert len(hosts) == 1
        assert hosts[0].name == "srv1"
        assert hosts[0].state_label == "UP"

    async def test_down_target_is_down(self, client):
        data = {"result": [{"metric": {"instance": "srv2", "job": "web"}, "value": [0, "0"]}]}
        with patch.object(client, "_get", new=AsyncMock(return_value=data)):
            hosts = await client.get_hosts()
        assert hosts[0].state_label == "DOWN"

    async def test_worst_state_wins_for_duplicate_host(self, client):
        """Derselbe instance-Name mit up=1 und up=0 → DOWN gewinnt."""
        data = {"result": [
            {"metric": {"instance": "srv1", "job": "a"}, "value": [0, "1"]},
            {"metric": {"instance": "srv1", "job": "b"}, "value": [0, "0"]},
        ]}
        with patch.object(client, "_get", new=AsyncMock(return_value=data)):
            hosts = await client.get_hosts()
        assert len(hosts) == 1
        assert hosts[0].state_label == "DOWN"

    async def test_missing_host_label_skipped(self, client):
        """Target ohne host_label wird ignoriert."""
        data = {"result": [{"metric": {"job": "web"}, "value": [0, "1"]}]}
        with patch.object(client, "_get", new=AsyncMock(return_value=data)):
            hosts = await client.get_hosts()
        assert hosts == []

    async def test_custom_host_label(self):
        cfg = PrometheusConfig(host_label="hostname")
        c = PrometheusClient(cfg)
        data = {"result": [{"metric": {"hostname": "myhost"}, "value": [0, "1"]}]}
        with patch.object(c, "_get", new=AsyncMock(return_value=data)):
            hosts = await c.get_hosts()
        assert hosts[0].name == "myhost"


# ── get_services ──────────────────────────────────────────────────────────────

class TestGetServices:
    async def test_empty_returns_empty(self, client):
        with patch.object(client, "_get", new=AsyncMock(return_value=None)):
            result = await client.get_services()
        assert result == []

    async def test_inactive_alert_skipped(self, client):
        data = {"alerts": [{"state": "inactive", "labels": {"alertname": "Test"}, "annotations": {}}]}
        with patch.object(client, "_get", new=AsyncMock(return_value=data)):
            svcs = await client.get_services()
        assert svcs == []

    async def test_firing_critical_alert(self, client):
        data = {"alerts": [{
            "state": "firing",
            "labels": {"alertname": "DiskFull", "severity": "critical", "instance": "srv1"},
            "annotations": {"summary": "Disk is full"},
        }]}
        with patch.object(client, "_get", new=AsyncMock(return_value=data)):
            svcs = await client.get_services()
        assert len(svcs) == 1
        assert svcs[0].state_label == "CRITICAL"
        assert svcs[0].description == "DiskFull"
        assert svcs[0].host_name == "srv1"

    async def test_pending_alert_is_warning(self, client):
        data = {"alerts": [{
            "state": "pending",
            "labels": {"alertname": "HighLoad", "instance": "srv1"},
            "annotations": {},
        }]}
        with patch.object(client, "_get", new=AsyncMock(return_value=data)):
            svcs = await client.get_services()
        assert svcs[0].state_label == "WARNING"

    async def test_firing_warning_severity(self, client):
        data = {"alerts": [{
            "state": "firing",
            "labels": {"alertname": "SlowQuery", "severity": "warning", "instance": "db1"},
            "annotations": {},
        }]}
        with patch.object(client, "_get", new=AsyncMock(return_value=data)):
            svcs = await client.get_services()
        assert svcs[0].state_label == "WARNING"


# ── get_hostgroups ────────────────────────────────────────────────────────────

class TestGetHostgroups:
    async def test_empty_returns_empty(self, client):
        with patch.object(client, "_get", new=AsyncMock(return_value=None)):
            result = await client.get_hostgroups()
        assert result == []

    async def test_groups_by_job_label(self, client):
        data = {"result": [
            {"metric": {"instance": "srv1", "job": "web"}, "value": [0, "1"]},
            {"metric": {"instance": "srv2", "job": "web"}, "value": [0, "1"]},
            {"metric": {"instance": "db1",  "job": "db"},  "value": [0, "1"]},
        ]}
        with patch.object(client, "_get", new=AsyncMock(return_value=data)):
            groups = await client.get_hostgroups()
        by_name = {g["name"]: g["members"] for g in groups}
        assert sorted(by_name["web"]) == ["srv1", "srv2"]
        assert by_name["db"] == ["db1"]


# ── ping ──────────────────────────────────────────────────────────────────────

class TestPing:
    async def test_ping_success(self, client):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"data": {"version": "2.45.0"}}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__  = AsyncMock(return_value=False)
        mock_http.get        = AsyncMock(return_value=mock_response)

        with patch("prometheus.client.httpx.AsyncClient", return_value=mock_http):
            health = await client.ping()

        assert health.reachable is True
        assert "2.45.0" in health.error
        assert health.backend_id == "test-prom"

    async def test_ping_failure_returns_unreachable(self, client):
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__  = AsyncMock(return_value=False)
        mock_http.get        = AsyncMock(side_effect=Exception("connection refused"))

        with patch("prometheus.client.httpx.AsyncClient", return_value=mock_http):
            health = await client.ping()

        assert health.reachable is False
        assert "connection refused" in health.error
