import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.main import (
    _POLISH_SYSTEM,
    _PROMPT_STYLE_SYSTEM,
    _build_style_user_message,
    _polish_system_for_style,
    _select_polished_text,
)


class PolishStyleTests(unittest.TestCase):
    def test_unknown_style_keeps_micro_polish_prompt(self):
        self.assertEqual(_polish_system_for_style("unknown"), _POLISH_SYSTEM)

    def test_prompt_style_adds_prompt_specific_instruction(self):
        system = _polish_system_for_style("prompt")

        self.assertEqual(system, _PROMPT_STYLE_SYSTEM)
        self.assertIn("可以直接发给 ChatGPT", system)
        self.assertIn("不要替用户回答问题", system)
        self.assertNotIn("不要标题、列表、Markdown", system)

    def test_custom_style_prompt_overrides_builtin_style(self):
        system = _polish_system_for_style("prompt", "保持客服口吻。")

        self.assertIn("保持客服口吻。", system)
        self.assertNotIn("适合发给 ChatGPT", system)

    def test_prompt_style_uses_prompt_user_message(self):
        message = _build_style_user_message("整理一下这个需求", "prompt")

        self.assertIn("整理成一个清晰 prompt", message)
        self.assertNotIn("请微润色", message)

    def test_prompt_style_keeps_structured_output(self):
        structured = "- 目标：整理需求\n- 输出：给出实现步骤"

        self.assertEqual(_select_polished_text("整理一下这个需求", structured, "prompt"), structured)


if __name__ == "__main__":
    unittest.main()
