from __future__ import annotations

import json
import os
import queue
import sys
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any


CONTROL_PREFIX = "[typeup-control] "
REQUEST_TYPE = "polish_confirm"
RESPONSE_TYPE = "polish_confirm_response"
DEFAULT_TIMEOUT_SECONDS = 180.0

_response_queue: "queue.Queue[dict[str, Any]]" = queue.Queue()
_pending_responses: dict[str, dict[str, Any]] = {}
_reader_started = False
_reader_lock = threading.Lock()


@dataclass(frozen=True)
class PolishConfirmationResult:
    accepted: bool
    text: str = ""


def request_polish_confirmation(
    original_text: str,
    polished_text: str,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> PolishConfirmationResult:
    """Ask the desktop shell to confirm a light-polish result before typing."""
    if not _desktop_confirmation_enabled():
        return PolishConfirmationResult(True, polished_text)

    request_id = uuid.uuid4().hex
    payload = {
        "type": REQUEST_TYPE,
        "id": request_id,
        "original": original_text or "",
        "polished": polished_text or "",
    }
    try:
        sys.stdout.write(CONTROL_PREFIX + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
        sys.stdout.flush()
    except Exception as e:
        print(f"[typeup] 微润色确认窗口请求失败，继续输出润色结果: {e}")
        return PolishConfirmationResult(True, polished_text)

    response = _wait_for_response(request_id, timeout_seconds)
    if response is None:
        print("[typeup] 微润色确认超时，已取消输出")
        return PolishConfirmationResult(False, "")

    accepted = bool(response.get("accepted"))
    text = str(response.get("text") or "")
    return PolishConfirmationResult(accepted, text)


def _desktop_confirmation_enabled() -> bool:
    if os.getenv("TYPEUP_DESKTOP") != "1":
        return False
    if os.getenv("TYPEUP_POLISH_CONFIRM_DISABLED") == "1":
        return False
    return sys.stdin is not None and not getattr(sys.stdin, "closed", False)


def _wait_for_response(request_id: str, timeout_seconds: float) -> dict[str, Any] | None:
    _ensure_reader()

    if request_id in _pending_responses:
        return _pending_responses.pop(request_id)

    deadline = time.monotonic() + max(0.1, timeout_seconds)
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return None
        try:
            response = _response_queue.get(timeout=remaining)
        except queue.Empty:
            return None

        response_id = str(response.get("id") or "")
        if response_id == request_id:
            return response
        if response_id:
            _pending_responses[response_id] = response


def _ensure_reader() -> None:
    global _reader_started
    with _reader_lock:
        if _reader_started:
            return
        _reader_started = True
        threading.Thread(target=_read_stdin_responses, daemon=True, name="TypeUpPolishConfirm").start()


def _read_stdin_responses() -> None:
    try:
        for line in sys.stdin:
            text = line.strip()
            if not text:
                continue
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                continue
            if payload.get("type") == RESPONSE_TYPE:
                _response_queue.put(payload)
    except Exception as e:
        print(f"[typeup] 微润色确认响应监听停止: {e}")
