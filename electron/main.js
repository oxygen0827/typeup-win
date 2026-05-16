const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { createLocalServer } = require("./local-server");

let mainWindow;
let localServer;

const isDev = process.env.NODE_ENV === "development";
const windowIcon = path.join(__dirname, "..", "build", process.platform === "darwin" ? "icon.png" : "icon.ico");

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: "TypeUp",
    icon: windowIcon,
    backgroundColor: "#f6f8fb",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  if (isDev) {
    await mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

async function boot() {
  localServer = await createLocalServer({ electronApp: app });
  await localServer.agent.ensureConfig();
  await localServer.agent.start();
  await createWindow();
}

app.whenReady().then(boot);

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on("before-quit", async (event) => {
  if (!localServer) return;
  event.preventDefault();
  const server = localServer;
  localServer = null;
  try {
    await server.close();
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
