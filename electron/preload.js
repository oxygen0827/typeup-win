const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("typeup", {
  apiBase: () => ipcRenderer.invoke("typeup:api-base"),
  platform: () => ipcRenderer.invoke("typeup:platform"),
  openExternal: (url) => ipcRenderer.invoke("typeup:open-external", url),
  updates: {
    getState: () => ipcRenderer.invoke("typeup:update:get-state"),
    check: () => ipcRenderer.invoke("typeup:update:check"),
    download: () => ipcRenderer.invoke("typeup:update:download"),
    install: () => ipcRenderer.invoke("typeup:update:install"),
    getReleaseNotes: () => ipcRenderer.invoke("typeup:update:get-release-notes"),
    dismissReleaseNotes: (version) => ipcRenderer.invoke("typeup:update:dismiss-release-notes", version),
    onEvent: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("typeup:update:event", listener);
      return () => ipcRenderer.removeListener("typeup:update:event", listener);
    },
  },
});
