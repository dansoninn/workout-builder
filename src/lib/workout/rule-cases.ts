import type { ResultMeasure } from "./results";
import type { BlockFormat } from "./rules";

/**
 * One list of cases for the workout rules, checked by Vitest against the zod
 * schemas (rules.test.ts) and by pgTAP against the database
 * (supabase/tests/database/14_rule_cases.test.sql, generated from this file
 * by `npm run rules:generate`; a Vitest test fails if it is out of date).
 */
export type RuleCase =
  | { rule: "params"; format: BlockFormat; value: unknown; valid: boolean; why: string }
  | { rule: "quantity" | "load" | "pace"; value: unknown; valid: boolean; why: string }
  | { rule: "result"; format: BlockFormat; params: Record<string, unknown>; value: ResultMeasure; valid: boolean; why: string };

const amrap8 = { format: "amrap", params: { time_s: 480 } } as const;
const forTime = { format: "for_time", params: { rounds: 3 } } as const;
const capped15 = { format: "for_time", params: { rounds: 3, time_cap_s: 900 } } as const;
const rounds = (low: number | null, high: number | null): ResultMeasure => ({ rounds_low: low, rounds_high: high, finish_low_s: null, finish_high_s: null });
const finish = (low: number | null, high: number | null): ResultMeasure => ({ rounds_low: null, rounds_high: null, finish_low_s: low, finish_high_s: high });

export const RULE_CASES: RuleCase[] = [
  // Block params, per format.
  { rule: "params", format: "sets", value: { sets: 5, rest_s: 120 }, valid: true, why: "sets with rest" },
  { rule: "params", format: "sets", value: { sets: 5 }, valid: true, why: "rest is optional" },
  { rule: "params", format: "sets", value: { sets: 0 }, valid: false, why: "at least one set" },
  { rule: "params", format: "sets", value: { sets: 2.5 }, valid: false, why: "whole sets" },
  { rule: "params", format: "sets", value: { sets: 5, rounds: 2 }, valid: false, why: "no unknown keys" },
  { rule: "params", format: "every", value: { interval_s: 180, rounds: 5 }, valid: true, why: "E3M x 5" },
  { rule: "params", format: "every", value: { interval_s: 60, rounds: 6, alternating: true }, valid: true, why: "alternating EMOM" },
  { rule: "params", format: "every", value: { interval_s: 60, rounds: 6, alternating: "yes" }, valid: false, why: "alternating is true or false" },
  { rule: "params", format: "every", value: { interval_s: 60 }, valid: false, why: "rounds are required" },
  { rule: "params", format: "amrap", value: { time_s: 480 }, valid: true, why: "AMRAP 8" },
  { rule: "params", format: "amrap", value: { time_s: 0 }, valid: false, why: "a positive time" },
  { rule: "params", format: "for_time", value: { rounds: 3, time_cap_s: 900 }, valid: true, why: "3 RFT, 15 min cap" },
  { rule: "params", format: "for_time", value: { rounds: 1 }, valid: true, why: "the cap is optional" },
  { rule: "params", format: "for_time", value: { rounds: 1, time_cap_s: 0 }, valid: false, why: "a positive cap" },
  { rule: "params", format: "intervals", value: { rounds: 4, work_s: 90, rest_s: 30, stations: 3, rest_between_rounds_s: 90 }, valid: true, why: "WOD 3" },
  { rule: "params", format: "intervals", value: { rounds: 4, work_s: 90, rest_s: 0, stations: 1 }, valid: true, why: "no rest is allowed" },
  { rule: "params", format: "intervals", value: { rounds: 4, work_s: 90, stations: 3 }, valid: false, why: "rest is required" },
  { rule: "params", format: "tabata", value: { rounds: 8, work_s: 20, rest_s: 10 }, valid: true, why: "classic tabata" },
  { rule: "params", format: "tabata", value: { rounds: 8, work_s: 30, rest_s: 10 }, valid: false, why: "tabata is 20/10" },

  // Quantities.
  { rule: "quantity", value: { type: "reps", value: 5 }, valid: true, why: "5 reps" },
  { rule: "quantity", value: { type: "reps", value: 0 }, valid: false, why: "at least one rep" },
  { rule: "quantity", value: { type: "reps_range", min: 8, max: 10 }, valid: true, why: "8-10 reps" },
  { rule: "quantity", value: { type: "reps_range", min: 10, max: 10 }, valid: false, why: "a range goes up" },
  { rule: "quantity", value: { type: "reps_scheme", scheme: [21, 15, 9] }, valid: true, why: "21-15-9" },
  { rule: "quantity", value: { type: "reps_scheme", scheme: [] }, valid: false, why: "a scheme has numbers" },
  { rule: "quantity", value: { type: "reps_per_side", value: 8 }, valid: true, why: "8/8" },
  { rule: "quantity", value: { type: "distance_m", value: 400 }, valid: true, why: "400 m" },
  { rule: "quantity", value: { type: "distance_m", value: 0.5 }, valid: true, why: "decimal metres" },
  { rule: "quantity", value: { type: "calories", min: 8, max: 12 }, valid: true, why: "8-12 cal" },
  { rule: "quantity", value: { type: "calories", min: 15, max: 15 }, valid: true, why: "15 cal" },
  { rule: "quantity", value: { type: "calories", min: 15, max: 12 }, valid: false, why: "min above max" },
  { rule: "quantity", value: { type: "time_s", value: 30 }, valid: true, why: "30 s hold" },
  { rule: "quantity", value: { type: "max_effort", unit: "calories" }, valid: true, why: "max cal" },
  { rule: "quantity", value: { type: "max_effort", unit: "kg" }, valid: false, why: "a known unit" },
  { rule: "quantity", value: { type: "reps", value: 5, extra: 1 }, valid: false, why: "no unknown keys" },
  { rule: "quantity", value: { type: "jumps", value: 5 }, valid: false, why: "a known type" },

  // Loads.
  { rule: "load", value: { type: "percent_1rm", min: 75, max: 80 }, valid: true, why: "@75-80%" },
  { rule: "load", value: { type: "percent_1rm", min: 80, max: 75 }, valid: false, why: "min above max" },
  { rule: "load", value: { type: "percent_1rm", min: 90, max: 105 }, valid: false, why: "at most 100%" },
  { rule: "load", value: { type: "absolute_kg", rx: [22.5, 15] }, valid: true, why: "22.5/15 kg" },
  { rule: "load", value: { type: "absolute_kg", rx: [] }, valid: false, why: "at least one Rx" },
  { rule: "load", value: { type: "absolute_kg", rx: [0] }, valid: false, why: "a positive weight" },
  { rule: "load", value: { type: "bodyweight" }, valid: true, why: "bodyweight" },

  // Paces.
  { rule: "pace", value: { sec_per_rep: 2.5 }, valid: true, why: "seconds per rep" },
  { rule: "pace", value: { sec_per_m: 0.24, sec_per_cal: 4 }, valid: true, why: "metres and calories" },
  { rule: "pace", value: {}, valid: false, why: "at least one pace" },
  { rule: "pace", value: { sec_per_rep: 0 }, valid: false, why: "a positive pace" },
  { rule: "pace", value: { sec_per_500m: 120 }, valid: false, why: "a known key" },

  // Block results (what the group did).
  { rule: "result", ...amrap8, value: rounds(6.5, 8.75), valid: true, why: "AMRAP rounds, low-high" },
  { rule: "result", ...amrap8, value: rounds(7, 7), valid: true, why: "everyone the same" },
  { rule: "result", ...amrap8, value: rounds(0, 0.5), valid: true, why: "under one round" },
  { rule: "result", ...amrap8, value: rounds(8, 7), valid: false, why: "fewest above most" },
  { rule: "result", ...amrap8, value: rounds(-1, 7), valid: false, why: "no negative rounds" },
  { rule: "result", ...amrap8, value: rounds(7.125, 8), valid: false, why: "two decimals at most" },
  { rule: "result", ...amrap8, value: rounds(7, 1000), valid: false, why: "a sane number of rounds" },
  { rule: "result", ...amrap8, value: rounds(7, null), valid: false, why: "both ends of the range" },
  { rule: "result", ...amrap8, value: finish(600, 700), valid: false, why: "an AMRAP has no finish time" },
  { rule: "result", ...amrap8, value: { rounds_low: 7, rounds_high: 8, finish_low_s: 600, finish_high_s: 700 }, valid: false, why: "not both" },
  { rule: "result", ...forTime, value: finish(570, 840), valid: true, why: "For Time finishes, low-high" },
  { rule: "result", ...forTime, value: finish(735, 735), valid: true, why: "one finish" },
  { rule: "result", ...forTime, value: finish(840, 570), valid: false, why: "fastest after slowest" },
  { rule: "result", ...forTime, value: finish(0, 570), valid: false, why: "a finish takes time" },
  { rule: "result", ...forTime, value: finish(570, 90000), valid: false, why: "within a day" },
  { rule: "result", ...forTime, value: rounds(3, 3), valid: false, why: "For Time has no rounds result" },
  { rule: "result", ...capped15, value: finish(700, 900), valid: true, why: "capped athletes count as the cap" },
  { rule: "result", ...capped15, value: finish(700, 901), valid: false, why: "not over the cap" },
  { rule: "result", format: "every", params: { interval_s: 60, rounds: 10 }, value: rounds(10, 10), valid: false, why: "only AMRAP and For Time" },
];
