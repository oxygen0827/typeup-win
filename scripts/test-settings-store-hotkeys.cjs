const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const YAML = require("yaml");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "typeup-settings-hotkeys-"));
process.env.TYPEUP_APP_DATA_DIR = tmp;

const configPath = path.join(tmp, "TypeUp", "engine", "config.yaml");
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, YAML.stringify({
  audio: {
    mode: "ptt",
    ptt_key: "alt",
    ai_key: ["alt", "space"],
    toggle_key: ["ctrl", "alt"],
  },
  typeup: { managed: true, version: 5 },
}), "utf8");

const { readSettings } = require("../electron/settings-store");
const settings = readSettings();

assert.deepEqual(settings.audio.enable_key, ["ctrl", "o"]);
assert.deepEqual(settings.audio.disable_key, ["ctrl", "p"]);
assert.equal(settings.audio.ptt_key, "alt_r");
assert.deepEqual(settings.audio.ai_key, ["alt_r", "shift_r"]);
assert.equal(settings.audio.polish_style, "micro");
assert.equal(settings.audio.polish_style_prompt, "");
assert.equal(settings.audio.toggle_key, undefined);
assert.equal(settings.typeup.version, 8);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("settings hotkeys migration ok");
