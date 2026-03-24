"""
core/map_store.py
=================
Verwaltet Map-Konfigurationen: Hintergrundbild + Objekt-Positionen.

Speicherformat: JSON-Dateien unter data/maps/<map_id>.json

Map-Config-Schema:
{
  "id":         "datacenter-a",
  "title":      "Datacenter A",
  "background": "backgrounds/datacenter-a.jpg",
  "objects": [
    ── Monitoring-Objekte (haben Live-Status aus Livestatus) ──
    { "object_id": "host::srv-web-01::ab12",
      "type": "host",  "name": "srv-web-01",
      "iconset": "server",  "x": 42.5, "y": 31.2,  "label": "Web Server 01" },

    { "object_id": "service::srv-db-01::CPU Load::cd34",
      "type": "service",  "name": "CPU Load",  "host_name": "srv-db-01",
      "iconset": "default",  "x": 55.0, "y": 40.0,  "label": "DB CPU" },

    { "object_id": "hostgroup::linux-servers::ef56",
      "type": "hostgroup",  "name": "linux-servers",
      "iconset": "server",  "x": 20.0, "y": 60.0,  "label": "Linux Server" },

    { "object_id": "servicegroup::http-checks::gh78",
      "type": "servicegroup",  "name": "http-checks",
      "iconset": "default",  "x": 30.0, "y": 70.0,  "label": "HTTP Checks" },

    { "object_id": "map::datacenter-b::ij90",
      "type": "map",  "name": "datacenter-b",
      "iconset": "map",  "x": 80.0, "y": 50.0,  "label": "Datacenter B" },

    ── Statuslose Elemente (keine Livestatus-Quelle) ──
    { "object_id": "textbox::kl12",
      "type": "textbox",  "text": "Netzwerk-Zone A",
      "x": 5.0, "y": 5.0,  "w": 15.0, "h": 4.0,
      "font_size": 13,  "bold": true,
      "color": "#e0e0e0",  "bg_color": "",  "border_color": "" },

    { "object_id": "line::mn34",
      "type": "line",
      "x": 10.0, "y": 20.0,  "x2": 90.0, "y2": 20.0,
      "line_style": "solid",   "line_width": 1,
      "color": "#444444" },

    { "object_id": "container::op56",
      "type": "container",  "url": "/backgrounds/logo.svg",
      "x": 5.0, "y": 85.0,  "w": 10.0, "h": 8.0 }
  ]
}

Objekttypen:
  Monitoring:  host | service | hostgroup | servicegroup | map
  Statuslos:   textbox | line | container
"""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path

log = logging.getLogger("nagvis.map_store")

DATA_DIR = Path("data/maps")
BG_DIR   = Path("data/backgrounds")

# Alle gültigen Objekttypen
MONITORING_TYPES = {"host", "service", "hostgroup", "servicegroup", "map"}
STATIC_TYPES     = {"textbox", "line", "container"}
ALL_TYPES        = MONITORING_TYPES | STATIC_TYPES


class MapStore:
    """CRUD für Map-Konfigurationen."""

    def __init__(self, data_dir: Path = DATA_DIR):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        BG_DIR.mkdir(parents=True, exist_ok=True)

    # ── Hilfsmethoden ────────────────────────────────────────

    def _path(self, map_id: str) -> Path:
        safe_id = "".join(c for c in map_id if c.isalnum() or c in "-_")
        return self.data_dir / f"{safe_id}.json"

    def _load(self, map_id: str) -> dict | None:
        p = self._path(map_id)
        if not p.exists():
            return None
        try:
            return json.loads(p.read_text())
        except Exception as e:
            log.error("Failed to load map '%s': %s", map_id, e)
            return None

    def _save(self, map_cfg: dict) -> bool:
        p = self._path(map_cfg["id"])
        try:
            p.write_text(json.dumps(map_cfg, indent=2, ensure_ascii=False))
            return True
        except Exception as e:
            log.error("Failed to save map '%s': %s", map_cfg["id"], e)
            return False

    def _make_id(self, obj_type: str, name: str = "") -> str:
        slug = name.replace("::", "-").replace(" ", "-")[:24] if name else ""
        suffix = uuid.uuid4().hex[:8]
        return f"{obj_type}::{slug}::{suffix}" if slug else f"{obj_type}::{suffix}"

    # ── CRUD ─────────────────────────────────────────────────

    def list_maps(self) -> list[dict]:
        result = []
        for p in sorted(self.data_dir.glob("*.json")):
            try:
                cfg = json.loads(p.read_text())
                result.append({
                    "id":           cfg.get("id", p.stem),
                    "title":        cfg.get("title", p.stem),
                    "background":   cfg.get("background", ""),
                    "object_count": len(cfg.get("objects", [])),
                })
            except Exception:
                pass
        return result

    def get_map(self, map_id: str) -> dict | None:
        return self._load(map_id)

    def create_map(self, title: str, map_id: str = "") -> dict:
        if not map_id:
            map_id = title.lower().replace(" ", "-")[:32]
        cfg = {"id": map_id, "title": title, "background": "", "objects": []}
        self._save(cfg)
        log.info("Map created: %s", map_id)
        return cfg

    def delete_map(self, map_id: str) -> bool:
        p = self._path(map_id)
        if p.exists():
            p.unlink()
            return True
        return False

    def set_background(self, map_id: str, filename: str) -> bool:
        cfg = self._load(map_id)
        if cfg is None:
            return False
        cfg["background"] = f"backgrounds/{filename}"
        return self._save(cfg)

    # ── Objekte hinzufügen ───────────────────────────────────

    def add_object(self, map_id: str, props: dict) -> dict | None:
        """
        Fügt ein Objekt beliebigen Typs zur Map hinzu.
        `props` enthält alle Felder je nach Typ (siehe Docstring oben).
        Pflichtfeld: type, x, y
        """
        cfg = self._load(map_id)
        if cfg is None:
            return None

        obj_type = props.get("type", "host")
        if obj_type not in ALL_TYPES:
            log.warning("Unknown object type '%s'", obj_type)
            return None

        # Basis-Felder
        obj: dict = {
            "object_id": self._make_id(obj_type, props.get("name", "")),
            "type":      obj_type,
            "x":         round(float(props.get("x", 50)), 3),
            "y":         round(float(props.get("y", 50)), 3),
        }

        # Typ-spezifische Felder
        if obj_type in MONITORING_TYPES:
            obj["name"]    = props.get("name", "")
            obj["iconset"] = props.get("iconset", "default")
            obj["label"]   = props.get("label") or props.get("name", "")
            if obj_type == "service":
                obj["host_name"] = props.get("host_name", "")

        elif obj_type == "textbox":
            obj["text"]         = props.get("text", "Text")
            obj["w"]            = round(float(props.get("w", 12)), 3)
            obj["h"]            = round(float(props.get("h", 4)),  3)
            obj["font_size"]    = int(props.get("font_size", 13))
            obj["bold"]         = bool(props.get("bold", False))
            obj["color"]        = props.get("color",        "var(--text)")
            obj["bg_color"]     = props.get("bg_color",     "")
            obj["border_color"] = props.get("border_color", "")

        elif obj_type == "line":
            obj["x2"]         = round(float(props.get("x2", obj["x"] + 20)), 3)
            obj["y2"]         = round(float(props.get("y2", obj["y"])),       3)
            obj["line_style"] = props.get("line_style", "solid")   # solid|dashed|dotted
            obj["line_width"] = int(props.get("line_width", 1))
            obj["color"]      = props.get("color", "var(--border-hi)")

        elif obj_type == "container":
            obj["url"] = props.get("url", "")
            obj["w"]   = round(float(props.get("w", 10)), 3)
            obj["h"]   = round(float(props.get("h", 8)),  3)

        cfg["objects"].append(obj)
        self._save(cfg)
        return obj

    # ── Position & Größe ────────────────────────────────────

    def update_object_position(self, map_id: str, object_id: str,
                                x: float, y: float) -> bool:
        cfg = self._load(map_id)
        if cfg is None:
            return False
        for obj in cfg["objects"]:
            if obj["object_id"] == object_id:
                obj["x"] = round(x, 3)
                obj["y"] = round(y, 3)
                self._save(cfg)
                return True
        return False

    def update_object_size(self, map_id: str, object_id: str,
                           w: float, h: float) -> bool:
        """Größe ändern (nur für textbox / container)."""
        cfg = self._load(map_id)
        if cfg is None:
            return False
        for obj in cfg["objects"]:
            if obj["object_id"] == object_id:
                obj["w"] = round(w, 3)
                obj["h"] = round(h, 3)
                self._save(cfg)
                return True
        return False

    def update_object_props(self, map_id: str, object_id: str,
                            props: dict) -> dict | None:
        """Beliebige Felder eines Objekts aktualisieren."""
        cfg = self._load(map_id)
        if cfg is None:
            return None
        protected = {"object_id", "type"}
        for obj in cfg["objects"]:
            if obj["object_id"] == object_id:
                for k, v in props.items():
                    if k not in protected:
                        obj[k] = v
                self._save(cfg)
                return obj
        return None

    # ── Entfernen ───────────────────────────────────────────

    def remove_object(self, map_id: str, object_id: str) -> bool:
        cfg = self._load(map_id)
        if cfg is None:
            return False
        before = len(cfg["objects"])
        cfg["objects"] = [o for o in cfg["objects"] if o["object_id"] != object_id]
        if len(cfg["objects"]) < before:
            self._save(cfg)
            return True
        return False

    def update_map_title(self, map_id: str, title: str) -> bool:
        cfg = self._load(map_id)
        if cfg is None:
            return False
        cfg["title"] = title
        return self._save(cfg)