import assert from "node:assert/strict";

import {
  firstPlainReleaseNote,
  localizedReleaseNoteItems,
  parseReleaseNoteItems,
} from "../src/releaseNotes.mjs";

const htmlNotes = `
<h2>0.1.20 更新重点</h2>
<ul>
  <li>优化微润色模式的提示词：明确只做轻量清理。</li>
  <li>微润色会更专注于去掉口语填充词。</li>
  <li>增强润色结果清洗。</li>
</ul>
`;

assert.equal(firstPlainReleaseNote(htmlNotes), "优化微润色模式的提示词：明确只做轻量清理。");
assert.deepEqual(parseReleaseNoteItems(htmlNotes), [
  "优化微润色模式的提示词：明确只做轻量清理。",
  "微润色会更专注于去掉口语填充词。",
  "增强润色结果清洗。",
]);
assert.deepEqual(localizedReleaseNoteItems({ releaseNotes: htmlNotes }, "zh"), [
  "微润色会更专注于去掉口语填充词。",
  "增强润色结果清洗。",
]);

const markdownNotes = `
## 0.1.21 更新重点

- 修复更新说明显示。
- 修复更新按钮 hover。
`;

assert.equal(firstPlainReleaseNote(markdownNotes), "修复更新说明显示。");
assert.deepEqual(parseReleaseNoteItems(markdownNotes), [
  "修复更新说明显示。",
  "修复更新按钮 hover。",
]);

console.log("release notes parser ok");
