const assert = require("node:assert/strict");

const {
  shouldUseGithubApiUpdates,
  windowsFallbackInstallerCommand,
  shouldRefreshUpdateBeforeDownload,
} = require("../electron/updater");

assert.equal(shouldUseGithubApiUpdates("win32"), true);
assert.equal(shouldUseGithubApiUpdates("darwin"), false);
assert.equal(shouldUseGithubApiUpdates("linux"), false);
assert.equal(shouldRefreshUpdateBeforeDownload("idle", true, "win32"), true);
assert.equal(shouldRefreshUpdateBeforeDownload("available", false, "win32"), true);
assert.equal(shouldRefreshUpdateBeforeDownload("available", true, "win32"), false);
assert.equal(shouldRefreshUpdateBeforeDownload("available", false, "darwin"), false);

const installerPath = "C:\\Users\\TypeUp User\\Downloads\\TypeUp-Setup-0.1.23.exe";
const command = windowsFallbackInstallerCommand(installerPath, 1234);

assert.equal(command.command, "powershell.exe");
assert.equal(command.options.detached, true);
assert.equal(command.options.windowsHide, true);
assert.equal(command.args.at(-2), "1234");
assert.equal(command.args.at(-1), installerPath);
const script = command.args[4];
assert.match(script, /Wait-Process -Id \$pidToWait/);
assert.match(script, /Start-Process -FilePath \$installer/);
assert.match(script, /--updated/);
assert.doesNotMatch(script, /TypeUp-Setup-0\.1\.23/);

console.log("updater fallback helpers ok");
