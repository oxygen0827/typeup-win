import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent.parent))


@unittest.skipUnless(sys.platform == "win32", "Windows-only HUD")
class StatusWindowWinAudioLevelTests(unittest.TestCase):
    def test_audio_level_decays_instead_of_snapping_to_zero(self):
        from agent.status_window_win import _smooth_audio_level

        self.assertGreater(_smooth_audio_level(0.6, 0.0), 0.0)

    def test_audio_level_is_clamped(self):
        from agent.status_window_win import _smooth_audio_level

        self.assertLessEqual(_smooth_audio_level(0.0, 5.0), 1.0)
        self.assertGreaterEqual(_smooth_audio_level(0.2, -1.0), 0.0)

    def test_audio_level_drops_smoothly(self):
        from agent.status_window_win import _smooth_audio_level

        dropped = _smooth_audio_level(0.8, 0.2)
        self.assertGreater(dropped, 0.2)
        self.assertLess(dropped, 0.8)

    def test_prompt_polish_label_changes_recording_title(self):
        from agent.status_window_win import _polish_recording_info

        title, detail, _color = _polish_recording_info("Prompt 风格")

        self.assertEqual(title, "正在聆听 · Prompt 风格")
        self.assertEqual(detail, "松开 ALT 后输入Prompt 风格结果")
        self.assertNotIn("微润色", title)


    def test_ai_recording_uses_current_windows_shortcut_hint(self):
        from agent.status_window_win import _STATES

        _title, detail, _color = _STATES["ai_recording"]

        self.assertIn("RIGHT ALT", detail)
        self.assertIn("RIGHT SHIFT", detail)
        self.assertNotIn("ALT + SPACE", detail)
        self.assertNotIn("右 SHIFT", detail)


if __name__ == "__main__":
    unittest.main()
