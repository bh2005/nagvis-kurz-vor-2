"""
core/cfg_migration.py
=====================
Migriert NagVis-1-Konfigurationsdateien (.cfg) nach NagVis-2-JSON.

NagVis-1-.cfg-Format
--------------------
  define global {
    map_iconset=std_big
    background_image=../images/maps/datacenter.png
  }

  define host {
    host_name=srv-web-01
    x=480
    y=220
    iconset=std_big
    label_show=1
    label_text=Web Server
  }

  define service {
    host_name=srv-db-01
    service_description=CPU Load
    x=640
    y=310
  }

  define hostgroup {
    hostgroup_name=linux-servers
    x=200
    y=400
  }

  define servicegroup {
    servicegroup_name=http-checks
    x=300
    y=500
  }

  define textbox {
    text=Netzwerk-Zone A
    x=50
    y=30
    w=200
    h=40
    style=font-size:14px;font-weight:bold;color:#e0e0e0
  }

  define line {
    x=100
    y=200
    x2=900
    y2=200
    line_type=1
    line_width=2
    line_color=#444444
  }

  define map {
    map_name=datacenter-b
    x=800
    y=150
  }

  define container {
    url=/nagvis/userfiles/images/logo.png
    x=50
    y=850
    w=120
    h=80
  }

Koordinaten-Umrechnung
----------------------
NagVis 1 speichert Pixel-Koordinaten (absolut).
NagVis 2 arbeitet mit %-Koordinaten (relativ zur Canvas-Größe).

Ohne bekannte Canvas-Größe wird 1200×800px als Standard angenommen
(entspricht dem häufigsten Hintergrundbildformat). Das Migrationsskript
akzeptiert optional canvas_w und canvas_h als Parameter.

Felder-Mapping (NagVis 1 → NagVis 2)
--------------------------------------
  host_name            → name  (host)
  service_description  → name  (service, kombiniert mit host_name)
  hostgroup_name       → name  (hostgroup)
  servicegroup_name    → name  (servicegroup)
  map_name             → name  (map)
  iconset              → iconset
  label_text           → label
  line_type            → line_style  (1=solid, 2=dashed, 3=dotted)
  style (CSS-String)   → font_size, bold, color (geparst)
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any

log = logging.getLogger("nagvis.migration")

# Standardgröße falls kein Hintergrundbild bekannt
DEFAULT_CANVAS_W = 1200.0
DEFAULT_CANVAS_H =  800.0

# NagVis-1 line_type → NagVis-2 line_style
LINE_TYPE_MAP = {
    "1": "solid",
    "2": "dashed",
    "3": "dotted",
    "10": "dashed",   # traffic/arrow-Typen → dashed
    "11": "dashed",
    "12": "dashed",
    "13": "dashed",
}


# ── Ergebnis-Datenklassen ────────────────────────────────────────────────────

@dataclass
class MigrationWarning:
    object_type: str
    field:       str
    message:     str

@dataclass
class MigrationResult:
    map_id:      str
    title:       str
    background:  str                      # Hintergrundpfad (raw aus .cfg)
    objects:     list[dict]  = field(default_factory=list)
    warnings:    list[MigrationWarning] = field(default_factory=list)
    skipped:     int = 0                  # Objekte die nicht migriert werden konnten


# ── Parser ────────────────────────────────────────────────────────────────────

def parse_cfg(content: str) -> list[dict[str, str]]:
    """
    Parst eine NagVis-1-.cfg-Datei und gibt eine Liste von Blöcken zurück.
    Jeder Block ist ein dict mit 'block_type' + allen Key-Value-Paaren.

    Unterstützt:
      - define <type> { ... }
      - Kommentare mit # oder ;
      - Mehrfachzuweisung (gleicher Key) → letzter Wert gewinnt
      - Leerzeilen und Windows-Zeilenenden
    """
    blocks: list[dict[str, str]] = []
    current: dict[str, str] | None = None

    for raw_line in content.splitlines():
        line = raw_line.strip()

        # Kommentare und Leerzeilen
        if not line or line.startswith("#") or line.startswith(";"):
            continue

        # Block-Start: "define host {"
        m = re.match(r"^define\s+(\w+)\s*\{", line)
        if m:
            current = {"block_type": m.group(1)}
            continue

        # Block-Ende
        if line == "}" and current is not None:
            blocks.append(current)
            current = None
            continue

        # Key=Value innerhalb eines Blocks
        if current is not None and "=" in line:
            key, _, value = line.partition("=")
            # Inline-Kommentare (nach " ;") entfernen
            value = value.split(" ;")[0].strip()
            current[key.strip()] = value

    return blocks


# ── Koordinaten-Umrechnung ────────────────────────────────────────────────────

def _px_to_pct(px: str | int | float, total: float) -> float:
    """Pixel → Prozent, gerundet auf 2 Dezimalstellen."""
    try:
        return round(float(px) / total * 100, 2)
    except (ValueError, ZeroDivisionError):
        return 50.0


def _coords(block: dict, canvas_w: float, canvas_h: float) -> tuple[float, float]:
    x = _px_to_pct(block.get("x", 50), canvas_w)
    y = _px_to_pct(block.get("y", 50), canvas_h)
    return x, y


def _size(block: dict, canvas_w: float, canvas_h: float) -> tuple[float | None, float | None]:
    w = _px_to_pct(block["w"], canvas_w) if "w" in block else None
    h = _px_to_pct(block["h"], canvas_h) if "h" in block else None
    return w, h


# ── CSS-Style Parser (für textbox) ───────────────────────────────────────────

def _parse_style(style: str) -> dict:
    """
    Parst NagVis-1-CSS-String → NagVis-2-Felder.
    z.B. "font-size:14px;font-weight:bold;color:#e0e0e0"
    """
    result = {}
    for part in style.split(";"):
        part = part.strip()
        if ":" not in part:
            continue
        prop, _, val = part.partition(":")
        prop = prop.strip().lower()
        val  = val.strip()

        if prop == "font-size":
            size = re.sub(r"[^\d]", "", val)
            if size:
                result["font_size"] = int(size)
        elif prop == "font-weight" and val == "bold":
            result["bold"] = True
        elif prop == "color":
            result["color"] = val
        elif prop == "background-color":
            result["bg_color"] = val
        elif prop == "border-color":
            result["border_color"] = val

    return result


# ── Block-Konverter ───────────────────────────────────────────────────────────

def _convert_host(b: dict, cw: float, ch: float, warnings: list) -> dict:
    x, y = _coords(b, cw, ch)
    name  = b.get("host_name", "")
    if not name:
        warnings.append(MigrationWarning("host", "host_name", "host_name fehlt"))
    return {
        "type":    "host",
        "name":    name,
        "x":       x,
        "y":       y,
        "iconset": b.get("iconset", "default"),
        "label":   b.get("label_text", name),
    }


def _convert_service(b: dict, cw: float, ch: float, warnings: list) -> dict:
    x, y    = _coords(b, cw, ch)
    host    = b.get("host_name", "")
    service = b.get("service_description", "")
    if not host or not service:
        warnings.append(MigrationWarning(
            "service", "host_name/service_description",
            f"Unvollständig: host='{host}' service='{service}'"
        ))
    return {
        "type":      "service",
        "host_name": host,
        "name":      service,
        "x":         x,
        "y":         y,
        "iconset":   b.get("iconset", "default"),
        "label":     b.get("label_text", service),
    }


def _convert_hostgroup(b: dict, cw: float, ch: float, warnings: list) -> dict:
    x, y = _coords(b, cw, ch)
    name  = b.get("hostgroup_name", "")
    if not name:
        warnings.append(MigrationWarning("hostgroup", "hostgroup_name", "Name fehlt"))
    return {
        "type":    "hostgroup",
        "name":    name,
        "x":       x,
        "y":       y,
        "iconset": b.get("iconset", "default"),
        "label":   b.get("label_text", name),
    }


def _convert_servicegroup(b: dict, cw: float, ch: float, warnings: list) -> dict:
    x, y = _coords(b, cw, ch)
    name  = b.get("servicegroup_name", "")
    if not name:
        warnings.append(MigrationWarning("servicegroup", "servicegroup_name", "Name fehlt"))
    return {
        "type":    "servicegroup",
        "name":    name,
        "x":       x,
        "y":       y,
        "iconset": b.get("iconset", "default"),
        "label":   b.get("label_text", name),
    }


def _convert_map(b: dict, cw: float, ch: float, warnings: list) -> dict:
    x, y = _coords(b, cw, ch)
    name  = b.get("map_name", "")
    if not name:
        warnings.append(MigrationWarning("map", "map_name", "map_name fehlt"))
    return {
        "type":    "map",
        "name":    name,
        "x":       x,
        "y":       y,
        "iconset": b.get("iconset", "map"),
        "label":   b.get("label_text", name),
    }


def _convert_textbox(b: dict, cw: float, ch: float, warnings: list) -> dict:
    x, y = _coords(b, cw, ch)
    w, h  = _size(b, cw, ch)
    obj: dict = {
        "type": "textbox",
        "x":    x,
        "y":    y,
        "text": b.get("text", ""),
    }
    if w is not None: obj["w"] = w
    if h is not None: obj["h"] = h

    # CSS-Style-String auflösen
    if "style" in b:
        obj.update(_parse_style(b["style"]))
    # Direkte Felder (neuere NagVis-1-Versionen)
    if "font_size" in b:
        try: obj["font_size"] = int(b["font_size"])
        except ValueError: pass
    if "bold" in b:
        obj["bold"] = b["bold"].lower() in ("1", "true", "yes")
    if "font_color" in b:
        obj["color"] = b["font_color"]
    if "background_color" in b:
        obj["bg_color"] = b["background_color"]

    return obj


def _convert_line(b: dict, cw: float, ch: float, warnings: list) -> dict:
    x,  y  = _coords(b, cw, ch)
    x2 = _px_to_pct(b["x2"], cw) if "x2" in b else x + 10
    y2 = _px_to_pct(b["y2"], ch) if "y2" in b else y

    line_type  = b.get("line_type", "1")
    line_style = LINE_TYPE_MAP.get(str(line_type), "solid")

    obj: dict = {
        "type":       "line",
        "x":          x,
        "y":          y,
        "x2":         x2,
        "y2":         y2,
        "line_style": line_style,
    }
    if "line_width" in b:
        try: obj["line_width"] = int(b["line_width"])
        except ValueError: pass
    if "line_color" in b:
        obj["color"] = b["line_color"]

    return obj


def _convert_container(b: dict, cw: float, ch: float, warnings: list) -> dict:
    x, y = _coords(b, cw, ch)
    w, h  = _size(b, cw, ch)
    obj: dict = {
        "type": "container",
        "x":    x,
        "y":    y,
        "url":  b.get("url", ""),
    }
    if w is not None: obj["w"] = w
    if h is not None: obj["h"] = h
    return obj


# ── Dispatcher ────────────────────────────────────────────────────────────────

_CONVERTERS = {
    "host":         _convert_host,
    "service":      _convert_service,
    "hostgroup":    _convert_hostgroup,
    "servicegroup": _convert_servicegroup,
    "map":          _convert_map,
    "textbox":      _convert_textbox,
    "line":         _convert_line,
    "container":    _convert_container,
}


# ── Haupt-Funktion ────────────────────────────────────────────────────────────

def migrate_cfg(
    content:    str,
    map_id:     str      = "",
    canvas_w:   float    = DEFAULT_CANVAS_W,
    canvas_h:   float    = DEFAULT_CANVAS_H,
) -> MigrationResult:
    """
    Migriert den Inhalt einer NagVis-1-.cfg-Datei nach NagVis-2-JSON.

    Parameters
    ----------
    content   : Rohinhalt der .cfg-Datei (UTF-8)
    map_id    : Gewünschte Map-ID in NagVis 2 (leer = aus Dateiname ableiten)
    canvas_w  : Breite der Hintergrundkarte in Pixeln (für %-Umrechnung)
    canvas_h  : Höhe der Hintergrundkarte in Pixeln

    Returns
    -------
    MigrationResult mit objects, warnings, skipped
    """
    blocks   = parse_cfg(content)
    warnings: list[MigrationWarning] = []
    objects:  list[dict]             = []
    skipped  = 0
    title    = map_id or "Migrierte Map"
    bg       = ""

    for block in blocks:
        btype = block.get("block_type", "")

        # Global-Block: Metadaten extrahieren
        if btype == "global":
            if "background_image" in block:
                # Relativen NagVis-1-Pfad vereinfachen
                raw_bg = block["background_image"]
                bg     = re.sub(r"^\.\./+", "", raw_bg)   # "../images/..." → "images/..."
            if "alias" in block:
                title = block["alias"]
            continue

        converter = _CONVERTERS.get(btype)
        if converter is None:
            if btype:   # leere block_types ignorieren wir still
                log.debug("Unbekannter Blocktyp '%s' – übersprungen", btype)
                skipped += 1
            continue

        try:
            obj = converter(block, canvas_w, canvas_h, warnings)
            objects.append(obj)
        except Exception as e:
            log.warning("Fehler beim Konvertieren von '%s': %s", btype, e)
            warnings.append(MigrationWarning(btype, "–", str(e)))
            skipped += 1

    if not map_id:
        map_id = title.lower().replace(" ", "-")[:32]
        map_id = re.sub(r"[^a-z0-9-]", "", map_id) or "migrated-map"

    log.info(
        "Migration abgeschlossen: map_id=%s, %d Objekte, %d Warnungen, %d übersprungen",
        map_id, len(objects), len(warnings), skipped,
    )

    return MigrationResult(
        map_id   = map_id,
        title    = title,
        background = bg,
        objects  = objects,
        warnings = warnings,
        skipped  = skipped,
    )