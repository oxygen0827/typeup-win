import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.main import _clean_polished_text, _llm_configured, _polish_change_is_safe, make_utterance_handler


class _FakeBuffer:
    def __init__(self):
        self.items = []

    def push(self, text):
        self.items.append(text)


class _FakeStatus:
    def __init__(self):
        self.states = []
        self.previews = []
        self.hidden_previews = 0

    def set_state(self, state):
        self.states.append(state)

    def show_polish_preview(self, title, body, phase=""):
        self.previews.append((title, body, phase))

    def hide_polish_preview(self):
        self.hidden_previews += 1


class _FakeStt:
    def __init__(self, text="你好"):
        self.text = text

    def transcribe(self, _pcm):
        return self.text


class _QueuedStt:
    def __init__(self, texts):
        self.texts = list(texts)

    def transcribe(self, _pcm):
        return self.texts.pop(0)


class MainHelperTests(unittest.TestCase):
    def test_clean_polished_text_removes_model_prefixes(self):
        fence = "`" * 3
        cases = {
            "# 你好，世界。": "你好，世界。",
            "### 润色结果：你好，世界。": "你好，世界。",
            f"{fence}\n# 你好，世界。\n{fence}": "你好，世界。",
            "润色后：你好，世界。": "你好，世界。",
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

    def test_polish_change_guard_rejects_large_rewrites(self):
        self.assertTrue(_polish_change_is_safe("嗯你好世界", "你好，世界。"))
        self.assertFalse(_polish_change_is_safe("你好", "我已经根据你的要求总结了今天的会议重点并补充背景。"))
        self.assertFalse(_polish_change_is_safe("请明天提醒我开会", "开会"))

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

    def test_polish_handler_waits_for_confirmation_before_typing(self):
        import agent.polish_confirm as polish_confirm
        import agent.typer as typer

        original_type_text = typer.type_text
        original_confirm = polish_confirm.request_polish_confirmation

        class _Editor:
            def chat(self, _system, text):
                self.seen = text
                return "润色后：你好，世界。"

        try:
            typed = []
            confirmations = []
            typer.type_text = typed.append
            polish_confirm.request_polish_confirmation = lambda original, polished: (
                confirmations.append((original, polished))
                or polish_confirm.PolishConfirmationResult(True, "确认后的文字。")
            )
            buf = _FakeBuffer()
            editor = _Editor()
            handler = make_utterance_handler(_FakeStt("嗯你好世界"), buf, editor=editor)

            handler(b"pcm", polish=True)

            self.assertEqual(editor.seen, "嗯你好世界")
            self.assertEqual(confirmations, [("嗯你好世界", "你好，世界。")])
            self.assertEqual(typed, ["确认后的文字。"])
            self.assertEqual(buf.items, ["确认后的文字。"])
        finally:
            typer.type_text = original_type_text
            polish_confirm.request_polish_confirmation = original_confirm

    def test_polish_handler_does_not_type_when_confirmation_is_rejected(self):
        import agent.polish_confirm as polish_confirm
        import agent.typer as typer

        original_type_text = typer.type_text
        original_confirm = polish_confirm.request_polish_confirmation

        class _Editor:
            def chat(self, _system, _text):
                return "你好，世界。"

        try:
            typed = []
            typer.type_text = typed.append
            polish_confirm.request_polish_confirmation = lambda _original, _polished: (
                polish_confirm.PolishConfirmationResult(False, "")
            )
            buf = _FakeBuffer()
            status = _FakeStatus()
            handler = make_utterance_handler(
                _FakeStt("你好世界"),
                buf,
                editor=_Editor(),
                status_window=status,
            )

            handler(b"pcm", polish=True)

            self.assertEqual(typed, [])
            self.assertEqual(buf.items, [])
            self.assertEqual(status.states[-1], "idle")
        finally:
            typer.type_text = original_type_text
            polish_confirm.request_polish_confirmation = original_confirm

    def test_polish_session_previews_segments_then_confirms_final_output(self):
        import agent.polish_confirm as polish_confirm
        import agent.typer as typer

        original_type_text = typer.type_text
        original_confirm = polish_confirm.request_polish_confirmation

        class _Editor:
            def chat(self, _system, text):
                if text == "嗯第一句":
                    return "第一句。"
                if text == "然后第二句":
                    return "第二句。"
                return "第一句。\n第二句。"

        try:
            typed = []
            confirmations = []
            typer.type_text = typed.append
            polish_confirm.request_polish_confirmation = lambda original, polished: (
                confirmations.append((original, polished))
                or polish_confirm.PolishConfirmationResult(True, polished)
            )
            status = _FakeStatus()
            buf = _FakeBuffer()
            handler = make_utterance_handler(
                _QueuedStt(["嗯第一句", "然后第二句"]),
                buf,
                editor=_Editor(),
                status_window=status,
            )

            handler.polish_start()
            handler.polish_segment(b"pcm1", 1)
            handler.polish_finish(b"pcm2", 2)

            self.assertIn(("微润色预览", "第一句。", "正在整理分句"), status.previews)
            self.assertEqual(confirmations, [("嗯第一句\n然后第二句", "第一句。\n第二句。")])
            self.assertEqual(typed, ["第一句。\n第二句。"])
            self.assertEqual(buf.items, ["第一句。\n第二句。"])
            self.assertGreater(status.hidden_previews, 0)
        finally:
            typer.type_text = original_type_text
            polish_confirm.request_polish_confirmation = original_confirm


if __name__ == "__main__":
    unittest.main()
