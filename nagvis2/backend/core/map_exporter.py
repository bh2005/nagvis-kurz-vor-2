"""
backend/core/map_export.py
==========================
Map ZIP Export / Import

ZIP-Struktur:
  nagvis2-map.zip
  ├── manifest.json          – Metadaten + Format-Version
  ├── map.json               – vollständige Map-Config (Objekte, Titel, Parent usw.)
  └── background.<ext>       – Hintergrundbild (optional, nur wenn vorhanden)

manifest.json:
  {
    "format":     "nagvis2-map-export",
    "version":    1,
    "exported_at": "2026-03-13T14:00:00Z",
    "map_id":     "datacenter-hh",
    "title":      "Datacenter Hamburg",
    "has_background": true,
    "background_filename": "background.png"
  }
"""

from __future__ import annotations

import io
import json
import os
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ── Konstanten ─────────────────────────────────────────────────────────
FORMAT_NAME    = "nagvis2-map-export"
FORMAT_VERSION = 1
MAPS_DIR       = Path("data/maps")
BACKGROUNDS_DIR = Path("data/backgrounds")

ALLOWED_BG_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".webp"}


# ═══════════════════════════════════════════════════════════════════════
#  EXPORT
# ═══════════════════════════════════════════════════════════════════════

def export_map_zip(map_id: str) -> tuple[bytes, str]:
    """
    Erstellt ein ZIP-Archiv für eine Map.

    Returns:
        (zip_bytes, suggested_filename)

    Raises:
        FileNotFoundError  – Map-JSON nicht gefunden
        ValueError         – ungültige map_id
    """
    map_path = MAPS_DIR / f"{map_id}.json"
    if not map_path.exists():
        raise FileNotFoundError(f"Map '{map_id}' nicht gefunden")

    map_cfg: dict = json.loads(map_path.read_text(encoding="utf-8"))

    # Hintergrundbild suchen
    bg_path: Optional[Path] = None
    bg_filename: Optional[str] = None
    raw_bg: Optional[str] = map_cfg.get("background")          # z.B. "backgrounds/datacenter-hh.png"

    if raw_bg:
        candidate = Path(raw_bg)
        # Pfad relativ zu data/ oder absolut
        for base in [Path("."), Path("data")]:
            full = base / candidate
            if full.exists():
                bg_path     = full
                bg_filename = f"background{full.suffix}"
                break

    # manifest.json bauen
    manifest = {
        "format":              FORMAT_NAME,
        "version":             FORMAT_VERSION,
        "exported_at":         datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "map_id":              map_id,
        "title":               map_cfg.get("title", map_id),
        "has_background":      bg_path is not None,
        "background_filename": bg_filename,
    }

    # ZIP zusammenbauen
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        zf.writestr("map.json",      json.dumps(map_cfg,  ensure_ascii=False, indent=2))
        if bg_path and bg_filename:
            zf.write(bg_path, arcname=bg_filename)

    safe_title = "".join(c if c.isalnum() or c in "-_" else "_" for c in map_id)
    filename   = f"nagvis2-{safe_title}.zip"
    return buf.getvalue(), filename


# ═══════════════════════════════════════════════════════════════════════
#  IMPORT
# ═══════════════════════════════════════════════════════════════════════

class ImportResult:
    """Ergebnis eines Map-Imports."""
    def __init__(self):
        self.map_id:    str        = ""
        self.title:     str        = ""
        self.warnings:  list[str]  = []
        self.errors:    list[str]  = []
        self.bg_saved:  bool       = False
        self.dry_run:   bool       = False

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0

    def to_dict(self) -> dict:
        return {
            "ok":        self.ok,
            "map_id":    self.map_id,
            "title":     self.title,
            "warnings":  self.warnings,
            "errors":    self.errors,
            "bg_saved":  self.bg_saved,
            "dry_run":   self.dry_run,
        }


def import_map_zip(
    zip_bytes:   bytes,
    override_id: Optional[str] = None,
    dry_run:     bool          = False,
) -> ImportResult:
    """
    Importiert eine Map aus einem ZIP-Archiv.

    Args:
        zip_bytes:    Rohdaten des ZIP
        override_id:  Optionale neue Map-ID (überschreibt die aus dem Manifest)
        dry_run:      Nur validieren, nichts schreiben

    Returns:
        ImportResult mit Status, Warnungen und Fehlern
    """
    result          = ImportResult()
    result.dry_run  = dry_run

    # ── ZIP öffnen ──────────────────────────────────────────────────────
    try:
        buf = io.BytesIO(zip_bytes)
        zf  = zipfile.ZipFile(buf, "r")
    except zipfile.BadZipFile:
        result.errors.append("Ungültige ZIP-Datei")
        return result

    names = zf.namelist()

    # ── manifest.json prüfen ────────────────────────────────────────────
    if "manifest.json" not in names:
        result.errors.append("manifest.json fehlt – keine gültige NagVis-2-Export-Datei")
        zf.close()
        return result

    try:
        manifest: dict = json.loads(zf.read("manifest.json"))
    except json.JSONDecodeError as exc:
        result.errors.append(f"manifest.json ungültig: {exc}")
        zf.close()
        return result

    # Format + Version
    if manifest.get("format") != FORMAT_NAME:
        result.errors.append(
            f"Unbekanntes Format '{manifest.get('format')}' – erwartet '{FORMAT_NAME}'"
        )
        zf.close()
        return result

    if manifest.get("version", 0) > FORMAT_VERSION:
        result.warnings.append(
            f"Export-Version {manifest['version']} ist neuer als diese Installation "
            f"(unterstützt: {FORMAT_VERSION}). Import wird trotzdem versucht."
        )

    # ── map.json lesen ──────────────────────────────────────────────────
    if "map.json" not in names:
        result.errors.append("map.json fehlt im Archiv")
        zf.close()
        return result

    try:
        map_cfg: dict = json.loads(zf.read("map.json"))
    except json.JSONDecodeError as exc:
        result.errors.append(f"map.json ungültig: {exc}")
        zf.close()
        return result

    # ── Map-ID bestimmen ────────────────────────────────────────────────
    map_id = override_id or manifest.get("map_id") or map_cfg.get("id", "")
    if not map_id:
        result.errors.append("Keine Map-ID vorhanden – bitte override_id angeben")
        zf.close()
        return result

    # Zeichen validieren
    if not all(c.isalnum() or c in "-_" for c in map_id):
        result.errors.append(
            f"Ungültige Map-ID '{map_id}' – nur a-z, 0-9, Bindestrich, Unterstrich erlaubt"
        )
        zf.close()
        return result

    # Kollision prüfen
    existing = MAPS_DIR / f"{map_id}.json"
    if existing.exists() and not dry_run:
        result.warnings.append(
            f"Map '{map_id}' existiert bereits und wird überschrieben"
        )

    result.map_id = map_id
    result.title  = map_cfg.get("title", manifest.get("title", map_id))

    # ── Objekte validieren ──────────────────────────────────────────────
    objects = map_cfg.get("objects", [])
    valid_types = {"host", "service", "hostgroup", "servicegroup",
                   "map", "textbox", "line", "container", "gadget"}
    unknown_types = {o.get("type") for o in objects if o.get("type") not in valid_types}
    if unknown_types:
        result.warnings.append(f"Unbekannte Objekttypen werden ignoriert: {', '.join(unknown_types)}")
        map_cfg["objects"] = [o for o in objects if o.get("type") in valid_types]

    # ── Hintergrundbild ─────────────────────────────────────────────────
    bg_filename = manifest.get("background_filename")
    if manifest.get("has_background") and bg_filename:
        if bg_filename in names:
            ext = Path(bg_filename).suffix.lower()
            if ext not in ALLOWED_BG_EXTENSIONS:
                result.warnings.append(
                    f"Hintergrundbild '{bg_filename}' hat unbekannte Endung – wird ignoriert"
                )
            else:
                # Ziel-Dateiname
                dest_name = f"{map_id}{ext}"
                dest_path = BACKGROUNDS_DIR / dest_name
                # map.json background-Pfad aktualisieren
                map_cfg["background"] = f"backgrounds/{dest_name}"

                if not dry_run:
                    BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)
                    dest_path.write_bytes(zf.read(bg_filename))
                    result.bg_saved = True
        else:
            result.warnings.append(
                f"Manifest verspricht Hintergrundbild '{bg_filename}', "
                "aber die Datei fehlt im Archiv"
            )

    # ── Map-ID in map_cfg aktualisieren ─────────────────────────────────
    map_cfg["id"] = map_id

    # ── Schreiben (wenn kein Dry-Run) ───────────────────────────────────
    if not dry_run:
        MAPS_DIR.mkdir(parents=True, exist_ok=True)
        (MAPS_DIR / f"{map_id}.json").write_text(
            json.dumps(map_cfg, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    zf.close()
    return result