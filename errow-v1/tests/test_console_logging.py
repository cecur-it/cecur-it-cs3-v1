from __future__ import annotations

import io
import logging
import sys
from typing import TYPE_CHECKING

import pytest

from errow.telemetry import logging as errow_logging


if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path


@pytest.fixture
def clean_loggers() -> Iterator[None]:
    tracked = [logging.getLogger(name) for name in errow_logging._TRACKED_ROOTS]
    saved = [(logger.handlers[:], logger.level, logger.propagate) for logger in tracked]
    for logger in tracked:
        logger.handlers = []
    try:
        yield
    finally:
        for logger, (handlers, level, propagate) in zip(tracked, saved, strict=True):
            logger.handlers = handlers
            logger.setLevel(level)
            logger.propagate = propagate


def _stderr_handlers(logger: logging.Logger) -> list[logging.Handler]:
    return [h for h in logger.handlers if getattr(h, errow_logging._STREAM_TAG, False)]


@pytest.mark.usefixtures("clean_loggers")
def test_console_logging_hides_warnings_and_shows_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("errow_DEBUG", raising=False)
    err = io.StringIO()
    monkeypatch.setattr(sys, "stderr", err)
    errow_logging.setup_console_logging()

    logger = logging.getLogger("errow.llm.request_log")
    logger.warning("llm_request outcome=error")
    logger.error("boom")

    out = err.getvalue()
    assert "llm_request" not in out
    assert "ERROR" in out
    assert "errow.llm.request_log: boom" in out


@pytest.mark.usefixtures("clean_loggers")
def test_console_logging_follows_the_current_stderr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("errow_DEBUG", raising=False)
    first = io.StringIO()
    monkeypatch.setattr(sys, "stderr", first)
    errow_logging.setup_console_logging()
    second = io.StringIO()
    monkeypatch.setattr(sys, "stderr", second)

    logging.getLogger("errow.test").error("after swap")

    assert first.getvalue() == ""
    assert "after swap" in second.getvalue()


@pytest.mark.usefixtures("clean_loggers")
def test_console_logging_is_idempotent() -> None:
    errow_logging.setup_console_logging()
    errow_logging.setup_console_logging()

    for name in errow_logging._TRACKED_ROOTS:
        assert len(_stderr_handlers(logging.getLogger(name))) == 1


@pytest.mark.usefixtures("clean_loggers")
def test_scan_logging_reuses_the_console_handler(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("errow_DEBUG", raising=False)
    err = io.StringIO()
    monkeypatch.setattr(sys, "stderr", err)
    errow_logging.setup_console_logging()
    teardown = errow_logging.setup_scan_logging(tmp_path)

    errow_logger = logging.getLogger("errow")
    assert len(_stderr_handlers(errow_logger)) == 1
    logging.getLogger("errow.test").error("once")
    assert err.getvalue().count("once") == 1
    assert "once" in (tmp_path / "errow.log").read_text(encoding="utf-8")

    teardown()
    assert len(_stderr_handlers(errow_logger)) == 1
    assert not any(isinstance(h, logging.FileHandler) for h in errow_logger.handlers)


@pytest.mark.usefixtures("clean_loggers")
def test_scan_logging_alone_still_attaches_a_stderr_handler(tmp_path: Path) -> None:
    teardown = errow_logging.setup_scan_logging(tmp_path)
    errow_logger = logging.getLogger("errow")
    assert len(_stderr_handlers(errow_logger)) == 1
    teardown()
    assert _stderr_handlers(errow_logger) == []
