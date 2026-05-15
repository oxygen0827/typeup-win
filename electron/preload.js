const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("typeup", {
  apiBase: () => ipcRenderer.invoke("typeup:api-base"),
  platform: () => ipcRenderer.invoke("typeup:platform"),
  openExternal: (url) => ipcRenderer.invoke("typeup:open-external", url),
});
