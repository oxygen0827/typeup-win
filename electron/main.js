const path = require("node:path");
const { app, BrowserWindow, Menu, globalShortcut, ipcMain, shell } = require("electron");
const { createLocalServer } = require("./local-server");
const { setupAutoUpdates } = require("./updater");
const { registerVoiceConsoleShortcuts } = require("./voice-shortcuts");

let mainWindow;
let localServer;
let quittingForUpdate = false;
let unregisterVoiceShortcuts = () => {};

const isDev = process.env.NODE_ENV === "development";
const windowIcon = path.join(__dirname, "..", "build", process.platform === "darwin" ? "icon.png" : "icon.ico");
const singleInstanceLock = app.requestSingleInstanceLock();

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
  mainWindow.show();
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  showMainWindow();
  mainWindow.focus();
}

async function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 640,
    title: "TypeUp",
    icon: windowIcon,
    backgroundColor: "#00000000",
    frame: false,
    transparent: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", showMainWindow);
  mainWindow.webContents.once("did-finish-load", showMainWindow);
  setTimeout(showMainWindow, isDev ? 2500 : 5000);

  if (isDev) {
    await mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

async function closeLocalServer() {
  if (!localServer) return;
  const server = localServer;
  localServer = null;
  await server.close();
}

const updates = setupAutoUpdates({
  app,
  ipcMain,
  getMainWindow: () => mainWindow,
  isDev,
  beforeInstall: async () => {
    quittingForUpdate = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeAllListeners("close");
      mainWindow.close();
    }
    await closeLocalServer();
  },
});

async function boot() {
  localServer = await createLocalServer({ electronApp: app });
  await localServer.agent.ensureConfig();
  unregisterVoiceShortcuts = registerVoiceConsoleShortcuts({
    globalShortcut,
    getAgent: () => localServer?.agent,
    platform: process.platform,
  });
  await localServer.agent.start();
  await createWindow();
  updates.startupCheck();
}

if (!singleInstanceLock) {
  app.quit();
} else {
  app.whenReady().then(boot);

  app.on("second-instance", focusMainWindow);

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });

  app.on("before-quit", async (event) => {
    if (quittingForUpdate || !localServer) return;
    event.preventDefault();
    try {
      unregisterVoiceShortcuts();
      unregisterVoiceShortcuts = () => {};
      await closeLocalServer();
    } finally {
      app.exit(0);
    }
  });

  ipcMain.handle("typeup:api-base", () => {
    if (!localServer) return null;
    return `http://127.0.0.1:${localServer.port}`;
  });

  ipcMain.handle("typeup:platform", () => process.platform);

  ipcMain.handle("typeup:open-external", async (_event, url) => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return false;
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle("typeup:window:minimize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    mainWindow.minimize();
    return true;
  });

  ipcMain.handle("typeup:window:toggle-maximize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return true;
  });

  ipcMain.handle("typeup:window:close", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    mainWindow.close();
    return true;
  });
}
