import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.push_to_talk import PushToTalk


class _StatusRecorder:
    def __init__(self):
        self.states = []

    def set_state(self, state: str) -> None:
        self.states.append(state)


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

    def test_mid_sentence_result_does_not_restore_status_after_key_release(self):
        status = _StatusRecorder()

        def on_utterance(_pcm, _polish=False, _clear_status=True, _progress_status=True):
            if _clear_status:
                status.set_state("idle")

        ptt = PushToTalk(on_utterance=on_utterance, ptt_key="alt_l", status_window=status)
        ptt._active_key = None

        ptt._run_mid_sentence_utterance(b"pcm", False)

        self.assertEqual(status.states, [])


if __name__ == "__main__":
    unittest.main()
