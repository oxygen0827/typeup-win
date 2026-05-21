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


if __name__ == "__main__":
    unittest.main()
