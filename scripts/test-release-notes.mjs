import assert from "node:assert/strict";
import fs from "node:fs";

import {
  firstPlainReleaseNote,
  hasReleaseNoteContent,
  localizedReleaseNoteItems,
  parseReleaseNoteItems,
  withBuiltinReleaseNotesFallback,
} from "../src/releaseNotes.mjs";

const htmlNotes = `
<h2>0.1.20 Update Highlights</h2>
<ul>
  <li>Improve micro-polish prompts.</li>
  <li>Keep spoken style more reliably.</li>
  <li>Clean model preambles before typing.</li>
</ul>
`;

assert.equal(firstPlainReleaseNote(htmlNotes), "Improve micro-polish prompts.");
assert.deepEqual(parseReleaseNoteItems(htmlNotes), [
  "Improve micro-polish prompts.",
  "Keep spoken style more reliably.",
  "Clean model preambles before typing.",
]);
assert.deepEqual(localizedReleaseNoteItems({ releaseNotes: htmlNotes }, "en"), [
  "Keep spoken style more reliably.",
  "Clean model preambles before typing.",
]);

const markdownNotes = `
## 0.1.21 Update Highlights

- Fix release-note rendering.
- Fix update-button hover contrast.
`;

assert.equal(firstPlainReleaseNote(markdownNotes), "Fix release-note rendering.");
assert.deepEqual(parseReleaseNoteItems(markdownNotes), [
  "Fix release-note rendering.",
  "Fix update-button hover contrast.",
]);

const builtinNotes = {
  version: "0.1.35",
  releaseName: "TypeUp 0.1.35",
  releaseNotes: "",
  releaseUrl: "",
  localized: {
    zh: {
      summary: "Add Ctrl + Alt toggle transcription.",
      items: ["Press once to start, then press again to stop."],
    },
  },
};

const emptyPending = {
  version: "0.1.35",
  releaseName: "TypeUp 0.1.35",
  releaseNotes: "",
  releaseUrl: "http://updates.example/release",
};

assert.equal(hasReleaseNoteContent(emptyPending), false);
assert.equal(hasReleaseNoteContent(builtinNotes), true);
assert.deepEqual(
  withBuiltinReleaseNotesFallback(emptyPending, builtinNotes),
  {
    ...emptyPending,
    localized: builtinNotes.localized,
  },
);

const realPending = {
  ...emptyPending,
  releaseNotes: "- Remote release note",
};

assert.equal(withBuiltinReleaseNotesFallback(realPending, builtinNotes), realPending);

const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(
  appSource,
  new RegExp(`"${packageJson.version.replaceAll(".", "\\.")}"\\s*:\\s*{\\s*releaseName`),
  `BUILTIN_RELEASE_NOTES must include the current app version ${packageJson.version}`,
);

console.log("release notes parser ok");
