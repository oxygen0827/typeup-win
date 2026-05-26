"""Shared keyboard monitor for text-buffer sync and correction learning."""

import time

from pynput import keyboard as kb

from agent.corrections import CorrectionSession, CorrectionStore, SnapshotCorrectionTracker
from agent.text_buffer import TextBuffer
import agent.typer as typer


TRACK_TIMEOUT = 30.0


class KeyboardMonitor:
    """Consumes key events from PushToTalk's global listener."""

    def __init__(
        self,
        buf: TextBuffer,
        correction_store: CorrectionStore | None = None,
        snapshot_reader=None,
    ):
        self._buf = buf
        self._corrections = CorrectionSession(correction_store) if correction_store is not None else None
        self._snapshot_corrections = (
            SnapshotCorrectionTracker(correction_store, snapshot_reader=snapshot_reader)
            if correction_store is not None else None
        )
        self._last_voice_ts = 0.0

    def prepare_for_voice_output(self) -> None:
        learned = None
        if self._snapshot_corrections is not None:
            learned = self._snapshot_corrections.finalize_if_edited("next_voice")
        self._log_learned(learned, "snapshot ")
        if self._corrections is not None:
            self.finalize_correction_session(include_snapshot=False)

    def notify_voice_output(self, text: str = "", before_snapshot=None, after_snapshot=None) -> None:
        now = time.monotonic()
        self._last_voice_ts = now
        if self._snapshot_corrections is not None:
            self._snapshot_corrections.record_voice_output(text, before_snapshot, after_snapshot, now=now)
        if self._corrections is not None:
            self._corrections.start(text, now)

    def finalize_correction_session(self, include_snapshot: bool = True) -> None:
        if include_snapshot and self._snapshot_corrections is not None:
            learned = self._snapshot_corrections.finalize()
            self._log_learned(learned, "snapshot ")
        if self._corrections is None:
            return
        learned = self._corrections.finalize()
        self._log_learned(learned, "")

    def _within_track_window(self) -> bool:
        return (time.monotonic() - self._last_voice_ts) < TRACK_TIMEOUT

    def start(self):
        print(f"[kbd] keyboard sync enabled via shared PTT listener; tracking {TRACK_TIMEOUT}s after voice output")

    def stop(self):
        pass

    def process_press(self, key):
        if typer.is_erasing():
            return

        now = time.monotonic()
        if self._corrections is not None:
            self._corrections.expire_if_needed(now)
        if self._snapshot_corrections is not None:
            learned = self._snapshot_corrections.expire_if_needed(now)
            self._log_learned(learned, "snapshot ")

        if key == kb.Key.backspace:
            if self._snapshot_corrections is not None:
                self._snapshot_corrections.mark_user_edit("backspace", now)
            if self._corrections is not None:
                self._corrections.backspace(now)
            if self._within_track_window():
                self._buf.trim_end(1)
            else:
                self._buf.cursor_uncertain = True
        elif key == kb.Key.delete:
            if self._snapshot_corrections is not None:
                self._snapshot_corrections.mark_user_edit("delete", now)
            if self._corrections is not None:
                self._corrections.delete(now)
            self._buf.cursor_uncertain = True
        elif key == kb.Key.enter:
            self.finalize_correction_session()
            self._buf.new_segment()
        else:
            typed = _typed_character(key)
            if typed and self._snapshot_corrections is not None:
                self._snapshot_corrections.mark_user_edit("typed", now)
            if typed and self._corrections is not None:
                self._corrections.append_typed(typed, now)

    def _log_learned(self, learned, prefix: str) -> None:
        if learned is not None:
            print(
                f"[corrections] {prefix}learned "
                f"{learned.get('source')!r} -> {learned.get('target')!r} "
                f"count={learned.get('count')} confidence={learned.get('confidence')}"
            )


def _typed_character(key) -> str:
    char = getattr(key, "char", None)
    if not isinstance(char, str) or len(char) != 1:
        return ""
    if ord(char) < 32:
        return ""
    return char
