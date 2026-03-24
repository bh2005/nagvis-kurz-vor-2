"""Tests für core/auth.py und core/users.py."""

import pytest
from pathlib import Path
from core.users import UserManager
from core.auth  import AuthManager, ROLE_RANK
from fastapi import HTTPException


# ── UserManager ───────────────────────────────────────────────────────────────

class TestUserManager:
    @pytest.fixture
    def um(self, tmp_path):
        return UserManager(tmp_path / "users.json")

    def test_create_and_authenticate(self, um):
        assert um.create_user("alice", "secret", "editor") is True
        user = um.authenticate("alice", "secret")
        assert user is not None
        assert user["username"] == "alice"
        assert user["role"] == "editor"
        assert "pw_hash" not in user

    def test_wrong_password_returns_none(self, um):
        um.create_user("bob", "correct", "viewer")
        assert um.authenticate("bob", "wrong") is None

    def test_unknown_user_returns_none(self, um):
        assert um.authenticate("ghost", "pass") is None

    def test_duplicate_username_returns_false(self, um):
        um.create_user("alice", "pw1", "viewer")
        assert um.create_user("alice", "pw2", "admin") is False

    def test_list_users_no_pw_hash(self, um):
        um.create_user("u1", "pw", "viewer")
        users = um.list_users()
        assert len(users) == 1
        assert "pw_hash" not in users[0]

    def test_delete_user(self, um):
        um.create_user("del", "pw", "viewer")
        assert um.delete_user("del") is True
        assert um.exists("del") is False

    def test_delete_nonexistent_returns_false(self, um):
        assert um.delete_user("ghost") is False

    def test_change_password(self, um):
        um.create_user("pw_user", "old_pw", "viewer")
        assert um.change_password("pw_user", "new_pw") is True
        assert um.authenticate("pw_user", "new_pw") is not None
        assert um.authenticate("pw_user", "old_pw") is None

    def test_change_role(self, um):
        um.create_user("role_user", "pw", "viewer")
        assert um.change_role("role_user", "admin") is True
        users = um.list_users()
        assert users[0]["role"] == "admin"

    def test_count(self, um):
        assert um.count() == 0
        um.create_user("a", "pw", "viewer")
        um.create_user("b", "pw", "viewer")
        assert um.count() == 2

    def test_persistence(self, tmp_path):
        """Daten bleiben nach erneutem Laden erhalten."""
        path = tmp_path / "users.json"
        um1 = UserManager(path)
        um1.create_user("persist_user", "pw", "admin")

        um2 = UserManager(path)
        assert um2.exists("persist_user")
        assert um2.authenticate("persist_user", "pw") is not None


# ── AuthManager ───────────────────────────────────────────────────────────────

class TestAuthManager:
    @pytest.fixture
    def am(self, tmp_path):
        return AuthManager(tmp_path / "tokens.json")

    def test_create_and_verify_token(self, am):
        token = am.create_token("alice", "editor", expires_in=3600)
        assert isinstance(token, str)
        user = am.verify(token)
        assert user.username == "alice"
        assert user.role == "editor"

    def test_invalid_token_raises_401(self, am):
        with pytest.raises(HTTPException) as exc:
            am.verify("not.a.valid.token")
        assert exc.value.status_code == 401

    def test_revoke_token(self, am):
        token = am.create_token("bob", "viewer")
        user  = am.verify(token)
        am.revoke(user.token_id)
        with pytest.raises(HTTPException) as exc:
            am.verify(token)
        assert exc.value.status_code == 401
        assert "widerrufen" in exc.value.detail.lower()

    def test_role_ranks_order(self):
        assert ROLE_RANK["viewer"] < ROLE_RANK["editor"] < ROLE_RANK["admin"]

    def test_list_tokens(self, am):
        am.create_token("alice", "viewer")
        am.create_token("bob",   "admin")
        tokens = am.list_tokens()
        assert len(tokens) == 2
        usernames = {t["username"] for t in tokens}
        assert {"alice", "bob"} == usernames

    def test_no_expiry_token(self, am):
        """Token ohne Ablaufdatum bleibt dauerhaft gültig."""
        token = am.create_token("eternal", "admin", expires_in=None)
        user  = am.verify(token)
        assert user.username == "eternal"
        assert user.expires_at == 0
