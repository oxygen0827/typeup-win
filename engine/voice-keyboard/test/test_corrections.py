import json
import tempfile
import unittest
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.corrections import CorrectionEngine, CorrectionSession, CorrectionStore


class CorrectionStoreTests(unittest.TestCase):
    def test_repeated_learning_enables_application(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CorrectionStore(Path(tmp) / "corrections.json")
            engine = CorrectionEngine(store)

            self.assertIsNotNone(store.upsert_observation("胡仁远", "胡任远"))
            self.assertEqual(engine.apply("今天找胡仁远").text, "今天找胡仁远")

            self.assertIsNotNone(store.upsert_observation("胡仁远", "胡任远"))
            result = engine.apply("今天找胡仁远")

            self.assertEqual(result.text, "今天找胡任远")
            self.assertEqual(len(result.applied), 1)

    def test_manual_create_is_active_immediately(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CorrectionStore(Path(tmp) / "corrections.json")
            store.create("胡少宏", "胡少鸿")

            self.assertEqual(
                CorrectionEngine(store).apply("请胡少宏确认").text,
                "请胡少鸿确认",
            )

    def test_english_rule_preserves_basic_case(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CorrectionStore(Path(tmp) / "corrections.json")
            store.create("claude codecs", "claude codex")
            engine = CorrectionEngine(store)

            self.assertEqual(engine.apply("open claude codecs").text, "open claude codex")
            self.assertEqual(engine.apply("Open Claude Codecs").text, "Open Claude Codex")
            self.assertEqual(engine.apply("CLAUDE CODECS").text, "CLAUDE CODEX")

    def test_disabled_and_deleted_rules_do_not_apply(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CorrectionStore(Path(tmp) / "corrections.json")
            record = store.create("胡仁远", "胡任远")
            store.update(record["id"], {"enabled": False})
            self.assertEqual(CorrectionEngine(store).apply("胡仁远").text, "胡仁远")

            store.update(record["id"], {"enabled": True})
            store.delete(record["id"])
            self.assertEqual(CorrectionEngine(store).apply("胡仁远").text, "胡仁远")

    def test_rejects_bad_learning_pairs(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CorrectionStore(Path(tmp) / "corrections.json")

            self.assertIsNone(store.upsert_observation("胡", "任"))
            self.assertIsNone(store.upsert_observation("，，", "。"))
            self.assertIsNone(store.upsert_observation("一段非常非常非常长的原文需要被完全重写", "短词"))

    def test_persists_to_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "corrections.json"
            store = CorrectionStore(path)
            store.create("胡少宏", "胡少鸿")

            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(data[0]["source"], "胡少宏")
            self.assertEqual(CorrectionStore(path).list()[0]["target"], "胡少鸿")


class CorrectionSessionTests(unittest.TestCase):
    def test_session_learns_backspace_then_typed_replacement(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CorrectionStore(Path(tmp) / "corrections.json")
            session = CorrectionSession(store)

            session.start("胡仁远", now=1.0)
            session.backspace(now=2.0)
            session.backspace(now=2.1)
            session.append_typed("任", now=2.2)
            session.append_typed("远", now=2.3)
            record = session.finalize()

            self.assertIsNotNone(record)
            self.assertEqual(record["source"], "仁远")
            self.assertEqual(record["target"], "任远")

    def test_session_uses_context_for_single_character_replacement(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CorrectionStore(Path(tmp) / "corrections.json")
            session = CorrectionSession(store)

            session.start("胡少宏", now=1.0)
            session.backspace(now=2.0)
            session.append_typed("鸿", now=2.1)
            record = session.finalize()

            self.assertIsNotNone(record)
            self.assertEqual(record["source"], "少宏")
            self.assertEqual(record["target"], "少鸿")

    def test_session_ignores_timeout_input(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = CorrectionStore(Path(tmp) / "corrections.json")
            session = CorrectionSession(store, timeout_seconds=1)

            session.start("胡仁远", now=1.0)
            session.backspace(now=1.1)
            session.append_typed("远", now=3.0)

            self.assertEqual(store.list(), [])


if __name__ == "__main__":
    unittest.main()
