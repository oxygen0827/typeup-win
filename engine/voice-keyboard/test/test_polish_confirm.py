import json
import os
import sys
import threading
import unittest
from io import StringIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent import polish_confirm


class _BlockingInput:
    closed = False

    def __init__(self):
        self._lines = []
        self._condition = threading.Condition()

    def push(self, line):
        with self._condition:
            self._lines.append(line)
            self._condition.notify_all()

    def __iter__(self):
        return self

    def __next__(self):
        with self._condition:
            while not self._lines:
                self._condition.wait(1.0)
            return self._lines.pop(0)


class PolishConfirmTests(unittest.TestCase):
    def setUp(self):
        self._old_env = os.environ.get("TYPEUP_DESKTOP")
        self._old_stdin = sys.stdin
        self._old_stdout = sys.stdout
        polish_confirm._reader_started = False
        polish_confirm._pending_responses.clear()
        while not polish_confirm._response_queue.empty():
            polish_confirm._response_queue.get_nowait()

    def tearDown(self):
        if self._old_env is None:
            os.environ.pop("TYPEUP_DESKTOP", None)
        else:
            os.environ["TYPEUP_DESKTOP"] = self._old_env
        sys.stdin = self._old_stdin
        sys.stdout = self._old_stdout

    def test_disabled_outside_desktop_accepts_polished_text(self):
        os.environ.pop("TYPEUP_DESKTOP", None)

        result = polish_confirm.request_polish_confirmation("原文", "润色")

        self.assertTrue(result.accepted)
        self.assertEqual(result.text, "润色")

    def test_desktop_confirmation_uses_ipc_response(self):
        os.environ["TYPEUP_DESKTOP"] = "1"
        stdin = _BlockingInput()
        stdout = StringIO()
        sys.stdin = stdin
        sys.stdout = stdout

        def respond():
            while CONTROL_PREFIX not in stdout.getvalue():
                pass
            line = stdout.getvalue().strip().splitlines()[-1]
            payload = json.loads(line.removeprefix(CONTROL_PREFIX))
            stdin.push(json.dumps({
                "type": polish_confirm.RESPONSE_TYPE,
                "id": payload["id"],
                "accepted": True,
                "text": "确认文本",
            }) + "\n")

        CONTROL_PREFIX = polish_confirm.CONTROL_PREFIX
        threading.Thread(target=respond, daemon=True).start()

        result = polish_confirm.request_polish_confirmation("原文", "润色", timeout_seconds=2.0)

        self.assertTrue(result.accepted)
        self.assertEqual(result.text, "确认文本")


if __name__ == "__main__":
    unittest.main()
