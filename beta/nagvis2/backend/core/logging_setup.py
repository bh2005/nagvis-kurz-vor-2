"""
NagVis 2 – Logging-Konfiguration
Unterstützt zwei Formate:
  LOG_FORMAT=text  → menschenlesbares Format (Standard / Development)
  LOG_FORMAT=json  → strukturiertes JSON-Format (Production / ELK / Loki)
"""

import collections
import logging
import os
import sys

LOG_FORMAT  = os.getenv("LOG_FORMAT", "text").lower()
LOG_LEVEL   = os.getenv("LOG_LEVEL",  "INFO").upper()

# ── In-Memory-Ringpuffer ───────────────────────────────────────────────

_LOG_BUFFER_SIZE = int(os.getenv("LOG_BUFFER_LINES", "1000"))
_log_buffer: collections.deque = collections.deque(maxlen=_LOG_BUFFER_SIZE)


class _RingBufferHandler(logging.Handler):
    """Schreibt formatierte Log-Zeilen in den In-Memory-Ringpuffer."""
    def emit(self, record: logging.LogRecord) -> None:
        try:
            _log_buffer.append(self.format(record))
        except Exception:
            pass


def get_log_lines() -> list:
    """Gibt alle gepufferten Log-Zeilen zurück (älteste zuerst)."""
    return list(_log_buffer)


def setup_logging() -> None:
    """Logging global konfigurieren. Einmalig beim App-Start aufrufen."""
    level = getattr(logging, LOG_LEVEL, logging.INFO)

    if LOG_FORMAT == "json":
        _setup_json(level)
    else:
        _setup_text(level)

    # Ringpuffer-Handler an Root-Logger anhängen (ohne eigenen stdout)
    root = logging.getLogger()
    ring = _RingBufferHandler()
    ring.setFormatter(root.handlers[0].formatter if root.handlers else logging.Formatter())
    root.addHandler(ring)

    # Uvicorn-Logger auf gleiches Format umstellen
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        uv_log = logging.getLogger(name)
        uv_log.handlers.clear()
        uv_log.propagate = True


def _setup_text(level: int) -> None:
    logging.basicConfig(
        level=level,
        stream=sys.stdout,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        force=True,
    )


def _setup_json(level: int) -> None:
    try:
        from pythonjsonlogger import jsonlogger

        handler = logging.StreamHandler(sys.stdout)
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
            rename_fields={"levelname": "level", "asctime": "ts", "name": "logger"},
        )
        handler.setFormatter(formatter)

        root = logging.getLogger()
        root.handlers.clear()
        root.addHandler(handler)
        root.setLevel(level)

    except ImportError:
        # python-json-logger nicht installiert → Fallback auf Text
        logging.getLogger("nagvis").warning(
            "python-json-logger nicht installiert – verwende Text-Format. "
            "pip install python-json-logger"
        )
        _setup_text(level)


def get_uvicorn_log_config() -> dict:
    """
    Gibt eine uvicorn-kompatible log_config zurück die dasselbe Format wie
    setup_logging() verwendet. Für uvicorn.run(log_config=...).
    """
    if LOG_FORMAT == "json":
        fmt_class = "pythonjsonlogger.jsonlogger.JsonFormatter"
        fmt_str   = "%(asctime)s %(levelname)s %(name)s %(message)s"
    else:
        fmt_class = "logging.Formatter"
        fmt_str   = "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s"

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {"()": fmt_class, "fmt": fmt_str, "datefmt": "%Y-%m-%dT%H:%M:%S"},
        },
        "handlers": {
            "default": {"class": "logging.StreamHandler", "stream": "ext://sys.stdout",
                        "formatter": "default"},
        },
        "loggers": {
            "uvicorn":        {"handlers": ["default"], "level": LOG_LEVEL, "propagate": False},
            "uvicorn.access": {"handlers": ["default"], "level": LOG_LEVEL, "propagate": False},
            "uvicorn.error":  {"handlers": ["default"], "level": LOG_LEVEL, "propagate": False},
            "nagvis":         {"handlers": ["default"], "level": LOG_LEVEL, "propagate": False},
        },
        "root": {"handlers": ["default"], "level": LOG_LEVEL},
    }
