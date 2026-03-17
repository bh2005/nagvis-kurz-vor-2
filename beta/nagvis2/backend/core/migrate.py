"""
NagVis 2 – NagVis 1 .cfg Parser
Liest define-Blöcke aus NagVis 1.x .cfg Dateien und konvertiert
sie in NagVis 2 Objekte.
"""

import re
from typing import Optional


# ══════════════════════════════════════════════════════════════════════
#  Block-Parser
# ══════════════════════════════════════════════════════════════════════

def parse_cfg(raw: str) -> tuple[dict, list[dict], list[str]]:
    """
    Parst eine NagVis-1 .cfg Datei.
    Gibt zurück: (map_props, objects, warnings)
    """
    warnings = []
    map_props = {}
    objects   = []

    # Kommentare entfernen
    raw = re.sub(r'#[^\n]*', '', raw)
    raw = re.sub(r'//[^\n]*', '', raw)

    # define-Blöcke extrahieren
    block_pattern = re.compile(
        r'define\s+(\w+)\s*\{([^}]*)\}',
        re.DOTALL
    )

    for m in block_pattern.finditer(raw):
        block_type = m.group(1).strip()
        block_body = m.group(2)

        props = _parse_block_body(block_body)

        if block_type == 'global':
            map_props.update(props)
        else:
            obj, warn = _convert_object(block_type, props)
            if obj:
                objects.append(obj)
            warnings.extend(warn)

    return map_props, objects, warnings


def _parse_block_body(body: str) -> dict:
    """Parst Key=Value Paare aus einem define-Block."""
    props = {}
    for line in body.splitlines():
        line = line.strip()
        if not line or '=' not in line:
            continue
        key, _, value = line.partition('=')
        props[key.strip()] = value.strip()
    return props


# ══════════════════════════════════════════════════════════════════════
#  Objekt-Konvertierung
# ══════════════════════════════════════════════════════════════════════

# NagVis 1 Koordinaten sind absolute Pixel, NagVis 2 nutzt Prozent
def _to_pct(val: str, canvas_size: int) -> float:
    try:
        return round(float(val) / canvas_size * 100, 2)
    except (ValueError, ZeroDivisionError):
        return 0.0


def _convert_object(block_type: str, props: dict,
                     canvas_w: int = 1200, canvas_h: int = 800
                     ) -> tuple[Optional[dict], list[str]]:
    """
    Konvertiert einen NagVis-1 Block in ein NagVis-2 Objekt.
    Gibt (obj_dict, warnings) zurück.
    """
    warnings = []
    obj = {}

    x_raw = props.get('x', '0').split(',')[0]  # "100,200" → "100"
    y_raw = props.get('y', '0').split(',')[0]

    obj['x'] = _to_pct(x_raw, canvas_w)
    obj['y'] = _to_pct(y_raw, canvas_h)

    # Iconset
    iconset = props.get('iconset', 'std_small')
    obj['iconset'] = iconset

    # Label
    label = props.get('label', '') or props.get('alias', '')
    if label:
        obj['label'] = label

    # Größe
    if 'icon_size' in props:
        try:
            obj['size'] = int(props['icon_size'])
        except ValueError:
            pass

    # ── Host ──
    if block_type == 'host':
        host_name = props.get('host_name', '')
        if not host_name:
            warnings.append(f"host ohne host_name übersprungen")
            return None, warnings
        obj.update({
            'type':      'host',
            'name':      host_name,
            'iconset':   iconset,
        })

    # ── Service ──
    elif block_type == 'service':
        host_name = props.get('host_name', '')
        svc_desc  = props.get('service_description', '')
        if not host_name or not svc_desc:
            warnings.append(f"service ohne host_name/description übersprungen")
            return None, warnings
        obj.update({
            'type':         'service',
            'host_name':    host_name,
            'name':         svc_desc,
            'iconset':      iconset,
        })

    # ── Hostgroup ──
    elif block_type == 'hostgroup':
        hg = props.get('hostgroup_name', '')
        if not hg:
            warnings.append("hostgroup ohne hostgroup_name übersprungen")
            return None, warnings
        obj.update({'type': 'hostgroup', 'name': hg, 'iconset': iconset})

    # ── Servicegroup ──
    elif block_type == 'servicegroup':
        sg = props.get('servicegroup_name', '')
        if not sg:
            warnings.append("servicegroup ohne servicegroup_name übersprungen")
            return None, warnings
        obj.update({'type': 'servicegroup', 'name': sg, 'iconset': iconset})

    # ── Map (nested) ──
    elif block_type == 'map':
        map_name = props.get('map_name', '')
        if not map_name:
            warnings.append("map ohne map_name übersprungen")
            return None, warnings
        obj.update({'type': 'map', 'name': map_name, 'iconset': 'map'})

    # ── Textbox ──
    elif block_type == 'textbox':
        obj.update({
            'type': 'textbox',
            'text': props.get('text', ''),
            'font_size': int(props.get('fontsize', 13)),
        })
        if 'font_color' in props:
            obj['color'] = props['font_color']
        if 'background_color' in props:
            obj['bg_color'] = props['background_color']
        # Breite/Höhe in %
        if 'width' in props:
            try:
                obj['w'] = round(float(props['width']) / canvas_w * 100, 2)
            except ValueError:
                pass
        if 'height' in props:
            try:
                obj['h'] = round(float(props['height']) / canvas_h * 100, 2)
            except ValueError:
                pass

    # ── Line ──
    elif block_type == 'line':
        x_vals = props.get('x', '0,100').split(',')
        y_vals = props.get('y', '0,100').split(',')
        x2 = _to_pct(x_vals[1], canvas_w) if len(x_vals) > 1 else obj['x'] + 10
        y2 = _to_pct(y_vals[1], canvas_h) if len(y_vals) > 1 else obj['y']
        obj.update({
            'type':       'line',
            'x2':         x2,
            'y2':         y2,
            'line_style': props.get('line_style', 'solid'),
            'line_width': int(props.get('line_width', 1)),
            'color':      props.get('line_color', '#555555'),
        })
        # Weathermap-Linie
        if props.get('view_type') == 'line':
            host_from = props.get('host_name', '')
            host_to   = props.get('host_name2', '')
            if host_from and host_to:
                obj.update({
                    'line_type':  'weathermap',
                    'host_from':  host_from,
                    'host_to':    host_to,
                    'line_width': 3,
                })

    # ── Container (externe URL) ──
    elif block_type == 'container':
        obj.update({
            'type': 'container',
            'url':  props.get('url', ''),
        })

    else:
        warnings.append(f"Unbekannter Block-Typ '{block_type}' übersprungen")
        return None, warnings

    # Layer
    if 'z' in props:
        try:
            obj['layer'] = max(0, min(9, int(props['z'])))
        except ValueError:
            pass

    return obj, warnings


# ══════════════════════════════════════════════════════════════════════
#  Öffentliche API für api/router.py
# ══════════════════════════════════════════════════════════════════════

def migrate_cfg(raw: str, map_id: str,
                canvas_w: int = 1200, canvas_h: int = 800,
                ) -> dict:
    """
    Vollständige Migration einer NagVis-1 .cfg Datei.
    Gibt ein NagVis-2 Map-Dict zurück.
    """
    map_props, raw_objects, warnings = parse_cfg(raw)

    title = (map_props.get('alias') or
             map_props.get('map_name') or
             map_id)

    # Canvas-Größe aus .cfg übernehmen falls vorhanden
    cfg_w = map_props.get('width')
    cfg_h = map_props.get('height')

    if cfg_w and cfg_h:
        try:
            canvas_w = int(cfg_w)
            canvas_h = int(cfg_h)
        except ValueError:
            pass

    # Objekte mit korrektem canvas_w/h konvertieren
    objects  = []
    for obj in raw_objects:
        objects.append(obj)  # bereits konvertiert in parse_cfg

    # Nochmal konvertieren mit den tatsächlichen canvas-Werten
    _, objects_final, warnings2 = parse_cfg(raw)
    warnings.extend(warnings2)

    # Dedupliziere
    seen = set()
    unique_objects = []
    import uuid
    for obj in objects_final:
        obj['object_id'] = f"{obj['type']}::{obj.get('name', obj.get('text',''))[:20]}::{uuid.uuid4().hex[:6]}"
        unique_objects.append(obj)

    return {
        'id':         map_id,
        'title':      title,
        'canvas':     {'mode': 'fixed', 'w': canvas_w, 'h': canvas_h},
        'background': None,
        'parent_map': None,
        'objects':    unique_objects,
        'warnings':   warnings,
        'object_count': len(unique_objects),
    }