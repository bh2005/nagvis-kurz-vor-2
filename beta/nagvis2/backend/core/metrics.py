"""
NagVis 2 – Prometheus-Metriken
Definiert alle Gauges, Counter und Histogramme.
Wird von main.py (Middleware + /metrics-Mount) und ws/manager.py (Poll) verwendet.
"""

from prometheus_client import (
    Counter, Gauge, Histogram, CollectorRegistry, CONTENT_TYPE_LATEST,
    generate_latest, REGISTRY,
)

# ── HTTP-Request-Metriken ──────────────────────────────────────────────

http_requests_total = Counter(
    "nagvis2_http_requests_total",
    "Anzahl HTTP-Requests",
    ["method", "path", "status"],
)

http_request_duration = Histogram(
    "nagvis2_http_request_duration_seconds",
    "HTTP-Request-Dauer in Sekunden",
    ["method", "path"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ── WebSocket-Metriken ─────────────────────────────────────────────────

ws_connections = Gauge(
    "nagvis2_ws_connections",
    "Aktive WebSocket-Verbindungen gesamt",
)

ws_connections_per_map = Gauge(
    "nagvis2_ws_connections_per_map",
    "Aktive WebSocket-Verbindungen je Map",
    ["map_id"],
)

# ── Backend-Metriken ───────────────────────────────────────────────────

backend_reachable = Gauge(
    "nagvis2_backend_reachable",
    "1 wenn Backend erreichbar, 0 wenn nicht",
    ["backend_id", "backend_type"],
)

backend_poll_duration = Histogram(
    "nagvis2_backend_poll_duration_seconds",
    "Dauer des Status-Poll-Zyklus in Sekunden",
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

backend_poll_errors = Counter(
    "nagvis2_backend_poll_errors_total",
    "Fehler beim Backend-Poll",
    ["backend_id"],
)

# ── App-Metriken ───────────────────────────────────────────────────────

maps_total = Gauge(
    "nagvis2_maps_total",
    "Anzahl konfigurierter Maps",
)

objects_total = Gauge(
    "nagvis2_objects_total",
    "Anzahl aller Objekte auf allen Maps",
)
