const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const YAML = require("yaml");

const USER_DIR = path.join(resolveAppDataDir(), "TypeUp", "engine");
const CONFIG_PATH = path.join(USER_DIR, "config.yaml");
const TYPEUP_DIR = path.join(resolveAppDataDir(), "TypeUp");
const CLOUD_PATH = path.join(TYPEUP_DIR, "cloud-bridge.json");
const CONFIG_VERSION = 7;
const DEFAULT_BACKEND_URL = "http://150.158.146.192:6053";
const DEFAULT_AUDIO_HOTKEYS = process.platform === "darwin"
  ? { ptt_key: "shift_r", ai_key: "alt_r" }
  : { ptt_key: "alt_r", ai_key: ["alt_r", "shift_r"], enable_key: ["ctrl", "o"], disable_key: ["ctrl", "p"] };

const DEFAULT_CONFIG = {
  stt: {
    provider: "typeup_backend",
    api_base_url: DEFAULT_BACKEND_URL,
    access_token: "",
    refresh_token: "",
    model: "glm-asr-2512",
    language: "zh",
  },
  audio: {
    mode: "ptt",
    device: "auto",
    vad_aggressiveness: 2,
    ...DEFAULT_AUDIO_HOTKEYS,
  },
  typing: {
    method: "unicode",
  },
  llm: {
    provider: "typeup_backend",
    api_base_url: DEFAULT_BACKEND_URL,
    access_token: "",
    refresh_token: "",
    model: "glm-4-flash",
  },
};

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

function ensureDefaultConfig() {
  fs.mkdirSync(USER_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, YAML.stringify(withTypeUpMarker(DEFAULT_CONFIG)), "utf8");
    return;
  }

  try {
    const current = YAML.parse(fs.readFileSync(CONFIG_PATH, "utf8")) || {};
    if (!current.typeup?.managed) {
      const next = deepMerge(current, {
        audio: {
          ...DEFAULT_CONFIG.audio,
          ...(current.audio || {}),
          mode: DEFAULT_CONFIG.audio.mode,
          ptt_key: DEFAULT_CONFIG.audio.ptt_key,
          ai_key: DEFAULT_CONFIG.audio.ai_key,
          enable_key: DEFAULT_CONFIG.audio.enable_key,
          disable_key: DEFAULT_CONFIG.audio.disable_key,
        },
        typing: current.typing || DEFAULT_CONFIG.typing,
        typeup: { managed: true, version: CONFIG_VERSION },
      });
      delete next.audio.toggle_key;
      writeYamlConfig(next);
      return;
    }

    if ((Number(current.typeup.version) || 1) < CONFIG_VERSION) {
      const next = deepMerge(current, {
        audio: {
          ...DEFAULT_CONFIG.audio,
          ...(current.audio || {}),
          mode: DEFAULT_CONFIG.audio.mode,
          ptt_key: DEFAULT_CONFIG.audio.ptt_key,
          ai_key: DEFAULT_CONFIG.audio.ai_key,
          enable_key: DEFAULT_CONFIG.audio.enable_key,
          disable_key: DEFAULT_CONFIG.audio.disable_key,
        },
        typeup: { managed: true, version: CONFIG_VERSION },
      });
      delete next.audio.toggle_key;
      writeYamlConfig(next);
    }
  } catch (_error) {
    fs.writeFileSync(CONFIG_PATH, YAML.stringify(withTypeUpMarker(DEFAULT_CONFIG)), "utf8");
  }
}

function readYamlConfig() {
  ensureDefaultConfig();
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return YAML.parse(raw) || {};
  } catch (_error) {
    return { ...DEFAULT_CONFIG };
  }
}

function writeYamlConfig(config) {
  fs.mkdirSync(USER_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, YAML.stringify(config), "utf8");
}

function readSettings() {
  const config = readYamlConfig();
  return {
    ...config,
    configured: isConfigured(config),
    configPath: CONFIG_PATH,
    userDir: USER_DIR,
  };
}

function updateSettings(patch) {
  const current = readYamlConfig();
  const next = deepMerge(current, normalizePatch(patch));
  writeYamlConfig(next);
  return readSettings();
}

function readCloudBridge() {
  fs.mkdirSync(TYPEUP_DIR, { recursive: true });
  if (!fs.existsSync(CLOUD_PATH)) {
    return {
      apiBaseUrl: process.env.TYPEUP_BACKEND_URL || DEFAULT_BACKEND_URL,
      workspaceId: "",
      authMode: "backend",
      connected: false,
      accessToken: "",
      refreshToken: "",
      user: null,
      entitlement: null,
      path: CLOUD_PATH,
    };
  }
  try {
    return {
      apiBaseUrl: process.env.TYPEUP_BACKEND_URL || DEFAULT_BACKEND_URL,
      workspaceId: "",
      authMode: "backend",
      connected: false,
      accessToken: "",
      refreshToken: "",
      user: null,
      entitlement: null,
      ...JSON.parse(fs.readFileSync(CLOUD_PATH, "utf8")),
      path: CLOUD_PATH,
    };
  } catch (_error) {
    return {
      apiBaseUrl: process.env.TYPEUP_BACKEND_URL || DEFAULT_BACKEND_URL,
      workspaceId: "",
      authMode: "backend",
      connected: false,
      accessToken: "",
      refreshToken: "",
      user: null,
      entitlement: null,
      path: CLOUD_PATH,
    };
  }
}

function updateCloudBridge(patch) {
  const current = readCloudBridge();
  const next = {
    apiBaseUrl: stringValue(patch.apiBaseUrl ?? current.apiBaseUrl) || DEFAULT_BACKEND_URL,
    workspaceId: stringValue(patch.workspaceId ?? current.workspaceId),
    authMode: stringValue((patch.authMode ?? current.authMode) || "backend"),
    connected: Boolean(patch.connected ?? current.connected),
    accessToken: patch.accessToken !== undefined ? stringValue(patch.accessToken) || "" : stringValue(current.accessToken) || "",
    refreshToken: patch.refreshToken !== undefined ? stringValue(patch.refreshToken) || "" : stringValue(current.refreshToken) || "",
    user: patch.user !== undefined ? patch.user : current.user || null,
    entitlement: patch.entitlement !== undefined ? patch.entitlement : current.entitlement || null,
    updatedAt: Date.now(),
  };
  fs.mkdirSync(TYPEUP_DIR, { recursive: true });
  fs.writeFileSync(CLOUD_PATH, JSON.stringify(next, null, 2), "utf8");
  return { ...next, path: CLOUD_PATH };
}

function normalizePatch(patch) {
  const normalized = {};
  if (patch.stt) {
    normalized.stt = {
      provider: "typeup_backend",
      api_key: "",
      api_base_url: stringValue(patch.stt.api_base_url),
      access_token: stringValue(patch.stt.access_token),
      refresh_token: stringValue(patch.stt.refresh_token),
      cloud_bridge_path: stringValue(patch.stt.cloud_bridge_path),
      model: stringValue(patch.stt.model),
      language: stringValue(patch.stt.language),
      base_url: stringValue(patch.stt.base_url),
      app_id: stringValue(patch.stt.app_id),
      api_secret: stringValue(patch.stt.api_secret),
      access_key_id: stringValue(patch.stt.access_key_id),
      access_key_secret: stringValue(patch.stt.access_key_secret),
      app_key: stringValue(patch.stt.app_key),
      region: stringValue(patch.stt.region),
      token: stringValue(patch.stt.token),
      cluster: stringValue(patch.stt.cluster),
    };
  }
  if (patch.audio) {
    normalized.audio = {
      mode: patch.audio.mode === "vad" ? "vad" : "ptt",
      device: stringValue(patch.audio.device || "auto"),
      vad_aggressiveness: Number(patch.audio.vad_aggressiveness ?? 2),
      ptt_key: hotkeyValue(patch.audio.ptt_key || DEFAULT_CONFIG.audio.ptt_key),
      ai_key: hotkeyValue(patch.audio.ai_key || DEFAULT_CONFIG.audio.ai_key),
      enable_key: hotkeyValue(patch.audio.enable_key || DEFAULT_CONFIG.audio.enable_key),
      disable_key: hotkeyValue(patch.audio.disable_key || DEFAULT_CONFIG.audio.disable_key),
      toggle_key: hotkeyValue(patch.audio.toggle_key),
    };
  }
  if (patch.typing) {
    normalized.typing = {
      method: patch.typing.method === "clip" ? "clip" : "unicode",
    };
  }
  if (patch.llm) {
    normalized.llm = {
      provider: "typeup_backend",
      api_key: "",
      api_base_url: stringValue(patch.llm.api_base_url),
      access_token: stringValue(patch.llm.access_token),
      refresh_token: stringValue(patch.llm.refresh_token),
      cloud_bridge_path: stringValue(patch.llm.cloud_bridge_path),
      model: stringValue(patch.llm.model),
      base_url: stringValue(patch.llm.base_url),
    };
  }
  return pruneEmpty(normalized);
}

function isConfigured(config) {
  const stt = config.stt || {};
  if (stt.provider === "typeup_backend") {
    return hasRealValue(stt.api_base_url) && hasRealValue(stt.access_token);
  }
  switch (stt.provider) {
    case "aliyun":
      return hasRealValue(stt.access_key_id) && hasRealValue(stt.access_key_secret) && hasRealValue(stt.app_key);
    case "volcengine":
      return hasRealValue(stt.app_id) && hasRealValue(stt.token);
    case "xunfei":
      return hasRealValue(stt.app_id) && hasRealValue(stt.api_key) && hasRealValue(stt.api_secret);
    default:
      return hasRealValue(stt.api_key);
  }
}

function hasRealValue(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const lowered = text.toLowerCase();
  return !(
    lowered === "..." ||
    lowered.includes("your_") ||
    lowered.includes("your-") ||
    lowered.startsWith("sk-...") ||
    lowered.endsWith("...") ||
    lowered === "changeme"
  );
}

function withTypeUpMarker(config) {
  return deepMerge(config, { typeup: { managed: true, version: CONFIG_VERSION } });
}

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = deepMerge(out[key] || {}, value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function pruneEmpty(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    const pruned = pruneEmpty(child);
    if (pruned === undefined) continue;
    if (typeof pruned === "number" && Number.isNaN(pruned)) continue;
    out[key] = pruned;
  }
  return out;
}

function stringValue(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

function hotkeyValue(value) {
  if (Array.isArray(value)) {
    const tokens = value.map((item) => String(item).trim()).filter(Boolean);
    return tokens.length ? tokens : undefined;
  }
  return stringValue(value);
}

module.exports = {
  ensureDefaultConfig,
  readSettings,
  updateSettings,
  readCloudBridge,
  updateCloudBridge,
};
