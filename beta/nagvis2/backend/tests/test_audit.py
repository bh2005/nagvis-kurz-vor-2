"""Tests für core/audit.py – Audit-Log."""

import json
import time
import pytest
from core.audit import audit_log, read_audit, _maybe_rotate


class TestAuditLog:
    def test_creates_file(self, data_dirs, tmp_path):
        audit_log(None, "map.create", map_id="test-map", title="Test")
        audit_file = tmp_path / "audit.jsonl"
        assert audit_file.exists()

    def test_entry_structure(self, data_dirs, tmp_path):
        audit_log(None, "map.delete", map_id="my-map", title="My Map")
        lines = (tmp_path / "audit.jsonl").read_text().strip().splitlines()
        assert len(lines) == 1
        e = json.loads(lines[0])
        assert e["action"] == "map.delete"
        assert e["map_id"] == "my-map"
        assert e["details"]["title"] == "My Map"
        assert e["user"] == "system"
        assert isinstance(e["ts"], int)
        assert e["ts"] <= int(time.time()) + 1

    def test_multiple_entries_appended(self, data_dirs, tmp_path):
        audit_log(None, "map.create", map_id="a")
        audit_log(None, "map.create", map_id="b")
        audit_log(None, "map.delete", map_id="a")
        lines = (tmp_path / "audit.jsonl").read_text().strip().splitlines()
        assert len(lines) == 3

    def test_none_details_omitted(self, data_dirs, tmp_path):
        audit_log(None, "object.move", map_id="x", object_id="oid", label=None)
        e = json.loads((tmp_path / "audit.jsonl").read_text().strip())
        assert "label" not in e["details"]
        assert e["details"]["object_id"] == "oid"

    def test_system_user_when_request_none(self, data_dirs, tmp_path):
        audit_log(None, "backend.add", backend_id="b1")
        e = json.loads((tmp_path / "audit.jsonl").read_text().strip())
        assert e["user"] == "system"


class TestReadAudit:
    def test_read_empty(self, data_dirs):
        assert read_audit() == []

    def test_read_returns_newest_first(self, data_dirs):
        for i in range(5):
            audit_log(None, "map.create", map_id=f"map-{i}")
        entries = read_audit()
        # Neueste zuerst: letzter angelegter map-4 kommt zuerst
        assert entries[0]["map_id"] == "map-4"
        assert entries[-1]["map_id"] == "map-0"

    def test_read_with_limit(self, data_dirs):
        for i in range(10):
            audit_log(None, "object.create", map_id="m")
        assert len(read_audit(limit=3)) == 3

    def test_filter_by_map_id(self, data_dirs):
        audit_log(None, "map.create", map_id="alpha")
        audit_log(None, "map.create", map_id="beta")
        audit_log(None, "object.create", map_id="alpha")
        result = read_audit(map_id="alpha")
        assert all(e["map_id"] == "alpha" for e in result)
        assert len(result) == 2

    def test_filter_by_action(self, data_dirs):
        audit_log(None, "map.create", map_id="x")
        audit_log(None, "map.delete", map_id="x")
        audit_log(None, "object.create", map_id="x")
        result = read_audit(action="map.create")
        assert len(result) == 1
        assert result[0]["action"] == "map.create"

    def test_filter_by_user(self, data_dirs):
        audit_log(None, "map.create", map_id="a")   # user=system
        entries = read_audit(user="system")
        assert len(entries) == 1
        entries_other = read_audit(user="alice")
        assert len(entries_other) == 0

    def test_read_combined_filters(self, data_dirs):
        audit_log(None, "map.create",  map_id="m1")
        audit_log(None, "object.create", map_id="m1")
        audit_log(None, "map.create",  map_id="m2")
        result = read_audit(map_id="m1", action="map.create")
        assert len(result) == 1


class TestRotation:
    def test_rotation_keeps_recent_entries(self, data_dirs, tmp_path, monkeypatch):
        import core.audit as audit_mod
        monkeypatch.setattr(audit_mod, "ROTATE_AT", 10)

        for i in range(12):
            audit_log(None, "map.create", map_id=f"m{i}")

        lines = (tmp_path / "audit.jsonl").read_text().strip().splitlines()
        # Nach Rotation: 80% von 10 = 8 Einträge behalten
        assert len(lines) <= 10
        # Jüngste Einträge sollten noch da sein
        last = json.loads(lines[-1])
        assert last["map_id"] == "m11"
