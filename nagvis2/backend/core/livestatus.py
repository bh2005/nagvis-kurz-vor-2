"""
NagVis 2 – Livestatus Connector
Unterstützt: TCP-Socket, Unix-Socket, Auto-Detect (OMD).
Gibt strukturierte Host/Service-Daten zurück.
"""

import asyncio
import logging
import socket
import re
import time
from typing import Optional
from core.config import settings

log = logging.getLogger("nagvis.livestatus.core")


# ══════════════════════════════════════════════════════════════════════
#  Low-Level Socket Query
# ══════════════════════════════════════════════════════════════════════

async def _query_tcp(host: str, port: int, query: str) -> str:
    t0 = time.monotonic()
    log.debug("TCP connect → %s:%d", host, port)
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=5.0
        )
        writer.write(query.encode())
        writer.write_eof()
        data = await asyncio.wait_for(reader.read(1 << 20), timeout=10.0)
        writer.close()
        await writer.wait_closed()
        ms = int((time.monotonic() - t0) * 1000)
        log.debug("TCP %s:%d OK – %d bytes in %dms", host, port, len(data), ms)
        return data.decode("utf-8", errors="replace")
    except Exception as e:
        log.warning("TCP %s:%d FEHLER – %s", host, port, e)
        raise


async def _query_unix(path: str, query: str) -> str:
    t0 = time.monotonic()
    log.debug("Unix-Socket connect → %s", path)
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_unix_connection(path), timeout=5.0
        )
        writer.write(query.encode())
        writer.write_eof()
        data = await asyncio.wait_for(reader.read(1 << 20), timeout=10.0)
        writer.close()
        await writer.wait_closed()
        ms = int((time.monotonic() - t0) * 1000)
        log.debug("Unix %s OK – %d bytes in %dms", path, len(data), ms)
        return data.decode("utf-8", errors="replace")
    except Exception as e:
        log.warning("Unix %s FEHLER – %s", path, e)
        raise


async def _query(lql: str) -> str:
    """Sendet eine LQL-Abfrage zum konfigurierten Livestatus-Socket."""
    t = settings.LIVESTATUS_TYPE

    if t == "unix":
        return await _query_unix(settings.LIVESTATUS_PATH, lql)

    if t == "tcp":
        return await _query_tcp(settings.LIVESTATUS_HOST, settings.LIVESTATUS_PORT, lql)

    # auto: zuerst Unix probieren, dann TCP
    import os
    paths_to_try = []

    # OMD: /omd/sites/<site>/tmp/run/live
    if settings.LIVESTATUS_SITE:
        paths_to_try.append(f"/omd/sites/{settings.LIVESTATUS_SITE}/tmp/run/live")
    else:
        # Alle OMD-Sites durchsuchen
        omd_base = "/omd/sites"
        if os.path.isdir(omd_base):
            for site in sorted(os.listdir(omd_base)):
                p = f"{omd_base}/{site}/tmp/run/live"
                if os.path.exists(p):
                    paths_to_try.append(p)
        # Nagios-Standard-Pfade
        paths_to_try += [
            "/var/run/nagios/live",
            "/var/lib/nagios3/rw/live",
            settings.LIVESTATUS_PATH,
        ]

    for path in paths_to_try:
        if os.path.exists(path):
            try:
                return await _query_unix(path, lql)
            except Exception as e:
                log.warning("auto: Unix %s fehlgeschlagen – %s", path, e)
                continue

    # TCP als letzter Ausweg
    return await _query_tcp(settings.LIVESTATUS_HOST, settings.LIVESTATUS_PORT, lql)


# ══════════════════════════════════════════════════════════════════════
#  LQL Parser
# ══════════════════════════════════════════════════════════════════════

def _parse_lql_response(raw: str, columns: list[str]) -> list[dict]:
    """Parst CSV-ähnliche Livestatus-Antwort in eine Liste von Dicts."""
    results = []
    for line in raw.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split(";")
        if len(parts) != len(columns):
            continue
        results.append(dict(zip(columns, parts)))
    return results


# ══════════════════════════════════════════════════════════════════════
#  Host-Status
# ══════════════════════════════════════════════════════════════════════

HOST_COLS = [
    "name", "state", "state_type", "plugin_output",
    "acknowledged", "scheduled_downtime_depth",
    "num_services_ok", "num_services_warn",
    "num_services_crit", "num_services_unknown",
    "last_state_change", "check_command",
]

STATE_LABELS = {0: "UP", 1: "DOWN", 2: "UNREACHABLE"}

LQL_HOSTS = (
    "GET hosts\n"
    f"Columns: {' '.join(HOST_COLS)}\n"
    "OutputFormat: csv\n"
    "Separators: 10 59 44 124\n\n"
)


async def get_hosts() -> list[dict]:
    """Alle Hosts vom Livestatus abrufen."""
    try:
        raw  = await _query(LQL_HOSTS)
        rows = _parse_lql_response(raw, HOST_COLS)
    except Exception as e:
        return []

    result = []
    for r in rows:
        try:
            state = int(r["state"])
        except ValueError:
            state = 3
        result.append({
            "name":           r["name"],
            "state":          state,
            "state_label":    STATE_LABELS.get(state, "UNKNOWN"),
            "output":         r["plugin_output"],
            "acknowledged":   r["acknowledged"] == "1",
            "in_downtime":    int(r.get("scheduled_downtime_depth", 0)) > 0,
            "services_ok":    int(r.get("num_services_ok",    0) or 0),
            "services_warn":  int(r.get("num_services_warn",  0) or 0),
            "services_crit":  int(r.get("num_services_crit",  0) or 0),
            "services_unkn":  int(r.get("num_services_unknown",0) or 0),
            "last_change":    int(r.get("last_state_change",  0) or 0),
        })
    return result


# ══════════════════════════════════════════════════════════════════════
#  Service-Status
# ══════════════════════════════════════════════════════════════════════

SVC_COLS = [
    "host_name", "description", "state", "plugin_output",
    "acknowledged", "scheduled_downtime_depth", "last_state_change",
]

SVC_STATE_LABELS = {0: "OK", 1: "WARNING", 2: "CRITICAL", 3: "UNKNOWN"}

LQL_SERVICES = (
    "GET services\n"
    f"Columns: {' '.join(SVC_COLS)}\n"
    "OutputFormat: csv\n"
    "Separators: 10 59 44 124\n\n"
)


async def get_services() -> list[dict]:
    try:
        raw  = await _query(LQL_SERVICES)
        rows = _parse_lql_response(raw, SVC_COLS)
    except Exception:
        return []

    result = []
    for r in rows:
        try:
            state = int(r["state"])
        except ValueError:
            state = 3
        result.append({
            "host_name":   r["host_name"],
            "name":        r["description"],
            "state":       state,
            "state_label": SVC_STATE_LABELS.get(state, "UNKNOWN"),
            "output":      r["plugin_output"],
            "acknowledged": r["acknowledged"] == "1",
            "in_downtime": int(r.get("scheduled_downtime_depth", 0)) > 0,
            "last_change": int(r.get("last_state_change", 0) or 0),
        })
    return result


# ══════════════════════════════════════════════════════════════════════
#  Aktionen: ACK / Downtime / Reschedule
# ══════════════════════════════════════════════════════════════════════

async def send_command(cmd: str) -> bool:
    """Sendet einen Nagios External Command via Livestatus."""
    import time
    lql = f"COMMAND [{int(time.time())}] {cmd}\n\n"
    try:
        await _query(lql)
        return True
    except Exception:
        return False


async def acknowledge_host(host: str, comment: str, author: str = "nagvis2") -> bool:
    cmd = f"ACKNOWLEDGE_HOST_PROBLEM;{host};1;1;0;{author};{comment}"
    return await send_command(cmd)


async def acknowledge_service(host: str, svc: str, comment: str,
                               author: str = "nagvis2") -> bool:
    cmd = f"ACKNOWLEDGE_SVC_PROBLEM;{host};{svc};1;1;0;{author};{comment}"
    return await send_command(cmd)


async def schedule_host_downtime(host: str, start: int, end: int,
                                  comment: str, author: str = "nagvis2") -> bool:
    cmd = f"SCHEDULE_HOST_DOWNTIME;{host};{start};{end};1;0;0;{author};{comment}"
    return await send_command(cmd)


async def schedule_service_downtime(host: str, svc: str, start: int, end: int,
                                     comment: str, author: str = "nagvis2") -> bool:
    cmd = f"SCHEDULE_SVC_DOWNTIME;{host};{svc};{start};{end};1;0;0;{author};{comment}"
    return await send_command(cmd)


async def remove_host_ack(host: str) -> bool:
    cmd = f"REMOVE_HOST_ACKNOWLEDGEMENT;{host}"
    return await send_command(cmd)


async def remove_service_ack(host: str, svc: str) -> bool:
    cmd = f"REMOVE_SVC_ACKNOWLEDGEMENT;{host};{svc}"
    return await send_command(cmd)


async def _get_downtime_ids(host: str, svc: str = "") -> list[int]:
    """Liefert aktive Downtime-IDs für Host oder Service (CSV-Fallback)."""
    lql = "GET downtimes\nColumns: id\n"
    lql += f"Filter: host_name = {host}\n"
    if svc:
        lql += f"Filter: service_description = {svc}\n"
    else:
        lql += "Filter: service_description = \n"
    lql += "OutputFormat: csv\n\n"
    try:
        raw = await _query(lql)
        ids = []
        for line in raw.strip().splitlines():
            line = line.strip()
            if line.isdigit():
                ids.append(int(line))
        return ids
    except Exception as e:
        log.warning("_get_downtime_ids failed: %s", e)
        return []


async def remove_host_downtime(host: str) -> bool:
    """Löscht alle aktiven Downtimes eines Hosts."""
    ids = await _get_downtime_ids(host)
    if not ids:
        log.warning("remove_host_downtime: keine aktiven Downtimes für '%s'", host)
        return False
    results = [await send_command(f"DEL_HOST_DOWNTIME;{dt_id}") for dt_id in ids]
    return any(results)


async def remove_service_downtime(host: str, svc: str) -> bool:
    """Löscht alle aktiven Downtimes eines Services."""
    ids = await _get_downtime_ids(host, svc)
    if not ids:
        log.warning("remove_service_downtime: keine Downtimes für '%s'/'%s'", host, svc)
        return False
    results = [await send_command(f"DEL_SVC_DOWNTIME;{dt_id}") for dt_id in ids]
    return any(results)


async def reschedule_host_check(host: str) -> bool:
    import time
    cmd = f"SCHEDULE_FORCED_HOST_CHECK;{host};{int(time.time())}"
    return await send_command(cmd)


async def get_hostgroups() -> list[dict]:
    """Alle Hostgruppen mit Mitgliederliste aus Livestatus."""
    lql = "GET hostgroups\nColumns: name members\nOutputFormat: csv\n\n"
    try:
        raw = await _query(lql)
    except Exception:
        return []
    result = []
    for line in raw.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split(";", 1)
        if not parts[0].strip():
            continue
        name = parts[0].strip()
        members = [m.strip() for m in parts[1].split(",") if m.strip()] if len(parts) > 1 else []
        result.append({"name": name, "members": members})
    return result


# ══════════════════════════════════════════════════════════════════════
#  Health-Check
# ══════════════════════════════════════════════════════════════════════

async def check_connection() -> dict:
    """Prüft ob Livestatus erreichbar ist."""
    if settings.DEMO_MODE:
        return {"connected": False, "demo": True, "error": None}
    try:
        raw = await _query("GET hosts\nColumns: name\nLimit: 1\nOutputFormat: csv\n\n")
        return {"connected": True, "demo": False, "error": None}
    except asyncio.TimeoutError:
        return {"connected": False, "demo": False, "error": "timeout"}
    except Exception as e:
        return {"connected": False, "demo": False, "error": str(e)}