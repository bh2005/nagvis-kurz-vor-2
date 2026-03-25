"""
Tests für core/logging_setup.py – Logging-Konfiguration
"""

import logging
import sys
from unittest.mock import MagicMock, patch

import pytest


# ── _RingBufferHandler ────────────────────────────────────────────────────────

class TestRingBufferHandler:
    def test_emit_appends_to_buffer(self):
        from core.logging_setup import _RingBufferHandler, _log_buffer
        handler = _RingBufferHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        initial_len = len(_log_buffer)

        record = logging.LogRecord("test", logging.INFO, "", 0, "hello buffer", (), None)
        handler.emit(record)

        assert len(_log_buffer) == initial_len + 1
        assert "hello buffer" in _log_buffer[-1]

    def test_emit_does_not_raise_on_format_error(self):
        from core.logging_setup import _RingBufferHandler
        handler = _RingBufferHandler()
        # Formatter that raises
        bad_fmt = MagicMock(side_effect=Exception("format error"))
        handler.format = bad_fmt

        record = logging.LogRecord("test", logging.ERROR, "", 0, "msg", (), None)
        # Should not raise
        handler.emit(record)


# ── get_log_lines ─────────────────────────────────────────────────────────────

class TestGetLogLines:
    def test_returns_list(self):
        from core.logging_setup import get_log_lines
        result = get_log_lines()
        assert isinstance(result, list)

    def test_reflects_buffered_entries(self):
        from core.logging_setup import _log_buffer, get_log_lines
        _log_buffer.append("__test_marker__")
        lines = get_log_lines()
        assert "__test_marker__" in lines
        _log_buffer.remove("__test_marker__")


# ── setup_logging (text) ──────────────────────────────────────────────────────

class TestSetupLoggingText:
    def test_setup_text_mode(self, monkeypatch):
        monkeypatch.setenv("LOG_FORMAT", "text")
        monkeypatch.setenv("LOG_LEVEL", "WARNING")

        import importlib
        import core.logging_setup as ls
        importlib.reload(ls)

        ls.setup_logging()

        root = logging.getLogger()
        assert root.level <= logging.WARNING

    def test_setup_logging_adds_ring_handler(self, monkeypatch):
        monkeypatch.setenv("LOG_FORMAT", "text")
        import importlib
        import core.logging_setup as ls
        importlib.reload(ls)

        before = len(logging.getLogger().handlers)
        ls.setup_logging()
        after = len(logging.getLogger().handlers)
        assert after > 0


# ── setup_logging (json) ──────────────────────────────────────────────────────

class TestSetupLoggingJson:
    def test_setup_json_with_pythonjsonlogger(self, monkeypatch):
        """json-Format mit installiertem python-json-logger."""
        monkeypatch.setenv("LOG_FORMAT", "json")

        mock_formatter = MagicMock()
        mock_json_logger = MagicMock()
        mock_json_logger.JsonFormatter = MagicMock(return_value=mock_formatter)
        fake_pythonjsonlogger = MagicMock()
        fake_pythonjsonlogger.jsonlogger = mock_json_logger

        import importlib
        import core.logging_setup as ls
        importlib.reload(ls)

        with patch.dict(sys.modules, {"pythonjsonlogger": fake_pythonjsonlogger}):
            ls.setup_logging()

        # Should not raise; root logger gets a handler
        assert len(logging.getLogger().handlers) > 0

    def test_setup_json_fallback_on_import_error(self, monkeypatch):
        """Falls python-json-logger fehlt → Fallback auf Text-Format."""
        monkeypatch.setenv("LOG_FORMAT", "json")

        import importlib
        import core.logging_setup as ls
        importlib.reload(ls)

        with patch.dict(sys.modules, {"pythonjsonlogger": None}):
            # Should fall back to text without raising
            ls.setup_logging()

        assert len(logging.getLogger().handlers) > 0


# ── get_uvicorn_log_config ────────────────────────────────────────────────────

class TestGetUvicornLogConfig:
    def test_returns_dict_with_version(self, monkeypatch):
        monkeypatch.setenv("LOG_FORMAT", "text")
        import importlib
        import core.logging_setup as ls
        importlib.reload(ls)

        cfg = ls.get_uvicorn_log_config()
        assert isinstance(cfg, dict)
        assert cfg["version"] == 1

    def test_text_format_uses_logging_formatter(self, monkeypatch):
        monkeypatch.setenv("LOG_FORMAT", "text")
        import importlib
        import core.logging_setup as ls
        importlib.reload(ls)

        cfg = ls.get_uvicorn_log_config()
        fmt_class = cfg["formatters"]["default"]["()"]
        assert fmt_class == "logging.Formatter"

    def test_json_format_uses_json_formatter(self, monkeypatch):
        monkeypatch.setenv("LOG_FORMAT", "json")
        import importlib
        import core.logging_setup as ls
        importlib.reload(ls)

        cfg = ls.get_uvicorn_log_config()
        fmt_class = cfg["formatters"]["default"]["()"]
        assert "jsonlogger" in fmt_class

    def test_has_uvicorn_loggers(self, monkeypatch):
        monkeypatch.setenv("LOG_FORMAT", "text")
        import importlib
        import core.logging_setup as ls
        importlib.reload(ls)

        cfg = ls.get_uvicorn_log_config()
        loggers = cfg["loggers"]
        assert "uvicorn" in loggers
        assert "uvicorn.access" in loggers
        assert "uvicorn.error" in loggers
        assert "nagvis" in loggers

    def test_disable_existing_loggers_false(self, monkeypatch):
        monkeypatch.setenv("LOG_FORMAT", "text")
        import importlib
        import core.logging_setup as ls
        importlib.reload(ls)

        cfg = ls.get_uvicorn_log_config()
        assert cfg["disable_existing_loggers"] is False


# ── _setup_text / _setup_json ─────────────────────────────────────────────────

class TestSetupHelpers:
    def test_setup_text_configures_root(self):
        from core.logging_setup import _setup_text
        _setup_text(logging.DEBUG)
        root = logging.getLogger()
        assert root.level == logging.DEBUG

    def test_setup_json_configures_root_with_mock(self):
        from core.logging_setup import _setup_json

        mock_formatter = MagicMock()
        mock_json_logger = MagicMock()
        mock_json_logger.JsonFormatter = MagicMock(return_value=mock_formatter)
        fake_pythonjsonlogger = MagicMock()
        fake_pythonjsonlogger.jsonlogger = mock_json_logger

        with patch.dict(sys.modules, {"pythonjsonlogger": fake_pythonjsonlogger}):
            _setup_json(logging.INFO)

        assert len(logging.getLogger().handlers) > 0
