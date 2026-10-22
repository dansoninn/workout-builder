import { z } from "zod";

import type { BlockFormat } from "./rules";

/**
 * Block results (SPEC-data-model §6): what the group did in an AMRAP block
 * (rounds, decimals for a partial round) or a For Time block (finish times,
 * whole seconds), as a range for the class, lowest first. Anyone capped counts
 * as the cap. This mirrors private.block_result_problem in the database;
 * src/lib/workout/rule-cases.ts holds the cases both are tested on.
 */

/** A result as stored: one of the two ranges, by column. */
export interface ResultMeasure {
  rounds_low: number | null;
  rounds_high: number | null;
  finish_low_s: number | null;
  finish_high_s: number | null;
}

export const takesResults = (format: BlockFormat): format is "amrap" | "for_time" => format === "amrap" || format === "for_time";

/** What is wrong with a result for this block, in words for a coach; null when nothing is. */
export function resultProblem(format: BlockFormat, params: Record<string, unknown>, r: ResultMeasure): string | null {
  if (!takesResults(format)) return "Results are logged for AMRAP and For time blocks";
  if ((r.rounds_low === null) !== (r.rounds_high === null) || (r.finish_low_s === null) !== (r.finish_high_s === null)) {
    return "Give the lowest and the highest, or the same number twice";
  }

  if (format === "amrap") {
    if (r.rounds_low === null || r.rounds_high === null || r.finish_low_s !== null) return "An AMRAP result is the rounds the group reached";
    if (r.rounds_low < 0 || r.rounds_high >= 1000) return "Check the rounds";
    if (!twoDecimals(r.rounds_low) || !twoDecimals(r.rounds_high)) return "Use at most two decimals, e.g. 7.5";
    if (r.rounds_low > r.rounds_high) return "Fewest rounds must not be more than most rounds";
    return null;
  }

  if (r.finish_low_s === null || r.finish_high_s === null || r.rounds_low !== null) return "A For time result is the finish times";
  if (!Number.isInteger(r.finish_low_s) || !Number.isInteger(r.finish_high_s)) return "Check the finish time";
  if (r.finish_low_s < 1 || r.finish_high_s > 86400) return "Check the finish time";
  if (r.finish_low_s > r.finish_high_s) return "The fastest finish must not be slower than the slowest";
  const cap = params.time_cap_s;
  if (typeof cap === "number" && r.finish_high_s > cap) return "No finish can be over the time cap; anyone capped counts as the cap";
  return null;
}

const twoDecimals = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-9;

/** One line of an AMRAP round: the units it asks for and its estimated seconds (engine, BlockResult.roundLines). */
export interface RoundLine {
  units: number;
  seconds: number;
}

/**
 * The part of a round that `units` into it take, by the round's estimated
 * time (calc spec decision 16): the units go through the round's lines in
 * order, and each line counts with its share of the time. Null when that is
 * a whole round or more.
 */
export function partialRound(units: number, lines: RoundLine[]): number | null {
  const roundSeconds = lines.reduce((total, l) => total + l.seconds, 0);
  const roundUnits = lines.reduce((total, l) => total + l.units, 0);
  if (roundSeconds <= 0 || units >= roundUnits) return null;
  let left = units;
  let spent = 0;
  for (const line of lines) {
    if (left <= 0) break;
    const take = Math.min(left, line.units);
    spent += line.seconds * (take / line.units);
    left -= take;
  }
  return spent / roundSeconds;
}

/**
 * Rounds as typed: "7", "7.5", "7,5" (a phone's decimal comma), or "7 + 12"
 * (7 rounds and 12 reps into the next), which needs the round's lines to turn
 * into part of a round. Empty is null.
 */
export function parseRounds(input: string, lines: RoundLine[] | null = null): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = input.trim().replace(",", ".");
  if (!text) return { ok: true, value: null };
  const plus = text.match(/^(\d+)\s*\+\s*(\d+(?:\.\d+)?)$/);
  if (plus) {
    if (!lines?.length) return { ok: false, error: "This block has no estimate to turn reps into part of a round: write it as a decimal, e.g. 7.5" };
    const units = Number(plus[2]);
    const share = partialRound(units, lines);
    if (share === null) {
      const perRound = Math.round(lines.reduce((total, l) => total + l.units, 0));
      return { ok: false, error: `A round here is ${perRound} reps: “+${plus[2]}” would be a whole round or more` };
    }
    return { ok: true, value: Number(plus[1]) + Math.round(share * 100) / 100 };
  }
  if (!/^\d+(?:\.\d+)?$/.test(text)) return { ok: false, error: "Rounds as a number, 7 + 12 (rounds + reps) or 7.5" };
  return { ok: true, value: Number(text) };
}

/**
 * A finish time as typed: "12:15", "1:02:30", or digits only as on a phone's
 * number pad, where the last two are seconds ("1215" → 12:15, "930" → 9:30)
 * and one or two digits are minutes ("12" → 12:00). Empty is null.
 */
export function parseFinish(input: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = input.trim();
  if (!text) return { ok: true, value: null };
  const fail = { ok: false as const, error: "A time as 12:15 (minutes:seconds)" };

  const parts = /^\d+$/.test(text)
    ? text.length <= 2
      ? [Number(text), 0]
      : [Number(text.slice(0, -2)), Number(text.slice(-2))]
    : /^\d+(?::\d{2}){1,2}$/.test(text)
      ? text.split(":").map(Number)
      : null;
  if (!parts || parts.slice(1).some((p) => p >= 60)) return fail;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 ? { ok: true, value: seconds } : fail;
}

/** "12:15", or "1:02:30" from an hour. */
export function finishText(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** "7.5" without trailing zeros. */
export function roundsText(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** "6.5–8 rounds" or "7 rounds", or as written with what it came to ("7 + 12 rounds (≈ 7.4)"); "9:30–14:00" or "12:15". */
export function resultText(r: ResultMeasure, written: string | null = null): string {
  if (r.rounds_low !== null && r.rounds_high !== null) {
    const range = r.rounds_low === r.rounds_high ? roundsText(r.rounds_low) : `${roundsText(r.rounds_low)}–${roundsText(r.rounds_high)}`;
    if (written?.includes("+")) return `${written} rounds (≈ ${range})`;
    return `${range} ${r.rounds_high === 1 ? "round" : "rounds"}`;
  }
  if (r.finish_low_s !== null && r.finish_high_s !== null) {
    return r.finish_low_s === r.finish_high_s ? finishText(r.finish_low_s) : `${finishText(r.finish_low_s)}–${finishText(r.finish_high_s)}`;
  }
  return "";
}

/** What the result form sends to the server. */
export const resultInputSchema = z.strictObject({
  blockId: z.uuid(),
  /** AMRAP: the rounds as typed ("7 + 12", "6.5"); the server reads them again with the round's lines. */
  roundsText: z.tuple([z.string().trim().max(20), z.string().trim().max(20)]).nullable().optional(),
  sessionLabel: z.string().trim().max(40).transform((s) => s || null),
  rounds_low: z.number().nonnegative().nullable(),
  rounds_high: z.number().nonnegative().nullable(),
  finish_low_s: z.number().int().positive().nullable(),
  finish_high_s: z.number().int().positive().nullable(),
  note: z.string().trim().max(2000).transform((s) => s || null),
});
export type ResultInput = z.input<typeof resultInputSchema>;
