const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeup-agent-start-"));
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
let restartedWith = null;
manager.child = {};
manager.transcriptionEnabled = false;
manager.status = () => ({ state: "listening", transcriptionEnabled: manager.transcriptionEnabled });
manager.restart = async (options) => {
  restartedWith = options;
  manager.transcriptionEnabled = true;
  return manager.status();
};

manager.start({ initialTranscriptionEnabled: true })
  .then((status) => {
    assert.deepEqual(restartedWith, { initialTranscriptionEnabled: true });
    assert.equal(status.transcriptionEnabled, true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log("agent start transcription ok");
  });
