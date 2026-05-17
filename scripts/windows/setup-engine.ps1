$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$engine = Join-Path $root "engine\voice-keyboard"
$venv = Join-Path $engine ".venv"
$python = "python"
$pipIndexUrl = if ($env:PIP_INDEX_URL) { $env:PIP_INDEX_URL } else { "https://pypi.tuna.tsinghua.edu.cn/simple" }
$pipTrustedHost = if ($env:PIP_TRUSTED_HOST) { $env:PIP_TRUSTED_HOST } else { "pypi.tuna.tsinghua.edu.cn" }

function Invoke-Checked {
  param([scriptblock]$Command)
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE"
  }
}

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
Invoke-Checked { & $venvPython -m pip install --index-url $pipIndexUrl --trusted-host $pipTrustedHost --upgrade pip }
Invoke-Checked { & $venvPython -m pip install --index-url $pipIndexUrl --trusted-host $pipTrustedHost -r requirements.txt }

try {
  Invoke-Checked { & $venvPython -m pip install --index-url $pipIndexUrl --trusted-host $pipTrustedHost webrtcvad-wheels }
} catch {
  Write-Warning "webrtcvad-wheels install failed. Always-on VAD needs webrtcvad; retry with Python 3.12 if needed."
}

Write-Host "TypeUp engine is ready: $venvPython"
