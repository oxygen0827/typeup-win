$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$engine = Join-Path $root "engine\voice-keyboard"
$venv = Join-Path $engine ".venv"
$python = "python"

if (Get-Command py -ErrorAction SilentlyContinue) {
  try {
    & py -3.12 --version *> $null
    $python = "py -3.12"
  } catch {
    $python = "python"
  }
}

Set-Location $engine
if (-not (Test-Path $venv)) {
  if ($python -eq "py -3.12") {
    & py -3.12 -m venv .venv
  } else {
    & python -m venv .venv
  }
}

$venvPython = Join-Path $venv "Scripts\python.exe"
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r requirements.txt

try {
  & $venvPython -m pip install webrtcvad-wheels
} catch {
  Write-Warning "webrtcvad-wheels install failed. Always-on VAD needs webrtcvad; retry with Python 3.12 if needed."
}

Write-Host "TypeUp engine is ready: $venvPython"
