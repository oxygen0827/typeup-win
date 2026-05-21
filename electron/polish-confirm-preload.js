const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("typeupPolish", {
  getPayload: () => ipcRenderer.invoke("typeup:polish-confirm:get", new URLSearchParams(location.search).get("id")),
  accept: (text) => ipcRenderer.invoke(
    "typeup:polish-confirm:resolve",
    new URLSearchParams(location.search).get("id"),
    true,
    text,
  ),
  cancel: () => ipcRenderer.invoke(
    "typeup:polish-confirm:resolve",
    new URLSearchParams(location.search).get("id"),
    false,
    "",
  ),
});
