import sys
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent.parent))

from pynput import keyboard as kb

from agent.push_to_talk import PushToTalk, _parse_key


class _StatusRecorder:
    def __init__(self):
        self.states = []
        self.levels = []

    def set_state(self, state: str) -> None:
        self.states.append(state)

    def set_audio_level(self, level: float) -> None:
        self.levels.append(level)


def _pcm(sample: int, count: int = 512) -> bytes:
    return int(sample).to_bytes(2, "little", signed=True) * count


class _FakeVad:
    def __init__(self, speech: bool):
        self.speech = speech

    def is_speech(self, _frame, _sample_rate):
        return self.speech


class _FakeWin32KeyData:
    def __init__(self, vk_code: int, flags: int = 0):
        self.vkCode = vk_code
        self.flags = flags


class _SuppressRecorder:
    def __init__(self):
        self.count = 0

    def suppress_event(self):
        self.count += 1


class _FakeTimer:
    def cancel(self):
        pass


class PushToTalkStatusTests(unittest.TestCase):
    def test_mid_sentence_result_restores_recording_status_while_key_is_held(self):
        status = _StatusRecorder()

        def on_utterance(_pcm, _polish=False, _clear_status=True, _progress_status=True):
            if _clear_status:
                status.set_state("idle")

        ptt = PushToTalk(on_utterance=on_utterance, ptt_key="alt_l", status_window=status)
        ptt._active_key = "dictate"

        ptt._run_mid_sentence_utterance(b"pcm", False)

        self.assertEqual(status.states, ["recording"])

    def test_mid_sentence_result_restores_polish_status_while_key_is_held(self):
        status = _StatusRecorder()

        def on_utterance(_pcm, _polish=False, _clear_status=True, _progress_status=True):
            if _progress_status:
                status.set_state("polishing")
            if _clear_status:
                status.set_state("idle")

        ptt = PushToTalk(on_utterance=on_utterance, ptt_key="alt_l", status_window=status)
        ptt._active_key = "dictate"
        ptt._polish_mode = True

        ptt._run_mid_sentence_utterance(b"pcm", True)

        self.assertEqual(status.states[-1], "polish_recording")

    def test_mid_sentence_result_marks_complete_after_key_release(self):
        status = _StatusRecorder()

        def on_utterance(_pcm, _polish=False, _clear_status=True, _progress_status=True):
            if _clear_status:
                status.set_state("idle")

        ptt = PushToTalk(on_utterance=on_utterance, ptt_key="alt_l", status_window=status)
        ptt._active_key = None

        ptt._run_mid_sentence_utterance(b"pcm", False)

        self.assertEqual(status.states, ["idle"])

    def test_audio_callback_updates_voice_level_for_speech(self):
        status = _StatusRecorder()
        ptt = PushToTalk(on_utterance=lambda _pcm: None, ptt_key="alt_l", status_window=status)
        ptt._active_key = "dictate"
        ptt._last_level_update_at = -999.0

        ptt._audio_callback(_pcm(6000), 512, None, None)

        self.assertGreater(status.levels[-1], 0.0)

    def test_audio_callback_keeps_voice_level_zero_for_quiet_audio(self):
        status = _StatusRecorder()
        ptt = PushToTalk(on_utterance=lambda _pcm: None, ptt_key="alt_l", status_window=status)
        ptt._active_key = "dictate"
        ptt._last_level_update_at = -999.0

        ptt._audio_callback(_pcm(20), 512, None, None)

        self.assertEqual(status.levels[-1], 0.0)

    def test_vad_can_keep_voice_level_zero_for_loud_non_speech(self):
        status = _StatusRecorder()
        ptt = PushToTalk(on_utterance=lambda _pcm: None, ptt_key="alt_l", status_window=status)
        ptt._active_key = "dictate"
        ptt._vad = _FakeVad(False)
        ptt._last_level_update_at = -999.0

        ptt._audio_callback(_pcm(6000), 512, None, None)

        self.assertEqual(status.levels[-1], 0.0)

    def test_combo_recording_stops_only_after_all_trigger_keys_release(self):
        ptt = PushToTalk(on_utterance=lambda _pcm: None, ptt_key="alt_l", ai_key=["alt_l", "space"])
        stopped = []
        ptt._active_key = "ai"
        ptt._active_trigger = (kb.Key.alt_l, kb.Key.space)
        ptt._pressed_keys = {kb.Key.alt_l, kb.Key.space}
        ptt._stop_recording = lambda *, mode: stopped.append(mode)

        ptt._on_release(kb.Key.space)
        self.assertEqual(stopped, [])
        self.assertEqual(ptt._active_trigger, (kb.Key.alt_l, kb.Key.space))

        ptt._on_release(kb.Key.alt_l)
        self.assertEqual(stopped, ["ai"])
        self.assertIsNone(ptt._active_trigger)

    def test_toggle_hotkey_starts_and_stops_dictation_on_press(self):
        ptt = PushToTalk(on_utterance=lambda _pcm: None, ptt_key="alt_r", toggle_key=["ctrl", "alt"])
        started = []
        stopped = []
        ptt._start_recording = lambda: started.append(ptt._active_key)

        def stop_recording(*, mode):
            stopped.append(mode)
            ptt._active_key = None

        ptt._stop_recording = stop_recording

        ptt._on_press(kb.Key.ctrl_l)
        ptt._on_press(kb.Key.alt_l)

        self.assertEqual(started, ["dictate"])
        self.assertIsNone(ptt._active_trigger)

        ptt._on_release(kb.Key.alt_l)
        ptt._on_release(kb.Key.ctrl_l)
        self.assertEqual(stopped, [])
        self.assertEqual(ptt._active_key, "dictate")

        ptt._on_press(kb.Key.ctrl_l)
        ptt._on_press(kb.Key.alt_l)

        self.assertEqual(stopped, ["dictate"])
        self.assertIsNone(ptt._active_key)

    def test_toggle_hotkey_can_start_when_alt_is_pressed_first(self):
        ptt = PushToTalk(on_utterance=lambda _pcm: None, ptt_key="alt", toggle_key=["ctrl", "alt"])
        started = []
        ptt._start_recording = lambda: started.append(ptt._active_key)
        ptt._schedule_pending_start = lambda mode, hotkey: setattr(ptt, "_pending_start", (mode, hotkey, _FakeTimer()))

        ptt._on_press(kb.Key.alt_l)
        self.assertEqual(started, [])

        ptt._on_press(kb.Key.ctrl_l)

        self.assertEqual(started, ["dictate"])
        self.assertIsNone(ptt._active_trigger)

    def test_toggle_hotkey_upgrades_active_alt_dictation_to_toggle(self):
        ptt = PushToTalk(on_utterance=lambda _pcm: None, ptt_key="alt", toggle_key=["ctrl", "alt"])
        stopped = []
        ptt._start_recording = lambda: None
        ptt._stop_recording = lambda *, mode: stopped.append(mode)

        ptt._on_press(kb.Key.alt_l)
        ptt._finish_pending_start()
        self.assertEqual(ptt._active_key, "dictate")
        self.assertEqual(ptt._active_trigger, (kb.Key.alt,))

        ptt._on_press(kb.Key.ctrl_l)

        self.assertIsNone(ptt._active_trigger)
        ptt._on_release(kb.Key.alt_l)
        ptt._on_release(kb.Key.ctrl_l)
        self.assertEqual(stopped, [])
        self.assertEqual(ptt._active_key, "dictate")

    def test_modifier_combo_does_not_suppress_first_toggle_modifier(self):
        ptt = PushToTalk(on_utterance=lambda _pcm: None, ptt_key="alt_r", toggle_key=["ctrl", "alt"])

        self.assertFalse(ptt._should_suppress_token("ctrl_l", {"ctrl_l"}))
        self.assertTrue(ptt._should_suppress_token("alt_l", {"ctrl_l", "alt_l"}))

    def test_ai_stop_captures_context_after_hotkey_release(self):
        captured = []
        handled = []
        ptt = PushToTalk(
            on_utterance=lambda _pcm: None,
            on_ai_utterance=lambda pcm: handled.append(pcm),
            on_ai_key_down=lambda: captured.append("snapshot"),
            ptt_key="alt_l",
            ai_key=["alt_l", "space"],
        )
        ptt._active_key = "ai"
        ptt._buf = [_pcm(4000, count=6000)]
        ptt._close_stream = lambda: None
        ptt._set_audio_level = lambda _level: None

        ptt._stop_recording("ai")

        self.assertEqual(captured, ["snapshot"])
        self.assertEqual(len(handled), 1)

    def test_generic_alt_combo_suppresses_space_when_left_alt_is_down(self):
        ptt = PushToTalk(
            on_utterance=lambda _pcm: None,
            on_ai_utterance=lambda _pcm: None,
            ptt_key="alt",
            ai_key=["alt", "space"],
        )

        self.assertTrue(
            ptt._should_suppress_token("space", {"alt_l", "space"})
        )

    def test_generic_alt_combo_matches_left_alt_lifecycle(self):
        ptt = PushToTalk(
            on_utterance=lambda _pcm: None,
            on_ai_utterance=lambda _pcm: None,
            ptt_key="alt",
            ai_key=["alt", "space"],
        )
        started = []
        stopped = []
        ptt._start_recording = lambda: started.append(ptt._active_key)
        ptt._stop_recording = lambda *, mode: stopped.append(mode)

        ptt._on_press(kb.Key.alt_l)
        ptt._on_press(kb.Key.space)

        self.assertEqual(started, ["ai"])
        self.assertEqual(ptt._active_trigger, (kb.Key.alt, kb.Key.space))

        ptt._on_release(kb.Key.space)
        self.assertEqual(stopped, [])

        ptt._on_release(kb.Key.alt_l)
        self.assertEqual(stopped, ["ai"])
        self.assertIsNone(ptt._active_trigger)

    def test_generic_alt_pending_dictation_starts_with_left_alt_still_down(self):
        ptt = PushToTalk(
            on_utterance=lambda _pcm: None,
            on_ai_utterance=lambda _pcm: None,
            ptt_key="alt",
            ai_key=["alt", "space"],
        )
        started = []
        ptt._start_recording = lambda: started.append(ptt._active_key)
        ptt._pending_start = ("dictate", (kb.Key.alt,), object())
        ptt._pressed_keys = {kb.Key.alt_l}

        ptt._finish_pending_start()

        self.assertEqual(started, ["dictate"])
        self.assertEqual(ptt._active_trigger, (kb.Key.alt,))

    def test_documented_alt_alias_combo_suppresses_space_when_left_alt_is_down(self):
        ptt = PushToTalk(
            on_utterance=lambda _pcm: None,
            on_ai_utterance=lambda _pcm: None,
            ptt_key="left_alt",
            ai_key=["left_alt", "space"],
        )

        self.assertTrue(
            ptt._should_suppress_token("space", {"alt_l", "space"})
        )

    def test_win32_space_with_alt_context_is_suppressed_before_focused_input(self):
        ptt = PushToTalk(
            on_utterance=lambda _pcm: None,
            on_ai_utterance=lambda _pcm: None,
            ptt_key="alt",
            ai_key=["alt", "space"],
        )
        listener = _SuppressRecorder()
        ptt._listener = listener
        started = []
        ptt._start_recording = lambda: started.append(ptt._active_key)

        result = ptt._win32_event_filter(0x0104, _FakeWin32KeyData(0x20, 0x20))

        self.assertFalse(result)
        self.assertEqual(listener.count, 1)
        self.assertEqual(started, ["ai"])
        self.assertEqual(ptt._active_trigger, (kb.Key.alt, kb.Key.space))

    def test_win32_synthetic_alt_context_releases_on_physical_alt_up(self):
        ptt = PushToTalk(
            on_utterance=lambda _pcm: None,
            on_ai_utterance=lambda _pcm: None,
            ptt_key="alt",
            ai_key=["alt", "space"],
        )
        listener = _SuppressRecorder()
        ptt._listener = listener
        stopped = []
        ptt._start_recording = lambda: None
        ptt._stop_recording = lambda *, mode: stopped.append(mode)

        ptt._win32_event_filter(0x0104, _FakeWin32KeyData(0x20, 0x20))
        ptt._win32_event_filter(0x0105, _FakeWin32KeyData(0x20, 0x20))
        ptt._win32_event_filter(0x0105, _FakeWin32KeyData(0xA5, 0x01))

        self.assertEqual(stopped, ["ai"])
        self.assertIsNone(ptt._active_trigger)

    def test_win32_plain_space_is_not_suppressed_after_ai_hotkey_releases(self):
        ptt = PushToTalk(
            on_utterance=lambda _pcm: None,
            on_ai_utterance=lambda _pcm: None,
            ptt_key="alt",
            ai_key=["alt", "space"],
        )
        listener = _SuppressRecorder()
        ptt._listener = listener
        ptt._start_recording = lambda: None
        ptt._stop_recording = lambda *, mode: None

        with mock.patch("agent.push_to_talk._win32_async_key_down", return_value=False):
            ptt._win32_event_filter(0x0104, _FakeWin32KeyData(0x20, 0x20))
            ptt._win32_event_filter(0x0105, _FakeWin32KeyData(0x20, 0x20))
            ptt._win32_event_filter(0x0105, _FakeWin32KeyData(0xA5, 0x01))

            count_after_hotkey = listener.count
            result = ptt._win32_event_filter(0x0100, _FakeWin32KeyData(0x20, 0x00))

        self.assertTrue(result)
        self.assertEqual(listener.count, count_after_hotkey)
        self.assertNotIn("alt", ptt._filter_pressed_tokens)

    def test_win32_plain_space_clears_stale_alt_before_listener_callback(self):
        ptt = PushToTalk(
            on_utterance=lambda _pcm: None,
            on_ai_utterance=lambda _pcm: None,
            ptt_key="alt",
            ai_key=["alt", "space"],
        )
        listener = _SuppressRecorder()
        ptt._listener = listener
        ptt._pressed_keys = {kb.Key.alt}
        ptt._filter_pressed_tokens = {"alt"}

        with mock.patch("agent.push_to_talk._win32_async_key_down", return_value=False):
            result = ptt._win32_event_filter(0x0100, _FakeWin32KeyData(0x20, 0x00))

        self.assertTrue(result)
        self.assertEqual(listener.count, 0)
        self.assertEqual(ptt._pressed_keys, set())
        self.assertEqual(ptt._filter_pressed_tokens, {"space"})

    def test_hotkey_parser_accepts_documented_key_aliases(self):
        self.assertEqual(_parse_key("right_alt"), kb.Key.alt_r)
        self.assertEqual(_parse_key("left_alt"), kb.Key.alt_l)
        self.assertEqual(_parse_key("right_ctrl"), kb.Key.ctrl_r)
        self.assertEqual(_parse_key("left_ctrl"), kb.Key.ctrl_l)
        self.assertEqual(_parse_key("alt_gr"), kb.Key.alt_r)

    def test_release_after_mid_sentence_outputs_completion_marker(self):
        status = _StatusRecorder()
        ptt = PushToTalk(on_utterance=lambda _pcm: None, ptt_key="alt_l", status_window=status)
        ptt._vad = _FakeVad(False)
        ptt._vad_sent_count = 1

        out = StringIO()
        with redirect_stdout(out):
            ptt._stop_recording("dictate")

        self.assertEqual(status.states[-1], "idle")
        self.assertIn("[typeup] 输入完成", out.getvalue())

    def test_mid_sentence_worker_outputs_completion_after_key_release(self):
        status = _StatusRecorder()
        ptt = PushToTalk(
            on_utterance=lambda _pcm, _polish=False, _clear_status=True, _progress_status=True: None,
            ptt_key="alt_l",
            status_window=status,
        )
        ptt._active_key = None

        out = StringIO()
        with redirect_stdout(out):
            ptt._run_mid_sentence_utterance(b"pcm", False)

        self.assertEqual(status.states[-1], "idle")
        self.assertIn("[typeup] 输入完成", out.getvalue())


if __name__ == "__main__":
    unittest.main()
