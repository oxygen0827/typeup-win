const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { TextDecoder } = require("node:util");
const { ensureDefaultConfig, readSettings } = require("./settings-store");
const {
  createPlatformAdapter,
  engineLogPath,
  engineUserDir,
  resolveLaunch,
} = require("./platform");

const MAX_LOGS = 220;

class AgentManager extends EventEmitter {
  constructor({ electronApp }) {
    super();
    this.electronApp = electronApp;
    this.child = null;
    this.state = "stopped";
    this.pid = null;
    this.lastError = "";
    this.startedAt = null;
    this.exitedAt = null;
    this.logLines = [];
    this._activeLaunch = null;
    this.platformAdapter = createPlatformAdapter({ electronApp });
  }

  engineDir() {
    if (this.electronApp.isPackaged) {
      return path.join(process.resourcesPath, "engine", "voice-keyboard");
    }
    return path.join(this.electronApp.getAppPath(), "engine", "voice-keyboard");
  }

  macEngineAppPath() {
    if (process.platform !== "darwin") return "";
    return this.platformAdapter.engineAppPath(this.engineDir());
  }

  engineUserDir() {
    return engineUserDir();
  }

  async ensureConfig() {
    ensureDefaultConfig();
    return readSettings();
  }

  status() {
    const settings = readSettings();
    return {
      state: this.state,
      pid: this.pid,
      startedAt: this.startedAt,
      exitedAt: this.exitedAt,
      lastError: this.lastError,
      configured: settings.configured,
      configPath: settings.configPath,
      historyPath: path.join(this.engineUserDir(), "history.jsonl"),
      logPath: engineLogPath(this.engineUserDir()),
      engineDir: this.engineDir(),
      mode: settings.audio?.mode || "vad",
      provider: settings.stt?.provider || "",
      typingMethod: settings.typing?.method || "unicode",
    };
  }

  logs() {
    return [...this.logLines];
  }

  async start() {
    if (this.child) return this.status();
    await this.ensureConfig();

    const engineDir = this.engineDir();
    if (!fs.existsSync(engineDir)) {
      this._setState("error", `找不到本地语音引擎: ${engineDir}`);
      return this.status();
    }

    const launch = this._resolveLaunch(engineDir);
    this._setState("starting");
    this.lastError = "";
    this.startedAt = Date.now();
    this.exitedAt = null;

    this.child = spawn(launch.command, launch.args, {
      cwd: engineDir,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        TYPEUP_DESKTOP: "1",
        TYPEUP_ENGINE_USER_DIR: this.engineUserDir(),
      },
    });

    this.pid = this.child.pid;
    this._activeLaunch = launch;
    this._appendLog(`[typeup] 启动语音引擎 PID=${this.pid}`);

    this.child.stdout.on("data", (chunk) => this._handleOutput(chunk));
    this.child.stderr.on("data", (chunk) => this._handleOutput(chunk, true));
    this.child.once("error", (error) => {
      this.lastError = error.message;
      this._appendLog(`[typeup] 引擎启动失败: ${error.message}`);
      this._setState("error", error.message);
    });
    this.child.once("exit", (code, signal) => {
      this._appendLog(`[typeup] 引擎退出 code=${code ?? ""} signal=${signal ?? ""}`);
      this.child = null;
      this._activeLaunch = null;
      this.pid = null;
      this.exitedAt = Date.now();
      if (this.state !== "stopping") {
        this.state = code === 0 ? "stopped" : "error";
        if (code !== 0) this.lastError = `进程退出 code=${code ?? "unknown"}`;
      } else {
        this.state = "stopped";
      }
      this.emit("exit", this.status());
      this.emit("status", this.status());
    });

    return this.status();
  }

  async stop() {
    if (!this.child) {
      this._setState("stopped");
      return this.status();
    }
    this._setState("stopping");
    const child = this.child;
    let exited = false;
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!exited) {
          child.kill("SIGKILL");
        }
      }, 2500);
      const forceResolveTimer = setTimeout(resolve, 4000);
      child.once("exit", () => {
        exited = true;
        clearTimeout(timer);
        clearTimeout(forceResolveTimer);
        resolve();
      });
      child.kill("SIGTERM");
    });
    if (!exited && this.child === child) {
      this.child = null;
      this._activeLaunch = null;
      this.pid = null;
    }
    return this.status();
  }

  async restart() {
    await this.stop();
    return this.start();
  }

  async listDevices() {
    const engineDir = this.engineDir();
    const launch = this._resolveLaunch(engineDir, ["--list-devices"]);
    return new Promise((resolve, reject) => {
      const child = spawn(launch.command, launch.args, {
        cwd: engineDir,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          TYPEUP_DESKTOP: "1",
          TYPEUP_ENGINE_USER_DIR: this.engineUserDir(),
        },
      });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString("utf8");
      });
      child.once("error", reject);
      child.once("exit", () => resolve(output.trim()));
    });
  }

  async permissions() {
    if (process.platform !== "darwin") {
      return {
        accessibility: "granted",
        input_monitoring: "granted",
        microphone: "granted",
      };
    }
    return this.platformAdapter.permissions(
      (args) => this._runAgentJsonCommand(args),
      (dbPath, services) => this._queryTccDatabase(dbPath, services),
      (line) => this._appendLog(line),
    );
  }

  async requestMicrophone() {
    if (process.platform !== "darwin") return { microphone: "granted" };
    return this.platformAdapter.requestMicrophone(
      (args) => this._runAgentJsonCommand(args),
      () => this.permissions(),
      (line) => this._appendLog(line),
    );
  }

  async requestPermission(name) {
    if (process.platform !== "darwin") return { [name]: "granted" };
    return this.platformAdapter.requestPermission(
      name,
      (args) => this._runAgentJsonCommand(args),
      () => this.permissions(),
    );
  }

  _runAgentCommand(extraArgs = []) {
    const engineDir = this.engineDir();
    const launch = this._resolveLaunch(engineDir, extraArgs);
    return new Promise((resolve, reject) => {
      const child = spawn(launch.command, launch.args, {
        cwd: engineDir,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          TYPEUP_DESKTOP: "1",
          TYPEUP_ENGINE_USER_DIR: this.engineUserDir(),
        },
      });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString("utf8");
      });
      child.once("error", reject);
      child.once("exit", () => resolve(output.trim()));
    });
  }

  async _runAgentJsonCommand(extraArgs = []) {
    const output = await this._runAgentCommand(extraArgs);
    const parsed = parseLastJson(output);
    if (!parsed) {
      throw new Error(`Engine command did not return JSON: ${output.slice(-500)}`);
    }
    return parsed;
  }

  _resolveLaunch(engineDir, extraArgs = []) {
    return resolveLaunch(engineDir, extraArgs, this.platformAdapter);
  }

  _queryTccDatabase(dbPath, services) {
    if (!fs.existsSync(dbPath)) return Promise.resolve({});
    const serviceList = services.map((item) => `'${item.replaceAll("'", "''")}'`).join(",");
    const sql = [
      "select service, auth_value from access",
      "where client = 'com.typeup.engine'",
      `and service in (${serviceList})`,
      "order by last_modified asc;",
    ].join(" ");
    return new Promise((resolve) => {
      const child = spawn("sqlite3", [dbPath, sql], { windowsHide: true });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk.toString("utf8");
      });
      child.once("error", () => resolve({}));
      child.once("exit", () => {
        const rows = {};
        for (const line of output.split(/\r?\n/)) {
          const [service, value] = line.trim().split("|");
          if (!service) continue;
          rows[service] = Number(value);
        }
        resolve(rows);
      });
    });
  }

  _handleOutput(chunk, isError = false) {
    const text = decodeProcessOutput(chunk);
    for (const line of text.split(/\r?\n/)) {
      const clean = line.trim();
      if (!clean) continue;
      this._appendLog(clean);
      this._inferState(clean, isError);
    }
  }

  _inferState(line, isError) {
    if (
      line.includes("未配置 stt") ||
      line.includes("请编辑填入 API Key") ||
      line.includes("[typeup-auth-required]") ||
      line.includes("请先登录 TypeUp")
    ) {
      this._setState("needs_config");
      return;
    }
    if (
      line.includes("开始监听") ||
      line.includes("等待语音") ||
      line.includes("Voice Keyboard Agent 启动") ||
      line.includes("[typeup] 输入完成")
    ) {
      this._setState("listening");
      return;
    }
    if (line.startsWith("[audio]") && !line.includes("错误") && !line.toLowerCase().includes("error")) {
      this._setState("listening");
      return;
    }
    if (line.includes("已同步最新后端登录凭证")) {
      this._setState("listening");
      return;
    }
    if (line.includes("识别中") || line.includes("解析AI指令") || line.includes("解析编辑指令")) {
      this._setState("transcribing");
      return;
    }
    if (line.startsWith("[stt]")) {
      this._setState("listening");
      return;
    }
    if (isError || line.includes("失败") || line.includes("错误") || line.toLowerCase().includes("error")) {
      this.lastError = line;
      this._setState("error");
    }
  }

  _appendLog(line) {
    const item = { ts: Date.now(), line };
    this.logLines.push(item);
    if (this.logLines.length > MAX_LOGS) {
      this.logLines = this.logLines.slice(-MAX_LOGS);
    }
    this.emit("log", item);
  }

  _setState(state, error = "") {
    if (error) this.lastError = error;
    if (this.state === state && !error) return;
    this.state = state;
    this.emit("status", this.status());
  }
}

function decodeProcessOutput(chunk) {
  const utf8 = new TextDecoder("utf-8").decode(chunk);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("gb18030").decode(chunk);
  } catch (_error) {
    return utf8;
  }
}

function parseLastJson(output) {
  for (const line of String(output || "").split(/\r?\n/).reverse()) {
    const text = line.trim();
    if (!text.startsWith("{")) continue;
    try {
      return JSON.parse(text);
    } catch (_error) {
      // Keep scanning; py2app can print startup lines before JSON.
    }
  }
  return null;
}

module.exports = { AgentManager };
