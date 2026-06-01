const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "typeup-settings-polish-style-"));
process.env.TYPEUP_APP_DATA_DIR = tmp;

const { ensureDefaultConfig, readSettings, updateSettings } = require("../electron/settings-store");

try {
  ensureDefaultConfig();
  let settings = readSettings();

  assert.equal(settings.audio.polish_style, "micro");
  assert.equal(settings.audio.polish_style_prompt, "");

  updateSettings({
    audio: {
      ...settings.audio,
      polish_style: "prompt",
      polish_style_prompt: "整理成可直接发给 AI 的任务说明。",
    },
  });
  settings = readSettings();

  assert.equal(settings.audio.polish_style, "prompt");
  assert.equal(settings.audio.polish_style_prompt, "整理成可直接发给 AI 的任务说明。");

  updateSettings({
    audio: {
      ...settings.audio,
      polish_style: "unknown-style",
      polish_style_prompt: "",
    },
  });
  settings = readSettings();

  assert.equal(settings.audio.polish_style, "micro");
  assert.equal(settings.audio.polish_style_prompt, "");

  console.log("settings polish style ok");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
