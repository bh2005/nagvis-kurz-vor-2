"""
core/auth.py
============
Token-Authentifizierung und Rollenprüfung für NagVis 2.

Konzept
-------
  - Stateless JWT-Bearer-Tokens (kein Session-State auf dem Server)
  - Drei Rollen mit kumulativen Rechten:
      viewer  → GET-Routen, WebSocket (read-only)
      editor  → + Map-Objekte anlegen/verschieben/löschen, Hintergrund hochladen
      admin   → + Maps anlegen/löschen/umbenennen, Backends verwalten
  - Tokens werden in tokens.json verwaltet (Name + Rolle + optional Ablaufdatum)
  - Secret Key in Umgebungsvariable NAGVIS_SECRET (Fallback: Warnung + dev-key)

Verwendung in Routen
--------------------
  # Nur authentifiziert (jede Rolle):
  async def my_route(user: AuthUser = Depends(require_auth)):

  # Mindest-Rolle editor:
  async def my_route(user: AuthUser = Depends(require_editor)):

  # Mindest-Rolle admin:
  async def my_route(user: AuthUser = Depends(require_admin)):

WebSocket-Auth
--------------
  Browser übergibt Token als Query-Parameter:
    ws://host/ws/map/my-map?token=<jwt>

  Im Handler:
    user = auth.verify_ws_token(websocket)  # wirft WebSocketException bei Fehler

Token erzeugen (CLI)
--------------------
  python3 -c "
  from backend.core.auth import AuthManager
  am = AuthManager()
  print(am.create_token('alice', 'editor'))
  "

  Oder über den Admin-Endpunkt:
    POST /api/auth/tokens   { name: 'alice', role: 'editor' }
    → { token: '...' }
"""

from __future__ import annotations

import json
import logging
import os
import secrets
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import jwt
from fastapi import Depends, HTTPException, WebSocket, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

log = logging.getLogger("nagvis.auth")

# ── Konstanten ────────────────────────────────────────────────────────────────

Role = Literal["viewer", "editor", "admin"]

ROLE_RANK: dict[str, int] = {
    "viewer": 1,
    "editor": 2,
    "admin":  3,
}

JWT_ALGORITHM  = "HS256"
TOKEN_STORE    = Path("data/tokens.json")   # persistierte Token-Metadaten
_DEV_SECRET    = "nagvis-dev-secret-CHANGE-IN-PRODUCTION"

# ── Datenklassen ──────────────────────────────────────────────────────────────

@dataclass
class AuthUser:
    """Eingeloggter User – wird in Request.state.user gespeichert."""
    username:   str
    role:       str
    token_id:   str     # jti-Claim – für Revocation
    expires_at: float   # 0 = kein Ablaufdatum


# ── Auth-Manager ──────────────────────────────────────────────────────────────

class AuthManager:
    """
    Verwaltet JWT-Erstellung, Verifikation und Token-Persistenz.

    Der Secret Key wird aus der Umgebungsvariable NAGVIS_SECRET gelesen.
    Fehlt die Variable, wird ein Dev-Key verwendet und eine Warnung geloggt.
    """

    def __init__(self, token_store: Path = TOKEN_STORE):
        self._store_path = token_store
        self._secret     = self._load_secret()
        self._revoked:   set[str] = set()   # jti-Werte revozierter Tokens
        self._load_revoked()

    # ── Secret ───────────────────────────────────────────────────────────────

    def _load_secret(self) -> str:
        secret = os.environ.get("NAGVIS_SECRET", "")
        if not secret:
            log.warning(
                "NAGVIS_SECRET nicht gesetzt – Dev-Key aktiv! "
                "Niemals in Produktion verwenden."
            )
            return _DEV_SECRET
        return secret

    # ── Token erstellen ───────────────────────────────────────────────────────

    def create_token(
        self,
        username:   str,
        role:       Role,
        expires_in: int | None = None,   # Sekunden; None = kein Ablaufdatum
    ) -> str:
        """
        Erzeugt ein signiertes JWT und speichert die Metadaten in tokens.json.

        expires_in: z.B. 86400 für 24h, None für unbegrenzt.
        """
        if role not in ROLE_RANK:
            raise ValueError(f"Ungültige Rolle '{role}'. Erlaubt: {list(ROLE_RANK)}")

        jti = secrets.token_hex(16)
        now = int(time.time())

        payload: dict = {
            "sub":  username,
            "role": role,
            "jti":  jti,
            "iat":  now,
        }
        if expires_in:
            payload["exp"] = now + expires_in

        token = jwt.encode(payload, self._secret, algorithm=JWT_ALGORITHM)

        # Metadaten persistieren (für Übersicht + Revocation)
        self._save_token_meta(jti, username, role, expires_in)
        log.info("Token erstellt: user=%s role=%s jti=%s", username, role, jti[:8])
        return token

    # ── Token verifizieren ────────────────────────────────────────────────────

    def verify(self, token: str) -> AuthUser:
        """
        Verifiziert JWT-Signatur, Ablaufdatum und Revocation-Status.
        Wirft HTTPException 401 bei Fehler.
        """
        try:
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=[JWT_ALGORITHM],
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token abgelaufen",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Ungültiges Token: {e}",
                headers={"WWW-Authenticate": "Bearer"},
            )

        jti = payload.get("jti", "")
        if jti in self._revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token wurde widerrufen",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return AuthUser(
            username   = payload.get("sub", "unknown"),
            role       = payload.get("role", "viewer"),
            token_id   = jti,
            expires_at = payload.get("exp", 0),
        )

    def verify_ws_token(self, websocket: WebSocket) -> AuthUser:
        """
        WebSocket-Variante: liest Token aus Query-Parameter ?token=...
        Wirft WebSocketException 4001 bei Fehler.
        """
        from fastapi import WebSocketException
        token = websocket.query_params.get("token", "")
        if not token:
            raise WebSocketException(code=4001, reason="Token fehlt")
        try:
            return self.verify(token)
        except HTTPException as e:
            raise WebSocketException(code=4001, reason=e.detail)

    # ── Revocation ────────────────────────────────────────────────────────────

    def revoke(self, jti: str) -> bool:
        """Token per jti widerrufen."""
        self._revoked.add(jti)
        self._persist_revoked()
        log.info("Token widerrufen: jti=%s", jti[:8])
        return True

    def _load_revoked(self):
        """Revocation-Liste aus tokens.json laden."""
        if not self._store_path.exists():
            return
        try:
            data = json.loads(self._store_path.read_text())
            self._revoked = set(data.get("revoked", []))
        except Exception as e:
            log.warning("Revocation-Liste konnte nicht geladen werden: %s", e)

    def _persist_revoked(self):
        """Revocation-Liste in tokens.json zurückschreiben."""
        try:
            data = {}
            if self._store_path.exists():
                data = json.loads(self._store_path.read_text())
            data["revoked"] = list(self._revoked)
            self._store_path.write_text(json.dumps(data, indent=2))
        except Exception as e:
            log.error("Revocation-Liste konnte nicht gespeichert werden: %s", e)

    def _save_token_meta(
        self,
        jti:        str,
        username:   str,
        role:       str,
        expires_in: int | None,
    ):
        """Token-Metadaten anhängen – für Übersicht in GET /api/auth/tokens."""
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            data: dict = {}
            if self._store_path.exists():
                data = json.loads(self._store_path.read_text())
            tokens: list = data.get("tokens", [])
            tokens.append({
                "jti":        jti,
                "username":   username,
                "role":       role,
                "created_at": int(time.time()),
                "expires_in": expires_in,
            })
            data["tokens"] = tokens
            self._store_path.write_text(json.dumps(data, indent=2))
        except Exception as e:
            log.error("Token-Meta konnte nicht gespeichert werden: %s", e)

    def list_tokens(self) -> list[dict]:
        """Alle bekannten Tokens (ohne den JWT-String selbst)."""
        if not self._store_path.exists():
            return []
        try:
            data = json.loads(self._store_path.read_text())
            return [
                {**t, "revoked": t["jti"] in self._revoked}
                for t in data.get("tokens", [])
            ]
        except Exception:
            return []


# ── FastAPI Dependency-Funktionen ─────────────────────────────────────────────
# Werden als Depends() in Route-Definitionen verwendet.

_bearer = HTTPBearer(auto_error=False)

# Singleton – wird in main.py initialisiert und hier referenziert
_auth_manager: AuthManager | None = None

def set_auth_manager(am: AuthManager):
    global _auth_manager
    _auth_manager = am

def get_auth_manager() -> AuthManager:
    if _auth_manager is None:
        raise RuntimeError("AuthManager nicht initialisiert")
    return _auth_manager


_ANON_ADMIN = AuthUser(username="admin", role="admin", token_id="anon", expires_at=0)


def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> AuthUser:
    """Dependency: authentifiziert, jede Rolle.
    Wenn AUTH_ENABLED=false: gibt anonymen Admin-User zurück (offener Betrieb)."""
    from core.config import settings
    if not settings.AUTH_ENABLED:
        return _ANON_ADMIN
    am = get_auth_manager()
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization-Header fehlt",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return am.verify(credentials.credentials)


def _require_role(min_role: str):
    """Factory für Rollen-Dependencies."""
    def dependency(user: AuthUser = Depends(require_auth)) -> AuthUser:
        if ROLE_RANK.get(user.role, 0) < ROLE_RANK[min_role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rolle '{user.role}' hat keinen Zugriff. "
                       f"Mindestens '{min_role}' erforderlich.",
            )
        return user
    return dependency


require_viewer = _require_role("viewer")   # = require_auth (alle eingeloggten)
require_editor = _require_role("editor")
require_admin  = _require_role("admin")