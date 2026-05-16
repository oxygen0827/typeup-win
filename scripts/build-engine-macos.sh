#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="$ROOT/engine/voice-keyboard"
VENV="$ENGINE/.venv"

if [[ ! -x "$VENV/bin/python" ]]; then
  bash "$ROOT/scripts/setup-engine-macos.sh"
fi

cd "$ENGINE"
"$VENV/bin/python" -m pip install -r requirements.txt
"$VENV/bin/python" -m pip install py2app
rm -rf "$ENGINE/build" "$ENGINE/dist"
"$VENV/bin/python" packaging/macos/setup.py py2app

echo "TypeUp macOS agent app: $ENGINE/dist/TypeUp Engine.app"
