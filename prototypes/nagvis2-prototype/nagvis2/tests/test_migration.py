"""
tests/test_migration.py
=======================
Tests für backend/core/cfg_migration.py.

Abgedeckt
---------
  parse_cfg()       – Blöcke, Kommentare, Leerzeilen, Mehrfachkeys
  migrate_cfg()     – alle 8 Objekttypen, Koordinaten-Umrechnung,
                      Warnungen, Fehlerpfade, global-Block
  _parse_style()    – CSS-String → NagVis-2-Felder
  _px_to_pct()      – Grenzfälle
"""

import pytest
from backend.core.cfg_migration import (
    parse_cfg,
    migrate_cfg,
    _px_to_pct,
    _parse_style,
    DEFAULT_CANVAS_W,
    DEFAULT_CANVAS_H,
)

# ── Beispiel-CFG ──────────────────────────────────────────────────────────────

SAMPLE_CFG = """
# NagVis 1 Beispiel-Map

define global {
    alias=Rechenzentrum Hamburg
    background_image=../images/maps/rz-hamburg.png
    map_iconset=std_big
}

define host {
    host_name=srv-web-01
    x=480
    y=220
    iconset=server
    label_show=1
    label_text=Web Server
}

define service {
    host_name=srv-db-01
    service_description=CPU Load
    x=640
    y=310
    iconset=default
}

define hostgroup {
    hostgroup_name=linux-servers
    x=200
    y=400
    label_text=Linux
}

define servicegroup {
    servicegroup_name=http-checks
    x=300
    y=500
}

define map {
    map_name=datacenter-b
    x=900
    y=150
    iconset=map
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
    x2=1100
    y2=200
    line_type=1
    line_width=2
    line_color=#444444
}

define container {
    url=/nagvis/userfiles/images/logo.png
    x=50
    y=750
    w=120
    h=60
}
"""

# ── parse_cfg ────────────────────────────────────────────────────────────────

def test_parse_cfg_counts_blocks():
    blocks = parse_cfg(SAMPLE_CFG)
    types  = [b["block_type"] for b in blocks]
    assert types.count("global")       == 1
    assert types.count("host")         == 1
    assert types.count("service")      == 1
    assert types.count("hostgroup")    == 1
    assert types.count("servicegroup") == 1
    assert types.count("map")          == 1
    assert types.count("textbox")      == 1
    assert types.count("line")         == 1
    assert types.count("container")    == 1


def test_parse_cfg_extracts_values():
    blocks = parse_cfg(SAMPLE_CFG)
    host   = next(b for b in blocks if b["block_type"] == "host")
    assert host["host_name"] == "srv-web-01"
    assert host["x"]         == "480"
    assert host["iconset"]   == "server"
    assert host["label_text"] == "Web Server"


def test_parse_cfg_ignores_comments():
    cfg    = "# full comment line\ndefine host {\n  host_name=router ; inline\n  x=100\n  y=200\n}\n"
    blocks = parse_cfg(cfg)
    assert len(blocks) == 1
    assert blocks[0]["host_name"] == "router"


def test_parse_cfg_empty_input():
    assert parse_cfg("") == []
    assert parse_cfg("# only comments\n; more comments") == []


def test_parse_cfg_unclosed_block_ignored():
    """Block ohne schließende } wird nicht in die Ergebnisliste aufgenommen."""
    cfg    = "define host {\n  host_name=orphan\n  x=10\n  y=20\n"
    blocks = parse_cfg(cfg)
    assert len(blocks) == 0


def test_parse_cfg_last_value_wins_on_duplicate_key():
    cfg    = "define host {\n  host_name=first\n  host_name=second\n  x=1\n  y=1\n}\n"
    blocks = parse_cfg(cfg)
    assert blocks[0]["host_name"] == "second"


# ── _px_to_pct ────────────────────────────────────────────────────────────────

def test_px_to_pct_basic():
    assert _px_to_pct(600, 1200.0) == 50.0
    assert _px_to_pct(0,   1200.0) == 0.0
    assert _px_to_pct(1200, 1200.0) == 100.0


def test_px_to_pct_string_input():
    assert _px_to_pct("480", 1200.0) == 40.0


def test_px_to_pct_zero_total_returns_default():
    assert _px_to_pct(100, 0) == 50.0


def test_px_to_pct_invalid_returns_default():
    assert _px_to_pct("abc", 1200.0) == 50.0


# ── _parse_style ──────────────────────────────────────────────────────────────

def test_parse_style_font_size():
    r = _parse_style("font-size:14px")
    assert r["font_size"] == 14


def test_parse_style_bold():
    r = _parse_style("font-weight:bold")
    assert r["bold"] is True


def test_parse_style_color():
    r = _parse_style("color:#e0e0e0")
    assert r["color"] == "#e0e0e0"


def test_parse_style_background_color():
    r = _parse_style("background-color:#1a1a1a")
    assert r["bg_color"] == "#1a1a1a"


def test_parse_style_combined():
    r = _parse_style("font-size:12px;font-weight:bold;color:#fff;background-color:#000")
    assert r["font_size"] == 12
    assert r["bold"]      is True
    assert r["color"]     == "#fff"
    assert r["bg_color"]  == "#000"


def test_parse_style_empty():
    assert _parse_style("") == {}
    assert _parse_style("no-colon") == {}


# ── migrate_cfg – Vollständige Map ───────────────────────────────────────────

def test_migrate_all_types():
    result = migrate_cfg(SAMPLE_CFG, map_id="rz-hamburg")
    types  = [o["type"] for o in result.objects]
    assert "host"         in types
    assert "service"      in types
    assert "hostgroup"    in types
    assert "servicegroup" in types
    assert "map"          in types
    assert "textbox"      in types
    assert "line"         in types
    assert "container"    in types


def test_migrate_global_block_sets_title():
    result = migrate_cfg(SAMPLE_CFG, map_id="rz-hamburg")
    assert result.title == "Rechenzentrum Hamburg"


def test_migrate_global_block_sets_background():
    result = migrate_cfg(SAMPLE_CFG, map_id="rz-hamburg")
    # Relativer "../"-Prefix wird entfernt
    assert result.background == "images/maps/rz-hamburg.png"


def test_migrate_coordinate_conversion():
    result = migrate_cfg(SAMPLE_CFG, map_id="test", canvas_w=1200, canvas_h=800)
    host   = next(o for o in result.objects if o["type"] == "host")
    # 480/1200 = 40%, 220/800 = 27.5%
    assert host["x"] == pytest.approx(40.0, abs=0.1)
    assert host["y"] == pytest.approx(27.5, abs=0.1)


def test_migrate_custom_canvas_size():
    cfg    = "define host {\n  host_name=r\n  x=500\n  y=500\n}\n"
    result = migrate_cfg(cfg, canvas_w=1000, canvas_h=1000)
    host   = result.objects[0]
    assert host["x"] == pytest.approx(50.0)
    assert host["y"] == pytest.approx(50.0)


def test_migrate_host_fields():
    result = migrate_cfg(SAMPLE_CFG)
    host   = next(o for o in result.objects if o["type"] == "host")
    assert host["name"]    == "srv-web-01"
    assert host["iconset"] == "server"
    assert host["label"]   == "Web Server"


def test_migrate_service_fields():
    result  = migrate_cfg(SAMPLE_CFG)
    service = next(o for o in result.objects if o["type"] == "service")
    assert service["host_name"] == "srv-db-01"
    assert service["name"]      == "CPU Load"


def test_migrate_textbox_style_parsed():
    result  = migrate_cfg(SAMPLE_CFG)
    textbox = next(o for o in result.objects if o["type"] == "textbox")
    assert textbox["text"]      == "Netzwerk-Zone A"
    assert textbox["font_size"] == 14
    assert textbox["bold"]      is True
    assert textbox["color"]     == "#e0e0e0"


def test_migrate_textbox_size_in_percent():
    result  = migrate_cfg(SAMPLE_CFG, canvas_w=1200, canvas_h=800)
    textbox = next(o for o in result.objects if o["type"] == "textbox")
    # 200/1200 ≈ 16.67%
    assert textbox["w"] == pytest.approx(16.67, abs=0.1)


def test_migrate_line_type_mapping():
    result = migrate_cfg(SAMPLE_CFG)
    line   = next(o for o in result.objects if o["type"] == "line")
    assert line["line_style"] == "solid"
    assert line["line_width"] == 2
    assert line["color"]      == "#444444"


def test_migrate_line_x2_y2():
    result = migrate_cfg(SAMPLE_CFG, canvas_w=1200, canvas_h=800)
    line   = next(o for o in result.objects if o["type"] == "line")
    # x2=1100 → 1100/1200 ≈ 91.67%
    assert line["x2"] == pytest.approx(91.67, abs=0.1)
    assert line["y2"] == pytest.approx(25.0,  abs=0.1)


def test_migrate_container_fields():
    result    = migrate_cfg(SAMPLE_CFG)
    container = next(o for o in result.objects if o["type"] == "container")
    assert container["url"] == "/nagvis/userfiles/images/logo.png"
    assert "w" in container
    assert "h" in container


def test_migrate_map_id_generated_from_title():
    cfg    = "define global {\n  alias=Mein Test\n}\ndefine host {\n  host_name=r\n  x=1\n  y=1\n}\n"
    result = migrate_cfg(cfg, map_id="")
    assert result.map_id == "mein-test"


def test_migrate_unknown_block_type_counted_as_skipped():
    cfg    = "define unknown_type {\n  foo=bar\n}\n"
    result = migrate_cfg(cfg)
    assert result.skipped == 1
    assert len(result.objects) == 0


def test_migrate_missing_host_name_generates_warning():
    cfg    = "define host {\n  x=100\n  y=100\n}\n"
    result = migrate_cfg(cfg)
    assert any(w.object_type == "host" for w in result.warnings)


def test_migrate_empty_cfg():
    result = migrate_cfg("")
    assert result.objects  == []
    assert result.warnings == []
    assert result.skipped  == 0


def test_migrate_line_type_dashed():
    cfg    = "define line {\n  x=10\n  y=10\n  x2=100\n  y2=10\n  line_type=2\n}\n"
    result = migrate_cfg(cfg)
    assert result.objects[0]["line_style"] == "dashed"


def test_migrate_returns_correct_object_count():
    result = migrate_cfg(SAMPLE_CFG)
    # 8 Typen, kein global (global ist kein Objekt)
    assert len(result.objects) == 8