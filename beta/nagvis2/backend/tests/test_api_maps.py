"""
Integrations-Tests für die Map- und Objekt-API-Endpunkte.
Nutzt den FastAPI TestClient (deckt main.py + api/router.py ab).
"""

import io
import json
import zipfile
import pytest


# ── Health & Meta ─────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_live(self, client):
        r = client.get("/health/live")
        assert r.status_code == 200
        assert r.json()["status"] == "alive"

    def test_health_compat(self, client):
        r = client.get("/health")
        assert r.status_code in (200, 503)   # 503 wenn kein Backend

    def test_metrics_endpoint(self, client):
        r = client.get("/metrics")
        assert r.status_code == 200
        assert b"nagvis2" in r.content


# ── Maps CRUD ─────────────────────────────────────────────────────────────────

class TestMapsApi:
    def test_list_empty(self, client):
        r = client.get("/api/maps")
        assert r.status_code == 200
        assert r.json() == []

    def test_create_map(self, client):
        r = client.post("/api/maps", json={"title": "My Map"})
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "My Map"
        assert data["id"] == "my-map"
        assert data["object_count"] == 0

    def test_create_map_custom_id(self, client):
        r = client.post("/api/maps", json={"title": "Custom", "map_id": "custom-id"})
        assert r.status_code == 201
        assert r.json()["id"] == "custom-id"

    def test_get_map(self, client):
        client.post("/api/maps", json={"title": "Get Me", "map_id": "get-me"})
        r = client.get("/api/maps/get-me")
        assert r.status_code == 200
        assert r.json()["title"] == "Get Me"

    def test_get_nonexistent_map_returns_404(self, client):
        r = client.get("/api/maps/does-not-exist")
        assert r.status_code == 404

    def test_list_after_create(self, client):
        client.post("/api/maps", json={"title": "Alpha"})
        client.post("/api/maps", json={"title": "Beta"})
        maps = client.get("/api/maps").json()
        ids = {m["id"] for m in maps}
        assert "alpha" in ids
        assert "beta"  in ids

    def test_delete_map(self, client):
        client.post("/api/maps", json={"title": "Del", "map_id": "del"})
        r = client.delete("/api/maps/del")
        assert r.status_code == 200
        assert client.get("/api/maps/del").status_code == 404

    def test_delete_nonexistent_returns_404(self, client):
        r = client.delete("/api/maps/ghost")
        assert r.status_code == 404

    def test_rename_map(self, client):
        client.post("/api/maps", json={"title": "Old", "map_id": "rename-me"})
        r = client.put("/api/maps/rename-me/title", json={"title": "New Title"})
        assert r.status_code == 200
        assert r.json()["title"] == "New Title"

    def test_rename_nonexistent_returns_404(self, client):
        r = client.put("/api/maps/ghost/title", json={"title": "X"})
        assert r.status_code == 404

    def test_set_canvas(self, client):
        client.post("/api/maps", json={"title": "Canvas Map", "map_id": "cmap"})
        canvas = {"mode": "fixed", "width": 1200, "height": 800}
        r = client.put("/api/maps/cmap/canvas", json=canvas)
        assert r.status_code == 200
        assert r.json()["canvas"]["mode"] == "fixed"

    def test_set_parent(self, client):
        client.post("/api/maps", json={"title": "Parent", "map_id": "parent"})
        client.post("/api/maps", json={"title": "Child",  "map_id": "child"})
        r = client.put("/api/maps/child/parent", json={"parent_map": "parent"})
        assert r.status_code == 200
        assert r.json()["parent_map"] == "parent"


# ── Objects ───────────────────────────────────────────────────────────────────

class TestObjectsApi:
    @pytest.fixture(autouse=True)
    def _create_map(self, client):
        client.post("/api/maps", json={"title": "Object Map", "map_id": "omap"})

    def test_create_object(self, client):
        r = client.post("/api/maps/omap/objects",
                        json={"type": "host", "x": 10.0, "y": 20.0, "name": "srv1"})
        assert r.status_code == 201
        obj = r.json()
        assert "object_id" in obj
        assert obj["name"] == "srv1"

    def test_create_object_map_not_found(self, client):
        r = client.post("/api/maps/ghost/objects",
                        json={"type": "host", "x": 0, "y": 0})
        assert r.status_code == 404

    def test_move_object(self, client):
        obj = client.post("/api/maps/omap/objects",
                          json={"type": "host", "x": 10, "y": 20, "name": "h"}).json()
        oid = obj["object_id"]
        r = client.patch(f"/api/maps/omap/objects/{oid}/pos",
                         json={"x": 50.0, "y": 75.0})
        assert r.status_code == 200
        assert r.json()["x"] == 50.0

    def test_move_nonexistent_object_returns_404(self, client):
        r = client.patch("/api/maps/omap/objects/ghost/pos",
                         json={"x": 1, "y": 1})
        assert r.status_code == 404

    def test_update_props(self, client):
        obj = client.post("/api/maps/omap/objects",
                          json={"type": "host", "x": 1, "y": 1, "name": "h2"}).json()
        oid = obj["object_id"]
        r = client.patch(f"/api/maps/omap/objects/{oid}/props",
                         json={"label": "Custom Label", "size": 48})
        assert r.status_code == 200
        assert r.json()["label"] == "Custom Label"

    def test_delete_object(self, client):
        obj = client.post("/api/maps/omap/objects",
                          json={"type": "host", "x": 1, "y": 1, "name": "h3"}).json()
        oid = obj["object_id"]
        r = client.delete(f"/api/maps/omap/objects/{oid}")
        assert r.status_code == 200
        # Map sollte jetzt keine Objekte mehr haben
        m = client.get("/api/maps/omap").json()
        assert m["objects"] == []

    def test_delete_nonexistent_object_returns_404(self, client):
        r = client.delete("/api/maps/omap/objects/ghost")
        assert r.status_code == 404


# ── Background Upload ─────────────────────────────────────────────────────────

class TestBackgroundUpload:
    @pytest.fixture(autouse=True)
    def _create_map(self, client):
        client.post("/api/maps", json={"title": "BG Map", "map_id": "bgmap"})

    def test_upload_png_background(self, client):
        # 1x1 px PNG (minimales gültiges PNG)
        png = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00'
            b'\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18'
            b'\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        r = client.post(
            "/api/maps/bgmap/background",
            files={"file": ("bg.png", io.BytesIO(png), "image/png")},
        )
        assert r.status_code == 200
        assert r.json()["url"].endswith(".png")

    def test_upload_unsupported_type_returns_400(self, client):
        r = client.post(
            "/api/maps/bgmap/background",
            files={"file": ("doc.pdf", b"PDFDATA", "application/pdf")},
        )
        assert r.status_code == 400

    def test_upload_to_nonexistent_map_returns_404(self, client):
        r = client.post(
            "/api/maps/ghost/background",
            files={"file": ("bg.png", b"PNGDATA", "image/png")},
        )
        assert r.status_code == 404


# ── Export / Import ───────────────────────────────────────────────────────────

class TestExportImport:
    def test_export_returns_zip(self, client):
        client.post("/api/maps", json={"title": "Export Me", "map_id": "export-me"})
        r = client.get("/api/maps/export-me/export")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/zip"
        # ZIP muss map.json enthalten
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            assert "map.json" in zf.namelist()

    def test_export_nonexistent_returns_404(self, client):
        r = client.get("/api/maps/ghost/export")
        assert r.status_code == 404

    def test_import_map(self, client):
        # ZIP mit map.json erstellen
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("map.json", json.dumps({
                "id": "imported", "title": "Imported Map",
                "objects": [], "canvas": {"mode": "free"},
            }))
        buf.seek(0)
        r = client.post(
            "/api/maps/import",
            files={"file": ("import.zip", buf, "application/zip")},
        )
        assert r.status_code == 200
        assert r.json()["map_id"] == "imported"

    def test_import_invalid_zip_returns_400(self, client):
        r = client.post(
            "/api/maps/import",
            files={"file": ("bad.zip", b"not a zip", "application/zip")},
        )
        assert r.status_code == 400

    def test_import_dry_run(self, client):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("map.json", json.dumps({
                "id": "dry", "title": "Dry Run",
                "objects": [{"type": "host"}],
            }))
        buf.seek(0)
        r = client.post(
            "/api/maps/import?dry_run=true",
            files={"file": ("dry.zip", buf, "application/zip")},
        )
        assert r.status_code == 200
        assert r.json()["dry_run"] is True
        # Karte darf nicht wirklich angelegt worden sein
        assert client.get("/api/maps/dry").status_code == 404


# ── Audit-Log API ─────────────────────────────────────────────────────────────

class TestAuditApi:
    def test_audit_initially_empty(self, client):
        r = client.get("/api/audit")
        assert r.status_code == 200
        assert r.json() == []

    def test_audit_records_map_create(self, client):
        client.post("/api/maps", json={"title": "Audited Map", "map_id": "aud"})
        r = client.get("/api/audit")
        entries = r.json()
        assert any(e["action"] == "map.create" and e["map_id"] == "aud"
                   for e in entries)

    def test_audit_filter_by_map(self, client):
        client.post("/api/maps", json={"title": "A", "map_id": "filter-a"})
        client.post("/api/maps", json={"title": "B", "map_id": "filter-b"})
        r = client.get("/api/audit?map_id=filter-a")
        entries = r.json()
        assert all(e["map_id"] == "filter-a" for e in entries)

    def test_audit_records_delete(self, client):
        client.post("/api/maps", json={"title": "Del", "map_id": "del-aud"})
        client.delete("/api/maps/del-aud")
        r = client.get("/api/audit?action=map.delete")
        entries = r.json()
        assert any(e["map_id"] == "del-aud" for e in entries)
