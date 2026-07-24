import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { WorktraceStore } from "../desktop/worktrace-core.cjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(repoRoot, "tests", "fixtures", "desktop-screenshot-week.log");
const screenshotPath = path.join(repoRoot, "src", "Screenshot.png");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function electronBinaryPath() {
  const localBinary = process.platform === "win32"
    ? path.join(repoRoot, "node_modules", ".bin", "electron.cmd")
    : path.join(repoRoot, "node_modules", ".bin", "electron");

  return localBinary;
}

function renderEntry(entry) {
  const stamp = escapeHtml(entry.time ? `${entry.date} ${entry.time}` : entry.date);
  return `
    <article class="entry">
      <div class="entry__date">${stamp}</div>
      <div class="entry__message">${escapeHtml(entry.message)}</div>
      <div class="entry__actions">
        <button>Edit</button>
        <button>Clone</button>
        <button class="danger">Delete</button>
      </div>
    </article>
  `;
}

function buildScreenshotHtml(state) {
  const entries = (state.week.entries || []).slice(0, 3).map(renderEntry).join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>worktrace desktop screenshot</title>
    <style>
      :root {
        --bg: #eff3f8;
        --panel: rgba(255, 255, 255, 0.9);
        --line: #d6dce6;
        --text: #1f2937;
        --muted: #687387;
        --accent: #e3262d;
        --danger: #c2410c;
        --shadow: 0 18px 40px rgba(15, 23, 42, 0.09);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Avenir Next", "Segoe UI", Arial, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(227, 38, 45, 0.08), transparent 26%),
          radial-gradient(circle at bottom right, rgba(226, 50, 45, 0.08), transparent 20%),
          linear-gradient(180deg, #f7f9fc 0%, var(--bg) 100%);
      }
      .frame {
        width: 1600px;
        height: 900px;
        overflow: hidden;
      }
      .topbar {
        height: 86px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 28px;
        background: rgba(255, 255, 255, 0.86);
        border-bottom: 1px solid var(--line);
        backdrop-filter: blur(14px);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 18px;
      }
      .brand__logo {
        color: #e3262d;
        font-size: 42px;
        font-weight: 800;
        letter-spacing: -0.06em;
      }
      .brand__title {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .brand__name {
        font-size: 34px;
        font-weight: 800;
        line-height: 1;
      }
      .brand__week {
        font-size: 22px;
        color: var(--muted);
      }
      .chrome {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .chrome span {
        display: inline-block;
        width: 13px;
        height: 13px;
        border-radius: 999px;
        background: #cbd5e1;
      }
      .app {
        display: grid;
        grid-template-columns: 408px 1fr;
        height: calc(100% - 86px);
      }
      .sidebar {
        padding: 26px 24px;
        border-right: 1px solid var(--line);
        background: rgba(248, 250, 252, 0.7);
      }
      .sidebar h2 {
        margin: 8px 0 22px;
        font-size: 18px;
        font-weight: 600;
        color: var(--muted);
      }
      .ghost {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        width: 100%;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.94);
        color: var(--text);
        font-size: 17px;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
      }
      .stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin: 18px 0 24px;
      }
      .stat, .filter-card, .list-panel, .form-panel {
        border: 1px solid var(--line);
        background: var(--panel);
        box-shadow: var(--shadow);
      }
      .stat {
        padding: 22px 20px;
        min-height: 118px;
      }
      .stat__value {
        font-size: 52px;
        font-weight: 800;
      }
      .stat__label {
        display: block;
        margin-top: 8px;
        font-size: 17px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .tabs {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 24px;
      }
      .tab {
        padding: 16px 14px;
        font-size: 18px;
      }
      .tab.active {
        color: var(--accent);
        font-weight: 700;
        background: rgba(255,255,255,0.82);
      }
      .filter-card {
        padding: 18px 18px 20px;
      }
      .filter-card__header {
        display: flex;
        justify-content: space-between;
        font-size: 16px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
      }
      .filter-card__hint {
        color: var(--muted);
        font-weight: 500;
      }
      .field {
        margin-top: 18px;
      }
      .field label {
        display: block;
        margin-bottom: 8px;
        font-size: 15px;
        color: var(--muted);
      }
      .input {
        display: flex;
        align-items: center;
        min-height: 54px;
        padding: 0 16px;
        border: 1px solid var(--line);
        background: #fff;
        font: 500 18px/1.2 "SF Mono", "JetBrains Mono", monospace;
      }
      .field-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .main {
        padding: 26px 28px;
      }
      .eyebrow {
        margin: 0;
        color: var(--muted);
        letter-spacing: 0.22em;
        text-transform: uppercase;
        font-size: 18px;
        font-weight: 800;
      }
      .view-title {
        margin: 10px 0 22px;
        font-size: 56px;
        font-weight: 800;
        letter-spacing: -0.05em;
      }
      .form-panel {
        padding: 18px;
        display: grid;
        grid-template-columns: 170px 150px 1.2fr 220px 1fr 170px;
        gap: 16px;
        align-items: center;
      }
      .button-primary {
        min-height: 58px;
        border: none;
        background: linear-gradient(180deg, #f04c53 0%, #cf252c 100%);
        color: white;
        font-size: 24px;
        font-weight: 700;
        box-shadow: 0 10px 18px rgba(207, 37, 44, 0.24);
      }
      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 32px 0 12px;
      }
      .section-head h3 {
        margin: 0;
        font-size: 22px;
      }
      .section-head span {
        font-size: 15px;
        color: var(--muted);
      }
      .list-panel {
        padding: 20px;
      }
      .entry {
        display: grid;
        grid-template-columns: 230px 1fr 260px;
        gap: 20px;
        align-items: center;
        min-height: 70px;
        padding: 0 18px;
        border: 1px solid var(--line);
        background: #fbfcfe;
      }
      .entry + .entry {
        margin-top: 12px;
      }
      .entry__date {
        font: 700 18px/1.2 "SF Mono", "JetBrains Mono", monospace;
        color: var(--accent);
      }
      .entry__message {
        font: 500 17px/1.45 "SF Mono", "JetBrains Mono", monospace;
      }
      .entry__actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .entry__actions button {
        min-height: 38px;
        min-width: 74px;
        padding: 0 14px;
        border: 1px solid var(--line);
        background: white;
        font-size: 14px;
      }
      .entry__actions .danger {
        color: var(--danger);
      }
      .copy-row {
        margin-top: 18px;
      }
      .copy-row .ghost {
        width: 198px;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <header class="topbar">
        <div class="brand">
          <div class="brand__logo">CGI</div>
          <div class="brand__title">
            <div class="brand__name">worktrace</div>
            <div class="brand__week">Week of ${escapeHtml(state.week.weekStart)}</div>
          </div>
        </div>
        <div class="chrome"><span></span><span></span><span></span></div>
      </header>
      <div class="app">
        <aside class="sidebar">
          <h2>Workspace</h2>
          <button class="ghost">Refresh</button>
          <div class="stats">
            <div class="stat">
              <div class="stat__value">${escapeHtml((state.week.entries || []).length)}</div>
              <span class="stat__label">Week</span>
            </div>
            <div class="stat">
              <div class="stat__value">${escapeHtml((state.today.entries || []).length)}</div>
              <span class="stat__label">Today</span>
            </div>
          </div>
          <div class="tabs">
            <div class="tab active">Week</div>
            <div class="tab">Today</div>
            <div class="tab">Edit</div>
          </div>
          <section class="filter-card">
            <div class="filter-card__header">
              <span>View week</span>
              <span class="filter-card__hint">Week and range filters</span>
            </div>
            <div class="field">
              <label>Week reference</label>
              <div class="input">${escapeHtml(state.week.weekStart)}</div>
            </div>
            <div class="field field-row">
              <div>
                <label>From</label>
                <div class="input">dd/mm/yyyy</div>
              </div>
              <div>
                <label>To</label>
                <div class="input">dd/mm/yyyy</div>
              </div>
            </div>
            <div class="field">
              <label>Summary</label>
              <div style="font-size:14px;color:var(--muted);line-height:1.4">Week reference ${escapeHtml(state.week.weekStart)}. Showing ${(state.week.entries || []).length} of ${(state.week.entries || []).length} entries.</div>
            </div>
          </section>
        </aside>
        <main class="main">
          <p class="eyebrow">worktrace</p>
          <h1 class="view-title">This week</h1>
          <section class="form-panel">
            <div class="input">2026-07-23</div>
            <div class="input">08:30</div>
            <div class="input">Add activity text to log</div>
            <div class="input">Task project</div>
            <div class="input">Ticket or link</div>
            <button class="button-primary">+ Add</button>
          </section>
          <div class="section-head">
            <h3>Filtered log</h3>
            <span>${escapeHtml(state.week.filePath)}</span>
          </div>
          <section class="list-panel">
            ${entries}
            <div class="copy-row">
              <button class="ghost">Copy to clipboard</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  </body>
</html>`;
}

async function main() {
  const electronPath = electronBinaryPath();
  try {
    await fs.access(electronPath);
  } catch {
    throw new Error("Electron binary was not found. Run npm install before generating the desktop screenshot.");
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "worktrace-screenshot-"));
  const logDir = path.join(tempDir, "logs");
  const htmlPath = path.join(tempDir, "screenshot.html");
  const runnerPath = path.join(tempDir, "capture-screenshot.cjs");
  await fs.mkdir(logDir, { recursive: true });
  await fs.copyFile(fixturePath, path.join(logDir, "2026-07-21.log"));

  const store = new WorktraceStore({
    env: { WORKTRACE_LOGDIR: logDir, WORKTRACE_TODAY: "2026-07-23" },
    logDir,
    today: "2026-07-23",
    now: () => new Date("2026-07-23T08:30:00"),
  });

  const state = await store.getState("2026-07-21");
  await fs.writeFile(htmlPath, buildScreenshotHtml(state));
  await fs.writeFile(runnerPath, `
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const htmlPath = process.argv[2];
const screenshotPath = process.argv[3];

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");

async function run() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    backgroundColor: "#f7f9fc",
    webPreferences: {
      sandbox: true,
    },
  });

  await win.loadURL(pathToFileURL(htmlPath).href);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const image = await win.webContents.capturePage();
  fs.writeFileSync(screenshotPath, image.toPNG());
  win.destroy();
  app.quit();
}

app.whenReady()
  .then(run)
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
`, "utf8");

  await execFileAsync(electronPath, [runnerPath, htmlPath, screenshotPath]);

  const stat = await fs.stat(screenshotPath);
  if (stat.size === 0) {
    throw new Error("Screenshot PNG was empty.");
  }

  console.log(`Wrote ${path.relative(repoRoot, screenshotPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
