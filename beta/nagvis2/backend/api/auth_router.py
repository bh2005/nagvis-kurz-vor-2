"""
NagVis 2 – Auth Router
======================

Endpunkte
---------
POST  /api/v1/auth/login              – Username + Passwort → JWT
POST  /api/v1/auth/refresh            – Neues Token für eingeloggten User
GET   /api/v1/auth/me                 – Aktuell eingeloggter User
PATCH /api/v1/auth/me                 – Eigenes Passwort ändern
POST  /api/v1/auth/logout             – Aktuelles Token widerrufen
GET   /api/v1/auth/config             – Gibt { auth_enabled } zurück (kein Auth nötig)

GET   /api/v1/auth/users              – Alle lokalen User (admin)
POST  /api/v1/auth/users              – Neuen User anlegen (admin)
PATCH /api/v1/auth/users/{username}   – Rolle / Passwort ändern (admin)
DELETE /api/v1/auth/users/{username}  – User löschen (admin)
"""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from fastapi import Request

from core.auth import (
    AuthUser,
    get_auth_manager,
    require_auth,
    require_admin,
    ROLE_RANK,
)
from core.audit import audit_log
from core.config import settings
from core.users import get_user_manager

auth_router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ── Pydantic-Modelle ───────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: Literal["viewer", "editor", "admin"] = "viewer"


class PatchUserRequest(BaseModel):
    role:     Optional[Literal["viewer", "editor", "admin"]] = None
    password: Optional[str] = None


class PatchMeRequest(BaseModel):
    password: str   # Eigenes Passwort ändern


# ── Öffentliche Endpunkte (kein Token nötig) ──────────────────────────────────

@auth_router.get("/config")
async def auth_config():
    """Gibt zurück ob lokale Auth aktiviert ist – ohne Token aufrufbar."""
    return {"auth_enabled": settings.AUTH_ENABLED}


@auth_router.post("/login")
async def login(body: LoginRequest):
    """
    Username + Passwort → JWT-Token.
    Gibt 401 zurück wenn Zugangsdaten falsch.
    """
    um = get_user_manager()
    user = um.authenticate(body.username, body.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Ungültiger Benutzername oder Passwort",
        )
    am   = get_auth_manager()
    # Token läuft nach 7 Tagen ab
    token = am.create_token(user["username"], user["role"], expires_in=86400 * 7)
    return {
        "token":    token,
        "username": user["username"],
        "role":     user["role"],
    }


# ── Geschützte Endpunkte (Token erforderlich) ─────────────────────────────────

@auth_router.post("/refresh")
async def refresh(user: AuthUser = Depends(require_auth)):
    """
    Gibt ein neues Token für den eingeloggten User zurück.
    Das alte Token bleibt noch bis zu seinem Ablaufdatum gültig –
    der Client soll es lokal ersetzen.
    """
    am    = get_auth_manager()
    token = am.create_token(user.username, user.role, expires_in=86400 * 7)
    return {
        "token":    token,
        "username": user.username,
        "role":     user.role,
    }


@auth_router.get("/me")
async def me(user: AuthUser = Depends(require_auth)):
    """Gibt den aktuell eingeloggten User zurück."""
    return {
        "username":   user.username,
        "role":       user.role,
        "expires_at": user.expires_at,
    }


@auth_router.patch("/me")
async def patch_me(
    body: PatchMeRequest,
    request: Request,
    user: AuthUser = Depends(require_auth),
):
    """Eigenes Passwort ändern – für jeden eingeloggten Benutzer."""
    if not body.password or len(body.password) < 6:
        raise HTTPException(400, detail="Passwort muss mindestens 6 Zeichen lang sein")
    get_user_manager().change_password(user.username, body.password)
    audit_log(request, "user.password_change", username=user.username)
    return {"ok": True}


@auth_router.post("/logout")
async def logout(user: AuthUser = Depends(require_auth)):
    """Widerruft das aktuelle Token (Logout)."""
    get_auth_manager().revoke(user.token_id)
    return {"ok": True}


# ── Admin: Benutzerverwaltung ─────────────────────────────────────────────────

@auth_router.get("/users")
async def list_users(_: AuthUser = Depends(require_admin)):
    """Alle lokalen Benutzer anzeigen (admin only)."""
    return get_user_manager().list_users()


@auth_router.post("/users", status_code=201)
async def create_user(
    body: CreateUserRequest,
    request: Request,
    _: AuthUser = Depends(require_admin),
):
    """Neuen Benutzer anlegen (admin only)."""
    if not body.username.strip():
        raise HTTPException(400, detail="Benutzername darf nicht leer sein")
    if body.role not in ROLE_RANK:
        raise HTTPException(400, detail=f"Ungültige Rolle '{body.role}'")
    ok = get_user_manager().create_user(body.username.strip(), body.password, body.role)
    if not ok:
        raise HTTPException(409, detail=f"Benutzer '{body.username}' existiert bereits")
    audit_log(request, "user.create", username=body.username, role=body.role)
    return {"ok": True, "username": body.username, "role": body.role}


@auth_router.patch("/users/{username}")
async def patch_user(
    username: str,
    body: PatchUserRequest,
    request: Request,
    current_user: AuthUser = Depends(require_admin),
):
    """Rolle oder Passwort eines Benutzers ändern (admin only)."""
    um = get_user_manager()
    if not um.exists(username):
        raise HTTPException(404, detail=f"Benutzer '{username}' nicht gefunden")
    if username == current_user.username and body.role and body.role != "admin":
        raise HTTPException(400, detail="Admins können sich selbst nicht degradieren")
    if body.role:
        um.change_role(username, body.role)
        audit_log(request, "user.role_change", username=username, new_role=body.role)
    if body.password:
        um.change_password(username, body.password)
        audit_log(request, "user.password_change", username=username)
    return {"ok": True}


@auth_router.delete("/users/{username}")
async def delete_user(
    username: str,
    request: Request,
    current_user: AuthUser = Depends(require_admin),
):
    """Benutzer löschen (admin only)."""
    if username == current_user.username:
        raise HTTPException(400, detail="Eigenen Account nicht löschbar")
    ok = get_user_manager().delete_user(username)
    if not ok:
        raise HTTPException(404, detail=f"Benutzer '{username}' nicht gefunden")
    audit_log(request, "user.delete", username=username)
    return {"ok": True}
