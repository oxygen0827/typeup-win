const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function engineUserDir() {
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "TypeUp", "engine");
}

function engineLogPath(userDir) {
  return path.join(userDir, "agent.log");
}

function resolveLaunch(engineDir, extraArgs = []) {
  const venvPython = path.join(engineDir, ".venv", "bin", "python");
  const python = fs.existsSync(venvPython) ? venvPython : (process.env.TYPEUP_PYTHON || "python3");
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
