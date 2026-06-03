const assert = require("node:assert/strict");

const {
  createDirectInstallerUpdate,
  shouldUseGithubApiUpdates,
  shouldUseDirectInstallerDownload,
  windowsFallbackInstallerCommand,
  shouldFallbackToPowerShellDownload,
  shouldRefreshUpdateBeforeDownload,
  isRetryableUpdateError,
  parseLatestYmlPath,
  parseLatestYmlSize,
  parseLatestYmlVersion,
} = require("../electron/updater");

assert.equal(shouldUseGithubApiUpdates("win32"), false);
assert.equal(shouldUseGithubApiUpdates("darwin"), false);
assert.equal(shouldUseGithubApiUpdates("linux"), false);
assert.equal(shouldUseDirectInstallerDownload("win32"), true);
assert.equal(shouldUseDirectInstallerDownload("darwin"), false);
assert.equal(shouldUseDirectInstallerDownload("linux"), false);
assert.equal(shouldRefreshUpdateBeforeDownload("idle", true, "win32"), true);
assert.equal(shouldRefreshUpdateBeforeDownload("available", false, "win32"), false);
assert.equal(shouldRefreshUpdateBeforeDownload("available", true, "win32"), false);
assert.equal(shouldRefreshUpdateBeforeDownload("available", false, "darwin"), false);
assert.equal(isRetryableUpdateError(new Error("GitHub request timed out")), true);
assert.equal(isRetryableUpdateError(new Error("request timeout")), true);
assert.equal(shouldFallbackToPowerShellDownload(new Error("GitHub request timed out"), "win32", "https://example.com/app.exe"), true);
assert.equal(shouldFallbackToPowerShellDownload(new Error("GitHub request timed out"), "darwin", "https://example.com/app.exe"), false);
assert.equal(shouldFallbackToPowerShellDownload(new Error("GitHub request failed: HTTP 404"), "win32", "https://example.com/app.exe"), false);
assert.equal(shouldFallbackToPowerShellDownload(new Error("GitHub request timed out"), "win32", ""), false);

const latestYml = [
  "version: 0.1.24",
  "files:",
  "  - url: TypeUp-Setup-0.1.24.exe",
  "    size: 124285748",
  "path: TypeUp-Setup-0.1.24.exe",
].join("\n");
assert.equal(parseLatestYmlVersion(latestYml), "0.1.24");
assert.equal(parseLatestYmlPath(latestYml), "TypeUp-Setup-0.1.24.exe");
assert.equal(parseLatestYmlSize(latestYml), 124285748);

const directUpdate = createDirectInstallerUpdate({
  version: "0.3.8",
  releaseName: "TypeUp v0.3.8",
  releaseNotes: "Fix updater download progress.",
  files: [
    {
      url: "TypeUp-Setup-0.3.8.exe",
      size: 125864316,
    },
  ],
}, "win32");
assert.equal(directUpdate.version, "0.3.8");
assert.equal(directUpdate.installerName, "TypeUp-Setup-0.3.8.exe");
assert.equal(directUpdate.installerSize, 125864316);
assert.equal(
  directUpdate.installerUrl,
  "http://150.158.146.192:6052/apps/typeup-win-release/TypeUp-Setup-0.3.8.exe",
);
assert.equal(createDirectInstallerUpdate({ version: "0.3.8" }, "darwin"), null);

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
