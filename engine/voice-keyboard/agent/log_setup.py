"""
打包模式下把 stdout/stderr 重定向到应用日志目录，
让 Finder 启动的 .app 也能事后查日志。开发模式（python -m agent.main）保持终端输出。
"""

import os
import sys
from pathlib import Path


def _log_path() -> Path:
    if os.getenv("TYPEUP_DESKTOP") == "1":
        if sys.platform == "darwin":
            return Path.home() / "Library" / "Logs" / "TypeUp" / "engine.log"
        user_dir = Path(os.getenv("TYPEUP_ENGINE_USER_DIR", "")).expanduser() if os.getenv("TYPEUP_ENGINE_USER_DIR") else Path.home() / ".typeup" / "engine"
        return user_dir / "agent.log"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Logs" / "TypeUp" / "agent.log"
    return Path.home() / ".voice-keyboard" / "agent.log"


def _fallback_log_path() -> Path:
    if sys.platform == "win32":
        base = os.getenv("LOCALAPPDATA") or os.getenv("TEMP") or str(Path.home())
        return Path(base) / "TypeUp" / "engine" / "agent.log"
    return Path(os.getenv("TMPDIR") or "/tmp") / "typeup-agent.log"


def _emergency_log_path() -> Path:
    base = os.getenv("TEMP") or os.getenv("TMP") or os.getenv("TMPDIR") or str(Path.cwd())
    return Path(base) / f"typeup-agent-{os.getpid()}.log"


class _Tee:
    """同时写文件和原 stream，带行缓冲 flush。"""
    def __init__(self, *streams):
        self._streams = streams

    def write(self, data):
        for s in self._streams:
            try:
                s.write(data)
                s.flush()
            except Exception:
                pass

    def flush(self):
        for s in self._streams:
            try:
                s.flush()
            except Exception:
                pass


def setup() -> Path | None:
    """打包模式启用日志重定向，返回日志文件路径。开发模式返回 None。"""
    if not getattr(sys, "frozen", False):
        return None

    path = _log_path()
    fallback = _fallback_log_path()
    last_error: Exception | None = None
    for candidate in (path, fallback, _emergency_log_path()):
        try:
            _attach_log_file(candidate)
            return candidate
        except Exception as e:
            last_error = e
            path = candidate

    # 日志失败不应阻断启动
    print(f"[log] 日志重定向失败: {last_error}")
    return None


def _attach_log_file(path: Path) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        # 截断到 1MB 以下，防止无限增长
        if path.exists() and path.stat().st_size > 1_000_000:
            tail = path.read_bytes()[-500_000:]
            path.write_bytes(tail)
        f = open(path, "a", buffering=1, encoding="utf-8", errors="replace")
        # frozen 启动 stdout/stderr 通常是 None，直接替换
        sys.stdout = _Tee(f, sys.stdout) if sys.stdout else f
        sys.stderr = _Tee(f, sys.stderr) if sys.stderr else f
        os.environ["VK_LOG_PATH"] = str(path)
        label = "TypeUp Engine" if os.getenv("TYPEUP_DESKTOP") == "1" else "TypeUp"
        print(f"\n[log] === {label} 启动 PID={os.getpid()} ===")
    except Exception:
        if os.environ.get("VK_LOG_PATH") == str(path):
            os.environ.pop("VK_LOG_PATH", None)
        raise


def log_path() -> Path:
    return _log_path()
