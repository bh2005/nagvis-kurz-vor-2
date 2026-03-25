"""
Zusätzliche Tests für main.py – health_ready, _seed_maps, /api Compat-Redirect.
"""

import shutil
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch


# ══════════════════════════════════════════════════════════════════════
#  _seed_maps
# ══════════════════════════════════════════════════════════════════════

def _get_seed_maps():
    """Lazy import von _seed_maps um Module-Level-Imports zu vermeiden."""
    try:
        import main as _main
        return _main._seed_maps
    except (ImportError, ModuleNotFoundError):
        import pytest
        pytest.skip("prometheus_client not installed (CI only)")


class TestSeedMaps:
    def test_seed_maps_no_seed_dir_returns_early(self, tmp_path, monkeypatch):
        """Wenn seed_maps/ nicht existiert, passiert nichts."""
        from core.config import settings
        monkeypatch.setattr(settings, "BASE_DIR", tmp_path / "backend")
        monkeypatch.setattr(settings, "MAPS_DIR", tmp_path / "maps")
        (tmp_path / "maps").mkdir()

        _get_seed_maps()()   # darf keinen Fehler werfen

    def test_seed_maps_copies_new_file(self, tmp_path, monkeypatch):
        """Neue Seed-Map wird kopiert."""
        backend_dir = tmp_path / "backend"
        backend_dir.mkdir()
        seed_dir = backend_dir / "seed_maps"
        seed_dir.mkdir()
        maps_dir = tmp_path / "maps"
        maps_dir.mkdir()

        (seed_dir / "custom-map.json").write_text('{"id":"custom-map"}', encoding="utf-8")

        from core.config import settings
        monkeypatch.setattr(settings, "BASE_DIR", backend_dir)
        monkeypatch.setattr(settings, "MAPS_DIR", maps_dir)

        _get_seed_maps()()

        assert (maps_dir / "custom-map.json").exists()

    def test_seed_maps_updates_demo_map(self, tmp_path, monkeypatch):
        """demo-* Maps werden immer überschrieben."""
        backend_dir = tmp_path / "backend"
        backend_dir.mkdir()
        seed_dir = backend_dir / "seed_maps"
        seed_dir.mkdir()
        maps_dir = tmp_path / "maps"
        maps_dir.mkdir()

        seed_content = '{"id":"demo-test","updated":true}'
        (seed_dir / "demo-test.json").write_text(seed_content, encoding="utf-8")

        # Bereits existierende Map
        existing = maps_dir / "demo-test.json"
        existing.write_text('{"id":"demo-test","updated":false}', encoding="utf-8")

        from core.config import settings
        monkeypatch.setattr(settings, "BASE_DIR", backend_dir)
        monkeypatch.setattr(settings, "MAPS_DIR", maps_dir)

        _get_seed_maps()()

        result = (maps_dir / "demo-test.json").read_text(encoding="utf-8")
        assert '"updated": true' in result or '"updated":true' in result

    def test_seed_maps_does_not_overwrite_custom_map(self, tmp_path, monkeypatch):
        """Nicht-Demo-Maps werden NICHT überschrieben wenn sie existieren."""
        backend_dir = tmp_path / "backend"
        backend_dir.mkdir()
        seed_dir = backend_dir / "seed_maps"
        seed_dir.mkdir()
        maps_dir = tmp_path / "maps"
        maps_dir.mkdir()

        (seed_dir / "my-map.json").write_text('{"id":"my-map","v":2}', encoding="utf-8")
        existing = maps_dir / "my-map.json"
        existing.write_text('{"id":"my-map","v":1}', encoding="utf-8")

        from core.config import settings
        monkeypatch.setattr(settings, "BASE_DIR", backend_dir)
        monkeypatch.setattr(settings, "MAPS_DIR", maps_dir)

        _get_seed_maps()()

        result = (maps_dir / "my-map.json").read_text(encoding="utf-8")
        assert '"v": 1' in result or '"v":1' in result


# ══════════════════════════════════════════════════════════════════════
#  /health/ready
# ══════════════════════════════════════════════════════════════════════

class TestHealthReady:
    def test_health_ready_demo_mode(self, client, monkeypatch):
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", True)
        r = client.get("/health/ready")
        assert r.status_code == 200
        assert r.json()["demo"] is True

    def test_health_ready_no_backends_returns_503(self, client, monkeypatch):
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        with patch("connectors.registry.registry") as mock_reg:
            mock_reg.is_empty.return_value = True
            r = client.get("/health/ready")
        assert r.status_code == 503
        assert r.json()["reason"] == "no backends configured"

    def test_health_ready_backends_unreachable_returns_503(self, client, monkeypatch):
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        with patch("connectors.registry.registry") as mock_reg:
            mock_reg.is_empty.return_value = False
            mock_reg.health = AsyncMock(return_value=[
                {"backend_id": "b1", "reachable": False, "type": "livestatus_tcp"},
            ])
            r = client.get("/health/ready")
        assert r.status_code == 503

    def test_health_ready_backends_reachable_returns_200(self, client, monkeypatch):
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)
        with patch("connectors.registry.registry") as mock_reg:
            mock_reg.is_empty.return_value = False
            mock_reg.health = AsyncMock(return_value=[
                {"backend_id": "b1", "reachable": True, "type": "livestatus_tcp"},
            ])
            r = client.get("/health/ready")
        assert r.status_code == 200
        assert r.json()["backends"] == 1


# ══════════════════════════════════════════════════════════════════════
#  /api Compat-Redirect
# ══════════════════════════════════════════════════════════════════════

class TestCompatRedirect:
    def test_api_maps_redirects_to_v1(self, client):
        """GET /api/maps → 308 Redirect nach /api/v1/maps."""
        r = client.get("/api/maps", follow_redirects=False)
        assert r.status_code == 308
        assert "/api/v1/maps" in r.headers["location"]

    def test_api_maps_with_query_redirects(self, client):
        """Query-Parameter werden bei Redirect beibehalten."""
        r = client.get("/api/maps?limit=10", follow_redirects=False)
        assert r.status_code == 308
        assert "limit=10" in r.headers["location"]
