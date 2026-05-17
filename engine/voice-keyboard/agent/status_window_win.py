"""Windows floating status HUD implemented with Win32 APIs via ctypes."""

from __future__ import annotations

import ctypes
import math
import queue
import threading
from ctypes import wintypes


# COLORREF uses 0x00bbggrr.
_STATES: dict[str, tuple[str, str, int]] = {
    "recording": ("正在聆听", "松开 ALT 后开始转写", 0xB19F0F),
    "polish_recording": ("正在聆听 · 微润色", "松开 ALT 后输入润色结果", 0x6B8A1B),
    "ai_recording": ("AI 编辑中", "按住 ALT + SPACE 处理当前文字", 0xD65676),
    "recognizing": ("正在转写", "正在整理语句并准备输入", 0xD65724),
    "empty_stt": ("未识别到语句", "请靠近麦克风后重试", 0x225DB8),
    "polishing": ("润色中", "正在优化表达", 0xB19F0F),
    "ai_processing": ("AI 处理中", "正在编辑当前文字", 0xD65676),
    "error_stt": ("识别失败", "请检查网络或 STT 配置", 0x4531D4),
    "error_typing": ("输入失败", "请确认当前窗口允许输入", 0x4531D4),
    "error_llm": ("AI 处理失败", "请检查 LLM 配置", 0x4531D4),
    "error_perm": ("权限未授予", "请允许键盘和麦克风访问", 0x4531D4),
}

_ERROR_STATES = {"error_stt", "error_typing", "error_llm", "error_perm", "empty_stt"}
_WM_APP_STATE = 0x8001
_WM_APP_STOP = 0x8002
_WM_APP_MESSAGE = 0x8003
_WM_APP_AUDIO_LEVEL = 0x8004
_WM_ERASEBKGND = 0x0014
_TIMER_POLL = 1
_TIMER_HIDE = 2
_SPI_GETWORKAREA = 0x0030
_HWND_TOPMOST = wintypes.HWND(-1)
_SWP_NOACTIVATE = 0x0010
_SRCCOPY = 0x00CC0020
_ULW_ALPHA = 0x00000002
_AC_SRC_OVER = 0
_AC_SRC_ALPHA = 1
_BOTTOM_MARGIN = 18
_CORNER_RADIUS = 30
_WINDOW_ALPHA = 246

_DT_SINGLELINE = 0x00000020
_DT_VCENTER = 0x00000004
_DT_END_ELLIPSIS = 0x00008000
_TRANSPARENT = 1
_PS_SOLID = 0

_BG = 0xFFFFFF
_TEXT = 0x332010
_MUTED = 0x8F7866
_CLASS_BG = 0xFFFFFF

_user32 = ctypes.windll.user32
_gdi32 = ctypes.windll.gdi32
_kernel32 = ctypes.windll.kernel32

HICON = getattr(wintypes, "HICON", wintypes.HANDLE)
HCURSOR = getattr(wintypes, "HCURSOR", wintypes.HANDLE)
HBRUSH = getattr(wintypes, "HBRUSH", wintypes.HANDLE)
HBITMAP = getattr(wintypes, "HBITMAP", wintypes.HANDLE)
HRGN = getattr(wintypes, "HRGN", wintypes.HANDLE)
ATOM = getattr(wintypes, "ATOM", ctypes.c_ushort)

_user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
_user32.DefWindowProcW.restype = ctypes.c_ssize_t
_user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
_user32.PostMessageW.restype = wintypes.BOOL
_user32.SetWindowPos.argtypes = [
    wintypes.HWND,
    wintypes.HWND,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    wintypes.UINT,
]
_user32.SetWindowPos.restype = wintypes.BOOL
_user32.SystemParametersInfoW.argtypes = [wintypes.UINT, wintypes.UINT, ctypes.c_void_p, wintypes.UINT]
_user32.SystemParametersInfoW.restype = wintypes.BOOL
_user32.SetWindowRgn.argtypes = [wintypes.HWND, HRGN, wintypes.BOOL]
_user32.SetWindowRgn.restype = ctypes.c_int
_user32.SetLayeredWindowAttributes.argtypes = [wintypes.HWND, ctypes.c_uint, ctypes.c_ubyte, wintypes.DWORD]
_user32.SetLayeredWindowAttributes.restype = wintypes.BOOL
_user32.FillRect.argtypes = [wintypes.HDC, ctypes.c_void_p, HBRUSH]
_user32.FillRect.restype = ctypes.c_int
_user32.DrawTextW.argtypes = [wintypes.HDC, wintypes.LPCWSTR, ctypes.c_int, ctypes.c_void_p, wintypes.UINT]
_user32.DrawTextW.restype = ctypes.c_int
_user32.CreateWindowExW.restype = wintypes.HWND

_gdi32.CreateRoundRectRgn.argtypes = [
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
]
_gdi32.CreateRoundRectRgn.restype = HRGN
_gdi32.CreateSolidBrush.argtypes = [ctypes.c_uint]
_gdi32.CreateSolidBrush.restype = HBRUSH
_gdi32.CreatePen.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_uint]
_gdi32.CreatePen.restype = wintypes.HANDLE
_gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
_gdi32.CreateCompatibleDC.restype = wintypes.HDC
_gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, ctypes.c_int, ctypes.c_int]
_gdi32.CreateCompatibleBitmap.restype = HBITMAP
_gdi32.CreateDIBSection.restype = HBITMAP
_gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HANDLE]
_gdi32.SelectObject.restype = wintypes.HANDLE
_gdi32.BitBlt.argtypes = [
    wintypes.HDC,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    wintypes.HDC,
    ctypes.c_int,
    ctypes.c_int,
    wintypes.DWORD,
]
_gdi32.BitBlt.restype = wintypes.BOOL
_gdi32.DeleteDC.argtypes = [wintypes.HDC]
_gdi32.DeleteDC.restype = wintypes.BOOL
_gdi32.DeleteObject.argtypes = [wintypes.HANDLE]
_gdi32.DeleteObject.restype = wintypes.BOOL
_gdi32.SetBkMode.argtypes = [wintypes.HDC, ctypes.c_int]
_gdi32.SetBkMode.restype = ctypes.c_int
_gdi32.SetTextColor.argtypes = [wintypes.HDC, ctypes.c_uint]
_gdi32.SetTextColor.restype = ctypes.c_uint
_gdi32.GetTextExtentPoint32W.argtypes = [wintypes.HDC, wintypes.LPCWSTR, ctypes.c_int, ctypes.c_void_p]
_gdi32.GetTextExtentPoint32W.restype = wintypes.BOOL
_gdi32.Ellipse.argtypes = [
    wintypes.HDC,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
]
_gdi32.Ellipse.restype = wintypes.BOOL
_gdi32.RoundRect.argtypes = [
    wintypes.HDC,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
]
_gdi32.RoundRect.restype = wintypes.BOOL
_gdi32.CreateFontW.restype = wintypes.HANDLE


class WNDCLASS(ctypes.Structure):
    _fields_ = [
        ("style", wintypes.UINT),
        ("lpfnWndProc", ctypes.c_void_p),
        ("cbClsExtra", ctypes.c_int),
        ("cbWndExtra", ctypes.c_int),
        ("hInstance", wintypes.HINSTANCE),
        ("hIcon", HICON),
        ("hCursor", HCURSOR),
        ("hbrBackground", HBRUSH),
        ("lpszMenuName", wintypes.LPCWSTR),
        ("lpszClassName", wintypes.LPCWSTR),
    ]


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


class PAINTSTRUCT(ctypes.Structure):
    _fields_ = [
        ("hdc", wintypes.HDC),
        ("fErase", wintypes.BOOL),
        ("rcPaint", RECT),
        ("fRestore", wintypes.BOOL),
        ("fIncUpdate", wintypes.BOOL),
        ("rgbReserved", ctypes.c_byte * 32),
    ]


class SIZE(ctypes.Structure):
    _fields_ = [("cx", ctypes.c_long), ("cy", ctypes.c_long)]


class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


class BLENDFUNCTION(ctypes.Structure):
    _fields_ = [
        ("BlendOp", ctypes.c_ubyte),
        ("BlendFlags", ctypes.c_ubyte),
        ("SourceConstantAlpha", ctypes.c_ubyte),
        ("AlphaFormat", ctypes.c_ubyte),
    ]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", ctypes.c_long),
        ("biHeight", ctypes.c_long),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", ctypes.c_long),
        ("biYPelsPerMeter", ctypes.c_long),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


class BITMAPINFO(ctypes.Structure):
    _fields_ = [
        ("bmiHeader", BITMAPINFOHEADER),
        ("bmiColors", wintypes.DWORD * 1),
    ]


_user32.InvalidateRect.argtypes = [wintypes.HWND, ctypes.POINTER(RECT), wintypes.BOOL]
_user32.InvalidateRect.restype = wintypes.BOOL
_user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(RECT)]
_user32.GetWindowRect.restype = wintypes.BOOL
_user32.UpdateLayeredWindow.argtypes = [
    wintypes.HWND,
    wintypes.HDC,
    ctypes.POINTER(POINT),
    ctypes.POINTER(SIZE),
    wintypes.HDC,
    ctypes.POINTER(POINT),
    ctypes.c_uint,
    ctypes.POINTER(BLENDFUNCTION),
    wintypes.DWORD,
]
_user32.UpdateLayeredWindow.restype = wintypes.BOOL
_gdi32.CreateDIBSection.argtypes = [
    wintypes.HDC,
    ctypes.POINTER(BITMAPINFO),
    wintypes.UINT,
    ctypes.POINTER(ctypes.c_void_p),
    wintypes.HANDLE,
    wintypes.DWORD,
]


_RECORDING_STATES = {"recording", "polish_recording", "ai_recording"}


def _clamp_level(level: float) -> float:
    return max(0.0, min(1.0, float(level or 0.0)))


def _smooth_audio_level(current: float, target: float) -> float:
    current = _clamp_level(current)
    target = _clamp_level(target)
    if target <= 0.0:
        faded = current * 0.68
        return 0.0 if faded < 0.018 else faded
    if target >= current:
        return current * 0.35 + target * 0.65
    return current * 0.78 + target * 0.22


def _rgb_parts(colorref: int) -> tuple[int, int, int]:
    return colorref & 0xFF, (colorref >> 8) & 0xFF, (colorref >> 16) & 0xFF


def _premultiply(value: int, alpha: int) -> int:
    return int((max(0, min(255, value)) * max(0, min(255, alpha)) + 127) / 255)


WNDPROC = ctypes.WINFUNCTYPE(
    ctypes.c_ssize_t,
    wintypes.HWND,
    wintypes.UINT,
    wintypes.WPARAM,
    wintypes.LPARAM,
)

_user32.RegisterClassW.argtypes = [ctypes.POINTER(WNDCLASS)]
_user32.RegisterClassW.restype = ATOM
_user32.GetDC.argtypes = [wintypes.HWND]
_user32.GetDC.restype = wintypes.HDC
_user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
_user32.ReleaseDC.restype = ctypes.c_int
_user32.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(RECT)]
_user32.GetClientRect.restype = wintypes.BOOL
_user32.BeginPaint.argtypes = [wintypes.HWND, ctypes.POINTER(PAINTSTRUCT)]
_user32.BeginPaint.restype = wintypes.HDC
_user32.EndPaint.argtypes = [wintypes.HWND, ctypes.POINTER(PAINTSTRUCT)]
_user32.EndPaint.restype = wintypes.BOOL
_user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]
_user32.GetMessageW.restype = ctypes.c_int


class StatusWindow:
    def __init__(self):
        self._q = queue.Queue()
        self._extra_setup = []
        self._hwnd = None
        self._state = "idle"
        self._text = ""
        self._subtext = ""
        self._color = 0xB19F0F
        self._audio_level = 0.0
        self._audio_phase = 0
        self._message_token = 0
        self._width_text = ""
        self._visible = False
        self._window_size: tuple[int, int] | None = None
        self._use_per_pixel_alpha = True
        self._fallback_alpha_applied = False
        self._alpha_mask_cache: dict[tuple[int, int], bytes] = {}
        self._wndproc = WNDPROC(self._handle_message)
        self._hinst = _kernel32.GetModuleHandleW(None)
        self._class_name = "VoiceKeyboardStatusWindow"

    def set_state(self, state: str) -> None:
        self._q.put(("state", state))
        if self._hwnd:
            _user32.PostMessageW(self._hwnd, _WM_APP_STATE, 0, 0)

    def set_audio_level(self, level: float) -> None:
        self._q.put(("audio_level", max(0.0, min(1.0, float(level or 0.0)))))
        if self._hwnd:
            _user32.PostMessageW(self._hwnd, _WM_APP_AUDIO_LEVEL, 0, 0)

    def show_message(self, text: str, seconds: float = 6.0) -> None:
        self._message_token += 1
        token = self._message_token
        self._q.put(("message", text, token))
        if self._hwnd:
            _user32.PostMessageW(self._hwnd, _WM_APP_MESSAGE, 0, 0)
        timer = threading.Timer(seconds, self._hide_message, args=(token,))
        timer.daemon = True
        timer.start()

    def show_typing_message(self, text: str, seconds: float = 6.0, interval: float = 0.018) -> None:
        self._message_token += 1
        token = self._message_token
        interval = max(0.018, float(interval or 0.018))

        def run() -> None:
            step = max(1, len(text) // 36)
            for idx in range(step, len(text) + step, step):
                if token != self._message_token:
                    return
                self._q.put(("message", text[:idx], token, text))
                if self._hwnd:
                    _user32.PostMessageW(self._hwnd, _WM_APP_MESSAGE, 0, 0)
                threading.Event().wait(interval)
            timer = threading.Timer(seconds, self._hide_message, args=(token,))
            timer.daemon = True
            timer.start()

        threading.Thread(target=run, daemon=True, name="StatusTypingMessage").start()

    def _hide_message(self, token: int) -> None:
        self._q.put(("hide_message", token))
        if self._hwnd:
            _user32.PostMessageW(self._hwnd, _WM_APP_MESSAGE, 0, 0)

    def add_main_thread_setup(self, fn) -> None:
        self._extra_setup.append(fn)

    def stop(self) -> None:
        if self._hwnd:
            _user32.PostMessageW(self._hwnd, _WM_APP_STOP, 0, 0)

    def run(self) -> None:
        self._register_class()
        ex_style = 0x00000008 | 0x00000080 | 0x00080000 | 0x00000020
        style = 0x80000000
        self._hwnd = _user32.CreateWindowExW(
            ex_style,
            self._class_name,
            "TypeUp Status",
            style,
            0,
            0,
            380,
            58,
            None,
            None,
            self._hinst,
            None,
        )
        if not self._hwnd:
            raise ctypes.WinError()

        _user32.SetTimer(self._hwnd, _TIMER_POLL, 40, None)

        for fn in self._extra_setup:
            try:
                fn()
            except Exception as e:
                print(f"[status] 主线程初始化失败: {e}")

        msg = wintypes.MSG()
        while _user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
            _user32.TranslateMessage(ctypes.byref(msg))
            _user32.DispatchMessageW(ctypes.byref(msg))

    def _register_class(self) -> None:
        wc = WNDCLASS()
        wc.lpfnWndProc = ctypes.cast(self._wndproc, ctypes.c_void_p).value
        wc.hInstance = self._hinst
        wc.lpszClassName = self._class_name
        wc.hbrBackground = _gdi32.CreateSolidBrush(_CLASS_BG)
        _user32.RegisterClassW(ctypes.byref(wc))

    def _handle_message(self, hwnd, msg, wparam, lparam):
        if msg == 0x000F:
            self._paint(hwnd)
            return 0
        if msg == _WM_ERASEBKGND:
            return 1
        if msg == 0x0113:
            if wparam == _TIMER_POLL:
                self._poll()
            elif wparam == _TIMER_HIDE:
                _user32.KillTimer(hwnd, _TIMER_HIDE)
                self._visible = False
                _user32.ShowWindow(hwnd, 0)
            return 0
        if msg == _WM_APP_STATE:
            self._poll()
            return 0
        if msg == _WM_APP_MESSAGE:
            self._poll()
            return 0
        if msg == _WM_APP_AUDIO_LEVEL:
            self._poll()
            return 0
        if msg == _WM_APP_STOP:
            _user32.DestroyWindow(hwnd)
            return 0
        if msg == 0x0002:
            _user32.PostQuitMessage(0)
            return 0
        return _user32.DefWindowProcW(hwnd, msg, wparam, lparam)

    def _poll(self) -> None:
        try:
            while True:
                item = self._q.get_nowait()
                if isinstance(item, tuple) and item and item[0] == "message":
                    _, text, token, *rest = item
                    width_text = rest[0] if rest else text
                    self._apply_message(text, token, width_text)
                elif isinstance(item, tuple) and item and item[0] == "audio_level":
                    _, level = item
                    self._apply_audio_level(float(level))
                elif isinstance(item, tuple) and item and item[0] == "hide_message":
                    _, token = item
                    self._hide_message_now(token)
                else:
                    state = item[1] if isinstance(item, tuple) else item
                    self._apply(state)
        except queue.Empty:
            pass

    def _apply(self, state: str) -> None:
        if not self._hwnd:
            return
        info = _STATES.get(state)
        if info is None or state == "idle":
            self._state = "idle"
            self._width_text = ""
            self._audio_level = 0.0
            self._visible = False
            _user32.ShowWindow(self._hwnd, 0)
            return
        same_visual = (
            self._visible
            and self._state == state
            and self._text == info[0]
            and self._subtext == info[1]
            and self._color == info[2]
        )
        self._state = state
        self._width_text = ""
        self._text, self._subtext, self._color = info
        if state not in _RECORDING_STATES:
            self._audio_level = 0.0
        _user32.KillTimer(self._hwnd, _TIMER_HIDE)
        if not same_visual:
            self._position()
            _user32.ShowWindow(self._hwnd, 8)
            self._visible = True
            self._invalidate()
        if state in _ERROR_STATES:
            _user32.SetTimer(self._hwnd, _TIMER_HIDE, 1700, None)

    def _apply_message(self, text: str, token: int, width_text: str | None = None) -> None:
        if not self._hwnd or token != self._message_token:
            return
        self._state = "message"
        self._text = text
        self._subtext = ""
        self._width_text = width_text or text
        self._color = 0xB19F0F
        self._audio_level = 0.0
        _user32.KillTimer(self._hwnd, _TIMER_HIDE)
        self._position()
        _user32.ShowWindow(self._hwnd, 8)
        self._visible = True
        self._invalidate()

    def _hide_message_now(self, token: int) -> None:
        if not self._hwnd or token != self._message_token or self._state != "message":
            return
        self._state = "idle"
        self._width_text = ""
        self._audio_level = 0.0
        self._visible = False
        _user32.ShowWindow(self._hwnd, 0)

    def _apply_audio_level(self, level: float) -> None:
        if self._state not in _RECORDING_STATES:
            return
        self._audio_level = _smooth_audio_level(self._audio_level, level)
        self._audio_phase = (self._audio_phase + 1) % 5
        if self._hwnd:
            self._invalidate()

    def _invalidate(self) -> None:
        if not self._hwnd:
            return
        if self._use_per_pixel_alpha and self._visible:
            try:
                if self._update_layered_window():
                    return
            except Exception as e:
                print(f"[status] 平滑圆角绘制回退: {e}")
            self._use_per_pixel_alpha = False
            self._window_size = None
        if not self._fallback_alpha_applied:
            _user32.SetLayeredWindowAttributes(self._hwnd, 0, _WINDOW_ALPHA, 0x00000002)
            self._fallback_alpha_applied = True
        _user32.InvalidateRect(self._hwnd, None, False)

    def _position(self) -> None:
        hdc = _user32.GetDC(self._hwnd)
        measure_text = self._width_text or self._text
        title_width = self._measure_text(hdc, measure_text, -15, 700)
        sub_width = self._measure_text(hdc, self._subtext, -12, 500)
        _user32.ReleaseDC(self._hwnd, hdc)

        width = max(380, min(760, max(title_width, sub_width) + 154))
        height = 58
        work = RECT()
        if _user32.SystemParametersInfoW(_SPI_GETWORKAREA, 0, ctypes.byref(work), 0):
            x = int(work.left + ((work.right - work.left - width) / 2))
            y = int(work.bottom - height - _BOTTOM_MARGIN)
        else:
            screen_w = _user32.GetSystemMetrics(0)
            screen_h = _user32.GetSystemMetrics(1)
            x = int((screen_w - width) / 2)
            y = int(screen_h - height - _BOTTOM_MARGIN)
        if not _user32.SetWindowPos(self._hwnd, _HWND_TOPMOST, x, y, width, height, _SWP_NOACTIVATE):
            raise ctypes.WinError()
        if not self._use_per_pixel_alpha and self._window_size != (width, height):
            region = _gdi32.CreateRoundRectRgn(0, 0, width + 1, height + 1, _CORNER_RADIUS, _CORNER_RADIUS)
            if region:
                _user32.SetWindowRgn(self._hwnd, region, False)
                self._window_size = (width, height)
        else:
            self._window_size = (width, height)

    def _measure_text(self, hdc, text: str, size: int, weight: int) -> int:
        if not text:
            return 0
        font = self._font(size=size, weight=weight)
        old_font = _gdi32.SelectObject(hdc, font)
        measured = SIZE()
        _gdi32.GetTextExtentPoint32W(hdc, text, len(text), ctypes.byref(measured))
        _gdi32.SelectObject(hdc, old_font)
        _gdi32.DeleteObject(font)
        return int(measured.cx)

    def _paint(self, hwnd) -> None:
        ps = PAINTSTRUCT()
        hdc = _user32.BeginPaint(hwnd, ctypes.byref(ps))
        if self._use_per_pixel_alpha:
            _user32.EndPaint(hwnd, ctypes.byref(ps))
            return
        rect = RECT()
        _user32.GetClientRect(hwnd, ctypes.byref(rect))
        width = max(1, int(rect.right - rect.left))
        height = max(1, int(rect.bottom - rect.top))

        memdc = _gdi32.CreateCompatibleDC(hdc)
        bitmap = _gdi32.CreateCompatibleBitmap(hdc, width, height) if memdc else None
        if memdc and bitmap:
            old_bitmap = _gdi32.SelectObject(memdc, bitmap)
            self._paint_content(memdc, rect)
            _gdi32.BitBlt(hdc, 0, 0, width, height, memdc, 0, 0, _SRCCOPY)
            _gdi32.SelectObject(memdc, old_bitmap)
            _gdi32.DeleteObject(bitmap)
            _gdi32.DeleteDC(memdc)
        else:
            self._paint_content(hdc, rect)

        _user32.EndPaint(hwnd, ctypes.byref(ps))

    def _update_layered_window(self) -> bool:
        if not self._hwnd:
            return False

        window_rect = RECT()
        if not _user32.GetWindowRect(self._hwnd, ctypes.byref(window_rect)):
            return False
        width = max(1, int(window_rect.right - window_rect.left))
        height = max(1, int(window_rect.bottom - window_rect.top))

        screen_dc = _user32.GetDC(None)
        if not screen_dc:
            return False
        memdc = _gdi32.CreateCompatibleDC(screen_dc)
        bits = ctypes.c_void_p()
        bitmap = self._create_argb_bitmap(screen_dc, width, height, bits)
        if not memdc or not bitmap or not bits.value:
            if bitmap:
                _gdi32.DeleteObject(bitmap)
            if memdc:
                _gdi32.DeleteDC(memdc)
            _user32.ReleaseDC(None, screen_dc)
            return False

        old_bitmap = _gdi32.SelectObject(memdc, bitmap)
        try:
            self._fill_rounded_background(bits, width, height)
            self._paint_text(memdc, RECT(0, 0, width, height))
            self._paint_accent(memdc, RECT(0, 0, width, height))
            self._apply_alpha_mask_and_premultiply(bits, width, height)

            destination = POINT(window_rect.left, window_rect.top)
            source = POINT(0, 0)
            size = SIZE(width, height)
            blend = BLENDFUNCTION(_AC_SRC_OVER, 0, 255, _AC_SRC_ALPHA)
            return bool(_user32.UpdateLayeredWindow(
                self._hwnd,
                screen_dc,
                ctypes.byref(destination),
                ctypes.byref(size),
                memdc,
                ctypes.byref(source),
                0,
                ctypes.byref(blend),
                _ULW_ALPHA,
            ))
        finally:
            _gdi32.SelectObject(memdc, old_bitmap)
            _gdi32.DeleteObject(bitmap)
            _gdi32.DeleteDC(memdc)
            _user32.ReleaseDC(None, screen_dc)

    def _create_argb_bitmap(self, hdc, width: int, height: int, bits) -> HBITMAP:
        info = BITMAPINFO()
        info.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        info.bmiHeader.biWidth = width
        info.bmiHeader.biHeight = -height
        info.bmiHeader.biPlanes = 1
        info.bmiHeader.biBitCount = 32
        info.bmiHeader.biCompression = 0
        return _gdi32.CreateDIBSection(hdc, ctypes.byref(info), 0, ctypes.byref(bits), None, 0)

    def _fill_rounded_background(self, bits, width: int, height: int) -> None:
        red, green, blue = _rgb_parts(_BG)
        buffer_type = ctypes.c_ubyte * (width * height * 4)
        pixels = buffer_type.from_address(bits.value)
        mask = self._rounded_alpha_mask(width, height)
        idx = 0
        for alpha in mask:
            pixels[idx] = blue
            pixels[idx + 1] = green
            pixels[idx + 2] = red
            pixels[idx + 3] = alpha
            idx += 4

    def _apply_alpha_mask_and_premultiply(self, bits, width: int, height: int) -> None:
        buffer_type = ctypes.c_ubyte * (width * height * 4)
        pixels = buffer_type.from_address(bits.value)
        mask = self._rounded_alpha_mask(width, height)
        idx = 0
        for alpha in mask:
            pixels[idx] = _premultiply(pixels[idx], alpha)
            pixels[idx + 1] = _premultiply(pixels[idx + 1], alpha)
            pixels[idx + 2] = _premultiply(pixels[idx + 2], alpha)
            pixels[idx + 3] = alpha
            idx += 4

    def _rounded_alpha_mask(self, width: int, height: int) -> bytes:
        key = (width, height)
        cached = self._alpha_mask_cache.get(key)
        if cached is not None:
            return cached

        radius = max(1.0, _CORNER_RADIUS / 2.0)
        sample_count = 4
        step = 1.0 / sample_count
        mask = bytearray(width * height)
        pos = 0
        for y in range(height):
            for x in range(width):
                inside = 0
                for sy in range(sample_count):
                    py = y + (sy + 0.5) * step
                    for sx in range(sample_count):
                        px = x + (sx + 0.5) * step
                        if self._point_inside_round_rect(px, py, width, height, radius):
                            inside += 1
                mask[pos] = int(_WINDOW_ALPHA * inside / (sample_count * sample_count))
                pos += 1
        result = bytes(mask)
        if len(self._alpha_mask_cache) > 8:
            self._alpha_mask_cache.clear()
        self._alpha_mask_cache[key] = result
        return result

    @staticmethod
    def _point_inside_round_rect(x: float, y: float, width: int, height: int, radius: float) -> bool:
        if radius <= x <= width - radius:
            return 0 <= y <= height
        if radius <= y <= height - radius:
            return 0 <= x <= width
        cx = radius if x < radius else width - radius
        cy = radius if y < radius else height - radius
        return math.hypot(x - cx, y - cy) <= radius

    def _paint_content(self, hdc, rect: RECT) -> None:
        bg = _gdi32.CreateSolidBrush(_BG)
        _user32.FillRect(hdc, ctypes.byref(rect), bg)
        _gdi32.DeleteObject(bg)

        self._paint_accent(hdc, rect)
        self._paint_text(hdc, rect)

    def _paint_accent(self, hdc, rect: RECT) -> None:
        brush = _gdi32.CreateSolidBrush(self._color)
        pen = _gdi32.CreatePen(_PS_SOLID, 1, self._color)
        old_brush = _gdi32.SelectObject(hdc, brush)
        old_pen = _gdi32.SelectObject(hdc, pen)

        _gdi32.Ellipse(hdc, 18, 22, 32, 36)

        center = int((rect.bottom - rect.top) / 2)
        start_x = max(290, rect.right - 84)
        for idx, bar_h in enumerate(self._voice_bar_heights()):
            x = start_x + idx * 12
            y1 = center - int(bar_h / 2)
            y2 = center + int(bar_h / 2)
            _gdi32.RoundRect(hdc, x, y1, x + 5, y2, 5, 5)

        _gdi32.SelectObject(hdc, old_pen)
        _gdi32.SelectObject(hdc, old_brush)
        _gdi32.DeleteObject(pen)
        _gdi32.DeleteObject(brush)

    def _voice_bar_heights(self) -> tuple[int, int, int, int, int]:
        if self._state not in {"recording", "polish_recording", "ai_recording"} or self._audio_level <= 0.0:
            return (12, 22, 32, 20, 14)
        weights = (0.42, 0.72, 1.0, 0.78, 0.52)
        phase_boosts = (0.0, 0.16, 0.32, 0.16, 0.0)
        heights = []
        for idx, weight in enumerate(weights):
            phase = phase_boosts[(idx + self._audio_phase) % len(phase_boosts)]
            dynamic = self._audio_level * (weight + phase)
            heights.append(max(8, min(38, int(8 + dynamic * 32))))
        return tuple(heights)

    def _paint_text(self, hdc, rect: RECT) -> None:
        _gdi32.SetBkMode(hdc, _TRANSPARENT)

        title_font = self._font(size=-15, weight=700)
        old_font = _gdi32.SelectObject(hdc, title_font)
        _gdi32.SetTextColor(hdc, _TEXT)
        if self._subtext:
            title_rect = RECT(44, 9, rect.right - 104, 31)
            title_flags = _DT_SINGLELINE | _DT_END_ELLIPSIS
        else:
            title_rect = RECT(44, 0, rect.right - 104, rect.bottom)
            title_flags = _DT_SINGLELINE | _DT_VCENTER | _DT_END_ELLIPSIS
        _user32.DrawTextW(hdc, self._text, -1, ctypes.byref(title_rect), title_flags)
        _gdi32.SelectObject(hdc, old_font)
        _gdi32.DeleteObject(title_font)

        if self._subtext:
            sub_font = self._font(size=-12, weight=500)
            old_font = _gdi32.SelectObject(hdc, sub_font)
            _gdi32.SetTextColor(hdc, _MUTED)
            sub_rect = RECT(44, 31, rect.right - 104, 50)
            _user32.DrawTextW(hdc, self._subtext, -1, ctypes.byref(sub_rect), _DT_SINGLELINE | _DT_END_ELLIPSIS)
            _gdi32.SelectObject(hdc, old_font)
            _gdi32.DeleteObject(sub_font)

    def _font(self, size: int = -15, weight: int = 600):
        return _gdi32.CreateFontW(
            size,
            0,
            0,
            0,
            weight,
            0,
            0,
            0,
            1,
            0,
            0,
            0,
            0,
            "Microsoft YaHei UI",
        )
