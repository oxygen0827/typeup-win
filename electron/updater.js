const { autoUpdater } = require("electron-updater");

const UPDATE_EVENT = "typeup:update:event";

function setupAutoUpdates({ app, ipcMain, getMainWindow, isDev, beforeInstall }) {
  const canUpdate = app.isPackaged && !isDev;
  let checking = false;
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
      setState({
        status: "available",
        availableVersion: info.version || "",
        releaseName: info.releaseName || "",
        progress: 0,
        error: "",
      });
    });

    autoUpdater.on("update-not-available", () => {
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
    setState({ status: "checking", error: "", progress: 0 }, { silent: pendingSilentCheck });
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      setError(error, { silent: pendingSilentCheck });
    } finally {
      checking = false;
      pendingSilentCheck = false;
    }
    return getState();
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
      await autoUpdater.downloadUpdate();
    } catch (error) {
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
      autoUpdater.quitAndInstall(false, true);
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

module.exports = {
  setupAutoUpdates,
};
