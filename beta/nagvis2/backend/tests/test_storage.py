"""Tests für core/storage.py – JSON-Persistenz für Maps und Objekte."""

import pytest
from core.storage import (
    create_map, get_map, list_maps, delete_map, update_map_field, clone_map,
    add_object, update_object, delete_object,
    kiosk_create, kiosk_list, kiosk_update, kiosk_delete, kiosk_get_by_token,
    _slugify,
)


# ── Hilfsfunktionen ────────────────────────────────────────────────────────────

class TestSlugify:
    def test_simple(self):
        assert _slugify("My Map") == "my-map"

    def test_umlauts(self):
        assert _slugify("Übersicht Köln") == "uebersicht-koeln"

    def test_special_chars(self):
        assert _slugify("  Test!!--Map  ") == "test-map"

    def test_empty_falls_back_to_map(self):
        assert _slugify("") == "map"
        assert _slugify("!!") == "map"

    def test_eszett(self):
        assert "ss" in _slugify("Straße")


# ── Map CRUD ───────────────────────────────────────────────────────────────────

class TestMapCrud:
    def test_create_and_get(self, data_dirs):
        m = create_map("Test Map")
        assert m["title"] == "Test Map"
        assert m["id"] == "test-map"

        got = get_map("test-map")
        assert got is not None
        assert got["title"] == "Test Map"
        assert got["objects"] == []

    def test_create_with_explicit_id(self, data_dirs):
        m = create_map("Foo", map_id="custom-id")
        assert m["id"] == "custom-id"

    def test_create_duplicate_id_increments(self, data_dirs):
        m1 = create_map("A Map", map_id="same")
        m2 = create_map("B Map", map_id="same")
        assert m1["id"] == "same"
        assert m2["id"] == "same-1"

    def test_get_nonexistent_returns_none(self, data_dirs):
        assert get_map("does-not-exist") is None

    def test_list_maps_empty(self, data_dirs):
        assert list_maps() == []

    def test_list_maps_returns_all(self, data_dirs):
        create_map("Map A")
        create_map("Map B")
        ids = {m["id"] for m in list_maps()}
        assert "map-a" in ids
        assert "map-b" in ids

    def test_list_maps_includes_object_count(self, data_dirs):
        create_map("C", map_id="cmap")
        add_object("cmap", {"type": "host", "x": 10, "y": 20, "name": "h1"})
        maps = list_maps()
        cmap = next(m for m in maps if m["id"] == "cmap")
        assert cmap["object_count"] == 1

    def test_delete_map(self, data_dirs):
        create_map("Del Me", map_id="del-me")
        assert delete_map("del-me") is True
        assert get_map("del-me") is None

    def test_delete_nonexistent_returns_false(self, data_dirs):
        assert delete_map("ghost") is False

    def test_update_title(self, data_dirs):
        create_map("Old Title", map_id="upd")
        updated = update_map_field("upd", title="New Title")
        assert updated["title"] == "New Title"
        assert get_map("upd")["title"] == "New Title"

    def test_update_nonexistent_returns_none(self, data_dirs):
        assert update_map_field("ghost", title="X") is None

    def test_canvas_stored(self, data_dirs):
        canvas = {"mode": "osm", "lat": 51.0, "lng": 10.0, "zoom": 6}
        m = create_map("OSM", canvas=canvas)
        assert m["canvas"]["mode"] == "osm"


# ── Clone Map ──────────────────────────────────────────────────────────────────

class TestCloneMap:
    def test_clone_creates_new_map(self, data_dirs):
        create_map("Source", map_id="src")
        clone = clone_map("src", "Cloned")
        assert clone is not None
        assert clone["id"] == "cloned"
        assert clone["title"] == "Cloned"

    def test_clone_deep_copies_objects(self, data_dirs):
        create_map("With Objects", map_id="wo")
        add_object("wo", {"type": "host", "x": 1, "y": 2, "name": "h"})
        clone = clone_map("wo", "Clone With Objects")
        assert len(clone["objects"]) == 1
        # Mutating clone should not affect original
        clone["objects"][0]["name"] = "modified"
        orig = get_map("wo")
        assert orig["objects"][0]["name"] == "h"

    def test_clone_resets_parent_map(self, data_dirs):
        create_map("Parent", map_id="par")
        create_map("Child", map_id="child")
        update_map_field("child", parent_map="par")
        clone = clone_map("child", "Child Clone")
        assert clone["parent_map"] is None

    def test_clone_nonexistent_returns_none(self, data_dirs):
        assert clone_map("no-such-map", "Whatever") is None

    def test_clone_collision_avoidance(self, data_dirs):
        create_map("Original", map_id="original")
        create_map("Copy", map_id="copy")
        clone = clone_map("original", "Copy")
        assert clone["id"] == "copy-1"

    def test_clone_is_persisted(self, data_dirs):
        create_map("Persist", map_id="persist")
        clone_map("persist", "Persisted Clone")
        assert get_map("persisted-clone") is not None


# ── Object CRUD ────────────────────────────────────────────────────────────────

class TestObjectCrud:
    @pytest.fixture(autouse=True)
    def _map(self, data_dirs):
        create_map("Host Map", map_id="hmap")

    def test_add_object_generates_id(self):
        obj = add_object("hmap", {"type": "host", "x": 10, "y": 20, "name": "srv1"})
        assert "object_id" in obj
        assert obj["object_id"].startswith("host::")

    def test_add_object_persisted(self):
        add_object("hmap", {"type": "host", "x": 10, "y": 20, "name": "srv2"})
        m = get_map("hmap")
        assert len(m["objects"]) == 1

    def test_add_to_nonexistent_map_returns_none(self):
        assert add_object("ghost", {"type": "host", "x": 0, "y": 0}) is None

    def test_update_object(self):
        obj = add_object("hmap", {"type": "host", "x": 10, "y": 20, "name": "srv3"})
        oid = obj["object_id"]
        updated = update_object("hmap", oid, x=50.0, y=75.0)
        assert updated["x"] == 50.0
        assert get_map("hmap")["objects"][0]["x"] == 50.0

    def test_update_nonexistent_object_returns_none(self):
        assert update_object("hmap", "ghost::oid", x=1) is None

    def test_delete_object(self):
        obj = add_object("hmap", {"type": "host", "x": 10, "y": 20, "name": "srv4"})
        oid = obj["object_id"]
        assert delete_object("hmap", oid) is True
        assert get_map("hmap")["objects"] == []

    def test_delete_nonexistent_object_returns_false(self):
        assert delete_object("hmap", "ghost") is False

    def test_multiple_objects_independent(self):
        o1 = add_object("hmap", {"type": "host", "x": 1, "y": 1, "name": "a"})
        o2 = add_object("hmap", {"type": "host", "x": 2, "y": 2, "name": "b"})
        delete_object("hmap", o1["object_id"])
        m = get_map("hmap")
        assert len(m["objects"]) == 1
        assert m["objects"][0]["object_id"] == o2["object_id"]


# ── Kiosk-User CRUD ───────────────────────────────────────────────────────────

class TestKiosk:
    def test_create_kiosk_user(self, data_dirs):
        u = kiosk_create({"name": "Lobby", "maps": ["map-a"]})
        assert "id" in u
        assert "token" in u
        assert len(u["token"]) >= 8

    def test_list_kiosk_users(self, data_dirs):
        kiosk_create({"name": "A"})
        kiosk_create({"name": "B"})
        assert len(kiosk_list()) == 2

    def test_get_by_token(self, data_dirs):
        u = kiosk_create({"name": "TokenUser"})
        found = kiosk_get_by_token(u["token"])
        assert found is not None
        assert found["name"] == "TokenUser"

    def test_get_by_invalid_token_returns_none(self, data_dirs):
        assert kiosk_get_by_token("invalid-token-xyz") is None

    def test_update_kiosk_user(self, data_dirs):
        u = kiosk_create({"name": "Old"})
        updated = kiosk_update(u["id"], {"name": "New"})
        assert updated["name"] == "New"

    def test_delete_kiosk_user(self, data_dirs):
        u = kiosk_create({"name": "Delete Me"})
        assert kiosk_delete(u["id"]) is True
        assert kiosk_list() == []

    def test_delete_nonexistent_returns_false(self, data_dirs):
        assert kiosk_delete("ghost-id") is False
