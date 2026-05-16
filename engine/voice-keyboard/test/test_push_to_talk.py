import sys
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pynput import keyboard as kb

from agent.push_to_talk import PushToTalk


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
