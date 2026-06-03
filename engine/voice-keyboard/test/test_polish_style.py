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
        self.assertIn("不是微润色", system)
        self.assertNotIn("不要标题、列表、Markdown", system)

    def test_custom_style_prompt_overrides_builtin_style(self):
        system = _polish_system_for_style("prompt", "保持客服口吻。")

        self.assertIn("保持客服口吻。", system)
        self.assertNotIn("适合发给 ChatGPT", system)

    def test_prompt_style_uses_prompt_user_message(self):
        message = _build_style_user_message("整理一下这个需求", "prompt")

        self.assertIn("整理成一个清晰 prompt", message)
        self.assertIn("不要只做微润色", message)
        self.assertIn("不要提到", message)
        self.assertNotIn("请微润色", message)

    def test_prompt_style_keeps_structured_output(self):
        structured = "- 目标：整理需求\n- 输出：给出实现步骤"

        self.assertEqual(_select_polished_text("整理一下这个需求", structured, "prompt"), structured)

    def test_prompt_style_rejects_internal_instruction_leak(self):
        original = "请充分了解一下这个文件夹的项目"
        leaked = (
            '请将以下 JSON 中的 transcript 字段内容整理成一个清晰 prompt：'
            '"请提供关于这个文件夹中项目的详细信息。"'
        )

        selected = _select_polished_text(original, leaked, "prompt")

        self.assertIn("任务：请充分了解一下这个文件夹的项目。", selected)
        self.assertIn("请重点关注", selected)
        self.assertNotIn("JSON", selected)
        self.assertNotIn("transcript", selected)

    def test_prompt_style_rejects_json_analysis_instruction_leak(self):
        original = "请帮我看看这个文件夹里的项目，了解功能、主要代码结构、启动和测试方法，以及交接维护风险"
        leaked = "请分析以下 JSON 中的 transcript 字段内容，了解文件夹内项目功能、主要代码结构、启动和测试方法，以及交接维护时需要注意的风险。"

        selected = _select_polished_text(original, leaked, "prompt")

        self.assertIn("任务：请帮我看看这个文件夹里的项目", selected)
        self.assertIn("启动方式、运行依赖和必要配置", selected)
        self.assertIn("测试运行方法", selected)
        self.assertNotIn("JSON", selected)
        self.assertNotIn("transcript", selected)

    def test_prompt_style_upgrades_micro_like_short_output(self):
        original = "请充分了解一下这个文件夹的项目"
        weak_output = "请充分了解一下这个文件夹的项目。"

        selected = _select_polished_text(original, weak_output, "prompt")

        self.assertIn("任务：请充分了解一下这个文件夹的项目。", selected)
        self.assertIn("项目的整体功能和代码脉络", selected)
        self.assertNotIn("启动方式", selected)
        self.assertNotIn("测试", selected)
        self.assertNotIn("维护风险", selected)

    def test_prompt_style_rejects_flattened_project_prompt_and_trims_particles(self):
        original = "充分了解一下这个文件夹的项目哦"
        flattened = "任务：充分了解一下这个文件夹的项目哦。请重点关注：- 项目的整体功能和代码脉络。输出要求：先给出整体理解，再按你实际看到的内容列出关键发现。"

        selected = _select_polished_text(original, flattened, "prompt")

        self.assertIn("任务：充分了解一下这个文件夹的项目。", selected)
        self.assertIn("\n\n请重点关注：\n- 项目的整体功能和代码脉络。", selected)
        self.assertNotIn("项目哦", selected)

    def test_prompt_style_fallback_derives_project_focus_from_original_request(self):
        original = "请帮我看看这个文件夹里的项目，先了解它是做什么的，然后看一下主要代码结构、启动方式、测试怎么跑，还有如果我要把它交给别人维护，需要注意哪些风险"
        weak_output = "请分析文件夹内项目的功能，描述主要代码结构，提供启动和测试运行的方法，并列出将项目转交给他人维护时需要注意的风险。"

        selected = _select_polished_text(original, weak_output, "prompt")

        self.assertIn("项目的主要功能、使用场景和目标", selected)
        self.assertIn("目录结构、核心模块和关键入口", selected)
        self.assertIn("启动方式、运行依赖和必要配置", selected)
        self.assertIn("测试运行方法", selected)
        self.assertNotIn("构建或打包流程", selected)
        self.assertIn("交接维护时需要注意的风险", selected)
        self.assertIn("写清楚测试方法", selected)
        self.assertIn("最后列出维护风险", selected)

    def test_prompt_style_rejects_fragmented_project_prompt(self):
        original = "请帮我看看这个文件夹里的项目，先了解它是做什么的，然后看一下主要代码结构、启动方式、测试怎么跑，还有如果我要把它交给别人维护，需要注意哪些风险"
        fragmented = (
            "请查看指定文件夹中的项目，了解其功能，分析主要代码结构和启动方式。"
            "任务：测试怎么跑？还有，如果我要把这个别人维护，需要注意哪些风险。\n\n"
            "要求：\n"
            "- 保留原始目标、上下文和约束，不要添加未说明的背景。\n"
            "- 需要时先确认关键信息，再给出可执行结果。\n\n"
            "输出要求：结构清晰，便于直接使用。"
        )

        selected = _select_polished_text(original, fragmented, "prompt")

        self.assertIn("任务：请帮我看看这个文件夹里的项目", selected)
        self.assertIn("启动方式、运行依赖和必要配置", selected)
        self.assertIn("测试运行方法", selected)
        self.assertNotIn("任务：测试怎么跑", selected)
        self.assertNotIn("把这个别人维护", selected)

    def test_prompt_style_rejects_single_sentence_project_prompt(self):
        original = "请帮我看看这个文件夹里的项目，先了解它是做什么的，然后看一下主要代码结构、启动方式、测试怎么跑，还有如果我要把它交给别人维护，需要注意哪些风险"
        single_sentence = "请分析文件夹内项目的功能，描述主要代码结构，提供启动和测试运行的方法，并列出将项目转交给他人维护时需要注意的风险。"

        selected = _select_polished_text(original, single_sentence, "prompt")

        self.assertIn("任务：请帮我看看这个文件夹里的项目", selected)
        self.assertIn("请重点关注", selected)
        self.assertIn("启动方式、运行依赖和必要配置", selected)
        self.assertIn("测试运行方法", selected)


if __name__ == "__main__":
    unittest.main()
