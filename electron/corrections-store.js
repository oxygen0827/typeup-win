const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_TEXT_LENGTH = 40;

function correctionsPath() {
  return path.join(resolveEngineUserDir(), "corrections.json");
}

function listCorrections() {
  return {
    path: correctionsPath(),
    records: readRecords().sort(compareCorrections),
  };
}

function createCorrection(payload) {
  const source = cleanText(payload?.source);
  const target = cleanText(payload?.target);
  validatePair(source, target);
  const records = readRecords();
  const now = new Date().toISOString();
  const existing = records.find((item) => item.source === source && item.target === target);
  if (existing) {
    existing.enabled = true;
    existing.count = Math.max(2, Number(existing.count) || 1);
    existing.confidence = Math.max(2, Number(existing.confidence) || 1);
    existing.updated_at = now;
    writeRecords(records);
    return existing;
  }
  const record = {
    id: `corr_${crypto.randomUUID().replaceAll("-", "")}`,
    source,
    target,
    count: 2,
    confidence: 2,
    enabled: true,
    created_at: now,
    updated_at: now,
    last_seen_at: now,
  };
  records.push(record);
  writeRecords(records);
  return record;
}

function updateCorrection(id, patch) {
  const records = readRecords();
  const record = records.find((item) => item.id === id);
  if (!record) return null;
  const source = patch?.source === undefined ? record.source : cleanText(patch.source);
  const target = patch?.target === undefined ? record.target : cleanText(patch.target);
  validatePair(source, target);
  record.source = source;
  record.target = target;
  if (patch?.enabled !== undefined) record.enabled = Boolean(patch.enabled);
  if (patch?.confidence !== undefined) record.confidence = clampInt(patch.confidence, 1, 5);
  if (patch?.count !== undefined) record.count = Math.max(1, Number.parseInt(patch.count, 10) || 1);
  record.updated_at = new Date().toISOString();
  writeRecords(records);
  return record;
}

function deleteCorrection(id) {
  const records = readRecords();
  const next = records.filter((item) => item.id !== id);
  if (next.length === records.length) return false;
  writeRecords(next);
  return true;
}

function readRecords() {
  const file = correctionsPath();
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8") || "[]");
    const records = Array.isArray(data) ? data : data.records;
    if (!Array.isArray(records)) return [];
    return records.map(normalizeRecord).filter((item) => item.source && item.target);
  } catch (_error) {
    return [];
  }
}

function writeRecords(records) {
  const file = correctionsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(records.map(normalizeRecord), null, 2), "utf8");
}

function normalizeRecord(item) {
  const now = new Date().toISOString();
  return {
    id: String(item.id || `corr_${crypto.randomUUID().replaceAll("-", "")}`),
    source: cleanText(item.source),
    target: cleanText(item.target),
    count: Math.max(1, Number.parseInt(item.count, 10) || 1),
    confidence: clampInt(item.confidence, 1, 5),
    enabled: item.enabled !== false,
    created_at: String(item.created_at || now),
    updated_at: String(item.updated_at || now),
    last_seen_at: String(item.last_seen_at || item.updated_at || now),
  };
}

function validatePair(source, target) {
  if (!source || !target || source === target) {
    throw new Error("Source and target must be different.");
  }
  if (source.length < 2 || target.length < 2) {
    throw new Error("Source and target must be at least 2 characters.");
  }
  if (source.length > MAX_TEXT_LENGTH || target.length > MAX_TEXT_LENGTH) {
    throw new Error(`Source and target must be ${MAX_TEXT_LENGTH} characters or fewer.`);
  }
}

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function clampInt(value, min, max) {
  const next = Number.parseInt(value, 10);
  if (Number.isNaN(next)) return min;
  return Math.max(min, Math.min(max, next));
}

function compareCorrections(left, right) {
  return (
    (Number(right.confidence) || 0) - (Number(left.confidence) || 0)
    || (Number(right.count) || 0) - (Number(left.count) || 0)
    || String(left.source || "").localeCompare(String(right.source || ""))
  );
}

function resolveEngineUserDir() {
  if (process.env.TYPEUP_ENGINE_USER_DIR) return process.env.TYPEUP_ENGINE_USER_DIR;
  if (process.env.TYPEUP_APP_DATA_DIR) return path.join(process.env.TYPEUP_APP_DATA_DIR, "TypeUp", "engine");
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "TypeUp", "engine");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "TypeUp", "engine");
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "TypeUp", "engine");
}

module.exports = {
  listCorrections,
  createCorrection,
  updateCorrection,
  deleteCorrection,
  correctionsPath,
};
