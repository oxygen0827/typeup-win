"""Personal correction learning for TypeUp dictation.

The engine keeps these records local. A correction becomes active only after it
is seen more than once or its confidence is manually raised.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import threading
import uuid


TRACK_TIMEOUT_SECONDS = 30.0
MIN_CONFIDENCE_TO_APPLY = 2
MAX_RULES_TO_APPLY = 200
MAX_HOTWORDS = 100


@dataclass(frozen=True)
class CorrectionApplyResult:
    text: str
    applied: tuple[dict, ...] = ()


def default_corrections_path() -> Path:
    user_dir = os.getenv("TYPEUP_ENGINE_USER_DIR")
    if user_dir:
        return Path(user_dir).expanduser() / "corrections.json"
    if os.name == "nt":
        root = os.getenv("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(root) / "TypeUp" / "engine" / "corrections.json"
    if sys_platform() == "darwin":
        return Path.home() / "Library" / "Application Support" / "TypeUp" / "engine" / "corrections.json"
    root = os.getenv("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(root) / "TypeUp" / "engine" / "corrections.json"


def sys_platform() -> str:
    import sys

    return sys.platform


class CorrectionStore:
    def __init__(self, path: Path | None = None):
        self._path = path or default_corrections_path()
        self._lock = threading.Lock()
        self._records: list[dict] = []
        self._load()

    @property
    def path(self) -> Path:
        return self._path

    def list(self, include_disabled: bool = True) -> list[dict]:
        with self._lock:
            records = [dict(item) for item in self._records]
        if not include_disabled:
            records = [item for item in records if item.get("enabled", True)]
        return sorted(
            records,
            key=lambda item: (
                -int(item.get("confidence") or 0),
                -int(item.get("count") or 0),
                str(item.get("source") or ""),
            ),
        )

    def upsert_observation(self, source: str, target: str) -> dict | None:
        source, target = normalize_pair(source, target)
        if not should_learn_pair(source, target):
            return None
        with self._lock:
            now = _now_iso()
            existing = self._find_by_pair(source, target)
            if existing is not None:
                existing["count"] = int(existing.get("count") or 0) + 1
                existing["confidence"] = max(
                    int(existing.get("confidence") or 1),
                    min(5, int(existing.get("count") or 1)),
                )
                existing["updated_at"] = now
                existing["last_seen_at"] = now
                self._save_locked()
                return dict(existing)
            record = {
                "id": f"corr_{uuid.uuid4().hex}",
                "source": source,
                "target": target,
                "count": 1,
                "confidence": 1,
                "enabled": True,
                "created_at": now,
                "updated_at": now,
                "last_seen_at": now,
            }
            self._records.append(record)
            self._save_locked()
            return dict(record)

    def create(self, source: str, target: str) -> dict:
        source, target = normalize_pair(source, target)
        validate_pair(source, target)
        with self._lock:
            now = _now_iso()
            existing = self._find_by_pair(source, target)
            if existing is not None:
                existing["enabled"] = True
                existing["confidence"] = max(int(existing.get("confidence") or 1), 2)
                existing["updated_at"] = now
                self._save_locked()
                return dict(existing)
            record = {
                "id": f"corr_{uuid.uuid4().hex}",
                "source": source,
                "target": target,
                "count": 2,
                "confidence": 2,
                "enabled": True,
                "created_at": now,
                "updated_at": now,
                "last_seen_at": now,
            }
            self._records.append(record)
            self._save_locked()
            return dict(record)

    def update(self, record_id: str, patch: dict) -> dict | None:
        with self._lock:
            record = self._find_by_id(record_id)
            if record is None:
                return None
            next_source = record["source"]
            next_target = record["target"]
            if "source" in patch:
                next_source = str(patch.get("source") or "")
            if "target" in patch:
                next_target = str(patch.get("target") or "")
            next_source, next_target = normalize_pair(next_source, next_target)
            validate_pair(next_source, next_target)
            record["source"] = next_source
            record["target"] = next_target
            if "enabled" in patch:
                record["enabled"] = bool(patch.get("enabled"))
            if "confidence" in patch:
                record["confidence"] = max(1, min(5, int(patch.get("confidence") or 1)))
            if "count" in patch:
                record["count"] = max(1, int(patch.get("count") or 1))
            record["updated_at"] = _now_iso()
            self._save_locked()
            return dict(record)

    def delete(self, record_id: str) -> bool:
        with self._lock:
            before = len(self._records)
            self._records = [item for item in self._records if item.get("id") != record_id]
            changed = len(self._records) != before
            if changed:
                self._save_locked()
            return changed

    def active_rules(self) -> list[dict]:
        records = [
            item for item in self.list(include_disabled=False)
            if int(item.get("confidence") or 0) >= MIN_CONFIDENCE_TO_APPLY
            or int(item.get("count") or 0) >= 2
        ]
        winners: dict[str, dict] = {}
        for record in records:
            source = str(record.get("source") or "")
            current = winners.get(source)
            if current is None or _rule_rank(record) > _rule_rank(current):
                winners[source] = record
        return sorted(
            winners.values(),
            key=lambda item: (-len(str(item.get("source") or "")), -_rule_rank(item)),
        )[:MAX_RULES_TO_APPLY]

    def hotwords(self, limit: int = MAX_HOTWORDS) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for record in self.active_rules():
            word = str(record.get("target") or "").strip()
            if not word or word.lower() in seen:
                continue
            seen.add(word.lower())
            out.append(word)
            if len(out) >= limit:
                break
        return out

    def prompt_hint(self, limit: int = 40) -> str:
        pairs = []
        for record in self.active_rules()[:limit]:
            source = str(record.get("source") or "").strip()
            target = str(record.get("target") or "").strip()
            if source and target:
                pairs.append(f"{source}=>{target}")
        if not pairs:
            return ""
        return "Personal corrections to preserve: " + "; ".join(pairs)

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8") or "[]")
            if isinstance(data, dict):
                data = data.get("records", [])
            if isinstance(data, list):
                self._records = [_clean_record(item) for item in data if isinstance(item, dict)]
        except Exception as e:
            print(f"[corrections] read failed {self._path}: {e}")
            self._records = []

    def _save_locked(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(self._records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _find_by_pair(self, source: str, target: str) -> dict | None:
        for record in self._records:
            if record.get("source") == source and record.get("target") == target:
                return record
        return None

    def _find_by_id(self, record_id: str) -> dict | None:
        for record in self._records:
            if record.get("id") == record_id:
                return record
        return None


class CorrectionEngine:
    def __init__(self, store: CorrectionStore):
        self._store = store

    def apply(self, text: str) -> CorrectionApplyResult:
        current = str(text or "")
        applied: list[dict] = []
        if not current:
            return CorrectionApplyResult(current)
        for rule in self._store.active_rules():
            source = str(rule.get("source") or "")
            target = str(rule.get("target") or "")
            if not source or not target or source == target:
                continue
            next_text, changed = apply_rule(current, source, target)
            if changed:
                applied.append(rule)
                current = next_text
        return CorrectionApplyResult(current, tuple(applied))


class CorrectionSession:
    def __init__(self, store: CorrectionStore, timeout_seconds: float = TRACK_TIMEOUT_SECONDS):
        self._store = store
        self._timeout_seconds = timeout_seconds
        self._started_at = 0.0
        self._remaining = ""
        self._deleted = ""
        self._replacement = ""

    def start(self, text: str, now: float) -> None:
        self._started_at = now
        self._remaining = str(text or "")
        self._deleted = ""
        self._replacement = ""

    def cancel(self) -> None:
        self._started_at = 0.0
        self._remaining = ""
        self._deleted = ""
        self._replacement = ""

    def expire_if_needed(self, now: float) -> None:
        if self.active and (now - self._started_at) > self._timeout_seconds:
            self.finalize()

    @property
    def active(self) -> bool:
        return bool(self._started_at)

    def backspace(self, now: float) -> None:
        self.expire_if_needed(now)
        if not self.active:
            return
        if self._replacement:
            self._replacement = self._replacement[:-1]
            return
        if self._remaining:
            self._deleted = self._remaining[-1] + self._deleted
            self._remaining = self._remaining[:-1]

    def delete(self, now: float) -> None:
        self.expire_if_needed(now)
        self.cancel()

    def append_typed(self, text: str, now: float) -> None:
        self.expire_if_needed(now)
        if not self.active or not self._deleted:
            return
        self._replacement += text
        if len(self._replacement) > 80:
            self.finalize()

    def finalize(self) -> dict | None:
        source, target = normalize_pair(self._deleted, self._replacement)
        if not should_learn_pair(source, target):
            context = _tail_context(self._remaining)
            if context:
                source, target = normalize_pair(context + self._deleted, context + self._replacement)
        self.cancel()
        return self._store.upsert_observation(source, target)


def apply_rule(text: str, source: str, target: str) -> tuple[str, bool]:
    if _contains_ascii_word(source):
        pattern = re.compile(
            r"(?<![A-Za-z0-9])" + _source_pattern(source) + r"(?![A-Za-z0-9])",
            re.IGNORECASE,
        )

        def repl(match: re.Match) -> str:
            return _match_case(match.group(0), target)

        result, count = pattern.subn(repl, text)
        return result, count > 0
    if source in text:
        return text.replace(source, target), True
    return text, False


def normalize_pair(source: str, target: str) -> tuple[str, str]:
    return _trim_pair_text(source), _trim_pair_text(target)


def validate_pair(source: str, target: str) -> None:
    if not should_learn_pair(source, target, strict=True):
        raise ValueError("Invalid correction pair")


def should_learn_pair(source: str, target: str, strict: bool = False) -> bool:
    source = _trim_pair_text(source)
    target = _trim_pair_text(target)
    if not source or not target or source == target:
        return False
    if len(source) < 2 or len(target) < 2:
        return False
    if len(source) > 40 or len(target) > 40:
        return False
    if "\n" in source or "\n" in target or "\r" in source or "\r" in target:
        return False
    if _is_only_punctuation(source) or _is_only_punctuation(target):
        return False
    ratio = len(target) / max(1, len(source))
    if ratio < 0.45 or ratio > 2.2:
        return False
    distance = _levenshtein(source.lower(), target.lower(), max_distance=8)
    if distance <= max(2, len(source) // 3):
        return True
    if strict:
        return True
    return _contains_ascii_word(source) and _contains_ascii_word(target) and distance <= 8


def _trim_pair_text(text: str) -> str:
    return str(text or "").strip(" \t\r\n,.;:!?，。！？；：、\"'“”‘’()（）[]【】")


def _tail_context(text: str) -> str:
    value = str(text or "")
    match = re.search(r"[A-Za-z0-9]+$", value)
    if match:
        return match.group(0)
    stripped = value.rstrip()
    return stripped[-1:] if stripped else ""


def _is_only_punctuation(text: str) -> bool:
    stripped = re.sub(r"[\s\W_]+", "", text, flags=re.UNICODE)
    return not stripped


def _contains_ascii_word(text: str) -> bool:
    return bool(re.search(r"[A-Za-z0-9]", text))


def _source_pattern(source: str) -> str:
    return r"\s+".join(re.escape(part) for part in source.split())


def _match_case(matched: str, target: str) -> str:
    if any(char.isupper() for char in target):
        return target
    if matched.isupper():
        return target.upper()
    words = matched.split()
    if words and all(word[:1].isupper() for word in words if word):
        return " ".join(part[:1].upper() + part[1:] for part in target.split())
    if matched[:1].isupper():
        return target[:1].upper() + target[1:]
    return target


def _levenshtein(left: str, right: str, max_distance: int = 99) -> int:
    if left == right:
        return 0
    if abs(len(left) - len(right)) > max_distance:
        return max_distance + 1
    previous = list(range(len(right) + 1))
    for i, left_char in enumerate(left, start=1):
        current = [i]
        best = current[0]
        for j, right_char in enumerate(right, start=1):
            cost = 0 if left_char == right_char else 1
            value = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            current.append(value)
            best = min(best, value)
        if best > max_distance:
            return max_distance + 1
        previous = current
    return previous[-1]


def _clean_record(item: dict) -> dict:
    now = _now_iso()
    source, target = normalize_pair(item.get("source", ""), item.get("target", ""))
    return {
        "id": str(item.get("id") or f"corr_{uuid.uuid4().hex}"),
        "source": source,
        "target": target,
        "count": max(1, int(item.get("count") or 1)),
        "confidence": max(1, min(5, int(item.get("confidence") or 1))),
        "enabled": bool(item.get("enabled", True)),
        "created_at": str(item.get("created_at") or now),
        "updated_at": str(item.get("updated_at") or now),
        "last_seen_at": str(item.get("last_seen_at") or item.get("updated_at") or now),
    }


def _rule_rank(rule: dict) -> int:
    return int(rule.get("confidence") or 0) * 100 + int(rule.get("count") or 0)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
