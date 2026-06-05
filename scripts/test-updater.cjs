const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const {
  createManifestInstallerUpdate,
  createDirectInstallerUpdate,
  getDownloadCandidates,
  shouldUseGithubApiUpdates,
  shouldUseDirectInstallerDownload,
  windowsFallbackInstallerCommand,
  shouldFallbackToPowerShellDownload,
  shouldRefreshUpdateBeforeDownload,
  isRetryableUpdateError,
  normalizeInstallerDigest,
  parseContentRangeTotal,
  parseLatestYmlPath,
  parseLatestYmlSize,
  parseLatestYmlVersion,
  requestFileWithRetry,
} = require("../electron/updater");

async function main() {
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
  assert.equal(parseContentRangeTotal("bytes 100-1023/4096"), 4096);
  assert.equal(normalizeInstallerDigest("ABCDEFabcdefABCDEFabcdefABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD"), "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd");

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

  const manifestUpdate = createManifestInstallerUpdate({
    version: "0.3.10",
    releaseName: "TypeUp 0.3.10",
    publishedAt: "2026-06-05T00:00:00Z",
    files: {
      windows: {
        name: "TypeUp-Setup-0.3.10.exe",
        url: "TypeUp-Setup-0.3.10.exe",
        size: 1234,
        sha256: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      },
    },
    alternateUrls: ["https://cdn.example.com/typeup/TypeUp-Setup-0.3.10.exe"],
  }, "win32");
  assert.equal(manifestUpdate.version, "0.3.10");
  assert.equal(manifestUpdate.installerSize, 1234);
  assert.equal(manifestUpdate.installerDigest, "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  assert.deepEqual(getDownloadCandidates(manifestUpdate), [
    "http://150.158.146.192:6052/apps/typeup-win-release/TypeUp-Setup-0.3.10.exe",
    "https://cdn.example.com/typeup/TypeUp-Setup-0.3.10.exe",
  ]);

const installerPath = "C:\\Users\\TypeUp User\\Downloads\\TypeUp-Setup-0.1.23.exe";
const command = windowsFallbackInstallerCommand(installerPath, 1234);

assert.equal(command.command, "cmd.exe");
assert.equal(command.options.detached, true);
assert.equal(command.options.windowsHide, true);
assert.deepEqual(command.args.slice(0, 6), ["/d", "/s", "/c", "start", "\"\"", "/min"]);
assert.equal(command.args.includes("-EncodedCommand"), true);
const encodedScript = command.args.at(-1);
const script = Buffer.from(encodedScript, "base64").toString("utf16le");
assert.match(script, /Wait-Process -Id \$pidToWait/);
assert.match(script, /Start-Process -FilePath \$installer/);
assert.match(script, /--updated/);
assert.match(script, /1234/);
assert.match(script, /TypeUp-Setup-0\.1\.23/);
assert.doesNotMatch(command.args.join(" "), /TypeUp-Setup-0\.1\.23/);

  await testRangeResumeDownload();

  console.log("updater fallback helpers ok");
}

async function testRangeResumeDownload() {
  const payload = Buffer.alloc(128 * 1024);
  for (let index = 0; index < payload.length; index += 1) {
    payload[index] = index % 251;
  }
  let sawRange = false;
  const server = http.createServer((request, response) => {
    const range = request.headers.range || "";
    if (range) {
      sawRange = true;
      const match = String(range).match(/^bytes=(\d+)-$/);
      const start = match ? Number(match[1]) : 0;
      response.writeHead(206, {
        "Accept-Ranges": "bytes",
        "Content-Length": payload.length - start,
        "Content-Range": `bytes ${start}-${payload.length - 1}/${payload.length}`,
      });
      response.end(payload.subarray(start));
      return;
    }
    response.writeHead(200, {
      "Accept-Ranges": "bytes",
      "Content-Length": payload.length,
    });
    response.end(payload);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "typeup-updater-test-"));
  try {
    const destination = path.join(tempDir, "TypeUp-Setup-0.3.10.exe");
    const partialSize = 32 * 1024;
    await fs.promises.writeFile(`${destination}.part`, payload.subarray(0, partialSize));
    const progressEvents = [];
    await requestFileWithRetry(`http://127.0.0.1:${server.address().port}/installer.exe`, destination, {
      expectedSize: payload.length,
      onProgress: (progress) => progressEvents.push(progress),
    });
    assert.equal(sawRange, true);
    assert.equal(fs.existsSync(`${destination}.part`), false);
    assert.deepEqual(await fs.promises.readFile(destination), payload);
    assert.equal(crypto.createHash("sha256").update(await fs.promises.readFile(destination)).digest("hex").length, 64);
    assert.equal(progressEvents.some((event) => event.received === partialSize), true);
  } finally {
    server.close();
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
