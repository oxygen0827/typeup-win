const assert = require("node:assert/strict");

const { registerVoiceConsoleShortcuts } = require("../electron/voice-shortcuts");

const callbacks = new Map();
const unregistered = [];
const globalShortcut = {
  register(accelerator, callback) {
    callbacks.set(accelerator, callback);
    return true;
  },
  unregister(accelerator) {
    unregistered.push(accelerator);
  },
};

const calls = [];
const agent = {
  async start(options) {
    calls.push(["start", options]);
  },
  async stop() {
    calls.push(["stop"]);
  },
};

const cleanup = registerVoiceConsoleShortcuts({
  globalShortcut,
  getAgent: () => agent,
  platform: "win32",
  log: { warn() {} },
});

assert.equal(callbacks.has("CommandOrControl+O"), true);
assert.equal(callbacks.has("CommandOrControl+P"), true);

callbacks.get("CommandOrControl+O")()
  .then(() => callbacks.get("CommandOrControl+P")())
  .then(() => {
    assert.deepEqual(calls, [
      ["start", { initialTranscriptionEnabled: true }],
      ["stop"],
    ]);

    cleanup();
    assert.deepEqual(unregistered, ["CommandOrControl+O", "CommandOrControl+P"]);

    console.log("voice shortcuts ok");
  });
