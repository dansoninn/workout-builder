import { HOLIDAY_COUNTRIES } from "@/lib/calendar/holidays";
import type { BlockIntent } from "@/lib/engine/types";
import { benchmarkOf } from "@/lib/library/benchmarks";
import type { DraftBlock } from "@/lib/workout/draft";
import type { Library, LibraryExercise } from "@/lib/workout/library";
import { type Answers, parseWorkoutText, type ParseResult } from "@/lib/workout/parse";

import type { ImportDay } from "./days";

/**
 * Reads every day of an import with the paste parser (the rules never
 * differ) and gathers what needs the coach into one queue, sorted by how
 * many lines each answer fixes (BACKLOG "Program import"). Answers are given
 * once and apply to the whole import: a word's exercise, what a day's label
 * means (a focus, a closed day), the intent of a block heading, a day fixed
 * by hand, a day left out.
 */

export interface LabelMeaning {
  /** The day focus the label sets, by name; null for none. */
  focus: string | null;
  /** The gym is closed that day, with this name; null when it is not. */
  closed: string | null;
}

export interface ImportAnswers {
  /** Normalised words → exercise id: generic words and unknown exercises, as in Paste. */
  words: Answers;
  /** "own:Squat", "shared:Annar í páskum" → what the label means. */
  labels: Record<string, LabelMeaning>;
  /** A block heading, lower case ("metcon") → its intent, for every block with that heading. */
  headings: Record<string, BlockIntent>;
  /** A day fixed by hand: its key → the text to read instead. */
  edits: Record<string, string>;
  /** Days left out, by key. */
  skip: string[];
}

export const NO_ANSWERS: ImportAnswers = { words: {}, labels: {}, headings: {}, edits: {}, skip: [] };

export type DayStatus = "ok" | "needs" | "empty" | "not-planned" | "no-date" | "skipped";

export interface ReadDay {
  day: ImportDay;
  /** What is read: the coach's fix, else the document's text. */
  text: string;
  /** A day that says only a benchmark's name ("Murph"). */
  benchmark: string | null;
  parsed: ParseResult | null;
  status: DayStatus;
  focus: string | null;
  closed: string | null;
}

/** generic, unknown: a word to answer; problem: a line that cannot be read as it is; date: a day without one; note: how a line was read, to check. */
export type QueueKind = "generic" | "unknown" | "problem" | "date" | "note";

export interface QueueItem {
  key: string;
  kind: QueueKind;
  /** The word, or the problem in words. */
  label: string;
  /** Exercise lines it holds up. */
  lines: number;
  /** The days it is on, by key. */
  days: string[];
  /** For a word: the exercises it could be (generic) or the closest ones (unknown). */
  candidates: LibraryExercise[];
}

export interface LabelProposal {
  key: string;
  column: "own" | "shared";
  text: string;
  days: number;
  /** What the app proposes; `meaning` is the coach's answer, or the proposal. */
  proposed: LabelMeaning;
  meaning: LabelMeaning;
}

export interface ImportReading {
  days: ReadDay[];
  queue: QueueItem[];
  labels: LabelProposal[];
  /** Block headings ("Metcon", "Finisher") and how often; a rule can give each an intent. */
  headings: { title: string; count: number; intent: BlockIntent | null }[];
  /** The same workout on several days: offered as a template. */
  repeated: { text: string; days: string[] }[];
  progress: {
    /** Exercise lines on the days that will be imported, and how many are understood. */
    lines: number;
    understood: number;
    /** Days with a workout, and how many are ready. */
    workouts: number;
    ready: number;
  };
}

export interface ReadOptions {
  /** The gym's country, for its public holidays (a label on a holiday is a closed day); null tries every country the app knows. */
  country: string | null;
  /**
   * Whether the program is the document's first: a label column all programs
   * share (Afrek's column A) is the first program's day focus, not the others'.
   */
  firstProgram: boolean;
}

const labelKey = (column: "own" | "shared", text: string) => `${column}:${text}`;
const normal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Proposes what each label means: a program's own column is its focus; a shared one is the first program's focus, and a closed day on a public holiday. */
function proposeLabels(days: ImportDay[], opts: ReadOptions): Map<string, { column: "own" | "shared"; text: string; dates: string[]; proposed: LabelMeaning }> {
  // The gym's country's holidays; a gym without a country, every country the app knows (the coach confirms each label).
  const holidays = new Map<string, string>();
  const presets = opts.country ? [HOLIDAY_COUNTRIES[opts.country]].filter((p) => p !== undefined) : Object.values(HOLIDAY_COUNTRIES);
  const years = new Set(days.flatMap((d) => (d.date ? [Number(d.date.slice(0, 4))] : [])));
  for (const preset of presets) for (const y of years) for (const h of preset.holidays(y)) holidays.set(h.date, h.name);

  const all = new Map<string, { column: "own" | "shared"; text: string; dates: string[] }>();
  for (const day of days) {
    for (const l of day.labels) {
      const key = labelKey(l.column, l.text);
      const entry = all.get(key) ?? { column: l.column, text: l.text, dates: [] };
      if (day.date) entry.dates.push(day.date);
      all.set(key, entry);
    }
  }
  // Words seen often are focuses ("Mix", "Oly / Core"); a rare label may be a focus and a holiday ("Mix föstudagurinn langi").
  const focuses = [...all.values()].filter((e) => e.dates.length >= 3).map((e) => e.text).sort((a, b) => b.length - a.length);
  const result = new Map<string, { column: "own" | "shared"; text: string; dates: string[]; proposed: LabelMeaning }>();
  for (const [key, e] of all) {
    const holiday = e.dates.length <= 2 ? e.dates.map((d) => holidays.get(d)).find(Boolean) : undefined;
    if (e.column === "own") {
      result.set(key, { ...e, proposed: { focus: e.text, closed: null } });
      continue;
    }
    const t = normal(e.text);
    const known = focuses.find((f) => t === normal(f) || t.startsWith(`${normal(f)} `) || t.endsWith(` ${normal(f)}`));
    // The holiday's own words: the label without the focus at its start or end.
    const rest = !known ? e.text : t.startsWith(`${normal(known)} `) ? e.text.trim().slice(known.trim().length).trim() : t.endsWith(` ${normal(known)}`) ? e.text.trim().slice(0, -known.trim().length).trim() : "";
    result.set(key, {
      ...e,
      proposed: {
        focus: opts.firstProgram ? (known ?? (holiday ? null : e.text)) : null,
        closed: holiday ? rest || holiday : null,
      },
    });
  }
  return result;
}

/** Reads the days with the answers so far. */
export function readImport(days: ImportDay[], library: Library, answers: ImportAnswers, opts: ReadOptions): ImportReading {
  const labelInfo = proposeLabels(days, opts);
  const meaningOf = (column: "own" | "shared", text: string): LabelMeaning => {
    const key = labelKey(column, text);
    return answers.labels[key] ?? labelInfo.get(key)?.proposed ?? { focus: null, closed: null };
  };
  const skipped = new Set(answers.skip);

  const read: ReadDay[] = days.map((day) => {
    const text = (answers.edits[day.key] ?? day.text).trim();
    const own = day.labels.find((l) => l.column === "own");
    const shared = day.labels.find((l) => l.column === "shared");
    const focus = (own && meaningOf("own", own.text).focus) || (shared && meaningOf("shared", shared.text).focus) || null;
    const closed = (shared && meaningOf("shared", shared.text).closed) || (own && meaningOf("own", own.text).closed) || null;
    const base = { day, text, focus, closed, benchmark: null, parsed: null };
    if (skipped.has(day.key)) return { ...base, status: "skipped" };
    if (day.notPlanned && !answers.edits[day.key]) return { ...base, status: "not-planned" };
    if (!text) return { ...base, status: "empty" };
    const benchmark = benchmarkOf(text);
    const parsed = parseWorkoutText(text, library, answers.words);
    withHeadingRules(parsed.blocks, answers.headings);
    // A day needs the coach for a word or a missing number; a note on how a line was read ("4–5 sets: counted as 4") does not hold it up.
    const needs = parsed.lines.some((l) => !understood(l));
    // A date the document contradicts ("Tue", but a Wednesday) is checked too.
    const status: DayStatus = !day.date ? "no-date" : needs || day.problems.length > 0 ? "needs" : "ok";
    return { ...base, benchmark: benchmark?.name ?? null, parsed, status };
  });

  // The queue: every word and problem once, with the lines and days it holds up.
  const queue = new Map<string, QueueItem>();
  const add = (key: string, kind: QueueKind, label: string, dayKey: string, lines: number, candidates: LibraryExercise[] = []) => {
    const item = queue.get(key) ?? { key, kind, label, lines: 0, days: [], candidates };
    item.lines += lines;
    if (!item.days.includes(dayKey)) item.days.push(dayKey);
    queue.set(key, item);
  };
  for (const r of read) {
    if (r.status !== "skipped") for (const p of r.day.problems) add(`date:${p.replace(/\d+/g, "N").replace(/“[^”]*”/g, "…")}`, "date", p, r.day.key, 0);
    if (!r.parsed || r.status === "skipped") continue;
    for (const line of r.parsed.lines) {
      let asked = false;
      for (const item of line.items) {
        const res = item.resolution;
        if (res?.kind === "ambiguous") {
          add(`generic:${res.term}`, "generic", res.term, r.day.key, 1, res.candidates);
          asked = true;
        } else if (res?.kind === "unmatched") {
          add(`unknown:${res.term}`, "unknown", res.term, r.day.key, 1, res.suggestions);
          asked = true;
        }
      }
      if (asked) continue;
      for (const p of line.problems.length ? line.problems : line.blocking ? ["Check this line"] : []) {
        const general = p.replace(/\d+(?:[.,]\d+)?/g, "N").replace(/"[^"]*"|“[^”]*”/g, "…");
        add(`${line.blocking ? "problem" : "note"}:${general}`, line.blocking ? "problem" : "note", general, r.day.key, 1);
      }
    }
  }

  const importable = read.filter((r) => r.parsed && r.day.date && r.status !== "skipped");
  const exerciseLines = importable.flatMap((r) => r.parsed!.lines.filter((l) => l.items.length > 0));
  const headingCount = new Map<string, { title: string; count: number }>();
  for (const block of importable.flatMap((r) => r.parsed!.blocks)) {
    if (!block.title) continue;
    const k = block.title.toLowerCase();
    headingCount.set(k, { title: headingCount.get(k)?.title ?? block.title, count: (headingCount.get(k)?.count ?? 0) + 1 });
  }
  const repeats = new Map<string, string[]>();
  for (const r of importable) {
    if (r.text.length < 30) continue;
    const k = normal(r.text).replace(/[.!]+$/, "");
    repeats.set(k, [...(repeats.get(k) ?? []), r.day.key]);
  }

  return {
    days: read,
    // Most lines first; notes (nothing to answer) after everything that needs an answer.
    queue: [...queue.values()].sort((a, b) => Number(a.kind === "note") - Number(b.kind === "note") || b.lines - a.lines || b.days.length - a.days.length || a.label.localeCompare(b.label)),
    labels: [...labelInfo.entries()]
      .map(([key, e]) => ({ key, column: e.column, text: e.text, days: e.dates.length, proposed: e.proposed, meaning: answers.labels[key] ?? e.proposed }))
      .sort((a, b) => b.days - a.days || a.text.localeCompare(b.text)),
    headings: [...headingCount.entries()]
      .map(([k, h]) => ({ ...h, intent: answers.headings[k] ?? null }))
      .sort((a, b) => b.count - a.count),
    repeated: [...repeats.values()]
      .filter((keys) => keys.length >= 2)
      .map((keys) => ({ text: importable.find((r) => r.day.key === keys[0])!.text, days: keys }))
      .sort((a, b) => b.days.length - a.days.length),
    progress: {
      lines: exerciseLines.length,
      understood: exerciseLines.filter(understood).length,
      workouts: read.filter((r) => r.parsed && r.status !== "skipped").length,
      ready: read.filter((r) => r.status === "ok").length,
    },
  };
}

/** A line is understood when its exercises are known and no number is missing. */
function understood(line: ParseResult["lines"][number]): boolean {
  return !line.blocking && line.items.every((i) => !i.resolution || i.resolution.kind === "matched");
}

/** "Every heading 'Metcon' = conditioning": a block whose heading is answered gets that intent. */
function withHeadingRules(blocks: DraftBlock[], rules: Record<string, BlockIntent>) {
  for (const block of blocks) {
    const intent = block.title ? rules[block.title.toLowerCase()] : undefined;
    if (intent) block.intent = intent;
  }
}
