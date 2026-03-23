"""
core/users.py
=============
Lokale Benutzerverwaltung für NagVis 2.

Speichert Benutzer mit bcrypt-gehashten Passwörtern in data/users.json.
Rollen: viewer | editor | admin

Verwendung
----------
    um = UserManager()
    um.create_user('alice', 'geheim', 'admin')
    user = um.authenticate('alice', 'geheim')  # → dict | None

Singleton-API (für FastAPI-Depends)
-------------------------------------
    set_user_manager(um)   # in main.py
    get_user_manager()     # in Routen
"""

import json
import logging
import time
from pathlib import Path
from typing import Optional

import bcrypt

log = logging.getLogger("nagvis.users")

USERS_FILE = Path("data/users.json")

# ── Singleton ──────────────────────────────────────────────────────────────────

_user_manager: Optional["UserManager"] = None


def set_user_manager(um: "UserManager") -> None:
    global _user_manager
    _user_manager = um


def get_user_manager() -> "UserManager":
    if _user_manager is None:
        raise RuntimeError("UserManager nicht initialisiert – set_user_manager() in main.py aufrufen")
    return _user_manager


# ── UserManager ────────────────────────────────────────────────────────────────

class UserManager:
    """
    Verwaltet lokale Benutzerkonten mit bcrypt-Passwort-Hashing.
    Persistenz via data/users.json.
    """

    def __init__(self, users_file: Path = USERS_FILE):
        self._path   = users_file
        self._users: dict[str, dict] = {}
        self._load()

    # ── Persistenz ───────────────────────────────────────────────────────────

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            self._users = {u["username"]: u for u in data.get("users", [])}
            log.info("Benutzerdatenbank geladen: %d Benutzer", len(self._users))
        except Exception as e:
            log.warning("users.json konnte nicht geladen werden: %s", e)

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        data = {"users": list(self._users.values())}
        self._path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    # ── CRUD ─────────────────────────────────────────────────────────────────

    def create_user(self, username: str, password: str, role: str = "viewer") -> bool:
        """
        Legt einen neuen Benutzer an.
        Gibt False zurück wenn der Benutzername bereits existiert.
        """
        if username in self._users:
            return False
        pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()
        self._users[username] = {
            "username":   username,
            "role":       role,
            "pw_hash":    pw_hash,
            "created_at": int(time.time()),
        }
        self._save()
        log.info("Benutzer angelegt: %s (Rolle: %s)", username, role)
        return True

    def authenticate(self, username: str, password: str) -> Optional[dict]:
        """
        Prüft Benutzername + Passwort.
        Gibt das User-Dict zurück (ohne pw_hash) oder None.
        """
        u = self._users.get(username)
        if not u:
            return None
        try:
            ok = bcrypt.checkpw(password.encode("utf-8"), u["pw_hash"].encode())
        except Exception:
            return None
        if not ok:
            return None
        # pw_hash NICHT zurückgeben
        return {k: v for k, v in u.items() if k != "pw_hash"}

    def list_users(self) -> list[dict]:
        """Alle Benutzer ohne pw_hash zurückgeben."""
        return [
            {k: v for k, v in u.items() if k != "pw_hash"}
            for u in self._users.values()
        ]

    def exists(self, username: str) -> bool:
        return username in self._users

    def delete_user(self, username: str) -> bool:
        if username not in self._users:
            return False
        del self._users[username]
        self._save()
        log.info("Benutzer gelöscht: %s", username)
        return True

    def change_password(self, username: str, new_password: str) -> bool:
        if username not in self._users:
            return False
        self._users[username]["pw_hash"] = bcrypt.hashpw(
            new_password.encode("utf-8"), bcrypt.gensalt()
        ).decode()
        self._save()
        log.info("Passwort geändert: %s", username)
        return True

    def change_role(self, username: str, new_role: str) -> bool:
        if username not in self._users:
            return False
        self._users[username]["role"] = new_role
        self._save()
        log.info("Rolle geändert: %s → %s", username, new_role)
        return True

    def count(self) -> int:
        return len(self._users)
