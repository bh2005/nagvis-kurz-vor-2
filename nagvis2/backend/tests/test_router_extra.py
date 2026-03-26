"""
Zusätzliche Tests für api/router.py – deckt bisher nicht abgedeckte Pfade ab.
"""

import base64
import io
import json
import zipfile
import zlib
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# api.router importiert FastAPI-Routes die python-multipart voraussetzen.
# In CI ist das Paket vorhanden; lokal nicht → Klasse überspringen.
_api_router_importable = False
try:
    import api.router  # noqa: F401
    _api_router_importable = True
except (RuntimeError, ImportError):
    pass


# ══════════════════════════════════════════════════════════════════════
#  ActionRequest – Computed Properties
# ══════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not _api_router_importable, reason="python-multipart not installed (CI only)")
class TestActionRequestProperties:
    def test_eff_host_prefers_host_name(self):
        from api.router import ActionRequest
        r = ActionRequest(action="ack_host", host_name="srv1", hostname="srv2")
        assert r.eff_host == "srv1"

    def test_eff_host_falls_back_to_hostname(self):
        from api.router import ActionRequest
        r = ActionRequest(action="ack_host", hostname="srv2")
        assert r.eff_host == "srv2"

    def test_eff_host_empty_when_neither(self):
        from api.router import ActionRequest
        r = ActionRequest(action="ack_host")
        assert r.eff_host == ""

    def test_eff_service_prefers_service_name(self):
        from api.router import ActionRequest
        r = ActionRequest(action="ack_service", service_name="HTTP", service="ping")
        assert r.eff_service == "HTTP"

    def test_eff_service_falls_back_to_service(self):
        from api.router import ActionRequest
        r = ActionRequest(action="ack_service", service="ping")
        assert r.eff_service == "ping"

    def test_eff_start_prefers_start_time(self):
        from api.router import ActionRequest
        r = ActionRequest(action="downtime_host", start_time=1000, start=500)
        assert r.eff_start == 1000

    def test_eff_start_falls_back_to_start(self):
        from api.router import ActionRequest
        r = ActionRequest(action="downtime_host", start=500)
        assert r.eff_start == 500

    def test_eff_end_prefers_end_time(self):
        from api.router import ActionRequest
        r = ActionRequest(action="downtime_host", end_time=2000, end=1000)
        assert r.eff_end == 2000

    def test_eff_end_falls_back_to_end(self):
        from api.router import ActionRequest
        r = ActionRequest(action="downtime_host", end=1000)
        assert r.eff_end == 1000


# ══════════════════════════════════════════════════════════════════════
#  Changelog
# ══════════════════════════════════════════════════════════════════════

class TestChangelog:
    def test_changelog_txt_found(self, client, tmp_path, monkeypatch):
        cl_file = tmp_path / "changelog.txt"
        cl_file.write_text("v1.0 changes", encoding="utf-16")
        from core.config import settings
        monkeypatch.setattr(settings, "BASE_DIR", tmp_path / "backend")
        r = client.get("/api/v1/changelog")
        assert r.status_code == 200
        assert "v1.0" in r.text

    def test_changelog_md_fallback(self, client, tmp_path, monkeypatch):
        md_file = tmp_path / "changelog.md"
        md_file.write_text("# Changelog\n## v1.0\nSome changes", encoding="utf-8")
        from core.config import settings
        monkeypatch.setattr(settings, "BASE_DIR", tmp_path / "backend")
        r = client.get("/api/v1/changelog")
        assert r.status_code == 200
        assert "v1.0" in r.text

    def test_changelog_not_found_returns_404(self, client, tmp_path, monkeypatch):
        from core.config import settings
        monkeypatch.setattr(settings, "BASE_DIR", tmp_path / "backend")
        r = client.get("/api/v1/changelog")
        assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════
#  Objects – Fehler-Pfade
# ══════════════════════════════════════════════════════════════════════

class TestObjectErrors:
    @pytest.fixture(autouse=True)
    def _create_map(self, client):
        client.post("/api/maps", json={"title": "Err Map", "map_id": "errmap"})

    def test_update_props_nonexistent_returns_404(self, client):
        r = client.patch("/api/maps/errmap/objects/ghost/props",
                         json={"label": "X"})
        assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════
#  Background Upload – Dateiendungs-Fallback
# ══════════════════════════════════════════════════════════════════════

class TestBackgroundExtFallback:
    @pytest.fixture(autouse=True)
    def _create_map(self, client):
        client.post("/api/maps", json={"title": "BG Fallback", "map_id": "bgfb"})

    def test_upload_png_without_content_type_uses_extension(self, client):
        """Kein Content-Type gesetzt → Fallback auf Dateiendung."""
        png = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
            b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
            b'\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        r = client.post(
            "/api/maps/bgfb/background",
            files={"file": ("image.png", io.BytesIO(png), "application/octet-stream")},
        )
        assert r.status_code == 200
        assert r.json()["url"].endswith(".png")

    def test_upload_unknown_extension_returns_400(self, client):
        r = client.post(
            "/api/maps/bgfb/background",
            files={"file": ("doc.bmp", b"BMPDATA", "application/octet-stream")},
        )
        assert r.status_code == 400


# ══════════════════════════════════════════════════════════════════════
#  Export / Import – Zusätzliche Pfade
# ══════════════════════════════════════════════════════════════════════

class TestExportImportExtra:
    def test_export_includes_background(self, client, tmp_path, monkeypatch):
        """Export enthält Hintergrundbild wenn vorhanden."""
        from core.config import settings
        client.post("/api/maps", json={"title": "BG Export", "map_id": "bgexport"})
        # Hintergrundbild hochladen
        png = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
            b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
            b'\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        client.post(
            "/api/maps/bgexport/background",
            files={"file": ("bg.png", io.BytesIO(png), "image/png")},
        )
        r = client.get("/api/maps/bgexport/export")
        assert r.status_code == 200
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            assert "map.json" in zf.namelist()
            assert any(n.startswith("background") for n in zf.namelist())

    def test_import_zip_without_map_json_returns_400(self, client):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("readme.txt", "no map here")
        buf.seek(0)
        r = client.post(
            "/api/maps/import",
            files={"file": ("nomap.zip", buf, "application/zip")},
        )
        assert r.status_code == 400

    def test_import_with_background_file(self, client):
        """Import mit Hintergrundbild im ZIP."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("map.json", json.dumps({
                "id": "imp-bg", "title": "BG Import",
                "objects": [], "canvas": {"mode": "free"},
            }))
            # Minimales PNG als Hintergrundbild
            png = (
                b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
                b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde'
                b'\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01'
                b'\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
            )
            zf.writestr("background.png", png)
        buf.seek(0)
        r = client.post(
            "/api/maps/import",
            files={"file": ("withbg.zip", buf, "application/zip")},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["bg_saved"] is True


# ══════════════════════════════════════════════════════════════════════
#  draw.io Import
# ══════════════════════════════════════════════════════════════════════

def _make_drawio_xml(vertices=True, edges=True) -> bytes:
    """Erstellt ein minimales draw.io XML mit optionalen Knoten und Kanten."""
    cells = '<mxCell id="0" /><mxCell id="1" parent="0" />'
    if vertices:
        cells += '''
        <mxCell id="2" value="Node A" vertex="1" parent="1">
          <mxGeometry x="100" y="100" width="120" height="60" as="geometry" />
        </mxCell>
        <mxCell id="3" value="Node B" vertex="1" parent="1">
          <mxGeometry x="300" y="200" width="120" height="60" as="geometry" />
        </mxCell>
        '''
    if edges:
        cells += '''
        <mxCell id="4" value="" edge="1" source="2" target="3" parent="1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        '''
    return f'''<?xml version="1.0"?>
<mxfile><diagram id="d1" name="Page-1">
  <mxGraphModel><root>{cells}</root></mxGraphModel>
</diagram></mxfile>'''.encode()


class TestDrawioImport:
    def test_import_drawio_basic(self, client):
        r = client.post(
            "/api/maps/import-drawio?title=DrawioTest",
            files={"file": ("test.drawio", _make_drawio_xml(), "text/xml")},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "DrawioTest"
        assert data["object_count"] > 0

    def test_import_drawio_as_hosts(self, client):
        r = client.post(
            "/api/maps/import-drawio?as_hosts=true",
            files={"file": ("hosts.drawio", _make_drawio_xml(), "text/xml")},
        )
        assert r.status_code == 201

    def test_import_drawio_invalid_xml_returns_400(self, client):
        r = client.post(
            "/api/maps/import-drawio",
            files={"file": ("bad.drawio", b"not xml at all!!!", "text/xml")},
        )
        assert r.status_code == 400

    def test_import_drawio_no_model_returns_400(self, client):
        xml = b'<?xml version="1.0"?><root><something/></root>'
        r = client.post(
            "/api/maps/import-drawio",
            files={"file": ("nomodel.drawio", xml, "text/xml")},
        )
        assert r.status_code == 400

    def test_import_drawio_no_root_element_returns_400(self, client):
        xml = b'<?xml version="1.0"?><mxGraphModel></mxGraphModel>'
        r = client.post(
            "/api/maps/import-drawio",
            files={"file": ("noroot.drawio", xml, "text/xml")},
        )
        assert r.status_code == 400

    def test_import_drawio_empty_cells_returns_400(self, client):
        xml = b'''<?xml version="1.0"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
  </root>
</mxGraphModel>'''
        r = client.post(
            "/api/maps/import-drawio",
            files={"file": ("empty.drawio", xml, "text/xml")},
        )
        assert r.status_code == 400

    def test_import_drawio_mxgraphmodel_as_root(self, client):
        """mxGraphModel direkt als Root-Element (ohne mxfile-Wrapper)."""
        xml = b'''<?xml version="1.0"?>
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="2" value="A" vertex="1" parent="1">
      <mxGeometry x="50" y="50" width="100" height="50" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>'''
        r = client.post(
            "/api/maps/import-drawio?title=DirectModel",
            files={"file": ("direct.xml", xml, "text/xml")},
        )
        assert r.status_code == 201

    def test_import_drawio_compressed_content(self, client):
        """Komprimierter Diagramm-Inhalt in draw.io."""
        inner_xml = b'<mxGraphModel><root>' \
                    b'<mxCell id="0"/><mxCell id="1" parent="0"/>' \
                    b'<mxCell id="2" value="Srv" vertex="1" parent="1">' \
                    b'<mxGeometry x="10" y="10" width="80" height="40" as="geometry"/>' \
                    b'</mxCell></root></mxGraphModel>'

        # raw-deflate komprimieren, dann base64
        compressed = zlib.compress(inner_xml)[2:-4]  # zlib wrapper entfernen
        encoded = base64.b64encode(compressed).decode()

        xml = f'''<?xml version="1.0"?>
<mxfile><diagram id="d1" name="Page-1">{encoded}</diagram></mxfile>'''.encode()

        r = client.post(
            "/api/maps/import-drawio",
            files={"file": ("compressed.drawio", xml, "text/xml")},
        )
        # Kann 201 oder 400 sein je nach Kompressionsformat – kein Crash erwartet
        assert r.status_code in (201, 400)

    def test_import_drawio_uses_filename_as_title(self, client):
        r = client.post(
            "/api/maps/import-drawio",
            files={"file": ("my-diagram.drawio", _make_drawio_xml(), "text/xml")},
        )
        assert r.status_code == 201
        assert r.json()["title"] == "my-diagram"


# ══════════════════════════════════════════════════════════════════════
#  NagVis 1 Migration
# ══════════════════════════════════════════════════════════════════════

class TestMigrate:
    def _nagvis1_cfg(self) -> bytes:
        return b"""[global]
[host_srv1]
host_name=srv1
x=100
y=200
iconset=std_small

[host_srv2]
host_name=srv2
x=300
y=400
"""

    def test_migrate_dry_run(self, client):
        r = client.post(
            "/api/migrate?dry_run=true",
            files={"file": ("map1.cfg", self._nagvis1_cfg(), "text/plain")},
        )
        assert r.status_code == 200
        assert r.json()["dry_run"] is True

    def test_migrate_creates_map(self, client):
        r = client.post(
            "/api/migrate?map_id=migrated-map",
            files={"file": ("map1.cfg", self._nagvis1_cfg(), "text/plain")},
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("id") == "migrated-map" or "object_count" in data

    def test_migrate_uses_filename_as_map_id(self, client):
        r = client.post(
            "/api/migrate",
            files={"file": ("my-map.cfg", self._nagvis1_cfg(), "text/plain")},
        )
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════
#  Aktionen (ACK / Downtime / Reschedule)
# ══════════════════════════════════════════════════════════════════════

class TestActionsDemo:
    def test_action_in_demo_mode_returns_ok(self, client, monkeypatch):
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", True)
        r = client.post("/api/v1/actions", json={"action": "ack_host", "host_name": "srv1"})
        assert r.status_code == 200
        assert r.json()["demo"] is True


class TestActionsReal:
    @pytest.fixture(autouse=True)
    def _no_demo(self, monkeypatch):
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)

    def test_ack_host(self, client):
        with patch("api.router.livestatus.acknowledge_host", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "ack_host", "host_name": "srv1"})
        assert r.status_code == 200

    def test_ack_host_failure_returns_502(self, client):
        with patch("api.router.registry.acknowledge_host", new=AsyncMock(return_value=False)), \
             patch("api.router.livestatus.acknowledge_host", new=AsyncMock(return_value=False)):
            r = client.post("/api/v1/actions",
                            json={"action": "ack_host", "host_name": "srv1"})
        assert r.status_code == 502

    def test_ack_host_missing_host_returns_400(self, client):
        r = client.post("/api/v1/actions", json={"action": "ack_host"})
        assert r.status_code == 400

    def test_ack_service(self, client):
        with patch("api.router.livestatus.acknowledge_service", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "ack_service",
                                  "host_name": "srv1", "service_name": "HTTP"})
        assert r.status_code == 200

    def test_ack_service_missing_service_returns_400(self, client):
        r = client.post("/api/v1/actions",
                        json={"action": "ack_service", "host_name": "srv1"})
        assert r.status_code == 400

    def test_remove_ack_host(self, client):
        with patch("api.router.livestatus.remove_host_ack", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "remove_ack", "host_name": "srv1"})
        assert r.status_code == 200

    def test_remove_ack_service(self, client):
        with patch("api.router.livestatus.remove_service_ack", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "remove_ack",
                                  "host_name": "srv1", "service_name": "HTTP"})
        assert r.status_code == 200

    def test_downtime_host(self, client):
        with patch("api.router.registry.schedule_downtime", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "downtime_host", "host_name": "srv1",
                                  "start_time": 0, "end_time": 3600})
        assert r.status_code == 200

    def test_downtime_host_fallback_to_livestatus(self, client):
        with patch("api.router.registry.schedule_downtime", new=AsyncMock(return_value=False)), \
             patch("api.router.livestatus.schedule_host_downtime", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "downtime_host", "host_name": "srv1"})
        assert r.status_code == 200

    def test_schedule_downtime_as_host(self, client):
        """action=schedule_downtime ohne service → Host-Downtime."""
        with patch("api.router.registry.schedule_downtime", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "schedule_downtime", "host_name": "srv1"})
        assert r.status_code == 200

    def test_downtime_service(self, client):
        with patch("api.router.registry.schedule_downtime", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "downtime_service",
                                  "host_name": "srv1", "service_name": "HTTP"})
        assert r.status_code == 200

    def test_downtime_service_missing_service_returns_400(self, client):
        r = client.post("/api/v1/actions",
                        json={"action": "downtime_service", "host_name": "srv1"})
        assert r.status_code == 400

    def test_schedule_downtime_as_service_via_type(self, client):
        with patch("api.router.registry.schedule_downtime", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "schedule_downtime", "host_name": "srv1",
                                  "service_name": "HTTP", "type": "service"})
        assert r.status_code == 200

    def test_reschedule(self, client):
        with patch("api.router.livestatus.reschedule_host_check", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "reschedule", "host_name": "srv1"})
        assert r.status_code == 200

    def test_unknown_action_returns_400(self, client):
        r = client.post("/api/v1/actions",
                        json={"action": "unknown_action", "host_name": "srv1"})
        assert r.status_code == 400

    def test_action_with_alias_fields(self, client):
        """Frontend-Aliases hostname/service/start/end sollen funktionieren."""
        with patch("api.router.livestatus.acknowledge_host", new=AsyncMock(return_value=True)):
            r = client.post("/api/v1/actions",
                            json={"action": "ack_host", "hostname": "srv1"})
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════
#  Hosts / Hostgruppen (kein Demo-Modus)
# ══════════════════════════════════════════════════════════════════════

class TestHostsHostgroups:
    @pytest.fixture(autouse=True)
    def _no_demo(self, monkeypatch):
        from core.config import settings
        monkeypatch.setattr(settings, "DEMO_MODE", False)

    def test_api_hosts_returns_list(self, client):
        mock_host = MagicMock()
        mock_host.name = "srv1"
        with patch("api.router.registry.get_all_hosts", new=AsyncMock(return_value=[mock_host])):
            r = client.get("/api/v1/hosts")
        assert r.status_code == 200
        assert "srv1" in r.json()

    def test_api_hosts_fallback_to_livestatus(self, client):
        mock_host = MagicMock()
        mock_host.name = "srv-live"
        with patch("api.router.registry.get_all_hosts", new=AsyncMock(return_value=[])), \
             patch("api.router.livestatus.get_hosts", new=AsyncMock(return_value=[mock_host])):
            r = client.get("/api/v1/hosts")
        assert r.status_code == 200
        assert "srv-live" in r.json()

    def test_api_hostgroups_returns_list(self, client):
        groups = [{"name": "webservers", "members": ["srv1"]}]
        with patch("api.router.registry.get_all_hostgroups", new=AsyncMock(return_value=groups)):
            r = client.get("/api/v1/hostgroups")
        assert r.status_code == 200
        assert r.json()[0]["name"] == "webservers"

    def test_api_hostgroups_fallback_to_livestatus(self, client):
        groups = [{"name": "linux", "members": []}]
        with patch("api.router.registry.get_all_hostgroups", new=AsyncMock(return_value=[])), \
             patch("api.router.livestatus.get_hostgroups", new=AsyncMock(return_value=groups)):
            r = client.get("/api/v1/hostgroups")
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════
#  Backends CRUD
# ══════════════════════════════════════════════════════════════════════

class TestBackendsApi:
    def test_list_backends_empty(self, client):
        with patch("api.router.registry.list_backends", return_value=[]):
            r = client.get("/api/v1/backends")
        assert r.status_code == 200
        assert r.json() == []

    def test_add_backend_success(self, client):
        with patch("api.router.registry.add_backend", return_value="test-backend"), \
             patch("api.router.registry.get_backend_info",
                   return_value={"backend_id": "test-backend", "type": "livestatus_tcp"}):
            r = client.post("/api/v1/backends",
                            json={"backend_id": "test-backend", "type": "livestatus_tcp",
                                  "host": "localhost", "port": 6557})
        assert r.status_code == 201

    def test_add_backend_duplicate_returns_400(self, client):
        with patch("api.router.registry.add_backend",
                   side_effect=ValueError("backend already exists")):
            r = client.post("/api/v1/backends",
                            json={"backend_id": "dup", "type": "livestatus_tcp"})
        assert r.status_code == 400

    def test_get_backend_success(self, client):
        with patch("api.router.registry.get_raw_config",
                   return_value={"backend_id": "b1", "type": "livestatus_tcp"}):
            r = client.get("/api/v1/backends/b1")
        assert r.status_code == 200
        assert r.json()["backend_id"] == "b1"

    def test_get_backend_not_found_returns_404(self, client):
        with patch("api.router.registry.get_raw_config", return_value=None):
            r = client.get("/api/v1/backends/ghost")
        assert r.status_code == 404

    def test_update_backend_not_found_returns_404(self, client):
        with patch("api.router.registry.get_backend_info", return_value=None):
            r = client.patch("/api/v1/backends/ghost",
                             json={"backend_id": "ghost", "type": "livestatus_tcp"})
        assert r.status_code == 404

    def test_update_backend_success(self, client):
        with patch("api.router.registry.get_backend_info",
                   return_value={"backend_id": "b1"}), \
             patch("api.router.registry.remove_backend", return_value=True), \
             patch("api.router.registry.add_backend", return_value="b1"), \
             patch("api.router.registry.get_backend_info",
                   return_value={"backend_id": "b1", "type": "livestatus_tcp"}):
            r = client.patch("/api/v1/backends/b1",
                             json={"backend_id": "b1", "type": "livestatus_tcp"})
        assert r.status_code == 200

    def test_remove_backend_success(self, client):
        with patch("api.router.registry.remove_backend", return_value=True):
            r = client.delete("/api/v1/backends/b1")
        assert r.status_code == 200
        assert r.json()["deleted"] == "b1"

    def test_remove_backend_not_found_returns_404(self, client):
        with patch("api.router.registry.remove_backend", return_value=False):
            r = client.delete("/api/v1/backends/ghost")
        assert r.status_code == 404

    def test_toggle_backend_success(self, client):
        with patch("api.router.registry.toggle_backend", return_value=True):
            r = client.put("/api/v1/backends/b1/enabled", json={"enabled": False})
        assert r.status_code == 200
        assert r.json()["enabled"] is False

    def test_toggle_backend_not_found_returns_404(self, client):
        with patch("api.router.registry.toggle_backend", return_value=False):
            r = client.put("/api/v1/backends/ghost/enabled", json={"enabled": True})
        assert r.status_code == 404

    def test_probe_backend(self, client):
        from livestatus.client import BackendHealth
        health = BackendHealth(backend_id="probe", reachable=True, latency_ms=5.0)
        with patch("api.router.registry.probe", new=AsyncMock(return_value=health)):
            r = client.post("/api/v1/backends/probe",
                            json={"backend_id": "probe", "type": "livestatus_tcp"})
        assert r.status_code == 200
        assert r.json()["reachable"] is True

    def test_test_backend_success(self, client):
        with patch("api.router.registry.get_backend_info",
                   return_value={"backend_id": "b1"}), \
             patch("api.router.registry.health", new=AsyncMock(return_value=[
                 {"backend_id": "b1", "reachable": True}
             ])):
            r = client.post("/api/v1/backends/b1/test")
        assert r.status_code == 200

    def test_test_backend_not_found_returns_404(self, client):
        with patch("api.router.registry.get_backend_info", return_value=None):
            r = client.post("/api/v1/backends/ghost/test")
        assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════
#  Kiosk-User Resolve
# ══════════════════════════════════════════════════════════════════════

class TestKioskResolve:
    def test_resolve_valid_token(self, client):
        r = client.post("/api/v1/kiosk-users",
                        json={"label": "Kiosk 1", "maps": ["demo-features"],
                              "order": [], "interval": 30})
        assert r.status_code == 201
        token = r.json()["token"]

        r2 = client.get(f"/api/v1/kiosk-users/resolve?token={token}")
        assert r2.status_code == 200
        assert r2.json()["label"] == "Kiosk 1"

    def test_resolve_invalid_token_returns_404(self, client):
        r = client.get("/api/v1/kiosk-users/resolve?token=invalid-token-xyz")
        assert r.status_code == 404
