# NagVis 2 – API-Referenz

Basis-URL: `http://<host>:<port>/api`

Interaktive Dokumentation (nur `DEBUG=true`): `http://localhost:8000/api/docs`

---

## Health

### GET /api/health

Systemstatus und Livestatus-Verbindung prüfen.

**Antwort:**
```json
{
  "status": "ok",
  "environment": "development",
  "demo_mode": false,
  "livestatus": {
    "connected": true,
    "demo": false,
    "error": null
  },
  "version": "2.0-beta"
}
```

---

## Maps

### GET /api/maps

Alle Maps auflisten.

**Antwort:**
```json
[
  {
    "id": "datacenter-hh",
    "title": "Datacenter Hamburg",
    "object_count": 12,
    "parent_map": null,
    "canvas": { "mode": "ratio", "ratio": "16:9" },
    "background": "/backgrounds/datacenter-hh.png"
  }
]
```

---

### POST /api/maps

Neue Map erstellen.

**Body:**
```json
{
  "title": "Meine Map",
  "map_id": "meine-map",
  "canvas": { "mode": "free" }
}
```

`map_id` ist optional – wird aus dem Titel abgeleitet wenn nicht angegeben.

**Antwort:** `201 Created` mit Map-Objekt

---

### GET /api/maps/{map_id}

Map mit allen Objekten laden.

**Antwort:**
```json
{
  "id": "datacenter-hh",
  "title": "Datacenter Hamburg",
  "canvas": { "mode": "ratio", "ratio": "16:9", "overflow": "clamp" },
  "background": "/backgrounds/datacenter-hh.png",
  "parent_map": null,
  "objects": [ ... ]
}
```

---

### DELETE /api/maps/{map_id}

Map und zugehöriges Hintergrundbild löschen.

**Antwort:**
```json
{ "deleted": "datacenter-hh" }
```

---

### PUT /api/maps/{map_id}/title

Map umbenennen.

**Body:** `{ "title": "Neuer Name" }`

---

### PUT /api/maps/{map_id}/parent

Parent-Map setzen.

**Body:** `{ "parent_map": "main-map" }` oder `{ "parent_map": null }`

---

### PUT /api/maps/{map_id}/canvas

Canvas-Konfiguration setzen.

**Body (Beispiele):**
```json
{ "mode": "free" }
{ "mode": "ratio", "ratio": "16:9", "overflow": "clamp" }
{ "mode": "fixed", "w": 1920, "h": 1080 }
{ "mode": "background" }
```

Canvas `overflow`-Werte: `clamp` (Standard) | `free`

---

### POST /api/maps/{map_id}/background

Hintergrundbild hochladen (multipart/form-data).

**Parameter:** `file` – Bilddatei (PNG, JPG, GIF, WebP, SVG)

**Antwort:**
```json
{ "url": "/backgrounds/datacenter-hh.png" }
```

---

### GET /api/maps/{map_id}/export

Map als ZIP-Archiv herunterladen.

ZIP enthält:
- `manifest.json` – Metadaten und Format-Version
- `map.json` – vollständige Map-Konfiguration
- `background.<ext>` – Hintergrundbild (falls vorhanden)

---

### POST /api/maps/import

Map aus ZIP-Archiv importieren.

**Query-Parameter:**
- `map_id` (optional) – Map-ID überschreiben
- `dry_run` (optional, default: false) – nur validieren, nichts speichern

**Body:** ZIP-Datei (multipart/form-data, Feld `file`)

**Antwort:**
```json
{
  "map_id": "datacenter-hh",
  "title": "Datacenter Hamburg",
  "object_count": 12,
  "bg_saved": true,
  "warnings": []
}
```

---

### POST /api/migrate

NagVis-1 `.cfg`-Datei importieren.

**Query-Parameter:**
- `map_id` (optional) – Map-ID (Standard: Dateiname)
- `canvas_w` (optional, default: 1200) – Canvas-Breite in px
- `canvas_h` (optional, default: 800) – Canvas-Höhe in px
- `dry_run` (optional, default: false) – nur Vorschau

**Body:** `.cfg`-Datei (multipart/form-data, Feld `file`)

---

## Objekte

Objekte werden immer im Kontext einer Map verwaltet.

### Objekt-Datenstruktur

```json
{
  "object_id": "host::srv-web-01::abc123",
  "type": "host",
  "name": "srv-web-01",
  "x": 25.5,
  "y": 40.0,
  "iconset": "server",
  "label": "Webserver 01",
  "show_label": true,
  "size": 32,
  "layer": 0
}
```

**Typen:** `host` | `service` | `hostgroup` | `servicegroup` | `map` | `textbox` | `line` | `container` | `gadget`

**Koordinaten:** immer in Prozent (0–100), nie in Pixeln

---

### POST /api/maps/{map_id}/objects

Neues Objekt anlegen.

**Body (Host-Beispiel):**
```json
{
  "type": "host",
  "name": "srv-web-01",
  "x": 25.5,
  "y": 40.0,
  "iconset": "server",
  "label": "Webserver 01",
  "size": 32
}
```

**Body (Service-Beispiel):**
```json
{
  "type": "service",
  "host_name": "srv-web-01",
  "name": "HTTP Response Time",
  "x": 50.0,
  "y": 30.0
}
```

**Body (Textbox-Beispiel):**
```json
{
  "type": "textbox",
  "text": "Zone A",
  "x": 10.0,
  "y": 5.0,
  "font_size": 16,
  "bold": true,
  "color": "#0ea5e9"
}
```

**Body (Linie-Beispiel):**
```json
{
  "type": "line",
  "x": 20.0,
  "y": 30.0,
  "x2": 60.0,
  "y2": 30.0,
  "line_style": "solid",
  "line_width": 2
}
```

**Antwort:** `201 Created` mit Objekt inkl. generierter `object_id`

---

### PATCH /api/maps/{map_id}/objects/{object_id}/pos

Position eines Objekts aktualisieren (z.B. nach Drag & Drop).

**Body:**
```json
{ "x": 35.5, "y": 42.0 }
```

Bei Linien zusätzlich:
```json
{ "x": 20.0, "y": 30.0, "x2": 65.0, "y2": 30.0 }
```

---

### PATCH /api/maps/{map_id}/objects/{object_id}/props

Eigenschaften eines Objekts aktualisieren.

**Body (alle Felder optional):**
```json
{
  "label": "Neuer Anzeigename",
  "show_label": true,
  "size": 48,
  "iconset": "server",
  "layer": 1,
  "name": "neuer-hostname",
  "host_name": "anderer-host",
  "text": "Neuer Text",
  "font_size": 14,
  "bold": false,
  "color": "#ffffff",
  "bg_color": "#333333",
  "line_style": "dashed",
  "line_width": 3,
  "gadget_config": { "type": "radial", "value": 42 }
}
```

---

### DELETE /api/maps/{map_id}/objects/{object_id}

Objekt aus der Map entfernen.

**Antwort:**
```json
{ "deleted": "host::srv-web-01::abc123" }
```

---

## Aktionen

### POST /api/actions

Monitoring-Aktion via Livestatus ausführen.

**Body:**
```json
{
  "action": "ack_host",
  "host_name": "srv-web-01",
  "comment": "Wird geprüft",
  "author": "admin"
}
```

| `action` | Beschreibung | Pflichtfelder |
|---|---|---|
| `ack_host` | Host-Problem bestätigen | `host_name` |
| `ack_service` | Service-Problem bestätigen | `host_name`, `service_name` |
| `downtime_host` | Host-Downtime einplanen | `host_name`, `start_time`, `end_time` |
| `reschedule` | Check sofort erzwingen | `host_name` |

`start_time` / `end_time` sind Unix-Timestamps. Ohne Angabe: jetzt bis jetzt+1h.

**Antwort:**
```json
{ "status": "ok" }
```

Im Demo-Modus:
```json
{ "status": "ok", "demo": true }
```

---

## Kiosk-User

### GET /api/kiosk-users

Alle Kiosk-User auflisten.

---

### POST /api/kiosk-users

Neuen Kiosk-User anlegen.

**Body:**
```json
{
  "label": "Leitwarte TV-1",
  "maps": ["datacenter-hh", "network-overview"],
  "order": ["datacenter-hh", "network-overview"],
  "interval": 30
}
```

**Antwort:** `201 Created` mit User-Objekt inkl. generiertem `id` und `token`

---

### PUT /api/kiosk-users/{uid}

Kiosk-User aktualisieren (alle Felder optional).

**Body:**
```json
{
  "label": "Leitwarte TV-1 (neu)",
  "interval": 60
}
```

---

### DELETE /api/kiosk-users/{uid}

Kiosk-User löschen (Token wird ungültig).

---

### GET /api/kiosk-users/resolve?token={token}

Token zu Kiosk-User auflösen (kein Auth erforderlich – für Kiosk-Browser).

**Antwort:** User-Objekt oder `404`

---

## WebSocket

### WS /ws/map/{map_id}

Echtzeit-Statusstream für eine Map.

**Verbindung aufbauen:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/map/datacenter-hh');
```

### Server → Client

**snapshot** – vollständiger Statusdump beim Verbindungsaufbau:
```json
{
  "event": "snapshot",
  "ts": 1712345678.0,
  "elapsed": 42,
  "hosts": [
    {
      "name": "srv-web-01",
      "state": 0,
      "state_label": "UP",
      "output": "PING OK - 1.4ms",
      "acknowledged": false,
      "in_downtime": false,
      "services_ok": 8,
      "services_warn": 0,
      "services_crit": 1,
      "services_unkn": 0,
      "last_change": 1712340000
    }
  ],
  "services": [ ... ]
}
```

**status_update** – nur geänderte Hosts/Services:
```json
{
  "event": "status_update",
  "ts": 1712345688.0,
  "elapsed": 38,
  "hosts": [ { ...geänderter Host..., "change_type": "state_change" } ],
  "services": []
}
```

**heartbeat** – regelmäßig wenn keine Änderungen:
```json
{ "event": "heartbeat", "ts": 1712345698.0 }
```

**object_added** – neues Objekt wurde über API hinzugefügt:
```json
{ "event": "object_added", "map_id": "datacenter-hh", "object": { ... } }
```

**object_updated** – Objekt wurde geändert:
```json
{ "event": "object_updated", "map_id": "datacenter-hh", "object": { ... } }
```

**object_removed** – Objekt wurde gelöscht:
```json
{ "event": "object_removed", "map_id": "datacenter-hh", "object_id": "host::srv-web-01::abc123" }
```

**map_reloaded** – Canvas oder Hintergrund wurde geändert:
```json
{ "event": "map_reloaded", "map_id": "datacenter-hh" }
```

**backend_error** – Fehler im Poller:
```json
{ "event": "backend_error", "message": "Connection refused", "ts": 1712345700.0 }
```

### Client → Server

**force_refresh** – sofortigen Status-Abruf erzwingen:
```json
{ "cmd": "force_refresh" }
```
