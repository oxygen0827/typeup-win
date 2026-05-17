# Engine Sync

`engine/voice-keyboard` is the embedded engine copy packaged with TypeUp Desktop. The upstream engine is `wangqioo/voice-keyboard`.

## Direction

Default direction:

```text
wangqioo/voice-keyboard
  -> typeup-win/engine/voice-keyboard
```

Generic engine changes should be made upstream first, then synced into this repository for packaging.

Acceptable desktop-first exceptions:

- Local bridge token synchronization.
- Packaged desktop status log lines consumed by Electron.
- Windows/macOS build entry points required by Electron packaging.
- Short-lived fixes needed to unblock a desktop release.

Any desktop-first generic fix should get a follow-up upstream PR.

## What Counts As Generic Engine Work

- STT/LLM provider behavior.
- PTT/VAD recording.
- Microphone discovery.
- Keyboard and mouse monitoring.
- Typing, erase, clipboard, and shortcut behavior.
- Platform permissions and native helper UI.

## Sync Checklist

Before syncing engine changes into this repository:

1. Confirm the upstream engine tests or compile checks pass.
2. Record the upstream commit hash in the sync commit message.
3. Keep TypeUp-specific config defaults in this repository if they only support desktop packaging.
4. Re-run desktop checks:

```bash
npm run build
node --check electron/main.js
node --check electron/agent-manager.js
node --check electron/local-server.js
node --check electron/platform/index.js
node --check electron/platform/darwin.js
node --check electron/platform/win32.js
```

For macOS packaging changes, also run:

```bash
bash -n scripts/macos/setup-engine.sh
bash -n scripts/macos/build-engine.sh
bash -n scripts/macos/run-engine.sh
```

## Future Cleanup

The preferred next step is to convert the embedded engine copy to a Git subtree. That keeps packaged source in this repository while preserving a clear upstream sync path.
