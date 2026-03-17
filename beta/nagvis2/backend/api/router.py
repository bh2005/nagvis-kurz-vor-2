"""
NagVis 2 – API Router (FastAPI)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

from core.config import settings

# =============================================
# Router
# =============================================
api_router = APIRouter(prefix="/api", tags=["api"])


# =============================================
# Pydantic Models (Beispiele)
# =============================================
class MapCreate(BaseModel):
    title: str
    map_id: Optional[str] = None
    canvas: Optional[dict] = None

class MapResponse(BaseModel):
    id: str
    title: str
    object_count: int
    parent_map: Optional[str] = None
    canvas: dict

class ObjectPosition(BaseModel):
    x: float
    y: float
    x2: Optional[float] = None
    y2: Optional[float] = None

class ObjectProps(BaseModel):
    label: Optional[str] = None
    size: Optional[int] = None
    iconset: Optional[str] = None
    layer: Optional[int] = None
    gadget_config: Optional[dict] = None


# =============================================
# Endpoints – Maps
# =============================================
@api_router.get("/maps", response_model=List[MapResponse])
async def list_maps():
    """Alle Maps auflisten"""
    # TODO: später echte DB/JSON-Dateien
    return [
        {"id": "demo-features", "title": "Feature Demo", "object_count": 14, "parent_map": None, "canvas": {"mode": "ratio"}}
    ]


@api_router.post("/maps", response_model=MapResponse)
async def create_map(map_data: MapCreate):
    """Neue Map anlegen"""
    map_id = map_data.map_id or map_data.title.lower().replace(" ", "-")
    # TODO: echte Speicherung
    return {
        "id": map_id,
        "title": map_data.title,
        "object_count": 0,
        "parent_map": None,
        "canvas": map_data.canvas or {"mode": "free"}
    }


@api_router.get("/maps/{map_id}", response_model=MapResponse)
async def get_map(map_id: str):
    """Einzelne Map laden"""
    if map_id == "demo-features":
        return {
            "id": map_id,
            "title": "Feature Demo",
            "object_count": 14,
            "parent_map": None,
            "canvas": {"mode": "ratio", "ratio": "16:9"}
        }
    raise HTTPException(status_code=404, detail="Map not found")


@api_router.delete("/maps/{map_id}")
async def delete_map(map_id: str):
    """Map löschen"""
    # TODO: echte Löschlogik
    return {"message": f"Map {map_id} gelöscht"}


# =============================================
# Endpoints – Objects
# =============================================
@api_router.post("/maps/{map_id}/objects")
async def create_object(map_id: str, obj: dict):
    """Neues Objekt auf einer Map anlegen"""
    # TODO: echte Speicherung
    return {"object_id": f"{obj.get('type')}::{obj.get('name')}::tempid", **obj}


@api_router.patch("/maps/{map_id}/objects/{object_id}/pos")
async def update_object_position(map_id: str, object_id: str, pos: ObjectPosition):
    """Position eines Objekts aktualisieren (Drag & Drop)"""
    return {"status": "ok", "x": pos.x, "y": pos.y}


@api_router.patch("/maps/{map_id}/objects/{object_id}/props")
async def update_object_props(map_id: str, object_id: str, props: ObjectProps):
    """Eigenschaften eines Objekts aktualisieren (Größe, Label, Iconset, Gadget-Config)"""
    return {"status": "ok", **props.model_dump(exclude_unset=True)}


# =============================================
# Weitere Router später
# =============================================
# from . import kiosk, actions, migrate
# api_router.include_router(kiosk.router, prefix="/kiosk")
# api_router.include_router(actions.router, prefix="/actions")