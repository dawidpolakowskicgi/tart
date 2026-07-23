const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const DATE_PATTERN = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const ISO_WEEK_PATTERN = /^([0-9]{4})-W([0-9]{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

class TartCoreError extends Error {
  constructor(message) {
    super(message);
    this.name = "TartCoreError";
  }
}

function defaultLogDir(homeDir = os.homedir()) {
  return path.join(homeDir, "Documents", "tart");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatUtcDate(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function formatLocalDate(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatLocalDateTime(date = new Date()) {
  return `${formatLocalDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseDateLiteral(value) {
  const match = DATE_PATTERN.exec(value || "");
  if (!match) {
    throw new TartCoreError(`invalid date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TartCoreError(`invalid date: ${value}`);
  }

  return date;
}

function weekStartForDate(value) {
  const date = parseDateLiteral(value);
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const weekStart = new Date(date.getTime() - (isoDay - 1) * DAY_MS);
  return formatUtcDate(weekStart);
}

function isoWeekForDate(value) {
  const date = parseDateLiteral(value);
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const thursday = new Date(date.getTime() + (4 - isoDay) * DAY_MS);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4IsoDay = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const firstMonday = new Date(jan4.getTime() - (jan4IsoDay - 1) * DAY_MS);
  const currentMonday = new Date(parseDateLiteral(weekStartForDate(value)).getTime());
  const weekNumber = Math.floor((currentMonday.getTime() - firstMonday.getTime()) / (7 * DAY_MS)) + 1;
  return `${isoYear}-W${pad2(weekNumber)}`;
}

function weekStartForIsoWeek(value) {
  const match = ISO_WEEK_PATTERN.exec(value || "");
  if (!match) {
    throw new TartCoreError(`invalid ISO week: ${value}`);
  }

  const isoYear = Number(match[1]);
  const isoWeek = Number(match[2]);

  if (isoWeek < 1 || isoWeek > 53) {
    throw new TartCoreError(`invalid ISO week: ${value}`);
  }

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4IsoDay = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const firstMonday = new Date(jan4.getTime() - (jan4IsoDay - 1) * DAY_MS);
  const weekStart = new Date(firstMonday.getTime() + (isoWeek - 1) * 7 * DAY_MS);
  const weekStartText = formatUtcDate(weekStart);

  if (isoWeekForDate(weekStartText) !== value) {
    throw new TartCoreError(`invalid ISO week: ${value}`);
  }

  return weekStartText;
}

function weekStartFromRef(ref, today = formatLocalDate()) {
  const value = ref || today;

  if (DATE_PATTERN.test(value)) {
    return weekStartForDate(value);
  }

  if (ISO_WEEK_PATTERN.test(value)) {
    return weekStartForIsoWeek(value);
  }

  throw new TartCoreError(`invalid week reference: ${value}`);
}

function normalizeLogText(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/, "");
  return normalized ? `${normalized}\n` : "";
}

function parseEntryLine(line, index) {
  const date = line.slice(0, 10);
  const hasTimestamp = line.slice(10, 11) === " " && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} /.test(line);
  const hasDateOnlySeparator = line.slice(10, 11) === " ";
  const time = hasTimestamp ? line.slice(11, 16) : "";
  const message = hasTimestamp ? line.slice(17) : hasDateOnlySeparator ? line.slice(11) : line;

  return {
    id: `${index}-${line}`,
    date,
    time,
    message,
    line,
    valid: DATE_PATTERN.test(date) && (hasTimestamp || hasDateOnlySeparator),
  };
}

function parseEntries(text) {
  return normalizeLogText(text)
    .split("\n")
    .filter(Boolean)
    .map(parseEntryLine);
}

function formatWeekAsPlainText(week) {
  return normalizeLogText(week && week.text ? week.text : "");
}

function sortWeekStartsDescending(left, right) {
  return String(right).localeCompare(String(left));
}

function escapeCsvCell(value) {
  const text = String(value ?? "");

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function formatEntriesAsCsv(entries) {
  const rows = [["date", "message"]];

  for (const entry of entries || []) {
    rows.push([entry && entry.date ? entry.date : "", entry && entry.message ? entry.message : ""]);
  }

  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

class TartStore {
  constructor(options = {}) {
    this.env = options.env || process.env;
    this.logDir = options.logDir || this.env.TART_LOGDIR || defaultLogDir(options.homeDir);
    this.todayOverride = options.today || this.env.TART_TODAY || "";
    this.now = typeof options.now === "function" ? options.now : () => new Date();
  }

  todayDate() {
    if (!this.todayOverride) {
      return formatLocalDate();
    }

    parseDateLiteral(this.todayOverride);
    return this.todayOverride;
  }

  weekStart(ref = "") {
    return weekStartFromRef(ref, this.todayDate());
  }

  weekPath(ref = "") {
    return path.join(this.logDir, `${this.weekStart(ref)}.log`);
  }

  async ensureLogDir() {
    await fs.mkdir(this.logDir, { recursive: true });
  }

  async readTextIfExists(filePath) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return "";
      }
      throw error;
    }
  }

  async listAvailableWeeks() {
    try {
      const entries = await fs.readdir(this.logDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && /^([0-9]{4}-[0-9]{2}-[0-9]{2})\.log$/.test(entry.name))
        .map((entry) => entry.name.slice(0, -4))
        .sort(sortWeekStartsDescending);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async addEntry(message, time = "", date = "") {
    const cleanMessage = String(message || "").trim();
    const cleanTime = String(time || "").trim();
    const cleanDate = String(date || "").trim();

    if (!cleanMessage) {
      throw new TartCoreError("missing entry message");
    }

    if (cleanMessage.includes("\n") || cleanMessage.includes("\r")) {
      throw new TartCoreError("entry message must be a single line");
    }

    const today = this.todayDate();
    const entryDate = cleanDate || today;
    if (cleanDate && !DATE_PATTERN.test(cleanDate)) {
      throw new TartCoreError(`invalid date: ${cleanDate}`);
    }
    const filePath = this.weekPath(entryDate);
    const timestamp = cleanTime ? `${entryDate} ${cleanTime}` : formatLocalDateTime(this.now()).replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2})/, entryDate);
    const line = `${timestamp} ${cleanMessage}`;

    await this.ensureLogDir();
    await fs.appendFile(filePath, `${line}\n`, "utf8");

    return {
      date: entryDate,
      time: timestamp.slice(11, 16),
      message: cleanMessage,
      line,
      filePath,
    };
  }

  async readWeek(ref = "") {
    const weekStart = this.weekStart(ref);
    const filePath = this.weekPath(weekStart);
    const text = await this.readTextIfExists(filePath);

    return {
      weekStart,
      filePath,
      text: normalizeLogText(text),
      entries: parseEntries(text),
    };
  }

  async readToday() {
    const today = this.todayDate();
    const week = await this.readWeek(today);

    return {
      date: today,
      entries: week.entries.filter((entry) => entry.date === today),
    };
  }

  async saveWeek(ref, text) {
    const weekStart = this.weekStart(ref || "");
    const filePath = this.weekPath(weekStart);

    await this.ensureLogDir();
    await fs.writeFile(filePath, normalizeLogText(text), "utf8");

    return this.readWeek(weekStart);
  }

  async deleteEntry(ref, line) {
    const weekStart = this.weekStart(ref || "");
    const filePath = this.weekPath(weekStart);
    const week = await this.readWeek(weekStart);
    const targetLine = String(line || "");

    await this.ensureLogDir();
    const nextText = week.entries
      .filter((entry) => entry.line !== targetLine)
      .map((entry) => entry.line)
      .join("\n");

    await fs.writeFile(filePath, normalizeLogText(nextText), "utf8");
    return this.readWeek(weekStart);
  }

  async cloneEntry(ref, line) {
    const weekStart = this.weekStart(ref || "");
    const filePath = this.weekPath(weekStart);
    const cleanLine = String(line || "").trim();

    if (!cleanLine) {
      throw new TartCoreError("missing entry line");
    }

    await this.ensureLogDir();
    await fs.appendFile(filePath, `${cleanLine}\n`, "utf8");
    return this.readWeek(weekStart);
  }

  async editEntry(ref, line, date, time, message) {
    const weekStart = this.weekStart(ref || "");
    const filePath = this.weekPath(weekStart);
    const cleanLine = String(line || "").trim();
    const cleanDate = String(date || "").trim();
    const cleanTime = String(time || "").trim();
    const cleanMessage = String(message || "").trim();

    if (!cleanLine) {
      throw new TartCoreError("missing entry line");
    }

    if (!cleanMessage) {
      throw new TartCoreError("missing entry message");
    }

    if (cleanDate && !DATE_PATTERN.test(cleanDate)) {
      throw new TartCoreError(`invalid date: ${cleanDate}`);
    }

    const week = await this.readWeek(weekStart);
    const nextText = week.entries
      .map((entry) => {
        if (entry.line !== cleanLine) {
          return entry.line;
        }

        const nextDate = cleanDate || entry.date;
        const nextTime = cleanTime || entry.time;
        return `${nextDate}${nextTime ? ` ${nextTime}` : ""} ${cleanMessage}`;
      })
      .join("\n");

    await this.ensureLogDir();
    await fs.writeFile(filePath, normalizeLogText(nextText), "utf8");
    return this.readWeek(weekStart);
  }

  async getState(ref = "") {
    const week = await this.readWeek(ref);
    const today = await this.readToday();
    const availableWeeks = await this.listAvailableWeeks();

    return {
      config: {
        logDir: this.logDir,
        currentFile: this.weekPath(this.todayDate()),
      },
      availableWeeks,
      today,
      week,
    };
  }
}

module.exports = {
  TartCoreError,
  TartStore,
  defaultLogDir,
  escapeCsvCell,
  formatEntriesAsCsv,
  formatLocalDate,
  formatLocalDateTime,
  formatUtcDate,
  formatWeekAsPlainText,
  normalizeLogText,
  parseDateLiteral,
  parseEntries,
  sortWeekStartsDescending,
  weekStartForDate,
  weekStartForIsoWeek,
  weekStartFromRef,
};
