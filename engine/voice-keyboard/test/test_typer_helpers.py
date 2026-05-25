import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent import typer


class TyperApplicationLaunchTests(unittest.TestCase):
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
