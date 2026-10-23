// Program import (BACKLOG "Program import", 2026-10-23), tested on made-up
// files in several gyms' styles: a calendar grid like Afrek's (a sheet per
// month, programs side by side), a CSV list of rows with a program column,
// a Word table, and text with dates, weekdays or "Week 1 Day 1". Afrek's own
// file stays on the machine it was run on (scripts/library-coverage.ts).

import { strToU8 } from "fflate";
import { describe, expect, it } from "vitest";

import { ENGINE_CONFIG } from "@/lib/engine/config";
import { computeWorkout } from "@/lib/engine/workout";
import { toEngineWorkout } from "@/lib/workout/draft";
import { coreLibrary, idOf } from "@/lib/workout/test-library";

import { dayOfMonth, monthOf, readDate, weekdayOf } from "./dates";
import { extractDays } from "./days";
import { fromCsv, fromDocx, fromText, fromXlsx } from "./document";
import { type GridLayout, proposeLayout, type TextLayout } from "./layout";
import { DEFAULT_CHOICES, type PlanContext, planImport } from "./plan";
import { findPersonalData, removePersonalData } from "./privacy";
import { analyseProgramming } from "./report";
import { NO_ANSWERS, readImport } from "./review";
import { docxFile, xlsxFile } from "./test-files";

const TODAY = "2026-10-23";
const library = coreLibrary();

/** A studio's 2026 plan, laid out as Afrek lays out its year (made-up workouts). */
const studio = () =>
  fromXlsx(
    "studio-2026.xlsx",
    xlsxFile([
      {
        name: "Janúar",
        rows: [
          ["", "", "", "CLASS", "", "", "STRENGTH CLUB", ""],
          ["Nýársdagur", 1, "Fim", "", "", "", "", ""],
          ["Squat", 2, "Fös", "A. 5 x 5 Back squat\nB. AMRAP 10\n10 burpees\n10 kb swings", "", "", "Squat", "A. 5 x 3 Back squat"],
          ["Mix", 3, "Lau", "AMRAP 12\n12 wall balls\n9 burpees", "", "", "", ""],
          ["PP", 4, "Sun", "Murph", "", "", "", ""],
          ["Squat", 5, "Mán", "For time\n21-15-9\nThrusters 43/30 kg\nPull-ups", "", "", "Bench Press", "???"],
          ["Mix", 6, "Þri", "AMRAP 12\n12 wall balls\n9 burpees", "", "", "", ""],
          ["Squat", 7, "Þri", "Metcon\nAMRAP 8\n3 x 10 squat\n10 bike", "", "", "", ""],
        ],
      },
      {
        // The programs swap places in February: each is found by its heading.
        name: "Febrúar",
        rows: [
          ["", "", "", "STRENGTH CLUB", "", "", "CLASS", ""],
          ["PP", 2, "Mán", "Bench Press", "A. 5 x 5 Bench press", "", "EMOM 10\n5 burpees", ""],
        ],
      },
    ]),
  );

describe("dates as programming documents write them", () => {
  it("months and weekdays in English, Icelandic, Nordic and German", () => {
    expect(["Jan", "Apríl", "maí", "Ágúst", "Mars", "Okt.", "Dezember", "juni"].map(monthOf)).toEqual([1, 4, 5, 8, 3, 10, 12, 6]);
    expect(["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun", "Monday", "torsdag", "Sonntag"].map((w) => weekdayOf(w))).toEqual([0, 1, 2, 3, 4, 5, 6, 0, 3, 6]);
    expect(weekdayOf("Mo")).toBeNull();
    expect(weekdayOf("Mo", { short: true })).toBe(0);
  });

  it("dates: Excel numbers, ISO, day or month first, words, a year given", () => {
    expect(readDate("45292")).toBe("2024-01-01");
    expect(readDate("2026-01-05")).toBe("2026-01-05");
    expect(readDate("5.1.2026")).toBe("2026-01-05");
    expect(readDate("05/01/26")).toBe("2026-01-05");
    expect(readDate("1/5/2026", { dayFirst: false })).toBe("2026-01-05");
    expect(readDate("13/01/2026", { dayFirst: false })).toBe("2026-01-13");
    expect(readDate("Mánudagur 5. janúar", { year: 2026 })).toBe("2026-01-05");
    expect(readDate("January 5, 2026")).toBe("2026-01-05");
    expect(readDate("Mon 5 Jan", { year: 2026 })).toBe("2026-01-05");
    expect(readDate("30.2.2026")).toBeNull();
    expect(readDate("Back squat 5x5")).toBeNull();
    expect(["1.0", "05", "31", "32", "1.5"].map(dayOfMonth)).toEqual([1, 5, 31, null, null]);
  });
});

describe("a calendar grid: a sheet per month, programs side by side (Afrek's layout)", () => {
  const doc = studio();
  const layout = proposeLayout(doc, TODAY) as GridLayout;

  it("is found: the day column, the month from each sheet, the year from the file's name, the programs by their headings", () => {
    expect(layout).toMatchObject({
      kind: "grid",
      sheets: ["Janúar", "Febrúar"],
      headerRow: 0,
      dates: { from: "day-of-month", column: 1, year: 2026, months: { Janúar: 1, Febrúar: 2 } },
      weekdayColumn: 2,
      sharedFocusColumn: 0,
    });
    expect(layout.programs.map((p) => [p.name, p.workoutColumns, p.focusColumn])).toEqual([
      ["CLASS", [3], null],
      ["STRENGTH CLUB", [7], 6],
    ]);
  });

  it("gives each program its days, also where the programs moved on a later sheet", () => {
    const klass = extractDays(doc, layout, 0);
    expect(klass.filter((d) => d.text).map((d) => d.date)).toEqual([
      "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06", "2026-01-07", "2026-02-02",
    ]);
    expect(klass.at(-1)!.text).toBe("EMOM 10\n5 burpees");
    const strength = extractDays(doc, layout, 1);
    expect(strength.map((d) => [d.date, d.text, d.labels.find((l) => l.column === "own")?.text ?? null, d.notPlanned])).toEqual([
      ["2026-01-01", "", null, false],
      ["2026-01-02", "A. 5 x 3 Back squat", "Squat", false],
      ["2026-01-03", "", null, false],
      ["2026-01-04", "", null, false],
      ["2026-01-05", "", "Bench Press", true],
      ["2026-01-06", "", null, false],
      ["2026-01-07", "", null, false],
      ["2026-02-02", "A. 5 x 5 Bench press", "Bench Press", false],
    ]);
  });

  it("says when a weekday and a date disagree", () => {
    const day = extractDays(doc, layout, 0).find((d) => d.date === "2026-01-07")!;
    expect(day.problems).toEqual(["Says Tuesday, but 2026-01-07 is a Wednesday"]);
  });
});

describe("other layouts", () => {
  it("a CSV list of rows: a date, a program column, a title; dates month first when the file shows it", () => {
    const doc = fromCsv(
      "export.csv",
      'Date,Program,Title,Workout\n01/13/2026,Class,Engine,"AMRAP 12\n10 burpees\n15 air squats"\n01/13/2026,Barbell,,5 x 5 Deadlift\n01/14/2026,Class,Grace,Grace\n',
    );
    const layout = proposeLayout(doc, TODAY) as GridLayout;
    expect(layout.dates).toMatchObject({ from: "date", column: 0, dayFirst: false });
    expect(layout.programs.map((p) => p.name)).toEqual(["Class", "Barbell"]);
    const days = extractDays(doc, layout, 0);
    expect(days.map((d) => [d.date, d.title])).toEqual([["2026-01-13", "Engine"], ["2026-01-14", "Grace"]]);
    expect(days[0]!.text).toBe("AMRAP 12\n10 burpees\n15 air squats");
  });

  it("a CSV from a European Excel: semicolons and day-first dates", () => {
    const doc = fromCsv("plan.csv", "Dagsetning;Æfing\n5.1.2026;AMRAP 12 - 10 burpees\n6.1.2026;5 x 5 Back squat\n");
    const layout = proposeLayout(doc, TODAY) as GridLayout;
    expect(extractDays(doc, layout, 0).map((d) => d.date)).toEqual(["2026-01-05", "2026-01-06"]);
  });

  it("a Word document with a weekly table", () => {
    const doc = fromDocx(
      "plan-2026.docx",
      docxFile([
        { paragraph: "January, week 2" },
        { table: [["Day", "Workout"], ["Mon 5 Jan", "AMRAP 12\n10 burpees"], ["Tue 6 Jan", "5 x 5 Back squat"], ["Wed 7 Jan", "For time\n50 wall balls"]] },
      ]),
    );
    expect(doc.kind).toBe("grid");
    const layout = proposeLayout(doc, TODAY) as GridLayout;
    expect(extractDays(doc, layout, 0).map((d) => [d.date, d.text])).toEqual([
      ["2026-01-05", "AMRAP 12\n10 burpees"],
      ["2026-01-06", "5 x 5 Back squat"],
      ["2026-01-07", "For time\n50 wall balls"],
    ]);
  });

  it("a Word document without tables is its text", () => {
    const doc = fromDocx("notes.docx", docxFile([{ paragraph: "Monday 5.1.2026" }, { paragraph: "AMRAP 12" }, { paragraph: "10 burpees" }]));
    expect(doc).toEqual({ kind: "text", name: "notes.docx", text: "Monday 5.1.2026\nAMRAP 12\n10 burpees" });
    expect(() => fromDocx("x.docx", strToU8("not a zip"))).toThrow("This file is not a Word document (.docx).");
  });

  it("text with a date at the top of each day", () => {
    const doc = fromText("Pasted", "January plan\n\nMonday 5.1.2026\nAMRAP 12\n10 burpees\n\nTuesday 6.1.2026 – Legs\n5 x 5 Back squat\n");
    const layout = proposeLayout(doc, TODAY) as TextLayout;
    expect(layout.days).toMatchObject({ by: "date", year: 2026 });
    expect(extractDays(doc, layout).map((d) => [d.date, d.text])).toEqual([
      ["2026-01-05", "AMRAP 12\n10 burpees"],
      ["2026-01-06", "5 x 5 Back squat"],
    ]);
  });

  it('"Week 1 Day 1": counted from the Monday the coach gives, on the weekdays they train', () => {
    const doc = fromText("Block", "Week 1 Day 1\nAMRAP 10\n10 burpees\nWeek 1 Day 2\n5 x 5 Deadlift\nWeek 2 Day 1:\nFor time\n50 wall balls");
    const layout: TextLayout = { kind: "text", days: { by: "week-day", firstMonday: "2026-01-05", weekdays: [0, 2, 4] } };
    expect(proposeLayout(doc, TODAY)).toMatchObject({ kind: "text", days: { by: "week-day" } });
    expect(extractDays(doc, layout).map((d) => d.date)).toEqual(["2026-01-05", "2026-01-07", "2026-01-12"]);
  });

  it("weekdays in order: a weekday earlier than the one before starts the next week", () => {
    const doc = fromText("Weeks", "Monday\nAMRAP 10\n10 burpees\nWednesday\n5 x 5 Deadlift\nMonday\nFor time\n50 wall balls");
    const layout = proposeLayout(doc, TODAY) as TextLayout;
    expect(layout.days.by).toBe("weekday");
    const days = extractDays(doc, { kind: "text", days: { by: "weekday", firstMonday: "2026-01-05" } });
    expect(days.map((d) => d.date)).toEqual(["2026-01-05", "2026-01-07", "2026-01-12"]);
  });

  it("a document without days says so", () => {
    expect(proposeLayout(fromText("x", "Just some notes\nabout training"), TODAY)).toBeNull();
  });
});

describe("reading an import: the queue, answers, labels, benchmarks, repeats", () => {
  const doc = studio();
  const layout = proposeLayout(doc, TODAY) as GridLayout;
  const klass = extractDays(doc, layout, 0);

  it("every word and missing number in one queue, most lines first", () => {
    const reading = readImport(klass, library, NO_ANSWERS, { country: "IS", firstProgram: true });
    const asked = reading.queue.filter((q) => q.kind !== "note");
    expect(asked.map((q) => [q.kind, q.label, q.lines])).toEqual([
      ["generic", "bike", 1],
      ["generic", "squat", 1],
      ["date", "Says Tuesday, but 2026-01-07 is a Wednesday", 0],
    ]);
    expect(reading.queue.find((q) => q.label === "squat")!.candidates.map((e) => e.name)).toContain("Back squat");
    expect(reading.progress).toMatchObject({ workouts: 7 });
    expect(reading.days.find((d) => d.day.date === "2026-01-07")!.status).toBe("needs");
  });

  it("an answer applies to the whole import, and a fixed day is read as fixed", () => {
    const reading = readImport(klass, library, { ...NO_ANSWERS, words: { squat: idOf("Air squat"), bike: idOf("Air bike") } }, { country: "IS", firstProgram: true });
    expect(reading.queue.filter((q) => q.kind === "generic")).toEqual([]);
    expect(reading.progress.understood).toBe(reading.progress.lines);
    const fixed = readImport(klass, library, { ...NO_ANSWERS, edits: { "Janúar:8": "AMRAP 8\n10 burpees" } }, { country: "IS", firstProgram: true });
    expect(fixed.queue.some((q) => q.label === "squat")).toBe(false);
  });

  it("labels: the shared column is the first program's focus, and a holiday is a closed day", () => {
    const reading = readImport(klass, library, NO_ANSWERS, { country: "IS", firstProgram: true });
    const meaning = (text: string) => reading.labels.find((l) => l.text === text)?.meaning;
    expect(meaning("Squat")).toEqual({ focus: "Squat", closed: null });
    expect(meaning("Nýársdagur")).toEqual({ focus: null, closed: "Nýársdagur" });
    expect(reading.days.find((d) => d.day.date === "2026-01-02")).toMatchObject({ focus: "Squat", closed: null });

    const strength = readImport(extractDays(doc, layout, 1), library, NO_ANSWERS, { country: "IS", firstProgram: false });
    expect(strength.days.find((d) => d.day.date === "2026-01-02")).toMatchObject({ focus: "Squat" });
    expect(strength.labels.find((l) => l.column === "shared" && l.text === "Mix")?.meaning).toEqual({ focus: null, closed: null });
    expect(strength.days.find((d) => d.day.date === "2026-01-05")?.status).toBe("not-planned");
  });

  it("a gym without a country: a label on any known country's public holiday is proposed as closed", () => {
    const reading = readImport(klass, library, NO_ANSWERS, { country: null, firstProgram: true });
    expect(reading.labels.find((l) => l.text === "Nýársdagur")?.meaning).toEqual({ focus: null, closed: "Nýársdagur" });
  });

  it("a day that names a benchmark is the benchmark; the same workout twice is offered as a template", () => {
    const reading = readImport(klass, library, NO_ANSWERS, { country: "IS", firstProgram: true });
    const murph = reading.days.find((d) => d.day.date === "2026-01-04")!;
    expect(murph).toMatchObject({ benchmark: "Murph", status: "ok" });
    expect(murph.parsed!.blocks[0]!.items).toHaveLength(5);
    expect(reading.repeated.map((r) => r.days)).toEqual([["Janúar:4", "Janúar:7"]]);
  });

  it("a rule for a heading gives every block with it that intent; a day can be left out", () => {
    const reading = readImport(klass, library, { ...NO_ANSWERS, headings: { metcon: "conditioning" }, skip: ["Janúar:3"] }, { country: "IS", firstProgram: true });
    const metcon = reading.days.find((d) => d.day.date === "2026-01-07")!;
    expect(metcon.parsed!.blocks.map((b) => [b.title, b.intent])).toEqual([["Metcon", "conditioning"]]);
    expect(reading.headings.find((h) => h.title === "Metcon")).toMatchObject({ count: 1, intent: "conditioning" });
    expect(reading.days.find((d) => d.day.key === "Janúar:3")!.status).toBe("skipped");
  });
});

describe("personal data before anything is stored (GDPR)", () => {
  it("finds emails, phone numbers, kennitölur and full Icelandic names; not rep schemes or distances", () => {
    const text = "Great job Jón Jónsson! PR 120 kg\nQuestions: anna@example.com or 555-1234 / +354 555 1234\nkt. 010190-2939\n21-15-9\n800-1000 m row\nGuðrún Ósk Sigurðardóttir did Rx";
    expect(findPersonalData(text).map((f) => `${f.kind}:${f.text}`).sort()).toEqual([
      "email:anna@example.com",
      "kennitala:010190-2939",
      "name:Guðrún Ósk Sigurðardóttir",
      "name:Jón Jónsson",
      "phone:+354 555 1234",
      "phone:555-1234",
    ]);
    expect(findPersonalData("AMRAP 12\n21-15-9\n800-1000 m row\n10 x 20 kg\n12 burpees 2024-01-05")).toEqual([]);
  });

  it("removes what was found", () => {
    const text = "Coach: anna@example.com\nAMRAP 12";
    expect(removePersonalData(text, findPersonalData(text))).toBe("Coach: [removed]\nAMRAP 12");
  });
});

describe("what an import makes", () => {
  const doc = studio();
  const layout = proposeLayout(doc, TODAY) as GridLayout;
  const words = { squat: idOf("Air squat"), bike: idOf("Air bike") };
  const reading = readImport(extractDays(doc, layout, 0), library, { ...NO_ANSWERS, words }, { country: "IS", firstProgram: true });
  let n = 0;
  const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({
    trackId: "track", library, focusNames: ["squat"], canManage: true, existing: [], choices: DEFAULT_CHOICES, newId: () => `id-${++n}`, ...over,
  });

  it("a workout per day, its text kept; ready ones published only when asked", () => {
    const plan = planImport(reading, ctx());
    expect(plan.workouts.map((w) => w.date)).toEqual(["2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06", "2026-01-07", "2026-02-02"]);
    expect(plan.workouts.find((w) => w.date === "2026-01-04")).toMatchObject({ title: "Murph", rawText: "Murph", kind: "scheduled", trackId: "track" });
    expect(plan.summary.published).toBe(0);
    const published = planImport(reading, ctx({ choices: { ...DEFAULT_CHOICES, publish: true } }));
    // The 7 January day says Tuesday but is a Wednesday: imported as a draft to check.
    expect(published.workouts.filter((w) => w.publish).map((w) => w.date)).not.toContain("2026-01-07");
    expect(published.summary.published).toBe(published.summary.ready);
  });

  it("days the program already has: kept, replaced, or added alongside", () => {
    const existing = [{ id: "old", date: "2026-01-03" }];
    expect(planImport(reading, ctx({ existing })).summary).toMatchObject({ workouts: 6, keptExisting: 1, replaced: 0 });
    const replaced = planImport(reading, ctx({ existing, choices: { ...DEFAULT_CHOICES, conflicts: "replace" } }));
    expect(replaced).toMatchObject({ replace: ["old"], summary: { workouts: 7, replaced: 1 } });
    expect(planImport(reading, ctx({ existing, choices: { ...DEFAULT_CHOICES, conflicts: "add" } })).summary).toMatchObject({ workouts: 7, replaced: 0 });
  });

  it("focuses by the gym's own names, new ones and closed days for owners and head coaches only", () => {
    const owner = planImport(reading, ctx());
    expect(owner.days.find((d) => d.date === "2026-01-02")).toEqual({ date: "2026-01-02", focus: "squat" });
    expect(owner.newFocuses.sort()).toEqual(["Mix", "PP"]);
    expect(owner.closed).toEqual([{ date: "2026-01-01", name: "Nýársdagur" }]);
    const coach = planImport(reading, ctx({ canManage: false }));
    expect(coach.newFocuses).toEqual([]);
    expect(coach.closed).toEqual([]);
    expect(coach.days.every((d) => d.focus === "squat")).toBe(true);
    expect(coach.summary.leftOut).toBeGreaterThan(0);
  });

  it("generic words answered become the gym's answers; repeated workouts become templates with their own ids", () => {
    const plan = planImport(reading, ctx({ choices: { ...DEFAULT_CHOICES, templates: ["Janúar:4"] } }));
    expect(plan.aliases.map((a) => a.term).sort()).toEqual(["bike", "squat"]);
    expect(plan.templates).toHaveLength(1);
    expect(plan.templates[0]).toMatchObject({ kind: "template", date: null, title: "AMRAP 12" });
    const day = plan.workouts.find((w) => w.dayKey === "Janúar:4")!;
    expect(plan.templates[0]!.blocks[0]!.id).not.toBe(day.blocks[0]!.id);
  });
});

describe("your programming, analysed", () => {
  it("the period in plain words: how much, balance, gaps, what comes back, conditioning", () => {
    const doc = studio();
    const layout = proposeLayout(doc, TODAY) as GridLayout;
    const reading = readImport(extractDays(doc, layout, 0), library, { ...NO_ANSWERS, words: { squat: idOf("Air squat"), bike: idOf("Air bike") } }, { country: "IS", firstProgram: true });
    let n = 0;
    const plan = planImport(reading, { trackId: "t", library, focusNames: [], canManage: true, existing: [], choices: DEFAULT_CHOICES, newId: () => `w${++n}` });
    const workouts = plan.workouts.map((w) => ({
      id: w.id,
      date: w.date!,
      title: w.title,
      trackId: "t",
      result: computeWorkout(toEngineWorkout(w, library).workout, ENGINE_CONFIG),
      exercises: w.blocks.flatMap((b) => b.items.flatMap((i) => (i.exerciseId ? [i.exerciseId] : []))),
    }));
    const report = analyseProgramming(workouts, (id) => library.exercises.find((e) => e.id === id)?.name ?? null)!;
    expect(report.findings[0]).toMatch(/^\d+ weeks, 7 workouts: \d\.\d a week, about \d+ minutes each\.$/);
    expect(report.findings.some((f) => f.startsWith("Most programmed: burpee in "))).toBe(true);
    expect(report.findings.some((f) => /^Conditioning: run 3 km/.test(f))).toBe(true);
    expect(report.topExercises[0]).toMatchObject({ name: "Burpee" });
    expect(analyseProgramming([], () => null)).toBeNull();
  });
});
