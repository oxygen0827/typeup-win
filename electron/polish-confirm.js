const crypto = require("node:crypto");
const path = require("node:path");
const { BrowserWindow, ipcMain } = require("electron");

const DEFAULT_RESULT = { accepted: false, text: "" };

function setupPolishConfirmation({ icon }) {
  const pending = new Map();

  ipcMain.handle("typeup:polish-confirm:get", (_event, id) => {
    return pending.get(id)?.payload || null;
  });

  ipcMain.handle("typeup:polish-confirm:resolve", (_event, id, accepted, text) => {
    const item = pending.get(id);
    if (!item) return DEFAULT_RESULT;
    item.result = { accepted: Boolean(accepted), text: String(text || "") };
    item.window.close();
    return item.result;
  });

  function confirm(payload) {
    const id = String(payload?.id || crypto.randomUUID());
    const normalized = {
      id,
      original: String(payload?.original || ""),
      polished: String(payload?.polished || ""),
    };

    return new Promise((resolve) => {
      const confirmationWindow = new BrowserWindow({
        width: 560,
        height: 500,
        minWidth: 520,
        minHeight: 460,
        resizable: true,
        title: "TypeUp 微润色确认",
        icon,
        show: false,
        alwaysOnTop: true,
        autoHideMenuBar: true,
        backgroundColor: "#f5f8fc",
        webPreferences: {
          preload: path.join(__dirname, "polish-confirm-preload.js"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      pending.set(id, {
        payload: normalized,
        window: confirmationWindow,
        result: null,
        resolve: (result) => {
          if (!pending.has(id)) return;
          pending.delete(id);
          resolve(result);
        },
      });

      confirmationWindow.once("ready-to-show", () => {
        confirmationWindow.show();
        confirmationWindow.focus();
      });
      confirmationWindow.once("closed", () => {
        const item = pending.get(id);
        if (!item) return;
        const result = item.result || DEFAULT_RESULT;
        setTimeout(() => item.resolve(result), result.accepted ? 180 : 0);
      });
      confirmationWindow.loadFile(path.join(__dirname, "polish-confirm.html"), {
        query: { id },
      }).catch((error) => {
        const item = pending.get(id);
        if (!item) return;
        item.resolve(DEFAULT_RESULT);
        console.error("[typeup] polish confirmation window failed:", error);
      });
    });
  }

  return { confirm };
}

module.exports = { setupPolishConfirmation };
