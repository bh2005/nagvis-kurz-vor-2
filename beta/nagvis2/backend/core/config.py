# backend/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import List

class Settings(BaseSettings):
    # Allgemein
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    UVICORN_WORKERS: int = 1

    # Livestatus
    LIVE_STATUS_HOST: str = "127.0.0.1"
    LIVE_STATUS_PORT: int = 6557
    CHECKMK_SITE: str = ""

    # Pfade
    DATA_DIR: Path = Path("./data")
    MAPS_DIR: Path = Path("./data/maps")
    BACKGROUNDS_DIR: Path = Path("./data/backgrounds")
    TOKENS_FILE: Path = Path("./data/tokens.json")

    # Sicherheit
    SECRET_KEY: str = "supersecret-change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:8080", "http://127.0.0.1:8080"]

    # Demo / Kiosk
    DEMO_MODE: bool = False
    KIOSK_DEFAULT_INTERVAL: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    def ensure_dirs(self):
        """Erstellt alle benötigten Ordner beim Start"""
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.MAPS_DIR.mkdir(parents=True, exist_ok=True)
        self.BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)


# Globale Instanz
settings = Settings()