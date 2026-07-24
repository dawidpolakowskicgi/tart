import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildEntryMessage, createWorktraceRenderer } = require("../desktop/renderer.cjs");

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.classes = new Set((element.className || "").split(/\s+/).filter(Boolean));
  }

  contains(className) {
    return this.classes.has(className);
  }

  toggle(className, force) {
    const shouldAdd = force === undefined ? !this.classes.has(className) : Boolean(force);

    if (shouldAdd) {
      this.classes.add(className);
    } else {
      this.classes.delete(className);
    }

    this.element.className = Array.from(this.classes).join(" ");
    return shouldAdd;
  }
}

class FakeElement {
  constructor({ id = "", className = "", dataset = {} } = {}) {
    this.id = id;
    this.className = className;
    this.dataset = { ...dataset };
    this.textContent = "";
    this.value = "";
    this.disabled = false;
    this.children = [];
    this.listeners = {};
    this.focusCount = 0;
    this.classList = new FakeClassList(this);
  }

  addEventListener(eventName, callback) {
    this.listeners[eventName] = callback;
  }

  append(...children) {
    this.children.push(...children);
  }

  focus() {
    this.focusCount += 1;
  }

  replaceChildren(...children) {
    this.children = [...children];
  }
}

class FakeDocument {
  constructor() {
    this.body = { dataset: {} };
    this.elements = new Map();
    this.themeButton = new FakeElement({ id: "themeButton", className: "theme-button", dataset: { theme: "dark" } });
    this.windowButtons = [
      new FakeElement({ className: "window-controls__button", dataset: { windowAction: "minimize" } }),
      new FakeElement({ className: "window-controls__button", dataset: { windowAction: "maximize" } }),
      new FakeElement({ className: "window-controls__button is-close", dataset: { windowAction: "close" } }),
    ];
    this.tabs = [
      new FakeElement({ className: "tab is-active", dataset: { view: "week" } }),
      new FakeElement({ className: "tab", dataset: { view: "today" } }),
      new FakeElement({ className: "tab", dataset: { view: "edit" } }),
    ];
    this.exportButtons = [
      new FakeElement({ className: "ghost-button export-button", dataset: { format: "txt" } }),
      new FakeElement({ className: "ghost-button export-button", dataset: { format: "csv" } }),
      new FakeElement({ className: "ghost-button export-button", dataset: { format: "pdf" } }),
    ];
    this.views = [
      new FakeElement({ id: "weekView", className: "view is-active" }),
      new FakeElement({ id: "todayView", className: "view" }),
      new FakeElement({ id: "editView", className: "view" }),
    ];

    for (const id of [
      "entryForm",
      "entryInput",
      "entryDateInput",
      "entryTimeInput",
      "projectInput",
      "applyWeekFilterButton",
      "logDir",
      "clearWeekFilterButton",
      "filterSummary",
      "copyWeekButton",
      "openLogDirButton",
      "rangeEndInput",
      "rangeStartInput",
      "referenceInput",
      "refreshButton",
      "entrySubmitButton",
      "saveWeekButton",
      "status",
      "todayCount",
      "todayDate",
      "todayEntries",
      "viewTitle",
      "weekRefInput",
      "weekCount",
      "weekEditor",
      "weekEntries",
      "weekFile",
      "weekLabel",
      "themeButton",
    ]) {
      this.elements.set(`#${id}`, new FakeElement({ id }));
    }
    this.elements.set("#themeButton", this.themeButton);
  }

  createElement() {
    return new FakeElement();
  }

  querySelector(selector) {
    return this.elements.get(selector) || null;
  }

  querySelectorAll(selector) {
    if (selector === ".tab") {
      return this.tabs;
    }

    if (selector === ".export-button") {
      return this.exportButtons;
    }

    if (selector === ".window-controls__button") {
      return this.windowButtons;
    }

    if (selector === ".view") {
      return this.views;
    }

    return [];
  }
}

function makeState(overrides = {}) {
  return {
    config: {
      currentFile: "/tmp/worktrace/2026-04-27.log",
      logDir: "/tmp/worktrace",
    },
    availableWeeks: ["2026-04-27", "2026-04-20"],
    today: {
      date: "2026-04-30",
      entries: [
        {
          date: "2026-04-30",
          time: "09:15",
          message: "current day",
        },
      ],
    },
    week: {
      entries: [
        {
          date: "2026-04-29",
          time: "08:30",
          message: "previous day",
        },
        {
          date: "2026-04-30",
          time: "09:15",
          message: "current day",
        },
      ],
      filePath: "/tmp/worktrace/2026-04-27.log",
      text: "2026-04-29 08:30 previous day\n2026-04-30 09:15 current day\n",
      weekStart: "2026-04-27",
    },
    ...overrides,
  };
}

function makeRenderer(apiOverrides = {}) {
  const document = new FakeDocument();
  const calls = [];
  const api = {
    addEntry: async (message, time = "", date = "") => {
      calls.push(["addEntry", message, time, date]);
      return makeState({
        today: {
          date: "2026-04-30",
          entries: [{ date: "2026-04-30", time: "09:15", message }],
        },
        week: {
          entries: [{ date: "2026-04-30", time: "09:15", message }],
          filePath: "/tmp/worktrace/2026-04-27.log",
          text: `2026-04-30 09:15 ${message}\n`,
          weekStart: "2026-04-27",
        },
      });
    },
    getState: async (ref = "") => {
      calls.push(["getState", ref]);
      return makeState();
    },
    exportWeek: async (format) => {
      calls.push(["exportWeek", format]);
      return {
        canceled: false,
        filePath: `/tmp/worktrace/week.${format}`,
        format,
      };
    },
    openLogDir: async () => {
      calls.push(["openLogDir"]);
      return "/tmp/worktrace";
    },
    saveWeek: async (text) => {
      calls.push(["saveWeek", text]);
      return makeState({
        week: {
          entries: [{ date: "2026-04-30", time: "09:15", message: "saved" }],
          filePath: "/tmp/worktrace/2026-04-27.log",
          text,
          weekStart: "2026-04-27",
        },
      });
    },
    copyText: async (text) => {
      calls.push(["copyText", text]);
      return true;
    },
    editEntry: async (ref, line, date, time, message) => {
      calls.push(["editEntry", ref, line, date, time, message]);
      return makeState({
        week: {
          entries: [{ date: "2026-04-29", time: "08:30", message }],
          filePath: "/tmp/worktrace/2026-04-27.log",
          text: `2026-04-29 08:30 ${message}\n`,
          weekStart: "2026-04-27",
        },
      });
    },
    cloneEntry: async (ref, line) => {
      calls.push(["cloneEntry", ref, line]);
      const [date, time, ...messageParts] = String(line).split(" ");
      const message = messageParts.join(" ");
      return makeState({
        week: {
          entries: [{ date, time, message }],
          filePath: "/tmp/worktrace/2026-04-27.log",
          text: `${line}\n`,
          weekStart: "2026-04-27",
        },
      });
    },
    deleteEntry: async (ref, line) => {
      calls.push(["deleteEntry", ref, line]);
      return makeState();
    },
    ...apiOverrides,
  };

  return {
    api,
    calls,
    document,
    renderer: createWorktraceRenderer({ api, document }),
  };
}

let passCount = 0;
let failCount = 0;

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

await runTest("renderer starts and paints initial state", async () => {
  const { calls, renderer } = makeRenderer();

  await renderer.start();

  assert.deepEqual(calls, [["getState", ""]]);
  assert.equal(renderer.elements.entryDateInput.value.length, 10);
  assert.equal(renderer.elements.entryTimeInput.value.length, 5);
  assert.equal(renderer.elements.viewTitle.textContent, "This week");
  assert.equal(renderer.elements.weekLabel.textContent, "Week of 2026-04-27");
  assert.equal(renderer.elements.weekCount.textContent, "2");
  assert.equal(renderer.elements.todayCount.textContent, "1");
  assert.equal(renderer.elements.logDir.textContent, "/tmp/worktrace");
  assert.equal(renderer.elements.themeButton.textContent, "Dark");
  assert.equal(renderer.elements.weekEntries.children.length, 2);
  assert.equal(renderer.elements.todayEntries.children.length, 1);
  assert.equal(renderer.elements.weekRefInput.value, "2026-04-27");
  assert.equal(renderer.elements.weekRefInput.children.length, 2);
  assert.equal(renderer.elements.filterSummary.textContent, "Week reference 2026-04-27. Showing 2 of 2 entries from start of week to end of week.");
});

await runTest("renderer switches views", () => {
  const { document, renderer } = makeRenderer();

  renderer.showView("edit");

  assert.equal(renderer.getCurrentView(), "edit");
  assert.equal(renderer.elements.viewTitle.textContent, "Edit weekly file");
  assert.equal(document.tabs[2].classList.contains("is-active"), true);
  assert.equal(document.views[2].classList.contains("is-active"), true);
  assert.equal(document.views[0].classList.contains("is-active"), false);
});

await runTest("renderer shows empty states", () => {
  const { renderer } = makeRenderer();

  renderer.renderState(makeState({
    today: { date: "2026-04-30", entries: [] },
    week: {
      entries: [],
      filePath: "/tmp/worktrace/2026-04-27.log",
      text: "",
      weekStart: "2026-04-27",
    },
  }));

  assert.equal(renderer.elements.weekEntries.children.length, 1);
  assert.equal(renderer.elements.weekEntries.children[0].className, "empty-state");
  assert.equal(renderer.elements.weekEntries.children[0].textContent, "No entries match the selected date range");
  assert.equal(renderer.elements.todayEntries.children[0].textContent, "No entries for today");
});

await runTest("renderer filters week by date range", async () => {
  const { renderer } = makeRenderer();

  renderer.elements.weekRefInput.value = "2026-04-30";
  renderer.elements.rangeStartInput.value = "2026-04-30";
  renderer.elements.rangeEndInput.value = "2026-04-30";
  await renderer.applyWeekFilter({ preventDefault() {} });

  assert.equal(renderer.getCurrentState().week.weekStart, "2026-04-27");
  assert.equal(renderer.elements.weekCount.textContent, "1");
  assert.equal(renderer.elements.weekEntries.children.length, 1);
  assert.equal(renderer.elements.weekEntries.children[0].children[1].textContent, "current day");
  assert.equal(renderer.elements.weekEntries.children[0].children[0].textContent, "2026-04-30 09:15");
  assert.equal(renderer.elements.filterSummary.textContent, "Week reference 2026-04-27. Showing 1 of 2 entries from 2026-04-30 to 2026-04-30.");
});

await runTest("renderer cycles theme label on click", async () => {
  const { document, renderer } = makeRenderer();

  await renderer.start();
  await document.themeButton.listeners.click();

  assert.equal(renderer.elements.themeButton.textContent, "Light");
  assert.equal(document.body.dataset.theme, "light");
});

await runTest("renderer clears week filters", async () => {
  const { renderer } = makeRenderer();

  renderer.elements.rangeStartInput.value = "2026-04-30";
  renderer.elements.rangeEndInput.value = "2026-04-30";
  await renderer.applyWeekFilter({ preventDefault() {} });
  await renderer.clearWeekFilter();

  assert.equal(renderer.elements.rangeStartInput.value, "");
  assert.equal(renderer.elements.rangeEndInput.value, "");
  assert.equal(renderer.elements.weekCount.textContent, "2");
});

await runTest("renderer adds trimmed entries", async () => {
  const { calls, renderer } = makeRenderer();
  renderer.elements.entryInput.value = "  shipped electron app  ";
  renderer.elements.entryDateInput.value = "2026-04-30";
  renderer.elements.entryTimeInput.value = "09:15";

  await renderer.addEntry({ preventDefault() {} });

  assert.deepEqual(calls, [["addEntry", "shipped electron app", "09:15", "2026-04-30"]]);
  assert.equal(renderer.elements.entryInput.value, "");
  assert.equal(renderer.elements.entryDateInput.value, "");
  assert.equal(renderer.elements.entryTimeInput.value, "");
  assert.equal(renderer.elements.status.textContent, "Entry added.");
  assert.equal(renderer.elements.status.dataset.tone, "ok");
  assert.equal(renderer.getCurrentView(), "week");
  assert.equal(renderer.elements.weekEntries.children[0].children[0].textContent, "2026-04-30 09:15");
  assert.equal(renderer.elements.weekEntries.children[0].children[1].textContent, "shipped electron app");
});

await runTest("renderer appends ticket or link references", async () => {
  const { calls, renderer } = makeRenderer();
  renderer.elements.entryInput.value = "Updated invoice workflow";
  renderer.elements.entryDateInput.value = "2026-04-30";
  renderer.elements.entryTimeInput.value = "09:15";
  renderer.elements.projectInput.value = " Platform ";
  renderer.elements.referenceInput.value = " CGI-123 ";

  await renderer.addEntry({ preventDefault() {} });

  assert.deepEqual(calls, [["addEntry", "Updated invoice workflow [project: Platform] [ref: CGI-123]", "09:15", "2026-04-30"]]);
  assert.equal(renderer.elements.entryInput.value, "");
  assert.equal(renderer.elements.projectInput.value, "");
  assert.equal(renderer.elements.referenceInput.value, "");
  assert.equal(renderer.elements.weekEntries.children[0].children[0].textContent, "2026-04-30 09:15");
  assert.equal(renderer.elements.weekEntries.children[0].children[1].textContent, "Updated invoice workflow [project: Platform] [ref: CGI-123]");
});

await runTest("renderer clones and deletes log rows", async () => {
  const { calls, renderer } = makeRenderer();

  await renderer.start();
  let actions = renderer.elements.weekEntries.children[0].children[2];
  await actions.children[0].listeners.click();
  assert.equal(renderer.elements.entrySubmitButton.textContent, "Save");
  assert.equal(renderer.elements.entryInput.value, "previous day");
  assert.equal(renderer.elements.entryDateInput.value, "2026-04-29");
  assert.equal(renderer.elements.entryTimeInput.value, "08:30");
  renderer.elements.entryDateInput.value = "2026-04-30";
  renderer.elements.entryTimeInput.value = "09:45";
  renderer.elements.entryInput.value = "updated row";
  await renderer.addEntry({ preventDefault() {} });
  assert(calls.some(([name, ref, line, date, time, message]) => name === "editEntry" && ref === "2026-04-27" && line === "2026-04-29 08:30 previous day" && date === "2026-04-30" && time === "09:45" && message === "updated row"));

  actions = renderer.elements.weekEntries.children[0].children[2];
  await actions.children[1].listeners.click();
  assert(calls.some(([name, ref, line]) => name === "cloneEntry" && ref === "2026-04-27" && line === "2026-04-29 08:30 updated row"));

  actions = renderer.elements.weekEntries.children[0].children[2];
  await actions.children[2].listeners.click();
  assert(calls.some(([name, ref]) => name === "deleteEntry" && ref === "2026-04-27"));
  assert.equal(renderer.elements.status.textContent, "Entry deleted.");
});

await runTest("renderer copies visible week text", async () => {
  const { calls, renderer } = makeRenderer();

  await renderer.start();
  await renderer.elements.copyWeekButton.listeners.click();

  assert(calls.some(([name, text]) => name === "copyText" && text.includes("2026-04-29 08:30 previous day")));
  assert.equal(renderer.elements.status.textContent, "Copied week log to clipboard.");
});

await runTest("renderer builds reference messages", () => {
  assert.equal(buildEntryMessage("Fixed reports", "", ""), "Fixed reports");
  assert.equal(buildEntryMessage("Fixed reports", "Platform", ""), "Fixed reports [project: Platform]");
  assert.equal(buildEntryMessage("Fixed reports", "", "https://example.test/ticket/1"), "Fixed reports [ref: https://example.test/ticket/1]");
  assert.equal(buildEntryMessage("Fixed reports", "Platform", "https://example.test/ticket/1"), "Fixed reports [project: Platform] [ref: https://example.test/ticket/1]");
});

await runTest("renderer rejects empty add form", async () => {
  const { calls, renderer } = makeRenderer();
  renderer.elements.entryInput.value = "   ";

  await renderer.addEntry({ preventDefault() {} });

  assert.deepEqual(calls, []);
  assert.equal(renderer.elements.status.textContent, "Enter a log message.");
  assert.equal(renderer.elements.status.dataset.tone, "error");
  assert.equal(renderer.elements.entryInput.focusCount, 1);
});

await runTest("renderer rejects multiline references", async () => {
  const { calls, renderer } = makeRenderer();
  renderer.elements.entryInput.value = "Updated docs";
  renderer.elements.referenceInput.value = "CGI-123\nCGI-124";

  await renderer.addEntry({ preventDefault() {} });

  assert.deepEqual(calls, []);
  assert.equal(renderer.elements.status.textContent, "Ticket or link must be a single line.");
  assert.equal(renderer.elements.status.dataset.tone, "error");
  assert.equal(renderer.elements.referenceInput.focusCount, 1);
});

await runTest("renderer rejects multiline project values", async () => {
  const { calls, renderer } = makeRenderer();
  renderer.elements.entryInput.value = "Updated docs";
  renderer.elements.projectInput.value = "Platform\nAPI";

  await renderer.addEntry({ preventDefault() {} });

  assert.deepEqual(calls, []);
  assert.equal(renderer.elements.status.textContent, "Task project must be a single line.");
  assert.equal(renderer.elements.status.dataset.tone, "error");
  assert.equal(renderer.elements.projectInput.focusCount, 1);
});

await runTest("renderer saves weekly editor text", async () => {
  const { calls, renderer } = makeRenderer();
  renderer.elements.weekEditor.value = "2026-04-30 saved\n";

  await renderer.saveWeek();

  assert.deepEqual(calls, [["saveWeek", "2026-04-30 saved\n"]]);
  assert.equal(renderer.elements.status.textContent, "Weekly file saved.");
  assert.equal(renderer.elements.status.dataset.tone, "ok");
  assert.equal(renderer.getCurrentView(), "week");
});

await runTest("renderer exports week formats", async () => {
  const { calls, document, renderer } = makeRenderer();

  await renderer.start();
  await document.exportButtons[1].listeners.click();

  assert.deepEqual(calls, [["getState", ""], ["exportWeek", "csv"]]);
  assert.equal(renderer.elements.status.textContent, "Exported CSV week to /tmp/worktrace/week.csv.");
  assert.equal(renderer.elements.status.dataset.tone, "ok");
});

await runTest("renderer handles canceled exports", async () => {
  const { calls, renderer } = makeRenderer({
    exportWeek: async (format) => {
      calls.push(["exportWeek", format]);
      return { canceled: true, format };
    },
  });

  await renderer.exportWeek("pdf");

  assert.deepEqual(calls, [["exportWeek", "pdf"]]);
  assert.equal(renderer.elements.status.textContent, "");
});

await runTest("renderer surfaces API errors", async () => {
  const { renderer } = makeRenderer({
    getState: async () => {
      throw new Error("disk unavailable");
    },
  });

  await renderer.loadState();

  assert.equal(renderer.elements.status.textContent, "disk unavailable");
  assert.equal(renderer.elements.status.dataset.tone, "error");
  assert.equal(renderer.elements.entryInput.disabled, false);
});

await runTest("renderer opens log directory through API", async () => {
  const { calls, renderer } = makeRenderer();

  await renderer.openLogDir();

  assert.deepEqual(calls, [["openLogDir"]]);
});

process.stdout.write(`\n${passCount} renderer tests passed, ${failCount} failed\n`);

if (failCount > 0) {
  process.exitCode = 1;
}
