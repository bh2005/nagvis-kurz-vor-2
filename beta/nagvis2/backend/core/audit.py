"""
core/audit.py
=============
Audit-Log für NagVis 2.

Speichert alle schreibenden Aktionen (Map anlegen/löschen, Objekte ändern,
Backend konfigurieren, …) in data/audit.jsonl (JSON Lines).

Eintrags-Format:
    { "ts": 1711234567, "user": "admin", "action": "map.create",
      "map_id": "my-map", "details": {"title": "Meine Map"} }

Verwendung in Routen:
    from core.audit import audit_log
    audit_log(request, "map.create", map_id=new_id, title=body.title)
"""

import json
import logging
import time
from pathlib import Path
from typing import Any

from fastapi import Request

log = logging.getLogger("nagvis.audit")

# Maximale Einträge die im GET zurückgegeben werden
MAX_ENTRIES = 2000
# Rotations-Schwelle: Datei wird compacted wenn sie diese Anzahl überschreitet
ROTATE_AT   = 10_000

_AUDIT_FILE: Path | None = None


def _get_path() -> Path:
    global _AUDIT_FILE
    if _AUDIT_FILE is None:
        from core.config import settings
        _AUDIT_FILE = settings.DATA_DIR / "audit.jsonl"
    return _AUDIT_FILE


def _extract_user(request: Request | None) -> str:
    """Liest den Benutzer aus Bearer-Token oder X-NV2-User-Header."""
    if request is None:
        return "system"
    # Bearer-Token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            from core.auth import get_auth_manager
            user = get_auth_manager().verify(auth[7:])
            return user.username
        except Exception:
            pass
    # Explizit gesetzter User-Header (wenn AUTH_ENABLED=false)
    return request.headers.get("X-NV2-User", "anonymous")


def audit_log(
    request: Request | None,
    action: str,
    map_id: str = "",
    **details: Any,
) -> None:
    """
    Schreibt einen Audit-Eintrag.

    Args:
        request:  FastAPI-Request (für User-Extraktion), darf None sein.
        action:   Aktions-Identifier z.B. "map.create", "object.delete".
        map_id:   Betroffene Map-ID (leer für systemweite Aktionen).
        **details: Beliebige Schlüssel-Wert-Paare als Kontext.
    """
    try:
        path = _get_path()
        entry = {
            "ts":      int(time.time()),
            "user":    _extract_user(request),
            "action":  action,
            "map_id":  map_id,
            "details": {k: v for k, v in details.items() if v is not None},
        }
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        # Einfache Rotation: wenn Datei zu groß, die ältesten 20% abschneiden
        _maybe_rotate(path)

    except Exception as e:
        log.warning("Audit-Log Fehler: %s", e)


def read_audit(
    limit:    int = 200,
    map_id:   str | None = None,
    action:   str | None = None,
    user:     str | None = None,
) -> list[dict]:
    """Gibt die letzten `limit` Audit-Einträge zurück (neueste zuerst)."""
    path = _get_path()
    if not path.exists():
        return []

    entries: list[dict] = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    e = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if map_id  and e.get("map_id")  != map_id:  continue
                if action  and e.get("action")  != action:  continue
                if user    and e.get("user")    != user:    continue
                entries.append(e)
    except Exception as e:
        log.warning("Audit-Log lesen fehlgeschlagen: %s", e)
        return []

    # Neueste zuerst, auf limit begrenzen
    capped = min(limit, MAX_ENTRIES)
    return list(reversed(entries[-capped:]))


def _maybe_rotate(path: Path) -> None:
    """Schneidet die ältesten 20% ab wenn ROTATE_AT überschritten."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
        if len(lines) > ROTATE_AT:
            keep = int(ROTATE_AT * 0.8)
            path.write_text("".join(lines[-keep:]), encoding="utf-8")
            log.info("Audit-Log rotiert: %d → %d Einträge", len(lines), keep)
    except Exception:
        pass
