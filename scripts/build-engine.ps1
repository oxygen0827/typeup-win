$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$setup = Join-Path $PSScriptRoot "setup-engine.ps1"
$engine = Join-Path $root "engine\voice-keyboard"
$venvPython = Join-Path $engine ".venv\Scripts\python.exe"

& $setup

Set-Location $engine
& $venvPython -m pip install pyinstaller
& $venvPython -m PyInstaller --clean --noconfirm packaging\windows\typeup-agent.spec

Write-Host "TypeUp agent exe: $engine\dist\TypeUpAgent\TypeUpAgent.exe"
