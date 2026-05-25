"""
Push-to-Talk 录音模块，支持三个热键：
  ptt_key  — 普通听写（dictation），松开后调 on_utterance
  edit_key — 语音编辑（edit），松开后调 on_edit_utterance
  ai_key   — AI 编程指令（ai），松开后调 on_ai_utterance

三个键互斥：一个按下时另两个无效。

dictation 模式支持实时分句：按住说话过程中，检测到句子间停顿即立刻触发 STT，
无需等到松键，适合连续说多句话的场景。
"""

import threading
import time
import sys
from typing import Callable, Optional

import sounddevice as sd
from pynput import keyboard as kb

from agent.audio_monitor import find_device, FRAME_BYTES, SILENCE_FRAMES, MIN_SPEECH_FRAMES
import agent.typer as _typer

SAMPLE_RATE = 16000
_LEVEL_UPDATE_INTERVAL = 0.04
_SPEECH_LEVEL_THRESHOLD = 0.025

try:
    import webrtcvad as _webrtcvad
except ImportError:
    _webrtcvad = None


_KEY_ALIASES = {
    "left_alt": "alt_l",
    "right_alt": "alt_r",
    "alt_gr": "alt_r",
    "option": "alt",
    "option_l": "alt_l",
    "option_r": "alt_r",
    "left_option": "alt_l",
    "right_option": "alt_r",
    "left_ctrl": "ctrl_l",
    "right_ctrl": "ctrl_r",
    "control": "ctrl",
    "control_l": "ctrl_l",
    "control_r": "ctrl_r",
    "left_shift": "shift_l",
    "right_shift": "shift_r",
    "command": "cmd",
    "command_l": "cmd_l",
    "command_r": "cmd_r",
    "left_cmd": "cmd_l",
    "right_cmd": "cmd_r",
}


def _normalized_key_name(key_str: str) -> str:
    key_name = str(key_str).strip().lower()
    return _KEY_ALIASES.get(key_name, key_name)


def _parse_key(key_str: str):
    key_name = _normalized_key_name(key_str)
    try:
        return getattr(kb.Key, key_name)
    except AttributeError:
        return kb.KeyCode.from_char(key_name)


def _parse_keys(key_input) -> list:
    """支持单个字符串或字符串列表，统一返回 pynput key 列表。"""
    if isinstance(key_input, list):
        return [_parse_key(k) for k in key_input]
    return [_parse_key(key_input)]


def _parse_hotkeys(key_input) -> list[tuple]:
    """支持单键、组合键、多个组合键。

    字符串：        "alt_l"                  -> [(alt_l,)]
    字符串列表：    ["alt_l", "space"]       -> [(alt_l, space)]
    二维字符串列表：[["alt_l"], ["alt_r"]]   -> [(alt_l,), (alt_r,)]
    """
    if isinstance(key_input, list):
        if key_input and all(isinstance(item, list) for item in key_input):
            return [tuple(_parse_key(k) for k in item) for item in key_input]
        return [tuple(_parse_key(k) for k in key_input)]
    return [( _parse_key(key_input), )]


def _hotkey_tokens(key_input) -> list[tuple[str, ...]]:
    if isinstance(key_input, list):
        if key_input and all(isinstance(item, list) for item in key_input):
            return [tuple(_normalized_key_name(k) for k in item if str(k).strip()) for item in key_input]
        return [tuple(_normalized_key_name(k) for k in key_input if str(k).strip())]
    return [(_normalized_key_name(key_input),)]


def _format_hotkey(hotkey: tuple) -> str:
    return "+".join(str(k) for k in hotkey)


_GENERIC_MODIFIER_ALIASES = {
    "alt": {"alt", "alt_l", "alt_r"},
    "ctrl": {"ctrl", "ctrl_l", "ctrl_r"},
    "shift": {"shift", "shift_l", "shift_r"},
    "cmd": {"cmd", "cmd_l", "cmd_r"},
}

_MODIFIER_TOKENS = {
    token
    for aliases in _GENERIC_MODIFIER_ALIASES.values()
    for token in aliases
}


def _key_token(key) -> str:
    if key in (kb.Key.alt, kb.Key.alt_l, kb.Key.alt_r):
        return "alt" if key == kb.Key.alt else ("alt_l" if key == kb.Key.alt_l else "alt_r")
    if key in (kb.Key.ctrl, kb.Key.ctrl_l, kb.Key.ctrl_r):
        return "ctrl" if key == kb.Key.ctrl else ("ctrl_l" if key == kb.Key.ctrl_l else "ctrl_r")
    if key in (kb.Key.shift, kb.Key.shift_r):
        return "shift" if key == kb.Key.shift else "shift_r"
    shift_l = getattr(kb.Key, "shift_l", None)
    if shift_l is not None and key == shift_l:
        return "shift_l"
    if key in (kb.Key.cmd, kb.Key.cmd_r):
        return "cmd" if key == kb.Key.cmd else "cmd_r"
    cmd_l = getattr(kb.Key, "cmd_l", None)
    if cmd_l is not None and key == cmd_l:
        return "cmd_l"
    if key == kb.Key.space:
        return "space"
    char = getattr(key, "char", None)
    if char:
        return str(char).lower()
    return str(key)


def _configured_token_matches_event(configured: str, event: str) -> bool:
    configured = str(configured or "").strip().lower()
    event = str(event or "").strip().lower()
    if not configured or not event:
        return False
    aliases = _GENERIC_MODIFIER_ALIASES.get(configured)
    if aliases is not None:
        return event in aliases
    return configured == event


def _modifier_aliases_for_token(token: str) -> set[str]:
    token = str(token or "").strip().lower()
    for aliases in _GENERIC_MODIFIER_ALIASES.values():
        if token in aliases:
            return aliases
    return {token} if token else set()


def _discard_token_aliases(tokens: set[str], token: str) -> None:
    aliases = _modifier_aliases_for_token(token)
    if aliases & _MODIFIER_TOKENS:
        tokens.difference_update(aliases)
        return
    tokens.discard(token)


def _key_matches(configured_key, event_key) -> bool:
    return _configured_token_matches_event(
        _key_token(configured_key),
        _key_token(event_key),
    )


def _token_in_configured_hotkey(token: str, hotkey_tokens: tuple[str, ...]) -> bool:
    return any(_configured_token_matches_event(configured, token) for configured in hotkey_tokens)


def _configured_hotkey_satisfied(
    hotkey_tokens: tuple[str, ...],
    pressed_tokens: set[str],
) -> bool:
    return all(
        any(_configured_token_matches_event(configured, pressed) for pressed in pressed_tokens)
        for configured in hotkey_tokens
    )


def _configured_hotkey_has_other_pressed_token(
    hotkey_tokens: tuple[str, ...],
    current_token: str,
    pressed_tokens: set[str],
) -> bool:
    for configured in hotkey_tokens:
        if _configured_token_matches_event(configured, current_token):
            continue
        if any(_configured_token_matches_event(configured, pressed) for pressed in pressed_tokens):
            return True
    return False


def _pcm_level(pcm: bytes) -> float:
    if not pcm:
        return 0.0
    try:
        samples = memoryview(pcm).cast("h")
    except (TypeError, ValueError):
        return 0.0
    if not samples:
        return 0.0
    step = max(1, len(samples) // 320)
    total = 0
    count = 0
    for idx in range(0, len(samples), step):
        sample = int(samples[idx])
        total += sample * sample
        count += 1
    if count == 0:
        return 0.0
    rms = (total / count) ** 0.5
    return max(0.0, min(1.0, rms / 12000.0))


def _win32_key_token(data) -> str:
    vk = int(data.vkCode)
    flags = int(data.flags)
    extended = bool(flags & 0x01)

    if vk == 0x12:  # VK_MENU
        return "alt_r" if extended else "alt_l"
    if vk == 0xA4:
        return "alt_l"
    if vk == 0xA5:
        return "alt_r"
    if vk == 0x11:  # VK_CONTROL
        return "ctrl_r" if extended else "ctrl_l"
    if vk == 0xA2:
        return "ctrl_l"
    if vk == 0xA3:
        return "ctrl_r"
    if vk == 0x10:  # VK_SHIFT，无法可靠区分时按左 Shift 处理
        return "shift_l"
    if vk == 0xA0:
        return "shift_l"
    if vk == 0xA1:
        return "shift_r"
    if vk == 0x5B:
        return "cmd_l"
    if vk == 0x5C:
        return "cmd_r"
    if vk == 0x20:
        return "space"
    if 0x30 <= vk <= 0x39 or 0x41 <= vk <= 0x5A:
        return chr(vk).lower()
    return ""


def _win32_alt_context_token(msg, data) -> str:
    """Return the Alt token implied by WM_SYS* events when the Alt key event was missed."""
    if msg not in {0x0104, 0x0105}:  # WM_SYSKEYDOWN / WM_SYSKEYUP
        return ""
    flags = int(data.flags)
    if not flags & 0x20:  # LLKHF_ALTDOWN
        return ""
    return "alt"


def _win32_async_key_down(vk: int) -> bool:
    if sys.platform != "win32":
        return False
    try:
        import ctypes

        return bool(ctypes.windll.user32.GetAsyncKeyState(vk) & 0x8000)
    except Exception:
        return False


def _win32_modifier_token_is_down(token: str) -> bool:
    normalized = _normalized_key_name(token)
    if normalized.startswith("alt"):
        return _win32_async_key_down(0x12)
    if normalized.startswith("ctrl"):
        return _win32_async_key_down(0x11)
    if normalized.startswith("shift"):
        return _win32_async_key_down(0x10)
    return False


class PushToTalk:
    def __init__(
        self,
        on_utterance:      Callable[..., None],
        on_edit_utterance: Optional[Callable[..., None]] = None,
        on_ai_utterance:   Optional[Callable[..., None]] = None,
        on_ai_key_down:    Optional[Callable[[], None]] = None,
        ptt_key:           str = "right_alt",
        edit_key:          str = "right_ctrl",
        ai_key:            str = "right_shift",
        device:            Optional[str] = "auto",
        status_window=None,
        kbd_monitor=None,
    ):
        self._on_utterance      = on_utterance
        self._on_edit_utterance = on_edit_utterance
        self._on_ai_utterance   = on_ai_utterance
        self._on_ai_key_down    = on_ai_key_down
        self._kbd_monitor       = kbd_monitor
        self._ptt_hotkeys       = _parse_hotkeys(ptt_key)
        self._edit_hotkeys      = _parse_hotkeys(edit_key) if on_edit_utterance else []
        self._ai_hotkeys        = _parse_hotkeys(ai_key)   if on_ai_utterance   else []
        self._reserved_hotkey_tokens = (
            _hotkey_tokens(ptt_key)
            + (_hotkey_tokens(edit_key) if on_edit_utterance else [])
            + (_hotkey_tokens(ai_key) if on_ai_utterance else [])
        )
        self._filter_pressed_tokens: set[str] = set()
        self._device_hint       = device
        self._status            = status_window
        self._device_idx        = None
        self._active_key        = None   # 当前正在录音用哪个键
        self._active_trigger    = None   # 触发本次录音的具体热键 tuple，用于 release 配对
        self._buf: list[bytes]  = []
        self._stream: Optional[sd.RawInputStream] = None
        self._listener: Optional[kb.Listener]     = None
        self._pressed_keys: set = set()
        self._pending_start     = None   # (mode, hotkey, timer)，用于组合键消歧
        self._chord_delay       = 0.18   # 左 Alt 单独按下后等待 Space 的时间
        self._chord_upgrade_window = 0.45  # Space 稍晚时，把刚启动的 PTT 升级成 AI
        self._recording_started_at = 0.0

        # 双击 PTT 切换微润色模式
        self._polish_mode             = False
        self._last_ptt_press_time     = 0.0
        self._last_ptt_tap_time       = 0.0
        self._double_tap_window       = 0.4   # 秒

        # 实时分句 VAD 状态（仅 dictate 模式使用）
        self._vad                            = None
        self._vad_raw: bytearray            = bytearray()
        self._vad_speech_frames: list[bytes] = []
        self._vad_in_speech                  = False
        self._vad_silent_count               = 0
        self._vad_sent_count                 = 0  # 本次按键已分句发出的数量
        self._last_level_update_at           = 0.0

    def start(self):
        self._device_idx = find_device(self._device_hint)
        if self._device_idx is None:
            print("[ptt] 使用系统默认麦克风")
        else:
            info = sd.query_devices(self._device_idx)
            print(f"[ptt] 使用麦克风: {info['name']}")

        if _webrtcvad is not None:
            self._vad = _webrtcvad.Vad(2)
            print("[ptt] 实时分句已启用（说话中停顿可提前输出）")
        else:
            print("[ptt] webrtcvad 未安装，实时分句不可用")

        listener_kwargs = {
            "on_press": self._on_press,
            "on_release": self._on_release,
        }
        if sys.platform == "win32":
            listener_kwargs["win32_event_filter"] = self._win32_event_filter
        self._listener = kb.Listener(**listener_kwargs)
        self._listener.start()

        hints = [f"{'/'.join(_format_hotkey(h) for h in self._ptt_hotkeys)} 说话（双击切换微润色）"]
        if self._edit_hotkeys:
            hints.append(f"{'/'.join(_format_hotkey(h) for h in self._edit_hotkeys)} 语音编辑")
        if self._ai_hotkeys:
            hints.append(f"{'/'.join(_format_hotkey(h) for h in self._ai_hotkeys)} AI编程")
        print(f"[ptt] 按住 {' | '.join(hints)}")

    def stop(self):
        self._cancel_pending_start()
        if self._listener:
            self._listener.stop()
        self._close_stream()

    def _set_status(self, state: str) -> None:
        if self._status is not None:
            self._status.set_state(state)

    def _mark_input_complete(self) -> None:
        self._set_status("idle")
        print("[typeup] 输入完成")

    def _set_audio_level(self, level: float) -> None:
        if self._status is not None and hasattr(self._status, "set_audio_level"):
            self._status.set_audio_level(level)

    def _publish_audio_level(self, data: bytes, is_speech: bool | None = None) -> None:
        if self._active_key is None:
            return
        now = time.monotonic()
        if (now - self._last_level_update_at) < _LEVEL_UPDATE_INTERVAL:
            return
        self._last_level_update_at = now
        level = _pcm_level(data)
        speaking = is_speech if is_speech is not None else level >= _SPEECH_LEVEL_THRESHOLD
        self._set_audio_level(level if speaking and level >= _SPEECH_LEVEL_THRESHOLD else 0.0)

    # ── 键盘事件 ─────────────────────────────────────────────────

    def _on_press(self, key):
        if _typer.is_simulating():
            return  # 程序自身发出的按键，忽略
        self._pressed_keys.add(key)
        # 顺手把退格/Delete/Enter 同步给 KeyboardMonitor，避免再开一个 CGEventTap
        if self._kbd_monitor is not None:
            try:
                self._kbd_monitor.process_press(key)
            except Exception:
                pass
        if self._active_key is not None:
            self._maybe_upgrade_dictate_to_combo()
            return  # 已有键按下，忽略另一个

        combo_match = self._matching_non_ptt_hotkey()
        if combo_match is not None:
            mode, hotkey = combo_match
            self._cancel_pending_start()
            self._start_mode(mode, hotkey)
            return

        ptt_hotkey = self._matching_hotkey(self._ptt_hotkeys)
        if ptt_hotkey is not None:
            if self._has_combo_extension(ptt_hotkey):
                self._schedule_pending_start("dictate", ptt_hotkey)
                return
            self._start_mode("dictate", ptt_hotkey)

    def _start_mode(self, mode: str, hotkey: tuple):
        if mode == "dictate":
            now = time.monotonic()
            if (now - self._last_ptt_press_time) < self._double_tap_window:
                # 双击：切换微润色模式，不开新录音
                self._toggle_polish_mode()
                self._last_ptt_press_time = 0.0
                return
            self._last_ptt_press_time = now

        if mode == "ai":
            if self._on_ai_key_down:
                self._on_ai_key_down()

        self._active_key     = mode
        self._active_trigger = hotkey
        self._recording_started_at = time.monotonic()
        self._start_recording()

    def _handle_ptt_tap(self):
        now = time.monotonic()
        if (now - self._last_ptt_tap_time) < self._double_tap_window:
            self._toggle_polish_mode()
            self._last_ptt_tap_time = 0.0
            self._last_ptt_press_time = 0.0
            return
        self._last_ptt_tap_time = now

    def _toggle_polish_mode(self):
        self._polish_mode = not self._polish_mode
        mode_name = "微润色" if self._polish_mode else "原文"
        print(f"[ptt] 切换为「{mode_name}」模式")
        if self._status is not None and hasattr(self._status, "show_message"):
            self._status.show_message(f"润色模式：{mode_name}", seconds=1.2)

    def _on_release(self, key):
        if _typer.is_simulating():
            return
        self._discard_pressed_key(key)

        if self._pending_start is not None:
            _mode, hotkey, _timer = self._pending_start
            if self._key_in_hotkey(key, hotkey):
                self._cancel_pending_start()
                if _mode == "dictate":
                    self._handle_ptt_tap()
                return

        if self._active_trigger is None or not self._key_in_hotkey(key, self._active_trigger):
            return
        if any(
            self._pressed_has_key(trigger_key)
            for trigger_key in self._active_trigger
        ):
            return
        if self._active_key == "dictate":
            self._stop_recording(mode="dictate")
        elif self._active_key == "edit":
            self._stop_recording(mode="edit")
        elif self._active_key == "ai":
            self._stop_recording(mode="ai")
        self._active_trigger = None

    def _matching_hotkey(self, hotkeys: list[tuple]) -> tuple | None:
        for hotkey in sorted(hotkeys, key=len, reverse=True):
            if all(self._pressed_has_key(k) for k in hotkey):
                return hotkey
        return None

    def _matching_non_ptt_hotkey(self):
        ai = self._matching_hotkey(self._ai_hotkeys)
        if ai is not None:
            return "ai", ai
        edit = self._matching_hotkey(self._edit_hotkeys)
        if edit is not None:
            return "edit", edit
        return None

    def _has_combo_extension(self, hotkey: tuple) -> bool:
        for candidate in self._ai_hotkeys + self._edit_hotkeys:
            if len(candidate) > len(hotkey) and all(
                any(_key_matches(candidate_key, base_key) for candidate_key in candidate)
                for base_key in hotkey
            ):
                return True
        return False

    def _pressed_has_key(self, configured_key) -> bool:
        return any(_key_matches(configured_key, pressed_key) for pressed_key in self._pressed_keys)

    def _key_in_hotkey(self, event_key, hotkey: tuple) -> bool:
        return any(_key_matches(configured_key, event_key) for configured_key in hotkey)

    def _discard_pressed_key(self, event_key) -> None:
        event_token = _key_token(event_key)
        aliases = _modifier_aliases_for_token(event_token)
        if aliases & _MODIFIER_TOKENS:
            self._pressed_keys = {
                pressed_key for pressed_key in self._pressed_keys
                if _key_token(pressed_key) not in aliases
            }
            return
        self._pressed_keys.discard(event_key)

    def _discard_pressed_token(self, token: str) -> None:
        self._discard_pressed_key(_parse_key(token))

    def _clear_stale_win32_modifiers(self) -> None:
        for token in ("alt", "ctrl", "shift"):
            if _win32_modifier_token_is_down(token):
                continue
            _discard_token_aliases(self._filter_pressed_tokens, token)
            self._discard_pressed_token(token)

    def _schedule_pending_start(self, mode: str, hotkey: tuple):
        self._cancel_pending_start()
        timer = threading.Timer(self._chord_delay, self._finish_pending_start)
        self._pending_start = (mode, hotkey, timer)
        timer.daemon = True
        timer.start()

    def _finish_pending_start(self):
        if self._pending_start is None or self._active_key is not None:
            return
        mode, hotkey, _timer = self._pending_start
        self._pending_start = None
        if not all(self._pressed_has_key(k) for k in hotkey):
            return
        combo_match = self._matching_non_ptt_hotkey()
        if combo_match is not None:
            combo_mode, combo_hotkey = combo_match
            self._start_mode(combo_mode, combo_hotkey)
            return
        self._start_mode(mode, hotkey)

    def _cancel_pending_start(self):
        if self._pending_start is None:
            return
        _mode, _hotkey, timer = self._pending_start
        timer.cancel()
        self._pending_start = None

    def _maybe_upgrade_dictate_to_combo(self):
        if (
            self._active_key != "dictate"
            or self._active_trigger is None
            or not self._has_combo_extension(self._active_trigger)
            or (time.monotonic() - self._recording_started_at) > self._chord_upgrade_window
        ):
            return
        combo_match = self._matching_non_ptt_hotkey()
        if combo_match is None:
            return
        mode, hotkey = combo_match
        if mode == "ai" and self._on_ai_key_down:
            self._on_ai_key_down()
        self._active_key = mode
        self._active_trigger = hotkey
        self._buf = []
        self._vad_raw           = bytearray()
        self._vad_speech_frames = []
        self._vad_in_speech     = False
        self._vad_silent_count  = 0
        self._vad_sent_count    = 0
        if mode == "ai":
            self._set_status("ai_recording")
            print("[ptt] 升级为 AI 指令录音... ", end="\r", flush=True)
        else:
            self._set_status("recording")
            print("[ptt] 升级为编辑指令录音... ", end="\r", flush=True)

    def _dictate_recording_state(self) -> str:
        return "polish_recording" if self._polish_mode else "recording"

    def _restore_recording_status_if_active(self) -> None:
        if self._active_key == "dictate":
            self._set_status(self._dictate_recording_state())

    def _run_mid_sentence_utterance(self, pcm: bytes, polish: bool) -> None:
        try:
            self._on_utterance(pcm, polish, False, False)
        finally:
            if self._active_key == "dictate":
                self._restore_recording_status_if_active()
            elif self._active_key is None:
                self._mark_input_complete()

    # ── Windows 系统级热键拦截 ─────────────────────────────────────

    def _win32_event_filter(self, msg, data):
        """让 TypeUp 自己的热键不再传给前台软件或其它全局快捷键。

        注意：pynput 的 suppress_event 会阻止后续 listener 回调，所以这里先手动
        分发给 TypeUp，再吞掉系统事件。
        """
        if _typer.is_simulating():
            return True

        token = _win32_key_token(data)
        if not token:
            return True

        is_press = msg in {0x0100, 0x0104}      # WM_KEYDOWN / WM_SYSKEYDOWN
        is_release = msg in {0x0101, 0x0105}    # WM_KEYUP / WM_SYSKEYUP
        if not is_press and not is_release:
            return True

        implied_alt_token = _win32_alt_context_token(msg, data)
        if is_press and not implied_alt_token:
            self._clear_stale_win32_modifiers()

        candidate = set(self._filter_pressed_tokens)
        if implied_alt_token and token != implied_alt_token:
            candidate.add(implied_alt_token)
        if is_press:
            candidate.add(token)

        suppress = self._should_suppress_token(token, candidate)

        if is_press:
            if implied_alt_token and token != implied_alt_token:
                self._filter_pressed_tokens.add(implied_alt_token)
                if suppress:
                    self._on_press(_parse_key(implied_alt_token))
            self._filter_pressed_tokens.add(token)
        else:
            _discard_token_aliases(self._filter_pressed_tokens, token)
            if implied_alt_token and token == implied_alt_token:
                _discard_token_aliases(self._filter_pressed_tokens, implied_alt_token)

        if not suppress:
            return True

        key = _parse_key(token)
        if is_press:
            self._on_press(key)
        else:
            self._on_release(key)
        self._listener.suppress_event()
        return False

    def _should_suppress_token(self, token: str, pressed_tokens: set[str]) -> bool:
        for hotkey in self._reserved_hotkey_tokens:
            if not _token_in_configured_hotkey(token, hotkey):
                continue
            if len(set(hotkey)) == 1:
                return True
            if token in _MODIFIER_TOKENS:
                return True
            if _configured_hotkey_satisfied(hotkey, pressed_tokens):
                return True
            if _configured_hotkey_has_other_pressed_token(hotkey, token, pressed_tokens):
                return True
        return False

    # ── 录音控制 ─────────────────────────────────────────────────

    def _audio_callback(self, indata, frames, time_info, status):
        data = bytes(indata)
        self._buf.append(data)
        if self._active_key == "dictate" and self._vad is not None:
            self._vad_raw.extend(data)
            self._process_vad()
        else:
            self._publish_audio_level(data)

    def _process_vad(self):
        """消费 _vad_raw 中所有完整的 30ms 帧，检测句子边界。"""
        while len(self._vad_raw) >= FRAME_BYTES:
            frame = bytes(self._vad_raw[:FRAME_BYTES])
            del self._vad_raw[:FRAME_BYTES]

            is_speech = self._vad.is_speech(frame, SAMPLE_RATE)
            self._publish_audio_level(frame, is_speech)

            if is_speech:
                self._vad_in_speech    = True
                self._vad_silent_count = 0
                self._vad_speech_frames.append(frame)
            elif self._vad_in_speech:
                self._vad_speech_frames.append(frame)
                self._vad_silent_count += 1
                if self._vad_silent_count >= SILENCE_FRAMES:
                    self._dispatch_mid_sentence()

    def _dispatch_mid_sentence(self):
        """把当前积累的语音帧作为一句话立刻发出去，重置 VAD 状态。"""
        if len(self._vad_speech_frames) >= MIN_SPEECH_FRAMES:
            pcm = b"".join(self._vad_speech_frames)
            self._vad_sent_count += 1
            n = self._vad_sent_count
            print(f"[ptt] 分句{n} 识别中...    ", end="\r", flush=True)
            threading.Thread(
                target=self._run_mid_sentence_utterance,
                args=(pcm, self._polish_mode),
                daemon=True,
                name=f"PTT-mid-{n}",
            ).start()
        self._vad_speech_frames = []
        self._vad_silent_count  = 0
        self._vad_in_speech     = False

    def _start_recording(self):
        self._buf = []
        self._vad_raw           = bytearray()
        self._vad_speech_frames = []
        self._vad_in_speech     = False
        self._vad_silent_count  = 0
        self._vad_sent_count    = 0
        self._set_audio_level(0.0)
        self._stream = sd.RawInputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="int16",
            device=self._device_idx,
            blocksize=1024,
            callback=self._audio_callback,
        )
        self._stream.start()
        if self._active_key == "dictate":
            if self._polish_mode:
                label = "微润色 录音中"
            else:
                label = "录音中"
            self._set_status(self._dictate_recording_state())
        elif self._active_key == "ai":
            label = "AI 指令录音中"
            self._set_status("ai_recording")
        else:
            label = "编辑指令录音中"
            self._set_status("recording")
        print(f"[ptt] {label}... ", end="\r", flush=True)

    def _stop_recording(self, mode: str):
        self._active_key = None
        self._set_audio_level(0.0)
        self._close_stream()

        if mode == "dictate" and self._vad is not None:
            self._process_vad()  # 处理流关闭前残留的音频字节

            # 松键时若仍在句子中间，把尾巴也发出去
            if self._vad_in_speech and len(self._vad_speech_frames) >= MIN_SPEECH_FRAMES:
                pcm = b"".join(self._vad_speech_frames)
                self._vad_sent_count += 1
                n = self._vad_sent_count
                print(f"[ptt] 分句{n} 识别中...    ", end="\r", flush=True)
                self._set_status("recognizing")
                threading.Thread(
                    target=self._on_utterance,
                    args=(pcm, self._polish_mode),
                    daemon=True,
                    name=f"PTT-mid-{n}",
                ).start()
            elif self._vad_sent_count == 0:
                # 全程未检测到任何句子（录音极短或全静音），回退到原有整段发送逻辑
                pcm = b"".join(self._buf)
                if len(pcm) < SAMPLE_RATE * 2 * 0.3:
                    print("[ptt] 录音太短，跳过    ")
                    self._set_status("idle")
                else:
                    print("[ptt] 识别中...    ", end="\r", flush=True)
                    self._set_status("recognizing")
                    threading.Thread(
                        target=self._on_utterance,
                        args=(pcm, self._polish_mode),
                        daemon=True,
                        name="PTT-dictate",
                    ).start()
            else:
                self._mark_input_complete()
            self._buf = []
            return

        # dictate / edit / ai 模式（VAD 不可用时 dictate 也走这里）
        pcm = b"".join(self._buf)
        self._buf = []

        if len(pcm) < SAMPLE_RATE * 2 * 0.3:
            print("[ptt] 录音太短，跳过    ")
            self._set_status("idle")
            return

        if mode == "dictate":
            label    = "识别中"
            callback = self._on_utterance
            args     = (pcm, self._polish_mode)
            self._set_status("recognizing")
        elif mode == "edit":
            label    = "解析编辑指令"
            callback = self._on_edit_utterance
            args     = (pcm,)
            self._set_status("recognizing")
        else:
            if self._on_ai_key_down:
                self._on_ai_key_down()
            label    = "解析AI指令"
            callback = self._on_ai_utterance
            args     = (pcm,)
            self._set_status("ai_processing")
        print(f"[ptt] {label}...    ", end="\r", flush=True)
        threading.Thread(
            target=callback,
            args=args,
            daemon=True,
            name=f"PTT-{mode}",
        ).start()

    def _close_stream(self):
        if self._stream:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None
