"""
Tests für checkmk/client.py – CheckmkClient.
"""

import pytest
import time
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from checkmk.client import (
    CheckmkClient, CheckmkConfig,
    _parse_host_state, _parse_svc_state,
    _to_perf_str, _parse_timestamp,
)


@pytest.fixture
def cfg():
    return CheckmkConfig(
        backend_id="cmk-test",
        base_url="http://checkmk:5000/mysite/check_mk/api/1.0",
        username="automation",
        secret="supersecret",
        verify_ssl=False,
    )


@pytest.fixture
def client(cfg):
    return CheckmkClient(cfg)


# ── Hilfsfunktionen ────────────────────────────────────────────────────────────

class TestParsers:
    def test_parse_host_state_int(self):
        assert _parse_host_state(0) == 0
        assert _parse_host_state(1) == 1

    def test_parse_host_state_str(self):
        assert _parse_host_state("up") == 0
        assert _parse_host_state("DOWN") == 1
        assert _parse_host_state("unreachable") == 2

    def test_parse_host_state_unknown(self):
        assert _parse_host_state("foobar") == 3
        assert _parse_host_state(None) == 3

    def test_parse_svc_state_int(self):
        assert _parse_svc_state(0) == 0
        assert _parse_svc_state(2) == 2

    def test_parse_svc_state_str(self):
        assert _parse_svc_state("ok") == 0
        assert _parse_svc_state("WARNING") == 1
        assert _parse_svc_state("critical") == 2
        assert _parse_svc_state("unknown") == 3

    def test_to_perf_str_none(self):
        assert _to_perf_str(None) == ""

    def test_to_perf_str_string(self):
        assert _to_perf_str("cpu=80%") == "cpu=80%"

    def test_to_perf_str_dict(self):
        assert _to_perf_str({"metric": 1}) == ""

    def test_parse_timestamp_zero(self):
        assert _parse_timestamp(None) == 0
        assert _parse_timestamp("") == 0

    def test_parse_timestamp_int(self):
        assert _parse_timestamp(1700000000) == 1700000000

    def test_parse_timestamp_iso(self):
        ts = _parse_timestamp("2024-01-01T00:00:00+00:00")
        assert ts > 0

    def test_parse_timestamp_invalid(self):
        assert _parse_timestamp("not-a-date") == 0


# ── HTTP Helpers ───────────────────────────────────────────────────────────────

class TestHttpHelpers:
    def test_headers_contain_bearer(self, client):
        h = client._headers()
        assert "Bearer automation supersecret" in h["Authorization"]

    def test_url_construction(self, client):
        assert client._url("/version") == "http://checkmk:5000/mysite/check_mk/api/1.0/version"

    def test_url_strips_trailing_slash(self):
        c = CheckmkClient(CheckmkConfig(base_url="http://host/site/api/1.0/"))
        assert c._url("/version") == "http://host/site/api/1.0/version"


# ── get_hosts ─────────────────────────────────────────────────────────────────

class TestGetHosts:
    async def test_get_hosts_returns_list(self, client):
        mock_resp = {"value": [
            {"id": "srv1", "extensions": {
                "name": "srv1", "alias": "Server 1", "state": "up",
                "output": "PING OK", "last_check": 1700000000,
                "acknowledged": False, "in_downtime": False,
                "num_services_ok": 3, "num_services_warn": 0,
                "num_services_crit": 1, "num_services_unkn": 0,
                "labels": {"os": "linux"},
            }},
        ]}
        with patch.object(client, "_get", AsyncMock(return_value=mock_resp)):
            hosts = await client.get_hosts()
        assert len(hosts) == 1
        assert hosts[0].name == "srv1"
        assert hosts[0].state == 0
        assert hosts[0].state_label == "UP"
        assert hosts[0].labels == {"os": "linux"}

    async def test_get_hosts_skips_no_name(self, client):
        mock_resp = {"value": [{"extensions": {}}]}
        with patch.object(client, "_get", AsyncMock(return_value=mock_resp)):
            hosts = await client.get_hosts()
        assert hosts == []

    async def test_get_hosts_pending_state(self, client):
        """Ältere Checkmk-Versionen liefern keinen state → PENDING."""
        mock_resp = {"value": [{"id": "srv1", "extensions": {"name": "srv1"}}]}
        with patch.object(client, "_get", AsyncMock(return_value=mock_resp)):
            hosts = await client.get_hosts()
        assert hosts[0].state == 3
        assert hosts[0].state_label == "PENDING"


# ── get_services ──────────────────────────────────────────────────────────────

class TestGetServices:
    async def test_get_services_returns_list(self, client):
        mock_resp = {"value": [
            {"extensions": {
                "host_name": "srv1", "description": "CPU",
                "state": "ok", "output": "CPU 5%",
                "last_check": 0, "acknowledged": False, "in_downtime": False,
                "perf_data": "cpu=5%",
            }},
        ]}
        with patch.object(client, "_get", AsyncMock(return_value=mock_resp)):
            svcs = await client.get_services()
        assert len(svcs) == 1
        assert svcs[0].host_name == "srv1"
        assert svcs[0].description == "CPU"
        assert svcs[0].state == 0

    async def test_get_services_skips_missing_host_or_desc(self, client):
        mock_resp = {"value": [
            {"extensions": {"host_name": "", "description": "CPU"}},
            {"extensions": {"host_name": "srv1", "description": ""}},
        ]}
        with patch.object(client, "_get", AsyncMock(return_value=mock_resp)):
            svcs = await client.get_services()
        assert svcs == []


# ── get_hostgroups ────────────────────────────────────────────────────────────

class TestGetHostgroups:
    async def test_get_hostgroups_returns_list(self, client):
        mock_resp = {"value": [
            {"id": "linux-servers", "extensions": {"members": ["srv1", "srv2"]}},
            {"id": "db-servers",    "extensions": {}},
        ]}
        with patch.object(client, "_get", AsyncMock(return_value=mock_resp)):
            hgs = await client.get_hostgroups()
        assert len(hgs) == 2
        assert hgs[0]["name"] == "linux-servers"
        assert hgs[0]["members"] == ["srv1", "srv2"]

    async def test_get_hostgroups_skips_empty_id(self, client):
        mock_resp = {"value": [{"id": "", "extensions": {}}]}
        with patch.object(client, "_get", AsyncMock(return_value=mock_resp)):
            hgs = await client.get_hostgroups()
        assert hgs == []

    async def test_get_hostgroups_exception_returns_empty(self, client):
        with patch.object(client, "_get", AsyncMock(side_effect=Exception("timeout"))):
            hgs = await client.get_hostgroups()
        assert hgs == []


# ── ping ──────────────────────────────────────────────────────────────────────

class TestPing:
    async def test_ping_success(self, client):
        with patch.object(client, "_get", AsyncMock(return_value={"site": "mysite"})):
            result = await client.ping()
        assert result.reachable is True
        assert result.backend_id == "cmk-test"
        assert result.latency_ms >= 0

    async def test_ping_failure(self, client):
        with patch.object(client, "_get", AsyncMock(side_effect=Exception("refused"))):
            result = await client.ping()
        assert result.reachable is False
        assert "refused" in result.error


# ── Aktionen ──────────────────────────────────────────────────────────────────

class TestActions:
    async def test_acknowledge_host_success(self, client):
        with patch.object(client, "_post", AsyncMock(return_value=None)):
            ok = await client.acknowledge_host("srv1", "test", "user")
        assert ok is True

    async def test_acknowledge_host_failure(self, client):
        with patch.object(client, "_post", AsyncMock(side_effect=Exception("err"))):
            ok = await client.acknowledge_host("srv1")
        assert ok is False

    async def test_acknowledge_service_success(self, client):
        with patch.object(client, "_post", AsyncMock(return_value=None)):
            ok = await client.acknowledge_service("srv1", "CPU")
        assert ok is True

    async def test_schedule_host_downtime_success(self, client):
        with patch.object(client, "_post", AsyncMock(return_value=None)) as mock_post:
            ok = await client.schedule_host_downtime(
                "srv1", 1700000000, 1700003600, "Test", "user"
            )
        assert ok is True
        body = mock_post.call_args[0][1]
        assert body["downtime_type"] == "host"
        assert body["host_name"] == "srv1"
        # start_time / end_time als ISO-String
        assert "T" in body["start_time"]

    async def test_schedule_host_downtime_with_child_hosts(self, client):
        """child_hosts=True → downtime_type 'host_and_related_services'."""
        with patch.object(client, "_post", AsyncMock(return_value=None)) as mock_post:
            ok = await client.schedule_host_downtime(
                "srv1", 1700000000, 1700003600, child_hosts=True
            )
        assert ok is True
        body = mock_post.call_args[0][1]
        assert body["downtime_type"] == "host_and_related_services"

    async def test_schedule_host_downtime_failure(self, client):
        with patch.object(client, "_post", AsyncMock(side_effect=Exception("err"))):
            ok = await client.schedule_host_downtime("srv1", 0, 3600)
        assert ok is False

    async def test_schedule_service_downtime_success(self, client):
        with patch.object(client, "_post", AsyncMock(return_value=None)) as mock_post:
            ok = await client.schedule_service_downtime(
                "srv1", "CPU", 1700000000, 1700003600
            )
        assert ok is True
        body = mock_post.call_args[0][1]
        assert body["downtime_type"] == "service"
        assert body["service_description"] == "CPU"

    async def test_reschedule_host_check_success(self, client):
        with patch.object(client, "_post", AsyncMock(return_value=None)):
            ok = await client.reschedule_host_check("srv1")
        assert ok is True

    async def test_reschedule_host_check_failure(self, client):
        with patch.object(client, "_post", AsyncMock(side_effect=Exception("err"))):
            ok = await client.reschedule_host_check("srv1")
        assert ok is False


# ── _get / _post HTTP ─────────────────────────────────────────────────────────

class TestHttpMethods:
    async def test_get_returns_json(self, client):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"site": "mysite"}
        mock_resp.status_code = 200
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__  = AsyncMock(return_value=False)
        mock_http.get = AsyncMock(return_value=mock_resp)
        with patch("checkmk.client.httpx.AsyncClient", return_value=mock_http):
            result = await client._get("/version")
        assert result == {"site": "mysite"}

    async def test_post_204_returns_none(self, client):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.status_code = 204
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__  = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)
        with patch("checkmk.client.httpx.AsyncClient", return_value=mock_http):
            result = await client._post("/actions/ack", {})
        assert result is None

    async def test_get_exception_propagates(self, client):
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__  = AsyncMock(return_value=False)
        mock_http.get = AsyncMock(side_effect=Exception("connection refused"))
        with patch("checkmk.client.httpx.AsyncClient", return_value=mock_http):
            with pytest.raises(Exception, match="connection refused"):
                await client._get("/version")
