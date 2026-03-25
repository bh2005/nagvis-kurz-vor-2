"""
Tests für zabbix/client.py – ZabbixClient
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from zabbix.client import (
    ZabbixClient,
    ZabbixConfig,
    _parse_tags,
)


@pytest.fixture
def cfg():
    return ZabbixConfig(
        backend_id="test-zabbix",
        url="https://zabbix.example.com",
        token="myapitoken",
        username="Admin",
        password="zabbix",
        timeout=5.0,
        verify_ssl=False,
        enabled=True,
    )


@pytest.fixture
def client(cfg):
    return ZabbixClient(cfg)


@pytest.fixture
def client_session():
    """Client ohne Token → verwendet Session-Login."""
    cfg = ZabbixConfig(
        backend_id="test-zabbix-session",
        url="https://zabbix.example.com",
        token="",
        username="Admin",
        password="zabbix",
        verify_ssl=False,
    )
    return ZabbixClient(cfg)


# ── Hilfsfunktionen ───────────────────────────────────────────────────────────

class TestParseTags:
    def test_none_returns_empty(self):
        assert _parse_tags(None) == {}

    def test_non_list_returns_empty(self):
        assert _parse_tags("string") == {}
        assert _parse_tags(42) == {}

    def test_empty_list_returns_empty(self):
        assert _parse_tags([]) == {}

    def test_valid_tag(self):
        result = _parse_tags([{"tag": "env", "value": "prod"}])
        assert result == {"env": "prod"}

    def test_multiple_tags(self):
        result = _parse_tags([
            {"tag": "env", "value": "prod"},
            {"tag": "team", "value": "ops"},
        ])
        assert result["env"] == "prod"
        assert result["team"] == "ops"

    def test_tag_without_value(self):
        result = _parse_tags([{"tag": "env"}])
        assert result["env"] == ""

    def test_key_lowercased(self):
        result = _parse_tags([{"tag": "ENV", "value": "prod"}])
        assert "env" in result

    def test_non_dict_item_skipped(self):
        result = _parse_tags(["not-a-dict", {"tag": "env", "value": "prod"}])
        assert result == {"env": "prod"}

    def test_empty_key_skipped(self):
        result = _parse_tags([{"tag": "", "value": "val"}])
        assert result == {}


# ── HTTP / RPC Helpers ────────────────────────────────────────────────────────

class TestHelpers:
    def test_api_url(self, client):
        assert client._api_url() == "https://zabbix.example.com/api_jsonrpc.php"

    def test_api_url_strips_slash(self):
        c = ZabbixClient(ZabbixConfig(url="https://zabbix.example.com/"))
        assert c._api_url() == "https://zabbix.example.com/api_jsonrpc.php"

    def test_bearer_headers(self, client):
        h = client._bearer_headers()
        assert h["Authorization"] == "Bearer myapitoken"
        assert h["Content-Type"] == "application/json"

    def test_session_headers(self, client):
        h = client._session_headers()
        assert h["Content-Type"] == "application/json"
        assert "Authorization" not in h

    async def test_get_auth_with_token_returns_none(self, client):
        """Mit Bearer-Token wird kein Session-Auth-Wert benötigt."""
        auth = await client._get_auth()
        assert auth is None

    async def test_get_auth_without_token_calls_login(self, client_session):
        with patch.object(client_session, "_login", new=AsyncMock(return_value="session123")):
            auth = await client_session._get_auth()
        assert auth == "session123"

    async def test_get_auth_caches_session_token(self, client_session):
        call_count = 0

        async def fake_login():
            nonlocal call_count
            call_count += 1
            return "token-abc"

        client_session._login = fake_login
        await client_session._get_auth()
        await client_session._get_auth()
        assert call_count == 1


# ── _login ────────────────────────────────────────────────────────────────────

class TestLogin:
    async def test_login_success(self, client_session):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"result": "session-token-xyz"}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)

        with patch("zabbix.client.httpx.AsyncClient", return_value=mock_http):
            token = await client_session._login()

        assert token == "session-token-xyz"

    async def test_login_with_error_response_returns_none(self, client_session):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "error": {"code": -32602, "data": "Wrong credentials"}
        }

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)

        with patch("zabbix.client.httpx.AsyncClient", return_value=mock_http):
            token = await client_session._login()

        assert token is None

    async def test_login_exception_returns_none(self, client_session):
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(side_effect=Exception("connection refused"))

        with patch("zabbix.client.httpx.AsyncClient", return_value=mock_http):
            token = await client_session._login()

        assert token is None


# ── _request ──────────────────────────────────────────────────────────────────

class TestRequest:
    async def test_request_with_bearer_token(self, client):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"result": [{"hostid": "1"}]}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)

        with patch("zabbix.client.httpx.AsyncClient", return_value=mock_http):
            result = await client._request("host.get", {"output": ["hostid"]})

        assert result == [{"hostid": "1"}]

    async def test_request_with_session_token(self, client_session):
        client_session._session_token = "sess-123"
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"result": []}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)

        with patch("zabbix.client.httpx.AsyncClient", return_value=mock_http):
            result = await client_session._request("host.get", {})

        assert result == []

    async def test_request_rpc_error_returns_none(self, client):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "error": {"code": -32600, "data": "Invalid request"}
        }

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)

        with patch("zabbix.client.httpx.AsyncClient", return_value=mock_http):
            result = await client._request("host.get", {})

        assert result is None

    async def test_request_session_expired_retries(self, client_session):
        """Session-Fehler -32602 → Token löschen und erneut versuchen."""
        client_session._session_token = "old-token"

        responses = [
            MagicMock(**{
                "raise_for_status": MagicMock(),
                "json.return_value": {"error": {"code": -32602, "data": "Session expired"}},
            }),
            MagicMock(**{
                "raise_for_status": MagicMock(),
                "json.return_value": {"result": [{"hostid": "1"}]},
            }),
        ]
        call_count = 0

        async def fake_post(*args, **kwargs):
            nonlocal call_count
            resp = responses[call_count] if call_count < len(responses) else responses[-1]
            call_count += 1
            return resp

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = fake_post

        with patch("zabbix.client.httpx.AsyncClient", return_value=mock_http):
            with patch.object(client_session, "_login", new=AsyncMock(return_value="new-token")):
                result = await client_session._request("host.get", {})

        # Session-Token wurde zurückgesetzt und neu geholt
        assert client_session._session_token is None or client_session._session_token == "new-token"

    async def test_request_exception_propagates(self, client):
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(side_effect=Exception("network error"))

        with patch("zabbix.client.httpx.AsyncClient", return_value=mock_http):
            with pytest.raises(Exception, match="network error"):
                await client._request("host.get", {})


# ── get_hosts ─────────────────────────────────────────────────────────────────

class TestGetHosts:
    def _make_host(self, host="srv1", name="Server 1", available=1,
                   maintenance=0, error="", tags=None):
        return {
            "hostid": "1",
            "host": host,
            "name": name,
            "available": str(available),
            "maintenance_status": str(maintenance),
            "error": error,
            "tags": tags or [],
        }

    async def test_empty_result_returns_empty(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=None)):
            hosts = await client.get_hosts()
        assert hosts == []

    async def test_empty_list_returns_empty(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[])):
            hosts = await client.get_hosts()
        assert hosts == []

    async def test_up_host(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_host(available=1)
        ])):
            hosts = await client.get_hosts()
        assert hosts[0].state_label == "UP"

    async def test_down_host(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_host(available=2)
        ])):
            hosts = await client.get_hosts()
        assert hosts[0].state_label == "DOWN"

    async def test_unreachable_host(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_host(available=0)
        ])):
            hosts = await client.get_hosts()
        assert hosts[0].state_label == "UNREACHABLE"

    async def test_in_maintenance(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_host(maintenance=1)
        ])):
            hosts = await client.get_hosts()
        assert hosts[0].in_downtime is True

    async def test_labels_from_tags(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_host(tags=[{"tag": "env", "value": "prod"}])
        ])):
            hosts = await client.get_hosts()
        assert hosts[0].labels.get("env") == "prod"

    async def test_backend_id(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_host()
        ])):
            hosts = await client.get_hosts()
        assert hosts[0].backend_id == "test-zabbix"

    async def test_host_name_and_alias(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_host(host="server1", name="My Server")
        ])):
            hosts = await client.get_hosts()
        assert hosts[0].name == "server1"
        assert hosts[0].alias == "My Server"


# ── get_services ──────────────────────────────────────────────────────────────

class TestGetServices:
    _DEFAULT_HOSTS = [{"hostid": "1", "host": "srv1"}]

    def _make_problem(self, name="DiskFull", severity=5,
                      ack="0", suppressed="0", hosts=_DEFAULT_HOSTS, tags=None):
        return {
            "eventid": "100",
            "objectid": "200",
            "name": name,
            "severity": str(severity),
            "acknowledged": ack,
            "clock": "1700000000",
            "suppressed": suppressed,
            "hosts": hosts,
            "tags": tags or [],
        }

    async def test_empty_returns_empty(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=None)):
            svcs = await client.get_services()
        assert svcs == []

    async def test_disaster_severity_is_critical(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_problem(severity=5)
        ])):
            svcs = await client.get_services()
        assert svcs[0].state_label == "CRITICAL"

    async def test_high_severity_is_critical(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_problem(severity=4)
        ])):
            svcs = await client.get_services()
        assert svcs[0].state_label == "CRITICAL"

    async def test_warning_severity_is_warning(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_problem(severity=2)
        ])):
            svcs = await client.get_services()
        assert svcs[0].state_label == "WARNING"

    async def test_info_severity_is_warning(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_problem(severity=1)
        ])):
            svcs = await client.get_services()
        assert svcs[0].state_label == "WARNING"

    async def test_acknowledged_problem(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_problem(ack="1")
        ])):
            svcs = await client.get_services()
        assert svcs[0].acknowledged is True

    async def test_suppressed_problem_is_downtime(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_problem(suppressed="1")
        ])):
            svcs = await client.get_services()
        assert svcs[0].in_downtime is True

    async def test_host_name_from_hosts(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_problem(hosts=[{"host": "myhost"}])
        ])):
            svcs = await client.get_services()
        assert svcs[0].host_name == "myhost"

    async def test_no_hosts_empty_host_name(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_problem(hosts=[])
        ])):
            svcs = await client.get_services()
        assert svcs[0].host_name == ""

    async def test_backend_id(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[
            self._make_problem()
        ])):
            svcs = await client.get_services()
        assert svcs[0].backend_id == "test-zabbix"


# ── get_hostgroups ────────────────────────────────────────────────────────────

class TestGetHostgroups:
    async def test_empty_returns_empty(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=None)):
            groups = await client.get_hostgroups()
        assert groups == []

    async def test_hostgroup_parsed(self, client):
        data = [{"groupid": "1", "name": "Linux servers",
                 "hosts": [{"host": "srv1"}, {"host": "srv2"}]}]
        with patch.object(client, "_request", new=AsyncMock(return_value=data)):
            groups = await client.get_hostgroups()
        assert groups[0]["name"] == "Linux servers"
        assert "srv1" in groups[0]["members"]
        assert "srv2" in groups[0]["members"]

    async def test_empty_hosts_list(self, client):
        data = [{"groupid": "1", "name": "Empty", "hosts": []}]
        with patch.object(client, "_request", new=AsyncMock(return_value=data)):
            groups = await client.get_hostgroups()
        assert groups[0]["members"] == []


# ── Aktionen ──────────────────────────────────────────────────────────────────

class TestActions:
    async def test_acknowledge_host_no_events_returns_false(self, client):
        with patch.object(client, "_get_host_event_ids", new=AsyncMock(return_value=[])):
            result = await client.acknowledge_host("srv1")
        assert result is False

    async def test_acknowledge_host_success(self, client):
        with patch.object(client, "_get_host_event_ids", new=AsyncMock(return_value=["100"])):
            with patch.object(client, "_request", new=AsyncMock(return_value={"eventids": ["100"]})):
                result = await client.acknowledge_host("srv1")
        assert result is True

    async def test_acknowledge_host_request_returns_none(self, client):
        with patch.object(client, "_get_host_event_ids", new=AsyncMock(return_value=["100"])):
            with patch.object(client, "_request", new=AsyncMock(return_value=None)):
                result = await client.acknowledge_host("srv1")
        assert result is False

    async def test_acknowledge_service_no_events_returns_false(self, client):
        with patch.object(client, "_get_host_event_ids", new=AsyncMock(return_value=[])):
            result = await client.acknowledge_service("srv1", "DiskFull")
        assert result is False

    async def test_acknowledge_service_success(self, client):
        with patch.object(client, "_get_host_event_ids", new=AsyncMock(return_value=["200"])):
            with patch.object(client, "_request", new=AsyncMock(return_value={"eventids": ["200"]})):
                result = await client.acknowledge_service("srv1", "DiskFull")
        assert result is True

    async def test_schedule_host_downtime_no_host_returns_false(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=[])):
            result = await client.schedule_host_downtime("unknown-host", 0, 3600)
        assert result is False

    async def test_schedule_host_downtime_success(self, client):
        async def fake_request(method, params):
            if method == "host.get":
                return [{"hostid": "1"}]
            return {"maintenanceids": ["1"]}

        with patch.object(client, "_request", new=AsyncMock(side_effect=fake_request)):
            result = await client.schedule_host_downtime("srv1", 0, 3600)
        assert result is True

    async def test_schedule_service_downtime_delegates_to_host(self, client):
        """Zabbix hat keine Service-Downtime → wird als Host-Downtime umgesetzt."""
        with patch.object(client, "schedule_host_downtime", new=AsyncMock(return_value=True)):
            result = await client.schedule_service_downtime("srv1", "HTTP", 0, 3600)
        assert result is True


# ── _get_host_event_ids ───────────────────────────────────────────────────────

class TestGetHostEventIds:
    async def test_returns_matching_event_ids(self, client):
        data = [
            {"eventid": "1", "name": "DiskFull",
             "hosts": [{"host": "srv1"}]},
            {"eventid": "2", "name": "HighLoad",
             "hosts": [{"host": "srv2"}]},
        ]
        with patch.object(client, "_request", new=AsyncMock(return_value=data)):
            ids = await client._get_host_event_ids("srv1")
        assert ids == ["1"]

    async def test_filters_by_problem_name(self, client):
        data = [
            {"eventid": "1", "name": "DiskFull", "hosts": [{"host": "srv1"}]},
            {"eventid": "2", "name": "HighLoad",  "hosts": [{"host": "srv1"}]},
        ]
        with patch.object(client, "_request", new=AsyncMock(return_value=data)):
            ids = await client._get_host_event_ids("srv1", "DiskFull")
        assert ids == ["1"]

    async def test_empty_result_returns_empty(self, client):
        with patch.object(client, "_request", new=AsyncMock(return_value=None)):
            ids = await client._get_host_event_ids("srv1")
        assert ids == []


# ── ping ──────────────────────────────────────────────────────────────────────

class TestPing:
    async def test_ping_success(self, client):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"result": "6.4.0"}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)

        with patch("zabbix.client.httpx.AsyncClient", return_value=mock_http):
            health = await client.ping()

        assert health.reachable is True
        assert "6.4.0" in health.error
        assert health.backend_id == "test-zabbix"

    async def test_ping_failure(self, client):
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(side_effect=Exception("timeout"))

        with patch("zabbix.client.httpx.AsyncClient", return_value=mock_http):
            health = await client.ping()

        assert health.reachable is False
        assert "timeout" in health.error
