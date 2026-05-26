const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "typeup-corrections-"));
process.env.TYPEUP_APP_DATA_DIR = tmp;

const {
  listCorrections,
  createCorrection,
  updateCorrection,
  deleteCorrection,
  correctionsPath,
} = require("../electron/corrections-store");

const created = createCorrection({ source: "胡仁远", target: "胡任远" });
assert.equal(created.source, "胡仁远");
assert.equal(created.target, "胡任远");
assert.equal(created.enabled, true);
assert.equal(created.confidence, 2);

const listed = listCorrections();
assert.equal(listed.records.length, 1);
assert.equal(listed.path, correctionsPath());
assert.ok(fs.existsSync(correctionsPath()));

const disabled = updateCorrection(created.id, { enabled: false, confidence: 1 });
assert.equal(disabled.enabled, false);
assert.equal(disabled.confidence, 1);

assert.throws(() => createCorrection({ source: "a", target: "b" }), /at least 2/);
assert.throws(() => createCorrection({ source: "same", target: "same" }), /different/);

assert.equal(deleteCorrection(created.id), true);
assert.equal(deleteCorrection(created.id), false);
assert.equal(listCorrections().records.length, 0);

fs.rmSync(tmp, { recursive: true, force: true });
