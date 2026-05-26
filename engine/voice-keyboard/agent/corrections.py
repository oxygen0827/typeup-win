"""Personal correction learning for TypeUp dictation.

The engine keeps these records local. A correction becomes active only after it
is seen more than once or its confidence is manually raised.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import difflib
import json
import os
from pathlib import Path
import re
import threading
import time
import uuid


TRACK_TIMEOUT_SECONDS = 30.0
MIN_CONFIDENCE_TO_APPLY = 2
MAX_RULES_TO_APPLY = 200
MAX_HOTWORDS = 100


@dataclass(frozen=True)
class CorrectionApplyResult:
    text: str
    applied: tuple[dict, ...] = ()


@dataclass(frozen=True)
class TextSnapshot:
    text: str
    identity: str = ""
    selection_start: int | None = None
    selection_end: int | None = None
    source: str = ""


@dataclass(frozen=True)
class SnapshotCorrectionCandidate:
    source: str
    target: str


@dataclass
class _SnapshotSession:
    started_at: float
    updated_at: float
    voice_text: str
    identity: str
    output_start: int
    output_end: int
    after_output: TextSnapshot
    edited: bool = False
    edit_kind: str = ""
    latest_edit_snapshot: TextSnapshot | None = None


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
        self._loaded_mtime_ns: int | None = None
        self._load()

    @property
    def path(self) -> Path:
        return self._path

    def list(self, include_disabled: bool = True) -> list[dict]:
        with self._lock:
            self._maybe_reload_locked()
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
            self._maybe_reload_locked()
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
            self._maybe_reload_locked()
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
            self._maybe_reload_locked()
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
            self._maybe_reload_locked()
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
            self._loaded_mtime_ns = None
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8") or "[]")
            if isinstance(data, dict):
                data = data.get("records", [])
            if isinstance(data, list):
                self._records = [_clean_record(item) for item in data if isinstance(item, dict)]
            self._loaded_mtime_ns = self._path.stat().st_mtime_ns
        except Exception as e:
            print(f"[corrections] read failed {self._path}: {e}")
            self._records = []
            self._loaded_mtime_ns = None

    def _maybe_reload_locked(self) -> None:
        try:
            mtime_ns = self._path.stat().st_mtime_ns
        except FileNotFoundError:
            if self._loaded_mtime_ns is not None:
                self._records = []
                self._loaded_mtime_ns = None
            return
        except OSError:
            return
        if mtime_ns != self._loaded_mtime_ns:
            self._load()

    def _save_locked(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(self._records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        try:
            self._loaded_mtime_ns = self._path.stat().st_mtime_ns
        except OSError:
            self._loaded_mtime_ns = None

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


class SnapshotCorrectionTracker:
    """Learn corrections from before/after text snapshots around voice output."""

    def __init__(
        self,
        store: CorrectionStore,
        snapshot_reader=None,
        timeout_seconds: float = TRACK_TIMEOUT_SECONDS,
        debug: bool | None = None,
        edit_snapshot_delay: float = 0.12,
    ):
        self._store = store
        self._snapshot_reader = snapshot_reader
        self._timeout_seconds = timeout_seconds
        self._debug = bool(os.getenv("TYPEUP_DEBUG_CORRECTIONS")) if debug is None else debug
        self._edit_snapshot_delay = max(0.0, float(edit_snapshot_delay))
        self._session: _SnapshotSession | None = None

    @property
    def active(self) -> bool:
        return self._session is not None

    @property
    def edited(self) -> bool:
        return bool(self._session and self._session.edited)

    def record_voice_output(
        self,
        text: str,
        before: TextSnapshot | None,
        after: TextSnapshot | None,
        now: float | None = None,
    ) -> None:
        now = time.monotonic() if now is None else now
        self.expire_if_needed(now)
        if before is None or after is None:
            self._debug_reject("missing_snapshot")
            return
        if not _snapshot_identity_matches(before, after):
            self._debug_reject("output_identity_changed")
            return
        span = infer_voice_output_span(before.text, after.text, text)
        if span is None:
            self._debug_reject("output_span_not_found")
            return
        output_start, output_end = span
        identity = after.identity or before.identity or ""
        current = self._session
        if current is not None and current.edited:
            self.finalize("next_voice", now=now)
            current = self._session
        if (
            current is not None
            and not current.edited
            and _identity_strings_match(current.identity, identity)
            and _can_merge_output_span(current.output_start, current.output_end, output_start, output_end)
        ):
            current.updated_at = now
            current.voice_text += str(text or "")
            current.output_start = min(current.output_start, output_start)
            current.output_end = max(current.output_end, output_end)
            current.after_output = after
            return
        self._session = _SnapshotSession(
            started_at=now,
            updated_at=now,
            voice_text=str(text or ""),
            identity=identity,
            output_start=output_start,
            output_end=output_end,
            after_output=after,
        )

    def mark_user_edit(self, kind: str, now: float | None = None) -> None:
        now = time.monotonic() if now is None else now
        self.expire_if_needed(now)
        if self._session is None:
            return
        if (now - self._session.started_at) > self._timeout_seconds:
            self.cancel()
            return
        self._session.edited = True
        self._session.edit_kind = str(kind or "")
        self._session.updated_at = now
        self._schedule_edit_snapshot_cache(now)

    def finalize_if_edited(self, reason: str = "manual", now: float | None = None) -> dict | None:
        if not self.edited:
            return None
        return self.finalize(reason, now=now)

    def finalize(
        self,
        reason: str = "manual",
        after_snapshot: TextSnapshot | None = None,
        now: float | None = None,
    ) -> dict | None:
        now = time.monotonic() if now is None else now
        session = self._session
        self._session = None
        if session is None or not session.edited:
            return None
        if (now - session.started_at) > self._timeout_seconds and reason != "timeout":
            self._debug_reject("expired_before_finalize")
            return None
        snapshots = []
        if after_snapshot is not None:
            snapshots.append(after_snapshot)
        else:
            current_snapshot = self._read_snapshot()
            if current_snapshot is not None:
                snapshots.append(current_snapshot)
        if session.latest_edit_snapshot is not None:
            snapshots.append(session.latest_edit_snapshot)
        if not snapshots:
            self._debug_reject("missing_edit_snapshot")
            return None
        candidate = None
        rejected_identity = False
        for snapshot in snapshots:
            if not _identity_strings_match(session.identity, snapshot.identity):
                rejected_identity = True
                continue
            candidate = infer_snapshot_correction(
                session.after_output.text,
                snapshot.text,
                session.output_start,
                session.output_end,
            )
            if candidate is not None:
                break
        if candidate is None:
            self._debug_reject("edit_identity_changed" if rejected_identity else "diff_rejected")
            return None
        return self._store.upsert_observation(candidate.source, candidate.target)

    def expire_if_needed(self, now: float | None = None) -> dict | None:
        now = time.monotonic() if now is None else now
        if self._session is None:
            return None
        if (now - self._session.started_at) <= self._timeout_seconds:
            return None
        if self._session.edited:
            return self.finalize("timeout", now=now)
        self.cancel()
        return None

    def cancel(self) -> None:
        self._session = None

    def _read_snapshot(self) -> TextSnapshot | None:
        if self._snapshot_reader is None:
            return None
        try:
            return self._snapshot_reader.read()
        except Exception as e:
            self._debug_reject(f"snapshot_read_failed:{e}")
            return None

    def _schedule_edit_snapshot_cache(self, now: float) -> None:
        if self._snapshot_reader is None or self._session is None:
            return
        if self._edit_snapshot_delay <= 0:
            self._cache_edit_snapshot(now)
            return
        session_started_at = self._session.started_at
        timer = threading.Timer(
            self._edit_snapshot_delay,
            self._cache_edit_snapshot_if_current,
            args=(session_started_at,),
        )
        timer.daemon = True
        timer.start()

    def _cache_edit_snapshot_if_current(self, session_started_at: float) -> None:
        session = self._session
        if session is None or session.started_at != session_started_at:
            return
        self._cache_edit_snapshot(time.monotonic())

    def _cache_edit_snapshot(self, now: float) -> None:
        session = self._session
        if session is None or (now - session.started_at) > self._timeout_seconds:
            return
        snapshot = self._read_snapshot()
        if snapshot is None:
            return
        if not _identity_strings_match(session.identity, snapshot.identity):
            return
        if snapshot.text == session.after_output.text:
            return
        session.latest_edit_snapshot = snapshot

    def _debug_reject(self, reason: str) -> None:
        if self._debug:
            print(f"[corrections:debug] snapshot rejected {reason}")


def infer_voice_output_span(before_text: str, after_text: str, output_text: str) -> tuple[int, int] | None:
    before = str(before_text or "")
    after = str(after_text or "")
    output = str(output_text or "")
    if not after or before == after:
        return None
    prefix = _common_prefix_len(before, after)
    suffix = _common_suffix_len(before[prefix:], after[prefix:])
    start = prefix
    end = len(after) - suffix
    if start < end:
        return start, end
    if output:
        idx = after.rfind(output)
        if idx >= 0:
            return idx, idx + len(output)
    return None


def infer_snapshot_correction(
    after_output_text: str,
    after_edit_text: str,
    output_start: int = 0,
    output_end: int | None = None,
) -> SnapshotCorrectionCandidate | None:
    original = str(after_output_text or "")
    edited = str(after_edit_text or "")
    if not original or not edited or original == edited:
        return None
    output_start = max(0, min(len(original), int(output_start or 0)))
    output_end = len(original) if output_end is None else max(output_start, min(len(original), int(output_end)))
    changed = _changed_opcodes(original, edited)
    if not changed:
        return None
    if not any(_spans_overlap(i1, i2, output_start, output_end) for _, i1, i2, _, _ in changed):
        return None
    if any(not _spans_overlap(i1, i2, output_start, output_end) for _, i1, i2, _, _ in changed if i1 != i2):
        return None
    if len(changed) > 1 and (changed[-1][2] - changed[0][1]) > 12:
        return None
    prefix = _common_prefix_len(original, edited)
    suffix = _common_suffix_len(original[prefix:], edited[prefix:])
    i1 = prefix
    i2 = len(original) - suffix
    j1 = prefix
    j2 = len(edited) - suffix
    if not _spans_overlap(i1, i2, output_start, output_end):
        return None
    source, target = _expand_snapshot_pair(original, edited, i1, i2, j1, j2, output_start, output_end)
    source, target = normalize_pair(source, target)
    if not should_learn_pair(source, target):
        return None
    return SnapshotCorrectionCandidate(source, target)


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


def _snapshot_identity_matches(left: TextSnapshot, right: TextSnapshot) -> bool:
    return _identity_strings_match(left.identity, right.identity)


def _identity_strings_match(left: str | None, right: str | None) -> bool:
    left = str(left or "")
    right = str(right or "")
    return not left or not right or left == right


def _can_merge_output_span(current_start: int, current_end: int, next_start: int, next_end: int) -> bool:
    if next_end < current_start:
        return False
    return next_start <= current_end + 8


def _common_prefix_len(left: str, right: str) -> int:
    limit = min(len(left), len(right))
    idx = 0
    while idx < limit and left[idx] == right[idx]:
        idx += 1
    return idx


def _common_suffix_len(left: str, right: str) -> int:
    limit = min(len(left), len(right))
    idx = 0
    while idx < limit and left[len(left) - idx - 1] == right[len(right) - idx - 1]:
        idx += 1
    return idx


def _spans_overlap(left_start: int, left_end: int, right_start: int, right_end: int) -> bool:
    if left_start == left_end:
        return right_start <= left_start <= right_end
    return max(left_start, right_start) < min(left_end, right_end)


def _changed_opcodes(left: str, right: str) -> list[tuple[str, int, int, int, int]]:
    matcher = difflib.SequenceMatcher(a=left, b=right, autojunk=False)
    return [op for op in matcher.get_opcodes() if op[0] != "equal"]


def _expand_snapshot_pair(
    original: str,
    edited: str,
    i1: int,
    i2: int,
    j1: int,
    j2: int,
    output_start: int,
    output_end: int,
) -> tuple[str, str]:
    source = original[i1:i2]
    target = edited[j1:j2]
    compact = _compact_cjk_context(original, edited, i1, i2, j1, j2, output_start, output_end)
    if compact is not None and should_learn_pair(compact[0], compact[1]):
        return compact
    if should_learn_pair(source, target):
        return source, target
    ascii_bounds = _ascii_context_bounds(original, edited, i1, i2, j1, j2, output_start, output_end)
    if ascii_bounds is not None:
        si1, si2, tj1, tj2 = ascii_bounds
        source = original[si1:si2]
        target = edited[tj1:tj2]
        if should_learn_pair(source, target):
            return source, target
    left_ctx = min(1, max(0, i1 - output_start), max(0, j1))
    needed_right = max(0, 3 - (len(source) + left_ctx))
    right_ctx = min(needed_right, max(0, output_end - i2), max(0, len(edited) - j2))
    source = original[i1 - left_ctx:i2 + right_ctx]
    target = edited[j1 - left_ctx:j2 + right_ctx]
    if should_learn_pair(source, target):
        return source, target
    left_ctx = min(2, max(0, i1 - output_start), max(0, j1))
    right_ctx = min(1, max(0, output_end - i2), max(0, len(edited) - j2))
    return original[i1 - left_ctx:i2 + right_ctx], edited[j1 - left_ctx:j2 + right_ctx]


def _compact_cjk_context(
    original: str,
    edited: str,
    i1: int,
    i2: int,
    j1: int,
    j2: int,
    output_start: int,
    output_end: int,
) -> tuple[str, str] | None:
    source = original[i1:i2]
    target = edited[j1:j2]
    if len(source) > 2 or len(target) > 2 or _contains_ascii_word(source + target):
        return None
    left_ctx = min(1, max(0, i1 - output_start), max(0, j1))
    needed_right = max(0, 3 - (len(source) + left_ctx))
    right_ctx = min(needed_right, max(0, output_end - i2), max(0, len(edited) - j2))
    if left_ctx + right_ctx == 0:
        return None
    expanded_source = original[i1 - left_ctx:i2 + right_ctx]
    expanded_target = edited[j1 - left_ctx:j2 + right_ctx]
    if len(expanded_source) < 3 and right_ctx < 2:
        extra_left = min(2 - left_ctx, max(0, i1 - left_ctx - output_start), max(0, j1 - left_ctx))
        expanded_source = original[i1 - left_ctx - extra_left:i2 + right_ctx]
        expanded_target = edited[j1 - left_ctx - extra_left:j2 + right_ctx]
    return expanded_source, expanded_target


def _ascii_context_bounds(
    original: str,
    edited: str,
    i1: int,
    i2: int,
    j1: int,
    j2: int,
    output_start: int,
    output_end: int,
) -> tuple[int, int, int, int] | None:
    window = original[max(output_start, i1 - 24):min(output_end, i2 + 24)]
    changed = original[i1:i2] + edited[j1:j2]
    if not _contains_ascii_word(window + changed):
        return None
    source_start = _ascii_phrase_start(original, i1, output_start)
    source_end = _ascii_word_end(original, i2, output_end)
    prefix_len = i1 - source_start
    suffix_len = source_end - i2
    if j1 < prefix_len or j2 + suffix_len > len(edited):
        return None
    target_start = j1 - prefix_len
    target_end = j2 + suffix_len
    return source_start, source_end, target_start, target_end


def _ascii_phrase_start(text: str, index: int, limit: int) -> int:
    start = _ascii_word_start(text, index, limit)
    prev = start
    while prev > limit and text[prev - 1].isspace():
        prev -= 1
    if prev <= limit or not _is_ascii_word_char(text[prev - 1]):
        return start
    return _ascii_word_start(text, prev, limit)


def _ascii_word_start(text: str, index: int, limit: int) -> int:
    pos = max(limit, min(len(text), index))
    while pos > limit and _is_ascii_word_char(text[pos - 1]):
        pos -= 1
    return pos


def _ascii_word_end(text: str, index: int, limit: int) -> int:
    pos = max(0, min(len(text), index))
    limit = min(len(text), limit)
    while pos < limit and _is_ascii_word_char(text[pos]):
        pos += 1
    return pos


def _is_ascii_word_char(char: str) -> bool:
    return bool(re.match(r"[A-Za-z0-9_-]", char or ""))


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
