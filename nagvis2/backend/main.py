"""
NagVis 2 – FastAPI Backend
"""

import time
import logging
import logging.handlers
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_client import make_asgi_app, generate_latest, CONTENT_TYPE_LATEST

from core.config import settings
from core.logging_setup import setup_logging, get_uvicorn_log_config
from core.metrics import (
    http_requests_total, http_request_duration,
    ws_connections, ws_connections_per_map,
    maps_total, objects_total,
)

# Logging als allererstes konfigurieren
setup_logging()
log = logging.getLogger("nagvis.main")

# Verzeichnisse sofort anlegen – VOR StaticFiles-Mount
settings.ensure_dirs()

# ── File-Logging einrichten ────────────────────────────────────────────────────
_log_file = settings.DATA_DIR / "nagvis2.log"
_file_handler = logging.handlers.RotatingFileHandler(
    _log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
)
_file_handler.setFormatter(logging.Formatter(
    "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
))
logging.getLogger().addHandler(_file_handler)
logging.getLogger().setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
# Uvicorn-Logger ebenfalls in die Datei leiten
for _uv_log in ("uvicorn", "uvicorn.access", "uvicorn.error"):
    logging.getLogger(_uv_log).addHandler(_file_handler)

# ── Lokale Auth initialisieren ─────────────────────────────────────────────────
from core.auth          import AuthManager,    set_auth_manager
from core.users         import UserManager,    set_user_manager
from core.ldap_manager  import LdapManager,    set_ldap_manager
from core.presets       import PresetsManager, set_presets_manager

_auth_mgr    = AuthManager()
_user_mgr    = UserManager()
_ldap_mgr    = LdapManager(settings.DATA_DIR / "ldap.json")
_presets_mgr = PresetsManager(settings.DATA_DIR / "presets.json")
set_auth_manager(_auth_mgr)
set_user_manager(_user_mgr)
set_ldap_manager(_ldap_mgr)
set_presets_manager(_presets_mgr)

# Erster Start: Default-Admin anlegen wenn noch keine Benutzer vorhanden
if _user_mgr.count() == 0:
    _user_mgr.create_user("admin", "admin", "admin")
    print("⚠  ERSTER START: Benutzer 'admin' mit Passwort 'admin' angelegt.")
    print("   Bitte sofort in der Benutzerverwaltung ändern!")
    print("   (AUTH_ENABLED=true in .env setzen um den Login zu aktivieren)")


# ══════════════════════════════════════════════════════════════════════
#  Lifespan
# ══════════════════════════════════════════════════════════════════════

def _seed_maps():
    """
    Kopiert/aktualisiert Demo-Maps aus seed_maps/ nach data/maps/.
    Maps mit dem Prefix "demo-" werden IMMER überschrieben (jeder Deploy
    bringt die neueste Version). Andere Maps werden nur angelegt wenn fehlend.
    Seed-Verzeichnis liegt außerhalb des Docker-Volumes und ist immer im Image.
    """
    import shutil
    seed_dir = settings.BASE_DIR / "seed_maps"
    if not seed_dir.exists():
        return
    copied, updated = [], []
    for src in sorted(seed_dir.glob("*.json")):
        dst = settings.MAPS_DIR / src.name
        is_demo = src.stem.startswith("demo-")
        if not dst.exists():
            shutil.copy2(src, dst)
            copied.append(src.name)
        elif is_demo:
            shutil.copy2(src, dst)
            updated.append(src.name)
    if copied:
        log.info("Seed maps created: %s", ", ".join(copied))
    if updated:
        log.info("Seed maps updated: %s", ", ".join(updated))


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "NagVis 2 starting",
        extra={"environment": settings.ENVIRONMENT,
               "debug": settings.DEBUG,
               "demo_mode": settings.DEMO_MODE},
    )
    _seed_maps()

    from ws.manager import start_poller
    start_poller()

    # Initiale Map-/Objekt-Metriken setzen
    _refresh_map_metrics()

    yield

    from ws.manager import stop_poller
    stop_poller()
    log.info("NagVis 2 shutdown")


def _refresh_map_metrics():
    """Zählt Maps + Objekte und aktualisiert die Prometheus-Gauges."""
    try:
        from core.storage import list_maps
        all_maps = list_maps()
        maps_total.set(len(all_maps))
        objects_total.set(sum(len(m.get("objects", [])) for m in all_maps))
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════════════
#  App
# ══════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="NagVis 2",
    version="2.0-beta",
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════
#  HTTP-Metriken-Middleware
# ══════════════════════════════════════════════════════════════════════

# Pfade die nicht in die Metriken aufgenommen werden (zu viel Rauschen)
_METRICS_SKIP = {"/metrics", "/health", "/health/live", "/health/ready",
                 "/favicon.svg", "/favicon.ico"}

@app.middleware("http")
async def _metrics_middleware(request: Request, call_next):
    path = request.url.path
    # Statische Dateien (Frontend, Backgrounds) nicht einzeln tracken
    skip = path in _METRICS_SKIP or path.startswith(("/backgrounds/", "/js/", "/css/", "/help/"))
    t0 = time.perf_counter()
    response = await call_next(request)
    if not skip:
        elapsed = time.perf_counter() - t0
        method  = request.method
        status  = str(response.status_code)
        http_requests_total.labels(method=method, path=path, status=status).inc()
        http_request_duration.labels(method=method, path=path).observe(elapsed)
    return response


# ══════════════════════════════════════════════════════════════════════
#  Router
# ══════════════════════════════════════════════════════════════════════

from api.router      import api_router
from api.auth_router import auth_router
from ws.router       import ws_router

app.include_router(auth_router)
app.include_router(api_router)
app.include_router(ws_router)


# ══════════════════════════════════════════════════════════════════════
#  Rückwärts-Kompatibilität: /api/* → /api/v1/*
#  Externe Tools (Prometheus-Scraper, Scripts) die noch /api/ nutzen
#  erhalten einen 308 Permanent Redirect.
# ══════════════════════════════════════════════════════════════════════

from fastapi.responses import RedirectResponse
from fastapi import Request as _Request

@app.api_route("/api/{rest_of_path:path}",
               methods=["GET","POST","PUT","PATCH","DELETE"],
               include_in_schema=False)
async def api_compat_redirect(rest_of_path: str, request: _Request):
    """308 Permanent Redirect von /api/* auf /api/v1/* – inkl. Query-Parameter."""
    url = f"/api/v1/{rest_of_path}"
    if request.url.query:
        url += f"?{request.url.query}"
    return RedirectResponse(url=url, status_code=308)


# ══════════════════════════════════════════════════════════════════════
#  Prometheus /metrics
# ══════════════════════════════════════════════════════════════════════

@app.get("/metrics", include_in_schema=False)
async def metrics():
    """Prometheus-Scrape-Endpoint (text/plain; version=0.0.4)."""
    # WS-Verbindungen aktuell messen
    try:
        from ws.manager import manager as ws_manager
        total = 0
        for map_id, conns in ws_manager._connections.items():
            count = len(conns)
            ws_connections_per_map.labels(map_id=map_id).set(count)
            total += count
        ws_connections.set(total)
    except Exception:
        pass

    # Map-/Objekt-Zähler aktualisieren
    _refresh_map_metrics()

    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ══════════════════════════════════════════════════════════════════════
#  Kubernetes Health-Probes
# ══════════════════════════════════════════════════════════════════════

@app.get("/health/live", include_in_schema=False)
async def health_live():
    """Liveness-Probe: Prozess läuft. Gibt immer 200 zurück."""
    return {"status": "alive"}


@app.get("/health/ready", include_in_schema=False)
async def health_ready():
    """
    Readiness-Probe: Mindestens ein Backend erreichbar ODER Demo-Modus aktiv.
    Gibt 200 zurück wenn bereit, 503 wenn nicht.
    """
    from connectors.registry import registry
    from fastapi.responses import JSONResponse

    if settings.DEMO_MODE:
        return {"status": "ready", "demo": True}

    if registry.is_empty():
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": "no backends configured"},
        )

    backend_health = await registry.health()
    reachable = [b for b in backend_health if b.get("reachable")]

    # Prometheus-Metriken für Backend-Erreichbarkeit aktualisieren
    try:
        from core.metrics import backend_reachable
        for b in backend_health:
            backend_reachable.labels(
                backend_id=b["backend_id"],
                backend_type=b.get("type", "unknown"),
            ).set(1 if b.get("reachable") else 0)
    except Exception:
        pass

    if reachable:
        return {"status": "ready", "backends": len(reachable)}

    return JSONResponse(
        status_code=503,
        content={"status": "not_ready", "reason": "no backends reachable"},
    )


# ══════════════════════════════════════════════════════════════════════
#  Compat: /health ohne /api Prefix (Docker-Healthcheck)
# ══════════════════════════════════════════════════════════════════════

@app.get("/health", include_in_schema=False)
async def health_compat():
    from api.router import health
    return await health()


# ══════════════════════════════════════════════════════════════════════
#  Static Files
# ══════════════════════════════════════════════════════════════════════

app.mount("/backgrounds", StaticFiles(directory=str(settings.BG_DIR)),   name="backgrounds")
app.mount("/thumbnails",  StaticFiles(directory=str(settings.THUMBS_DIR)), name="thumbnails")

_frontend_dir = settings.BASE_DIR.parent / "frontend"
if _frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
else:
    log.warning("frontend/ nicht gefunden (%s) – nur API-Modus aktiv", _frontend_dir)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.UVICORN_WORKERS,
        log_config=get_uvicorn_log_config(),
    )
