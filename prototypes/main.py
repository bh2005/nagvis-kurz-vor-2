"""
main.py
=======
FastAPI Application – NagVis 2 Backend

Endpunkte:

  WebSocket
    WS  /ws/map/{map_id}           Live-Status-Updates für eine Map
    WS  /ws/global                 Alle Events (Admin/Debug)

  REST – Maps
    GET    /api/maps               Alle Maps
    POST   /api/maps               Neue Map anlegen
    GET    /api/maps/{id}          Map-Config laden
    DELETE /api/maps/{id}          Map löschen
    PUT    /api/maps/{id}/title    Map umbenennen

  REST – Hintergrundbild
    POST   /api/maps/{id}/background   Bild hochladen (multipart)

  REST – Objekte auf der Map
    POST   /api/maps/{id}/objects           Objekt platzieren
    PATCH  /api/maps/{id}/objects/{oid}/pos Position speichern
    DELETE /api/maps/{id}/objects/{oid}     Objekt entfernen

  REST – Livestatus / Status
    GET    /api/status/hosts         Alle Host-Stati (Snapshot)
    GET    /api/status/hosts/{name}  Einzelner Host
    GET    /api/health               Health + Poller-Stats

  Static
    GET    /                         Frontend SPA
    GET    /backgrounds/{filename}   Hintergrundbilder

Startup/Shutdown:
  - Poller wird als asyncio Background-Task gestartet
  - WebSocket-Fan-out-Loop läuft parallel
"""

import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import (
    FastAPI, WebSocket, WebSocketDisconnect,
    HTTPException, UploadFile, File,
    Body, Query,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.livestatus.client import LivestatusConfig, BackendRegistry
from backend.core.cfg_migration import migrate_cfg, MigrationResult
from backend.core.auth import (
    AuthManager, AuthUser, set_auth_manager,
    require_viewer, require_editor, require_admin,
    ROLE_RANK,
)
from fastapi.security import HTTPBearer
from backend.core.poller       import StatusPoller
from backend.core.ws_manager   import WebSocketManager
from backend.core.map_store    import MapStore

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from backend.core.map_export import export_map_zip, import_map_zip

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)-20s %(levelname)-8s %(message)s",
)
log = logging.getLogger("nagvis.app")

# ── Backend-Konfiguration ─────────────────────────────────────
# Mehrere CMK-Sites als eigene Einträge möglich.
# In Produktion: aus nagvis.ini.php oder Umgebungsvariablen lesen.
BACKENDS: list[LivestatusConfig] = [
    LivestatusConfig(
        backend_id  = "default",
        socket_path = "/omd/sites/cmk/tmp/run/live",
        timeout     = 8.0,
    ),
    # Weiteres Backend (TCP, remote Site) – Beispiel auskommentiert:
    # LivestatusConfig(
    #     backend_id = "site-berlin",
    #     use_tcp    = True,
    #     host       = "mon-berlin.example.com",
    #     port       = 6557,
    # ),
]
POLL_INTERVAL = 30.0   # Sekunden

# ── Singleton-Instanzen ───────────────────────────────────────
backend_registry = BackendRegistry(BACKENDS)
poller           = StatusPoller(BACKENDS[0], interval=POLL_INTERVAL)
ws_manager       = WebSocketManager()
map_store        = MapStore()
auth_manager     = AuthManager()
set_auth_manager(auth_manager)   # Dependency-Injection vorbereiten

# ── Demo-Daten für Dev ohne echtes Livestatus ─────────────────
DEMO_MODE = True   # auf False setzen wenn echtes Livestatus vorhanden

if DEMO_MODE:
    # Fake-Cache damit get_full_snapshot() sofort etwas liefert
    _demo_hosts = [
        {"type":"host","name":"core-router-01","alias":"Core Router","state":0,"state_label":"UP","output":"PING OK - 1.2ms","last_check":1710000000,"acknowledged":False,"in_downtime":False,"services_ok":12,"services_warn":0,"services_crit":0,"services_unkn":0},
        {"type":"host","name":"srv-web-01","alias":"Web Server 01","state":0,"state_label":"UP","output":"HTTP OK: 200 in 43ms","last_check":1710000010,"acknowledged":False,"in_downtime":False,"services_ok":8,"services_warn":0,"services_crit":0,"services_unkn":0},
        {"type":"host","name":"srv-backup-01","alias":"Backup Server","state":0,"state_label":"UP","output":"PING OK","last_check":1710000020,"acknowledged":False,"in_downtime":False,"services_ok":1,"services_warn":2,"services_crit":1,"services_unkn":0},
        {"type":"host","name":"sw-access-01","alias":"Access Switch","state":0,"state_label":"UP","output":"SNMP OK","last_check":1710000030,"acknowledged":False,"in_downtime":False,"services_ok":5,"services_warn":1,"services_crit":0,"services_unkn":0},
        {"type":"host","name":"fw-main","alias":"Main Firewall","state":0,"state_label":"UP","output":"PING OK","last_check":1710000040,"acknowledged":False,"in_downtime":False,"services_ok":4,"services_warn":0,"services_crit":0,"services_unkn":0},
        {"type":"host","name":"srv-db-01","alias":"Database Server","state":0,"state_label":"UP","output":"MySQL OK","last_check":1710000050,"acknowledged":False,"in_downtime":False,"services_ok":6,"services_warn":0,"services_crit":0,"services_unkn":0},
    ]
    for h in _demo_hosts:
        poller._host_cache[h["name"]] = h

    # Demo-Map anlegen wenn noch keine existiert
    if not map_store.list_maps():
        demo_map = map_store.create_map("Datacenter Rack A", "datacenter-a")
        positions = [
            ("host","core-router-01","router", 48, 22),
            ("host","sw-access-01",  "switch", 72, 35),
            ("host","srv-web-01",    "server", 25, 58),
            ("host","srv-db-01",     "database",45,65),
            ("host","srv-backup-01", "storage", 68,62),
            ("host","fw-main",       "firewall",80,22),
        ]
        for typ, name, iconset, x, y in positions:
            map_store.add_object("datacenter-a", {
                "type": typ, "name": name, "iconset": iconset,
                "x": x, "y": y, "label": name,
            })


# ── Application Lifespan ──────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    log.info("Starting NagVis 2 backend...")

    # Poller starten (Background-Task)
    if not DEMO_MODE:
        await poller.start()

    # WebSocket Fan-out Loop starten
    fanout_task = asyncio.create_task(
        ws_manager.fanout_loop(
            queue        = poller.queue,
            get_snapshot = poller.get_full_snapshot,
        ),
        name="ws-fanout"
    )

    yield   # ← App läuft

    # ── Shutdown ──
    log.info("Shutting down...")
    fanout_task.cancel()
    if not DEMO_MODE:
        await poller.stop()


# ── FastAPI App ───────────────────────────────────────────────
app = FastAPI(
    title       = "NagVis 2 API",
    description = "Monitoring Visualization – FastAPI Backend",
    version     = "2.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],   # In Produktion einschränken
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Auth-Middleware ───────────────────────────────────────────
# Schützt alle /api/*-Routen. Statische Dateien und / bleiben offen.
AUTH_SKIP_PATHS = {"/", "/api/auth/login", "/api/health"}
AUTH_SKIP_PREFIXES = ("/static/", "/backgrounds/", "/docs", "/openapi")

@app.middleware("http")
async def auth_middleware(request, call_next):
    path = request.url.path
    # Freigegebene Pfade durchlassen
    if path in AUTH_SKIP_PATHS or path.startswith(AUTH_SKIP_PREFIXES):
        return await call_next(request)
    # Nur /api/* und /ws/* absichern
    if not (path.startswith("/api/") or path.startswith("/ws/")):
        return await call_next(request)
    # Token aus Header lesen (WebSocket: Query-Param wird in Handler geprüft)
    if path.startswith("/ws/"):
        return await call_next(request)
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Authorization-Header fehlt"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        user = auth_manager.verify(token)
        request.state.user = user
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    return await call_next(request)

# Static Files
Path("data/backgrounds").mkdir(parents=True, exist_ok=True)
Path("frontend").mkdir(parents=True, exist_ok=True)
app.mount("/backgrounds", StaticFiles(directory="data/backgrounds"), name="backgrounds")
app.mount("/static",      StaticFiles(directory="frontend"),         name="frontend")


# ════════════════════════════════════════════════════════════════
#  WebSocket Endpunkte
# ════════════════════════════════════════════════════════════════

@app.websocket("/ws/map/{map_id}")
async def ws_map(websocket: WebSocket, map_id: str):
    """
    WebSocket für eine bestimmte Map.
    Browser erhält sofort einen Snapshot, dann nur noch Diffs.
    Token wird als Query-Parameter erwartet: ?token=<jwt>
    """
    user = auth_manager.verify_ws_token(websocket)   # 4001 bei Fehler
    client_id = f"{map_id}::{uuid.uuid4().hex[:8]}"

    conn = await ws_manager.connect(websocket, client_id, map_id=map_id)

    # Sofort den aktuellen Snapshot senden
    await ws_manager.send_snapshot(client_id)

    try:
        # Verbindung offenhalten – Client sendet Pings / Befehle
        while True:
            data = await websocket.receive_text()
            await _handle_ws_message(client_id, map_id, data)

    except WebSocketDisconnect:
        await ws_manager.disconnect(client_id)


@app.websocket("/ws/global")
async def ws_global(websocket: WebSocket):
    """Admin-/Debug-Stream: alle Events, alle Maps. Nur admin-Tokens."""
    user = auth_manager.verify_ws_token(websocket)
    if ROLE_RANK.get(user.role, 0) < ROLE_RANK["admin"]:
        from fastapi import WebSocketException
        raise WebSocketException(code=4003, reason="admin-Rolle erforderlich")
    client_id = f"global::{uuid.uuid4().hex[:8]}"
    await ws_manager.connect(websocket, client_id)
    await ws_manager.send_snapshot(client_id)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(client_id)


async def _handle_ws_message(client_id: str, map_id: str, raw: str):
    """
    Verarbeitet Nachrichten vom Browser über den WS-Kanal.
    Z.B. "force_refresh" um sofort einen neuen Poll zu triggern.
    """
    import json as _json
    try:
        msg = _json.loads(raw)
        cmd = msg.get("cmd")
        if cmd == "force_refresh":
            if not DEMO_MODE:
                # trigger_refresh() setzt asyncio.Event → unterbricht sleep()
                # und löst sofortigen Poll aus, ohne den Task neu zu starten.
                poller.trigger_refresh()
            # In DEMO_MODE: Snapshot direkt zurückschicken
            await ws_manager.send(client_id, poller.get_full_snapshot())
        elif cmd == "ping":
            await ws_manager.send(client_id, {"event": "pong"})
    except Exception as e:
        log.debug("WS message parse error: %s", e)


# ════════════════════════════════════════════════════════════════
#  REST – Maps
# ════════════════════════════════════════════════════════════════

class CreateMapRequest(BaseModel):
    title:  str
    map_id: str = ""

class RenameTitleRequest(BaseModel):
    title: str


@app.get("/api/maps", tags=["maps"])
async def list_maps(user: AuthUser = Depends(require_viewer)):
    return map_store.list_maps()


@app.post("/api/maps", tags=["maps"], status_code=201)
async def create_map(req: CreateMapRequest, user: AuthUser = Depends(require_editor)):
    return map_store.create_map(req.title, req.map_id)


@app.get("/api/maps/{map_id}", tags=["maps"])
async def get_map(map_id: str, user: AuthUser = Depends(require_viewer)):
    cfg = map_store.get_map(map_id)
    if not cfg:
        raise HTTPException(404, f"Map '{map_id}' not found")
    return cfg


@app.delete("/api/maps/{map_id}", tags=["maps"])
async def delete_map(map_id: str, user: AuthUser = Depends(require_admin)):
    if not map_store.delete_map(map_id):
        raise HTTPException(404, f"Map '{map_id}' not found")
    return {"deleted": map_id}


@app.put("/api/maps/{map_id}/title", tags=["maps"])
async def rename_map(map_id: str, req: RenameTitleRequest, user: AuthUser = Depends(require_editor)):
    if not map_store.update_map_title(map_id, req.title):
        raise HTTPException(404, f"Map '{map_id}' not found")
    return {"map_id": map_id, "title": req.title}


# ── Hintergrundbild ───────────────────────────────────────────

@app.post("/api/maps/{map_id}/background", tags=["maps"])
async def upload_background(map_id: str, file: UploadFile = File(...), user: AuthUser = Depends(require_editor)):
    """
    Nimmt ein Bild entgegen (PNG/JPG/SVG/WebP),
    speichert es unter data/backgrounds/ und verknüpft es mit der Map.
    """
    allowed = {".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, f"Dateityp {ext} nicht erlaubt. Erlaubt: {allowed}")

    # Eindeutiger Dateiname
    filename = f"{map_id}{ext}"
    dest = Path("data/backgrounds") / filename

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:   # 20 MB Limit
        raise HTTPException(413, "Datei zu groß (max. 20 MB)")

    dest.write_bytes(content)
    map_store.set_background(map_id, filename)

    log.info("Background uploaded for map '%s': %s (%d bytes)", map_id, filename, len(content))
    return {
        "map_id":   map_id,
        "filename": filename,
        "url":      f"/backgrounds/{filename}",
        "size":     len(content),
    }


# ── Objekte ───────────────────────────────────────────────────

class AddObjectRequest(BaseModel):
    """
    Flexibles Schema für alle Objekttypen.

    Monitoring (host | service | hostgroup | servicegroup | map):
      type, name, x, y, iconset?, label?, host_name? (nur service)

    Statuslos:
      textbox:   type, x, y, text?, w?, h?, font_size?, bold?,
                 color?, bg_color?, border_color?
      line:      type, x, y, x2?, y2?, line_style?, line_width?, color?
      container: type, x, y, url?, w?, h?
    """
    type:         str
    x:            float
    y:            float
    # Monitoring
    name:         str | None = None
    iconset:      str        = "default"
    label:        str        = ""
    host_name:    str | None = None   # für type=service
    # Textbox
    text:         str | None = None
    w:            float | None = None
    h:            float | None = None
    font_size:    int  | None = None
    bold:         bool | None = None
    color:        str | None = None
    bg_color:     str | None = None
    border_color: str | None = None
    # Line
    x2:           float | None = None
    y2:           float | None = None
    line_style:   str | None = None   # solid | dashed | dotted
    line_width:   int  | None = None
    # Container
    url:          str | None = None

class UpdatePositionRequest(BaseModel):
    x: float
    y: float

class UpdateSizeRequest(BaseModel):
    w: float
    h: float

class UpdatePropsRequest(BaseModel):
    props: dict   # beliebige Felder (type + object_id sind geschützt)


@app.post("/api/maps/{map_id}/objects", tags=["objects"], status_code=201)
async def add_object(map_id: str, req: AddObjectRequest, user: AuthUser = Depends(require_editor)):
    from backend.core.map_store import ALL_TYPES
    if req.type not in ALL_TYPES:
        raise HTTPException(400, f"Unbekannter Typ '{req.type}'. "
                            f"Erlaubt: {sorted(ALL_TYPES)}")

    obj = map_store.add_object(map_id, req.model_dump(exclude_none=True))
    if obj is None:
        raise HTTPException(404, f"Map '{map_id}' not found")

    await ws_manager.broadcast(
        {"event": "object_added", "map_id": map_id, "object": obj},
        map_id=map_id,
    )
    return obj


@app.patch("/api/maps/{map_id}/objects/{object_id}/pos", tags=["objects"])
async def update_position(map_id: str, object_id: str, req: UpdatePositionRequest, user: AuthUser = Depends(require_editor)):
    ok = map_store.update_object_position(map_id, object_id, req.x, req.y)
    if not ok:
        raise HTTPException(404, "Object not found")
    return {"object_id": object_id, "x": req.x, "y": req.y}


@app.patch("/api/maps/{map_id}/objects/{object_id}/size", tags=["objects"])
async def update_size(map_id: str, object_id: str, req: UpdateSizeRequest, user: AuthUser = Depends(require_editor)):
    ok = map_store.update_object_size(map_id, object_id, req.w, req.h)
    if not ok:
        raise HTTPException(404, "Object not found")
    return {"object_id": object_id, "w": req.w, "h": req.h}


@app.patch("/api/maps/{map_id}/objects/{object_id}/props", tags=["objects"])
async def update_props(map_id: str, object_id: str, req: UpdatePropsRequest, user: AuthUser = Depends(require_editor)):
    updated = map_store.update_object_props(map_id, object_id, req.props)
    if updated is None:
        raise HTTPException(404, "Object not found")
    await ws_manager.broadcast(
        {"event": "object_updated", "map_id": map_id, "object": updated},
        map_id=map_id,
    )
    return updated


@app.delete("/api/maps/{map_id}/objects/{object_id}", tags=["objects"])
async def remove_object(map_id: str, object_id: str, user: AuthUser = Depends(require_editor)):
    ok = map_store.remove_object(map_id, object_id)
    if not ok:
        raise HTTPException(404, "Object not found")

    await ws_manager.broadcast(
        {"event": "object_removed", "map_id": map_id, "object_id": object_id},
        map_id=map_id,
    )
    return {"deleted": object_id}


# ════════════════════════════════════════════════════════════════
#  REST – Auth-Verwaltung (admin only)
# ════════════════════════════════════════════════════════════════

class CreateTokenRequest(BaseModel):
    username:   str
    role:       str        = "viewer"   # viewer | editor | admin
    expires_in: int | None = None       # Sekunden; None = unbegrenzt

@app.post("/api/auth/tokens", tags=["auth"], status_code=201)
async def create_token(
    req:  CreateTokenRequest,
    user: AuthUser = Depends(require_admin),
):
    """Neues API-Token erzeugen (nur admin)."""
    token = auth_manager.create_token(req.username, req.role, req.expires_in)
    return {"token": token, "username": req.username, "role": req.role}


@app.get("/api/auth/tokens", tags=["auth"])
async def list_tokens_route(user: AuthUser = Depends(require_admin)):
    """Alle bekannten Tokens auflisten (nur admin, JWT nicht enthalten)."""
    return {"tokens": auth_manager.list_tokens()}


@app.delete("/api/auth/tokens/{jti}", tags=["auth"])
async def revoke_token(jti: str, user: AuthUser = Depends(require_admin)):
    """Token per jti widerrufen (nur admin)."""
    auth_manager.revoke(jti)
    return {"revoked": jti}


@app.get("/api/auth/me", tags=["auth"])
async def whoami(user: AuthUser = Depends(require_viewer)):
    """Gibt den aktuell eingeloggten User zurück."""
    return {
        "username":   user.username,
        "role":       user.role,
        "expires_at": user.expires_at or None,
    }


# ════════════════════════════════════════════════════════════════
#  REST – Status (Livestatus Snapshot)
# ════════════════════════════════════════════════════════════════

@app.get("/api/status/hosts", tags=["status"])
async def get_all_hosts():
    if DEMO_MODE:
        return list(poller._host_cache.values())
    hosts = await poller.client.get_hosts()
    return [h.to_dict() for h in hosts]


@app.get("/api/status/hosts/{host_name}", tags=["status"])
async def get_host(host_name: str):
    if DEMO_MODE:
        h = poller._host_cache.get(host_name)
        if not h:
            raise HTTPException(404, f"Host '{host_name}' not found")
        return h
    host = await poller.client.get_host_status(host_name)
    if not host:
        raise HTTPException(404, f"Host '{host_name}' not found")
    return host.to_dict()


# ── Health ────────────────────────────────────────────────────

@app.get("/api/backends", tags=["system"])
async def list_backends(user: AuthUser = Depends(require_admin)):
    """Alle konfigurierten Livestatus-Backends mit Live-Health-Status."""
    if DEMO_MODE:
        return {
            "backends": [{"backend_id": "default", "type": "unix",
                          "address": "DEMO_MODE", "enabled": True,
                          "reachable": True, "latency_ms": 0}]
        }
    health_list = await backend_registry.health()
    backends    = backend_registry.list_backends()
    health_map  = {h.backend_id: h for h in health_list}
    return {
        "backends": [
            {**b,
             "reachable":  health_map[b["backend_id"]].reachable
                           if b["backend_id"] in health_map else None,
             "latency_ms": health_map[b["backend_id"]].latency_ms
                           if b["backend_id"] in health_map else None,
             "error":      health_map[b["backend_id"]].error
                           if b["backend_id"] in health_map else ""}
            for b in backends
        ]
    }


@app.get("/api/health", tags=["system"])
async def health():
    if DEMO_MODE:
        return {
            "status":     "ok",
            "demo_mode":  True,
            "backends":   [{"backend_id": "default", "reachable": True}],
            "poller":     poller.stats,
            "websockets": ws_manager.stats,
        }

    health_list   = await backend_registry.health()
    all_reachable = all(h.reachable for h in health_list)
    any_reachable = any(h.reachable for h in health_list)

    return {
        "status":     "ok" if all_reachable else ("degraded" if any_reachable else "down"),
        "demo_mode":  False,
        "backends":   [
            {"backend_id": h.backend_id, "reachable": h.reachable,
             "latency_ms": h.latency_ms, "error": h.error}
            for h in health_list
        ],
        "poller":     poller.stats,
        "websockets": ws_manager.stats,
    }


# ════════════════════════════════════════════════════════════════
#  REST – NagVis-1 Migration
# ════════════════════════════════════════════════════════════════

@app.post("/api/migrate", tags=["migration"])
async def migrate_nagvis1_cfg(
    file:     UploadFile = File(...),
    map_id:   str        = Query("", description="Ziel-Map-ID (leer = aus Dateiname)"),
    canvas_w: float      = Query(1200.0, description="Canvas-Breite in Pixeln"),
    canvas_h: float      = Query( 800.0, description="Canvas-Höhe in Pixeln"),
    dry_run:  bool       = Query(False,  description="Nur Preview, nichts speichern"),
    user:     AuthUser   = Depends(require_admin),
):
    """
    Migriert eine NagVis-1-.cfg-Datei nach NagVis 2.

    - Parst alle Objekttypen (host, service, hostgroup, servicegroup,
      map, textbox, line, container)
    - Rechnet Pixel-Koordinaten in %-Koordinaten um
    - Legt die Map direkt im MapStore an (außer dry_run=true)
    - Gibt Warnungen und übersprungene Objekte zurück

    dry_run=true: liefert nur die Vorschau ohne zu speichern.
    """
    if not file.filename.endswith(".cfg"):
        raise HTTPException(400, "Nur .cfg-Dateien werden akzeptiert")

    content = (await file.read()).decode("utf-8", errors="replace")

    # map_id aus Dateiname ableiten wenn nicht angegeben
    derived_id = map_id or file.filename.removesuffix(".cfg")

    result = migrate_cfg(
        content   = content,
        map_id    = derived_id,
        canvas_w  = canvas_w,
        canvas_h  = canvas_h,
    )

    if dry_run:
        return {
            "dry_run":    True,
            "map_id":     result.map_id,
            "title":      result.title,
            "background": result.background,
            "object_count": len(result.objects),
            "objects":    result.objects,
            "warnings":   [
                {"type": w.object_type, "field": w.field, "message": w.message}
                for w in result.warnings
            ],
            "skipped":    result.skipped,
        }

    # Map anlegen und Objekte einfügen
    existing = map_store.get_map(result.map_id)
    if existing:
        raise HTTPException(
            409,
            f"Map '{result.map_id}' existiert bereits. "
            "Andere map_id wählen oder Map zuerst löschen."
        )

    map_store.create_map(result.title, result.map_id)

    inserted = []
    failed   = []
    for obj in result.objects:
        created = map_store.add_object(result.map_id, obj)
        if created:
            inserted.append(created)
        else:
            failed.append(obj)

    log.info(
        "Migration abgeschlossen: map=%s, %d eingefügt, %d fehlgeschlagen",
        result.map_id, len(inserted), len(failed),
    )

    return {
        "dry_run":      False,
        "map_id":       result.map_id,
        "title":        result.title,
        "background":   result.background,
        "object_count": len(inserted),
        "warnings": [
            {"type": w.object_type, "field": w.field, "message": w.message}
            for w in result.warnings
        ],
        "skipped":      result.skipped + len(failed),
        "note": (
            f"Hintergrundbild '{result.background}' muss manuell hochgeladen werden."
            if result.background else ""
        ),
    }


# ── Frontend SPA ──────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def serve_frontend():
    index = Path("frontend/index.html")
    if index.exists():
        return FileResponse(str(index))
    return JSONResponse({"message": "NagVis 2 API running. Frontend not found."})

# ── Export ──────────────────────────────────────────────────────────────
 
@app.get(
    "/api/maps/{map_id}/export",
    summary="Map als ZIP exportieren",
    tags=["maps"],
)
async def export_map(
    map_id: str,
    # current_user = Depends(require_role("viewer")),   # Auth aktivieren wenn ready
):
    """
    Gibt eine ZIP-Datei zurück die enthält:
    - manifest.json  – Metadaten
    - map.json       – vollständige Map-Konfiguration
    - background.*   – Hintergrundbild (wenn vorhanden)
    """
    try:
        zip_bytes, filename = export_map_zip(map_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Map '{map_id}' nicht gefunden")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
 
    return Response(
        content     = zip_bytes,
        media_type  = "application/zip",
        headers     = {"Content-Disposition": f'attachment; filename="{filename}"'},
    )
 
 
# ── Import ───────────────────────────────────────────────────────────────
 
@app.post(
    "/api/maps/import",
    summary="Map aus ZIP importieren",
    tags=["maps"],
)
async def import_map(
    file:        UploadFile = File(...),
    map_id:      str | None = Query(None,  description="Map-ID überschreiben"),
    dry_run:     bool       = Query(False, description="Nur validieren, nicht speichern"),
    # current_user = Depends(require_role("editor")),   # Auth aktivieren wenn ready
):
    """
    Importiert eine Map aus einem NagVis-2-ZIP-Archiv.
 
    - Akzeptiert `.zip`-Dateien die mit `GET /api/maps/{id}/export` erzeugt wurden.
    - `dry_run=true` → validiert das Archiv ohne etwas zu schreiben.
    - `map_id` → überschreibt die ID aus dem Archiv.
    """
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Nur .zip-Dateien erlaubt")
 
    max_bytes = 50 * 1024 * 1024  # 50 MB
    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail="Datei zu groß (max. 50 MB)")
 
    result = import_map_zip(data, override_id=map_id, dry_run=dry_run)
 
    if not result.ok:
        raise HTTPException(status_code=422, detail={"errors": result.errors})
 
    return result.to_dict()