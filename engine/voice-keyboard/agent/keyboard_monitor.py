"""Shared keyboard monitor for text-buffer sync."""

import time

from pynput import keyboard as kb

from agent.text_buffer import TextBuffer
import agent.typer as typer


TRACK_TIMEOUT = 30.0


class KeyboardMonitor:
    """Consumes key events from PushToTalk's global listener."""

    def __init__(
        self,
        buf: TextBuffer,
    ):
        self._buf = buf
        self._last_voice_ts = 0.0

    def prepare_for_voice_output(self) -> None:
        pass

    def notify_voice_output(self, text: str = "", before_snapshot=None, after_snapshot=None) -> None:
        self._last_voice_ts = time.monotonic()

    def _within_track_window(self) -> bool:
        return (time.monotonic() - self._last_voice_ts) < TRACK_TIMEOUT

    def start(self):
        print(f"[kbd] keyboard sync enabled via shared PTT listener; tracking {TRACK_TIMEOUT}s after voice output")

    def stop(self):
        pass

    def process_press(self, key):
        if typer.is_erasing():
            return

        if key == kb.Key.backspace:
            if self._within_track_window():
                self._buf.trim_end(1)
            else:
                self._buf.cursor_uncertain = True
        elif key == kb.Key.delete:
            self._buf.cursor_uncertain = True
        elif key == kb.Key.enter:
            self._buf.new_segment()
        else:
            _typed_character(key)


def _typed_character(key) -> str:
    char = getattr(key, "char", None)
    if not isinstance(char, str) or len(char) != 1:
        return ""
    if ord(char) < 32:
        return ""
    return char
