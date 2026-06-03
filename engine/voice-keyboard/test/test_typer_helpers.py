import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent import typer


class TyperApplicationLaunchTests(unittest.TestCase):
    def test_windows_clipboard_paste_restores_original_clipboard(self):
        class ImmediateThread:
            def __init__(self, target, daemon=None, name=None):
                self._target = target

            def start(self):
                self._target()

        with (
            patch("agent.typer._get_clipboard_win", side_effect=["old clipboard", "inserted text"]),
            patch("agent.typer._set_clipboard_win") as set_clipboard,
            patch("agent.typer._kb"),
            patch("agent.typer._press_key"),
            patch("agent.typer.time.sleep"),
            patch("agent.typer.threading.Thread", ImmediateThread),
        ):
            typer._type_via_clipboard_win("inserted text")

        self.assertEqual(
            [call.args[0] for call in set_clipboard.call_args_list],
            ["inserted text", "old clipboard"],
        )

    def test_windows_long_text_uses_clipboard_paste(self):
        with (
            patch("agent.typer._OS", "Windows"),
            patch("agent.typer._use_clipboard_mode", False),
            patch("agent.typer._type_via_clipboard_win") as clipboard,
            patch("agent.typer._type_via_sendinput") as sendinput,
        ):
            typer.type_text("长" * 80)

        clipboard.assert_called_once_with("长" * 80)
        sendinput.assert_not_called()

    def test_windows_short_text_keeps_sendinput_path(self):
        with (
            patch("agent.typer._OS", "Windows"),
            patch("agent.typer._use_clipboard_mode", False),
            patch("agent.typer._type_via_clipboard_win") as clipboard,
            patch("agent.typer._type_via_sendinput") as sendinput,
        ):
            typer.type_text("短文本")

        sendinput.assert_called_once_with("短文本")
        clipboard.assert_not_called()

    def test_windows_short_multiline_text_uses_clipboard_paste(self):
        text = "任务：一\n\n请重点关注：\n- 二"
        with (
            patch("agent.typer._OS", "Windows"),
            patch("agent.typer._use_clipboard_mode", False),
            patch("agent.typer._type_via_clipboard_win") as clipboard,
            patch("agent.typer._type_via_sendinput") as sendinput,
        ):
            typer.type_text(text)

        clipboard.assert_called_once_with(text)
        sendinput.assert_not_called()

    def test_windows_clipboard_paste_normalizes_newlines(self):
        class NoopThread:
            def __init__(self, target, daemon=None, name=None):
                self._target = target

            def start(self):
                pass

        with (
            patch("agent.typer._get_clipboard_win", return_value="old clipboard"),
            patch("agent.typer._set_clipboard_win") as set_clipboard,
            patch("agent.typer._kb"),
            patch("agent.typer._press_key"),
            patch("agent.typer.time.sleep"),
            patch("agent.typer.threading.Thread", NoopThread),
        ):
            typer._type_via_clipboard_win("任务：一\n\n请重点关注：\n- 二")

        set_clipboard.assert_any_call("任务：一\r\n\r\n请重点关注：\r\n- 二")

    def test_windows_replace_selection_normalizes_newlines(self):
        with (
            patch("agent.typer._OS", "Windows"),
            patch("agent.typer._set_clipboard") as set_clipboard,
            patch("agent.typer._kb"),
            patch("agent.typer._press_key"),
            patch("agent.typer.time.sleep"),
        ):
            typer.replace_selection("任务：一\n\n请重点关注：\n- 二")

        set_clipboard.assert_called_once_with("任务：一\r\n\r\n请重点关注：\r\n- 二")

    def test_resolves_spoken_wechat_name_to_launch_target(self):
        target = typer._application_target_for_name("打开微信。")

        self.assertIsNotNone(target)
        self.assertIn("wechat.exe", target.executables)

    def test_unknown_app_does_not_use_wechat_target(self):
        self.assertIsNone(typer._application_target_for_name("打开不存在的应用"))

    def test_windows_commands_include_start_menu_shortcut(self):
        target = typer._application_target_for_name("微信")
        with (
            patch("agent.typer.shutil.which", return_value=None),
            patch("agent.typer._candidate_application_paths", return_value=[]),
            patch("agent.typer._find_start_menu_shortcut", return_value=Path("C:/x/微信.lnk")),
        ):
            commands = typer._windows_application_commands("微信", target)

        self.assertIn((str(Path("C:/x/微信.lnk")),), commands)

    def test_unknown_app_can_use_start_menu_shortcut(self):
        with (
            patch("agent.typer.shutil.which", return_value=None),
            patch("agent.typer._find_start_menu_shortcut", return_value=Path("C:/x/Figma.lnk")),
        ):
            commands = typer._windows_application_commands("打开Figma", None)

        self.assertEqual(commands[0], (str(Path("C:/x/Figma.lnk")),))

    def test_start_menu_roots_ignore_missing_environment_values(self):
        with patch.dict("agent.typer.os.environ", {"APPDATA": "", "ProgramData": ""}):
            self.assertIsNone(typer._find_start_menu_shortcut(("微信",)))


if __name__ == "__main__":
    unittest.main()
