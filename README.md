# TypeUp

TypeUp is a Windows desktop client for local voice transcription. The Electron shell starts a local Node backend, launches the bundled `voice-keyboard` Python engine, and exposes local usage stats to the React UI.

## Development

```powershell
npm install
npm run engine:setup
npm run start
```

The local engine config is created at:

```text
%USERPROFILE%\.voice-keyboard\config.yaml
```

TypeUp defaults to Windows push-to-talk controls:

- `ALT`: hold to speak.
- `ALT + SPACE`: hold for AI editing.
- Double `ALT`: toggle original/light polish mode.

Fill in the STT credentials in the app settings, then restart the engine from the dashboard.

## Windows Build

```powershell
npm run engine:build
npm run build:win
```

The installer is emitted into `release/`. `engine:build` creates `engine/voice-keyboard/dist/TypeUpAgent/TypeUpAgent.exe`; the Electron app prefers that bundled agent so installed users do not need a local Python runtime.
