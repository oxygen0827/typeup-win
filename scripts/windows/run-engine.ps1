$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$engine = Join-Path $root "engine\voice-keyboard"
$venvPython = Join-Path $engine ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
  throw "Engine venv not found. Run npm run engine:setup first."
}

Set-Location $engine
& $venvPython -u -m agent.main --no-serial --no-ui
