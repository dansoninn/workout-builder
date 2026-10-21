// One test per calculation rule (calc spec §4–§6). Paces here are simple
// test numbers, not proposed defaults.

import { describe, expect, it } from "vitest";

import { countsAsHardSet, defaultEfforts, resolveBlockEffort } from "@/lib/engine/effort";
import { FIXTURE_CONFIG, coreExercise } from "@/lib/engine/fixtures/worked-wods";
import { paceFromJson, paceToJson, resolvePace } from "@/lib/engine/pace";
import type { Block, EngineConfig, Item } from "@/lib/engine/types";
import { weekOnWeekChange, weekSummary } from "@/lib/engine/weekly";
import { computeBlock, computeRatios, computeWorkout } from "@/lib/engine/workout";

const config = FIXTURE_CONFIG;
const item = (name: string, quantity: Item["quantity"], extra: Partial<Item> = {}): Item => ({
  exercise: coreExercise(name, { secPerRep: 2, secPerM: 0.5, secPerCal: 4 }),
  quantity,
  ...extra,
});
const block = (b: Omit<Block, "label"> & { label?: string }): Block => ({ label: "X", ...b }) as Block;

describe("effort (calc spec §4.4, §9.4)", () => {
  it("uses the provisional defaults when the coach sets nothing", () => {
    expect(defaultEfforts({ intent: "strength", format: "sets" })).toEqual({ pace: "easy", load: "hard" });
    expect(defaultEfforts({ intent: "conditioning", format: "amrap" })).toEqual({ pace: "moderate", load: null });
    expect(defaultEfforts({ intent: "conditioning", format: "intervals" })).toEqual({ pace: "moderate", load: null });
    expect(defaultEfforts({ intent: "conditioning", format: "for_time" })).toEqual({ pace: "hard", load: null });
  });

  it("planned RPE is the higher of the two axes; the coach's word wins over a default", () => {
    const strength = block({ intent: "strength", format: "sets", params: { sets: 3 }, items: [] });
    expect(resolveBlockEffort(strength, config)).toMatchObject({ plannedRpe: 8, source: "default" });
    expect(resolveBlockEffort({ ...strength, loadEffort: "moderate" }, config)).toMatchObject({ plannedRpe: 6, source: "coach" });
    expect(resolveBlockEffort({ ...strength, paceEffort: "max" }, config)).toMatchObject({ plannedRpe: 9.5, source: "coach" });
  });

  it("a hard set is load effort Moderate or Hard (≤ 3 reps in reserve)", () => {
    expect(countsAsHardSet("easy", config)).toBe(false);
    expect(countsAsHardSet("moderate", config)).toBe(true);
    expect(countsAsHardSet("hard", config)).toBe(true);
    expect(countsAsHardSet(null, config)).toBe(false);
  });

  it("hard sets follow load effort, not block type: heavy swings in an AMRAP count", () => {
    const amrap = block({
      intent: "conditioning", format: "amrap", params: { time_s: 600 }, targetRounds: 6.5,
      items: [item("Kettlebell swing", { type: "reps", value: 10 }, { loadEffort: "hard" })],
    });
    expect(computeBlock(amrap, config).hardSets.byPattern.hinge).toEqual({ value: 6, confidence: "estimated" });
  });
});

describe("quantities (calc spec §4.1, §5)", () => {
  const every = (items: Item[]) => computeBlock(block({ intent: "strength", format: "every", params: { interval_s: 60, rounds: 3 }, items }), config);

  it("rep ranges use the midpoint, as an estimate", () => {
    expect(every([item("Push-up", { type: "reps_range", min: 8, max: 12 })]).exposure.reps.h_push).toEqual({ value: 30, confidence: "estimated" });
  });

  it("rep schemes are summed (21-15-9 = 45), exactly", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "for_time", params: { rounds: 1 },
      items: [item("Thruster", { type: "reps_scheme", scheme: [21, 15, 9] })] }), config);
    expect(r.exposure.reps.squat?.value).toBeCloseTo(27, 6);
    expect(r.exposure.reps.v_push?.value).toBeCloseTo(18, 6);
    expect(r.exposure.reps.squat?.confidence).toBe("exact");
  });

  it("unilateral 8/8 = 8 reps of exposure and one set per round; 16 reps are lifted", () => {
    const r = every([item("Single-arm dumbbell row", { type: "reps_per_side", value: 8 }, { load: { type: "absolute_kg", rx: [20] } })]);
    expect(r.exposure.reps.h_pull).toEqual({ value: 24, confidence: "exact" });
    expect(r.hardSets.byPattern.h_pull).toEqual({ value: 3, confidence: "exact" });
    expect(r.volumeLoadKg).toEqual({ value: 3 * 16 * 20, confidence: "exact" });
  });

  it("calories: a single value is exact, a range uses the midpoint", () => {
    const r = every([item("Air bike", { type: "calories", min: 10, max: 10 })]);
    expect(r.monostructural.bike?.calories).toEqual({ value: 30, confidence: "exact" });
    const range = every([item("Air bike", { type: "calories", min: 8, max: 12 })]);
    expect(range.monostructural.bike?.calories).toEqual({ value: 30, confidence: "estimated" });
  });

  it("carries count exposure in metres and holds in seconds, not reps", () => {
    const r = every([item("Farmer carry", { type: "distance_m", value: 40 }), item("Plank", { type: "time_s", value: 30 })]);
    expect(r.exposure.distanceM.carry).toEqual({ value: 120, confidence: "exact" });
    expect(r.exposure.timeSec.core).toEqual({ value: 90, confidence: "exact" });
    expect(r.exposure.reps).toEqual({});
  });
});

describe("volume load (calc spec §9.6, §9.8)", () => {
  const sets = (extra: Partial<Item>) =>
    computeBlock(block({ intent: "strength", format: "sets", params: { sets: 3, rest_s: 60 },
      items: [item("Dumbbell thruster", { type: "reps", value: 10 }, extra)] }), config);

  it("uses the first Rx, per implement × the exercise's implement count", () => {
    expect(sets({ load: { type: "absolute_kg", rx: [22.5, 15] } }).volumeLoadKg).toEqual({ value: 3 * 10 * 22.5 * 2, confidence: "exact" });
  });

  it("a line can override the implement count (single-DB thruster)", () => {
    expect(sets({ load: { type: "absolute_kg", rx: [22.5] }, implementCount: 1 }).volumeLoadKg?.value).toBe(675);
  });

  it("percent of 1RM gives an intensity zone, never kg", () => {
    const r = sets({ load: { type: "percent_1rm", min: 70, max: 75 } });
    expect(r.volumeLoadKg).toBeNull();
    expect(r.intensityZones).toEqual([expect.objectContaining({ minPercent: 70, maxPercent: 75 })]);
  });
});

describe("durations and rounds per format (calc spec §4.3)", () => {
  it("every: interval × rounds, exact", () => {
    const r = computeBlock(block({ intent: "strength", format: "every", params: { interval_s: 120, rounds: 6 }, items: [] }), config);
    expect(r.durationMin).toEqual({ value: 12, confidence: "exact" });
  });

  it("sets: sets × (work + rest), estimated; strength rest defaults to 120 s", () => {
    const r = computeBlock(block({ intent: "strength", format: "sets", params: { sets: 5 },
      items: [item("Back squat", { type: "reps", value: 5 })] }), config);
    expect(r.durationMin).toEqual({ value: (5 * (5 * 2 + 120)) / 60, confidence: "estimated" });
  });

  it("intervals: rounds × stations × (work + rest) + rest between rounds, exact", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "intervals",
      params: { rounds: 3, stations: 2, work_s: 40, rest_s: 20, rest_between_rounds_s: 60 }, items: [] }), config);
    expect(r.durationMin).toEqual({ value: (3 * 2 * 60 + 2 * 60) / 60, confidence: "exact" });
  });

  it("tabata: 8 × 20/10 = 4 min; several exercises alternate rounds", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "tabata", params: { rounds: 8, work_s: 20, rest_s: 10 },
      items: [item("Air squat", { type: "max_effort", unit: "reps" }), item("Push-up", { type: "max_effort", unit: "reps" })] }), config);
    expect(r.durationMin).toEqual({ value: 4, confidence: "exact" });
    // 4 rounds each, 20 s ÷ 2 s per rep = 10 reps a round.
    expect(r.exposure.reps.squat).toEqual({ value: 40, confidence: "estimated" });
    expect(r.exposure.reps.h_push).toEqual({ value: 40, confidence: "estimated" });
  });

  it("AMRAP: rounds = time ÷ (paces + transitions); completed rounds count as sets", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "amrap", params: { time_s: 300 }, loadEffort: "moderate",
      items: [item("Kettlebell swing", { type: "reps", value: 10 }), item("Push-up", { type: "reps", value: 10 })] }), config);
    // Round = 10 × 2 s + 10 × 2 s + 2 × 5 s = 50 s → 6 rounds.
    expect(r.rounds).toEqual({ value: 6, confidence: "estimated" });
    expect(r.hardSets.byPattern.hinge).toEqual({ value: 6, confidence: "estimated" });
  });

  it("AMRAP: the coach's target rounds override the pace estimate", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "amrap", params: { time_s: 300 }, targetRounds: 4,
      items: [item("Kettlebell swing", { type: "reps", value: 10 })] }), config);
    expect(r.rounds).toEqual({ value: 4, confidence: "estimated" });
    expect(r.exposure.reps.hinge?.value).toBe(40);
  });

  it("for time: sum of paces, capped at the time cap", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "for_time", params: { rounds: 1, time_cap_s: 120 },
      items: [item("Burpee", { type: "reps", value: 100 })] }), config);
    expect(r.capped).toBe(true);
    expect(r.durationMin).toEqual({ value: 2, confidence: "estimated" });
  });

  it("pace effort scales the pace by the configured factor", () => {
    const slow: EngineConfig = { ...config, paceEffortFactor: { ...config.paceEffortFactor, easy: 1.5 } };
    const b = block({ intent: "conditioning", format: "for_time", params: { rounds: 1 }, paceEffort: "easy",
      items: [item("Burpee", { type: "reps", value: 30 })] });
    expect(computeBlock(b, config).durationMin?.value).toBeCloseTo(1, 6);
    expect(computeBlock(b, slow).durationMin?.value).toBeCloseTo(1.5, 6);
  });
});

describe("gaps are reported, never guessed", () => {
  it("unmatched lines are skipped with a warning", () => {
    const r = computeWorkout({ blocks: [block({ label: "A", intent: "conditioning", format: "every", params: { interval_s: 60, rounds: 2 },
      items: [{ exercise: null, rawLine: "mystery move", quantity: { type: "reps", value: 5 } }] })] }, config);
    expect(r.warnings).toEqual(['A: unmatched line skipped: "mystery move"']);
  });

  it("a missing pace leaves the duration unknown instead of inventing one", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "for_time", params: { rounds: 1 },
      items: [{ exercise: coreExercise("Burpee", null), quantity: { type: "reps", value: 50 } }] }), config);
    expect(r.durationMin).toBeNull();
    expect(r.sRpe).toBeNull();
    expect(r.warnings).toEqual(["no pace for Burpee; duration cannot be estimated"]);
  });
});

describe("balance ratios (calc spec Lens 2)", () => {
  it("push:pull, knee:hip, upper:lower from exposure reps; null when a side is empty", () => {
    const e = (value: number) => ({ value, confidence: "exact" as const });
    const ratios = computeRatios({ h_push: e(30), v_push: e(10), h_pull: e(20), squat: e(50), lunge: e(10), hinge: e(20) });
    expect(ratios.pushPull?.value).toBe(2);
    expect(ratios.kneeHip?.value).toBe(3);
    expect(ratios.upperLower?.value).toBeCloseTo(60 / 80, 6);
    expect(computeRatios({ squat: e(10) }).kneeHip).toBeNull();
  });
});

describe("paces (calc spec §9.5)", () => {
  it("reads stored JSON, ignores junk, and round-trips", () => {
    expect(paceFromJson({ sec_per_rep: 2, sec_per_m: 0.25, other: 1 })).toEqual({ secPerRep: 2, secPerM: 0.25 });
    expect(paceFromJson({ sec_per_rep: -1 })).toBeNull();
    expect(paceFromJson("fast")).toBeNull();
    expect(paceToJson({ secPerCal: 4.5 })).toEqual({ sec_per_cal: 4.5 });
  });

  it("a gym's override replaces the core default", () => {
    expect(resolvePace({ secPerRep: 2 }, { secPerRep: 3 })).toEqual({ secPerRep: 3 });
    expect(resolvePace({ secPerRep: 2 }, null)).toEqual({ secPerRep: 2 });
  });
});

describe("weekly load (calc spec Lens 4)", () => {
  it("total, monotony (mean ÷ SD of daily load) and strain (load × monotony)", () => {
    const week = weekSummary([{ date: "2026-10-19", sRpe: 300 }, { date: "2026-10-19", sRpe: 100 }, { date: "2026-10-22", sRpe: 300 }], "2026-10-19");
    expect(week.dailyLoad).toEqual([400, 0, 0, 300, 0, 0, 0]);
    expect(week.total).toBe(700);
    expect(week.mean).toBe(100);
    const sd = Math.sqrt((300 ** 2 + 200 ** 2 + 5 * 100 ** 2) / 7);
    expect(week.sd).toBeCloseTo(sd, 9);
    expect(week.monotony).toBeCloseTo(100 / sd, 9);
    expect(week.strain).toBeCloseTo(700 * (100 / sd), 9);
  });

  it("monotony is undefined when every day is the same; sessions outside the week are ignored", () => {
    const flat = weekSummary(Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${19 + i}`, sRpe: 100 })), "2026-10-19");
    expect(flat.monotony).toBeNull();
    expect(weekSummary([{ date: "2026-10-26", sRpe: 500 }], "2026-10-19").total).toBe(0);
  });

  it("week-on-week change", () => {
    expect(weekOnWeekChange(660, 600)).toBeCloseTo(0.1, 9);
    expect(weekOnWeekChange(500, 0)).toBeNull();
  });
});
