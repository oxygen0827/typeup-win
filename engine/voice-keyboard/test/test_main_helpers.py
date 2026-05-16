import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.main import _clean_polished_text, _llm_configured


class MainHelperTests(unittest.TestCase):
    def test_clean_polished_text_removes_model_prefixes(self):
        fence = "`" * 3
        cases = {
            "# 你好，世界。": "你好，世界。",
            "### 润色结果：你好，世界。": "你好，世界。",
            f"{fence}\n# 你好，世界。\n{fence}": "你好，世界。",
            "润色后：你好，世界。": "你好，世界。",
            "- 你好，世界。": "你好，世界。",
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


if __name__ == "__main__":
    unittest.main()
