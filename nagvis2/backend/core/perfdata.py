"""
core/perfdata.py
================
Parst Nagios / Checkmk Performance-Daten-Strings in strukturierte Dicts.

Format:  'label'=value[UOM];[warn];[crit];[min];[max] ...

Beispiele:
  load1=0.37;5.00;10.00;0;
  rta=1.234ms;3000.000;5000.000;0;  pl=0%;80;100;0;
  'Used Space'=14.2GB;80%;90%;0%;100%
  cpu_percent=42.5;70;90;0;100

Rückgabe (pro Metrik):
  {
    "value": 42.5,
    "unit":  "%",
    "warn":  70.0,
    "crit":  90.0,
    "min":   0.0,
    "max":   100.0,
  }
"""

import re

# Unterstützte UOM-Einheiten (Nagios-Standard)
_VALID_UOM = {"s", "ms", "us", "%", "B", "KB", "MB", "GB", "TB", "PB", "c", ""}

# Regex: optionales Label in Anführungszeichen oder ohne, dann =value[UOM];...
_PERF_RE = re.compile(
    r"""
    (?:'([^']+)'|(\S+?))   # label: quoted  oder  unquoted (non-greedy)
    =
    ([0-9.+eE-]+)          # value (int oder float)
    ([a-zA-Z%]*)           # UOM (optional)
    (?:;([0-9.+eE-]*))?    # warn (optional)
    (?:;([0-9.+eE-]*))?    # crit (optional)
    (?:;([0-9.+eE-]*))?    # min  (optional)
    (?:;([0-9.+eE-]*))?    # max  (optional)
    """,
    re.VERBOSE,
)


def _num(s: str | None) -> float | None:
    """Konvertiert String → float; leer oder ungültig → None."""
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_perfdata(raw: str) -> dict[str, dict]:
    """
    Parst einen Perfdata-String und gibt ein Dict zurück.

    Key:   Label (str)
    Value: {"value": float, "unit": str,
            "warn": float|None, "crit": float|None,
            "min":  float|None, "max":  float|None}

    Liefert {} bei leerem oder ungültigem Input.
    """
    result: dict[str, dict] = {}
    if not isinstance(raw, str):
        return result
    for m in _PERF_RE.finditer(raw or ""):
        label = m.group(1) or m.group(2) or ""
        if not label:
            continue
        value = _num(m.group(3))
        if value is None:
            continue
        result[label] = {
            "value": value,
            "unit":  m.group(4) or "",
            "warn":  _num(m.group(5)),
            "crit":  _num(m.group(6)),
            "min":   _num(m.group(7)),
            "max":   _num(m.group(8)),
        }
    return result
