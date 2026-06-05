const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const UPDATE_EVENT = "typeup:update:event";
const GITHUB_OWNER = "oxygen0827";
const GITHUB_REPO = "typeup-win";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const GITHUB_RELEASE_BASE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
const GENERIC_RELEASE_BASE = "http://150.158.146.192:6052/apps/typeup-win-release";
const UPDATE_MANIFEST_URL = `${GENERIC_RELEASE_BASE}/typeup-update.json`;
const USER_AGENT = "TypeUpUpdater/1.0";
const REQUEST_TIMEOUT_MS = 45000;
const FALLBACK_INSTALL_ARGS = ["/currentuser", "/S", "--updated", "--force-run"];
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
    releaseName: "",
    releaseNotes: "",
    releaseUrl: "",
    progress: 0,
    bytesReceived: 0,
    bytesTotal: 0,
    phase: "",
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

  function getReleaseNotesPath() {
    return path.join(app.getPath("userData"), "pending-release-notes.json");
  }

  if (canUpdate) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.disableDifferentialDownload = true;

    autoUpdater.on("checking-for-update", () => {
      setState({ status: "checking", error: "", progress: 0 }, { silent: pendingSilentCheck });
    });

    autoUpdater.on("update-available", (info = {}) => {
      fallbackUpdate = createDirectInstallerUpdate(info, process.platform);
      fallbackInstallerPath = "";
      setState({
        status: "available",
        availableVersion: info.version || "",
        releaseName: info.releaseName || "",
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        releaseUrl: info.releaseUrl || "",
        progress: 0,
        bytesReceived: 0,
        bytesTotal: 0,
        phase: "",
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
          releaseName: "",
          releaseNotes: "",
          releaseUrl: "",
          progress: 0,
          bytesReceived: 0,
          bytesTotal: 0,
          phase: "",
          error: "",
        },
        { silent: pendingSilentCheck },
      );
    });

    autoUpdater.on("download-progress", (progress = {}) => {
      setState({
        status: "downloading",
        progress: Math.max(0, Math.min(100, Number(progress.percent || 0))),
        bytesReceived: Number(progress.transferred || 0),
        bytesTotal: Number(progress.total || 0),
        phase: "downloading",
        error: "",
      });
    });

    autoUpdater.on("update-downloaded", (info = {}) => {
      setState({
        status: "downloaded",
        availableVersion: info.version || state.availableVersion,
        releaseName: info.releaseName || state.releaseName,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes) || state.releaseNotes,
        releaseUrl: info.releaseUrl || state.releaseUrl,
        progress: 100,
        bytesReceived: state.bytesTotal || state.bytesReceived,
        bytesTotal: state.bytesTotal,
        phase: "",
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
    setState({ status: "checking", error: "", progress: 0, bytesReceived: 0, bytesTotal: 0, phase: "" }, { silent: pendingSilentCheck });
    try {
      const manifestHandled = await checkForUpdatesViaManifest({ silent: pendingSilentCheck });
      if (manifestHandled) return getState();
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

  async function checkForUpdatesViaManifest(options = {}) {
    const manifest = await fetchUpdateManifest();
    if (!manifest) return false;
    const manifestUpdate = createManifestInstallerUpdate(manifest, process.platform);
    if (!manifestUpdate) {
      throw new Error("TypeUp update manifest does not include a Windows installer");
    }
    if (compareVersions(manifestUpdate.version, app.getVersion()) <= 0) {
      fallbackUpdate = null;
      fallbackInstallerPath = "";
      setState(
        {
          status: options.silent ? "idle" : "latest",
          availableVersion: "",
          progress: 0,
          bytesReceived: 0,
          bytesTotal: 0,
          phase: "",
          error: "",
        },
        { silent: options.silent },
      );
      return true;
    }
    fallbackUpdate = manifestUpdate;
    fallbackInstallerPath = "";
    setState(
      {
        status: "available",
        availableVersion: manifestUpdate.version,
        releaseName: manifestUpdate.releaseName,
        releaseNotes: manifestUpdate.releaseNotes,
        releaseUrl: manifestUpdate.releaseUrl,
        progress: 0,
        bytesReceived: 0,
        bytesTotal: manifestUpdate.installerSize,
        phase: "",
        error: "",
      },
      { silent: options.silent },
    );
    return true;
  }

  async function checkForUpdatesViaGithubApi(options = {}) {
    try {
      const release = await findLatestGithubRelease();
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
            bytesReceived: 0,
            bytesTotal: 0,
            phase: "",
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
        releaseNotes: normalizeReleaseNotes(release.body || ""),
        releaseUrl: release.html_url || "",
        installerAssetId: installer.id || "",
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
          releaseNotes: fallbackUpdate.releaseNotes,
          releaseUrl: fallbackUpdate.releaseUrl,
          progress: 0,
          bytesReceived: 0,
          bytesTotal: fallbackUpdate.installerSize,
          phase: "",
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
    if (shouldRefreshUpdateBeforeDownload(state.status, Boolean(fallbackUpdate))) {
      await checkForUpdates({ silent: false });
      if (state.status !== "available") return getState();
    }
    setState({ status: "connecting", progress: 0, bytesReceived: 0, bytesTotal: fallbackUpdate?.installerSize || 0, phase: "connecting", error: "" });
    try {
      if (fallbackUpdate) {
        fallbackInstallerPath = await downloadFallbackInstaller(fallbackUpdate, (progress) => {
          const phase = progress.phase || "downloading";
          setState({
            status: phase === "verifying" ? "verifying" : phase === "connecting" ? "connecting" : "downloading",
            progress: progress.percent,
            bytesReceived: progress.received,
            bytesTotal: progress.total,
            phase,
            error: "",
          });
        });
        setState({
          status: "downloaded",
          availableVersion: fallbackUpdate.version,
          progress: 100,
          bytesReceived: fallbackUpdate.installerSize || state.bytesReceived,
          bytesTotal: fallbackUpdate.installerSize || state.bytesTotal,
          phase: "",
          error: "",
        });
      } else {
        const directUpdate = createDirectInstallerUpdate(
          {
            version: state.availableVersion,
            releaseName: state.releaseName,
            releaseNotes: state.releaseNotes,
            releaseUrl: state.releaseUrl,
          },
          process.platform,
        );
        if (directUpdate) {
          fallbackUpdate = directUpdate;
          return downloadUpdate();
        }
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
      setState({ status: "installing", phase: "preparing", error: "" });
      await writePendingReleaseNotes().catch(() => {});
      if (typeof beforeInstall === "function") {
        await beforeInstall();
      }
      if (fallbackInstallerPath) {
        await verifyDownloadedFile(fallbackInstallerPath, fallbackUpdate);
        launchFallbackInstaller(app, fallbackInstallerPath);
      } else {
        autoUpdater.quitAndInstall(true, true);
      }
    } catch (error) {
      setError(error);
    }
    return getState();
  }

  async function readPendingReleaseNotes() {
    try {
      const payload = JSON.parse(await fs.promises.readFile(getReleaseNotesPath(), "utf8"));
      const version = parseVersion(payload?.version || "");
      if (!version || payload.dismissed) return null;
      if (compareVersions(version, app.getVersion()) !== 0) return null;
      return {
        version,
        fromVersion: parseVersion(payload.fromVersion || ""),
        releaseName: String(payload.releaseName || `TypeUp ${version}`),
        releaseNotes: normalizeReleaseNotes(payload.releaseNotes || ""),
        releaseUrl: String(payload.releaseUrl || ""),
        createdAt: payload.createdAt || "",
      };
    } catch (_error) {
      return null;
    }
  }

  async function writePendingReleaseNotes() {
    const version = parseVersion(state.availableVersion || fallbackUpdate?.version || "");
    if (!version) return;
    const releaseNotesPath = getReleaseNotesPath();
    const payload = {
      version,
      fromVersion: app.getVersion(),
      releaseName: state.releaseName || fallbackUpdate?.releaseName || `TypeUp ${version}`,
      releaseNotes: normalizeReleaseNotes(state.releaseNotes || fallbackUpdate?.releaseNotes || ""),
      releaseUrl: state.releaseUrl || fallbackUpdate?.releaseUrl || "",
      createdAt: new Date().toISOString(),
      dismissed: false,
    };
    await fs.promises.mkdir(path.dirname(releaseNotesPath), { recursive: true });
    await fs.promises.writeFile(releaseNotesPath, JSON.stringify(payload, null, 2), "utf8");
  }

  async function dismissPendingReleaseNotes(version) {
    const pending = await readPendingReleaseNotes();
    const targetVersion = parseVersion(version || "");
    if (!pending || (targetVersion && pending.version !== targetVersion)) return true;
    await fs.promises.unlink(getReleaseNotesPath()).catch(() => {});
    return true;
  }

  ipcMain.handle("typeup:update:get-state", () => getState());
  ipcMain.handle("typeup:update:check", () => checkForUpdates({ silent: false }));
  ipcMain.handle("typeup:update:download", () => downloadUpdate());
  ipcMain.handle("typeup:update:install", () => installUpdate());
  ipcMain.handle("typeup:update:get-release-notes", () => readPendingReleaseNotes());
  ipcMain.handle("typeup:update:dismiss-release-notes", (_event, version) => dismissPendingReleaseNotes(version));

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

async function fetchUpdateManifest(url = UPDATE_MANIFEST_URL) {
  try {
    const buffer = await requestBufferWithRetry(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    if (isHttpStatus(error, 404)) return null;
    throw error;
  }
}

function createManifestInstallerUpdate(manifest = {}, platform = process.platform, releaseBase = GENERIC_RELEASE_BASE) {
  const version = parseVersion(manifest.version || manifest.tagName || manifest.tag_name || manifest.releaseName || "");
  if (!version || !shouldUseDirectInstallerDownload(platform)) return null;
  const installer = findManifestInstaller(manifest, platform, version);
  const installerName = String(
    installer.name || installer.fileName || installer.path || manifest.installerName || `TypeUp-Setup-${version}.exe`,
  ).trim();
  const installerUrls = normalizeDownloadUrls(
    [
      installer.url,
      installer.downloadUrl,
      installer.installerUrl,
      manifest.installerUrl,
      manifest.downloadUrl,
      manifest.url,
      ...(asArray(installer.alternateUrls)),
      ...(asArray(installer.backupUrls)),
      ...(asArray(installer.mirrors)),
      ...(asArray(manifest.alternateUrls)),
      ...(asArray(manifest.backupUrls)),
      ...(asArray(manifest.mirrors)),
    ],
    installerName,
    releaseBase,
  );
  if (!installerUrls.length) return null;
  return {
    version,
    releaseName: manifest.releaseName || manifest.name || `TypeUp ${version}`,
    releaseNotes: normalizeReleaseNotes(manifest.releaseNotes || manifest.notes || ""),
    releaseUrl: String(manifest.releaseUrl || manifest.htmlUrl || ""),
    publishedAt: String(manifest.publishedAt || manifest.releaseDate || ""),
    installerAssetId: "",
    installerUrl: installerUrls[0],
    installerUrls,
    installerName,
    installerSize: Number(installer.size || installer.bytes || manifest.size || manifest.installerSize || 0),
    installerDigest: normalizeInstallerDigest(installer.sha256 || manifest.sha256 || installer.digest || manifest.digest || ""),
    blockmapUrl: resolveDownloadUrl(installer.blockmapUrl || manifest.blockmapUrl || "", releaseBase),
  };
}

function findManifestInstaller(manifest = {}, platform = process.platform, version = "") {
  const platformKeys = platform === "win32"
    ? ["win32", "windows", "win", "nsis"]
    : [platform];
  const candidates = [];
  if (manifest.installer && typeof manifest.installer === "object") candidates.push(manifest.installer);
  if (Array.isArray(manifest.files)) {
    candidates.push(...manifest.files);
  } else if (manifest.files && typeof manifest.files === "object") {
    for (const key of platformKeys) {
      const value = manifest.files[key];
      collectManifestFileCandidates(candidates, value);
    }
    candidates.push(...Object.values(manifest.files).filter((value) => value && typeof value === "object" && !Array.isArray(value)));
  }
  if (manifest.platforms && typeof manifest.platforms === "object") {
    for (const key of platformKeys) {
      const platformManifest = manifest.platforms[key];
      if (!platformManifest || typeof platformManifest !== "object") continue;
      collectManifestFileCandidates(candidates, platformManifest.installer);
      collectManifestFileCandidates(candidates, platformManifest.files);
    }
  }
  candidates.push(manifest);
  const expectedName = `TypeUp-Setup-${version}.exe`;
  return candidates.find((item) => manifestFileName(item) === expectedName)
    || candidates.find((item) => /\.exe(?:$|\?)/i.test(manifestFileName(item) || String(item?.url || item?.downloadUrl || "")))
    || candidates[0]
    || {};
}

function collectManifestFileCandidates(candidates, value) {
  if (!value) return;
  if (Array.isArray(value)) {
    candidates.push(...value);
    return;
  }
  if (typeof value !== "object") return;
  if (value.installer) collectManifestFileCandidates(candidates, value.installer);
  if (value.files) collectManifestFileCandidates(candidates, value.files);
  candidates.push(value);
}

function manifestFileName(item = {}) {
  const value = String(item.name || item.fileName || item.path || item.url || item.downloadUrl || item.installerUrl || "").trim();
  if (!value) return "";
  try {
    return path.basename(new URL(value).pathname);
  } catch (_error) {
    return path.basename(value);
  }
}

function normalizeDownloadUrls(values, installerName, releaseBase = GENERIC_RELEASE_BASE) {
  const urls = values
    .flatMap((value) => asArray(value))
    .map((value) => resolveDownloadUrl(String(value || "").trim(), releaseBase))
    .filter(Boolean);
  if (!urls.length && installerName) {
    urls.push(`${releaseBase}/${encodeURIComponent(installerName)}`);
  }
  return unique(urls);
}

function resolveDownloadUrl(value, releaseBase = GENERIC_RELEASE_BASE) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${releaseBase.replace(/\/+$/, "")}/${String(value).replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")}`;
}

function normalizeInstallerDigest(value) {
  const text = String(value || "").trim();
  const prefixed = text.match(/^sha256:([0-9a-f]{64})$/i);
  if (prefixed) return `sha256:${prefixed[1].toLowerCase()}`;
  const raw = text.match(/^[0-9a-f]{64}$/i);
  if (raw) return `sha256:${text.toLowerCase()}`;
  return text;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function findLatestGithubRelease() {
  try {
    return await requestJson(`${GITHUB_API_BASE}/releases/latest`);
  } catch (error) {
    if (!isRetryableUpdateError(error)) {
      throw error;
    }
    return requestLatestReleaseViaYml();
  }
}

async function requestLatestReleaseViaYml() {
  const latestYmlUrl = `${GITHUB_RELEASE_BASE}/latest/download/latest.yml`;
  const yaml = await requestTextWithRetry(latestYmlUrl, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });
  const version = parseLatestYmlVersion(yaml);
  if (!version) {
    throw new Error("GitHub latest.yml does not include a valid version");
  }
  const installerName = parseLatestYmlPath(yaml) || `TypeUp-Setup-${version}.exe`;
  const installerSize = parseLatestYmlSize(yaml);
  return {
    tag_name: `v${version}`,
    name: `TypeUp v${version}`,
    body: "",
    html_url: `${GITHUB_RELEASE_BASE}/tag/v${version}`,
    assets: [
      {
        id: "",
        name: installerName,
        browser_download_url: `${GITHUB_RELEASE_BASE}/download/v${version}/${installerName}`,
        size: installerSize,
        digest: "",
      },
    ],
  };
}

async function downloadFallbackInstaller(update, onProgress) {
  const cacheDir = path.join(os.tmpdir(), "typeup-updater-fallback");
  await fs.promises.mkdir(cacheDir, { recursive: true });
  const destination = path.join(cacheDir, update.installerName);
  const urls = getDownloadCandidates(update);
  if (!urls.length) {
    throw new Error("TypeUp update manifest does not include an installer URL");
  }
  try {
    await verifyDownloadedFile(destination, update);
    if (typeof onProgress === "function") {
      onProgress({ phase: "verifying", percent: 100, received: update.installerSize || 0, total: update.installerSize || 0 });
    }
    return destination;
  } catch (_error) {
    await fs.promises.unlink(destination).catch(() => {});
  }
  let lastError = null;
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const headers = update.installerAssetId && url.includes("/releases/assets/")
      ? { Accept: "application/octet-stream", "User-Agent": USER_AGENT }
      : { "User-Agent": USER_AGENT };
    try {
      if (typeof onProgress === "function") {
        onProgress({ phase: "connecting", percent: 0, received: 0, total: update.installerSize || 0, sourceIndex: index });
      }
      await requestFileWithRetry(url, destination, {
        expectedSize: update.installerSize,
        onProgress: (progress) => {
          if (typeof onProgress === "function") {
            onProgress({ ...progress, phase: progress.phase || "downloading", sourceIndex: index });
          }
        },
        headers,
      });
      if (typeof onProgress === "function") {
        onProgress({ phase: "verifying", percent: 99, received: update.installerSize || 0, total: update.installerSize || 0, sourceIndex: index });
      }
      await verifyDownloadedFile(destination, update);
      if (typeof onProgress === "function") {
        onProgress({ phase: "verifying", percent: 100, received: update.installerSize || 0, total: update.installerSize || 0, sourceIndex: index });
      }
      return destination;
    } catch (error) {
      lastError = error;
      await fs.promises.unlink(destination).catch(() => {});
      await fs.promises.unlink(`${destination}.part`).catch(() => {});
      if (index < urls.length - 1) continue;
    }
  }
  if (!shouldFallbackToPowerShellDownload(lastError, process.platform, update.installerUrl)) {
    throw lastError || new Error("TypeUp update download failed");
  }
  if (process.platform === "win32" && update.installerUrl) {
    if (typeof onProgress === "function") {
      onProgress({ phase: "connecting", percent: 5, received: 0, total: update.installerSize || 0 });
    }
    await downloadWithPowerShell(update.installerUrl, destination);
    await verifyDownloadedFile(destination, update);
    if (typeof onProgress === "function") {
      onProgress({ phase: "verifying", percent: 100, received: update.installerSize || 0, total: update.installerSize || 0 });
    }
    return destination;
  }
  throw lastError || new Error("TypeUp update download failed");
}

function getDownloadCandidates(update = {}) {
  const assetUrl = update.installerAssetId ? `${GITHUB_API_BASE}/releases/assets/${update.installerAssetId}` : "";
  return unique([assetUrl, update.installerUrl, ...(asArray(update.installerUrls))]);
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
  const digest = normalizeInstallerDigest(update?.installerDigest || update?.sha256 || "");
  const match = digest.match(/^sha256:([0-9a-f]{64})$/i);
  if (!match) return;
  const actual = await hashFile(destination, "sha256");
  if (actual.toLowerCase() !== match[1].toLowerCase()) {
    throw new Error("Downloaded installer checksum mismatch");
  }
}

function shouldUseGithubApiUpdates(platform = process.platform) {
  return false;
}

function shouldUseDirectInstallerDownload(platform = process.platform) {
  return platform === "win32";
}

function createDirectInstallerUpdate(info = {}, platform = process.platform) {
  if (!shouldUseDirectInstallerDownload(platform)) return null;
  const version = parseVersion(info.version || info.tagName || info.releaseName || "");
  if (!version) return null;
  const files = Array.isArray(info.files) ? info.files : [];
  const installerName = findInstallerFileName(files, version) || `TypeUp-Setup-${version}.exe`;
  const installerSize = findInstallerFileSize(files, installerName);
  const installerUrl = `${GENERIC_RELEASE_BASE}/${encodeURIComponent(installerName)}`;
  return {
    version,
    releaseName: info.releaseName || `TypeUp ${version}`,
    releaseNotes: normalizeReleaseNotes(info.releaseNotes || ""),
    releaseUrl: info.releaseUrl || "",
    installerAssetId: "",
    installerUrl,
    installerUrls: [installerUrl],
    installerName,
    installerSize,
    installerDigest: findInstallerFileDigest(files, installerName),
  };
}

function findInstallerFileName(files, version) {
  const expected = `TypeUp-Setup-${version}.exe`;
  const match = files.find((file) => file?.url === expected || file?.path === expected || file?.name === expected)
    || files.find((file) => String(file?.url || file?.path || file?.name || "").endsWith(".exe"));
  return String(match?.url || match?.path || match?.name || "").trim();
}

function findInstallerFileSize(files, installerName) {
  const match = files.find((file) => {
    const name = String(file?.url || file?.path || file?.name || "").trim();
    return name === installerName;
  }) || files.find((file) => String(file?.url || file?.path || file?.name || "").endsWith(".exe"));
  return Number(match?.size || 0);
}

function findInstallerFileDigest(files, installerName) {
  const match = files.find((file) => {
    const name = String(file?.url || file?.path || file?.name || "").trim();
    return name === installerName;
  }) || files.find((file) => String(file?.url || file?.path || file?.name || "").endsWith(".exe"));
  return normalizeInstallerDigest(match?.sha256 || match?.digest || "");
}

function shouldRefreshUpdateBeforeDownload(status, hasFallbackUpdate, platform = process.platform) {
  return status !== "available";
}

function shouldFallbackToPowerShellDownload(error, platform = process.platform, installerUrl = "") {
  return platform === "win32" && Boolean(installerUrl) && isRetryableUpdateError(error);
}

function launchFallbackInstaller(app, installerPath) {
  const child = process.platform === "win32"
    ? spawnWindowsFallbackInstaller(installerPath, process.pid)
    : spawn(installerPath, FALLBACK_INSTALL_ARGS, {
      detached: true,
      stdio: "ignore",
    });
  child.unref();
  if (typeof app.exit === "function") {
    app.exit(0);
  } else {
    app.quit();
  }
}

function spawnWindowsFallbackInstaller(installerPath, waitForPid = process.pid) {
  const logPath = path.join(os.tmpdir(), "typeup-updater-fallback", "install-launch.log");
  const command = windowsFallbackInstallerCommand(installerPath, waitForPid, logPath);
  return spawn(command.command, command.args, command.options);
}

function windowsFallbackInstallerCommand(installerPath, waitForPid = process.pid, logPath = "") {
  const installArgs = FALLBACK_INSTALL_ARGS.map(powerShellStringLiteral).join(", ");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$pidToWait = ${Number(waitForPid) || 0}`,
    `$installer = ${powerShellStringLiteral(installerPath)}`,
    `$logPath = ${powerShellStringLiteral(logPath)}`,
    "$logDir = Split-Path -Parent $logPath",
    "if ($logDir) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }",
    "function Write-TypeUpUpdateLog([string] $message) { if ($logPath) { Add-Content -Path $logPath -Value ((Get-Date).ToString('s') + ' ' + $message) } }",
    "Write-TypeUpUpdateLog ('waiting for TypeUp pid ' + $pidToWait)",
    "Wait-Process -Id $pidToWait -ErrorAction SilentlyContinue",
    "Start-Sleep -Milliseconds 500",
    "Write-TypeUpUpdateLog ('starting installer ' + $installer)",
    `$process = Start-Process -FilePath $installer -ArgumentList @(${installArgs}) -PassThru`,
    "Write-TypeUpUpdateLog ('started installer pid ' + $process.Id)",
  ].join("; ");
  return {
    command: "cmd.exe",
    args: [
      "/d",
      "/s",
      "/c",
      "start",
      "\"\"",
      "/min",
      "powershell.exe",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-EncodedCommand",
      encodePowerShellCommand(script),
    ],
    options: {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  };
}

function powerShellStringLiteral(value) {
  return `'${String(value || "").replace(/'/g, "''")}'`;
}

function encodePowerShellCommand(script) {
  return Buffer.from(script, "utf16le").toString("base64");
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

async function requestTextWithRetry(url, options = {}) {
  const buffer = await requestBufferWithRetry(url, options);
  return buffer.toString("utf8");
}

async function requestFile(url, destination, options = {}) {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  const part = `${destination}.part`;
  const expectedSize = Number(options.expectedSize || 0);
  let resumeFrom = await getResumeOffset(part, expectedSize);
  if (expectedSize && resumeFrom === expectedSize) {
    await moveFile(part, destination);
    return destination;
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let output = null;

    function fail(error) {
      if (settled) return;
      settled = true;
      if (output) output.destroy();
      reject(error);
    }

    const requestOptions = {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(resumeFrom > 0 ? { Range: `bytes=${resumeFrom}-` } : {}),
      },
    };
    request(url, requestOptions, (response) => {
      if (response.statusCode === 416 && expectedSize && resumeFrom === expectedSize) {
        response.resume();
        moveFile(part, destination).then(() => {
          if (!settled) {
            settled = true;
            resolve(destination);
          }
        }).catch(fail);
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        fail(httpError(`Update asset download failed: HTTP ${response.statusCode}`, response.statusCode));
        response.resume();
        return;
      }

      const append = resumeFrom > 0 && response.statusCode === 206;
      if (resumeFrom > 0 && !append) resumeFrom = 0;
      output = fs.createWriteStream(part, { flags: append ? "a" : "w" });
      const total = getResponseTotalSize(response, resumeFrom, expectedSize);
      let received = resumeFrom;
      if (typeof options.onProgress === "function") {
        options.onProgress({
          phase: "downloading",
          percent: total > 0 ? Math.max(0, Math.min(100, (received / total) * 100)) : 0,
          received,
          total,
        });
      }
      response.on("data", (chunk) => {
        received += chunk.length;
        if (total > 0 && typeof options.onProgress === "function") {
          options.onProgress({
            phase: "downloading",
            percent: Math.max(0, Math.min(100, (received / total) * 100)),
            received,
            total,
          });
        }
      });
      response.on("error", fail);
      output.on("error", fail);
      output.on("finish", () => {
        if (settled) return;
        if (expectedSize && received !== expectedSize) {
          fail(new Error(`Downloaded installer size mismatch: expected ${expectedSize}, got ${received}`));
          return;
        }
        moveFile(part, destination).then(() => {
          if (!settled) {
            settled = true;
            resolve(destination);
          }
        }).catch(fail);
      });
      response.pipe(output);
    }).on("error", fail);
  });
}

async function getResumeOffset(part, expectedSize = 0) {
  try {
    const stat = await fs.promises.stat(part);
    if (expectedSize && stat.size > expectedSize) {
      await fs.promises.unlink(part).catch(() => {});
      return 0;
    }
    return stat.size;
  } catch (_error) {
    return 0;
  }
}

async function moveFile(source, destination) {
  await fs.promises.unlink(destination).catch(() => {});
  await fs.promises.rename(source, destination);
}

function getResponseTotalSize(response, resumeFrom = 0, expectedSize = 0) {
  const contentRangeTotal = parseContentRangeTotal(response.headers["content-range"]);
  if (contentRangeTotal) return contentRangeTotal;
  const contentLength = Number(response.headers["content-length"] || 0);
  if (response.statusCode === 206 && contentLength) return resumeFrom + contentLength;
  return contentLength || expectedSize || 0;
}

function parseContentRangeTotal(value) {
  const match = String(value || "").match(/\/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

function requestBuffer(url, options = {}) {
  return new Promise((resolve, reject) => {
    request(url, options, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(httpError(`Update request failed: HTTP ${response.statusCode}`, response.statusCode));
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
  const client = new URL(url).protocol === "http:" ? http : https;
  const req = client.get(url, requestOptions, (response) => {
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

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = Number(statusCode || 0);
  error.code = `HTTP_${error.statusCode}`;
  return error;
}

function isHttpStatus(error, statusCode) {
  return Number(error?.statusCode || 0) === Number(statusCode);
}

function findReleaseAsset(release, version, extension) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const versionedName = `TypeUp-Setup-${version}${extension}`;
  return assets.find((asset) => asset.name === versionedName)
    || assets.find((asset) => asset.name === `TypeUp-Setup-${version}${extension}`)
    || assets.find((asset) => asset.name?.endsWith(extension) && /^(TypeUp|TypeUp)-Setup-/i.test(asset.name));
}

function parseLatestYmlVersion(value) {
  const match = String(value || "").match(/^version:\s*['"]?([^'"\r\n]+)['"]?/m);
  return parseVersion(match ? match[1] : "");
}

function parseLatestYmlPath(value) {
  const match = String(value || "").match(/^path:\s*['"]?([^'"\r\n]+)['"]?/m);
  return match ? match[1].trim() : "";
}

function parseLatestYmlSize(value) {
  const match = String(value || "").match(/^\s*size:\s*(\d+)\s*$/m);
  return match ? Number(match[1]) : 0;
}

function parseVersion(value) {
  const match = String(value || "").match(/v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/);
  return match ? match[1] : "";
}

function normalizeReleaseNotes(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : item?.note || item?.notes || ""))
      .filter(Boolean)
      .join("\n");
  }
  return String(value || "").trim();
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
  const statusCode = Number(error?.statusCode || 0);
  return RETRYABLE_ERROR_CODES.has(code)
    || statusCode === 408
    || statusCode === 429
    || statusCode >= 500
    || /ERR_CONNECTION_RESET|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|network|timed out|timeout/i.test(text);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  setupAutoUpdates,
  createManifestInstallerUpdate,
  createDirectInstallerUpdate,
  compareVersions,
  getDownloadCandidates,
  isRetryableUpdateError,
  normalizeInstallerDigest,
  parseVersion,
  parseContentRangeTotal,
  parseLatestYmlPath,
  parseLatestYmlSize,
  parseLatestYmlVersion,
  requestFileWithRetry,
  shouldUseDirectInstallerDownload,
  shouldUseGithubApiUpdates,
  shouldRefreshUpdateBeforeDownload,
  shouldFallbackToPowerShellDownload,
  windowsFallbackInstallerCommand,
};
