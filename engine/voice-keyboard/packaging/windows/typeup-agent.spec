# -*- mode: python ; coding: utf-8 -*-

import os
from PyInstaller.utils.hooks import collect_dynamic_libs

project_root = os.getcwd()
entry = os.path.join(project_root, "packaging", "windows", "typeup_agent_entry.py")
hooks = os.path.join(project_root, "packaging", "windows", "hooks")
uiautomation_binaries = collect_dynamic_libs("uiautomation", destdir=".")

a = Analysis(
    [entry],
    pathex=[project_root],
    binaries=uiautomation_binaries,
    datas=[],
    hiddenimports=["webrtcvad"],
    hookspath=[hooks],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="TypeUpAgent",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="TypeUpAgent",
)
