import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.main import _clean_polished_text, _llm_configured, make_utterance_handler


class _FakeBuffer:
    def __init__(self):
        self.items = []

    def push(self, text):
        self.items.append(text)


class _FakeStatus:
    def __init__(self):
        self.states = []

    def set_state(self, state):
        self.states.append(state)


class _FakeStt:
    def __init__(self, text="你好"):
        self.text = text

    def transcribe(self, _pcm):
        return self.text


class MainHelperTests(unittest.TestCase):
    def test_clean_polished_text_removes_model_prefixes(self):
        fence = "`" * 3
        cases = {
            "# 你好，世界。": "你好，世界。",
            "### 润色结果：你好，世界。": "你好，世界。",
            f"{fence}\n# 你好，世界。\n{fence}": "你好，世界。",
            "润色后：你好，世界。": "你好，世界。",
            "好的，润色如下：你好，世界。": "你好，世界。",
            "以下是微润色后的文本：你好，世界。": "你好，世界。",
            "我帮你稍微优化后的结果：你好，世界。": "你好，世界。",
            "- 你好，世界。": "你好，世界。",
            "＃你好，世界。": "你好，世界。",
            "\u200b# 你好，世界。": "你好，世界。",
            "#\n你好，世界。": "你好，世界。",
        }

        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(_clean_polished_text(raw), expected)

    def test_llm_configured_accepts_typeup_backend_tokens(self):
        self.assertTrue(_llm_configured({
            "provider": "typeup_backend",
            "api_base_url": "http://localhost:8000",
            "access_token": "token",
        }))
        self.assertTrue(_llm_configured({
            "provider": "typeup_backend",
            "base_url": "http://localhost:8000",
            "access_token": "token",
        }))
        self.assertFalse(_llm_configured({
            "provider": "typeup_backend",
            "api_base_url": "http://localhost:8000",
            "access_token": "",
        }))
        self.assertTrue(_llm_configured({"provider": "zhipuai", "api_key": "key"}))

    def test_utterance_handler_can_leave_status_active_for_mid_sentence_results(self):
        import agent.typer as typer

        original_type_text = typer.type_text
        typed = []
        try:
            typer.type_text = typed.append
            status = _FakeStatus()
            buf = _FakeBuffer()
            handler = make_utterance_handler(_FakeStt(), buf, status_window=status)

            handler(b"pcm", False, False, False)
            self.assertEqual(typed, ["你好"])
            self.assertEqual(buf.items, ["你好"])
            self.assertNotIn("idle", status.states)

            handler(b"pcm")
            self.assertEqual(status.states[-1], "idle")
        finally:
            typer.type_text = original_type_text

    def test_utterance_handler_removes_generated_hash_before_typing(self):
        import agent.typer as typer

        original_type_text = typer.type_text
        try:
            cases = ["#你好", "＃你好", "\u200b# 你好"]
            for raw in cases:
                with self.subTest(raw=raw):
                    typed = []
                    typer.type_text = typed.append
                    buf = _FakeBuffer()
                    handler = make_utterance_handler(_FakeStt(raw), buf)

                    handler(b"pcm")

                    self.assertEqual(typed, ["你好"])
                    self.assertEqual(buf.items, ["你好"])
        finally:
            typer.type_text = original_type_text


if __name__ == "__main__":
    unittest.main()
