"""Non-invasive text snapshots for the currently focused input control."""

from __future__ import annotations

import os
import sys

from agent.corrections import TextSnapshot


class TextSnapshotReader:
    def __init__(self):
        self._auto = None
        self._load_attempted = False
        self._disabled = os.getenv("TYPEUP_DISABLE_TEXT_SNAPSHOTS") == "1"

    def read(self) -> TextSnapshot | None:
        if self._disabled or sys.platform != "win32":
            return None
        auto = self._load_uiautomation()
        if auto is None:
            return None
        try:
            control = auto.GetFocusedControl()
            if control is None:
                return None
            text = _read_control_text(control)
            if text is None:
                return None
            return TextSnapshot(
                text=text,
                identity=_control_identity(control),
                selection_start=None,
                selection_end=None,
                source="uiautomation",
            )
        except Exception:
            return None

    def _load_uiautomation(self):
        if self._load_attempted:
            return self._auto
        self._load_attempted = True
        try:
            import uiautomation as auto

            try:
                auto.SetGlobalSearchTimeout(0.05)
            except Exception:
                pass
            self._auto = auto
        except Exception:
            self._auto = None
        return self._auto


def _read_control_text(control) -> str | None:
    value = _read_value_pattern(control)
    if value is not None:
        return value
    text = _read_text_pattern(control)
    if text is not None:
        return text
    for name in ("Name", "LegacyIAccessibleValue"):
        value = getattr(control, name, None)
        if isinstance(value, str):
            return value
    return None


def _read_value_pattern(control) -> str | None:
    try:
        getter = getattr(control, "GetValuePattern", None)
        pattern = getter() if callable(getter) else None
        value = getattr(pattern, "Value", None)
        if isinstance(value, str):
            return value
    except Exception:
        return None
    return None


def _read_text_pattern(control) -> str | None:
    try:
        getter = getattr(control, "GetTextPattern", None)
        pattern = getter() if callable(getter) else None
        document_range = getattr(pattern, "DocumentRange", None)
        get_text = getattr(document_range, "GetText", None)
        if callable(get_text):
            value = get_text(-1)
            if isinstance(value, str):
                return value.rstrip("\r")
    except Exception:
        return None
    return None


def _control_identity(control) -> str:
    parts = []
    for name in ("ProcessId", "ControlTypeName", "ClassName", "AutomationId", "Name"):
        try:
            value = getattr(control, name, "")
        except Exception:
            value = ""
        if value:
            parts.append(str(value))
    return "win:" + ":".join(parts[:5]) if parts else "win:focused"
