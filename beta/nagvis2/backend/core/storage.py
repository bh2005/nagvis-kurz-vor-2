"""
NagVis 2 – Storage Layer
JSON-basierte Persistenz für Maps, Objekte, Kiosk-User.
"""

import json
import uuid
import re
from pathlib import Path
from typing import Any, Optional
from core.config import settings


# ══════════════════════════════════════════════════════════════════════
#  Helpers
# ══════════════════════════════════════════════════════════════════════

def _slugify(title: str) -> str:
    s = title.lower().strip()
    s = re.sub(r"[äÄ]", "ae", s)
    s = re.sub(r"[öÖ]", "oe", s)
    s = re.sub(r"[üÜ]", "ue", s)
    s = re.sub(r"[ß]",  "ss", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "map"


def _read_json(path: Path) -> Any:
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ══════════════════════════════════════════════════════════════════════
#  Maps
# ══════════════════════════════════════════════════════════════════════

def map_path(map_id: str) -> Path:
    return settings.MAPS_DIR / f"{map_id}.json"


def list_maps() -> list[dict]:
    maps = []
    for p in sorted(settings.MAPS_DIR.glob("*.json")):
        data = _read_json(p)
        if data:
            mid = data.get("id", p.stem)
            thumb_path = settings.THUMBS_DIR / f"{mid}.png"
            maps.append({
                "id":           mid,
                "title":        data.get("title", p.stem),
                "object_count": len(data.get("objects", [])),
                "parent_map":   data.get("parent_map"),
                "canvas":       data.get("canvas", {"mode": "free"}),
                "background":   data.get("background"),
                "thumbnail":    f"/thumbnails/{mid}.png" if thumb_path.exists() else None,
            })
    return maps


def get_map(map_id: str) -> Optional[dict]:
    data = _read_json(map_path(map_id))
    if not data:
        return None
    data.setdefault("objects", [])
    data.setdefault("canvas",  {"mode": "free"})
    return data


def create_map(title: str, map_id: Optional[str] = None,
               canvas: Optional[dict] = None) -> dict:
    mid = map_id or _slugify(title)
    # Eindeutigkeit sicherstellen
    base, n = mid, 1
    while map_path(mid).exists():
        mid = f"{base}-{n}"; n += 1

    data = {
        "id":         mid,
        "title":      title,
        "canvas":     canvas or {"mode": "free"},
        "background": None,
        "parent_map": None,
        "objects":    [],
    }
    _write_json(map_path(mid), data)
    return data


def save_map(data: dict):
    _write_json(map_path(data["id"]), data)


def delete_map(map_id: str) -> bool:
    p = map_path(map_id)
    if p.exists():
        p.unlink()
        # Hintergrundbild löschen falls vorhanden
        for ext in ("png", "jpg", "jpeg", "gif", "webp", "svg"):
            bg = settings.BG_DIR / f"{map_id}.{ext}"
            if bg.exists():
                bg.unlink()
        # Thumbnail löschen falls vorhanden
        thumb = settings.THUMBS_DIR / f"{map_id}.png"
        if thumb.exists():
            thumb.unlink()
        return True
    return False


def update_map_field(map_id: str, **fields) -> Optional[dict]:
    data = get_map(map_id)
    if not data:
        return None
    data.update(fields)
    save_map(data)
    return data


# ══════════════════════════════════════════════════════════════════════
#  Objects
# ══════════════════════════════════════════════════════════════════════

def _gen_oid(obj: dict) -> str:
    t    = obj.get("type", "obj")
    name = obj.get("name") or obj.get("text", "")[:12] or uuid.uuid4().hex[:6]
    uid  = uuid.uuid4().hex[:6]
    return f"{t}::{name}::{uid}"


def add_object(map_id: str, obj: dict) -> Optional[dict]:
    data = get_map(map_id)
    if not data:
        return None
    obj["object_id"] = obj.get("object_id") or _gen_oid(obj)
    data["objects"].append(obj)
    save_map(data)
    return obj


def update_object(map_id: str, object_id: str, **fields) -> Optional[dict]:
    data = get_map(map_id)
    if not data:
        return None
    for obj in data["objects"]:
        if obj.get("object_id") == object_id:
            obj.update(fields)
            save_map(data)
            return obj
    return None


def delete_object(map_id: str, object_id: str) -> bool:
    data = get_map(map_id)
    if not data:
        return False
    before = len(data["objects"])
    data["objects"] = [o for o in data["objects"]
                       if o.get("object_id") != object_id]
    if len(data["objects"]) < before:
        save_map(data)
        return True
    return False


# ══════════════════════════════════════════════════════════════════════
#  Kiosk-User
# ══════════════════════════════════════════════════════════════════════

KIOSK_FILE = settings.DATA_DIR / "kiosk_users.json"


def _kiosk_read() -> list[dict]:
    return _read_json(KIOSK_FILE) or []


def _kiosk_write(users: list[dict]):
    _write_json(KIOSK_FILE, users)


def kiosk_list() -> list[dict]:
    return _kiosk_read()


def kiosk_get_by_token(token: str) -> Optional[dict]:
    return next((u for u in _kiosk_read() if u.get("token") == token), None)


def kiosk_create(user: dict) -> dict:
    users = _kiosk_read()
    user.setdefault("id",    uuid.uuid4().hex[:8])
    user.setdefault("token", uuid.uuid4().hex[:24])
    users.append(user)
    _kiosk_write(users)
    return user


def kiosk_update(uid: str, fields: dict) -> Optional[dict]:
    users = _kiosk_read()
    for u in users:
        if u.get("id") == uid:
            u.update(fields)
            _kiosk_write(users)
            return u
    return None


def kiosk_delete(uid: str) -> bool:
    users = _kiosk_read()
    new   = [u for u in users if u.get("id") != uid]
    if len(new) < len(users):
        _kiosk_write(new)
        return True
    return False