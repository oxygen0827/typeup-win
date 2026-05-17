const fs = require("node:fs");
const darwin = require("./darwin");
const win32 = require("./win32");
const generic = require("./generic");

function createPlatformAdapter({ electronApp }) {
  if (process.platform === "darwin") return new darwin.DarwinPlatform({ electronApp });
  return null;
}

function engineUserDir() {
  if (process.env.TYPEUP_ENGINE_USER_DIR) return process.env.TYPEUP_ENGINE_USER_DIR;
  if (process.platform === "darwin") return darwin.engineUserDir();
  if (process.platform === "win32") return win32.engineUserDir();
  return generic.engineUserDir();
}

function engineLogPath(userDir) {
  if (process.platform === "darwin") return darwin.engineLogPath();
  if (process.platform === "win32") return win32.engineLogPath(userDir);
  return generic.engineLogPath(userDir);
}

function resolveLaunch(engineDir, extraArgs = [], adapter = null) {
  const explicitExe = process.env.TYPEUP_AGENT_EXE;
  if (explicitExe && fs.existsSync(explicitExe)) {
    return { command: explicitExe, args: ["--no-serial", "--no-ui", ...extraArgs] };
  }
  if (process.platform === "darwin") return adapter.resolveLaunch(engineDir, extraArgs);
  if (process.platform === "win32") return win32.resolveLaunch(engineDir, extraArgs);
  return generic.resolveLaunch(engineDir, extraArgs);
}

module.exports = {
  createPlatformAdapter,
  engineLogPath,
  engineUserDir,
  resolveLaunch,
};
