const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { TextDecoder } = require("node:util");
const { ensureDefaultConfig, readSettings } = require("./settings-store");

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
    this._macEngineAppPath = null;
    this._activeLaunch = null;
  }

  engineDir() {
    if (this.electronApp.isPackaged) {
      return path.join(process.resourcesPath, "engine", "voice-keyboard");
    }
    return path.join(this.electronApp.getAppPath(), "engine", "voice-keyboard");
  }

  macEngineAppPath() {
    if (process.platform !== "darwin") return "";
    if (this._macEngineAppPath && fs.existsSync(this._macEngineAppPath)) {
      return this._macEngineAppPath;
    }

    const bundledAppPath = this._bundledMacEngineAppPath();
    if (!this.electronApp.isPackaged || !fs.existsSync(bundledAppPath)) {
      this._macEngineAppPath = bundledAppPath;
      return bundledAppPath;
    }

    const installedAppPath = path.join(os.homedir(), "Library", "Application Support", "TypeUp", "TypeUp Engine.app");
    this._installMacEngineApp(bundledAppPath, installedAppPath);
    this._macEngineAppPath = installedAppPath;
    return installedAppPath;
  }

  engineUserDir() {
    if (process.env.TYPEUP_ENGINE_USER_DIR) return process.env.TYPEUP_ENGINE_USER_DIR;
    if (process.platform === "darwin") {
      return path.join(os.homedir(), "Library", "Application Support", "TypeUp", "engine");
    }
    if (process.platform === "win32") {
      return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "TypeUp", "engine");
    }
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "TypeUp", "engine");
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
      logPath: process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Logs", "TypeUp", "engine.log")
        : path.join(this.engineUserDir(), "agent.log"),
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
    if (launch.viaLaunchServices) {
      this._appendLog(`[typeup] 通过 macOS 应用包启动: ${this.macEngineAppPath()}`);
      setTimeout(() => {
        if (this.child && this.state === "starting") this._setState("listening");
      }, 1200);
    }

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
    const launch = this._activeLaunch;
    let exited = false;
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!exited) {
          if (launch?.viaLaunchServices) this._terminateMacEngineApp();
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
      if (launch?.viaLaunchServices) this._terminateMacEngineApp();
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
    return await this._permissionsFromTcc() || {
      accessibility: "unknown",
      input_monitoring: "unknown",
      microphone: "unknown",
    };
  }

  async requestMicrophone() {
    if (process.platform !== "darwin") return { microphone: "granted" };
    await this._runMacEngineAppCommand(["--request-microphone"], { resultJson: true });
    return this.permissions();
  }

  async requestPermission(name) {
    if (name === "accessibility") {
      await this._runMacEngineAppCommand(["--request-accessibility"], { resultJson: true });
      return this.permissions();
    }
    if (name === "input_monitoring") {
      await this._runMacEngineAppCommand(["--request-input-monitoring"], { resultJson: true });
      return this.permissions();
    }
    if (name === "microphone") {
      return this.requestMicrophone();
    }
    throw new Error(`Unsupported permission: ${name}`);
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

  _runMacEngineAppCommand(extraArgs = [], options = {}) {
    const appPath = this.macEngineAppPath();
    if (!appPath || !fs.existsSync(appPath)) {
      return Promise.reject(new Error(`找不到 TypeUp Engine.app: ${appPath}`));
    }
    const resultPath = options.resultJson
      ? path.join(os.tmpdir(), `typeup-engine-${process.pid}-${Date.now()}.json`)
      : "";
    const args = ["-n", "-W", appPath, "--args", ...extraArgs];
    if (resultPath) args.push("--result-json", resultPath);
    return new Promise((resolve, reject) => {
      const child = spawn("open", args, {
        windowsHide: true,
      });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString("utf8");
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) {
          if (resultPath && fs.existsSync(resultPath)) {
            const result = parseLastJson(fs.readFileSync(resultPath, "utf8"));
            fs.rmSync(resultPath, { force: true });
            resolve(result || output.trim());
            return;
          }
          resolve(output.trim());
        }
        else reject(new Error(output.trim() || `open exited with code ${code}`));
      });
    });
  }

  _resolveLaunch(engineDir, extraArgs = []) {
    const explicitExe = process.env.TYPEUP_AGENT_EXE;
    if (explicitExe && fs.existsSync(explicitExe)) {
      return { command: explicitExe, args: ["--no-serial", "--no-ui", ...extraArgs] };
    }

    if (process.platform === "darwin") {
      const appPath = this.macEngineAppPath();
      if (this.electronApp.isPackaged && extraArgs.length === 0) {
        return {
          command: "open",
          args: ["-n", "-W", appPath, "--args", "--no-serial", "--no-ui"],
          viaLaunchServices: true,
        };
      }
      for (const executableName of ["TypeUp Engine", "Voice Keyboard"]) {
        const typeupAppExecutable = path.join(appPath, "Contents", "MacOS", executableName);
        if (fs.existsSync(typeupAppExecutable)) {
          return { command: typeupAppExecutable, args: ["--no-serial", "--no-ui", ...extraArgs] };
        }
      }

      const venvPython = path.join(engineDir, ".venv", "bin", "python");
      const python = fs.existsSync(venvPython) ? venvPython : (process.env.TYPEUP_PYTHON || "python3");
      return {
        command: python,
        args: ["-u", "-m", "agent.main", "--no-serial", "--no-ui", ...extraArgs],
      };
    }

    const typeupExe = path.join(engineDir, "dist", "TypeUpAgent", "TypeUpAgent.exe");
    if (fs.existsSync(typeupExe)) {
      return { command: typeupExe, args: ["--no-serial", "--no-ui", ...extraArgs] };
    }

    const bundledExe = path.join(engineDir, "dist", "VoiceKeyboard", "VoiceKeyboard.exe");
    if (fs.existsSync(bundledExe)) {
      return { command: bundledExe, args: ["--no-serial", "--no-ui", ...extraArgs] };
    }

    const venvPython = path.join(engineDir, ".venv", "Scripts", "python.exe");
    const python = fs.existsSync(venvPython) ? venvPython : (process.env.TYPEUP_PYTHON || "python");
    return {
      command: python,
      args: ["-u", "-m", "agent.main", "--no-serial", "--no-ui", ...extraArgs],
    };
  }

  _bundledMacEngineAppPath() {
    const typeupEngine = path.join(this.engineDir(), "dist", "TypeUp Engine.app");
    if (fs.existsSync(typeupEngine)) return typeupEngine;
    return path.join(this.engineDir(), "dist", "Voice Keyboard.app");
  }

  _installMacEngineApp(sourcePath, targetPath) {
    const sourceInfo = path.join(sourcePath, "Contents", "Info.plist");
    const targetInfo = path.join(targetPath, "Contents", "Info.plist");
    if (!fs.existsSync(sourceInfo)) return;

    const targetExists = fs.existsSync(targetInfo);
    const sourceMtime = fs.statSync(sourceInfo).mtimeMs;
    const targetMtime = targetExists ? fs.statSync(targetInfo).mtimeMs : 0;
    if (targetExists && targetMtime >= sourceMtime) return;

    fs.rmSync(targetPath, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }

  _terminateMacEngineApp() {
    const appPath = this.macEngineAppPath();
    for (const executableName of ["TypeUp Engine", "Voice Keyboard"]) {
      const executablePath = path.join(appPath, "Contents", "MacOS", executableName);
      if (!fs.existsSync(executablePath)) continue;
      const child = spawn("pkill", ["-f", executablePath], { windowsHide: true });
      child.on("error", (error) => this._appendLog(`[typeup] 停止 macOS 引擎失败: ${error.message}`));
    }
  }

  async _permissionsFromTcc() {
    const systemRows = await this._queryTccDatabase("/Library/Application Support/com.apple.TCC/TCC.db", [
      "kTCCServiceAccessibility",
      "kTCCServiceListenEvent",
    ]);
    const userRows = await this._queryTccDatabase(
      path.join(os.homedir(), "Library", "Application Support", "com.apple.TCC", "TCC.db"),
      ["kTCCServiceMicrophone"],
    );
    return {
      accessibility: tccStatus(systemRows.kTCCServiceAccessibility),
      input_monitoring: tccStatus(systemRows.kTCCServiceListenEvent),
      microphone: tccStatus(userRows.kTCCServiceMicrophone, "not_determined"),
    };
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

function tccStatus(value, missing = "denied") {
  if (value === 2) return "granted";
  if (value === undefined || Number.isNaN(value)) return missing;
  return "denied";
}

module.exports = { AgentManager };
