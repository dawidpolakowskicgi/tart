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

contextBridge.exposeInMainWorld("worktrace", {
  addEntry: (message, time, date) => invoke("worktrace:add-entry", message, time, date),
  cloneEntry: (ref, line) => invoke("worktrace:clone-entry", ref, line),
  exportWeek: (format) => invoke("worktrace:export-week", format),
  getState: (ref) => invoke("worktrace:get-state", ref),
  maximizeWindow: () => invoke("worktrace:maximize-window"),
  openLogDir: () => invoke("worktrace:open-log-dir"),
  minimizeWindow: () => invoke("worktrace:minimize-window"),
  deleteEntry: (ref, line) => invoke("worktrace:delete-entry", ref, line),
  editEntry: (ref, line, date, time, message) => invoke("worktrace:edit-entry", ref, line, date, time, message),
  copyText: (text) => invoke("worktrace:copy-text", text),
  fitWindowHeight: (height) => invoke("worktrace:fit-window-height", height),
  saveWeek: (text) => invoke("worktrace:save-week", text),
  closeWindow: () => invoke("worktrace:close-window"),
});
