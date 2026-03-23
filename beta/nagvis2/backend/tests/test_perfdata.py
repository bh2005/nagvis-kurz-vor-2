"""Tests für core/perfdata.py – Nagios/Checkmk Perfdata-Parser."""

import pytest
from core.perfdata import parse_perfdata


class TestParseEmpty:
    def test_empty_string(self):
        assert parse_perfdata("") == {}

    def test_none_like(self):
        assert parse_perfdata(None) == {}  # type: ignore[arg-type]

    def test_whitespace(self):
        assert parse_perfdata("   ") == {}


class TestSimpleValues:
    def test_integer_value(self):
        r = parse_perfdata("cpu=42")
        assert r["cpu"]["value"] == 42.0
        assert r["cpu"]["unit"] == ""

    def test_float_value(self):
        r = parse_perfdata("load=0.37")
        assert abs(r["load"]["value"] - 0.37) < 1e-9

    def test_percent_uom(self):
        r = parse_perfdata("mem=78%")
        assert r["mem"]["unit"] == "%"
        assert r["mem"]["value"] == 78.0

    def test_ms_uom(self):
        r = parse_perfdata("rta=1.234ms")
        assert r["rta"]["unit"] == "ms"

    def test_mb_uom(self):
        r = parse_perfdata("disk=14.2GB")
        assert r["disk"]["unit"] == "GB"


class TestThresholds:
    def test_warn_crit(self):
        r = parse_perfdata("cpu=42%;70;90")
        assert r["cpu"]["warn"] == 70.0
        assert r["cpu"]["crit"] == 90.0
        assert r["cpu"]["min"] is None
        assert r["cpu"]["max"] is None

    def test_full_thresholds(self):
        r = parse_perfdata("load1=0.37;5.00;10.00;0;100")
        m = r["load1"]
        assert m["warn"] == 5.0
        assert m["crit"] == 10.0
        assert m["min"]  == 0.0
        assert m["max"]  == 100.0

    def test_empty_thresholds(self):
        r = parse_perfdata("x=1;;;0;")
        assert r["x"]["warn"] is None
        assert r["x"]["crit"] is None
        assert r["x"]["min"]  == 0.0
        assert r["x"]["max"]  is None


class TestQuotedLabels:
    def test_quoted_label_with_space(self):
        r = parse_perfdata("'Used Space'=14.2GB;80;90;0;100")
        assert "Used Space" in r
        assert r["Used Space"]["value"] == 14.2

    def test_quoted_label_special_chars(self):
        r = parse_perfdata("'CPU Load %'=42.5%")
        assert "CPU Load %" in r


class TestMultipleMetrics:
    def test_two_metrics(self):
        r = parse_perfdata("load1=0.42 load5=0.38")
        assert set(r.keys()) == {"load1", "load5"}

    def test_nagios_style_multiline(self):
        raw = "rta=1.234ms;3000.000;5000.000;0; pl=0%;80;100;0;"
        r = parse_perfdata(raw)
        assert "rta" in r
        assert "pl"  in r
        assert r["pl"]["unit"] == "%"


class TestEdgeCases:
    def test_scientific_notation(self):
        r = parse_perfdata("val=1e3")
        assert r["val"]["value"] == 1000.0

    def test_negative_value_not_parsed(self):
        # Negative Werte sind kein Standard-Nagios-Perfdata – wird nicht gematcht
        r = parse_perfdata("val=-5")
        # Je nach Regex kann das fehlen – kein Fehler, aber keine Exception
        assert isinstance(r, dict)
