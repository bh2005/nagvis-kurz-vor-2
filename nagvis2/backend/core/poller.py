"""
core/poller.py
==============
Asynchroner Status-Poller mit verbesserter Diff-Logik und Force-Refresh.

Änderungen gegenüber Vorgänger
-------------------------------
1. Erweiterter Diff
   Bisher wurden nur `state` und `acknowledged` verglichen.
   Jetzt werden alle relevanten Felder getrackt:
     - state          → Statuswechsel (UP→DOWN etc.)
     - acknowledged   → ACK gesetzt / entfernt
     - in_downtime    → Downtime gestartet / beendet
     - plugin_output  → Check-Output geändert (nützlich für Detail-Tooltips)

   Der Diff-Key enthält zusätzlich den Änderungstyp:
     "state_change" | "ack_change" | "downtime_change" | "output_change"
   Das erlaubt dem Browser, gezielt zu animieren (z.B. nur Downtime-Badge
   aktualisieren ohne den ganzen Node neu zu rendern).

2. Force-Refresh via asyncio.Event
   `trigger_refresh()` setzt ein asyncio.Event das den laufenden
   sleep() im _loop() unterbricht. Der nächste Poll startet sofort.
   Kein separater Task, kein cancel()/restart()-Zyklus.

   Wird aus dem WebSocket-Handler in main.py aufgerufen:
     if cmd == "force_refresh":
         poller.trigger_refresh()

3. Downtime-Transitions im Event
   status_update-Events enthalten jetzt:
     "downtime_started": [host_names]
     "downtime_ended":   [host_names]
   Damit kann der Browser einen separaten Downtime-Banner rendern.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from backend.livestatus.client import LivestatusClient, LivestatusConfig

log = logging.getLogger("nagvis.poller")

# Felder die einen Diff auslösen (Reihenfolge = Priorität im change_type)
_HOST_DIFF_FIELDS = [
    ("state",         "state_change"),
    ("acknowledged",  "ack_change"),
    ("in_downtime",   "downtime_change"),
    ("plugin_output", "output_change"),
]
_SVC_DIFF_FIELDS = [
    ("state",         "state_change"),
    ("acknowledged",  "ack_change"),
    ("in_downtime",   "downtime_change"),
    ("plugin_output", "output_change"),
]


def _detect_changes(new: dict, old: dict | None, diff_fields: list) -> str | None:
    """
    Vergleicht new mit old und gibt den ersten geänderten change_type zurück.
    None wenn kein relevantes Feld geändert hat.
    """
    if old is None:
        return "initial"
    for field, change_type in diff_fields:
        if new.get(field) != old.get(field):
            return change_type
    return None


class StatusPoller:
    """
    Pollt Livestatus periodisch, diffed den State und publiziert
    Änderungen über einen asyncio.Queue-Kanal an den WS-Manager.

    Kein Broadcast von unverändertem State → weniger Traffic,
    weniger DOM-Updates im Browser.
    """

    def __init__(
        self,
        config:       LivestatusConfig,
        interval:     float = 30.0,
        change_queue: asyncio.Queue | None = None,
    ):
        self.client   = LivestatusClient(config)
        self.interval = interval
        self.queue    = change_queue or asyncio.Queue()

        # State-Cache: key → letzter bekannter Status als dict
        self._host_cache:    dict[str, dict] = {}
        self._service_cache: dict[str, dict] = {}

        # Force-Refresh: wird von trigger_refresh() gesetzt,
        # vom _loop() konsumiert und sofort wieder gelöscht.
        self._refresh_event = asyncio.Event()

        self._running         = False
        self._task:           asyncio.Task | None = None
        self._last_poll_ts:   float = 0.0
        self._poll_count:     int   = 0
        self._error_count:    int   = 0
        self._last_error:     str   = ""

    # ── Lifecycle ─────────────────────────────────────────────

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="livestatus-poller")
        log.info("Poller started (interval=%.0fs)", self.interval)

    async def stop(self):
        self._running = False
        self._refresh_event.set()   # ggf. laufendes wait() aufwecken
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        log.info("Poller stopped")

    # ── Force-Refresh ─────────────────────────────────────────

    def trigger_refresh(self):
        """
        Löst sofortigen Poll aus – wird vom WS-Handler aufgerufen
        wenn der Browser { cmd: "force_refresh" } sendet.
        Thread-safe (setzt nur ein asyncio.Event).
        """
        log.info("Force-refresh triggered")
        self._refresh_event.set()

    # ── Haupt-Loop ────────────────────────────────────────────

    async def _loop(self):
        # Erster Poll sofort beim Start
        await self._poll()

        while self._running:
            # Wartet entweder das volle Intervall ab ODER
            # wird durch trigger_refresh() früher aufgeweckt.
            try:
                await asyncio.wait_for(
                    self._refresh_event.wait(),
                    timeout=self.interval,
                )
                # Event wurde gesetzt → zurücksetzen, dann sofort pollen
                self._refresh_event.clear()
            except asyncio.TimeoutError:
                # Normaler Ablauf: Intervall abgelaufen
                pass

            if self._running:
                await self._poll()

    # ── Poll & Diff ───────────────────────────────────────────

    async def _poll(self):
        start = time.monotonic()
        self._poll_count += 1
        poll_no = self._poll_count

        try:
            hosts    = await self.client.get_hosts()
            services = await self.client.get_services()
        except Exception as e:
            self._error_count += 1
            self._last_error   = str(e)
            log.error("Poll #%d failed: %s", poll_no, e)
            await self.queue.put({
                "event":   "backend_error",
                "message": str(e),
                "ts":      int(time.time()),
            })
            return

        elapsed = time.monotonic() - start
        self._last_poll_ts = time.time()

        # ── Host-Diff ─────────────────────────────────────────
        changed_hosts      = []
        downtime_started   = []   # Hostnamen bei denen Downtime neu begann
        downtime_ended     = []   # Hostnamen bei denen Downtime endete

        for host in hosts:
            d   = host.to_dict()
            key = host.name
            old = self._host_cache.get(key)
            change_type = _detect_changes(d, old, _HOST_DIFF_FIELDS)

            if change_type:
                d["change_type"] = change_type
                changed_hosts.append(d)
                self._host_cache[key] = d

                # Downtime-Transition gesondert tracken
                if change_type == "downtime_change" and old is not None:
                    if d["in_downtime"] and not old["in_downtime"]:
                        downtime_started.append(host.name)
                    elif not d["in_downtime"] and old["in_downtime"]:
                        downtime_ended.append(host.name)

        # ── Service-Diff ──────────────────────────────────────
        changed_services = []

        for svc in services:
            d   = svc.to_dict()
            key = f"{svc.host_name}::{svc.description}"
            old = self._service_cache.get(key)
            change_type = _detect_changes(d, old, _SVC_DIFF_FIELDS)

            if change_type:
                d["change_type"] = change_type
                changed_services.append(d)
                self._service_cache[key] = d

        # ── Event zusammenstellen ─────────────────────────────
        if changed_hosts or changed_services:
            event: dict[str, Any] = {
                "event":    "status_update",
                "ts":       int(self._last_poll_ts),
                "poll":     poll_no,
                "elapsed":  round(elapsed * 1000),   # ms
                "hosts":    changed_hosts,
                "services": changed_services,
            }
            # Downtime-Transitions als eigene Listen mitschicken
            if downtime_started:
                event["downtime_started"] = downtime_started
            if downtime_ended:
                event["downtime_ended"] = downtime_ended

            await self.queue.put(event)
            log.debug(
                "Poll #%d: %d host-changes (%d dt-start, %d dt-end), "
                "%d svc-changes (%.0fms)",
                poll_no,
                len(changed_hosts), len(downtime_started), len(downtime_ended),
                len(changed_services), elapsed * 1000,
            )
        else:
            # Keine Änderungen → Heartbeat damit der Browser weiß dass
            # der Server noch läuft
            await self.queue.put({
                "event": "heartbeat",
                "ts":    int(self._last_poll_ts),
                "poll":  poll_no,
            })

    # ── Snapshot (für neue WS-Verbindungen) ───────────────────

    def get_full_snapshot(self) -> dict:
        """
        Vollständiger aktueller State – wird an neu verbundene
        Browser-Clients gesendet damit sie sofort den aktuellen
        Status sehen, ohne auf den nächsten Poll zu warten.
        """
        return {
            "event":    "snapshot",
            "ts":       int(self._last_poll_ts),
            "hosts":    list(self._host_cache.values()),
            "services": list(self._service_cache.values()),
        }

    # ── Stats ─────────────────────────────────────────────────

    @property
    def stats(self) -> dict:
        return {
            "running":        self._running,
            "interval":       self.interval,
            "poll_count":     self._poll_count,
            "error_count":    self._error_count,
            "last_error":     self._last_error,
            "last_poll_ts":   self._last_poll_ts,
            "hosts_cached":   len(self._host_cache),
            "svcs_cached":    len(self._service_cache),
            "refresh_pending": self._refresh_event.is_set(),
        }