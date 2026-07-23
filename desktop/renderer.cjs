const viewTitles = {
  week: "This week",
  today: "Today",
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

function collectElements(documentRef) {
  return {
    entryForm: documentRef.querySelector("#entryForm"),
    entryInput: documentRef.querySelector("#entryInput"),
    entryDateInput: documentRef.querySelector("#entryDateInput"),
    entryTimeInput: documentRef.querySelector("#entryTimeInput"),
    exportButtons: Array.from(documentRef.querySelectorAll(".export-button")),
    themeButton: documentRef.querySelector("#themeButton"),
    windowButtons: Array.from(documentRef.querySelectorAll(".window-controls__button")),
    logDir: documentRef.querySelector("#logDir"),
    openLogDirButton: documentRef.querySelector("#openLogDirButton"),
    applyWeekFilterButton: documentRef.querySelector("#applyWeekFilterButton"),
    clearWeekFilterButton: documentRef.querySelector("#clearWeekFilterButton"),
    filterSummary: documentRef.querySelector("#filterSummary"),
    copyWeekButton: documentRef.querySelector("#copyWeekButton"),
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

function buildEntryMessage(message, reference) {
  const cleanMessage = String(message || "").trim();
  const cleanReference = String(reference || "").trim();

  if (!cleanReference) {
    return cleanMessage;
  }

  return `${cleanMessage} [ref: ${cleanReference}]`;
}

function createTartRenderer({ document: documentRef, api, initialView = "week" }) {
  const elements = collectElements(documentRef);
  let currentState = null;
  let currentView = initialView;
  let currentWeekRef = "";
  let currentRange = { end: "", start: "" };
  let currentTheme = "dark";
  let currentEditing = null;

  function setStatus(message, tone = "") {
    elements.status.textContent = message || "";
    elements.status.dataset.tone = tone;
  }

  function setBusy(isBusy) {
    elements.entryInput.disabled = isBusy;
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
      return;
    }

    elements.entryForm.dataset.mode = "edit";
    elements.entryDateInput.value = currentEditing.date;
    elements.entryTimeInput.value = currentEditing.time || "";
    elements.entryInput.value = currentEditing.message;
    elements.referenceInput.value = "";
    elements.entrySubmitButton.textContent = "Save";
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

    if (range.end && compareDates(entry.date, range.end) > 0) {
      return false;
    }

    return true;
  }

  function getFilteredEntries(entries) {
    return entries.filter((entry) => isEntryWithinRange(entry, currentRange));
  }

  function getVisibleWeekText() {
    if (!currentState) {
      return "";
    }

    return getFilteredEntries(currentState.week.entries)
      .map((entry) => entry.line || `${entry.date}${entry.time ? ` ${entry.time}` : ""} ${entry.message}`.trim())
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
        window.localStorage.setItem("tart-theme", currentTheme);
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
      const entryLine = entry.line || `${entry.date}${entry.time ? ` ${entry.time}` : ""} ${entry.message}`.trim();
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
    updateFilterSummary(state, filteredEntries);
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
    const message = elements.entryInput.value.trim();
    const date = elements.entryDateInput.value.trim();
    const time = elements.entryTimeInput.value.trim();
    const reference = elements.referenceInput.value.trim();

    if (!message) {
      setStatus("Enter a log message.", "error");
      elements.entryInput.focus();
      return;
    }

    if (reference.includes("\n") || reference.includes("\r")) {
      setStatus("Ticket or link must be a single line.", "error");
      elements.referenceInput.focus();
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
          buildEntryMessage(message, reference),
        ));
        setStatus("Entry updated.", "ok");
      } else {
        renderState(await api.addEntry(buildEntryMessage(message, reference), time, date));
        setStatus("Entry added.", "ok");
      }
      elements.entryInput.value = "";
      elements.entryDateInput.value = "";
      elements.entryTimeInput.value = "";
      elements.referenceInput.value = "";
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
      });
    }
    for (const button of elements.windowButtons) {
      button.addEventListener("click", async () => {
        const action = button.dataset.windowAction;
        if (action === "minimize") {
          await window.tart.minimizeWindow();
        } else if (action === "maximize") {
          await window.tart.maximizeWindow();
        } else if (action === "close") {
          await window.tart.closeWindow();
        }
      });
    }
  }

  function start() {
    bindEvents();
    try {
      const storedTheme = typeof window !== "undefined" && window.localStorage
        ? window.localStorage.getItem("tart-theme")
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
    buildEntryMessage,
    collectElements,
    createTartRenderer,
    viewTitles,
  };
}

if (typeof window !== "undefined" && window.document && window.tart) {
  createTartRenderer({
    api: window.tart,
    document: window.document,
  }).start();
}
