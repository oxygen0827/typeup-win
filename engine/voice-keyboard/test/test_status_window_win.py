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

    def test_preview_text_is_compacted_from_the_tail(self):
        from agent.status_window_win import _compact_preview_text

        text = "一" * 20 + "最后一句"

        compacted = _compact_preview_text(text, 5)

        self.assertTrue(compacted.startswith("..."))
        self.assertTrue(compacted.endswith("最后一句"))
        self.assertLess(len(compacted), len(text))

    def test_preview_body_lines_grow_with_text(self):
        from agent.status_window_win import _estimate_preview_body_lines

        short = _estimate_preview_body_lines("一句话")
        long = _estimate_preview_body_lines("一" * 120)

        self.assertGreater(long, short)

    def test_preview_height_grows_and_is_capped(self):
        from agent.status_window_win import StatusWindow

        window = object.__new__(StatusWindow)
        window._preview_body = "一" * 10
        short_height = window._preview_height()
        window._preview_body = "一" * 500
        long_height = window._preview_height()

        self.assertGreater(long_height, short_height)
        self.assertLessEqual(long_height, 286)


if __name__ == "__main__":
    unittest.main()
