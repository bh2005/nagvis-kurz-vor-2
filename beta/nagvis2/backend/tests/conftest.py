"""
Gemeinsame Fixtures für alle NagVis-2-Tests.

Jeder Test bekommt ein isoliertes temporäres Datenverzeichnis,
damit Tests sich nicht gegenseitig beeinflussen.
"""

import sys
from pathlib import Path

import pytest

# Backend-Verzeichnis in den Import-Pfad aufnehmen
sys.path.insert(0, str(Path(__file__).parent.parent))


# ── Hilfsfunktion: Einmal importierte Settings-Instanz patchen ────────────────

def _patch_settings(monkeypatch, tmp_path: Path):
    """Überschreibt alle Pfad-Settings auf tmp_path-Unterverzeichnisse."""
    maps_dir   = tmp_path / "maps";        maps_dir.mkdir()
    bg_dir     = tmp_path / "backgrounds"; bg_dir.mkdir()
    thumbs_dir = tmp_path / "thumbnails";  thumbs_dir.mkdir()

    from core import config
    monkeypatch.setattr(config.settings, "DATA_DIR",   tmp_path)
    monkeypatch.setattr(config.settings, "MAPS_DIR",   maps_dir)
    monkeypatch.setattr(config.settings, "BG_DIR",     bg_dir)
    monkeypatch.setattr(config.settings, "THUMBS_DIR", thumbs_dir)

    # Audit-Dateipfad-Cache leeren
    import core.audit as _audit
    monkeypatch.setattr(_audit, "_AUDIT_FILE", None)

    # Users-Datei auf tmp zeigen
    import core.users as _users
    monkeypatch.setattr(_users, "USERS_FILE", tmp_path / "users.json")

    # KIOSK_FILE ist ein Modul-Level-Konstante → direkt patchen
    import core.storage as _storage
    monkeypatch.setattr(_storage, "KIOSK_FILE", tmp_path / "kiosk_users.json")

    return maps_dir, bg_dir, thumbs_dir


@pytest.fixture()
def data_dirs(tmp_path, monkeypatch):
    """Gibt (maps_dir, bg_dir, thumbs_dir) zurück; Settings zeigen auf tmp_path."""
    return _patch_settings(monkeypatch, tmp_path)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """
    FastAPI TestClient mit vollständiger App.
    Lifespan-Start/Stop wird vom TestClient verwaltet.
    """
    _patch_settings(monkeypatch, tmp_path)

    # Poller im Test nicht starten (kein echter Asyncio-Loop nötig)
    import ws.manager as _mgr
    monkeypatch.setattr(_mgr, "start_poller", lambda: None)
    monkeypatch.setattr(_mgr, "stop_poller",  lambda: None)

    # UserManager neu initialisieren (zeigt auf leere tmp-Datei)
    from core.users import UserManager, set_user_manager
    um = UserManager(tmp_path / "users.json")
    set_user_manager(um)

    from core.auth import AuthManager, set_auth_manager
    am = AuthManager(tmp_path / "tokens.json")
    set_auth_manager(am)

    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
