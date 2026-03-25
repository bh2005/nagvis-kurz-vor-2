"""
Zusätzliche Tests für core/auth.py – deckt bisher nicht abgedeckte Pfade ab.
"""

import json
import time
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

import jwt

from core.auth import (
    AuthManager,
    AuthUser,
    JWT_ALGORITHM,
    _DEV_SECRET,
    get_auth_manager,
    set_auth_manager,
    require_auth,
    _require_role,
    ROLE_RANK,
)


@pytest.fixture
def am(tmp_path):
    return AuthManager(token_store=tmp_path / "tokens.json")


# ── Token erstellen ───────────────────────────────────────────────────────────

class TestCreateToken:
    def test_create_token_with_expiry(self, am):
        """expires_in setzt den exp-Claim."""
        token = am.create_token("alice", "editor", expires_in=3600)
        payload = jwt.decode(token, _DEV_SECRET, algorithms=[JWT_ALGORITHM])
        assert "exp" in payload
        assert payload["exp"] > int(time.time())

    def test_create_token_invalid_role_raises(self, am):
        with pytest.raises(ValueError, match="Ungültige Rolle"):
            am.create_token("alice", "superuser")

    def test_create_token_no_expiry_has_no_exp(self, am):
        token = am.create_token("bob", "viewer")
        payload = jwt.decode(token, _DEV_SECRET, algorithms=[JWT_ALGORITHM])
        assert "exp" not in payload


# ── Token verifizieren ────────────────────────────────────────────────────────

class TestVerify:
    def test_expired_token_raises_401(self, am):
        from fastapi import HTTPException
        # Token mit abgelaufener Zeit erstellen
        payload = {"sub": "alice", "role": "viewer", "jti": "test", "iat": 1, "exp": 1}
        token = jwt.encode(payload, _DEV_SECRET, algorithm=JWT_ALGORITHM)
        with pytest.raises(HTTPException) as exc:
            am.verify(token)
        assert exc.value.status_code == 401
        assert "abgelaufen" in exc.value.detail

    def test_invalid_token_raises_401(self, am):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            am.verify("this.is.not.a.valid.token")
        assert exc.value.status_code == 401

    def test_revoked_token_raises_401(self, am):
        from fastapi import HTTPException
        token = am.create_token("alice", "viewer")
        payload = jwt.decode(token, _DEV_SECRET, algorithms=[JWT_ALGORITHM])
        am.revoke(payload["jti"])
        with pytest.raises(HTTPException) as exc:
            am.verify(token)
        assert exc.value.status_code == 401
        assert "widerrufen" in exc.value.detail


# ── verify_ws_token ───────────────────────────────────────────────────────────

class TestVerifyWsToken:
    def test_no_token_raises_ws_exception(self, am):
        from fastapi import WebSocketException
        ws = MagicMock()
        ws.query_params = {}
        with pytest.raises(WebSocketException) as exc:
            am.verify_ws_token(ws)
        assert exc.value.code == 4001

    def test_valid_token_returns_user(self, am):
        token = am.create_token("alice", "editor")
        ws = MagicMock()
        ws.query_params = {"token": token}
        user = am.verify_ws_token(ws)
        assert user.username == "alice"
        assert user.role == "editor"

    def test_invalid_token_raises_ws_exception(self, am):
        from fastapi import WebSocketException
        ws = MagicMock()
        ws.query_params = {"token": "bad.token.here"}
        with pytest.raises(WebSocketException) as exc:
            am.verify_ws_token(ws)
        assert exc.value.code == 4001


# ── _load_revoked / _persist_revoked Fehlerbehandlung ────────────────────────

class TestRevocationPersistence:
    def test_load_revoked_corrupt_file_is_tolerated(self, tmp_path):
        store = tmp_path / "tokens.json"
        store.write_text("NOT JSON{{{", encoding="utf-8")
        # Darf keinen Fehler werfen
        am = AuthManager(token_store=store)
        assert am._revoked == set()

    def test_persist_revoked_write_error_is_tolerated(self, tmp_path):
        store = tmp_path / "tokens.json"
        am = AuthManager(token_store=store)
        # Path-Instanzen unterstützen kein patch.object → _store_path durch Mock ersetzen
        mock_path = MagicMock(spec=Path)
        mock_path.exists.return_value = False
        mock_path.write_text.side_effect = OSError("disk full")
        am._store_path = mock_path
        am._persist_revoked()   # darf keinen Fehler werfen

    def test_save_token_meta_write_error_is_tolerated(self, tmp_path):
        store = tmp_path / "tokens.json"
        am = AuthManager(token_store=store)
        mock_path = MagicMock(spec=Path)
        mock_path.exists.return_value = False
        mock_path.parent.mkdir.return_value = None
        mock_path.write_text.side_effect = OSError("disk full")
        am._store_path = mock_path
        am._save_token_meta("jti1", "alice", "viewer", None)  # darf keinen Fehler werfen


# ── list_tokens ───────────────────────────────────────────────────────────────

class TestListTokens:
    def test_list_tokens_no_store_returns_empty(self, tmp_path):
        am = AuthManager(token_store=tmp_path / "nonexistent.json")
        assert am.list_tokens() == []

    def test_list_tokens_corrupt_file_returns_empty(self, tmp_path):
        store = tmp_path / "tokens.json"
        store.write_text("NOT JSON", encoding="utf-8")
        am = AuthManager(token_store=store)
        assert am.list_tokens() == []

    def test_list_tokens_shows_revoked_flag(self, tmp_path):
        am = AuthManager(token_store=tmp_path / "t.json")
        token = am.create_token("alice", "viewer")
        payload = jwt.decode(token, _DEV_SECRET, algorithms=[JWT_ALGORITHM])
        am.revoke(payload["jti"])
        tokens = am.list_tokens()
        assert any(t["revoked"] for t in tokens)


# ── get_auth_manager ──────────────────────────────────────────────────────────

class TestGetAuthManager:
    def test_get_auth_manager_uninitialized_raises(self):
        import core.auth as _auth
        original = _auth._auth_manager
        try:
            _auth._auth_manager = None
            with pytest.raises(RuntimeError, match="nicht initialisiert"):
                get_auth_manager()
        finally:
            _auth._auth_manager = original


# ── require_auth (AUTH_ENABLED=true, kein Token) ─────────────────────────────

class TestRequireAuth:
    def test_require_auth_missing_credentials_raises_401(self, tmp_path, monkeypatch):
        from fastapi import HTTPException
        from core.config import settings
        import core.auth as _auth
        monkeypatch.setattr(settings, "AUTH_ENABLED", True)
        # require_auth ruft get_auth_manager() VOR der Credentials-Prüfung auf
        monkeypatch.setattr(_auth, "_auth_manager", AuthManager(token_store=tmp_path / "t.json"))

        with pytest.raises(HTTPException) as exc:
            require_auth(credentials=None)
        assert exc.value.status_code == 401

    def test_require_auth_disabled_returns_anon_admin(self, monkeypatch):
        from core.config import settings
        monkeypatch.setattr(settings, "AUTH_ENABLED", False)
        user = require_auth(credentials=None)
        assert user.role == "admin"
        assert user.username == "admin"

    def test_require_role_insufficient_raises_403(self, tmp_path, monkeypatch):
        from fastapi import HTTPException
        from core.config import settings
        monkeypatch.setattr(settings, "AUTH_ENABLED", False)

        dep = _require_role("admin")
        viewer_user = AuthUser(username="alice", role="viewer",
                               token_id="abc", expires_at=0)
        with pytest.raises(HTTPException) as exc:
            dep(user=viewer_user)
        assert exc.value.status_code == 403
