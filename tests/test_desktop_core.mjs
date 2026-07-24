import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  WorktraceCoreError,
  WorktraceStore,
  defaultLogDir,
  escapeCsvCell,
  formatEntriesAsCsv,
  formatWeekAsPlainText,
  formatLocalDateTime,
  normalizeLogText,
  parseEntries,
  weekStartForDate,
  weekStartForIsoWeek,
  sortWeekStartsDescending,
} = require("../desktop/worktrace-core.cjs");

let passCount = 0;
let failCount = 0;

async function withTempDir(fn) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "worktrace-electron-test-"));

  try {
    await fn(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function runTest(name, fn) {
  process.stdout.write(`test ${name.padEnd(48, " ")}`);

  try {
    await fn();
    passCount += 1;
    process.stdout.write("ok\n");
  } catch (error) {
    failCount += 1;
    process.stdout.write("FAIL\n");
    process.stderr.write(`${error.stack || error.message}\n`);
  }
}

function assertThrowsWorktraceError(fn, expectedMessage) {
  assert.throws(fn, (error) => error instanceof WorktraceCoreError && error.message.includes(expectedMessage));
}

await runTest("desktop week date helpers", () => {
  assert.equal(weekStartForDate("2026-04-30"), "2026-04-27");
  assert.equal(weekStartForIsoWeek("2026-W18"), "2026-04-27");
  assert.equal(weekStartForIsoWeek("2020-W53"), "2020-12-28");
  assertThrowsWorktraceError(() => weekStartForDate("2026-02-30"), "invalid date");
  assertThrowsWorktraceError(() => weekStartForIsoWeek("2021-W53"), "invalid ISO week");
});

await runTest("desktop log text helpers", () => {
  assert.equal(normalizeLogText("a\r\nb\n\n"), "a\nb\n");
  assert.equal(normalizeLogText("\n\n"), "");
  assert.deepEqual(parseEntries("2026-04-30 shipped UI\n")[0], {
    id: "0-2026-04-30 shipped UI",
    date: "2026-04-30",
    time: "",
    message: "shipped UI",
    line: "2026-04-30 shipped UI",
    valid: true,
  });
  assert.deepEqual(parseEntries("2026-04-30 09:15 shipped UI\n")[0], {
    id: "0-2026-04-30 09:15 shipped UI",
    date: "2026-04-30",
    time: "09:15",
    message: "shipped UI",
    line: "2026-04-30 09:15 shipped UI",
    valid: true,
  });
  assert.equal(formatLocalDateTime(new Date(2026, 3, 30, 9, 15)), "2026-04-30 09:15");
});

await runTest("desktop export format helpers", () => {
  assert.equal(formatWeekAsPlainText({ text: "2026-04-30 shipped\r\n\n" }), "2026-04-30 shipped\n");
  assert.equal(escapeCsvCell('fixed "reports", export'), '"fixed ""reports"", export"');
  assert.equal(formatEntriesAsCsv([
    { date: "2026-04-29", message: "previous day" },
    { date: "2026-04-30", message: "fixed csv, pdf and txt" },
    { date: "2026-05-01", message: 'quoted "value"' },
  ]), 'date,message\n2026-04-29,previous day\n2026-04-30,"fixed csv, pdf and txt"\n2026-05-01,"quoted ""value"""\n');
});

await runTest("desktop sorts week starts descending", () => {
  assert.deepEqual(["2026-04-27", "2026-05-04", "2026-04-20"].sort(sortWeekStartsDescending), [
    "2026-05-04",
    "2026-04-27",
    "2026-04-20",
  ]);
});

await runTest("desktop default log directory", () => {
  assert.equal(defaultLogDir("/Users/example"), path.join("/Users/example", "Documents", "worktrace"));
});

await runTest("desktop store adds and reads entries", async () => {
  await withTempDir(async (tempDir) => {
    const store = new WorktraceStore({
      logDir: tempDir,
      now: () => new Date(2026, 3, 30, 9, 15),
      today: "2026-04-30",
    });
    const result = await store.addEntry("implemented electron desktop");

    assert.equal(result.line, "2026-04-30 09:15 implemented electron desktop");
    assert.equal(result.filePath, path.join(tempDir, "2026-04-27.log"));
    assert.equal(result.time, "09:15");

    const week = await store.readWeek();
    assert.equal(week.weekStart, "2026-04-27");
    assert.equal(week.entries.length, 1);
    assert.equal(week.entries[0].message, "implemented electron desktop");
    assert.equal(week.entries[0].time, "09:15");

    const today = await store.readToday();
    assert.equal(today.entries.length, 1);
  });
});

await runTest("desktop store lists available weeks", async () => {
  await withTempDir(async (tempDir) => {
    const store = new WorktraceStore({ logDir: tempDir, today: "2026-04-30" });
    await fs.writeFile(path.join(tempDir, "2026-04-27.log"), "2026-04-29 previous\n");
    await fs.writeFile(path.join(tempDir, "2026-04-20.log"), "2026-04-20 older\n");
    await fs.writeFile(path.join(tempDir, "notes.txt"), "ignore me\n");

    assert.deepEqual(await store.listAvailableWeeks(), ["2026-04-27", "2026-04-20"]);
  });
});

await runTest("desktop store saves raw weekly text", async () => {
  await withTempDir(async (tempDir) => {
    const store = new WorktraceStore({
      logDir: tempDir,
      now: () => new Date(2026, 3, 30, 9, 15),
      today: "2026-04-30",
    });
    await store.saveWeek("", "2026-04-29 previous\r\n2026-04-30 current\n\n");

    const week = await store.readWeek();
    assert.equal(week.text, "2026-04-29 previous\n2026-04-30 current\n");
    assert.equal(week.entries.length, 2);
  });
});

await runTest("desktop store rejects bad entries", async () => {
  await withTempDir(async (tempDir) => {
    const store = new WorktraceStore({ logDir: tempDir, today: "2026-04-30" });

    await assert.rejects(() => store.addEntry(""), /missing entry message/);
    await assert.rejects(() => store.addEntry("first\nsecond"), /single line/);
  });
});

process.stdout.write(`\n${passCount} desktop tests passed, ${failCount} failed\n`);

if (failCount > 0) {
  process.exitCode = 1;
}
