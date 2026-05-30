const VOICE_CONSOLE_SHORTCUTS = Object.freeze({
  start: "CommandOrControl+O",
  stop: "CommandOrControl+P",
});

function registerVoiceConsoleShortcuts({ globalShortcut, getAgent, platform = process.platform, log = console } = {}) {
  if (!globalShortcut || typeof globalShortcut.register !== "function") {
    return () => {};
  }
  if (platform === "darwin") {
    return () => {};
  }

  const registered = [];
  const register = (accelerator, action) => {
    const ok = globalShortcut.register(accelerator, async () => {
      const agent = typeof getAgent === "function" ? getAgent() : null;
      if (!agent || typeof agent[action] !== "function") return;
      try {
        if (action === "start") {
          await agent.start({ initialTranscriptionEnabled: true });
          return;
        }
        await agent[action]();
      } catch (error) {
        log?.warn?.(`[typeup] ${accelerator} shortcut failed: ${error.message}`);
      }
    });
    if (ok) {
      registered.push(accelerator);
      log?.info?.(`[typeup] registered global shortcut ${accelerator}`);
    } else {
      log?.warn?.(`[typeup] unable to register global shortcut ${accelerator}`);
    }
  };

  register(VOICE_CONSOLE_SHORTCUTS.start, "start");
  register(VOICE_CONSOLE_SHORTCUTS.stop, "stop");

  return () => {
    for (const accelerator of registered) {
      globalShortcut.unregister(accelerator);
    }
  };
}

module.exports = {
  VOICE_CONSOLE_SHORTCUTS,
  registerVoiceConsoleShortcuts,
};
