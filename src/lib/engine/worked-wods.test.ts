// Calc spec §7: the three worked WODs are the engine's acceptance tests, with
// the approved paces (docs/pace-defaults.md) and rules (ENGINE_CONFIG).
// Expected numbers are written as the arithmetic behind them; §7 shows the
// same numbers. Change a pace or rule and these fail until §7 is updated.

import { describe, expect, it } from "vitest";

import { ENGINE_CONFIG } from "@/lib/engine/config";
import { WOD_1, WOD_2, WOD_3 } from "@/lib/engine/fixtures/worked-wods";
import type { Block, Measure } from "@/lib/engine/types";
import { weekSummary } from "@/lib/engine/weekly";
import { computeBlock, computeRatios, computeWorkout, sumLenses } from "@/lib/engine/workout";

const FAST = 0.85;
const SLOW = 1.2;

function expectExact(measure: Measure | null | undefined, value: number) {
  expect(measure?.confidence).toBe("exact");
  expect(measure?.mid).toBeCloseTo(value, 6);
}

function expectRange(measure: Measure | null | undefined, low: number, mid: number, high: number) {
  expect(measure?.confidence).toBe("estimated");
  expect(measure?.low).toBeCloseTo(low, 6);
  expect(measure?.mid).toBeCloseTo(mid, 6);
  expect(measure?.high).toBeCloseTo(high, 6);
}

const wod1 = computeWorkout(WOD_1, ENGINE_CONFIG);
const wod2 = computeWorkout(WOD_2, ENGINE_CONFIG);
const wod3 = computeWorkout(WOD_3, ENGINE_CONFIG);

describe("WOD 1 — strength + accessory + AMRAP", () => {
  const [a, b, c] = wod1.blocks;

  it("A. E3M×5: 5 back squat @75–80%, Load Moderate → 15 min × RPE 6 = 90 AU; 5 hard sets squat, 25 reps", () => {
    expectExact(a?.durationMin, 15);
    expect(a?.plannedRpe).toBe(6);
    expectExact(a?.sRpe, 90);
    expectExact(a?.hardSets.byPattern.squat, 5);
    expectExact(a?.exposure.reps.squat, 25);
    expect(a?.intensityZones).toEqual([expect.objectContaining({ exercise: "Back squat", minPercent: 75, maxPercent: 80 })]);
  });

  it("B. E2M×4: 8–10 DB bench, 8/8 SA DB row → 48 AU; 4 hard sets each; 32–40 and 32 reps", () => {
    expectExact(b?.sRpe, 48);
    expectExact(b?.hardSets.byPattern.h_push, 4);
    expectExact(b?.hardSets.byPattern.h_pull, 4);
    expectRange(b?.exposure.reps.h_push, 32, 36, 40);
    expectExact(b?.exposure.reps.h_pull, 32);
  });

  it("C. AMRAP 8: 5 KB swing, 10 air squat, 15 DU, Pace Hard → ~7.7 rounds (6.7–8.7)", () => {
    // Round at Pace Hard, under 10 min (no fatigue): 5 × 2.5 s + 10 × 2.0 s + 15 × 1.0 s = 47.5 s, plus 3 × 5 s transitions.
    const work = 5 * 2.5 + 10 * 2.0 + 15 * 1.0;
    const rounds = (factor: number) => 480 / (work * factor + 15);
    expectRange(c?.rounds, rounds(SLOW), rounds(1), rounds(FAST));
    expect(c?.rounds?.mid).toBeCloseTo(7.68, 2);
    expectRange(c?.exposure.reps.hinge, 5 * rounds(SLOW), 5 * rounds(1), 5 * rounds(FAST));
    expectRange(c?.exposure.reps.squat, 10 * rounds(SLOW), 10 * rounds(1), 10 * rounds(FAST));
    expectRange(c?.monostructural.jump_rope?.reps, 15 * rounds(SLOW), 15 * rounds(1), 15 * rounds(FAST));
    expectExact(c?.sRpe, 64);
    expect(c?.hardSets.byPattern).toEqual({});
  });

  it("session planned load: 90 + 48 + 64 = 202 AU, exact (all efforts set by the coach)", () => {
    expectExact(wod1.sRpe, 202);
    expect(wod1.warnings).toEqual([]);
  });
});

describe("WOD 2 — chipper, 25 min cap, Pace Hard", () => {
  // Paces: run 0.36 s/m, wall ball 3.5, DB snatch 3.0, T2B 4.5, box jump-over 4.5, burpee 5.0 s/rep, row 0.267 s/m.
  const work = 800 * 0.36 + 50 * 3.5 + 30 * 3.0 + 20 * 4.5 + 40 * 4.5 + 10 * 5.0 + 800 * 0.267;
  const transitions = 6 * 5;
  // Before fatigue: 1,116.6 s = 18.6 min → 10–20 min band → fatigue ×1.1.
  const finishMin = (factor: number) => (work * 1.1 * factor + transitions) / 60;

  it("finishes in ~20.4 min (17.4–24.4) → RPE 8 → ~163 AU (139–195), under the cap", () => {
    expect((work + transitions) / 60).toBeCloseTo(18.61, 2);
    expectRange(wod2.durationMin, finishMin(FAST), finishMin(1), finishMin(SLOW));
    expect(wod2.durationMin?.mid).toBeCloseTo(20.42, 2);
    expect(wod2.blocks[0]?.plannedRpe).toBe(8);
    expect(wod2.blocks[0]?.capped).toBe(false);
    expectRange(wod2.sRpe, 8 * finishMin(FAST), 8 * finishMin(1), 8 * finishMin(SLOW));
  });

  it("exposure (all exact): squat 30, v_push 20, jump 45, hinge 21, v_pull 15, core 14, h_push 5", () => {
    const expected = { squat: 30, v_push: 20, jump: 45, hinge: 21, v_pull: 15, core: 14, h_push: 5 };
    expect(Object.keys(wod2.exposure.reps).sort()).toEqual(Object.keys(expected).sort());
    for (const [pattern, reps] of Object.entries(expected)) {
      expectExact(wod2.exposure.reps[pattern as keyof typeof expected], reps);
    }
  });

  it("monostructural: run 800 m, row 800 m", () => {
    expectExact(wod2.monostructural.run?.distanceM, 800);
    expectExact(wod2.monostructural.row?.distanceM, 800);
  });

  it("volume load on the first Rx: wall ball 450 kg, DB snatch 675 kg", () => {
    const block = WOD_2.blocks[0] as Block;
    const only = (name: string) => computeBlock({ ...block, items: block.items.filter((i) => i.exercise?.name === name) }, ENGINE_CONFIG);
    expectExact(only("Wall ball").volumeLoadKg, 450);
    expectExact(only("Dumbbell snatch").volumeLoadKg, 675);
    expectExact(wod2.volumeLoadKg, 1125);
  });

  it("no hard sets: no load effort was set", () => {
    expect(wod2.hardSets.byPattern).toEqual({});
  });
});

describe("WOD 3 — intervals 4 × 3 stations, 90/30, 90 s between rounds, Pace Hard", () => {
  it("28.5 min block (18 min work), RPE 8 → 228 AU, exact", () => {
    expectExact(wod3.durationMin, 28.5);
    expectExact(wod3.sRpe, 228);
    expectExact(wod3.monostructural.row?.workSec, 360);
    expectExact(wod3.monostructural.bike?.workSec, 360);
  });

  it("max effort in 4 × 90 s windows; 18 min of total work → fatigue ×1.1: row ~1,226 m, bike ~65 cal, lunges ~109", () => {
    // Total work = 4 rounds × 3 stations × 90 s = 18 min → 10–20 min band → ×1.1 (Daniel, 2026-10-21).
    const perWindow = (secPerUnit: number, factor: number) => 4 * (90 / (secPerUnit * 1.1 * factor));
    expectRange(wod3.monostructural.row?.distanceM, perWindow(0.267, SLOW), perWindow(0.267, 1), perWindow(0.267, FAST));
    expectRange(wod3.monostructural.bike?.calories, perWindow(5.0, SLOW), perWindow(5.0, 1), perWindow(5.0, FAST));
    expectRange(wod3.exposure.reps.lunge, perWindow(3.0, SLOW), perWindow(3.0, 1), perWindow(3.0, FAST));
    expect(wod3.monostructural.row?.distanceM?.mid).toBeCloseTo(1225.7, 1);
  });
});

describe("an AMRAP's round, line by line (for results written as 7 + 12)", () => {
  it("WOD 1 C: 5 swings, 10 air squats, 15 double-unders, each with its estimated time", () => {
    const lines = wod1.blocks[2]!.roundLines!;
    expect(lines.map((l) => l.units)).toEqual([5, 10, 15]);
    expect(lines.every((l) => l.seconds > 0)).toBe(true);
    expect(wod1.blocks[0]!.roundLines).toBeUndefined(); // only AMRAP blocks
  });
});

describe("If these three were one week", () => {
  const week = sumLenses([wod1, wod2, wod3]);
  const ratios = computeRatios(week.exposure.reps);

  it("hard sets: squat 5, h_push 4, h_pull 4 — and no hinge or vertical work", () => {
    expect(Object.keys(week.hardSets.byPattern).sort()).toEqual(["h_pull", "h_push", "squat"]);
    expectExact(week.hardSets.byPattern.squat, 5);
    expectExact(week.hardSets.byPattern.h_push, 4);
    expectExact(week.hardSets.byPattern.h_pull, 4);
  });

  it("hard sets per muscle: primary 1.0 set, secondary 0.5 set", () => {
    expectExact(week.hardSets.byMuscle.quads, 5);
    expectExact(week.hardSets.byMuscle.adductors, 2.5);
    expectExact(week.hardSets.byMuscle.chest, 4);
    expectExact(week.hardSets.byMuscle.shoulders, 2);
    expect(week.hardSets.byMuscle.hamstrings).toBeUndefined();
  });

  it("exposure push:pull 61 : 47 = 1.3 (1.2–1.4)", () => {
    expectRange(ratios.pushPull, 57 / 47, 61 / 47, 65 / 47);
  });

  it("exposure knee:hip ~4.1: knee-dominant week", () => {
    expect(ratios.kneeHip?.mid).toBeCloseTo(4.06, 2);
  });

  it("weekly planned load ~593 AU (569–625), low monotony", () => {
    const summary = weekSummary(
      [
        { date: "2026-10-19", sRpe: wod1.sRpe ?? { low: 0, mid: 0, high: 0, confidence: "exact" } },
        { date: "2026-10-21", sRpe: wod2.sRpe ?? { low: 0, mid: 0, high: 0, confidence: "exact" } },
        { date: "2026-10-23", sRpe: wod3.sRpe ?? { low: 0, mid: 0, high: 0, confidence: "exact" } },
      ],
      "2026-10-19",
    );
    expect(summary.total.mid).toBeCloseTo(593.4, 1);
    expect(summary.total.low).toBeCloseTo(569.5, 1);
    expect(summary.total.high).toBeCloseTo(625.2, 1);
    expect(summary.monotony).toBeCloseTo(0.85, 2);
  });

  it("is deterministic: the same input gives the same output", () => {
    expect(computeWorkout(WOD_1, ENGINE_CONFIG)).toEqual(wod1);
  });
});
