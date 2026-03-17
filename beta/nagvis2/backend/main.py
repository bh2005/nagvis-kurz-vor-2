"""
NagVis 2 – FastAPI Backend (Haupteinstiegspunkt)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings

# =============================================
# Lifespan (Startup / Shutdown)
# =============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🚀 NagVis 2 starting → {settings.ENVIRONMENT} | DEBUG={settings.DEBUG}")
    settings.ensure_dirs()                    # Erstellt data/, maps/, backgrounds/
    yield
    print("🛑 NagVis 2 shutting down...")


# =============================================
# FastAPI App
# =============================================
app = FastAPI(
    title="NagVis 2",
    version="2.0-beta",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url=None,
)

# =============================================
# CORS
# =============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================
# Health-Check (wichtig für Docker!)
# =============================================
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "demo_mode": settings.DEMO_MODE,
        "version": "2.0-beta"
    }

# =============================================
# Router-Imports (später erweitern)
# =============================================
# from api import router as api_router
# from ws import router as ws_router

# app.include_router(api_router, prefix="/api")
# app.include_router(ws_router, prefix="/ws")

# =============================================
# Router einbinden
# =============================================
from api.router import api_router

app.include_router(api_router)

# =============================================
# Root-Route (nur zur Info)
# =============================================
@app.get("/")
async def root():
    return {
        "message": "NagVis 2 Backend läuft ✅",
        "docs": "/api/docs" if settings.DEBUG else "Docs deaktiviert",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.UVICORN_WORKERS
    )