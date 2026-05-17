# Repository Layout

TypeUp Desktop is a single Electron app with platform-specific adapters. macOS
and Windows should share product logic, auth, billing, settings, and renderer UI;
only native integration and packaging should diverge.

## Main Areas

- `src/` - React renderer UI shared by all desktop platforms.
- `electron/` - Electron main process, local API, settings, and engine lifecycle.
- `electron/platform/` - platform-specific desktop integration:
  - `darwin.js` - macOS Engine.app install path, TCC permissions, macOS engine launch.
  - `win32.js` - Windows engine executable resolution and user-data paths.
  - `generic.js` - Linux/development fallback paths and launch.
- `engine/voice-keyboard/` - embedded voice engine snapshot packaged with TypeUp.
- `scripts/macos/` - macOS engine setup/build/run helpers.
- `scripts/windows/` - Windows engine setup/build/run helpers.
- `build/` - Electron Builder assets and installer hooks.
- `release/` - generated artifacts; do not treat as source.

## Rules

- Keep cross-platform business behavior in `electron/`, `src/`, and the backend.
- Put native OS behavior in `electron/platform/`.
- Put packaging commands in `scripts/<platform>/`.
- Put engine behavior upstream in `voice-keyboard` first unless the change is only
  needed for TypeUp desktop packaging.
- Keep npm command names stable. Paths behind commands may move, but callers should
  continue using `npm run engine:build:mac`, `npm run engine:build`, and similar.
