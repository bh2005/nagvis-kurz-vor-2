"""
NagVis 2 – API Router (vollständig)
"""

import base64
import io
import re
import json
import time
import uuid
import urllib.parse
import xml.etree.ElementTree as ET
import zlib
import zipfile
import shutil
from pathlib import Path
from typing import List, Optional, Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from fastapi import Request

from core.config import settings
from core.storage import (
    list_maps, get_map, create_map, delete_map, update_map_field, clone_map,
    add_object, update_object, delete_object,
    kiosk_list, kiosk_create, kiosk_update, kiosk_delete, kiosk_get_by_token,
)
from core import livestatus
from core.audit import audit_log, read_audit
from connectors.registry import registry
from ws.manager import manager as ws_manager

api_router = APIRouter(prefix="/api/v1", tags=["api"])


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

class MapCloneRequest(BaseModel):
    title: str

class ObjectCreate(BaseModel):
    type: str
    x: float
    y: float
    name: Optional[str] = None
    host_name: Optional[str] = None
    backend_id: Optional[str] = None
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
    label_template: Optional[str] = None
    show_label: Optional[bool] = None
    size: Optional[int] = None
    iconset: Optional[str] = None
    layer: Optional[int] = None
    backend_id: Optional[str] = None
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
                                       # | "ack_host" | "ack_service" | "remove_ack" | "reschedule"
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
#  Changelog
# ══════════════════════════════════════════════════════════════════════

@api_router.get("/changelog", response_class=Response)
async def get_changelog():
    """Liefert changelog.txt (UTF-16) als UTF-8 text/plain."""
    cl_path = settings.BASE_DIR.parent / "changelog.txt"
    if cl_path.exists():
        text = cl_path.read_text(encoding="utf-16")
        return Response(content=text, media_type="text/plain; charset=utf-8")
    # Fallback: changelog.md
    md_path = settings.BASE_DIR.parent / "changelog.md"
    if md_path.exists():
        text = md_path.read_text(encoding="utf-8")
        return Response(content=text, media_type="text/plain; charset=utf-8")
    raise HTTPException(status_code=404, detail="Changelog nicht gefunden")


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
async def api_create_map(body: MapCreate, request: Request):
    data = create_map(body.title, body.map_id, body.canvas)
    audit_log(request, "map.create", map_id=data["id"], title=body.title)
    return {**data, "object_count": 0}


@api_router.get("/maps/{map_id}")
async def api_get_map(map_id: str):
    data = get_map(map_id)
    if not data:
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    return data


@api_router.delete("/maps/{map_id}")
async def api_delete_map(map_id: str, request: Request):
    m = get_map(map_id)
    if not m or not delete_map(map_id):
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    audit_log(request, "map.delete", map_id=map_id, title=m.get("title"))
    return {"deleted": map_id}


@api_router.put("/maps/{map_id}/title")
async def api_rename_map(map_id: str, body: MapTitleUpdate, request: Request):
    old = get_map(map_id)
    data = update_map_field(map_id, title=body.title)
    if not data:
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    audit_log(request, "map.rename", map_id=map_id,
              old_title=old.get("title") if old else None, new_title=body.title)
    return {"id": map_id, "title": data["title"]}


@api_router.put("/maps/{map_id}/parent")
async def api_set_parent(map_id: str, body: MapParentUpdate, request: Request):
    data = update_map_field(map_id, parent_map=body.parent_map)
    if not data:
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    audit_log(request, "map.parent_set", map_id=map_id, parent=body.parent_map)
    return {"id": map_id, "parent_map": data["parent_map"]}


@api_router.put("/maps/{map_id}/canvas")
async def api_set_canvas(map_id: str, body: dict = Body(...), request: Request = None):
    data = update_map_field(map_id, canvas=body)
    if not data:
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    audit_log(request, "map.canvas_update", map_id=map_id, mode=body.get("mode"))
    await ws_manager.broadcast(map_id, {"event": "map_reloaded", "map_id": map_id})
    return {"id": map_id, "canvas": data["canvas"]}


@api_router.post("/maps/{map_id}/clone", status_code=201)
async def api_clone_map(map_id: str, body: MapCloneRequest, request: Request):
    """Klont eine Map inkl. aller Objekte und ggf. Hintergrundbild."""
    if not get_map(map_id):
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    new_map = clone_map(map_id, body.title)
    audit_log(request, "map.clone", map_id=map_id, new_map_id=new_map["id"], title=body.title)
    return {**new_map, "object_count": len(new_map.get("objects", []))}


# ══════════════════════════════════════════════════════════════════════
#  Objects
# ══════════════════════════════════════════════════════════════════════

@api_router.post("/maps/{map_id}/objects", status_code=201)
async def api_create_object(map_id: str, body: ObjectCreate, request: Request):
    if not get_map(map_id):
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    obj = add_object(map_id, body.model_dump(exclude_none=True))
    audit_log(request, "object.create", map_id=map_id,
              object_id=obj.get("object_id"), type=body.type, name=body.name or body.host_name)
    await ws_manager.broadcast(map_id, {
        "event":  "object_added",
        "map_id": map_id,
        "object": obj,
    })
    return obj


@api_router.patch("/maps/{map_id}/objects/{object_id}/pos")
async def api_update_pos(map_id: str, object_id: str, pos: ObjectPosition, request: Request):
    obj = update_object(map_id, object_id, **pos.model_dump(exclude_none=True))
    if not obj:
        raise HTTPException(404, "Objekt nicht gefunden")
    audit_log(request, "object.move", map_id=map_id, object_id=object_id)
    await ws_manager.broadcast(map_id, {
        "event":  "object_updated",
        "map_id": map_id,
        "object": obj,
    })
    return obj


@api_router.patch("/maps/{map_id}/objects/{object_id}/props")
async def api_update_props(map_id: str, object_id: str, props: ObjectProps, request: Request):
    obj = update_object(map_id, object_id, **props.model_dump(exclude_unset=True))
    if not obj:
        raise HTTPException(404, "Objekt nicht gefunden")
    audit_log(request, "object.update", map_id=map_id, object_id=object_id)
    await ws_manager.broadcast(map_id, {
        "event":  "object_updated",
        "map_id": map_id,
        "object": obj,
    })
    return obj


@api_router.delete("/maps/{map_id}/objects/{object_id}")
async def api_delete_object(map_id: str, object_id: str, request: Request):
    if not delete_object(map_id, object_id):
        raise HTTPException(404, "Objekt nicht gefunden")
    audit_log(request, "object.delete", map_id=map_id, object_id=object_id)
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
async def api_upload_background(map_id: str, file: UploadFile = File(...), request: Request = None):
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
    audit_log(request, "map.background_upload", map_id=map_id, filename=file.filename)
    await ws_manager.broadcast(map_id, {"event": "map_reloaded", "map_id": map_id})
    return {"url": url}


@api_router.post("/maps/{map_id}/thumbnail")
async def api_upload_thumbnail(map_id: str, file: UploadFile = File(...)):
    """Speichert ein automatisch generiertes Vorschaubild (PNG) für die Map-Übersicht."""
    if not get_map(map_id):
        raise HTTPException(404, f"Map '{map_id}' nicht gefunden")
    if file.content_type not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(400, "Thumbnail muss PNG, JPEG oder WebP sein")
    content = await file.read()
    dest = settings.THUMBS_DIR / f"{map_id}.png"
    dest.write_bytes(content)
    return {"url": f"/thumbnails/{map_id}.png"}


@api_router.delete("/maps/{map_id}/thumbnail")
async def api_delete_thumbnail(map_id: str):
    """Löscht das gespeicherte Vorschaubild einer Map."""
    thumb = settings.THUMBS_DIR / f"{map_id}.png"
    if thumb.exists():
        thumb.unlink()
    return {"ok": True}


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
            bg_path = settings.BG_DIR / Path(bg_url).name
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
    request: Request = None,
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
    audit_log(request, "map.import", map_id=mid,
              title=data.get("title", mid), object_count=len(data.get("objects", [])))

    return {
        "map_id":       mid,
        "title":        data.get("title", mid),
        "object_count": len(data.get("objects", [])),
        "bg_saved":     bg_saved,
        "warnings":     errors,
    }


# ══════════════════════════════════════════════════════════════════════
#  draw.io / diagrams.net Import
# ══════════════════════════════════════════════════════════════════════

def _drawio_find_model(xml_root: ET.Element) -> ET.Element | None:
    """Findet das mxGraphModel in einem draw.io-XML – auch wenn es komprimiert ist."""
    if xml_root.tag == "mxGraphModel":
        return xml_root
    diag = xml_root.find(".//diagram")
    if diag is None:
        return None
    model = diag.find("mxGraphModel")
    if model is not None:
        return model
    # Komprimierter Inhalt: URL-Decode → Base64-Decode → raw-deflate
    text = (diag.text or "").strip()
    if not text:
        return None
    try:
        raw       = base64.b64decode(urllib.parse.unquote(text))
        xml_bytes = zlib.decompress(raw, -15)
        return ET.fromstring(xml_bytes)
    except Exception:
        return None


@api_router.post("/maps/import-drawio", status_code=201)
async def api_import_drawio(
    file:     UploadFile = File(...),
    title:    str        = Query(""),
    as_hosts: bool       = Query(False),
    request:  Request    = None,
):
    """
    Importiert eine draw.io / diagrams.net .drawio- oder .xml-Datei als neue NagVis-Map.
    Vertices → textbox (oder host wenn as_hosts=True), Edges → line.
    Koordinaten werden auf 5–95 % normalisiert.
    """
    content = await file.read()
    try:
        xml_root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise HTTPException(400, f"Ungültiges XML: {exc}")

    model = _drawio_find_model(xml_root)
    if model is None:
        raise HTTPException(400, "Kein gültiges draw.io-Diagramm gefunden (mxGraphModel nicht lesbar)")

    root_el = model.find("root")
    if root_el is None:
        raise HTTPException(400, "Kein <root>-Element im Diagramm")

    # Alle Zellen einlesen
    cells: dict[str, dict] = {}
    vertices: list[dict]   = []
    edges:    list[dict]   = []

    for cell in root_el.findall("mxCell"):
        cid    = cell.get("id", "")
        value  = cell.get("value", "")
        is_vtx = cell.get("vertex") == "1"
        is_edg = cell.get("edge")   == "1"
        source = cell.get("source", "")
        target = cell.get("target", "")

        x = y = w = h = None
        geo = cell.find("mxGeometry")
        if geo is not None:
            try:
                x = float(geo.get("x", 0) or 0)
                y = float(geo.get("y", 0) or 0)
                w = float(geo.get("width",  60) or 60)
                h = float(geo.get("height", 40) or 40)
            except (TypeError, ValueError):
                pass

        info = dict(id=cid, value=value, x=x, y=y, w=w or 60, h=h or 40,
                    source=source, target=target, is_vtx=is_vtx, is_edg=is_edg)
        cells[cid] = info

        if cid in ("0", "1"):
            continue
        if is_edg:
            edges.append(info)
        elif is_vtx and x is not None:
            vertices.append(info)

    if not vertices and not edges:
        raise HTTPException(400, "Keine Shapes oder Verbindungen im Diagramm gefunden")

    # Bounding-Box (Mittelpunkte) für Normalisierung
    cx_list = [v["x"] + v["w"] / 2 for v in vertices]
    cy_list = [v["y"] + v["h"] / 2 for v in vertices]
    for e in edges:
        for key in ("source", "target"):
            c = cells.get(e[key])
            if c and c.get("x") is not None:
                cx_list.append(c["x"] + c["w"] / 2)
                cy_list.append(c["y"] + c["h"] / 2)

    if not cx_list:
        raise HTTPException(400, "Keine verwertbaren Koordinaten gefunden")

    margin         = 5.0
    min_x, max_x   = min(cx_list), max(cx_list)
    min_y, max_y   = min(cy_list), max(cy_list)
    rx             = max_x - min_x or 1.0
    ry             = max_y - min_y or 1.0
    usable         = 100.0 - 2 * margin

    def to_px(v: float) -> float: return round(margin + (v - min_x) / rx * usable, 2)
    def to_py(v: float) -> float: return round(margin + (v - min_y) / ry * usable, 2)
    def to_pw(v: float) -> float: return max(round(v / rx * usable, 2), 2.0)
    def to_ph(v: float) -> float: return max(round(v / ry * usable, 2), 1.5)

    # Map anlegen
    raw_title = title.strip() or (
        (file.filename or "drawio-import")
        .replace(".drawio", "").replace(".xml", "")
    )
    new_map   = create_map(raw_title, canvas={"mode": "ratio", "ratio": "16:9"})
    map_id    = new_map["id"]
    warnings: list[str] = []
    obj_count = 0

    for v in vertices:
        label = v["value"] or ""
        cx    = to_px(v["x"] + v["w"] / 2)
        cy    = to_py(v["y"] + v["h"] / 2)
        if as_hosts:
            obj: dict = {"type": "host", "x": cx, "y": cy,
                         "name": label or "host", "label": label, "iconset": "std_small"}
        else:
            obj = {"type": "textbox", "x": cx, "y": cy,
                   "text": label if label else "■",
                   "w": to_pw(v["w"]), "h": to_ph(v["h"]), "font_size": 13}
        try:
            add_object(map_id, obj)
            obj_count += 1
        except Exception as exc:
            warnings.append(f"Objekt '{label}' übersprungen: {exc}")

    for e in edges:
        src = cells.get(e["source"])
        tgt = cells.get(e["target"])
        if not src or src.get("x") is None or not tgt or tgt.get("x") is None:
            warnings.append(f"Verbindung {e['id']} ohne gültige Quelle/Ziel übersprungen")
            continue
        try:
            add_object(map_id, {
                "type": "line",
                "x":  to_px(src["x"] + src["w"] / 2), "y":  to_py(src["y"] + src["h"] / 2),
                "x2": to_px(tgt["x"] + tgt["w"] / 2), "y2": to_py(tgt["y"] + tgt["h"] / 2),
                "line_style": "solid", "line_width": 2, "color": "#64748b",
            })
            obj_count += 1
        except Exception as exc:
            warnings.append(f"Verbindung {e['id']} übersprungen: {exc}")

    audit_log(request, "map.import_drawio", map_id=map_id, title=raw_title, object_count=obj_count)
    return {"map_id": map_id, "title": raw_title, "object_count": obj_count, "warnings": warnings}


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
    request: Request = None,
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
    audit_log(request, "map.migrate", map_id=mid,
              source_file=file.filename, object_count=result.get("object_count"))

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
        ok = await registry.acknowledge_host(host, comment, author)
        if not ok:
            ok = await livestatus.acknowledge_host(host, comment, author)

    elif body.action == "ack_service":
        if not svc:
            raise HTTPException(400, "service_name erforderlich")
        ok = await registry.acknowledge_service(host, svc, comment, author)
        if not ok:
            ok = await livestatus.acknowledge_service(host, svc, comment, author)

    elif body.action == "remove_ack":
        if svc:
            ok = await livestatus.remove_service_ack(host, svc)
        else:
            ok = await livestatus.remove_host_ack(host)

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
        ok = await registry.reschedule_check(host)
        if not ok:
            ok = await livestatus.reschedule_host_check(host)

    else:
        raise HTTPException(400, f"Unbekannte Aktion: {body.action}")

    if not ok:
        raise HTTPException(502, "Aktion fehlgeschlagen – Backend nicht erreichbar?")
    return {"status": "ok"}


# ══════════════════════════════════════════════════════════════════════
#  Host-Liste (für Autocomplete)
# ══════════════════════════════════════════════════════════════════════

@api_router.get("/hosts")
async def api_hosts():
    """
    Alle bekannten Hostnamen zurückgeben – wird vom Frontend für
    Datalist-Autocomplete im Properties-Dialog verwendet.
    Gibt [] zurück wenn kein Backend erreichbar oder DEMO_MODE aktiv.
    """
    if settings.DEMO_MODE:
        return []
    hosts = await registry.get_all_hosts()
    if not hosts:
        hosts = await livestatus.get_hosts()
    return [h["name"] if isinstance(h, dict) else h.name for h in hosts]


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
async def api_add_backend(body: BackendCreate, request: Request):
    entry = body.model_dump(exclude_none=True)
    try:
        backend_id = registry.add_backend(entry)
    except ValueError as e:
        raise HTTPException(400, str(e))
    audit_log(request, "backend.add", backend_id=backend_id, type=body.type)
    return registry.get_backend_info(backend_id)


@api_router.get("/backends/{backend_id}")
async def api_get_backend(backend_id: str):
    cfg = registry.get_raw_config(backend_id)
    if not cfg:
        raise HTTPException(404, f"Backend '{backend_id}' nicht gefunden")
    return cfg


@api_router.patch("/backends/{backend_id}", status_code=200)
async def api_update_backend(backend_id: str, body: BackendCreate, request: Request):
    if not registry.get_backend_info(backend_id):
        raise HTTPException(404, f"Backend '{backend_id}' nicht gefunden")
    registry.remove_backend(backend_id)
    entry = body.model_dump(exclude_none=True)
    try:
        new_id = registry.add_backend(entry)
    except ValueError as e:
        raise HTTPException(400, str(e))
    audit_log(request, "backend.update", backend_id=new_id, type=body.type)
    return registry.get_backend_info(new_id)


@api_router.delete("/backends/{backend_id}")
async def api_remove_backend(backend_id: str, request: Request):
    if not registry.remove_backend(backend_id):
        raise HTTPException(404, f"Backend '{backend_id}' nicht gefunden")
    audit_log(request, "backend.delete", backend_id=backend_id)
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
#  System-Log
# ══════════════════════════════════════════════════════════════════════

@api_router.get("/logs")
async def api_get_logs(
    lines: int  = Query(500, ge=1, le=2000, description="Anzahl der letzten Log-Zeilen"),
    level: str  = Query("", description="Filter: nur Zeilen die diesen Text enthalten (z.B. ERROR)"),
    download: bool = Query(False, description="Als Datei herunterladen"),
):
    """Gibt die letzten N In-Memory-Log-Zeilen zurück."""
    from core.logging_setup import get_log_lines
    log_lines = get_log_lines()

    if level:
        f = level.upper()
        log_lines = [l for l in log_lines if f in l.upper()]

    log_lines = log_lines[-lines:]

    if download:
        content = "\n".join(log_lines)
        return Response(
            content=content,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=nagvis2.log"},
        )

    return {"lines": log_lines, "total": len(log_lines), "buffered": len(get_log_lines())}


# ══════════════════════════════════════════════════════════════════════
#  Audit-Log
# ══════════════════════════════════════════════════════════════════════

@api_router.get("/audit")
async def api_get_audit(
    limit:  int          = Query(200, ge=1, le=2000),
    map_id: Optional[str] = Query(None, description="Filter auf eine bestimmte Map"),
    action: Optional[str] = Query(None, description="Filter auf Aktions-Typ z.B. map.create"),
    user:   Optional[str] = Query(None, description="Filter auf Benutzer"),
):
    """Gibt die letzten Audit-Log-Einträge zurück (neueste zuerst)."""
    return read_audit(limit=limit, map_id=map_id, action=action, user=user)
