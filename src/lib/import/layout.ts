import { dayOfMonth, monthOf, readDate, weekdayOf } from "./dates";
import type { ImportDocument } from "./document";

/**
 * How a programming document is laid out (BACKLOG "Program import", the
 * structure step): the app proposes it, the coach corrects it once, and a gym
 * can keep it for its next import. Written for the common shapes, not one
 * gym's file:
 *
 * - a calendar grid: one row per day, a day-of-month or date column, programs
 *   side by side under headings (a sheet per month, as Afrek; or one sheet);
 * - rows: one row per workout with a date column, perhaps a title, a focus
 *   and a program column (a CSV export, a Google Sheet);
 * - text: a day starts at a line with a date ("Monday 5 January",
 *   "5.1.2026"), a weekday ("Monday", in weeks), or "Week 1 Day 1" / "Day 3",
 *   counted from a start date.
 */

export interface GridProgram {
  /** The heading over the program's columns, or a value of the program column. */
  name: string;
  /**
   * Where the heading is on the sheet the columns were read from. On another
   * sheet the program is found by its heading and the columns move with it
   * (a program added or dropped mid-year shifts the others); null without
   * headings.
   */
  headingColumn: number | null;
  /** The column(s) with the workout; several are joined. */
  workoutColumns: number[];
  /** A column with each workout's title, if any. */
  titleColumn: number | null;
  /** The program's own day focus column, if any (short words, no numbers). */
  focusColumn: number | null;
  /** Rows where this column has this value (a program column in a list of rows). */
  where: { column: number; value: string } | null;
}

export type GridDates =
  /** A day of the month in a column; the month from each sheet's name, the year given. */
  | { from: "day-of-month"; column: number; year: number; months: Record<string, number | null> }
  /** A whole date in a column (an Excel date, 2026-01-05, 5.1.2026). */
  | { from: "date"; column: number; year: number; dayFirst: boolean };

export interface GridLayout {
  kind: "grid";
  /** The sheets read, by name. */
  sheets: string[];
  /** The row with the programs' headings (0-based), or -1. */
  headerRow: number;
  dates: GridDates;
  weekdayColumn: number | null;
  /** A day focus or holiday column shared by the programs (Afrek's column A). */
  sharedFocusColumn: number | null;
  programs: GridProgram[];
}

export type TextDays =
  | { by: "date"; year: number; dayFirst: boolean }
  /** "Monday", "Tuesday" … in order; a weekday earlier than the one before starts a new week. */
  | { by: "weekday"; firstMonday: string }
  /** "Week 2 Day 3", or "Day 12"; `weekdays` are the days of a week the day numbers stand for (0 = Monday). */
  | { by: "week-day"; firstMonday: string; weekdays: number[] };

export interface TextLayout {
  kind: "text";
  days: TextDays;
}

export type Layout = GridLayout | TextLayout;

const FIELD_WORDS = {
  date: /^(date|dato|datum|dagsetning|dags\.?|day|dagur|dag|tag)$/i,
  workout: /^(workout|wod|description|programming|text|session|training|æfing|æfingin|træning|trening|übung)$/i,
  title: /^(title|name|heiti|nafn|titel|navn)$/i,
  focus: /^(focus|day focus|áhersla|fokus|theme)$/i,
  program: /^(program|track|class|group|hópur|tími|flokkur)$/i,
};

const isText = (s: string) => /[a-zà-ÿþðæö]{2}/i.test(s);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** A year in a name ("afrek-2024.xlsx", "Jan 2025"). */
export function yearIn(text: string): number | null {
  const m = text.match(/(?:^|\D)(20\d\d|19\d\d)(?:\D|$)/);
  return m ? Number(m[1]) : null;
}

interface ColumnStats {
  filled: number;
  days: number;
  dates: number;
  weekdays: number;
  /** Short words without numbers (a focus or a holiday). */
  labels: number;
  averageLength: number;
  multiline: number;
}

function stats(rows: string[][], column: number, from: number): ColumnStats {
  const cells = rows.slice(from).map((r) => (r[column] ?? "").trim()).filter(Boolean);
  const total = cells.reduce((a, c) => a + c.length, 0);
  return {
    filled: cells.length,
    days: cells.filter((c) => dayOfMonth(c) !== null).length,
    dates: cells.filter((c) => readDate(c, { year: 2000 }) !== null && dayOfMonth(c) === null).length,
    weekdays: cells.filter((c) => weekdayOf(c, { short: true }) !== null).length,
    labels: cells.filter((c) => isText(c) && !/\d/.test(c) && words(c) <= 4 && c.length <= 40).length,
    averageLength: cells.length ? total / cells.length : 0,
    multiline: cells.filter((c) => c.includes("\n")).length,
  };
}

/** Proposes how a document is laid out; null when nothing in it looks like days. */
export function proposeLayout(doc: ImportDocument, today: string): Layout | null {
  return doc.kind === "grid" ? proposeGrid(doc, today) : proposeText(doc.text, doc.name, today);
}

function proposeGrid(doc: Extract<ImportDocument, { kind: "grid" }>, today: string): GridLayout | null {
  const year = yearIn(doc.name) ?? doc.sheets.map((s) => yearIn(s.name)).find((y) => y !== null) ?? Number(today.slice(0, 4));
  // The sheet that shows the layout best: the one with the most dated rows.
  let best: { sheet: (typeof doc.sheets)[number]; column: number; kind: "day-of-month" | "date"; count: number } | null = null;
  for (const sheet of doc.sheets) {
    const width = sheet.rows[0]?.length ?? 0;
    for (let c = 0; c < Math.min(width, 12); c++) {
      const s = stats(sheet.rows, c, 0);
      const kind = s.dates > s.days ? "date" : "day-of-month";
      const count = Math.max(s.dates, s.days);
      // A whole date says it is one; a day of the month alone needs a few in a row to tell it from other numbers.
      if (count >= (kind === "date" ? 1 : 3) && count >= s.filled * 0.6 && (!best || count > best.count)) best = { sheet, column: c, kind, count };
    }
  }
  if (!best) return null;
  const { sheet, column: dateColumn } = best;
  const rows = sheet.rows;
  const isDated = (r: string[]) => (best!.kind === "date" ? readDate(r[dateColumn] ?? "", { year }) !== null : dayOfMonth(r[dateColumn] ?? "") !== null);
  const firstDated = rows.findIndex(isDated);
  // The heading row: the last row with text above the first day.
  let headerRow = -1;
  for (let r = firstDated - 1; r >= 0; r--) {
    if (rows[r]!.some((c) => isText(c))) {
      headerRow = r;
      break;
    }
  }
  const from = Math.max(firstDated, 0);
  const width = rows[0]?.length ?? 0;
  const columns = Array.from({ length: width }, (_, c) => ({ c, s: stats(rows, c, from) }));
  const weekdayColumn = columns.find(({ c, s }) => c !== dateColumn && s.weekdays >= 3 && s.weekdays >= s.filled * 0.8)?.c ?? null;
  const header = headerRow >= 0 ? rows[headerRow]! : [];

  // A list of rows: its heading names fields (Date, Workout, Title …), not programs.
  const fieldOf = (c: number) => (Object.entries(FIELD_WORDS).find(([, re]) => re.test((header[c] ?? "").trim()))?.[0] ?? null) as keyof typeof FIELD_WORDS | null;
  const fieldColumns = header.map((_, c) => fieldOf(c));
  const workoutField = fieldColumns.indexOf("workout");
  let programs: GridProgram[];
  let sharedFocusColumn: number | null = null;
  if (workoutField >= 0) {
    const titleColumn = fieldColumns.indexOf("title");
    const focusColumn = fieldColumns.indexOf("focus");
    const programColumn = fieldColumns.indexOf("program");
    const base = { workoutColumns: [workoutField], titleColumn: titleColumn >= 0 ? titleColumn : null, focusColumn: focusColumn >= 0 ? focusColumn : null };
    const values = programColumn >= 0 ? [...new Set(rows.slice(from).map((r) => (r[programColumn] ?? "").trim()).filter(Boolean))] : [];
    programs = values.length > 0
      ? values.map((value) => ({ name: value, headingColumn: null, ...base, where: { column: programColumn, value } }))
      : [{ name: doc.sheets.length === 1 ? sheet.name : "Workouts", headingColumn: null, ...base, where: null }];
  } else {
    // A calendar grid: each heading over the columns to its right, up to the next heading — on every
    // sheet, as a program can start mid-year (Afrek's LIÐLEIKI from March).
    const used = new Set([dateColumn, weekdayColumn]);
    programs = [];
    for (const each of doc.sheets) {
      const head = headerRow >= 0 ? each.rows[headerRow] ?? [] : [];
      const sheetWidth = each.rows[0]?.length ?? 0;
      const sheetColumns = Array.from({ length: sheetWidth }, (_, c) => ({ c, s: stats(each.rows, c, from) }));
      const starts = head.map((h, c) => (isText(h) && !used.has(c) && c > dateColumn ? c : -1)).filter((c) => c >= 0);
      const spans = starts.length
        ? starts.map((c, i) => ({ name: head[c]!.trim(), heading: c as number | null, columns: Array.from({ length: (starts[i + 1] ?? sheetWidth) - c }, (_, k) => c + k) }))
        : // No headings: each column of long text is a program, named by its letter.
          sheetColumns
            .filter(({ c, s }) => !used.has(c) && s.filled >= 3 && s.averageLength >= 40)
            .map(({ c }) => ({ name: `Column ${columnLetter(c)}`, heading: null, columns: [c] }));
      for (const span of spans) {
        if (programs.some((p) => p.name.toLowerCase() === span.name.toLowerCase())) continue;
        const inSpan = sheetColumns.filter(({ c }) => span.columns.includes(c));
        const workout = [...inSpan].sort((a, b) => b.s.averageLength * b.s.filled - a.s.averageLength * a.s.filled)[0];
        if (!workout || workout.s.filled === 0) continue;
        const focus = inSpan.find(({ c, s }) => c !== workout.c && s.filled >= 2 && s.labels >= s.filled * 0.6);
        // Columns as on this sheet; on another sheet they move with the heading.
        programs.push({
          name: span.name,
          headingColumn: span.heading,
          workoutColumns: [workout.c],
          titleColumn: null,
          focusColumn: focus ? focus.c : null,
          where: null,
        });
      }
      if (starts.length === 0) break;
    }
    // Short words left of the programs, outside them: a focus or holiday column for every program.
    const firstProgram = Math.min(...programs.flatMap((p) => p.workoutColumns), width);
    sharedFocusColumn =
      columns.find(({ c, s }) => c < firstProgram && !used.has(c) && s.filled >= 3 && s.labels >= s.filled * 0.6 && s.averageLength < 40)?.c ?? null;
  }
  if (programs.length === 0) return null;

  const sheets = doc.sheets.filter((s) => s.rows.some(isDatedIn(best.kind, dateColumn, year))).map((s) => s.name);
  const dates: GridDates =
    best.kind === "date"
      ? { from: "date", column: dateColumn, year, dayFirst: dayFirstIn(doc.sheets.flatMap((s) => s.rows.map((r) => r[dateColumn] ?? ""))) }
      : { from: "day-of-month", column: dateColumn, year, months: Object.fromEntries(doc.sheets.map((s) => [s.name, monthOfSheet(s.name)])) };
  return { kind: "grid", sheets, headerRow, dates, weekdayColumn, sharedFocusColumn, programs };
}

const isDatedIn = (kind: "date" | "day-of-month", column: number, year: number) => (r: string[]) =>
  kind === "date" ? readDate(r[column] ?? "", { year }) !== null : dayOfMonth(r[column] ?? "") !== null;

/** "Jan", "Mars 2024", "04 - April": the month a sheet is for, or null. */
export function monthOfSheet(name: string): number | null {
  for (const w of name.split(/[\s\-_.,/]+/)) {
    const m = monthOf(w);
    if (m) return m;
  }
  const n = name.trim().match(/^(\d{1,2})(?:\D|$)/);
  return n && Number(n[1]) >= 1 && Number(n[1]) <= 12 ? Number(n[1]) : null;
}

/** Whether numeric dates in a column put the day first: any first number above 12 says so, any second one says not. */
function dayFirstIn(cells: string[]): boolean {
  let dayFirst = 0;
  let monthFirst = 0;
  for (const c of cells) {
    const m = c.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-]\d{2,4}$/);
    if (!m) continue;
    if (Number(m[1]) > 12) dayFirst++;
    if (Number(m[2]) > 12) monthFirst++;
  }
  return monthFirst > dayFirst ? false : true;
}

export function columnLetter(c: number): string {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// ---------------------------------------------------------------------------
// Text documents
// ---------------------------------------------------------------------------

const WEEK_DAY = /^(?:(?:week|wk|vika|uge|woche)\s*(\d+)\W*)?(?:day|dagur|dag|tag)\s*(\d+)\b/i;

/** What kind of day heading a line is, if any. */
export function dayHeading(line: string, year: number): { date: string } | { weekday: number } | { week: number | null; day: number } | null {
  const t = line.trim().replace(/[:\-–—*#]+$/, "").trim();
  if (!t || t.length > 48) return null;
  const wd = t.match(WEEK_DAY);
  if (wd) return { week: wd[1] ? Number(wd[1]) : null, day: Number(wd[2]) };
  const first = t.split(/[\s,.:]+/)[0] ?? "";
  const date = readDate(t, { year });
  // A date heading has few words besides the date ("Monday 5 January", "5.1.2026 – Legs").
  if (date && words(t) <= 6) return { date };
  const weekday = weekdayOf(first);
  if (weekday !== null && words(t) <= 3) return { weekday };
  return null;
}

function proposeText(text: string, name: string, today: string): TextLayout | null {
  const year = yearIn(name) ?? yearIn(text) ?? Number(today.slice(0, 4));
  const found = text.split("\n").map((l) => dayHeading(l, year)).filter((h) => h !== null);
  if (found.length === 0) return null;
  const dates = found.filter((h) => "date" in h).length;
  const weekdays = found.filter((h) => "weekday" in h).length;
  const weekDays = found.filter((h) => "day" in h).length;
  const monday = nextMonday(today);
  if (dates >= weekdays && dates >= weekDays) {
    return { kind: "text", days: { by: "date", year, dayFirst: dayFirstIn(text.split(/\s+/)) } };
  }
  if (weekdays >= weekDays) return { kind: "text", days: { by: "weekday", firstMonday: monday } };
  return { kind: "text", days: { by: "week-day", firstMonday: monday, weekdays: [0, 1, 2, 3, 4, 5, 6] } };
}

/** The Monday on or after a day. */
export function nextMonday(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const shift = (8 - d.getUTCDay()) % 7;
  return new Date(d.getTime() + shift * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// A gym's layout, kept for its next import
// ---------------------------------------------------------------------------

/**
 * The coach's corrections from an earlier import, on a new document laid
 * out the same way (BACKLOG "Program import": "the mapping can be saved per
 * gym"). What the new document says for itself stays: its year, its sheets,
 * where its headings are. Taken over: the columns of each program (by name,
 * moved with its heading), the label column, each sheet's month (by the
 * sheet's name), the order of day and month, the weekdays "Day 1, Day 2" are.
 * Null when the earlier layout is not for a document like this one.
 */
export function reuseLayout(proposed: Layout, earlier: Layout): Layout | null {
  if (proposed.kind === "text" && earlier.kind === "text") {
    if (proposed.days.by !== earlier.days.by) return null;
    if (proposed.days.by === "week-day" && earlier.days.by === "week-day") return { kind: "text", days: { ...proposed.days, weekdays: earlier.days.weekdays } };
    if (proposed.days.by === "date" && earlier.days.by === "date") return { kind: "text", days: { ...proposed.days, dayFirst: earlier.days.dayFirst } };
    return proposed;
  }
  if (proposed.kind !== "grid" || earlier.kind !== "grid") return null;
  const named = (name: string) => earlier.programs.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (!proposed.programs.some((p) => named(p.name))) return null;
  const programs = proposed.programs.map((p) => {
    const before = named(p.name);
    if (!before) return p;
    // Columns move with the heading: an earlier column two to the right of its heading is two to the right here.
    const move = (c: number | null) => (c === null ? null : p.headingColumn !== null && before.headingColumn !== null ? c - before.headingColumn + p.headingColumn : c);
    return { ...p, workoutColumns: before.workoutColumns.map((c) => move(c)!), focusColumn: move(before.focusColumn), titleColumn: move(before.titleColumn) };
  });
  const dates: GridDates =
    proposed.dates.from === "day-of-month" && earlier.dates.from === "day-of-month"
      ? {
          ...proposed.dates,
          months: Object.fromEntries(Object.entries(proposed.dates.months).map(([sheet, m]) => [sheet, (earlier.dates as { months: Record<string, number | null> }).months[sheet] ?? m])),
        }
      : proposed.dates.from === "date" && earlier.dates.from === "date"
        ? { ...proposed.dates, dayFirst: earlier.dates.dayFirst }
        : proposed.dates;
  return { ...proposed, programs, dates, sharedFocusColumn: earlier.sharedFocusColumn };
}
