import unittest
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.text_snapshot import _control_identity


class FakeControl:
    ProcessId = 100
    ControlTypeName = "EditControl"
    ClassName = "TextBox"
    AutomationId = "message"

    def __init__(self, name):
        self.Name = name

    def GetRuntimeId(self):
        return [42, 7]


class TextSnapshotTests(unittest.TestCase):
    def test_identity_ignores_dynamic_control_name(self):
        before = _control_identity(FakeControl("胡志宇"))
        after = _control_identity(FakeControl("胡智宇"))

        self.assertEqual(before, after)
        self.assertNotIn("胡志宇", before)
        self.assertNotIn("胡智宇", after)


if __name__ == "__main__":
    unittest.main()
