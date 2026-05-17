#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENGINE="$ROOT/engine/voice-keyboard"
VENV="$ENGINE/.venv"

if [[ ! -x "$VENV/bin/python" ]]; then
  bash "$ROOT/scripts/macos/setup-engine.sh"
fi

cd "$ENGINE"
"$VENV/bin/python" -u -m agent.main --no-serial --no-ui "$@"
