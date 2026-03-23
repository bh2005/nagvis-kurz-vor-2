"""
NagVis 2 – API Router (vollständig)
"""

import io
import re
import json
import time
import uuid
import zipfile
import shutil
from pathlib import Path
from typing import List, Optional, Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.config import settings
from core.storage import (
    list_maps, get_map, create_map, delete_map, update_map_field,
    add_object, update_object, delete_object,
    kiosk_list, kiosk_create, kiosk_update, kiosk_delete, kiosk_get_by_token,
)
from core import livestatus
from connectors.registry import registry
from ws.manager import manager as ws_manager

api_router = APIRouter(prefix="/api", tags=["api"])


# ══════════════════════════════════════════════════════════════════════
#  Pydantic Models
# ══════════════════════════════════════════════════════════════════════

class MapCreate(BaseModel):
    title: str
    map_id: Optional[str] = None
    canvas: Optional[dict] = None

class MapTitleUpdate(BaseModel):
    title: str

class MapParentUpdate(BaseModel):
    parent_map: Optional[str] = None

class ObjectCreate(BaseModel):
    type: str
    x: float
    y: float
    name: Optional[str] = None
    host_name: Optional[str] = None
    iconset: Optional[str] = "std_small"
    label: Optional[str] = None
    size: Optional[int] = None
    text: Optional[str] = None
    font_size: Optional[int] = None
    bold: Optional[bool] = None
    color: Optional[str] = None
    bg_color: Optional[str] = None
    url: Optional[str] = None
    x2: Optional[float] = None
    y2: Optional[float] = None
    line_style: Optional[str] = None
    line_width: Optional[int] = None
    line_type: Optional[str] = None
    layer: Optional[int] = None
    gadget_config: Optional[dict] = None

class ObjectPosition(BaseModel):
    x: float
    y: float
    x2: Optional[float] = None
    y2: Optional[float] = None

class ObjectProps(BaseModel):
    label: Optional[str] = None
    show_label: Optional[bool] = None
    size: Optional[int] = None
    iconset: Optional[str] = None
    layer: Optional[int] = None
    gadget_config: Optional[dict] = None
    text: Optional[str] = None
    font_size: Optional[int] = None
    bold: Optional[bool] = None
    color: Optional[str] = None
    bg_color: Optional[str] = None
    line_style: Optional[str] = None
    line_width: Optional[int] = None
    line_type: Optional[str] = None
    host_from: Optional[str] = None
    host_to: Optional[str] = None
    label_from: Optional[str] = None
    label_to: Optional[str] = None
    show_arrow: Optional[bool] = None
    line_split: Optional[bool] = None
    x2: Optional[float] = None
    y2: Optional[float] = None

class ActionRequest(BaseModel):
    action: str                        # "downtime_host" | "downtime_service" | "schedule_downtime"
                                       # | "ack_host" | "ack_service" | "reschedule"
    # Canonical field names
    host_name:    str      = ""
    service_name: Optional[str] = None
    start_time:   Optional[int] = None
    end_time:     Optional[int] = None
    # Frontend-Aliases (ältere Aufrufe)
    hostname:     Optional[str] = None
    service:      Optional[str] = None
    start:        Optional[int] = None
    end:          Optional[int] = None
    # Gemeinsam
    comment:     Optional[str] = "NagVis 2"
    author:      Optional[str] = "nagvis2"
    child_hosts: bool = False
    type:        Optional[str] = None  # "host" | "service" – von Frontend mitgeschickt

    @property
    def eff_host(self) -> str:
        return self.host_name or self.hostname or ""

    @property
    def eff_service(self) -> Optional[str]:
        return self.service_name or self.service

    @property
    def eff_start(self) -> Optional[int]:
        return self.start_time or self.start

    @property
    def eff_end(self) -> Optional[int]:
        return self.end_time or self.end

class BackendCreate(BaseModel):
    backend_id:  str
    type:        str            # "livestatus_tcp" | "livestatus_unix" | "checkmk"
    # Livestatus TCP
    host:        Optional[str]  = None
    port:        Optional[int]  = None
    # Livestatus Unix
    socket_path: Optional[str]  = None
    # Checkmk REST API
    base_url:    Optional[str]  = None
    username:    Optional[str]  = None
    secret:      Optional[str]  = None
    verify_ssl:  Optional[bool] = True
    # Gemeinsam
    timeout:     Optional[float] = None
    enabled:     bool = True

class BackendEnabledUpdate(BaseModel):
    enabled: bool

class KioskUser(BaseModel):
    label: str
    maps: List[str] = []
    order: List[str] = []
    interval: int = 30

class KioskUserUpdate(BaseModel):
    label: Optional[str] = None
    maps: Optional[List[str]] = None
    order: Optional[List[str]] = None
    interval: Optional[int] = None


# ══════════════════════════════════════════════════════════════════════
#  Health
# ══════════════════════════════════════════════════════════════════════

@api_router.get("/health")
async def health():
    ls = await livestatus.check_connection()
    backends = registry.list_backends()
    backend_health = await registry.health()
    health_by_id = {b["backend_id"]: b for b in backend_health}
    backends_with_status = [
        {**b, "reachable": health_by_id.get(b["backend_id"], {}).get("reachable", False)}
        for b in backends
    ]
    return {
        "status":      "ok",
        "environment": settings.ENVIRONMENT,
        "demo_mode":   settings.DEMO_MODE or (not ls["connected"] and not backends),
        "livestatus":  ls,
        "backends":    backends_with_status,
        "version":     "2.0-beta",
    }


# ══════════════════════════════════════════════════════════════════════
#  Maps – CRUD
# ══════════════════════════════════════════════════════════════════════

@api_router.get("/maps")
async def api_list_maps():
    return list_maps()


@api_router.post("/maps", status_code=201)
async def api_create_map(body: MapCreate):
    data = create_map(body.title, body.map_id, body.canvas)
    return {**data, "object_count": 0}


@api_router.get("/maps/{map_id}")
async def api_get_map(map_id: str):
    data = get_map(map_id)
    if not data:
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    return data


@api_router.delete("/maps/{map_id}")
async def api_delete_map(map_id: str):
    if not delete_map(map_id):
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    return {"deleted": map_id}


@api_router.put("/maps/{map_id}/title")
async def api_rename_map(map_id: str, body: MapTitleUpdate):
    data = update_map_field(map_id, title=body.title)
    if not data:
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    return {"id": map_id, "title": data["title"]}


@api_router.put("/maps/{map_id}/parent")
async def api_set_parent(map_id: str, body: MapParentUpdate):
    data = update_map_field(map_id, parent_map=body.parent_map)
    if not data:
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    return {"id": map_id, "parent_map": data["parent_map"]}


@api_router.put("/maps/{map_id}/canvas")
async def api_set_canvas(map_id: str, body: dict = Body(...)):
    data = update_map_field(map_id, canvas=body)
    if not data:
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    await ws_manager.broadcast(map_id, {"event": "map_reloaded", "map_id": map_id})
    return {"id": map_id, "canvas": data["canvas"]}


# ══════════════════════════════════════════════════════════════════════
#  Objects
# ══════════════════════════════════════════════════════════════════════

@api_router.post("/maps/{map_id}/objects", status_code=201)
async def api_create_object(map_id: str, body: ObjectCreate):
    if not get_map(map_id):
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    obj = add_object(map_id, body.model_dump(exclude_none=True))
    await ws_manager.broadcast(map_id, {
        "event":  "object_added",
        "map_id": map_id,
        "object": obj,
    })
    return obj


@api_router.patch("/maps/{map_id}/objects/{object_id}/pos")
async def api_update_pos(map_id: str, object_id: str, pos: ObjectPosition):
    obj = update_object(map_id, object_id, **pos.model_dump(exclude_none=True))
    if not obj:
        raise HTTPException(404, "Objekt nicht gefunden")
    await ws_manager.broadcast(map_id, {
        "event":  "object_updated",
        "map_id": map_id,
        "object": obj,
    })
    return obj


@api_router.patch("/maps/{map_id}/objects/{object_id}/props")
async def api_update_props(map_id: str, object_id: str, props: ObjectProps):
    obj = update_object(map_id, object_id, **props.model_dump(exclude_unset=True))
    if not obj:
        raise HTTPException(404, "Objekt nicht gefunden")
    await ws_manager.broadcast(map_id, {
        "event":  "object_updated",
        "map_id": map_id,
        "object": obj,
    })
    return obj


@api_router.delete("/maps/{map_id}/objects/{object_id}")
async def api_delete_object(map_id: str, object_id: str):
    if not delete_object(map_id, object_id):
        raise HTTPException(404, "Objekt nicht gefunden")
    await ws_manager.broadcast(map_id, {
        "event":     "object_removed",
        "map_id":    map_id,
        "object_id": object_id,
    })
    return {"deleted": object_id}


# ══════════════════════════════════════════════════════════════════════
#  Hintergrundbild
# ══════════════════════════════════════════════════════════════════════

ALLOWED_BG_TYPES = {
    "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif",
    "image/webp": "webp", "image/svg+xml": "svg",
}

@api_router.post("/maps/{map_id}/background")
async def api_upload_background(map_id: str, file: UploadFile = File(...)):
    if not get_map(map_id):
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")

    ext = ALLOWED_BG_TYPES.get(file.content_type)
    if not ext:
        # Fallback: Dateiendung
        suf = Path(file.filename or "").suffix.lower().lstrip(".")
        ext = suf if suf in ("png","jpg","jpeg","gif","webp","svg") else None
    if not ext:
        raise HTTPException(400, "Nicht unterstützter Bildtyp")

    # Alte Hintergrundbilder dieser Map löschen
    for old in settings.BG_DIR.glob(f"{map_id}.*"):
        old.unlink()

    dest = settings.BG_DIR / f"{map_id}.{ext}"
    content = await file.read()
    dest.write_bytes(content)

    url = f"/backgrounds/{map_id}.{ext}"
    update_map_field(map_id, background=url)
    await ws_manager.broadcast(map_id, {"event": "map_reloaded", "map_id": map_id})
    return {"url": url}


# ══════════════════════════════════════════════════════════════════════
#  Export / Import
# ══════════════════════════════════════════════════════════════════════

@api_router.get("/maps/{map_id}/export")
async def api_export_map(map_id: str):
    data = get_map(map_id)
    if not data:
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("map.json", json.dumps(data, indent=2, ensure_ascii=False))
        # Hintergrundbild falls vorhanden
        bg_url = data.get("background")
        if bg_url:
            bg_path = settings.BASE_DIR / bg_url.lstrip("/")
            if bg_path.exists():
                zf.write(bg_path, f"background{bg_path.suffix}")

    buf.seek(0)
    filename = f"nagvis2-{map_id}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/maps/import")
async def api_import_map(
    file: UploadFile = File(...),
    map_id: Optional[str] = Query(None),
    dry_run: bool = Query(False),
):
    content = await file.read()
    errors = []

    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            names = zf.namelist()
            if "map.json" not in names:
                raise HTTPException(400, {"errors": ["map.json fehlt im Archiv"]})
            data = json.loads(zf.read("map.json"))
    except zipfile.BadZipFile:
        raise HTTPException(400, {"errors": ["Keine gültige ZIP-Datei"]})

    mid = map_id or data.get("id") or "imported-map"
    data["id"] = mid

    bg_saved = False
    bg_file  = next((n for n in names if n.startswith("background.")), None)

    if dry_run:
        return {
            "map_id":       mid,
            "title":        data.get("title", mid),
            "object_count": len(data.get("objects", [])),
            "bg_saved":     bool(bg_file),
            "warnings":     errors,
            "dry_run":      True,
        }

    # Hintergrundbild speichern
    if bg_file:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            ext  = Path(bg_file).suffix
            dest = settings.BG_DIR / f"{mid}{ext}"
            dest.write_bytes(zf.read(bg_file))
            data["background"] = f"/backgrounds/{mid}{ext}"
            bg_saved = True

    from core.storage import _write_json, map_path
    _write_json(map_path(mid), data)

    return {
        "map_id":       mid,
        "title":        data.get("title", mid),
        "object_count": len(data.get("objects", [])),
        "bg_saved":     bg_saved,
        "warnings":     errors,
    }


# ══════════════════════════════════════════════════════════════════════
#  NagVis 1 Migration
# ══════════════════════════════════════════════════════════════════════

@api_router.post("/migrate")
async def api_migrate(
    file: UploadFile = File(...),
    map_id: Optional[str] = Query(None),
    canvas_w: int = Query(1200),
    canvas_h: int = Query(800),
    dry_run: bool = Query(False),
):
    raw = (await file.read()).decode("utf-8", errors="replace")
    mid = map_id or Path(file.filename or "map").stem.lower().replace(" ", "-")

    from core.migrate import migrate_cfg
    result = migrate_cfg(raw, mid, canvas_w, canvas_h)
    warnings = result.pop("warnings", [])

    if dry_run:
        return {**result, "warnings": warnings, "dry_run": True}

    from core.storage import _write_json, map_path
    _write_json(map_path(mid), {k: v for k, v in result.items() if k != "object_count"})

    return {**result, "warnings": warnings}


# ══════════════════════════════════════════════════════════════════════
#  Aktionen (ACK / Downtime / Reschedule)
# ══════════════════════════════════════════════════════════════════════

@api_router.post("/actions")
async def api_action(body: ActionRequest):
    if settings.DEMO_MODE:
        return {"status": "ok", "demo": True}

    ok  = False
    now = int(time.time())
    host    = body.eff_host
    svc     = body.eff_service
    comment = body.comment or "NagVis 2"
    author  = body.author  or "nagvis2"

    if not host:
        raise HTTPException(400, "host_name fehlt")

    if body.action == "ack_host":
        ok = await livestatus.acknowledge_host(host, comment, author)

    elif body.action == "ack_service":
        if not svc:
            raise HTTPException(400, "service_name erforderlich")
        ok = await livestatus.acknowledge_service(host, svc, comment, author)

    elif body.action in ("downtime_host", "schedule_downtime") and not svc and body.type != "service":
        # Host-Downtime (auch via Registry für Checkmk-Backends)
        start = body.eff_start or now
        end   = body.eff_end   or (now + 3600)
        ok = await registry.schedule_downtime(
            host, start, end, comment, author,
            service_name=None, child_hosts=body.child_hosts,
        )
        if not ok:
            # Fallback auf direkten Livestatus
            ok = await livestatus.schedule_host_downtime(host, start, end, comment, author)

    elif body.action in ("downtime_service", "schedule_downtime") and (svc or body.type == "service"):
        if not svc:
            raise HTTPException(400, "service_name erforderlich für Service-Downtime")
        start = body.eff_start or now
        end   = body.eff_end   or (now + 3600)
        ok = await registry.schedule_downtime(
            host, start, end, comment, author, service_name=svc,
        )
        if not ok:
            ok = await livestatus.schedule_service_downtime(host, svc, start, end, comment, author)

    elif body.action == "reschedule":
        ok = await livestatus.reschedule_host_check(host)

    else:
        raise HTTPException(400, f"Unbekannte Aktion: {body.action}")

    if not ok:
        raise HTTPException(502, "Aktion fehlgeschlagen – Backend nicht erreichbar?")
    return {"status": "ok"}


# ══════════════════════════════════════════════════════════════════════
#  Hostgruppen
# ══════════════════════════════════════════════════════════════════════

@api_router.get("/hostgroups")
async def api_hostgroups():
    """
    Alle Hostgruppen mit Mitgliederliste.
    Gibt [] zurück wenn kein Backend erreichbar oder DEMO_MODE aktiv.
    """
    if settings.DEMO_MODE:
        return []
    # Registry zuerst (Checkmk + Livestatus), Fallback auf direkten Livestatus
    result = await registry.get_all_hostgroups()
    if not result:
        result = await livestatus.get_hostgroups()
    return result


# ══════════════════════════════════════════════════════════════════════
#  Kiosk-User
# ══════════════════════════════════════════════════════════════════════

@api_router.get("/kiosk-users")
async def api_kiosk_list():
    return kiosk_list()


@api_router.post("/kiosk-users", status_code=201)
async def api_kiosk_create(body: KioskUser):
    user = kiosk_create(body.model_dump())
    return user


@api_router.put("/kiosk-users/{uid}")
async def api_kiosk_update(uid: str, body: KioskUserUpdate):
    user = kiosk_update(uid, body.model_dump(exclude_unset=True))
    if not user:
        raise HTTPException(404, f"Kiosk-User '{uid}' nicht gefunden")
    return user


@api_router.delete("/kiosk-users/{uid}")
async def api_kiosk_delete(uid: str):
    if not kiosk_delete(uid):
        raise HTTPException(404, f"Kiosk-User '{uid}' nicht gefunden")
    return {"deleted": uid}


# ══════════════════════════════════════════════════════════════════════
#  Backends (Livestatus / Checkmk)
# ══════════════════════════════════════════════════════════════════════

@api_router.get("/backends")
async def api_list_backends():
    return registry.list_backends()


@api_router.post("/backends/probe")
async def api_probe_backend(body: BackendCreate):
    """Testet eine Backend-Verbindung ohne sie zu persistieren."""
    entry = body.model_dump(exclude_none=True)
    result = await registry.probe(entry)
    return {
        "backend_id": result.backend_id,
        "reachable":  result.reachable,
        "latency_ms": result.latency_ms,
        "error":      result.error,
    }


@api_router.post("/backends", status_code=201)
async def api_add_backend(body: BackendCreate):
    entry = body.model_dump(exclude_none=True)
    try:
        backend_id = registry.add_backend(entry)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return registry.get_backend_info(backend_id)


@api_router.get("/backends/{backend_id}")
async def api_get_backend(backend_id: str):
    cfg = registry.get_raw_config(backend_id)
    if not cfg:
        raise HTTPException(404, f"Backend '{backend_id}' nicht gefunden")
    return cfg


@api_router.patch("/backends/{backend_id}", status_code=200)
async def api_update_backend(backend_id: str, body: BackendCreate):
    if not registry.get_backend_info(backend_id):
        raise HTTPException(404, f"Backend '{backend_id}' nicht gefunden")
    registry.remove_backend(backend_id)
    entry = body.model_dump(exclude_none=True)
    try:
        new_id = registry.add_backend(entry)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return registry.get_backend_info(new_id)


@api_router.delete("/backends/{backend_id}")
async def api_remove_backend(backend_id: str):
    if not registry.remove_backend(backend_id):
        raise HTTPException(404, f"Backend '{backend_id}' nicht gefunden")
    return {"deleted": backend_id}


@api_router.put("/backends/{backend_id}/enabled", status_code=200)
async def api_toggle_backend(backend_id: str, body: BackendEnabledUpdate):
    """Aktiviert oder deaktiviert ein Backend ohne es zu entfernen."""
    ok = registry.toggle_backend(backend_id, body.enabled)
    if not ok:
        raise HTTPException(404, f"Backend '{backend_id}' nicht gefunden")
    return {"backend_id": backend_id, "enabled": body.enabled}


@api_router.post("/backends/{backend_id}/test")
async def api_test_backend(backend_id: str):
    info = registry.get_backend_info(backend_id)
    if not info:
        raise HTTPException(404, f"Backend '{backend_id}' nicht gefunden")
    results = await registry.health()
    for r in results:
        if r["backend_id"] == backend_id:
            return r
    raise HTTPException(500, "Kein Health-Ergebnis")


@api_router.get("/kiosk-users/resolve")
async def api_kiosk_resolve(token: str = Query(...)):
    user = kiosk_get_by_token(token)
    if not user:
        raise HTTPException(404, "Ungültiger Kiosk-Token")
    return user


# ══════════════════════════════════════════════════════════════════════
#  System-Logs
# ══════════════════════════════════════════════════════════════════════

_NGINX_PATHS = {
    "nginx_access": [
        "/var/log/nginx/access.log",
        "/var/log/nginx/nagvis2-access.log",
    ],
    "nginx_error": [
        "/var/log/nginx/error.log",
        "/var/log/nginx/nagvis2-error.log",
    ],
}


def _tail_file(path: str, lines: int) -> list[str]:
    """Letzte N Zeilen einer Datei lesen (effizient via seek)."""
    p = Path(path)
    if not p.exists():
        return []
    try:
        with open(p, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            buf  = min(size, lines * 200)
            f.seek(max(0, size - buf))
            raw  = f.read().decode("utf-8", errors="replace")
        all_lines = raw.splitlines()
        return all_lines[-lines:]
    except Exception as e:
        return [f"[Lesefehler: {e}]"]


@api_router.get("/logs")
async def api_logs(
    source: str = Query("app", description="app | nginx_access | nginx_error"),
    lines:  int = Query(200, ge=10, le=2000),
):
    if source == "app":
        log_path = str(settings.DATA_DIR / "nagvis2.log")
        result   = _tail_file(log_path, lines)
        return {"source": source, "path": log_path, "lines": result}

    if source in _NGINX_PATHS:
        for candidate in _NGINX_PATHS[source]:
            content = _tail_file(candidate, lines)
            if content:
                return {"source": source, "path": candidate, "lines": content}
        return {"source": source, "path": None, "lines": ["[Nginx-Log nicht gefunden]"]}

    raise HTTPException(400, f"Unbekannte Log-Quelle: {source}")