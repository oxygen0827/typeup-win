const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function engineUserDir() {
  return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "TypeUp", "engine");
}

function engineLogPath(userDir) {
  return path.join(userDir, "agent.log");
}

function resolveLaunch(engineDir, extraArgs = []) {
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

module.exports = {
  engineLogPath,
  engineUserDir,
  resolveLaunch,
};
