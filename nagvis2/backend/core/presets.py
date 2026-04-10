"""
core/presets.py
===============
Globale Voreinstellungen für neue Benutzer (NagVis 2).

Persistenz: data/presets.json
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger("nagvis.presets")

PRESETS_FILE = Path("data/presets.json")

_DEFAULTS = {
    "default_theme":    "dark",
    "default_language": "de",
    "default_map":      "",
    "sidebar_default":  "expanded",
    "session_timeout":  168,       # Stunden (7 Tage), 0 = kein Ablauf
    "welcome_message":  "",
    "map_refresh":      10,        # WebSocket-Poll-Intervall in Sekunden
}

# ── Singleton ─────────────────────────────────────────────────────────────────

_presets_manager: Optional["PresetsManager"] = None


def set_presets_manager(pm: "PresetsManager") -> None:
    global _presets_manager
    _presets_manager = pm


def get_presets_manager() -> "PresetsManager":
    if _presets_manager is None:
        raise RuntimeError("PresetsManager nicht initialisiert")
    return _presets_manager


# ── PresetsManager ────────────────────────────────────────────────────────────

class PresetsManager:
    def __init__(self, config_path: Path = PRESETS_FILE):
        self._path   = config_path
        self._data:  dict = {}
        self._load()

    def _load(self):
        if not self._path.exists():
            self._data = dict(_DEFAULTS)
            return
        try:
            loaded     = json.loads(self._path.read_text(encoding="utf-8"))
            self._data = {**_DEFAULTS, **loaded}   # fehlende Keys mit Defaults befüllen
        except Exception as e:
            log.error("Fehler beim Laden von presets.json: %s", e)
            self._data = dict(_DEFAULTS)

    def _save(self):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(self._data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def get(self) -> dict:
        return dict(self._data)

    def update(self, **kwargs) -> dict:
        for k, v in kwargs.items():
            if k in _DEFAULTS and v is not None:
                self._data[k] = v
        self._save()
        return self.get()
