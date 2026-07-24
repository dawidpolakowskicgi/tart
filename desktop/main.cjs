const path = require("node:path");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, screen, shell, Tray } = require("electron");
const { formatEntriesAsCsv, formatWeekAsPlainText, WorktraceCoreError, WorktraceStore } = require("./worktrace-core.cjs");

let mainWindow = null;
let store = null;
let tray = null;
let isQuitting = false;

const DEFAULT_WINDOW_WIDTH = 1080;
const DEFAULT_WINDOW_HEIGHT = 760;
const MIN_WINDOW_WIDTH = 900;
const MIN_WINDOW_HEIGHT = 620;

const exportFormats = {
  csv: {
    extension: "csv",
    label: "CSV",
    mimeType: "text/csv",
  },
  pdf: {
    extension: "pdf",
    label: "PDF",
    mimeType: "application/pdf",
  },
  txt: {
    extension: "txt",
    label: "Plain Text",
    mimeType: "text/plain",
  },
};

function assetPath(fileName) {
  return path.join(__dirname, "..", "assets", fileName);
}

function firstExistingAsset(fileNames) {
  for (const fileName of fileNames) {
    const candidate = assetPath(fileName);

    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return assetPath("worktrace-clock-icon.png");
}

function appIconPath() {
  if (process.platform === "darwin") {
    return firstExistingAsset(["worktrace-clock-icon.icns", "worktrace-clock-icon.png"]);
  }

  if (process.platform === "win32") {
    return firstExistingAsset(["worktrace-clock-icon.ico", "worktrace-clock-icon.png"]);
  }

  return firstExistingAsset(["worktrace-clock-icon.png"]);
}

function trayIcon() {
  const size = process.platform === "darwin" ? 24 : 20;
  return nativeImage.createFromPath(assetPath("worktrace-clock-icon.png")).resize({
    height: size,
    width: size,
  });
}

function setDockIcon() {
  if (process.platform === "darwin" && app.dock) {
    try {
      app.dock.setIcon(nativeImage.createFromPath(assetPath("worktrace-clock-icon.png")));
    } catch (_error) {
      app.dock.setIcon(nativeImage.createFromPath(appIconPath()));
    }
  }
}

function createStore() {
  store = new WorktraceStore();
}

function showDockIcon() {
  if (process.platform === "darwin" && app.dock) {
    app.dock.show();
  }
}

function hideDockIcon() {
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
  }
}

function showMainWindow() {
  showDockIcon();

  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.setSkipTaskbar(false);
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindowToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.setSkipTaskbar(true);
  mainWindow.hide();
  hideDockIcon();
}

function fitWindowToContent(contentHeight) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMaximized() || mainWindow.isFullScreen()) {
    return;
  }

  const requestedHeight = Number(contentHeight);
  if (!Number.isFinite(requestedHeight) || requestedHeight <= 0) {
    return;
  }

  const display = screen.getDisplayMatching(mainWindow.getBounds());
  const maxHeight = Math.max(MIN_WINDOW_HEIGHT, display.workArea.height - 24);
  const nextHeight = Math.max(MIN_WINDOW_HEIGHT, Math.min(Math.ceil(requestedHeight), maxHeight));
  const [currentWidth, currentHeight] = mainWindow.getContentSize();

  if (Math.abs(currentHeight - nextHeight) < 4) {
    return;
  }

  mainWindow.setContentSize(currentWidth, nextHeight, true);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: "worktrace",
    backgroundColor: "#f6f7f3",
    icon: appIconPath(),
    frame: false,
    show: false,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("minimize", (event) => {
    event.preventDefault();
    hideMainWindowToTray();
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    hideMainWindowToTray();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(trayIcon());
  tray.setToolTip("worktrace");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Show worktrace",
      click: showMainWindow,
    },
    {
      label: "Open log directory",
      click: () => {
        handleDesktopAction(openLogDirectory).then((result) => {
          if (!result.ok) {
            console.error(result.error.message);
          }
        });
      },
    },
    { type: "separator" },
    {
      label: "Quit worktrace",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));

  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeExportFormat(format) {
  const key = String(format || "").toLowerCase();

  if (!Object.hasOwn(exportFormats, key)) {
    throw new WorktraceCoreError(`unsupported export format: ${format}`);
  }

  return key;
}

function defaultExportPath(week, format) {
  const options = exportFormats[format];
  return path.join(app.getPath("documents"), `worktrace-${week.weekStart}.${options.extension}`);
}

function buildWeekPdfHtml(week) {
  const entries = week.entries || [];
  const rows = entries.length
    ? entries.map((entry) => `
      <tr>
        <td>${escapeHtml(entry.date)}</td>
        <td>${escapeHtml(entry.message)}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="2" class="empty">No entries for this week</td>
      </tr>
    `;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>worktrace week ${escapeHtml(week.weekStart)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 34px;
        background: #ffffff;
        color: #17201d;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      header {
        border-bottom: 2px solid #286a5c;
        margin-bottom: 22px;
        padding-bottom: 16px;
      }
      h1 {
        margin: 0;
        font-size: 26px;
        line-height: 1.2;
      }
      p {
        margin: 8px 0 0;
        color: #65716d;
        font-size: 13px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th {
        background: #eef2ed;
        color: #1f5147;
        font-size: 12px;
        text-align: left;
        text-transform: uppercase;
      }
      th,
      td {
        border: 1px solid #d9ded8;
        padding: 10px 12px;
        vertical-align: top;
      }
      td:first-child {
        width: 112px;
        color: #1f5147;
        font-weight: 700;
        white-space: nowrap;
      }
      .empty {
        color: #65716d;
        font-style: italic;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>worktrace weekly export</h1>
      <p>Week of ${escapeHtml(week.weekStart)}</p>
    </header>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;
}

async function createWeekPdf(week) {
  const exportWindow = new BrowserWindow({
    height: 900,
    show: false,
    width: 720,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await exportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildWeekPdfHtml(week))}`);
    return await exportWindow.webContents.printToPDF({
      landscape: false,
      margins: {
        marginType: "default",
      },
      pageSize: "A4",
      printBackground: true,
    });
  } finally {
    exportWindow.destroy();
  }
}

async function exportWeek(formatValue) {
  const format = normalizeExportFormat(formatValue);
  const formatOptions = exportFormats[format];
  const week = await store.readWeek();
  const result = await dialog.showSaveDialog(mainWindow, {
    buttonLabel: "Export",
    defaultPath: defaultExportPath(week, format),
    filters: [
      {
        extensions: [formatOptions.extension],
        name: formatOptions.label,
      },
    ],
    title: `Export week as ${formatOptions.label}`,
  });

  if (result.canceled || !result.filePath) {
    return {
      canceled: true,
      format,
    };
  }

  if (format === "pdf") {
    await fsPromises.writeFile(result.filePath, await createWeekPdf(week));
  } else if (format === "csv") {
    await fsPromises.writeFile(result.filePath, formatEntriesAsCsv(week.entries), "utf8");
  } else {
    await fsPromises.writeFile(result.filePath, formatWeekAsPlainText(week), "utf8");
  }

  return {
    canceled: false,
    filePath: result.filePath,
    format,
    mimeType: formatOptions.mimeType,
  };
}

function serializeError(error) {
  if (error instanceof WorktraceCoreError) {
    return { message: error.message, expected: true };
  }

  return {
    message: error && error.message ? error.message : "Unexpected desktop error",
    expected: false,
  };
}

async function handleDesktopAction(action) {
  try {
    return { ok: true, data: await action() };
  } catch (error) {
    return { ok: false, error: serializeError(error) };
  }
}

async function openLogDirectory() {
  await store.ensureLogDir();
  const result = await shell.openPath(store.logDir);

  if (result) {
    throw new WorktraceCoreError(result);
  }

  return store.logDir;
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.cgi.worktrace.desktop");
  }

  setDockIcon();
  createStore();
  createTray();
  createWindow();

  app.on("activate", () => {
    showMainWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (isQuitting) {
    app.quit();
  }
});

ipcMain.handle("worktrace:get-state", (_event, ref) => handleDesktopAction(() => store.getState(ref)));
ipcMain.handle("worktrace:add-entry", (_event, message, time, date) => handleDesktopAction(() => store.addEntry(message, time, date).then(() => store.getState())));
ipcMain.handle("worktrace:clone-entry", (_event, ref, line) => handleDesktopAction(() => store.cloneEntry(ref, line).then(() => store.getState(ref))));
ipcMain.handle("worktrace:delete-entry", (_event, ref, line) => handleDesktopAction(() => store.deleteEntry(ref, line).then(() => store.getState(ref))));
ipcMain.handle("worktrace:edit-entry", (_event, ref, line, date, time, message) => handleDesktopAction(() => store.editEntry(ref, line, date, time, message).then(() => store.getState(ref))));
ipcMain.handle("worktrace:copy-text", (_event, text) => handleDesktopAction(() => {
  clipboard.writeText(String(text || ""));
  return true;
}));
ipcMain.handle("worktrace:save-week", (_event, text) => handleDesktopAction(() => store.saveWeek("", text).then(() => store.getState())));
ipcMain.handle("worktrace:open-log-dir", () => handleDesktopAction(openLogDirectory));
ipcMain.handle("worktrace:export-week", (_event, format) => handleDesktopAction(() => exportWeek(format)));
ipcMain.handle("worktrace:minimize-window", () => handleDesktopAction(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
}));
ipcMain.handle("worktrace:maximize-window", () => handleDesktopAction(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
}));
ipcMain.handle("worktrace:close-window", () => handleDesktopAction(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
}));
ipcMain.handle("worktrace:fit-window-height", (_event, contentHeight) => handleDesktopAction(() => {
  fitWindowToContent(contentHeight);
  return true;
}));
