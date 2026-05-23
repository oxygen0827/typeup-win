$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$setup = Join-Path $PSScriptRoot "setup-engine.ps1"
$engine = Join-Path $root "engine\voice-keyboard"
$venvPython = Join-Path $engine ".venv\Scripts\python.exe"
$agentExe = Join-Path $engine "dist\TypeUpAgent\TypeUpAgent.exe"

function Invoke-NativeChecked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

& $setup

if (Test-Path $agentExe) {
  $agentPath = (Resolve-Path $agentExe).Path
  Get-Process -Name "TypeUpAgent" -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $agentPath } |
    Stop-Process -Force
}

Set-Location $engine
Invoke-NativeChecked { & $venvPython -m pip install pyinstaller } "Installing PyInstaller"
Invoke-NativeChecked { & $venvPython -m PyInstaller --clean --noconfirm packaging\windows\typeup-agent.spec } "Building TypeUpAgent"

Write-Host "TypeUp agent exe: $engine\dist\TypeUpAgent\TypeUpAgent.exe"
