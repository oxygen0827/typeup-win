import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.main import _POLISH_SYSTEM, _polish_system_for_style


class PolishStyleTests(unittest.TestCase):
    def test_unknown_style_keeps_micro_polish_prompt(self):
        self.assertEqual(_polish_system_for_style("unknown"), _POLISH_SYSTEM)

    def test_prompt_style_adds_prompt_specific_instruction(self):
        system = _polish_system_for_style("prompt")

        self.assertIn(_POLISH_SYSTEM, system)
        self.assertIn("适合发给 ChatGPT", system)
        self.assertIn("不要替用户回答问题", system)

    def test_custom_style_prompt_overrides_builtin_style(self):
        system = _polish_system_for_style("prompt", "保持客服口吻。")

        self.assertIn("保持客服口吻。", system)
        self.assertNotIn("适合发给 ChatGPT", system)


if __name__ == "__main__":
    unittest.main()
