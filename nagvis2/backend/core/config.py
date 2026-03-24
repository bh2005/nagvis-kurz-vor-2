"""
NagVis 2 – Konfiguration
Alle Einstellungen via Umgebungsvariablen (oder .env Datei).
"""

import os
from pathlib import Path
from typing import List


class Settings:
    # ── Umgebung ────────────────────────────────────────────────────────
    ENVIRONMENT: str     = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool          = os.getenv("DEBUG", "true").lower() == "true"
    DEMO_MODE: bool      = os.getenv("DEMO_MODE", "false").lower() == "true"

    # ── Server ──────────────────────────────────────────────────────────
    HOST: str            = os.getenv("HOST", "0.0.0.0")
    PORT: int            = int(os.getenv("PORT", "8008"))
    UVICORN_WORKERS: int = int(os.getenv("UVICORN_WORKERS", "1"))

    # ── CORS ────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:8008,http://localhost:3000"
    ).split(",")

    # ── Verzeichnisse ───────────────────────────────────────────────────
    BASE_DIR: Path       = Path(__file__).parent.parent
    DATA_DIR: Path       = BASE_DIR / "data"
    MAPS_DIR: Path       = DATA_DIR / "maps"
    BG_DIR: Path         = DATA_DIR / "backgrounds"
    THUMBS_DIR: Path     = DATA_DIR / "thumbnails"
    KIOSK_DIR: Path      = DATA_DIR / "kiosk"

    # ── Livestatus ──────────────────────────────────────────────────────
    # Typ: "auto" | "tcp" | "unix" | "disabled"
    LIVESTATUS_TYPE: str = os.getenv("LIVESTATUS_TYPE", "auto")
    LIVESTATUS_HOST: str = os.getenv("LIVESTATUS_HOST", "localhost")
    LIVESTATUS_PORT: int = int(os.getenv("LIVESTATUS_PORT", "6557"))
    LIVESTATUS_PATH: str = os.getenv("LIVESTATUS_PATH", "/var/run/nagios/live")
    LIVESTATUS_SITE: str = os.getenv("LIVESTATUS_SITE", "")  # OMD-Site

    # ── WebSocket ───────────────────────────────────────────────────────
    WS_POLL_INTERVAL: int = int(os.getenv("WS_POLL_INTERVAL", "10"))  # Sekunden

    # ── Lokale Auth (Backup) ─────────────────────────────────────────────────
    # AUTH_ENABLED=true: Frontend zeigt Login-Overlay, API prüft Bearer-Token.
    # AUTH_ENABLED=false (default): App läuft offen (Schutz via nginx/OMD).
    AUTH_ENABLED: bool = os.getenv("AUTH_ENABLED", "false").lower() == "true"
    NAGVIS_SECRET: str = os.getenv("NAGVIS_SECRET", "")  # JWT-Signing-Key

    def ensure_dirs(self):
        for d in [self.DATA_DIR, self.MAPS_DIR, self.BG_DIR, self.THUMBS_DIR, self.KIOSK_DIR]:
            d.mkdir(parents=True, exist_ok=True)

    @property
    def livestatus_available(self) -> bool:
        if self.DEMO_MODE or self.LIVESTATUS_TYPE == "disabled":
            return False
        if self.LIVESTATUS_TYPE == "unix":
            return Path(self.LIVESTATUS_PATH).exists()
        return True  # tcp/auto: optimistisch, Fehler beim Connect


settings = Settings()