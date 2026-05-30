const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeup-agent-status-"));
process.env.TYPEUP_APP_DATA_DIR = tmpDir;
process.env.TYPEUP_ENGINE_USER_DIR = path.join(tmpDir, "engine");

const { AgentManager } = require("../electron/agent-manager");

const fakeApp = {
  isPackaged: false,
  getAppPath() {
    return path.join(__dirname, "..");
  },
  getPath(name) {
    assert.equal(name, "userData");
    return tmpDir;
  },
};

const manager = new AgentManager({ electronApp: fakeApp });
const statuses = [];
manager.on("status", (status) => statuses.push(status));

assert.equal(manager.status().transcriptionEnabled, false);

manager._inferState("[typeup-transcription] enabled", false);
assert.equal(manager.status().state, "listening");
assert.equal(manager.status().transcriptionEnabled, true);
assert.equal(statuses.at(-1).transcriptionEnabled, true);

manager._inferState("[typeup-transcription] disabled", false);
assert.equal(manager.status().state, "listening");
assert.equal(manager.status().transcriptionEnabled, false);
assert.equal(statuses.at(-1).transcriptionEnabled, false);

fs.rmSync(tmpDir, { recursive: true, force: true });
