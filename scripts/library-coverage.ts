// Runs every workout of a programming spreadsheet through the paste parser and
// reports what the exercise library covers (BACKLOG "Exercise library",
// 2026-10-23). The spreadsheet stays on this machine (gyms' documents are
// private); the report holds exercise words and counts only, no workouts.
//
//   npx tsx scripts/library-coverage.ts docs/reference/programming/afrek-2024.xlsx [--report docs/library-coverage.md] [--lines out.txt]
//
// Layout read: one sheet per month, row 1 the program names over their columns,
// one row per day; every other cell with words is one workout.

import { readFileSync, writeFileSync } from "node:fs";

import { readXlsx } from "@/lib/import/xlsx";
import { parseWorkoutText, type ParseResult } from "@/lib/workout/parse";
import { coreLibrary } from "@/lib/workout/test-library";

export interface Cell {
  sheet: string;
  row: number;
  program: string;
  text: string;
}

/** The workout cells: under a program heading in row 1, below it, with words in them. */
export function workoutCells(bytes: Uint8Array): Cell[] {
  const cells: Cell[] = [];
  for (const sheet of readXlsx(bytes).sheets) {
    const headings = (sheet.rows[0] ?? []).map((text, column) => ({ text: text.trim(), column })).filter((h) => h.text);
    sheet.rows.slice(1).forEach((row, r) => {
      row.forEach((text, column) => {
        const heading = [...headings].reverse().find((h) => h.column <= column);
        // A workout has a number somewhere; a cell of words alone is the program's day focus ("Squat", "Bench Press").
        if (!heading || !/[a-z]{2}/i.test(text) || !/\d/.test(text) || /^\?+$/.test(text.trim())) return;
        cells.push({ sheet: sheet.name, row: r + 2, program: heading.text, text });
      });
    });
  }
  return cells;
}

function main() {
  const [path, ...args] = process.argv.slice(2);
  if (!path) throw new Error("Usage: tsx scripts/library-coverage.ts <file.xlsx> [--lines out.txt]");
  const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const library = coreLibrary();
  const cells = workoutCells(readFileSync(path));
  const results: { cell: Cell; parsed: ParseResult }[] = cells.map((cell) => ({ cell, parsed: parseWorkoutText(cell.text, library) }));

  const status: Record<string, number> = {};
  const unmatched = new Map<string, number>();
  const ambiguous = new Map<string, number>();
  const matched = new Map<string, number>();
  const notes = new Map<string, number>();
  const problems = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const { parsed } of results) {
    for (const line of parsed.lines) {
      status[line.status] = (status[line.status] ?? 0) + 1;
      if (line.status === "note") bump(notes, line.text.trim());
      for (const p of line.problems) bump(problems, p.replace(/\d+/g, "N").replace(/"[^"]*"/g, '"…"'));
      for (const item of line.items) {
        const r = item.resolution;
        if (!r) continue;
        if (r.kind === "matched") bump(matched, r.exercise.name);
        else if (r.kind === "ambiguous") bump(ambiguous, r.term);
        else bump(unmatched, r.term);
      }
    }
  }
  const top = (map: Map<string, number>, n = 40) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
  console.log(`${cells.length} workouts, ${results.filter((r) => r.parsed.lines.some((l) => l.blocking)).length} blocked by a missing number`);
  console.log("lines:", status);
  console.log(`exercises: ${[...matched.values()].reduce((a, b) => a + b, 0)} matched (${matched.size} names), ${[...ambiguous.values()].reduce((a, b) => a + b, 0)} generic (${ambiguous.size}), ${[...unmatched.values()].reduce((a, b) => a + b, 0)} unknown (${unmatched.size})`);
  console.log("top problems:", top(problems, 25));
  console.log("top unknown:", top(unmatched, 30));
  console.log("top notes:", top(notes, 30));

  const linesPath = option("--lines");
  if (linesPath) {
    const out: string[] = [];
    for (const { cell, parsed } of results) {
      out.push(`=== ${cell.sheet} row ${cell.row} · ${cell.program}`);
      for (const line of parsed.lines) {
        if (line.status === "blank") continue;
        const items = line.items.map((i) => `${i.resolution?.kind ?? "-"}:${i.resolution?.kind === "matched" ? i.resolution.exercise.name : i.resolution?.term ?? ""}`).join(", ");
        out.push(`${line.status.padEnd(4)} ${line.blocking ? "!" : " "} ${line.text.trim()}  ⟶ ${line.meaning}${items ? ` [${items}]` : ""}${line.problems.length ? ` {${line.problems.join("; ")}}` : ""}`);
      }
    }
    writeFileSync(linesPath, out.join("\n"));
  }
}

if (process.argv[1]?.endsWith("library-coverage.ts")) main();
