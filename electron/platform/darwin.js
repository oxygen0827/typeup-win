const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { systemPreferences } = require("electron");

const PERMISSION_SETTINGS_URLS = {
  accessibility: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
  input_monitoring: "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent",
  microphone: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
};

function engineUserDir() {
  return path.join(os.homedir(), "Library", "Application Support", "TypeUp", "engine");
}

function engineLogPath() {
  return path.join(os.homedir(), "Library", "Logs", "TypeUp", "engine.log");
}

class DarwinPlatform {
  constructor({ electronApp }) {
    this.electronApp = electronApp;
    this._engineAppPath = null;
  }

  engineAppPath(engineDir) {
    if (this._engineAppPath && fs.existsSync(this._engineAppPath)) {
      return this._engineAppPath;
    }

    const bundledAppPath = bundledEngineAppPath(engineDir);
    if (!this.electronApp.isPackaged || !fs.existsSync(bundledAppPath)) {
      this._engineAppPath = bundledAppPath;
      return bundledAppPath;
    }

    const installedAppPath = path.join(this.electronApp.getPath("userData"), "TypeUp Engine.app");
    installEngineApp(bundledAppPath, installedAppPath);
    this._engineAppPath = installedAppPath;
    return installedAppPath;
  }

  resolveLaunch(engineDir, extraArgs = []) {
    const appPath = this.engineAppPath(engineDir);
    for (const executableName of ["TypeUp Engine", "Voice Keyboard"]) {
      const executablePath = path.join(appPath, "Contents", "MacOS", executableName);
      if (fs.existsSync(executablePath)) {
        return { command: executablePath, args: ["--no-serial", "--no-ui", ...extraArgs] };
      }
    }

    const venvPython = path.join(engineDir, ".venv", "bin", "python");
    const python = fs.existsSync(venvPython) ? venvPython : (process.env.TYPEUP_PYTHON || "python3");
    return {
      command: python,
      args: ["-u", "-m", "agent.main", "--no-serial", "--no-ui", ...extraArgs],
    };
  }

  terminateEngineApp(engineDir, appendLog) {
    const appPath = this.engineAppPath(engineDir);
    for (const executableName of ["TypeUp Engine", "Voice Keyboard"]) {
      const executablePath = path.join(appPath, "Contents", "MacOS", executableName);
      if (!fs.existsSync(executablePath)) continue;
      const child = spawn("pkill", ["-f", executablePath], { windowsHide: true });
      child.on("error", (error) => appendLog(`[typeup] 停止 macOS 引擎失败: ${error.message}`));
    }
  }

  async permissions(runAgentJsonCommand, queryTccDatabase, appendLog) {
    return await permissionsFromRuntime(runAgentJsonCommand, appendLog)
      || await permissionsFromTcc(queryTccDatabase)
      || {
        accessibility: "unknown",
        input_monitoring: "unknown",
        microphone: "unknown",
      };
  }

  async requestPermission(name, runAgentJsonCommand, permissions) {
    if (name === "accessibility") {
      await runAgentJsonCommand(["--request-accessibility"]);
      return permissions();
    }
    if (name === "input_monitoring") {
      await runAgentJsonCommand(["--request-input-monitoring"]);
      return permissions();
    }
    if (name === "microphone") {
      return this.requestMicrophone(runAgentJsonCommand, permissions, () => {});
    }
    throw new Error(`Unsupported permission: ${name}`);
  }

  async requestMicrophone(runAgentJsonCommand, permissions, appendLog) {
    try {
      await systemPreferences.askForMediaAccess("microphone");
    } catch (error) {
      appendLog(`[typeup] 请求 TypeUp 麦克风权限失败: ${error.message}`);
    }
    await runAgentJsonCommand(["--request-microphone"]);
    return permissions();
  }

  permissionSettingsUrl(name) {
    return PERMISSION_SETTINGS_URLS[name] || "";
  }
}

function bundledEngineAppPath(engineDir) {
  const typeupEngine = path.join(engineDir, "dist", "TypeUp Engine.app");
  if (fs.existsSync(typeupEngine)) return typeupEngine;
  return path.join(engineDir, "dist", "Voice Keyboard.app");
}

function installEngineApp(sourcePath, targetPath) {
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

async function permissionsFromRuntime(runAgentJsonCommand, appendLog) {
  try {
    const result = await runAgentJsonCommand(["--permissions-json"]);
    if (!result || typeof result !== "object") return null;
    return {
      accessibility: normalizePermission(result.accessibility),
      input_monitoring: normalizePermission(result.input_monitoring),
      microphone: normalizePermission(result.microphone),
    };
  } catch (error) {
    appendLog(`[typeup] 运行时权限检测失败: ${error.message}`);
    return null;
  }
}

async function permissionsFromTcc(queryTccDatabase) {
  const systemRows = await queryTccDatabase("/Library/Application Support/com.apple.TCC/TCC.db", [
    "kTCCServiceAccessibility",
    "kTCCServiceListenEvent",
  ]);
  const userRows = await queryTccDatabase(
    path.join(os.homedir(), "Library", "Application Support", "com.apple.TCC", "TCC.db"),
    ["kTCCServiceMicrophone"],
  );
  return {
    accessibility: tccStatus(systemRows.kTCCServiceAccessibility),
    input_monitoring: tccStatus(systemRows.kTCCServiceListenEvent),
    microphone: tccStatus(userRows.kTCCServiceMicrophone, "not_determined"),
  };
}

function tccStatus(value, missing = "denied") {
  if (value === 2) return "granted";
  if (value === undefined || Number.isNaN(value)) return missing;
  return "denied";
}

function normalizePermission(value) {
  const text = String(value || "").trim();
  return ["granted", "denied", "not_determined", "unknown"].includes(text) ? text : "unknown";
}

module.exports = {
  DarwinPlatform,
  engineLogPath,
  engineUserDir,
};
