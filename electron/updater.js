const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const UPDATE_EVENT = "typeup:update:event";
const GITHUB_OWNER = "oxygen0827";
const GITHUB_REPO = "typeup-win";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const USER_AGENT = "TypeUpUpdater/1.0";
const REQUEST_TIMEOUT_MS = 20000;
const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNABORTED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ERR_CONNECTION_RESET",
]);

function setupAutoUpdates({ app, ipcMain, getMainWindow, isDev, beforeInstall }) {
  const canUpdate = app.isPackaged && !isDev;
  const autoUpdater = canUpdate ? require("electron-updater").autoUpdater : null;
  let checking = false;
  let fallbackUpdate = null;
  let fallbackInstallerPath = "";
  let pendingSilentCheck = false;
  let state = {
    status: canUpdate ? "idle" : "disabled",
    currentVersion: app.getVersion(),
    availableVersion: "",
    progress: 0,
    error: "",
  };

  function getState() {
    return { ...state, currentVersion: app.getVersion() };
  }

  function publish() {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(UPDATE_EVENT, getState());
    }
  }

  function setState(patch, options = {}) {
    state = {
      ...state,
      ...patch,
      currentVersion: app.getVersion(),
    };
    if (!options.silent) publish();
    return getState();
  }

  function setError(error, options = {}) {
    const message = error?.message || String(error || "Update failed");
    if (options.silent) {
      return setState({ status: "idle", error: "", progress: 0 }, { silent: true });
    }
    return setState({ status: "error", error: message, progress: 0 });
  }

  if (canUpdate) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on("checking-for-update", () => {
      setState({ status: "checking", error: "", progress: 0 }, { silent: pendingSilentCheck });
    });

    autoUpdater.on("update-available", (info = {}) => {
      fallbackUpdate = null;
      fallbackInstallerPath = "";
      setState({
        status: "available",
        availableVersion: info.version || "",
        releaseName: info.releaseName || "",
        progress: 0,
        error: "",
      });
    });

    autoUpdater.on("update-not-available", () => {
      fallbackUpdate = null;
      fallbackInstallerPath = "";
      setState(
        {
          status: pendingSilentCheck ? "idle" : "latest",
          availableVersion: "",
          progress: 0,
          error: "",
        },
        { silent: pendingSilentCheck },
      );
    });

    autoUpdater.on("download-progress", (progress = {}) => {
      setState({
        status: "downloading",
        progress: Math.max(0, Math.min(100, Number(progress.percent || 0))),
        error: "",
      });
    });

    autoUpdater.on("update-downloaded", (info = {}) => {
      setState({
        status: "downloaded",
        availableVersion: info.version || state.availableVersion,
        progress: 100,
        error: "",
      });
    });

    autoUpdater.on("error", (error) => {
      setError(error, { silent: pendingSilentCheck });
    });
  }

  async function checkForUpdates(options = {}) {
    if (!canUpdate) return getState();
    if (checking || state.status === "downloading") return getState();
    checking = true;
    pendingSilentCheck = Boolean(options.silent);
    fallbackUpdate = null;
    fallbackInstallerPath = "";
    setState({ status: "checking", error: "", progress: 0 }, { silent: pendingSilentCheck });
    try {
      await autoUpdater.checkForUpdates();
      if (state.status === "error" && isRetryableUpdateError(state.error)) {
        await checkForUpdatesViaGithubApi({ silent: pendingSilentCheck });
      }
    } catch (error) {
      if (isRetryableUpdateError(error)) {
        await checkForUpdatesViaGithubApi({ silent: pendingSilentCheck });
      } else {
        setError(error, { silent: pendingSilentCheck });
      }
    } finally {
      checking = false;
      pendingSilentCheck = false;
    }
    return getState();
  }

  async function checkForUpdatesViaGithubApi(options = {}) {
    try {
      const release = await requestJson(`${GITHUB_API_BASE}/releases/latest`);
      const latestVersion = parseVersion(release?.tag_name || release?.name || "");
      if (!latestVersion) {
        throw new Error("GitHub release does not include a valid version");
      }
      if (compareVersions(latestVersion, app.getVersion()) <= 0) {
        fallbackUpdate = null;
        fallbackInstallerPath = "";
        setState(
          {
            status: options.silent ? "idle" : "latest",
            availableVersion: "",
            progress: 0,
            error: "",
          },
          { silent: options.silent },
        );
        return;
      }

      const installer = findReleaseAsset(release, latestVersion, ".exe");
      if (!installer) {
        throw new Error(`Cannot find TypeUp installer in GitHub release v${latestVersion}`);
      }
      fallbackUpdate = {
        version: latestVersion,
        releaseName: release.name || `TypeUp ${latestVersion}`,
        installerAssetId: installer.id,
        installerUrl: installer.browser_download_url,
        installerName: installer.name,
        installerSize: Number(installer.size || 0),
        installerDigest: installer.digest || "",
      };
      fallbackInstallerPath = "";
      setState(
        {
          status: "available",
          availableVersion: latestVersion,
          releaseName: fallbackUpdate.releaseName,
          progress: 0,
          error: "",
        },
        { silent: options.silent },
      );
    } catch (error) {
      setError(error, { silent: options.silent });
    }
  }

  async function downloadUpdate() {
    if (!canUpdate) return getState();
    if (state.status === "downloading") return getState();
    if (state.status !== "available" && state.status !== "error") {
      await checkForUpdates({ silent: false });
      if (state.status !== "available") return getState();
    }
    setState({ status: "downloading", progress: 0, error: "" });
    try {
      if (fallbackUpdate) {
        fallbackInstallerPath = await downloadFallbackInstaller(fallbackUpdate, (percent) => {
          setState({ status: "downloading", progress: percent, error: "" });
        });
        setState({
          status: "downloaded",
          availableVersion: fallbackUpdate.version,
          progress: 100,
          error: "",
        });
      } else {
        await autoUpdater.downloadUpdate();
      }
    } catch (error) {
      if (!fallbackUpdate && isRetryableUpdateError(error)) {
        await checkForUpdatesViaGithubApi({ silent: false });
        if (fallbackUpdate) {
          return downloadUpdate();
        }
      }
      setError(error);
    }
    return getState();
  }

  async function installUpdate() {
    if (!canUpdate || state.status !== "downloaded") return getState();
    try {
      setState({ status: "installing", error: "" });
      if (typeof beforeInstall === "function") {
        await beforeInstall();
      }
      if (fallbackInstallerPath) {
        spawn(fallbackInstallerPath, ["--updated", "/S", "--force-run"], {
          detached: true,
          stdio: "ignore",
        }).unref();
        app.quit();
      } else {
        autoUpdater.quitAndInstall(true, true);
      }
    } catch (error) {
      setError(error);
    }
    return getState();
  }

  ipcMain.handle("typeup:update:get-state", () => getState());
  ipcMain.handle("typeup:update:check", () => checkForUpdates({ silent: false }));
  ipcMain.handle("typeup:update:download", () => downloadUpdate());
  ipcMain.handle("typeup:update:install", () => installUpdate());

  return {
    getState,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    startupCheck() {
      if (!canUpdate) return;
      setTimeout(() => {
        checkForUpdates({ silent: true }).catch(() => {});
      }, 2500);
    },
  };
}

function requestJson(url) {
  return requestBufferWithRetry(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
    },
  }).then((buffer) => JSON.parse(buffer.toString("utf8")));
}

async function downloadFallbackInstaller(update, onProgress) {
  const cacheDir = path.join(os.tmpdir(), "typeup-updater-fallback");
  await fs.promises.mkdir(cacheDir, { recursive: true });
  const destination = path.join(cacheDir, update.installerName);
  if (process.platform === "win32" && update.installerUrl) {
    if (typeof onProgress === "function") onProgress(5);
    try {
      await downloadWithPowerShell(update.installerUrl, destination);
      await verifyDownloadedFile(destination, update);
      if (typeof onProgress === "function") onProgress(100);
      return destination;
    } catch (error) {
      await fs.promises.unlink(destination).catch(() => {});
    }
  }
  const url = `${GITHUB_API_BASE}/releases/assets/${update.installerAssetId}`;
  await requestFileWithRetry(url, destination, {
    expectedSize: update.installerSize,
    onProgress,
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": USER_AGENT,
    },
  });
  await verifyDownloadedFile(destination, update);
  return destination;
}

function downloadWithPowerShell(url, destination) {
  return new Promise((resolve, reject) => {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$ProgressPreference = 'SilentlyContinue'",
      "Invoke-WebRequest -Uri $args[0] -OutFile $args[1] -UseBasicParsing",
    ].join("; ");
    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
      url,
      destination,
    ], {
      windowsHide: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`PowerShell update download failed with exit code ${code}`));
      }
    });
  });
}

async function verifyDownloadedFile(destination, update) {
  const expectedSize = Number(update?.installerSize || 0);
  const stat = await fs.promises.stat(destination);
  if (expectedSize && stat.size !== expectedSize) {
    throw new Error(`Downloaded installer size mismatch: expected ${expectedSize}, got ${stat.size}`);
  }
  const digest = String(update?.installerDigest || "");
  const match = digest.match(/^sha256:([0-9a-f]{64})$/i);
  if (!match) return;
  const actual = await hashFile(destination, "sha256");
  if (actual.toLowerCase() !== match[1].toLowerCase()) {
    throw new Error("Downloaded installer checksum mismatch");
  }
}

function hashFile(filePath, algorithm) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function requestFileWithRetry(url, destination, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await requestFile(url, destination, options);
    } catch (error) {
      lastError = error;
      if (!isRetryableUpdateError(error) || attempt === 3) break;
      await delay(attempt * 800);
    }
  }
  throw lastError;
}

async function requestBufferWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await requestBuffer(url, options);
    } catch (error) {
      lastError = error;
      if (!isRetryableUpdateError(error) || attempt === 3) break;
      await delay(attempt * 800);
    }
  }
  throw lastError;
}

function requestFile(url, destination, options = {}) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destination);
    let settled = false;

    function fail(error) {
      if (settled) return;
      settled = true;
      output.destroy();
      fs.promises.unlink(destination).catch(() => {}).finally(() => reject(error));
    }

    request(url, options, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        fail(new Error(`GitHub asset download failed: HTTP ${response.statusCode}`));
        response.resume();
        return;
      }

      const total = Number(response.headers["content-length"] || options.expectedSize || 0);
      let received = 0;
      response.on("data", (chunk) => {
        received += chunk.length;
        if (total > 0 && typeof options.onProgress === "function") {
          options.onProgress(Math.max(0, Math.min(100, (received / total) * 100)));
        }
      });
      response.on("error", fail);
      output.on("error", fail);
      output.on("finish", () => {
        if (settled) return;
        settled = true;
        resolve(destination);
      });
      response.pipe(output);
    }).on("error", fail);
  });
}

function requestBuffer(url, options = {}) {
  return new Promise((resolve, reject) => {
    request(url, options, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`GitHub request failed: HTTP ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    }).on("error", reject);
  });
}

function request(url, options, callback) {
  const requestOptions = {
    headers: options.headers || {},
    timeout: REQUEST_TIMEOUT_MS,
  };
  const req = https.get(url, requestOptions, (response) => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      response.resume();
      const nextUrl = new URL(response.headers.location, url).toString();
      request(nextUrl, options, callback).on("error", (error) => req.emit("error", error));
      return;
    }
    callback(response);
  });
  req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error("GitHub request timed out")));
  return req;
}

function findReleaseAsset(release, version, extension) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const versionedName = `TypeUp-Setup-${version}${extension}`;
  return assets.find((asset) => asset.name === versionedName)
    || assets.find((asset) => asset.name?.endsWith(extension) && /^TypeUp-Setup-/i.test(asset.name));
}

function parseVersion(value) {
  const match = String(value || "").match(/v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/);
  return match ? match[1] : "";
}

function compareVersions(left, right) {
  const a = String(left || "").split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const b = String(right || "").split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isRetryableUpdateError(error) {
  const text = error?.message || String(error || "");
  const code = error?.code || "";
  return RETRYABLE_ERROR_CODES.has(code)
    || /ERR_CONNECTION_RESET|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|network/i.test(text);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  setupAutoUpdates,
  compareVersions,
  isRetryableUpdateError,
  parseVersion,
};
