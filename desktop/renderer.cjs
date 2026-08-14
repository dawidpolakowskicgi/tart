const viewTitles = {
  week: "This week",
  today: "Today",
  diagram: "Activity diagram",
  edit: "Edit weekly file",
};

const themeLabels = {
  light: "Light",
  dark: "Dark",
};

function isDateLiteral(value) {
  return /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.test(String(value || ""));
}

function compareDates(left, right) {
  return String(left || "").localeCompare(String(right || ""));
}

function hasLineBreak(value) {
  return /[\n\r]/.test(String(value || ""));
}

function formatEntryLine(entry) {
  if (entry && entry.line) {
    return entry.line;
  }

  const date = entry && entry.date ? entry.date : "";
  const time = entry && entry.time ? ` ${entry.time}` : "";
  const message = entry && entry.message ? entry.message : "";
  return `${date}${time} ${message}`.trim();
}

function formatSpentMinutes(totalMinutes) {
  const safeMinutes = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

function parseSpentToMinutes(value) {
  const input = String(value || "").trim().toLowerCase();

  if (!input) {
    return 0;
  }

  let total = 0;
  let matched = false;
  const pattern = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/g;
  let token = pattern.exec(input);

  while (token) {
    matched = true;
    const amount = Number(token[1]);
    const unit = token[2];

    if (unit.startsWith("h")) {
      total += Math.round(amount * 60);
    } else {
      total += Math.round(amount);
    }

    token = pattern.exec(input);
  }

  if (matched) {
    return total;
  }

  if (/^\d+(?:\.\d+)?$/.test(input)) {
    return Math.round(Number(input) * 60);
  }

  return 0;
}

function collectElements(documentRef) {
  return {
    entryForm: documentRef.querySelector("#entryForm"),
    entryInput: documentRef.querySelector("#entryInput"),
    entryDateInput: documentRef.querySelector("#entryDateInput"),
    entryTimeInput: documentRef.querySelector("#entryTimeInput"),
    timeSpentInput: documentRef.querySelector("#timeSpentInput"),
    projectInput: documentRef.querySelector("#projectInput"),
    exportButtons: Array.from(documentRef.querySelectorAll(".export-button")),
    themeButton: documentRef.querySelector("#themeButton"),
    windowButtons: Array.from(documentRef.querySelectorAll(".window-controls__button")),
    logDir: documentRef.querySelector("#logDir"),
    openLogDirButton: documentRef.querySelector("#openLogDirButton"),
    applyWeekFilterButton: documentRef.querySelector("#applyWeekFilterButton"),
    clearWeekFilterButton: documentRef.querySelector("#clearWeekFilterButton"),
    filterSummary: documentRef.querySelector("#filterSummary"),
    copyWeekButton: documentRef.querySelector("#copyWeekButton"),
    diagramPanel: documentRef.querySelector("#diagramPanel"),
    diagramSummary: documentRef.querySelector("#diagramSummary"),
    rangeEndInput: documentRef.querySelector("#rangeEndInput"),
    rangeStartInput: documentRef.querySelector("#rangeStartInput"),
    referenceInput: documentRef.querySelector("#referenceInput"),
    refreshButton: documentRef.querySelector("#refreshButton"),
    entrySubmitButton: documentRef.querySelector("#entrySubmitButton"),
    saveWeekButton: documentRef.querySelector("#saveWeekButton"),
    status: documentRef.querySelector("#status"),
    tabs: Array.from(documentRef.querySelectorAll(".tab")),
    weekRefInput: documentRef.querySelector("#weekRefInput"),
    todayCount: documentRef.querySelector("#todayCount"),
    todayDate: documentRef.querySelector("#todayDate"),
    todayEntries: documentRef.querySelector("#todayEntries"),
    viewTitle: documentRef.querySelector("#viewTitle"),
    views: Array.from(documentRef.querySelectorAll(".view")),
    weekCount: documentRef.querySelector("#weekCount"),
    weekEditor: documentRef.querySelector("#weekEditor"),
    weekEntries: documentRef.querySelector("#weekEntries"),
    weekFile: documentRef.querySelector("#weekFile"),
    weekLabel: documentRef.querySelector("#weekLabel"),
  };
}

function formatWeekOptionLabel(weekStart) {
  return `${weekStart}`;
}

function parseEntryMessage(message) {
  const result = {
    message: String(message || "").trim(),
    project: "",
    reference: "",
    timeSpent: "",
  };

  while (true) {
    const match = /\s+\[(spent|project|ref): ([^]]+)]$/.exec(result.message);

    if (!match) {
      return result;
    }

    if (match[1] === "spent" && !result.timeSpent) {
      result.timeSpent = match[2].trim();
    } else if (match[1] === "project" && !result.project) {
      result.project = match[2].trim();
    } else if (match[1] === "ref" && !result.reference) {
      result.reference = match[2].trim();
    } else {
      return result;
    }

    result.message = result.message.slice(0, match.index).trimEnd();
  }
}

function buildEntryMessage(message, timeSpent, project, reference) {
  const cleanMessage = String(message || "").trim();
  const cleanTimeSpent = String(timeSpent || "").trim();
  const cleanProject = String(project || "").trim();
  const cleanReference = String(reference || "").trim();
  const segments = [cleanMessage];

  if (cleanTimeSpent) {
    segments.push(`[spent: ${cleanTimeSpent}]`);
  }

  if (cleanProject) {
    segments.push(`[project: ${cleanProject}]`);
  }

  if (cleanReference) {
    segments.push(`[ref: ${cleanReference}]`);
  }

  return segments.join(" ");
}

function buildDiagramData(entries) {
  const dayMap = new Map();
  const projectMap = new Map();

  for (const entry of entries || []) {
    const parsed = parseEntryMessage(entry.message);
    const spentMinutes = parseSpentToMinutes(parsed.timeSpent);
    const dayRecord = dayMap.get(entry.date) || { date: entry.date, count: 0, spentMinutes: 0 };
    dayRecord.count += 1;
    dayRecord.spentMinutes += spentMinutes;
    dayMap.set(entry.date, dayRecord);

    if (parsed.project) {
      const projectRecord = projectMap.get(parsed.project) || { name: parsed.project, count: 0, spentMinutes: 0 };
      projectRecord.count += 1;
      projectRecord.spentMinutes += spentMinutes;
      projectMap.set(parsed.project, projectRecord);
    }
  }

  return {
    byDay: Array.from(dayMap.values()).sort((left, right) => compareDates(left.date, right.date)),
    byProject: Array.from(projectMap.values()).sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.name.localeCompare(right.name);
    }),
  };
}

function createWorktraceRenderer({ document: documentRef, api, initialView = "week" }) {
  const elements = collectElements(documentRef);
  let currentState = null;
  let currentView = initialView;
  let currentWeekRef = "";
  let currentRange = { end: "", start: "" };
  let currentTheme = "dark";
  let currentEditing = null;
  let fitWindowScheduled = false;

  function scheduleWindowFit() {
    if (!api.fitWindowHeight || fitWindowScheduled) {
      return;
    }

    fitWindowScheduled = true;
    const run = () => {
      fitWindowScheduled = false;

      const documentHeight = documentRef.documentElement && documentRef.documentElement.scrollHeight
        ? documentRef.documentElement.scrollHeight
        : 0;
      const bodyHeight = documentRef.body && documentRef.body.scrollHeight
        ? documentRef.body.scrollHeight
        : 0;
      const documentRectHeight = documentRef.documentElement && typeof documentRef.documentElement.getBoundingClientRect === "function"
        ? documentRef.documentElement.getBoundingClientRect().height
        : 0;
      const bodyRectHeight = documentRef.body && typeof documentRef.body.getBoundingClientRect === "function"
        ? documentRef.body.getBoundingClientRect().height
        : 0;
      const nextHeight = Math.max(documentHeight, bodyHeight, documentRectHeight, bodyRectHeight);

      if (nextHeight > 0) {
        api.fitWindowHeight(nextHeight).catch(() => {});
      }
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
      return;
    }

    setTimeout(run, 0);
  }

  function setStatus(message, tone = "") {
    elements.status.textContent = message || "";
    elements.status.dataset.tone = tone;
    scheduleWindowFit();
  }

  function setBusy(isBusy) {
    elements.entryInput.disabled = isBusy;
    elements.timeSpentInput.disabled = isBusy;
    elements.projectInput.disabled = isBusy;
    elements.referenceInput.disabled = isBusy;
    elements.entryDateInput.disabled = isBusy;
    elements.entryTimeInput.disabled = isBusy;
    elements.refreshButton.disabled = isBusy;
    elements.saveWeekButton.disabled = isBusy;
    elements.applyWeekFilterButton.disabled = isBusy;
    elements.clearWeekFilterButton.disabled = isBusy;
    elements.copyWeekButton.disabled = isBusy;
    elements.weekRefInput.disabled = isBusy;
    elements.rangeStartInput.disabled = isBusy;
    elements.rangeEndInput.disabled = isBusy;

    for (const button of elements.exportButtons) {
      button.disabled = isBusy;
    }
  }

  function setEditingEntry(entry) {
    currentEditing = entry || null;

    if (!currentEditing) {
      elements.entryForm.dataset.mode = "create";
      elements.entrySubmitButton.textContent = "+ Add";
      scheduleWindowFit();
      return;
    }

    elements.entryForm.dataset.mode = "edit";
    const parsedEntry = parseEntryMessage(currentEditing.message);
    elements.entryDateInput.value = currentEditing.date;
    elements.entryTimeInput.value = currentEditing.time || "";
    elements.entryInput.value = parsedEntry.message;
    elements.timeSpentInput.value = parsedEntry.timeSpent;
    elements.projectInput.value = parsedEntry.project;
    elements.referenceInput.value = parsedEntry.reference;
    elements.entrySubmitButton.textContent = "Save";
    scheduleWindowFit();
  }

  function readEntryForm() {
    return {
      date: elements.entryDateInput.value.trim(),
      message: elements.entryInput.value.trim(),
      project: elements.projectInput.value.trim(),
      reference: elements.referenceInput.value.trim(),
      time: elements.entryTimeInput.value.trim(),
      timeSpent: elements.timeSpentInput.value.trim(),
    };
  }

  function clearEntryForm() {
    elements.entryInput.value = "";
    elements.entryDateInput.value = "";
    elements.entryTimeInput.value = "";
    elements.timeSpentInput.value = "";
    elements.projectInput.value = "";
    elements.referenceInput.value = "";
  }

  function rejectMultilineField(value, message, input) {
    if (!hasLineBreak(value)) {
      return false;
    }

    setStatus(message, "error");
    input.focus();
    return true;
  }

  function isEntryWithinRange(entry, range) {
    if (!range.start && !range.end) {
      return true;
    }

    if (!isDateLiteral(entry.date)) {
      return false;
    }

    if (range.start && compareDates(entry.date, range.start) < 0) {
      return false;
    }

    return !(range.end && compareDates(entry.date, range.end) > 0);
  }

  function getFilteredEntries(entries) {
    return entries.filter((entry) => isEntryWithinRange(entry, currentRange));
  }

  function getVisibleWeekText() {
    if (!currentState) {
      return "";
    }

    return getFilteredEntries(currentState.week.entries)
      .map(formatEntryLine)
      .join("\n");
  }

  function updateFilterSummary(state, filteredEntries) {
    const start = currentRange.start || "start of week";
    const end = currentRange.end || "end of week";
    const ref = currentWeekRef || state.week.weekStart;
    elements.filterSummary.textContent = `Week reference ${ref}. Showing ${filteredEntries.length} of ${state.week.entries.length} entries from ${start} to ${end}.`;
  }

  function showView(view) {
    currentView = view;
    elements.viewTitle.textContent = viewTitles[view];

    for (const tab of elements.tabs) {
      tab.classList.toggle("is-active", tab.dataset.view === view);
    }

    for (const panel of elements.views) {
      panel.classList.toggle("is-active", panel.id === `${view}View`);
    }

    scheduleWindowFit();
  }

  function applyTheme(themeName) {
    currentTheme = Object.hasOwn(themeLabels, themeName) ? themeName : "dark";
    documentRef.body.dataset.theme = currentTheme;
    if (elements.themeButton) {
      elements.themeButton.textContent = themeLabels[currentTheme];
      elements.themeButton.dataset.theme = currentTheme;
    }

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("worktrace-theme", currentTheme);
      }
    } catch (_error) {
      // Ignore storage failures in restricted environments.
    }
  }

  function renderEntries(container, entries, emptyText) {
    container.replaceChildren();

    if (!entries.length) {
      const empty = documentRef.createElement("div");
      empty.className = "empty-state";
      empty.textContent = emptyText;
      container.append(empty);
      return;
    }

    for (const entry of entries) {
      const entryLine = formatEntryLine(entry);
      const row = documentRef.createElement("article");
      row.className = "entry";

      const date = documentRef.createElement("div");
      date.className = "entry__date";
      date.textContent = entry.time ? `${entry.date} ${entry.time}` : entry.date;

      const message = documentRef.createElement("div");
      message.className = "entry__message";
      message.textContent = entry.message;

      const actions = documentRef.createElement("div");
      actions.className = "entry__actions";

      const cloneButton = documentRef.createElement("button");
      cloneButton.className = "entry__action";
      cloneButton.type = "button";
      cloneButton.textContent = "Clone";
      cloneButton.addEventListener("click", async () => {
        try {
          await api.cloneEntry(currentWeekRef, entryLine);
          await loadState(currentWeekRef);
          setStatus("Entry cloned.", "ok");
        } catch (error) {
          setStatus(error.message, "error");
        }
      });

      const deleteButton = documentRef.createElement("button");
      deleteButton.className = "entry__action entry__action--danger";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", async () => {
        try {
          await api.deleteEntry(currentWeekRef, entryLine);
          await loadState(currentWeekRef);
          setStatus("Entry deleted.", "ok");
        } catch (error) {
          setStatus(error.message, "error");
        }
      });

      const editButton = documentRef.createElement("button");
      editButton.className = "entry__action";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", async () => {
        setEditingEntry({ ...entry, line: entryLine });
        setStatus("Editing entry.", "ok");
        elements.entryInput.focus();
      });

      actions.append(editButton, cloneButton, deleteButton);
      row.append(date, message, actions);
      container.append(row);
    }
  }

  function renderDiagram(entries) {
    elements.diagramPanel.replaceChildren();

    if (!entries.length) {
      const empty = documentRef.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No activities available for the selected range";
      elements.diagramPanel.append(empty);
      elements.diagramSummary.textContent = "0 activities";
      return;
    }

    const diagramData = buildDiagramData(entries);
    const maxCount = Math.max(...diagramData.byDay.map((item) => item.count), 1);
    const maxSpent = Math.max(...diagramData.byDay.map((item) => item.spentMinutes), 0, 1);
    const totalSpent = diagramData.byDay.reduce((sum, item) => sum + item.spentMinutes, 0);

    elements.diagramSummary.textContent = `${entries.length} activities · ${formatSpentMinutes(totalSpent)}`;

    const daysSection = documentRef.createElement("section");
    daysSection.className = "diagram__section";

    const daysTitle = documentRef.createElement("h4");
    daysTitle.className = "diagram__title";
    daysTitle.textContent = "By day";
    daysSection.append(daysTitle);

    for (const item of diagramData.byDay) {
      const row = documentRef.createElement("div");
      row.className = "diagram-row";

      const label = documentRef.createElement("div");
      label.className = "diagram-row__label";
      label.textContent = item.date;

      const bars = documentRef.createElement("div");
      bars.className = "diagram-row__bars";

      const countBar = documentRef.createElement("div");
      countBar.className = "diagram-bar";
      countBar.dataset.metric = "count";
      countBar.style.width = `${Math.max(14, Math.round((item.count / maxCount) * 100))}%`;
      countBar.textContent = `${item.count} task${item.count === 1 ? "" : "s"}`;
      bars.append(countBar);

      if (item.spentMinutes > 0) {
        const spentBar = documentRef.createElement("div");
        spentBar.className = "diagram-bar";
        spentBar.dataset.metric = "spent";
        spentBar.style.width = `${Math.max(14, Math.round((item.spentMinutes / maxSpent) * 100))}%`;
        spentBar.textContent = formatSpentMinutes(item.spentMinutes);
        bars.append(spentBar);
      }

      row.append(label, bars);
      daysSection.append(row);
    }

    elements.diagramPanel.append(daysSection);

    if (diagramData.byProject.length) {
      const projectSection = documentRef.createElement("section");
      projectSection.className = "diagram__section";

      const projectTitle = documentRef.createElement("h4");
      projectTitle.className = "diagram__title";
      projectTitle.textContent = "By project";
      projectSection.append(projectTitle);

      for (const item of diagramData.byProject.slice(0, 6)) {
        const row = documentRef.createElement("div");
        row.className = "diagram-project";

        const name = documentRef.createElement("div");
        name.className = "diagram-project__name";
        name.textContent = item.name;

        const meta = documentRef.createElement("div");
        meta.className = "diagram-project__meta";
        meta.textContent = item.spentMinutes > 0
          ? `${item.count} task${item.count === 1 ? "" : "s"} · ${formatSpentMinutes(item.spentMinutes)}`
          : `${item.count} task${item.count === 1 ? "" : "s"}`;

        row.append(name, meta);
        projectSection.append(row);
      }

      elements.diagramPanel.append(projectSection);
    }
  }

  function renderState(state) {
    currentState = state;
    currentWeekRef = state.week.weekStart;
    const weekOptions = [state.week.weekStart, ...(state.availableWeeks || [])]
      .filter((value, index, array) => array.indexOf(value) === index);

    const filteredEntries = getFilteredEntries(state.week.entries);
    const rangeLabel = currentRange.start || currentRange.end
      ? `${currentRange.start || state.week.weekStart} to ${currentRange.end || state.week.weekStart}`
      : state.week.weekStart;

    elements.weekLabel.textContent = `Week of ${state.week.weekStart}`;
    elements.weekCount.textContent = String(filteredEntries.length);
    elements.todayCount.textContent = String(state.today.entries.length);
    elements.logDir.textContent = state.config.logDir;
    elements.weekFile.textContent = currentRange.start || currentRange.end
      ? `${state.week.filePath} · ${rangeLabel}`
      : state.week.filePath;
    elements.todayDate.textContent = state.today.date;
    elements.weekEditor.value = state.week.text;
    elements.weekRefInput.replaceChildren(
      ...weekOptions.map((weekStart) => {
        const option = documentRef.createElement("option");
        option.value = weekStart;
        option.textContent = formatWeekOptionLabel(weekStart);
        return option;
      }),
    );
    elements.weekRefInput.value = state.week.weekStart;
    elements.rangeStartInput.value = currentRange.start;
    elements.rangeEndInput.value = currentRange.end;

    renderEntries(elements.weekEntries, filteredEntries, "No entries match the selected date range");
    renderEntries(elements.todayEntries, state.today.entries, "No entries for today");
    renderDiagram(filteredEntries);
    updateFilterSummary(state, filteredEntries);
    scheduleWindowFit();
  }

  async function loadState(ref = currentWeekRef) {
    setBusy(true);

    try {
      currentWeekRef = String(ref || "").trim();
      renderState(await api.getState(currentWeekRef));
      setStatus("");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function refreshState() {
    const ref = elements.weekRefInput.value.trim() || currentWeekRef;
    await loadState(ref);
    setStatus("Refreshed.", "ok");
  }

  async function addEntry(event) {
    event.preventDefault();
    const { date, message, project, reference, time, timeSpent } = readEntryForm();

    if (!message) {
      setStatus("Enter a log message.", "error");
      elements.entryInput.focus();
      return;
    }

    if (rejectMultilineField(timeSpent, "Time spent must be a single line.", elements.timeSpentInput)) {
      return;
    }

    if (rejectMultilineField(project, "Task project must be a single line.", elements.projectInput)) {
      return;
    }

    if (rejectMultilineField(reference, "Ticket or link must be a single line.", elements.referenceInput)) {
      return;
    }

    setBusy(true);

    try {
      if (currentEditing) {
        renderState(await api.editEntry(
          currentWeekRef,
          currentEditing.line,
          date,
          time,
          buildEntryMessage(message, timeSpent, project, reference),
        ));
        setStatus("Entry updated.", "ok");
      } else {
        renderState(await api.addEntry(buildEntryMessage(message, timeSpent, project, reference), time, date));
        setStatus("Entry added.", "ok");
      }
      clearEntryForm();
      setEditingEntry(null);
      showView("week");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveWeek() {
    setBusy(true);

    try {
      renderState(await api.saveWeek(elements.weekEditor.value));
      setStatus("Weekly file saved.", "ok");
      showView("week");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function openLogDir() {
    try {
      await api.openLogDir();
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function applyWeekFilter(event) {
    if (event) {
      event.preventDefault();
    }

    const ref = elements.weekRefInput.value.trim();
    const start = elements.rangeStartInput.value.trim();
    const end = elements.rangeEndInput.value.trim();

    if (start && !isDateLiteral(start)) {
      setStatus("Start date must be a valid YYYY-MM-DD value.", "error");
      elements.rangeStartInput.focus();
      return;
    }

    if (end && !isDateLiteral(end)) {
      setStatus("End date must be a valid YYYY-MM-DD value.", "error");
      elements.rangeEndInput.focus();
      return;
    }

    if (start && end && compareDates(start, end) > 0) {
      setStatus("Start date must be on or before the end date.", "error");
      elements.rangeStartInput.focus();
      return;
    }

    currentRange = { start, end };
    await loadState(ref || currentWeekRef);
  }

  async function clearWeekFilter() {
    currentRange = { start: "", end: "" };
    elements.rangeStartInput.value = "";
    elements.rangeEndInput.value = "";
    await loadState(elements.weekRefInput.value.trim() || currentWeekRef);
  }

  async function exportWeek(format) {
    setBusy(true);

    try {
      const result = await api.exportWeek(format);

      if (result && result.canceled) {
        setStatus("");
        return;
      }

      const label = String(format).toUpperCase();
      const message = result && result.filePath
        ? `Exported ${label} week to ${result.filePath}.`
        : `Exported ${label} week.`;
      setStatus(message, "ok");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyWeek() {
    try {
      await api.copyText(getVisibleWeekText());
      setStatus("Copied week log to clipboard.", "ok");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  function bindEvents() {
    for (const tab of elements.tabs) {
      tab.addEventListener("click", () => showView(tab.dataset.view));
    }

    for (const button of elements.exportButtons) {
      button.addEventListener("click", () => exportWeek(button.dataset.format));
    }

    elements.entryForm.addEventListener("submit", addEntry);
    elements.refreshButton.addEventListener("click", refreshState);
    elements.saveWeekButton.addEventListener("click", saveWeek);
    elements.openLogDirButton.addEventListener("click", openLogDir);
    elements.copyWeekButton.addEventListener("click", copyWeek);
    elements.weekRefInput.addEventListener("change", applyWeekFilter);
    elements.applyWeekFilterButton.addEventListener("click", applyWeekFilter);
    elements.clearWeekFilterButton.addEventListener("click", clearWeekFilter);
    if (elements.themeButton) {
      elements.themeButton.addEventListener("click", () => {
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
        scheduleWindowFit();
      });
    }
    for (const button of elements.windowButtons) {
      button.addEventListener("click", async () => {
        const action = button.dataset.windowAction;
        const handler = {
          close: api.closeWindow,
          maximize: api.maximizeWindow,
          minimize: api.minimizeWindow,
        }[action];

        if (handler) {
          await handler();
        }
      });
    }
  }

  function start() {
    bindEvents();
    try {
      const storedTheme = typeof window !== "undefined" && window.localStorage
        ? window.localStorage.getItem("worktrace-theme")
        : "dark";
      applyTheme(storedTheme || "dark");
    } catch (_error) {
      applyTheme("dark");
    }
    if (elements.entryTimeInput && !elements.entryTimeInput.value) {
      const now = new Date();
      elements.entryTimeInput.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    }
    if (elements.entryDateInput && !elements.entryDateInput.value) {
      const now = new Date();
      elements.entryDateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }
    setEditingEntry(null);
    showView(currentView);
    scheduleWindowFit();
    if (typeof ResizeObserver !== "undefined" && documentRef.body) {
      const resizeObserver = new ResizeObserver(() => {
        scheduleWindowFit();
      });
      resizeObserver.observe(documentRef.body);
      if (documentRef.documentElement) {
        resizeObserver.observe(documentRef.documentElement);
      }
    }
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("resize", scheduleWindowFit);
    }
    return loadState();
  }

  return {
    addEntry,
    elements,
    exportWeek,
    getCurrentState: () => currentState,
    getCurrentView: () => currentView,
    loadState,
    openLogDir,
    applyWeekFilter,
    clearWeekFilter,
    renderEntries,
    renderState,
    saveWeek,
    setBusy,
    setStatus,
    showView,
    applyTheme,
    start,
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    buildDiagramData,
    buildEntryMessage,
    collectElements,
    createWorktraceRenderer,
    formatEntryLine,
    formatSpentMinutes,
    hasLineBreak,
    parseSpentToMinutes,
    parseEntryMessage,
    viewTitles,
  };
}

if (typeof window !== "undefined" && window.document && window.worktrace) {
  createWorktraceRenderer({
    api: window.worktrace,
    document: window.document,
  }).start();
}
