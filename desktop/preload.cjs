const { contextBridge, ipcRenderer } = require("electron");

async function invoke(channel, ...args) {
  const response = await ipcRenderer.invoke(channel, ...args);

  if (!response.ok) {
    const error = new Error(response.error.message);
    error.expected = response.error.expected;
    throw error;
  }

  return response.data;
}

contextBridge.exposeInMainWorld("tart", {
  addEntry: (message, time, date) => invoke("tart:add-entry", message, time, date),
  cloneEntry: (ref, line) => invoke("tart:clone-entry", ref, line),
  exportWeek: (format) => invoke("tart:export-week", format),
  getState: (ref) => invoke("tart:get-state", ref),
  maximizeWindow: () => invoke("tart:maximize-window"),
  openLogDir: () => invoke("tart:open-log-dir"),
  minimizeWindow: () => invoke("tart:minimize-window"),
  deleteEntry: (ref, line) => invoke("tart:delete-entry", ref, line),
  editEntry: (ref, line, date, time, message) => invoke("tart:edit-entry", ref, line, date, time, message),
  copyText: (text) => invoke("tart:copy-text", text),
  fitWindowHeight: (height) => invoke("tart:fit-window-height", height),
  saveWeek: (text) => invoke("tart:save-week", text),
  closeWindow: () => invoke("tart:close-window"),
});
