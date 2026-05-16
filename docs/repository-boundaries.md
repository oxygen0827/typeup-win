# Repository Boundaries

TypeUp is split across three repositories. Keep this desktop repository focused on product shell, local orchestration, and packaging.

## This Repository: TypeUp Desktop

Owns:

- Electron main process, preload API, and local Node bridge.
- React desktop UI for engine status, account, subscription, settings, usage, and logs.
- Desktop packaging for Windows and macOS.
- Local persistence that connects the UI, cloud session, and embedded engine configuration.
- The embedded `engine/voice-keyboard` copy used for product packaging.

Should not own:

- Cloud account, entitlement, payment, or model proxy business logic.
- Generic microphone, hotkey, typing, STT, or LLM engine behavior unless the change is needed for TypeUp packaging and then upstreamed.

## Upstream Engine: `wangqioo/voice-keyboard`

`engine/voice-keyboard` is derived from the standalone `voice-keyboard` project. Treat the standalone project as the upstream engine.

Engine changes should normally be made upstream first when they are generic:

- Microphone capture, PTT/VAD, device enumeration.
- Global keyboard/mouse monitoring.
- Text typing and erase behavior across operating systems.
- STT/LLM provider implementations.
- macOS/Windows/Linux permissions and native UI helpers.

TypeUp-specific engine additions are acceptable here only when they are tied to desktop integration:

- `typeup_backend` provider behavior.
- Cloud bridge token synchronization.
- Packaged app status signals consumed by Electron.
- Windows/macOS packaging entry points required by this desktop app.

When a generic engine fix lands here first, open a follow-up PR to `voice-keyboard` or document why it must remain product-specific.

## Backend: `oxygen0827/typeup-backend`

The desktop app talks to the backend through the local bridge. The backend owns:

- Users, sessions, access/refresh token rotation.
- Plans, orders, payments, and entitlement state.
- Usage metering and quota enforcement.
- STT/LLM model proxying and provider credentials.
- Admin APIs.

The desktop app should not duplicate backend policy. It should show backend errors, keep local credentials synchronized, and clear local auth state when the backend says the session is invalid.

## Recommended Integration Model

Use `voice-keyboard` as the engine upstream and keep this repository as the product shell. For now, the embedded engine copy is practical for packaging. Long term, prefer one of:

- Git subtree for `engine/voice-keyboard`, if packaged source should remain in this repository.
- Python package distribution, if engine releases become versioned and stable.

Avoid manual copy-paste updates without a recorded sync commit.
