import { addDays } from "@/lib/week";

import { dayOfMonth, isoOf, readDate, weekdayOf, weekdayOfDate } from "./dates";
import type { ImportDocument } from "./document";
import { dayHeading, type GridLayout, type Layout, type TextLayout } from "./layout";

/** Where a day is in the document, to show it next to what the app made of it. */
export type DaySource = { sheet: string; row: number; column: number } | { line: number; lines: number };

/** One day of the chosen program, as the document has it. */
export interface ImportDay {
  /** Stable within the document ("Jan:5", "line 12"). */
  key: string;
  date: string | null;
  /** The workout as written; "" when the day has none. */
  text: string;
  /** A title column's text, when the document has one. */
  title: string | null;
  /** Short words for the day: the program's own focus column, and a column every program shares (a focus or a holiday). */
  labels: { column: "own" | "shared"; text: string }[];
  source: DaySource;
  /** "???", "TBD": a day not planned yet. */
  notPlanned: boolean;
  /** Placing the day: no date, a weekday that does not match the date. */
  problems: string[];
}

const NOT_PLANNED = /^(?:\?+|tbd|tba|tbc|-+|—|x)$/i;
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The days of one program (by its index in the layout's programs), in document order. */
export function extractDays(doc: ImportDocument, layout: Layout, programIndex = 0): ImportDay[] {
  if (doc.kind === "grid" && layout.kind === "grid") return gridDays(doc, layout, programIndex);
  if (doc.kind === "text" && layout.kind === "text") return textDays(doc.text, layout);
  return [];
}

function gridDays(doc: Extract<ImportDocument, { kind: "grid" }>, layout: GridLayout, programIndex: number): ImportDay[] {
  const program = layout.programs[programIndex];
  if (!program) return [];
  const days: ImportDay[] = [];
  const { dates } = layout;
  // A plan over New Year: a month earlier than the sheet before is next year's.
  let yearOffset = 0;
  let lastMonth = 0;
  for (const sheet of doc.sheets.filter((s) => layout.sheets.includes(s.name))) {
    const month = dates.from === "day-of-month" ? dates.months[sheet.name] ?? null : null;
    if (month !== null) {
      if (month < lastMonth) yearOffset++;
      lastMonth = month;
    }
    // The program on this sheet: found by its heading, its columns moved with it; not on this sheet, no days.
    let shift = 0;
    if (program.headingColumn !== null) {
      const heading = (sheet.rows[layout.headerRow] ?? []).findIndex((h) => h.trim().toLowerCase() === program.name.toLowerCase());
      if (heading < 0) continue;
      shift = heading - program.headingColumn;
    }
    const at = (c: number | null) => (c === null ? null : c + shift);
    sheet.rows.forEach((row, r) => {
      if (r <= layout.headerRow) return;
      if (program.where && (row[program.where.column] ?? "").trim() !== program.where.value) return;
      const cell = (c: number | null) => (c === null ? "" : (row[c] ?? "").trim());
      const text = program.workoutColumns.map((c) => cell(at(c))).filter(Boolean).join("\n").trim();
      const ownFocus = cell(at(program.focusColumn));
      const labels = [
        ...(ownFocus && !NOT_PLANNED.test(ownFocus) ? [{ column: "own" as const, text: ownFocus.replace(/\s+/g, " ") }] : []),
        ...(layout.sharedFocusColumn !== null && cell(layout.sharedFocusColumn) ? [{ column: "shared" as const, text: cell(layout.sharedFocusColumn).replace(/\s+/g, " ") }] : []),
      ];
      const dateCell = cell(dates.column);
      if (!text && labels.length === 0) return;
      // Rows without a date or a day are notes around the grid, unless they hold a workout.
      const problems: string[] = [];
      let date: string | null = null;
      if (dates.from === "day-of-month") {
        const day = dayOfMonth(dateCell);
        if (day === null && !text) return;
        if (day !== null && month === null) problems.push(`Which month is the sheet “${sheet.name}”?`);
        else if (day !== null) date = isoOf(dates.year + yearOffset, month!, day);
        if (day !== null && month !== null && date === null) problems.push(`${sheet.name} has no day ${day}`);
      } else {
        date = readDate(dateCell, { year: dates.year, dayFirst: dates.dayFirst });
        if (date === null && !text) return;
      }
      if (date === null && problems.length === 0) problems.push(dateCell ? `Did not read the date “${dateCell}”` : "No date on this row");
      if (date && layout.weekdayColumn !== null) {
        const said = weekdayOf(cell(layout.weekdayColumn), { short: true });
        if (said !== null && said !== weekdayOfDate(date)) {
          problems.push(`Says ${WEEKDAY_NAMES[said]}, but ${date} is a ${WEEKDAY_NAMES[weekdayOfDate(date)]}`);
        }
      }
      const notPlanned = NOT_PLANNED.test(text);
      days.push({
        key: `${sheet.name}:${r + 1}`,
        date,
        text: notPlanned ? "" : text,
        title: cell(at(program.titleColumn)) || null,
        labels,
        source: { sheet: sheet.name, row: r, column: at(program.workoutColumns[0]!)! },
        notPlanned,
        problems,
      });
    });
  }
  return days;
}

function textDays(text: string, layout: TextLayout): ImportDay[] {
  const lines = text.split("\n");
  const { days: by } = layout;
  const year = by.by === "date" ? by.year : Number((by.firstMonday ?? "").slice(0, 4));
  const starts = lines.flatMap((line, i) => {
    const h = dayHeading(line, year);
    return h ? [{ i, h }] : [];
  });
  const out: ImportDay[] = [];
  let week = 0;
  let lastWeekday = -1;
  starts.forEach(({ i, h }, n) => {
    const end = starts[n + 1]?.i ?? lines.length;
    const body = lines.slice(i + 1, end).join("\n").trim();
    const problems: string[] = [];
    let date: string | null = null;
    if (by.by === "date") {
      if ("date" in h) date = by.dayFirst ? h.date : readDate(lines[i]!, { year: by.year, dayFirst: false }) ?? h.date;
      else problems.push(`“${lines[i]!.trim()}” has no date`);
    } else if (by.by === "weekday") {
      const weekday = "weekday" in h ? h.weekday : "date" in h ? weekdayOfDate(h.date) : null;
      if (weekday === null) problems.push(`“${lines[i]!.trim()}” is not a weekday`);
      else {
        if (weekday <= lastWeekday) week++;
        lastWeekday = weekday;
        date = addDays(by.firstMonday, week * 7 + weekday);
      }
    } else if ("day" in h) {
      const perWeek = by.weekdays.length;
      const index = h.week !== null ? (h.week - 1) * perWeek + (h.day - 1) : h.day - 1;
      const w = Math.floor(index / perWeek);
      const k = index % perWeek;
      if (h.week !== null && h.day > perWeek) problems.push(`Day ${h.day} of a ${perWeek}-day week`);
      else date = addDays(by.firstMonday, w * 7 + by.weekdays[k]!);
    } else problems.push(`“${lines[i]!.trim()}” is not a day number`);
    const notPlanned = NOT_PLANNED.test(body);
    if (!body) return;
    out.push({
      key: `line ${i + 1}`,
      date,
      text: notPlanned ? "" : body,
      title: null,
      labels: [],
      source: { line: i, lines: end - i },
      notPlanned,
      problems,
    });
  });
  return out;
}
