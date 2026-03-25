"""
Tests für icinga2/client.py – Icinga2Client
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from icinga2.client import (
    Icinga2Client,
    Icinga2Config,
    _parse_perfdata,
    _parse_labels,
)


@pytest.fixture
def cfg():
    return Icinga2Config(
        backend_id="test-icinga2",
        base_url="https://icinga2.example.com:5665/v1",
        username="nagvis2",
        password="secret",
        timeout=5.0,
        verify_ssl=False,
        enabled=True,
    )


@pytest.fixture
def client(cfg):
    return Icinga2Client(cfg)


# ── Hilfsfunktionen ───────────────────────────────────────────────────────────

class TestParsePerfdata:
    def test_empty_list_returns_empty_string(self):
        assert _parse_perfdata([]) == ""

    def test_none_returns_empty_string(self):
        assert _parse_perfdata(None) == ""

    def test_list_joined_with_space(self):
        result = _parse_perfdata(["rta=1ms", "pl=0%"])
        assert result == "rta=1ms pl=0%"

    def test_single_item(self):
        assert _parse_perfdata(["rta=5ms"]) == "rta=5ms"

    def test_non_list_converted_to_str(self):
        assert _parse_perfdata("rta=1ms") == "rta=1ms"


class TestParseLabels:
    def test_none_returns_empty(self):
        assert _parse_labels(None) == {}

    def test_non_dict_returns_empty(self):
        assert _parse_labels("string") == {}
        assert _parse_labels(42) == {}

    def test_string_values_kept(self):
        result = _parse_labels({"env": "prod", "team": "ops"})
        assert result == {"env": "prod", "team": "ops"}

    def test_numeric_values_kept_as_str(self):
        result = _parse_labels({"port": 443, "weight": 1.5})
        assert result["port"] == "443"
        assert result["weight"] == "1.5"

    def test_bool_value_kept(self):
        result = _parse_labels({"active": True})
        assert result["active"] == "True"

    def test_empty_string_values_excluded(self):
        result = _parse_labels({"env": "", "team": "ops"})
        assert "env" not in result
        assert result["team"] == "ops"

    def test_dict_values_excluded(self):
        result = _parse_labels({"nested": {"key": "val"}, "env": "prod"})
        assert "nested" not in result
        assert result["env"] == "prod"

    def test_list_values_excluded(self):
        result = _parse_labels({"tags": ["a", "b"], "env": "prod"})
        assert "tags" not in result

    def test_keys_lowercased(self):
        result = _parse_labels({"ENV": "prod", "Team": "ops"})
        assert "env" in result
        assert "team" in result


# ── HTTP Helpers ──────────────────────────────────────────────────────────────

class TestHttpHelpers:
    def test_url_construction(self, client):
        url = client._url("objects/hosts")
        assert url == "https://icinga2.example.com:5665/v1/objects/hosts"

    def test_url_strips_trailing_slash_from_base(self):
        c = Icinga2Client(Icinga2Config(base_url="https://host:5665/v1/"))
        assert c._url("objects/hosts") == "https://host:5665/v1/objects/hosts"

    def test_auth_returns_tuple(self, client):
        assert client._auth() == ("nagvis2", "secret")

    def test_headers_include_accept_and_override(self, client):
        h = client._headers()
        assert h["Accept"] == "application/json"
        assert h["X-HTTP-Method-Override"] == "GET"
        assert h["Content-Type"] == "application/json"


# ── _query ────────────────────────────────────────────────────────────────────

class TestQuery:
    async def test_query_returns_results(self, client):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"results": [{"attrs": {"name": "host1"}}]}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)

        with patch("icinga2.client.httpx.AsyncClient", return_value=mock_http):
            result = await client._query("objects/hosts", ["name"])

        assert len(result) == 1
        assert result[0]["attrs"]["name"] == "host1"

    async def test_query_propagates_exception(self, client):
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(side_effect=Exception("connection error"))

        with patch("icinga2.client.httpx.AsyncClient", return_value=mock_http):
            with pytest.raises(Exception, match="connection error"):
                await client._query("objects/hosts", ["name"])


# ── get_hosts ─────────────────────────────────────────────────────────────────

class TestGetHosts:
    def _make_host_result(self, name="srv1", state=0, ack=0, dt=0,
                          ok=5, warn=1, crit=0, unkn=0):
        return {"attrs": {
            "name": name,
            "display_name": name,
            "state": state,
            "acknowledgement": ack,
            "downtime_depth": dt,
            "last_check_result": {"output": "OK", "execution_end": 1700000000},
            "num_services_ok": ok,
            "num_services_warning": warn,
            "num_services_critical": crit,
            "num_services_unknown": unkn,
            "vars": {"env": "prod"},
        }}

    async def test_empty_result_returns_empty(self, client):
        with patch.object(client, "_query", new=AsyncMock(return_value=[])):
            hosts = await client.get_hosts()
        assert hosts == []

    async def test_up_host(self, client):
        results = [self._make_host_result("web1", state=0)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            hosts = await client.get_hosts()
        assert len(hosts) == 1
        assert hosts[0].name == "web1"
        assert hosts[0].state_label == "UP"

    async def test_down_host(self, client):
        results = [self._make_host_result("db1", state=1)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            hosts = await client.get_hosts()
        assert hosts[0].state_label == "DOWN"

    async def test_unreachable_host(self, client):
        results = [self._make_host_result("router1", state=2)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            hosts = await client.get_hosts()
        assert hosts[0].state_label == "UNREACHABLE"

    async def test_acknowledged_host(self, client):
        results = [self._make_host_result("srv1", ack=1)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            hosts = await client.get_hosts()
        assert hosts[0].acknowledged is True

    async def test_downtime_host(self, client):
        results = [self._make_host_result("srv1", dt=1)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            hosts = await client.get_hosts()
        assert hosts[0].in_downtime is True

    async def test_service_counts(self, client):
        results = [self._make_host_result("srv1", ok=3, warn=2, crit=1, unkn=0)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            hosts = await client.get_hosts()
        assert hosts[0].num_services_ok == 3
        assert hosts[0].num_services_warn == 2
        assert hosts[0].num_services_crit == 1

    async def test_labels_parsed(self, client):
        results = [self._make_host_result("srv1")]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            hosts = await client.get_hosts()
        assert hosts[0].labels.get("env") == "prod"

    async def test_backend_id_set(self, client):
        results = [self._make_host_result("srv1")]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            hosts = await client.get_hosts()
        assert hosts[0].backend_id == "test-icinga2"

    async def test_missing_last_check_result(self, client):
        """last_check_result kann None sein – kein Fehler erwartet."""
        result = [{"attrs": {
            "name": "srv1",
            "display_name": "srv1",
            "state": 0,
            "acknowledgement": 0,
            "downtime_depth": 0,
            "last_check_result": None,
            "num_services_ok": 0,
            "num_services_warning": 0,
            "num_services_critical": 0,
            "num_services_unknown": 0,
            "vars": None,
        }}]
        with patch.object(client, "_query", new=AsyncMock(return_value=result)):
            hosts = await client.get_hosts()
        assert hosts[0].name == "srv1"


# ── get_services ──────────────────────────────────────────────────────────────

class TestGetServices:
    def _make_svc_result(self, host="srv1", name="HTTP", state=0, ack=0, dt=0):
        return {"attrs": {
            "name": name,
            "host_name": host,
            "display_name": name,
            "state": state,
            "acknowledgement": ack,
            "downtime_depth": dt,
            "last_check_result": {
                "output": "HTTP OK",
                "execution_end": 1700000000,
                "performance_data": ["rta=1ms", "pl=0%"],
            },
            "vars": {"service_env": "prod"},
        }}

    async def test_empty_returns_empty(self, client):
        with patch.object(client, "_query", new=AsyncMock(return_value=[])):
            svcs = await client.get_services()
        assert svcs == []

    async def test_ok_service(self, client):
        results = [self._make_svc_result(state=0)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            svcs = await client.get_services()
        assert svcs[0].state_label == "OK"

    async def test_warning_service(self, client):
        results = [self._make_svc_result(state=1)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            svcs = await client.get_services()
        assert svcs[0].state_label == "WARNING"

    async def test_critical_service(self, client):
        results = [self._make_svc_result(state=2)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            svcs = await client.get_services()
        assert svcs[0].state_label == "CRITICAL"

    async def test_unknown_service(self, client):
        results = [self._make_svc_result(state=3)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            svcs = await client.get_services()
        assert svcs[0].state_label == "UNKNOWN"

    async def test_perfdata_parsed(self, client):
        results = [self._make_svc_result()]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            svcs = await client.get_services()
        assert "rta=1ms" in svcs[0].perf_data

    async def test_acknowledged_service(self, client):
        results = [self._make_svc_result(ack=1)]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            svcs = await client.get_services()
        assert svcs[0].acknowledged is True

    async def test_backend_id_set(self, client):
        results = [self._make_svc_result()]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            svcs = await client.get_services()
        assert svcs[0].backend_id == "test-icinga2"


# ── get_hostgroups ────────────────────────────────────────────────────────────

class TestGetHostgroups:
    async def test_empty_returns_empty(self, client):
        with patch.object(client, "_query", new=AsyncMock(return_value=[])):
            groups = await client.get_hostgroups()
        assert groups == []

    async def test_hostgroup_parsed(self, client):
        results = [{"attrs": {
            "name": "web-servers",
            "display_name": "Web Servers",
            "members": ["web1", "web2"],
        }, "name": "web-servers"}]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            groups = await client.get_hostgroups()
        assert len(groups) == 1
        assert groups[0]["name"] == "web-servers"
        assert "web1" in groups[0]["members"]

    async def test_members_with_service_notation_stripped(self, client):
        """Mitglieder im Format 'host!service' werden auf den Host-Teil reduziert."""
        results = [{"attrs": {
            "name": "grp",
            "members": ["host1!HTTP", "host2"],
        }}]
        with patch.object(client, "_query", new=AsyncMock(return_value=results)):
            groups = await client.get_hostgroups()
        assert "host1" in groups[0]["members"]
        assert "host2" in groups[0]["members"]


# ── Aktionen ──────────────────────────────────────────────────────────────────

class TestActions:
    async def test_acknowledge_host_success(self, client):
        with patch.object(client, "_action", new=AsyncMock(return_value=True)):
            result = await client.acknowledge_host("srv1", "comment", "admin")
        assert result is True

    async def test_acknowledge_host_failure(self, client):
        with patch.object(client, "_action", new=AsyncMock(return_value=False)):
            result = await client.acknowledge_host("srv1")
        assert result is False

    async def test_acknowledge_service(self, client):
        with patch.object(client, "_action", new=AsyncMock(return_value=True)):
            result = await client.acknowledge_service("srv1", "HTTP")
        assert result is True

    async def test_remove_host_ack(self, client):
        with patch.object(client, "_action", new=AsyncMock(return_value=True)):
            result = await client.remove_host_ack("srv1")
        assert result is True

    async def test_remove_service_ack(self, client):
        with patch.object(client, "_action", new=AsyncMock(return_value=True)):
            result = await client.remove_service_ack("srv1", "HTTP")
        assert result is True

    async def test_schedule_host_downtime(self, client):
        with patch.object(client, "_action", new=AsyncMock(return_value=True)):
            result = await client.schedule_host_downtime("srv1", 0, 3600)
        assert result is True

    async def test_schedule_service_downtime(self, client):
        with patch.object(client, "_action", new=AsyncMock(return_value=True)):
            result = await client.schedule_service_downtime("srv1", "HTTP", 0, 3600)
        assert result is True

    async def test_reschedule_check_host(self, client):
        with patch.object(client, "_action", new=AsyncMock(return_value=True)):
            result = await client.reschedule_check("srv1")
        assert result is True

    async def test_reschedule_check_service(self, client):
        with patch.object(client, "_action", new=AsyncMock(return_value=True)):
            result = await client.reschedule_check("srv1", "HTTP")
        assert result is True

    async def test_action_http_success(self, client):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)

        with patch("icinga2.client.httpx.AsyncClient", return_value=mock_http):
            result = await client._action("reschedule-check", {"type": "Host"})

        assert result is True

    async def test_action_http_failure_returns_false(self, client):
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(side_effect=Exception("network error"))

        with patch("icinga2.client.httpx.AsyncClient", return_value=mock_http):
            result = await client._action("reschedule-check", {"type": "Host"})

        assert result is False


# ── ping ──────────────────────────────────────────────────────────────────────

class TestPing:
    async def test_ping_success(self, client):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.get = AsyncMock(return_value=mock_resp)

        with patch("icinga2.client.httpx.AsyncClient", return_value=mock_http):
            health = await client.ping()

        assert health.reachable is True
        assert health.backend_id == "test-icinga2"
        assert health.latency_ms >= 0

    async def test_ping_failure(self, client):
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.get = AsyncMock(side_effect=Exception("timeout"))

        with patch("icinga2.client.httpx.AsyncClient", return_value=mock_http):
            health = await client.ping()

        assert health.reachable is False
        assert "timeout" in health.error
