"""
tests/test_auth.py
==================
Unit-Tests für backend/core/auth.py.

Abgedeckt
---------
  AuthManager.create_token()   – Erzeugung, Payload-Inhalt
  AuthManager.verify()         – gültig, abgelaufen, falsches Secret, widerrufen
  AuthManager.revoke()         – Token nach Revocation abgelehnt
  AuthManager.list_tokens()    – Metadaten-Persistenz
  require_viewer/editor/admin  – Rollen-Hierarchie (Depends-Logik)
  verify_ws_token()            – Token aus Query-Parameter
"""

import asyncio
import time
from pathlib import Path
from unittest.mock import MagicMock

import jwt
import pytest

from backend.core.auth import (
    AuthManager,
    AuthUser,
    ROLE_RANK,
    _require_role,
    require_viewer,
    require_editor,
    require_admin,
    set_auth_manager,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

SECRET = "test-secret-key-not-for-production"

@pytest.fixture
def am(tmp_path):
    """AuthManager mit tmpdir-Store und bekanntem Secret."""
    import os
    os.environ["NAGVIS_SECRET"] = SECRET
    manager = AuthManager(token_store=tmp_path / "tokens.json")
    # Singleton für Depends()-Tests
    set_auth_manager(manager)
    yield manager
    del os.environ["NAGVIS_SECRET"]


def _decode(token: str) -> dict:
    """Hilfsfunktion: JWT ohne Verifikation dekodieren."""
    return jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256"])


# ── create_token ──────────────────────────────────────────────────────────────

def test_create_token_returns_string(am):
    token = am.create_token("alice", "viewer")
    assert isinstance(token, str)
    assert len(token) > 20


def test_create_token_payload_claims(am):
    token = am.create_token("alice", "editor")
    payload = _decode(token)
    assert payload["sub"]  == "alice"
    assert payload["role"] == "editor"
    assert "jti" in payload
    assert "iat" in payload


def test_create_token_with_expiry(am):
    token = am.create_token("bob", "viewer", expires_in=3600)
    payload = _decode(token)
    assert "exp" in payload
    assert payload["exp"] > int(time.time())


def test_create_token_without_expiry(am):
    token = am.create_token("bob", "viewer", expires_in=None)
    payload = _decode(token)
    assert "exp" not in payload


def test_create_token_invalid_role(am):
    with pytest.raises(ValueError, match="Ungültige Rolle"):
        am.create_token("alice", "superuser")


def test_create_token_persists_metadata(am, tmp_path):
    am.create_token("alice", "editor")
    tokens = am.list_tokens()
    assert len(tokens) == 1
    assert tokens[0]["username"] == "alice"
    assert tokens[0]["role"]     == "editor"
    assert tokens[0]["revoked"]  is False


# ── verify ────────────────────────────────────────────────────────────────────

def test_verify_valid_token(am):
    token = am.create_token("alice", "editor")
    user  = am.verify(token)
    assert user.username == "alice"
    assert user.role     == "editor"
    assert isinstance(user.token_id, str)


def test_verify_wrong_secret(am):
    from fastapi import HTTPException
    # Token mit anderem Secret signiert
    bad_token = jwt.encode(
        {"sub": "hacker", "role": "admin", "jti": "x"},
        "wrong-secret",
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc_info:
        am.verify(bad_token)
    assert exc_info.value.status_code == 401


def test_verify_expired_token(am):
    from fastapi import HTTPException
    expired = jwt.encode(
        {"sub": "alice", "role": "viewer", "jti": "y", "exp": int(time.time()) - 1},
        SECRET,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc_info:
        am.verify(expired)
    assert exc_info.value.status_code == 401
    assert "abgelaufen" in exc_info.value.detail


def test_verify_malformed_token(am):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        am.verify("this.is.not.a.jwt")
    assert exc_info.value.status_code == 401


# ── revoke ────────────────────────────────────────────────────────────────────

def test_revoke_token(am):
    from fastapi import HTTPException
    token = am.create_token("alice", "viewer")
    payload = _decode(token)
    jti = payload["jti"]

    # Vor Revocation gültig
    user = am.verify(token)
    assert user.username == "alice"

    # Widerrufen
    am.revoke(jti)

    # Danach abgelehnt
    with pytest.raises(HTTPException) as exc_info:
        am.verify(token)
    assert exc_info.value.status_code == 401
    assert "widerrufen" in exc_info.value.detail


def test_revoke_persists_across_instances(am, tmp_path):
    """Revocation bleibt nach Neustart des AuthManagers erhalten."""
    import os
    os.environ["NAGVIS_SECRET"] = SECRET

    store = tmp_path / "tokens.json"
    am2   = AuthManager(token_store=store)
    token = am2.create_token("bob", "editor")
    jti   = _decode(token)["jti"]
    am2.revoke(jti)

    # Neuer Manager – lädt Revocation aus Datei
    am3 = AuthManager(token_store=store)
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        am3.verify(token)


def test_list_tokens_shows_revoked_flag(am):
    token = am.create_token("alice", "viewer")
    jti   = _decode(token)["jti"]
    assert am.list_tokens()[0]["revoked"] is False

    am.revoke(jti)
    assert am.list_tokens()[0]["revoked"] is True


# ── Rollen-Hierarchie ─────────────────────────────────────────────────────────

def _user(role: str) -> AuthUser:
    return AuthUser(username="test", role=role, token_id="x", expires_at=0)


def test_role_rank_order():
    assert ROLE_RANK["viewer"] < ROLE_RANK["editor"] < ROLE_RANK["admin"]


def test_require_editor_rejects_viewer():
    from fastapi import HTTPException
    viewer = _user("viewer")
    dep    = _require_role("editor")
    with pytest.raises(HTTPException) as exc_info:
        dep(viewer)
    assert exc_info.value.status_code == 403


def test_require_editor_accepts_editor():
    editor = _user("editor")
    dep    = _require_role("editor")
    result = dep(editor)
    assert result.role == "editor"


def test_require_editor_accepts_admin():
    """Admin hat alle Editor-Rechte (kumulative Rollen)."""
    admin  = _user("admin")
    dep    = _require_role("editor")
    result = dep(admin)
    assert result.role == "admin"


def test_require_admin_rejects_editor():
    from fastapi import HTTPException
    editor = _user("editor")
    dep    = _require_role("admin")
    with pytest.raises(HTTPException) as exc_info:
        dep(editor)
    assert exc_info.value.status_code == 403


def test_require_viewer_accepts_all_roles():
    dep = _require_role("viewer")
    for role in ("viewer", "editor", "admin"):
        result = dep(_user(role))
        assert result.role == role


# ── verify_ws_token ───────────────────────────────────────────────────────────

def _mock_websocket(token: str = "") -> MagicMock:
    ws = MagicMock()
    ws.query_params = {"token": token} if token else {}
    return ws


def test_verify_ws_token_valid(am):
    token = am.create_token("alice", "viewer")
    ws    = _mock_websocket(token)
    user  = am.verify_ws_token(ws)
    assert user.username == "alice"


def test_verify_ws_token_missing(am):
    from fastapi import WebSocketException
    ws = _mock_websocket("")   # kein token-Parameter
    with pytest.raises(WebSocketException) as exc_info:
        am.verify_ws_token(ws)
    assert exc_info.value.code == 4001


def test_verify_ws_token_invalid(am):
    from fastapi import WebSocketException
    ws = _mock_websocket("garbage.token.value")
    with pytest.raises(WebSocketException) as exc_info:
        am.verify_ws_token(ws)
    assert exc_info.value.code == 4001