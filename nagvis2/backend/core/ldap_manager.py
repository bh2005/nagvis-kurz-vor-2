"""
core/ldap_manager.py
====================
LDAP-Verbindungsverwaltung für NagVis 2.

Unterstützt mehrere LDAP/AD-Verbindungen mit konfigurierbarer
Gruppen-zu-Rollen-Zuordnung.

Persistenz: data/ldap.json
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

log = logging.getLogger("nagvis.ldap")

LDAP_FILE = Path("data/ldap.json")

# ── Singleton ─────────────────────────────────────────────────────────────────

_ldap_manager: Optional["LdapManager"] = None


def set_ldap_manager(lm: "LdapManager") -> None:
    global _ldap_manager
    _ldap_manager = lm


def get_ldap_manager() -> "LdapManager":
    if _ldap_manager is None:
        raise RuntimeError("LdapManager nicht initialisiert")
    return _ldap_manager


# ── Datenklassen ──────────────────────────────────────────────────────────────

@dataclass
class LdapConnection:
    id:             str
    name:           str                  # Anzeigename (z.B. "Firmen-AD")
    server_url:     str                  # ldap://host:389  oder  ldaps://host:636
    bind_dn:        str                  # Service-Account DN
    bind_password:  str                  # Passwort (im RAM, nie im Browser)
    user_base_dn:   str                  # Basis für User-Suche
    user_filter:    str  = "(sAMAccountName={username})"
    group_base_dn:  str  = ""
    group_filter:   str  = "(member={user_dn})"
    # Gruppen-DN (oder CN) → Rolle (viewer|editor|admin)
    group_role_map: dict  = field(default_factory=dict)
    default_role:   str   = "viewer"     # Fallback wenn keine Gruppe passt
    enabled:        bool  = True
    verify_cert:    bool  = True
    timeout:        int   = 5            # Sekunden

    def safe_dict(self) -> dict:
        """Gibt die Konfiguration ohne Passwort zurück."""
        d = asdict(self)
        d["bind_password"] = "***" if self.bind_password else ""
        return d


# ── LdapManager ───────────────────────────────────────────────────────────────

class LdapManager:
    def __init__(self, config_path: Path = LDAP_FILE):
        self._path    = config_path
        self._conns:  dict[str, LdapConnection] = {}
        self._load()

    # ── Persistenz ────────────────────────────────────────────────────────────

    def _load(self):
        if not self._path.exists():
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            for entry in data.get("connections", []):
                c = LdapConnection(**entry)
                self._conns[c.id] = c
        except Exception as e:
            log.error("Fehler beim Laden von ldap.json: %s", e)

    def _save(self):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        data = {"connections": [asdict(c) for c in self._conns.values()]}
        self._path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def list_connections(self) -> list[dict]:
        return [c.safe_dict() for c in self._conns.values()]

    def get(self, conn_id: str) -> Optional[LdapConnection]:
        return self._conns.get(conn_id)

    def add(self, **kwargs) -> LdapConnection:
        conn_id = str(uuid.uuid4())[:8]
        c = LdapConnection(id=conn_id, **kwargs)
        self._conns[conn_id] = c
        self._save()
        return c

    def update(self, conn_id: str, **kwargs) -> Optional[LdapConnection]:
        c = self._conns.get(conn_id)
        if not c:
            return None
        for k, v in kwargs.items():
            if v is not None and hasattr(c, k):
                setattr(c, k, v)
        self._save()
        return c

    def delete(self, conn_id: str) -> bool:
        if conn_id not in self._conns:
            return False
        del self._conns[conn_id]
        self._save()
        return True

    # ── Verbindungstest ───────────────────────────────────────────────────────

    def test_connection(self, conn_id: str) -> dict:
        """Testet die LDAP-Verbindung. Gibt { ok, message } zurück."""
        c = self._conns.get(conn_id)
        if not c:
            return {"ok": False, "message": "Verbindung nicht gefunden"}
        try:
            from ldap3 import Server, Connection, ALL, NTLM
            import ldap3
            server = Server(c.server_url, get_info=ALL, connect_timeout=c.timeout)
            conn   = Connection(server, user=c.bind_dn, password=c.bind_password,
                                auto_bind=True)
            conn.unbind()
            return {"ok": True, "message": f"Verbunden mit {c.server_url}"}
        except ImportError:
            return {"ok": False, "message": "ldap3-Bibliothek nicht installiert (pip install ldap3)"}
        except Exception as e:
            return {"ok": False, "message": str(e)}

    # ── Authentifizierung ─────────────────────────────────────────────────────

    def authenticate(self, username: str, password: str) -> Optional[dict]:
        """
        Versucht den User gegen alle aktiven LDAP-Verbindungen zu authentifizieren.
        Gibt { username, role, source } zurück oder None.
        """
        for c in self._conns.values():
            if not c.enabled:
                continue
            result = self._auth_one(c, username, password)
            if result:
                return result
        return None

    def _auth_one(self, c: LdapConnection, username: str, password: str) -> Optional[dict]:
        try:
            from ldap3 import Server, Connection, ALL, SUBTREE
            server   = Server(c.server_url, get_info=ALL, connect_timeout=c.timeout)
            # Bind als Service-Account um User-DN aufzulösen
            svc_conn = Connection(server, user=c.bind_dn, password=c.bind_password, auto_bind=True)
            user_filter = c.user_filter.replace("{username}", username)
            svc_conn.search(c.user_base_dn, user_filter, attributes=["distinguishedName", "memberOf"])
            if not svc_conn.entries:
                svc_conn.unbind()
                return None
            user_dn = str(svc_conn.entries[0].entry_dn)
            member_of = [str(g) for g in getattr(svc_conn.entries[0], "memberOf", [])]
            svc_conn.unbind()

            # User mit eigenem Passwort binden (Authentifizierung)
            user_conn = Connection(server, user=user_dn, password=password, auto_bind=True)
            user_conn.unbind()

            # Rolle ermitteln
            role = c.default_role
            for group_dn, mapped_role in c.group_role_map.items():
                if any(group_dn.lower() in g.lower() for g in member_of):
                    from core.auth import ROLE_RANK
                    if ROLE_RANK.get(mapped_role, 0) > ROLE_RANK.get(role, 0):
                        role = mapped_role

            log.info("LDAP-Auth erfolgreich: user=%s role=%s source=%s", username, role, c.name)
            return {"username": username, "role": role, "source": f"ldap:{c.id}"}

        except ImportError:
            log.warning("ldap3 nicht installiert – LDAP-Auth übersprungen")
            return None
        except Exception as e:
            log.debug("LDAP-Auth fehlgeschlagen (%s): %s", c.name, e)
            return None
