"""
NagVis 2 – FastAPI Backend
"""

import logging
import logging.handlers
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings

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
from core.auth  import AuthManager,  set_auth_manager
from core.users import UserManager,  set_user_manager

_auth_mgr = AuthManager()
_user_mgr = UserManager()
set_auth_manager(_auth_mgr)
set_user_manager(_user_mgr)

# Erster Start: Default-Admin anlegen wenn noch keine Benutzer vorhanden
if _user_mgr.count() == 0:
    _user_mgr.create_user("admin", "admin", "admin")
    print("⚠  ERSTER START: Benutzer 'admin' mit Passwort 'admin' angelegt.")
    print("   Bitte sofort in der Benutzerverwaltung ändern!")
    print("   (AUTH_ENABLED=true in .env setzen um den Login zu aktivieren)")


# ══════════════════════════════════════════════════════════════════════
#  Lifespan
# ══════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🚀 NagVis 2 → {settings.ENVIRONMENT} | DEBUG={settings.DEBUG} | DEMO={settings.DEMO_MODE}")
    from ws.manager import start_poller
    start_poller()
    yield
    from ws.manager import stop_poller
    stop_poller()
    print("🛑 NagVis 2 shutting down")


# ══════════════════════════════════════════════════════════════════════
#  App
# ══════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="NagVis 2",
    version="2.0-beta",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.DEBUG else None,
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
#  Router
# ══════════════════════════════════════════════════════════════════════

from api.router      import api_router
from api.auth_router import auth_router
from ws.router       import ws_router

app.include_router(auth_router)
app.include_router(api_router)
app.include_router(ws_router)


# ══════════════════════════════════════════════════════════════════════
#  Static Files
# ══════════════════════════════════════════════════════════════════════

# /backgrounds/ – immer vorhanden (ensure_dirs hat es angelegt)
app.mount("/backgrounds", StaticFiles(directory=str(settings.BG_DIR)), name="backgrounds")

# Frontend – nur mounten wenn Ordner existiert
_frontend_dir = settings.BASE_DIR.parent / "frontend"
if _frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
else:
    print(f"⚠  frontend/ nicht gefunden ({_frontend_dir}) – nur API-Modus aktiv")
    print(f"   Lege einen 'frontend/' Ordner neben 'backend/' an und kopiere")
    print(f"   index.html, css/, js/, src/ hinein.")


# ══════════════════════════════════════════════════════════════════════
#  Compat: /health ohne /api Prefix (Docker-Healthcheck)
# ══════════════════════════════════════════════════════════════════════

@app.get("/health", include_in_schema=False)
async def health_compat():
    from api.router import health
    return await health()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.UVICORN_WORKERS,
    )