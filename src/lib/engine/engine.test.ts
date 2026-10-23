// One test per calculation rule (calc spec §4–§6). Most tests use the neutral
// config (no effort scaling, fatigue or band) so each rule shows on its own;
// the "pace model" tests use the approved ENGINE_CONFIG. Paces here are simple
// test numbers.

import { describe, expect, it } from "vitest";

import { ENGINE_CONFIG, fatigueFactor } from "@/lib/engine/config";
import { countsAsHardSet, defaultEfforts, resolveBlockEffort } from "@/lib/engine/effort";
import { NEUTRAL_CONFIG, coreExercise } from "@/lib/engine/fixtures/worked-wods";
import { estimated, exact } from "@/lib/engine/measure";
import { paceFromJson, paceToJson, resolvePace } from "@/lib/engine/pace";
import type { Block, EngineConfig, Item, Measure } from "@/lib/engine/types";
import { weekOnWeekChange, weekSummary } from "@/lib/engine/weekly";
import { computeBlock, computeRatios, computeWorkout } from "@/lib/engine/workout";

const config = NEUTRAL_CONFIG;
const item = (name: string, quantity: Item["quantity"], extra: Partial<Item> = {}): Item => ({
  exercise: coreExercise(name, { secPerRep: 2, secPerM: 0.5, secPerCal: 4 }),
  quantity,
  ...extra,
});
const block = (b: Omit<Block, "label"> & { label?: string }): Block => ({ label: "X", ...b }) as Block;

function expectRange(m: Measure | null | undefined, low: number, mid: number, high: number) {
  expect(m?.confidence).toBe("estimated");
  expect(m?.low).toBeCloseTo(low, 6);
  expect(m?.mid).toBeCloseTo(mid, 6);
  expect(m?.high).toBeCloseTo(high, 6);
}

describe("effort (calc spec §4.4, §9.4)", () => {
  it("uses the default efforts when the coach sets nothing", () => {
    expect(defaultEfforts({ intent: "strength", format: "sets" })).toEqual({ pace: "easy", load: "hard" });
    expect(defaultEfforts({ intent: "conditioning", format: "amrap" })).toEqual({ pace: "moderate", load: null });
    expect(defaultEfforts({ intent: "conditioning", format: "intervals" })).toEqual({ pace: "moderate", load: null });
    expect(defaultEfforts({ intent: "conditioning", format: "for_time" })).toEqual({ pace: "hard", load: null });
    // Approved 2026-10-21: tabata and EMOM like intervals; skill and mobility easy.
    expect(defaultEfforts({ intent: "conditioning", format: "tabata" })).toEqual({ pace: "moderate", load: null });
    expect(defaultEfforts({ intent: "conditioning", format: "every" })).toEqual({ pace: "moderate", load: null });
    expect(defaultEfforts({ intent: "skill", format: "every" })).toEqual({ pace: "easy", load: null });
    expect(defaultEfforts({ intent: "mobility", format: "sets" })).toEqual({ pace: "easy", load: null });
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
    expect(computeBlock(amrap, config).hardSets.byPattern.hinge).toEqual(estimated(6));
  });
});

describe("quantities (calc spec §4.1, §5)", () => {
  const every = (items: Item[]) => computeBlock(block({ intent: "strength", format: "every", params: { interval_s: 60, rounds: 3 }, items }), config);

  it("rep ranges are an estimate from min to max, middle = midpoint", () => {
    expect(every([item("Push-up", { type: "reps_range", min: 8, max: 12 })]).exposure.reps.h_push).toEqual(estimated(30, 24, 36));
  });

  it("rep schemes are summed (21-15-9 = 45), exactly", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "for_time", params: { rounds: 1 },
      items: [item("Thruster", { type: "reps_scheme", scheme: [21, 15, 9] })] }), config);
    expect(r.exposure.reps.squat?.mid).toBeCloseTo(27, 6);
    expect(r.exposure.reps.v_push?.mid).toBeCloseTo(18, 6);
    expect(r.exposure.reps.squat?.confidence).toBe("exact");
  });

  it("unilateral 8/8 = 8 reps of exposure and one set per round; 16 reps are lifted", () => {
    const r = every([item("Single-arm dumbbell row", { type: "reps_per_side", value: 8 }, { load: { type: "absolute_kg", rx: [20] } })]);
    expect(r.exposure.reps.h_pull).toEqual(exact(24));
    expect(r.hardSets.byPattern.h_pull).toEqual(exact(3));
    expect(r.volumeLoadKg).toEqual(exact(3 * 16 * 20));
  });

  it("calories: a single value is exact, a range is an estimate", () => {
    expect(every([item("Air bike", { type: "calories", min: 10, max: 10 })]).monostructural.bike?.calories).toEqual(exact(30));
    expect(every([item("Air bike", { type: "calories", min: 8, max: 12 })]).monostructural.bike?.calories).toEqual(estimated(30, 24, 36));
  });

  it("carries count exposure in metres and holds in seconds, not reps", () => {
    const r = every([item("Farmer carry", { type: "distance_m", value: 40 }), item("Plank", { type: "time_s", value: 30 })]);
    expect(r.exposure.distanceM.carry).toEqual(exact(120));
    expect(r.exposure.timeSec.core).toEqual(exact(90));
    expect(r.exposure.reps).toEqual({});
  });
});

describe("volume load (calc spec §9.6, §9.8)", () => {
  const sets = (extra: Partial<Item>) =>
    computeBlock(block({ intent: "strength", format: "sets", params: { sets: 3, rest_s: 60 },
      items: [item("Dumbbell thruster", { type: "reps", value: 10 }, extra)] }), config);

  it("uses the first Rx, per implement × the exercise's implement count", () => {
    expect(sets({ load: { type: "absolute_kg", rx: [22.5, 15] } }).volumeLoadKg).toEqual(exact(3 * 10 * 22.5 * 2));
  });

  it("a line can override the implement count (single-DB thruster)", () => {
    expect(sets({ load: { type: "absolute_kg", rx: [22.5] }, implementCount: 1 }).volumeLoadKg?.mid).toBe(675);
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
    expect(r.durationMin).toEqual(exact(12));
  });

  it("sets: sets × (work + rest), estimated; strength rest defaults to 120 s", () => {
    const r = computeBlock(block({ intent: "strength", format: "sets", params: { sets: 5 },
      items: [item("Back squat", { type: "reps", value: 5 })] }), config);
    expect(r.durationMin).toEqual(estimated((5 * (5 * 2 + 120)) / 60));
  });

  it("intervals: rounds × stations × (work + rest) + rest between rounds, exact", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "intervals",
      params: { rounds: 3, stations: 2, work_s: 40, rest_s: 20, rest_between_rounds_s: 60 }, items: [] }), config);
    expect(r.durationMin).toEqual(exact((3 * 2 * 60 + 2 * 60) / 60));
  });

  it("tabata: 8 × 20/10 = 4 min; several exercises alternate rounds", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "tabata", params: { rounds: 8, work_s: 20, rest_s: 10 },
      items: [item("Air squat", { type: "max_effort", unit: "reps" }), item("Push-up", { type: "max_effort", unit: "reps" })] }), config);
    expect(r.durationMin).toEqual(exact(4));
    // 4 rounds each, 20 s ÷ 2 s per rep = 10 reps a round.
    expect(r.exposure.reps.squat).toEqual(estimated(40));
    expect(r.exposure.reps.h_push).toEqual(estimated(40));
  });

  it("alternating EMOM: ordered slots take turns for the total intervals; the last rotation may be partial (approved 2026-10-21)", () => {
    // "EMOM 12: min 1: 10 cal row + 5 burpees, min 2: 12 wall balls"
    const row = coreExercise("Row", { secPerCal: 4 });
    const lines: Item[] = [
      { exercise: row, quantity: { type: "calories", min: 10, max: 10 }, slot: 1 },
      item("Burpee", { type: "reps", value: 5 }, { slot: 1 }),
      item("Wall ball", { type: "reps", value: 12 }, { slot: 2 }),
    ];
    const emom = (rounds: number, alternating: boolean, items = lines) =>
      computeBlock(block({ intent: "conditioning", format: "every", params: { interval_s: 60, rounds, alternating }, items }), config);

    // 12 minutes; each minute's lines are done 6 times.
    const r = emom(12, true);
    expect(r.durationMin).toEqual(exact(12));
    expect(r.monostructural.row?.calories).toEqual(exact(60));
    expect(r.exposure.reps.squat?.mid).toBeCloseTo(6 * 12 * 0.6, 6); // wall ball: squat 0.6
    expect(r.issues).toEqual([]);

    // Not alternating: every line in every one of 12 intervals.
    expect(emom(12, false, lines.map((l) => ({ ...l, slot: null }))).monostructural.row?.calories).toEqual(exact(120));

    // EMOM 10 with 3 minutes: 3 rotations and minute 1 once more → 4, 3, 3.
    const three: Item[] = [
      item("Air squat", { type: "reps", value: 15 }, { slot: 1 }),
      item("Push-up", { type: "reps", value: 10 }, { slot: 2 }),
      item("Kettlebell swing", { type: "reps", value: 12 }, { slot: 3 }),
    ];
    const ten = emom(10, true, three);
    expect(ten.durationMin).toEqual(exact(10));
    expect(ten.exposure.reps.squat).toEqual(exact(4 * 15));
    expect(ten.exposure.reps.h_push).toEqual(exact(3 * 10));
    expect(ten.exposure.reps.hinge).toEqual(exact(3 * 12));

    // Lines without a slot are a minute each, after the numbered ones.
    const unslotted = emom(6, true, three.map((l) => ({ ...l, slot: null })));
    expect(unslotted.exposure.reps.squat).toEqual(exact(2 * 15));
  });

  it("issues point at the lines they are about", () => {
    const r = computeWorkout({ blocks: [block({ label: "A", intent: "conditioning", format: "for_time", params: { rounds: 1 },
      paceEffort: "hard", items: [
        item("Air squat", { type: "reps", value: 10 }),
        { exercise: null, rawLine: "mystery move", quantity: { type: "reps", value: 5 } },
        { exercise: coreExercise("Burpee", null), quantity: { type: "reps", value: 10 } },
      ] })] }, config);
    expect(r.issues).toEqual([
      { block: 0, items: [1], message: 'unmatched line skipped: "mystery move"' },
      { block: 0, items: [2], message: "no pace for Burpee; duration cannot be estimated" },
    ]);
  });

  it("rest between blocks counts in the session length, never in planned load (approved 2026-10-21)", () => {
    const a = block({ label: "A", intent: "strength", format: "every", params: { interval_s: 60, rounds: 10 },
      paceEffort: "hard", restAfterSec: 300, items: [] });
    const b = block({ label: "B", intent: "conditioning", format: "amrap", params: { time_s: 600 },
      paceEffort: "hard", restAfterSec: 600, items: [] });
    const withRest = computeWorkout({ blocks: [a, b] }, config);
    const without = computeWorkout({ blocks: [{ ...a, restAfterSec: null }, b] }, config);

    expect(withRest.durationMin).toEqual(exact(20));
    // 20 min of blocks + 5 min between them; rest after the last block is not counted.
    expect(withRest.sessionMin).toEqual(exact(25));
    expect(without.sessionMin).toEqual(exact(20));
    expect(withRest.sRpe).toEqual(without.sRpe);

    // Unknown block duration: no session length either.
    const unknown = computeWorkout({ blocks: [block({ label: "A", intent: "conditioning", format: "for_time", params: { rounds: 1 },
      items: [{ exercise: coreExercise("Air squat", null), quantity: { type: "reps", value: 50 } }] }), b] }, config);
    expect(unknown.sessionMin).toBeNull();
  });

  it("AMRAP: rounds = time ÷ (paces + transitions); completed rounds count as sets", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "amrap", params: { time_s: 300 }, loadEffort: "moderate",
      items: [item("Kettlebell swing", { type: "reps", value: 10 }), item("Push-up", { type: "reps", value: 10 })] }), config);
    // Round = 10 × 2 s + 10 × 2 s + 2 × 5 s = 50 s → 6 rounds.
    expect(r.rounds).toEqual(estimated(6));
    expect(r.hardSets.byPattern.hinge).toEqual(estimated(6));
  });

  it("AMRAP: the coach's target rounds override the pace estimate", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "amrap", params: { time_s: 300 }, targetRounds: 4,
      items: [item("Kettlebell swing", { type: "reps", value: 10 })] }), config);
    expect(r.rounds).toEqual(estimated(4));
    expect(r.exposure.reps.hinge?.mid).toBe(40);
  });

  it("for time: sum of paces, capped at the time cap", () => {
    const r = computeBlock(block({ intent: "conditioning", format: "for_time", params: { rounds: 1, time_cap_s: 120 },
      items: [item("Burpee", { type: "reps", value: 100 })] }), config);
    expect(r.capped).toBe(true);
    expect(r.durationMin).toEqual(estimated(2));
  });
});

describe("pace model (approved 2026-10-21, calc spec §5)", () => {
  const forTime = (reps: number, paceEffort: Block["paceEffort"] = "hard", c: EngineConfig = ENGINE_CONFIG) =>
    computeBlock(block({ intent: "conditioning", format: "for_time", params: { rounds: 1 }, paceEffort,
      items: [item("Burpee", { type: "reps", value: reps })] }), c);

  it("the approved rules", () => {
    expect(ENGINE_CONFIG.paceEffortFactor).toEqual({ easy: 1.4, moderate: 1.15, hard: 1, max: 0.9 });
    expect(ENGINE_CONFIG.paceBand).toEqual({ fast: 0.85, slow: 1.2 });
    expect([9.99, 10, 15, 20, 20.01, 40].map((m) => fatigueFactor(m, ENGINE_CONFIG))).toEqual([1, 1.1, 1.1, 1.1, 1.2, 1.2]);
  });

  it("every estimate is a range: fast = pace × 0.85, slow = pace × 1.2", () => {
    // 30 burpees × 2 s = 60 s (Pace Hard, under 10 min: no fatigue).
    expectRange(forTime(30).durationMin, 0.85, 1, 1.2);
  });

  it("pace effort scales the pace: Easy ×1.4 … Max ×0.9", () => {
    expect(forTime(30, "easy").durationMin?.mid).toBeCloseTo(1.4, 6);
    expect(forTime(30, "moderate").durationMin?.mid).toBeCloseTo(1.15, 6);
    expect(forTime(30, "max").durationMin?.mid).toBeCloseTo(0.9, 6);
  });

  it("for time: fatigue is chosen from the estimate before fatigue", () => {
    // 285 burpees = 9.5 min → under 10 min, no fatigue.
    expect(forTime(285).durationMin?.mid).toBeCloseTo(9.5, 6);
    // 300 burpees = 10 min → 10–20 min band, ×1.1 → 11 min.
    expect(forTime(300).durationMin?.mid).toBeCloseTo(11, 6);
    // 660 burpees = 22 min → over 20 min, ×1.2 → 26.4 min.
    expect(forTime(660).durationMin?.mid).toBeCloseTo(26.4, 6);
  });

  it("AMRAP: fatigue by the AMRAP's length", () => {
    const amrap = (minutes: number) => computeBlock(block({ intent: "conditioning", format: "amrap", params: { time_s: minutes * 60 },
      paceEffort: "hard", items: [item("Burpee", { type: "reps", value: 10 })] }), ENGINE_CONFIG);
    // Round = 10 × 2 s × fatigue + 5 s transition.
    expect(amrap(8).rounds?.mid).toBeCloseTo(480 / 25, 6);
    expect(amrap(12).rounds?.mid).toBeCloseTo(720 / 27, 6);
    expect(amrap(25).rounds?.mid).toBeCloseTo(1500 / 29, 6);
    const r = amrap(12).rounds;
    expectRange(r, 720 / (20 * 1.1 * 1.2 + 5), 720 / 27, 720 / (20 * 1.1 * 0.85 + 5));
  });

  it("max effort in an intervals block: fatigue by the block's total work time", () => {
    const intervals = (rounds: number) => computeBlock(block({ intent: "conditioning", format: "intervals", paceEffort: "hard",
      params: { rounds, stations: 2, work_s: 60, rest_s: 30 },
      items: [item("Air bike", { type: "max_effort", unit: "calories" }), item("Burpee", { type: "max_effort", unit: "reps" })] }), ENGINE_CONFIG);
    // 4 × 2 × 60 s = 8 min of work → ×1.0; 6 × 2 × 60 s = 12 min → ×1.1, even though each window is 60 s.
    expect(intervals(4).monostructural.bike?.calories?.mid).toBeCloseTo(4 * (60 / 4), 6);
    expect(intervals(6).monostructural.bike?.calories?.mid).toBeCloseTo(6 * (60 / (4 * 1.1)), 6);
  });

  it("max effort in an EMOM or tabata: fatigue by the block's total work time", () => {
    const emom = (rounds: number) => computeBlock(block({ intent: "conditioning", format: "every", paceEffort: "hard",
      params: { interval_s: 60, rounds }, items: [item("Air bike", { type: "max_effort", unit: "calories" })] }), ENGINE_CONFIG);
    // EMOM 8 → 8 min → ×1.0; EMOM 15 → 15 min → ×1.1; EMOM 24 → 24 min → ×1.2.
    expect(emom(8).monostructural.bike?.calories?.mid).toBeCloseTo(8 * (60 / 4), 6);
    expect(emom(15).monostructural.bike?.calories?.mid).toBeCloseTo(15 * (60 / (4 * 1.1)), 6);
    expect(emom(24).monostructural.bike?.calories?.mid).toBeCloseTo(24 * (60 / (4 * 1.2)), 6);
    // Tabata 8 × 20 s = 160 s of work → ×1.0.
    const tabata = computeBlock(block({ intent: "conditioning", format: "tabata", paceEffort: "hard",
      params: { rounds: 8, work_s: 20, rest_s: 10 }, items: [item("Air bike", { type: "max_effort", unit: "calories" })] }), ENGINE_CONFIG);
    expect(tabata.monostructural.bike?.calories?.mid).toBeCloseTo(8 * (20 / 4), 6);
  });

  it("max effort elsewhere: fatigue by the window", () => {
    const maxCal = (seconds: number) => computeBlock(block({ intent: "conditioning", format: "amrap", params: { time_s: seconds },
      paceEffort: "hard", items: [item("Air bike", { type: "max_effort", unit: "calories" })] }), ENGINE_CONFIG);
    expect(maxCal(90).monostructural.bike?.calories?.mid).toBeCloseTo(90 / 4, 6);
    expect(maxCal(720).monostructural.bike?.calories?.mid).toBeCloseTo(720 / (4 * 1.1), 6);
    expectRange(maxCal(90).monostructural.bike?.calories, 90 / (4 * 1.2), 90 / 4, 90 / (4 * 0.85));
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
    const ratios = computeRatios({ h_push: exact(30), v_push: exact(10), h_pull: exact(20), squat: exact(50), lunge: exact(10), hinge: exact(20) });
    expect(ratios.pushPull).toEqual(exact(2));
    expect(ratios.kneeHip).toEqual(exact(3));
    expect(ratios.upperLower?.mid).toBeCloseTo(60 / 80, 6);
    expect(computeRatios({ squat: exact(10) }).kneeHip).toBeNull();
  });

  it("ratios of estimates are ranges: lowest = lowest top ÷ highest bottom", () => {
    expectRange(computeRatios({ h_push: estimated(36, 32, 40), h_pull: exact(32) }).pushPull, 1, 36 / 32, 1.25);
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
    const week = weekSummary(
      [{ date: "2026-10-19", sRpe: exact(300) }, { date: "2026-10-19", sRpe: exact(100) }, { date: "2026-10-22", sRpe: exact(300) }],
      "2026-10-19",
    );
    expect(week.dailyLoad).toEqual([400, 0, 0, 300, 0, 0, 0]);
    expect(week.total).toEqual(exact(700));
    expect(week.mean).toBe(100);
    const sd = Math.sqrt((300 ** 2 + 200 ** 2 + 5 * 100 ** 2) / 7);
    expect(week.sd).toBeCloseTo(sd, 9);
    expect(week.monotony).toBeCloseTo(100 / sd, 9);
    expect(week.strain).toBeCloseTo(700 * (100 / sd), 9);
  });

  it("the weekly total carries the sessions' ranges", () => {
    const week = weekSummary([{ date: "2026-10-20", sRpe: estimated(100, 90, 120) }, { date: "2026-10-21", sRpe: exact(50) }], "2026-10-19");
    expect(week.total).toEqual(estimated(150, 140, 170));
  });

  it("monotony is undefined when every day is the same; sessions outside the week are ignored", () => {
    const flat = weekSummary(Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${19 + i}`, sRpe: exact(100) })), "2026-10-19");
    expect(flat.monotony).toBeNull();
    expect(weekSummary([{ date: "2026-10-26", sRpe: exact(500) }], "2026-10-19").total).toEqual(exact(0));
  });

  it("week-on-week change", () => {
    expect(weekOnWeekChange(660, 600)).toBeCloseTo(0.1, 9);
    expect(weekOnWeekChange(500, 0)).toBeNull();
  });
});

describe("partner blocks (calc spec §4.5, decided 2026-10-23): numbers per athlete", () => {
  // Air squat 2 s a rep (test pace): 10 rounds of 20 = 200 reps = 400 s alone.
  const forTime = (partner: Block["partner"], extra: { time_cap_s?: number } = {}) =>
    computeBlock(block({ intent: "conditioning", format: "for_time", params: { rounds: 10, ...extra }, paceEffort: "hard", partner,
      items: [item("Air squat", { type: "reps", value: 20 }, { loadEffort: "moderate" })] }), config);
  const alone = forTime(null);

  it("split the reps at will: each athlete does half; the team works through the whole amount", () => {
    const split = forTime("split");
    expect(split.exposure.reps.squat?.mid).toBeCloseTo(alone.exposure.reps.squat!.mid / 2, 6);
    expect(split.exposure.reps.squat?.confidence).toBe("estimated");
    expect(split.hardSets.byPattern.squat?.mid).toBeCloseTo(5, 6);
    expect(split.durationMin).toEqual(alone.durationMin);
    // Planned load: the work's effort over the whole block, rest while the partner works included.
    expect(split.sRpe).toEqual(alone.sRpe);
    expect(split.rounds).toEqual(alone.rounds);
  });

  it("I go, you go: each athlete half the team's work, the block as long as the team takes", () => {
    const alternate = forTime("alternate");
    expect(alternate.exposure.reps.squat?.mid).toBeCloseTo(100, 6);
    expect(alternate.durationMin).toEqual(alone.durationMin);
  });

  it("an AMRAP: the team's rounds are estimated and each athlete gets half of them", () => {
    const amrap = (partner: Block["partner"]) =>
      computeBlock(block({ intent: "conditioning", format: "amrap", params: { time_s: 600 }, paceEffort: "hard", partner,
        items: [item("Air squat", { type: "reps", value: 10 })] }), config);
    const team = amrap("alternate");
    expect(team.rounds).toEqual(amrap(null).rounds);
    expect(team.exposure.reps.squat?.mid).toBeCloseTo(amrap(null).exposure.reps.squat!.mid / 2, 6);
    expect(team.durationMin?.mid).toBeCloseTo(10, 6);
    // Time-bound: "each" cannot make an AMRAP longer, so it counts as I go, you go.
    expect(amrap("each").exposure.reps.squat?.mid).toBeCloseTo(team.exposure.reps.squat!.mid, 6);
    expect(amrap("each").durationMin?.mid).toBeCloseTo(10, 6);
  });

  it("amounts written for each athlete: each does the full amount and the block takes about twice as long", () => {
    const each = forTime("each");
    expect(each.exposure.reps.squat).toEqual(alone.exposure.reps.squat);
    expect(each.hardSets.byPattern.squat).toEqual(alone.hardSets.byPattern.squat);
    expect(each.durationMin?.mid).toBeCloseTo(alone.durationMin!.mid * 2, 6);
    expect(each.sRpe?.mid).toBeCloseTo(alone.sRpe!.mid * 2, 6);
    // A time cap still caps the block.
    const capped = forTime("each", { time_cap_s: 600 });
    expect(capped.capped).toBe(true);
    expect(capped.durationMin?.mid).toBeCloseTo(10, 6);
  });

  it("an EMOM taken in turns: half the intervals each, on the same clock; with each, twice the clock", () => {
    const emom = (partner: Block["partner"]) =>
      computeBlock(block({ intent: "conditioning", format: "every", params: { interval_s: 60, rounds: 10 }, paceEffort: "moderate", partner,
        items: [item("Air squat", { type: "reps", value: 8 })] }), config);
    expect(emom("alternate").exposure.reps.squat?.mid).toBeCloseTo(emom(null).exposure.reps.squat!.mid / 2, 6);
    expect(emom("alternate").durationMin).toEqual(exact(10));
    expect(emom("each").durationMin).toEqual(exact(20));
    expect(emom("each").exposure.reps.squat).toEqual(emom(null).exposure.reps.squat);
  });
});
