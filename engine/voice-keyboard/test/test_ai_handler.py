import sys
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.ai_handler import AIHandler, _fallback_intent_after_classification_error, _parse_intent_result
from agent.input_environment import ReplacementPlan, TyperInputEnvironment
from agent.text_buffer import TextBuffer


class _FakeStt:
    def __init__(self, text=""):
        self.text = text

    def transcribe(self, _pcm):
        return self.text


class _FakeLlm:
    def chat(self, _system, _user):
        return '{"type":"chat","reply":"ok"}'


class _FakeBuffer:
    current_segment = ""
    cursor_uncertain = False


class _FakeStatus:
    def __init__(self):
        self.states = []

    def set_state(self, state):
        self.states.append(state)


class _SelectionDropsAfterSnapshotTextIO:
    def __init__(self):
        self.selection_reads = 0
        self.replaced = []

    def get_selection(self):
        self.selection_reads += 1
        return "这是一段需要润色的文字" if self.selection_reads == 1 else ""

    def replace_selection(self, text, original=""):
        self.replaced.append((text, original))

    def get_caret_text_window(self):
        return None

    def list_shortcuts(self):
        return []

    def current_application_label(self):
        return ""


class AIHandlerHelperTests(unittest.TestCase):
    def test_parse_intent_result_accepts_fenced_json(self):
        raw = '```json\n{"type":"edit"}\n```'

        self.assertEqual(_parse_intent_result(raw), {"type": "edit"})

    def test_parse_intent_result_extracts_json_from_explanatory_text(self):
        raw = '好的，按编辑处理：\n{"type":"edit"}'

        self.assertEqual(_parse_intent_result(raw), {"type": "edit"})

    def test_classification_error_falls_back_to_edit_when_context_exists(self):
        result = _fallback_intent_after_classification_error("帮我润色一下", "", "这是一段原文")

        self.assertEqual(result, {"type": "edit"})

    def test_classification_error_falls_back_to_chat_without_edit_context(self):
        result = _fallback_intent_after_classification_error("今天天气怎么样", "", "")

        self.assertEqual(result, {"type": "chat", "reply": ""})

    def test_ai_handler_prints_completion_marker_after_empty_stt(self):
        status = _FakeStatus()
        handler = AIHandler(_FakeStt(""), _FakeLlm(), _FakeBuffer(), status_window=status)

        out = StringIO()
        with redirect_stdout(out):
            handler._run(b"pcm")

        self.assertEqual(status.states, ["empty_stt"])
        self.assertIn("[typeup] 输入完成", out.getvalue())

    def test_ai_handler_uses_selection_snapshot_when_selection_disappears(self):
        text_io = _SelectionDropsAfterSnapshotTextIO()
        env = TyperInputEnvironment(TextBuffer(), text_io=text_io)
        llm = _FakeLlm()
        llm.plan_replacement = lambda original, instruction: ReplacementPlan(
            target_text=original,
            replacement_text="这是一段更自然的文字。",
        )
        handler = AIHandler(_FakeStt("润色一下"), llm, env.buffer, input_environment=env)

        handler.on_ai_key_down()
        handler._run(b"pcm")

        self.assertEqual(
            text_io.replaced,
            [("这是一段更自然的文字。", "这是一段需要润色的文字")],
        )
        self.assertGreaterEqual(text_io.selection_reads, 2)


if __name__ == "__main__":
    unittest.main()
