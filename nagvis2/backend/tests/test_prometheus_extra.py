"""
Zusätzliche Tests für prometheus/client.py – _get() Methode.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from prometheus.client import PrometheusClient, PrometheusConfig


@pytest.fixture
def client():
    return PrometheusClient(PrometheusConfig(
        backend_id="test-prom",
        url="http://prometheus:9090",
        verify_ssl=False,
    ))


# ── _get ──────────────────────────────────────────────────────────────────────

class TestGet:
    async def test_get_success_returns_data(self, client):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"status": "success", "data": {"result": []}}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__  = AsyncMock(return_value=False)
        mock_http.get        = AsyncMock(return_value=mock_resp)

        with patch("prometheus.client.httpx.AsyncClient", return_value=mock_http):
            result = await client._get("/api/v1/query", {"query": "up"})

        assert result == {"result": []}

    async def test_get_non_success_status_returns_none(self, client):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"status": "error", "error": "bad request"}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__  = AsyncMock(return_value=False)
        mock_http.get        = AsyncMock(return_value=mock_resp)

        with patch("prometheus.client.httpx.AsyncClient", return_value=mock_http):
            result = await client._get("/api/v1/query")

        assert result is None

    async def test_get_exception_propagates(self, client):
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__  = AsyncMock(return_value=False)
        mock_http.get        = AsyncMock(side_effect=Exception("connection refused"))

        with patch("prometheus.client.httpx.AsyncClient", return_value=mock_http):
            with pytest.raises(Exception, match="connection refused"):
                await client._get("/api/v1/query")

    async def test_get_with_basic_auth(self):
        cfg = PrometheusConfig(username="user", password="pass",
                               url="http://prom:9090", verify_ssl=False)
        c = PrometheusClient(cfg)

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"status": "success", "data": {"result": []}}

        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__  = AsyncMock(return_value=False)
        mock_http.get        = AsyncMock(return_value=mock_resp)

        with patch("prometheus.client.httpx.AsyncClient", return_value=mock_http) as mock_cls:
            await c._get("/api/v1/query")

        # auth=("user","pass") muss übergeben worden sein
        call_kwargs = mock_cls.call_args[1]
        assert call_kwargs.get("auth") == ("user", "pass")
