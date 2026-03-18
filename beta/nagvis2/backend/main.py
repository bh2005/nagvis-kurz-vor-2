"""
NagVis 2 – FastAPI Backend
"""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings

# Verzeichnisse sofort anlegen – VOR StaticFiles-Mount
settings.ensure_dirs()


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

from api.router import api_router
from ws.router  import ws_router

app.include_router(api_router)
app.include_router(ws_router)


# ══════════════════════════════════════════════════════════════════════
#  Static Files
# ══════════════════════════════════════════════════════════════════════

# /backgrounds/ – immer vorhanden (ensure_dirs hat es angelegt)
app.mount("/backgrounds", StaticFiles(directory=str(settings.BG_DIR)), name="backgrounds")

# Frontend – nur mounten wenn Ordner existiert
_frontend_dir = settings.BASE_DIR / "frontend"
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