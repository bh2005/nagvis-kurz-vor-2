"""Tests für api/auth_router.py – Login, Refresh, Me, User-CRUD."""

import pytest


# ── Fixture: Client mit AUTH_ENABLED=true ─────────────────────────────────────

@pytest.fixture()
def auth_client(tmp_path, monkeypatch):
    """TestClient mit aktivierter Authentifizierung."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))

    maps_dir   = tmp_path / "maps";        maps_dir.mkdir()
    bg_dir     = tmp_path / "backgrounds"; bg_dir.mkdir()
    thumbs_dir = tmp_path / "thumbnails";  thumbs_dir.mkdir()

    from core import config
    monkeypatch.setattr(config.settings, "DATA_DIR",   tmp_path)
    monkeypatch.setattr(config.settings, "MAPS_DIR",   maps_dir)
    monkeypatch.setattr(config.settings, "BG_DIR",     bg_dir)
    monkeypatch.setattr(config.settings, "THUMBS_DIR", thumbs_dir)
    monkeypatch.setattr(config.settings, "AUTH_ENABLED", True)

    import core.audit as _audit
    monkeypatch.setattr(_audit, "_AUDIT_FILE", None)

    import core.users as _users
    monkeypatch.setattr(_users, "USERS_FILE", tmp_path / "users.json")

    import core.storage as _storage
    monkeypatch.setattr(_storage, "KIOSK_FILE", tmp_path / "kiosk_users.json")

    import ws.manager as _mgr
    monkeypatch.setattr(_mgr, "start_poller", lambda: None)
    monkeypatch.setattr(_mgr, "stop_poller",  lambda: None)

    from core.users import UserManager, set_user_manager
    um = UserManager(tmp_path / "users.json")
    um.create_user("admin", "admin123", "admin")
    set_user_manager(um)

    from core.auth import AuthManager, set_auth_manager
    am = AuthManager(tmp_path / "tokens.json")
    set_auth_manager(am)

    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def _login(client, username="admin", password="admin123"):
    r = client.post("/api/v1/auth/login",
                    json={"username": username, "password": password})
    assert r.status_code == 200
    return r.json()["token"]


# ── /auth/config ──────────────────────────────────────────────────────────────

class TestAuthConfig:
    def test_config_returns_auth_enabled(self, auth_client):
        r = auth_client.get("/api/v1/auth/config")
        assert r.status_code == 200
        assert r.json()["auth_enabled"] is True


# ── /auth/login ───────────────────────────────────────────────────────────────

class TestLogin:
    def test_valid_credentials_return_token(self, auth_client):
        r = auth_client.post("/api/v1/auth/login",
                             json={"username": "admin", "password": "admin123"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["username"] == "admin"
        assert data["role"] == "admin"

    def test_wrong_password_returns_401(self, auth_client):
        r = auth_client.post("/api/v1/auth/login",
                             json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_unknown_user_returns_401(self, auth_client):
        r = auth_client.post("/api/v1/auth/login",
                             json={"username": "nobody", "password": "x"})
        assert r.status_code == 401


# ── /auth/me (GET + PATCH) ────────────────────────────────────────────────────

class TestMe:
    def test_me_returns_current_user(self, auth_client):
        token = _login(auth_client)
        r = auth_client.get("/api/v1/auth/me",
                            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["username"] == "admin"

    def test_me_without_token_returns_401(self, auth_client):
        r = auth_client.get("/api/v1/auth/me")
        assert r.status_code == 401

    def test_patch_me_changes_password(self, auth_client):
        token = _login(auth_client)
        r = auth_client.patch("/api/v1/auth/me",
                              json={"password": "newpass1"},
                              headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        # Old password should no longer work
        r2 = auth_client.post("/api/v1/auth/login",
                              json={"username": "admin", "password": "admin123"})
        assert r2.status_code == 401

    def test_patch_me_short_password_returns_400(self, auth_client):
        token = _login(auth_client)
        r = auth_client.patch("/api/v1/auth/me",
                              json={"password": "abc"},
                              headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 400


# ── /auth/refresh ─────────────────────────────────────────────────────────────

class TestRefresh:
    def test_refresh_returns_new_token(self, auth_client):
        token = _login(auth_client)
        r = auth_client.post("/api/v1/auth/refresh",
                             headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_refresh_without_token_returns_401(self, auth_client):
        r = auth_client.post("/api/v1/auth/refresh")
        assert r.status_code == 401


# ── /auth/logout ──────────────────────────────────────────────────────────────

class TestLogout:
    def test_logout_revokes_token(self, auth_client):
        token = _login(auth_client)
        r = auth_client.post("/api/v1/auth/logout",
                             headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # Token should now be invalid
        r2 = auth_client.get("/api/v1/auth/me",
                             headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 401


# ── /auth/users (admin CRUD) ──────────────────────────────────────────────────

class TestUserCrud:
    def test_list_users(self, auth_client):
        token = _login(auth_client)
        r = auth_client.get("/api/v1/auth/users",
                            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        usernames = [u["username"] for u in r.json()]
        assert "admin" in usernames

    def test_create_user(self, auth_client):
        token = _login(auth_client)
        r = auth_client.post("/api/v1/auth/users",
                             json={"username": "viewer1", "password": "pass123",
                                   "role": "viewer"},
                             headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 201
        assert r.json()["username"] == "viewer1"

    def test_create_duplicate_user_returns_409(self, auth_client):
        token = _login(auth_client)
        auth_client.post("/api/v1/auth/users",
                         json={"username": "dup", "password": "pass123"},
                         headers={"Authorization": f"Bearer {token}"})
        r = auth_client.post("/api/v1/auth/users",
                             json={"username": "dup", "password": "pass123"},
                             headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 409

    def test_create_empty_username_returns_400(self, auth_client):
        token = _login(auth_client)
        r = auth_client.post("/api/v1/auth/users",
                             json={"username": "  ", "password": "pass123"},
                             headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 400

    def test_patch_user_role(self, auth_client):
        token = _login(auth_client)
        auth_client.post("/api/v1/auth/users",
                         json={"username": "ed1", "password": "pass123", "role": "viewer"},
                         headers={"Authorization": f"Bearer {token}"})
        r = auth_client.patch("/api/v1/auth/users/ed1",
                              json={"role": "editor"},
                              headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200

    def test_patch_user_not_found_returns_404(self, auth_client):
        token = _login(auth_client)
        r = auth_client.patch("/api/v1/auth/users/nobody",
                              json={"role": "viewer"},
                              headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 404

    def test_delete_user(self, auth_client):
        token = _login(auth_client)
        auth_client.post("/api/v1/auth/users",
                         json={"username": "todel", "password": "pass123"},
                         headers={"Authorization": f"Bearer {token}"})
        r = auth_client.delete("/api/v1/auth/users/todel",
                               headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200

    def test_delete_self_returns_400(self, auth_client):
        token = _login(auth_client)
        r = auth_client.delete("/api/v1/auth/users/admin",
                               headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 400

    def test_delete_nonexistent_returns_404(self, auth_client):
        token = _login(auth_client)
        r = auth_client.delete("/api/v1/auth/users/ghost",
                               headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 404

    def test_patch_user_password(self, auth_client):
        token = _login(auth_client)
        auth_client.post("/api/v1/auth/users",
                         json={"username": "pwuser", "password": "oldpass1"},
                         headers={"Authorization": f"Bearer {token}"})
        r = auth_client.patch("/api/v1/auth/users/pwuser",
                              json={"password": "newpass1"},
                              headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200

    def test_list_users_requires_admin(self, auth_client):
        # Create a viewer and try to list users
        admin_token = _login(auth_client)
        auth_client.post("/api/v1/auth/users",
                         json={"username": "view2", "password": "pass123",
                               "role": "viewer"},
                         headers={"Authorization": f"Bearer {admin_token}"})
        viewer_token = _login(auth_client, "view2", "pass123")
        r = auth_client.get("/api/v1/auth/users",
                            headers={"Authorization": f"Bearer {viewer_token}"})
        assert r.status_code == 403
