const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HISTORY_PATH = path.join(resolveAppDataDir(), "TypeUp", "engine", "history.jsonl");

const DICTATION_MODES = new Set(["dictate", "polish"]);
const AI_OUTPUT_MODES = new Set(["ai_edit", "ai_write", "ai_chat", "ai_memo", "ai_output"]);
const AI_COMMAND_MODES = new Set(["ai"]);

function readUsage() {
  const entries = readHistory();
  const todayStart = startOfToday();
  const totals = makeBucket(entries);
  const today = makeBucket(entries.filter((entry) => (entry.ts || 0) * 1000 >= todayStart));
  const days = lastDays(entries, 7);

  return {
    historyPath: HISTORY_PATH,
    updatedAt: Date.now(),
    today,
    totals,
    days,
    recent: entries.slice(-20).reverse(),
  };
}

function readHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  const lines = fs.readFileSync(HISTORY_PATH, "utf8").split(/\r?\n/);
  const entries = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      entries.push({
        ts: Number(item.ts || 0),
        mode: item.mode || "unknown",
        status: item.status || "ok",
        text: item.text || "",
        detail: item.detail || "",
      });
    } catch (_error) {
      // Ignore partial log lines.
    }
  }
  return entries;
}

function makeBucket(entries) {
  let transcribedChars = 0;
  let aiEditedChars = 0;
  let aiCommandChars = 0;
  let successfulEvents = 0;
  let failedEvents = 0;

  for (const entry of entries) {
    if (entry.status === "error") failedEvents += 1;
    if (entry.status !== "ok") continue;
    successfulEvents += 1;
    const chars = countChars(entry.text);
    if (DICTATION_MODES.has(entry.mode)) transcribedChars += chars;
    if (AI_OUTPUT_MODES.has(entry.mode)) aiEditedChars += chars;
    if (AI_COMMAND_MODES.has(entry.mode)) aiCommandChars += chars;
  }

  const estimatedTokens = Math.ceil((transcribedChars + aiEditedChars + aiCommandChars) * 1.15);
  return {
    transcribedChars,
    aiEditedChars,
    aiCommandChars,
    estimatedTokens,
    successfulEvents,
    failedEvents,
  };
}

function lastDays(entries, count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
    const bucket = makeBucket(entries.filter((entry) => {
      const t = (entry.ts || 0) * 1000;
      return t >= day.getTime() && t < next.getTime();
    }));
    out.push({
      date: day.toISOString().slice(0, 10),
      label: `${day.getMonth() + 1}/${day.getDate()}`,
      ...bucket,
    });
  }
  return out;
}

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function countChars(text) {
  return Array.from(String(text || "").replace(/\s/g, "")).length;
}

function resolveAppDataDir() {
  if (process.env.TYPEUP_APP_DATA_DIR) return process.env.TYPEUP_APP_DATA_DIR;
  if (process.platform === "win32") {
    return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support");
  }
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
}

module.exports = { readUsage };
