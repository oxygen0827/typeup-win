import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import agent.audio_monitor as audio_monitor


class _Default:
    device = [3, -1]


class _FakeSoundDevice:
    default = _Default()

    def __init__(self):
        self.devices = [
            {"name": "耳机 (Redmi Buds 5 Pro)", "max_input_channels": 1},
            {"name": "扬声器", "max_input_channels": 0},
            {"name": "阵列麦克风", "max_input_channels": 2},
            {"name": "麦克风 (HyperX Cloud III)", "max_input_channels": 1},
        ]

    def query_devices(self, index=None):
        if index is None:
            return self.devices
        return self.devices[index]


class AudioMonitorDeviceTests(unittest.TestCase):
    def test_auto_prefers_system_default_input_device(self):
        original_sd = audio_monitor.sd
        try:
            audio_monitor.sd = _FakeSoundDevice()
            self.assertEqual(audio_monitor.find_device("auto"), 3)
        finally:
            audio_monitor.sd = original_sd

    def test_name_and_index_selection_still_work(self):
        original_sd = audio_monitor.sd
        try:
            audio_monitor.sd = _FakeSoundDevice()
            self.assertEqual(audio_monitor.find_device("阵列"), 2)
            self.assertEqual(audio_monitor.find_device("0"), 0)
        finally:
            audio_monitor.sd = original_sd


if __name__ == "__main__":
    unittest.main()
