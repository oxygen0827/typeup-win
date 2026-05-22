const http = require("node:http");
const { spawn } = require("node:child_process");
const express = require("express");
const cors = require("cors");
const { AgentManager } = require("./agent-manager");
const { readUsage } = require("./usage-store");
const {
  readSettings,
  updateSettings,
  readCloudBridge,
  updateCloudBridge,
} = require("./settings-store");

const DEFAULT_BACKEND_URL = process.env.TYPEUP_BACKEND_URL || "http://150.158.146.192:6053";
const DEFAULT_BACKEND_TIMEOUT_MS = 30000;
const LOCAL_RENDERER_PORTS = new Set(["5173", "4173"]);
const LOCAL_RENDERER_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MAC_PERMISSION_URLS = {
  accessibility: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
  input_monitoring: "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent",
  microphone: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
};

class BackendRequestError extends Error {
  constructor(status, body) {
    const message = body?.error?.message || body?.detail || body?.message || `Backend HTTP ${status}`;
    super(message);
    this.name = "BackendRequestError";
    this.status = status;
    this.body = body;
  }
}

function normalizeBackendUrl(value) {
  const text = String(value || DEFAULT_BACKEND_URL).trim();
  return text.replace(/\/+$/, "") || DEFAULT_BACKEND_URL;
}

function publicSession(cloud) {
  return {
    apiBaseUrl: normalizeBackendUrl(cloud.apiBaseUrl),
    connected: Boolean(cloud.connected),
    authenticated: Boolean(cloud.accessToken),
    user: cloud.user || null,
    entitlement: cloud.entitlement || null,
    updatedAt: cloud.updatedAt || null,
    path: cloud.path,
  };
}

function applyBackendEngineConfig(cloud) {
  const apiBaseUrl = normalizeBackendUrl(cloud.apiBaseUrl);
  const accessToken = String(cloud.accessToken || "");
  const refreshToken = String(cloud.refreshToken || "");
  updateSettings({
    stt: {
      provider: "typeup_backend",
      api_base_url: apiBaseUrl,
      access_token: accessToken,
      refresh_token: refreshToken,
      cloud_bridge_path: cloud.path,
      model: "glm-asr-2512",
      language: "zh",
    },
    llm: {
      provider: "typeup_backend",
      api_base_url: apiBaseUrl,
      access_token: accessToken,
      refresh_token: refreshToken,
      cloud_bridge_path: cloud.path,
      model: "glm-4-flash",
    },
  });
}

function clearAuthSession(apiBaseUrl) {
  const current = readCloudBridge();
  const cloud = updateCloudBridge({
    apiBaseUrl: apiBaseUrl || current.apiBaseUrl,
    connected: false,
    accessToken: "",
    refreshToken: "",
    user: null,
    entitlement: null,
  });
  applyBackendEngineConfig(cloud);
  return publicSession(cloud);
}

async function backendJson(apiBaseUrl, path, options = {}) {
  let response;
  try {
    response = await fetch(`${normalizeBackendUrl(apiBaseUrl)}${path}`, {
      ...options,
      signal: options.signal || AbortSignal.timeout(options.timeoutMs || DEFAULT_BACKEND_TIMEOUT_MS),
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
    throw new BackendRequestError(502, {
      error: {
        code: timedOut ? "BACKEND_TIMEOUT" : "BACKEND_UNAVAILABLE",
        message: timedOut ? "TypeUp 后端请求超时，请确认服务是否可用" : "无法连接 TypeUp 后端，请确认服务已启动或后端地址正确",
        status: 502,
      },
    });
  }
  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new BackendRequestError(response.status, body || { message: text });
  }
  return body;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { message: text };
  }
}

function isAllowedLocalOrigin(origin) {
  if (!origin || origin === "null" || origin === "file://") return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "file:") return true;
    if (parsed.protocol !== "http:") return false;
    return LOCAL_RENDERER_HOSTS.has(parsed.hostname) && LOCAL_RENDERER_PORTS.has(parsed.port);
  } catch (_error) {
    return false;
  }
}

function localCorsOrigin(origin, callback) {
  callback(null, isAllowedLocalOrigin(origin) ? origin || true : false);
}

function enforceLocalOrigin(req, res, next) {
  if (isAllowedLocalOrigin(req.get("origin"))) {
    next();
    return;
  }
  res.status(403).json({
    error: {
      code: "FORBIDDEN_ORIGIN",
      message: "跨源请求被本地服务拒绝",
      status: 403,
    },
  });
}

async function fetchBackendMe(cloud) {
  return backendJson(cloud.apiBaseUrl, "/v1/auth/me", {
    headers: { Authorization: `Bearer ${cloud.accessToken}` },
  });
}

async function persistAuthSession(apiBaseUrl, authPayload) {
  let cloud = updateCloudBridge({
    apiBaseUrl,
    authMode: "backend",
    connected: true,
    accessToken: authPayload.access_token,
    refreshToken: authPayload.refresh_token,
    user: authPayload.user,
    entitlement: null,
  });
  applyBackendEngineConfig(cloud);

  const me = await fetchBackendMe(cloud);
  cloud = updateCloudBridge({
    apiBaseUrl,
    connected: true,
    user: me.user,
    entitlement: me.entitlement,
  });
  applyBackendEngineConfig(cloud);
  return publicSession(cloud);
}

async function refreshAuthSession() {
  const cloud = readCloudBridge();
  if (!cloud.refreshToken) {
    throw new BackendRequestError(401, {
      error: { code: "UNAUTHORIZED", message: "请先登录", status: 401 },
    });
  }
  const auth = await backendJson(cloud.apiBaseUrl, "/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: cloud.refreshToken }),
  });
  return persistAuthSession(cloud.apiBaseUrl, auth);
}

async function authedBackendJson(path, options = {}) {
  let cloud = readCloudBridge();
  if (!cloud.accessToken) {
    throw new BackendRequestError(401, {
      error: { code: "UNAUTHORIZED", message: "请先登录", status: 401 },
    });
  }

  try {
    return await backendJson(cloud.apiBaseUrl, path, {
      ...options,
      headers: {
        Authorization: `Bearer ${cloud.accessToken}`,
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    if (error.status === 403) {
      clearAuthSession(cloud.apiBaseUrl);
      throw error;
    }
    if (error.status !== 401 || !cloud.refreshToken) throw error;
    try {
      await refreshAuthSession();
    } catch (refreshError) {
      if (refreshError.status === 401 || refreshError.status === 403) {
        clearAuthSession(cloud.apiBaseUrl);
      }
      throw refreshError;
    }
    cloud = readCloudBridge();
    return backendJson(cloud.apiBaseUrl, path, {
      ...options,
      headers: {
        Authorization: `Bearer ${cloud.accessToken}`,
        ...(options.headers || {}),
      },
    });
  }
}

function sendBackendError(res, error) {
  if (error instanceof BackendRequestError) {
    res.status(error.status).json(error.body);
    return;
  }
  res.status(500).json({
    error: {
      code: "LOCAL_BRIDGE_ERROR",
      message: error.message || "本地桥接服务错误",
      status: 500,
    },
  });
}

function createLocalServer({ electronApp }) {
  const app = express();
  const server = http.createServer(app);
  const agent = new AgentManager({ electronApp });
  const sseClients = new Set();
  applyBackendEngineConfig(readCloudBridge());

  function publish(event, payload) {
    const body = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of sseClients) {
      res.write(body);
    }
  }

  agent.on("status", (payload) => publish("status", payload));
  agent.on("log", (payload) => publish("log", payload));
  agent.on("exit", (payload) => publish("exit", payload));

  app.use(cors({ origin: localCorsOrigin }));
  app.use(enforceLocalOrigin);
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "typeup-local", time: Date.now() });
  });

  app.get("/api/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.write(`event: status\ndata: ${JSON.stringify(agent.status())}\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  });

  app.get("/api/status", (_req, res) => {
    res.json(agent.status());
  });

  app.get("/api/logs", (_req, res) => {
    res.json({ logs: agent.logs() });
  });

  app.post("/api/agent/start", async (_req, res) => {
    await agent.start();
    res.json(agent.status());
  });

  app.post("/api/agent/stop", async (_req, res) => {
    await agent.stop();
    res.json(agent.status());
  });

  app.post("/api/agent/restart", async (_req, res) => {
    await agent.restart();
    res.json(agent.status());
  });

  app.get("/api/devices", async (_req, res) => {
    try {
      const output = await agent.listDevices();
      res.json({ ok: true, output });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/permissions", async (_req, res) => {
    try {
      res.json({
        platform: process.platform,
        engineAppPath: process.platform === "darwin" ? agent.macEngineAppPath() : "",
        permissions: await agent.permissions(),
      });
    } catch (error) {
      res.status(500).json({ error: { code: "PERMISSION_CHECK_FAILED", message: error.message, status: 500 } });
    }
  });

  app.post("/api/permissions/engine/reveal", async (_req, res) => {
    if (process.platform !== "darwin") {
      res.status(400).json({ error: { code: "UNSUPPORTED_PLATFORM", message: "仅 macOS 支持显示授权对象", status: 400 } });
      return;
    }
    try {
      await revealInFinder(agent.macEngineAppPath());
      res.json({ ok: true, path: agent.macEngineAppPath() });
    } catch (error) {
      res.status(500).json({ error: { code: "REVEAL_ENGINE_FAILED", message: error.message, status: 500 } });
    }
  });

  app.post("/api/permissions/:name/open", async (req, res) => {
    const url = MAC_PERMISSION_URLS[req.params.name];
    if (process.platform !== "darwin" || !url) {
      res.status(400).json({ error: { code: "UNSUPPORTED_PERMISSION", message: "不支持的权限项", status: 400 } });
      return;
    }
    try {
      await openMacSettings(url);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: { code: "OPEN_SETTINGS_FAILED", message: error.message, status: 500 } });
    }
  });

  app.post("/api/permissions/:name/request", async (req, res) => {
    if (process.platform !== "darwin") {
      res.json({ [req.params.name]: "granted" });
      return;
    }
    try {
      res.json(await agent.requestPermission(req.params.name));
    } catch (error) {
      res.status(500).json({ error: { code: "PERMISSION_REQUEST_FAILED", message: error.message, status: 500 } });
    }
  });

  app.post("/api/permissions/microphone/request", async (_req, res) => {
    try {
      res.json(await agent.requestMicrophone());
    } catch (error) {
      res.status(500).json({ error: { code: "MICROPHONE_REQUEST_FAILED", message: error.message, status: 500 } });
    }
  });

  app.get("/api/usage", (_req, res) => {
    res.json(readUsage());
  });

  app.get("/api/settings", (_req, res) => {
    res.json(readSettings());
  });

  app.put("/api/settings", async (req, res) => {
    const settings = updateSettings(req.body || {});
    if (req.query.restart === "1") {
      await agent.restart();
    }
    res.json(settings);
  });

  app.get("/api/cloud", (_req, res) => {
    res.json(publicSession(readCloudBridge()));
  });

  app.put("/api/cloud", (req, res) => {
    const cloud = updateCloudBridge(req.body || {});
    applyBackendEngineConfig(cloud);
    res.json(publicSession(cloud));
  });

  app.get("/api/backend/health", async (req, res) => {
    try {
      const apiBaseUrl = normalizeBackendUrl(req.query.apiBaseUrl || readCloudBridge().apiBaseUrl);
      res.json(await backendJson(apiBaseUrl, "/health"));
    } catch (error) {
      sendBackendError(res, error);
    }
  });

  app.get("/api/auth/session", async (_req, res) => {
    const cloud = readCloudBridge();
    if (!cloud.accessToken) {
      res.json(publicSession(cloud));
      return;
    }
    try {
      const me = await fetchBackendMe(cloud);
      const next = updateCloudBridge({
        apiBaseUrl: cloud.apiBaseUrl,
        connected: true,
        user: me.user,
        entitlement: me.entitlement,
      });
      applyBackendEngineConfig(next);
      res.json(publicSession(next));
    } catch (error) {
      if (error.status === 401 && cloud.refreshToken) {
        try {
          res.json(await refreshAuthSession());
          return;
        } catch (_refreshError) {
          res.json(clearAuthSession(cloud.apiBaseUrl));
          return;
        }
      }
      if (error.status === 403) {
        res.json(clearAuthSession(cloud.apiBaseUrl));
        return;
      }
      if (error.status >= 500) {
        const next = updateCloudBridge({
          apiBaseUrl: cloud.apiBaseUrl,
          connected: false,
          entitlement: null,
        });
        res.json(publicSession(next));
        return;
      }
      sendBackendError(res, error);
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const apiBaseUrl = normalizeBackendUrl(req.body?.apiBaseUrl);
      const auth = await backendJson(apiBaseUrl, "/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: req.body?.email, password: req.body?.password }),
      });
      const session = await persistAuthSession(apiBaseUrl, auth);
      await agent.restart();
      res.json(session);
    } catch (error) {
      sendBackendError(res, error);
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const apiBaseUrl = normalizeBackendUrl(req.body?.apiBaseUrl);
      const auth = await backendJson(apiBaseUrl, "/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: req.body?.email, password: req.body?.password }),
      });
      const session = await persistAuthSession(apiBaseUrl, auth);
      await agent.restart();
      res.json(session);
    } catch (error) {
      sendBackendError(res, error);
    }
  });

  app.post("/api/auth/refresh", async (_req, res) => {
    try {
      res.json(await refreshAuthSession());
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        res.json(clearAuthSession(readCloudBridge().apiBaseUrl));
        return;
      }
      sendBackendError(res, error);
    }
  });

  app.post("/api/auth/logout", async (_req, res) => {
    const cloud = clearAuthSession(readCloudBridge().apiBaseUrl);
    await agent.restart();
    res.json(cloud);
  });

  app.get("/api/billing/plans", async (req, res) => {
    try {
      const apiBaseUrl = normalizeBackendUrl(req.query.apiBaseUrl || readCloudBridge().apiBaseUrl);
      res.json(await backendJson(apiBaseUrl, "/v1/plans"));
    } catch (error) {
      sendBackendError(res, error);
    }
  });

  app.post("/api/billing/orders", async (req, res) => {
    try {
      res.json(await authedBackendJson("/v1/orders", {
        method: "POST",
        body: JSON.stringify({
          plan_id: req.body?.plan_id,
          payment_method: req.body?.payment_method || "alipay",
        }),
      }));
    } catch (error) {
      sendBackendError(res, error);
    }
  });

  app.get("/api/billing/orders/:orderId", async (req, res) => {
    try {
      res.json(await authedBackendJson(`/v1/orders/${encodeURIComponent(req.params.orderId)}`));
    } catch (error) {
      sendBackendError(res, error);
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve({
        port: server.address().port,
        agent,
        close: async () => {
          await agent.stop();
          await new Promise((done) => server.close(done));
        },
      });
    });
  });
}

function openMacSettings(url) {
  return new Promise((resolve, reject) => {
    const child = spawn("open", [url], { windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`open exited with code ${code}`));
    });
  });
}

function revealInFinder(targetPath) {
  return new Promise((resolve, reject) => {
    const child = spawn("open", ["-R", targetPath], { windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`open -R exited with code ${code}`));
    });
  });
}

module.exports = { createLocalServer, isAllowedLocalOrigin };
