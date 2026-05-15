"""Windows floating status HUD implemented with Win32 APIs via ctypes."""

from __future__ import annotations

import ctypes
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
_TIMER_POLL = 1
_TIMER_HIDE = 2
_SPI_GETWORKAREA = 0x0030
_HWND_TOPMOST = wintypes.HWND(-1)
_SWP_NOACTIVATE = 0x0010
_BOTTOM_MARGIN = 18
_CORNER_RADIUS = 30

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
_gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HANDLE]
_gdi32.SelectObject.restype = wintypes.HANDLE
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
        self._message_token = 0
        self._width_text = ""
        self._wndproc = WNDPROC(self._handle_message)
        self._hinst = _kernel32.GetModuleHandleW(None)
        self._class_name = "VoiceKeyboardStatusWindow"

    def set_state(self, state: str) -> None:
        self._q.put(("state", state))
        if self._hwnd:
            _user32.PostMessageW(self._hwnd, _WM_APP_STATE, 0, 0)

    def show_message(self, text: str, seconds: float = 6.0) -> None:
        self._message_token += 1
        token = self._message_token
        self._q.put(("message", text, token))
        if self._hwnd:
            _user32.PostMessageW(self._hwnd, _WM_APP_MESSAGE, 0, 0)
        timer = threading.Timer(seconds, self._hide_message, args=(token,))
        timer.daemon = True
        timer.start()

    def show_typing_message(self, text: str, seconds: float = 6.0, interval: float = 0.006) -> None:
        self._message_token += 1
        token = self._message_token

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

        _user32.SetLayeredWindowAttributes(self._hwnd, 0, 246, 0x00000002)
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
        if msg == 0x0113:
            if wparam == _TIMER_POLL:
                self._poll()
            elif wparam == _TIMER_HIDE:
                _user32.KillTimer(hwnd, _TIMER_HIDE)
                _user32.ShowWindow(hwnd, 0)
            return 0
        if msg == _WM_APP_STATE:
            self._poll()
            return 0
        if msg == _WM_APP_MESSAGE:
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
            _user32.ShowWindow(self._hwnd, 0)
            return
        self._state = state
        self._width_text = ""
        self._text, self._subtext, self._color = info
        _user32.KillTimer(self._hwnd, _TIMER_HIDE)
        self._position()
        _user32.ShowWindow(self._hwnd, 8)
        _user32.InvalidateRect(self._hwnd, None, True)
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
        _user32.KillTimer(self._hwnd, _TIMER_HIDE)
        self._position()
        _user32.ShowWindow(self._hwnd, 8)
        _user32.InvalidateRect(self._hwnd, None, True)

    def _hide_message_now(self, token: int) -> None:
        if not self._hwnd or token != self._message_token or self._state != "message":
            return
        self._state = "idle"
        self._width_text = ""
        _user32.ShowWindow(self._hwnd, 0)

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
        region = _gdi32.CreateRoundRectRgn(0, 0, width + 1, height + 1, _CORNER_RADIUS, _CORNER_RADIUS)
        if region:
            _user32.SetWindowRgn(self._hwnd, region, True)

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
        rect = RECT()
        _user32.GetClientRect(hwnd, ctypes.byref(rect))

        bg = _gdi32.CreateSolidBrush(_BG)
        _user32.FillRect(hdc, ctypes.byref(rect), bg)
        _gdi32.DeleteObject(bg)

        self._paint_accent(hdc, rect)
        self._paint_text(hdc, rect)

        _user32.EndPaint(hwnd, ctypes.byref(ps))

    def _paint_accent(self, hdc, rect: RECT) -> None:
        brush = _gdi32.CreateSolidBrush(self._color)
        pen = _gdi32.CreatePen(_PS_SOLID, 1, self._color)
        old_brush = _gdi32.SelectObject(hdc, brush)
        old_pen = _gdi32.SelectObject(hdc, pen)

        _gdi32.Ellipse(hdc, 18, 22, 32, 36)

        center = int((rect.bottom - rect.top) / 2)
        start_x = max(290, rect.right - 84)
        for idx, bar_h in enumerate((12, 22, 32, 20, 14)):
            x = start_x + idx * 12
            y1 = center - int(bar_h / 2)
            y2 = center + int(bar_h / 2)
            _gdi32.RoundRect(hdc, x, y1, x + 5, y2, 5, 5)

        _gdi32.SelectObject(hdc, old_pen)
        _gdi32.SelectObject(hdc, old_brush)
        _gdi32.DeleteObject(pen)
        _gdi32.DeleteObject(brush)

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
