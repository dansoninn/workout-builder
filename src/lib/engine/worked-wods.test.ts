// Calc spec §7: the three worked WODs are the engine's acceptance tests.
// Exact values must match exactly; estimates within 5% of what §7 states.

import { describe, expect, it } from "vitest";

import { WOD_1, WOD_2, WOD_3, FIXTURE_CONFIG } from "@/lib/engine/fixtures/worked-wods";
import type { Block, Measure, WorkoutResult } from "@/lib/engine/types";
import { weekSummary } from "@/lib/engine/weekly";
import { computeBlock, computeRatios, computeWorkout, sumLenses } from "@/lib/engine/workout";

function expectExact(measure: Measure | null | undefined, value: number) {
  expect(measure?.confidence).toBe("exact");
  expect(measure?.value).toBeCloseTo(value, 6);
}

function expectAbout(measure: Measure | null | undefined, value: number, tolerance = 0.05) {
  expect(measure?.confidence).toBe("estimated");
  expect(Math.abs((measure?.value ?? Infinity) - value) / value).toBeLessThanOrEqual(tolerance);
}

const wod1 = computeWorkout(WOD_1, FIXTURE_CONFIG);
const wod2 = computeWorkout(WOD_2, FIXTURE_CONFIG);
const wod3 = computeWorkout(WOD_3, FIXTURE_CONFIG);

describe("WOD 1 — strength + accessory + AMRAP", () => {
  const [a, b, c] = wod1.blocks as [WorkoutResult["blocks"][number], WorkoutResult["blocks"][number], WorkoutResult["blocks"][number]];

  it("A. E3M×5: 5 back squat @75–80% → 15 min, 5 hard sets squat, 25 reps", () => {
    expectExact(a.durationMin, 15);
    expect(a.plannedRpe).toBe(8);
    expect(a.effortSource).toBe("default");
    expectAbout(a.sRpe, 120, 0);
    expectExact(a.hardSets.byPattern.squat, 5);
    expectExact(a.exposure.reps.squat, 25);
    expect(a.intensityZones).toEqual([
      expect.objectContaining({ exercise: "Back squat", minPercent: 75, maxPercent: 80, sets: { value: 5, confidence: "exact" } }),
    ]);
  });

  it("B. E2M×4: 8–10 DB bench, 8/8 SA DB row → 4 hard sets each, ~36 and 32 reps", () => {
    expectExact(b.durationMin, 8);
    expect(b.plannedRpe).toBe(6);
    expectExact(b.sRpe, 48);
    expectExact(b.hardSets.byPattern.h_push, 4);
    expectExact(b.hardSets.byPattern.h_pull, 4);
    expectAbout(b.exposure.reps.h_push, 36, 0);
    expectExact(b.exposure.reps.h_pull, 32);
  });

  it("C. AMRAP 8: 5 KB swing, 10 air squat, 15 DU → ~10 rounds, ~50 hinge, ~100 squat, ~150 DU", () => {
    expectExact(c.durationMin, 8);
    expect(c.plannedRpe).toBe(8);
    expectExact(c.sRpe, 64);
    expectAbout(c.rounds, 10);
    expectAbout(c.exposure.reps.hinge, 50);
    expectAbout(c.exposure.reps.squat, 100);
    expectAbout(c.monostructural.jump_rope?.reps, 150);
    expect(c.hardSets.byPattern).toEqual({});
  });

  it("session planned load: 120 + 48 + 64 = 232 AU", () => {
    expectAbout(wod1.sRpe, 232, 0);
    expect(wod1.warnings).toEqual([]);
  });
});

describe("WOD 2 — chipper, 25 min cap", () => {
  it("finishes in ~22 min, RPE 9.5 → ~209 AU", () => {
    expectAbout(wod2.durationMin, 22);
    expect(wod2.blocks[0]?.plannedRpe).toBe(9.5);
    expect(wod2.blocks[0]?.capped).toBe(false);
    expectAbout(wod2.sRpe, 209);
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
    const only = (name: string) => computeBlock({ ...block, items: block.items.filter((i) => i.exercise?.name === name) }, FIXTURE_CONFIG);
    expectExact(only("Wall ball").volumeLoadKg, 450);
    expectExact(only("Dumbbell snatch").volumeLoadKg, 675);
    expectExact(wod2.volumeLoadKg, 1125);
  });

  it("no hard sets: no load effort was set", () => {
    expect(wod2.hardSets.byPattern).toEqual({});
  });
});

describe("WOD 3 — intervals 4 × 3 stations, 90/30, 90 s between rounds", () => {
  it("28.5 min block (18 min work), RPE 8 → 228 AU", () => {
    expectExact(wod3.durationMin, 28.5);
    expectExact(wod3.sRpe, 228);
    expectExact(wod3.monostructural.row?.workSec, 360);
    expectExact(wod3.monostructural.bike?.workSec, 360);
  });

  it("all estimated: row ~1,500 m, bike ~80 cal, lunges ~72 reps", () => {
    expectAbout(wod3.monostructural.row?.distanceM, 1500);
    expectAbout(wod3.monostructural.bike?.calories, 80);
    expectAbout(wod3.exposure.reps.lunge, 72);
  });
});

describe("If these three were one week", () => {
  const week = sumLenses([wod1, wod2, wod3]);
  const ratios = computeRatios(week.exposure.reps);

  it("hard sets: squat 5, h_push 4, h_pull 4 — and no hinge or vertical work", () => {
    expect(week.hardSets.byPattern).toEqual({
      squat: { value: 5, confidence: "exact" },
      h_push: { value: 4, confidence: "exact" },
      h_pull: { value: 4, confidence: "exact" },
    });
  });

  it("hard sets per muscle: primary 1.0 set, secondary 0.5 set", () => {
    expectExact(week.hardSets.byMuscle.quads, 5);
    expectExact(week.hardSets.byMuscle.adductors, 2.5);
    expectExact(week.hardSets.byMuscle.chest, 4);
    expectExact(week.hardSets.byMuscle.shoulders, 2);
    expect(week.hardSets.byMuscle.hamstrings).toBeUndefined();
  });

  it("exposure push:pull 61 : 47 = 1.3", () => {
    expect(ratios.pushPull?.value).toBeCloseTo(61 / 47, 6);
  });

  it("exposure knee:hip ~227 : ~71 = 3.2", () => {
    expectAbout(ratios.kneeHip, 227 / 71);
  });

  it("weekly planned load ~669 AU (232 / ~209 / 228), even distribution, low monotony", () => {
    const summary = weekSummary(
      [
        { date: "2026-10-19", sRpe: wod1.sRpe?.value ?? 0 },
        { date: "2026-10-21", sRpe: wod2.sRpe?.value ?? 0 },
        { date: "2026-10-23", sRpe: wod3.sRpe?.value ?? 0 },
      ],
      "2026-10-19",
    );
    expect(Math.abs(summary.total - 669) / 669).toBeLessThan(0.03);
    expect(summary.monotony).not.toBeNull();
    expect(summary.monotony ?? Infinity).toBeLessThan(1.5);
  });

  it("is deterministic: the same input gives the same output", () => {
    expect(computeWorkout(WOD_1, FIXTURE_CONFIG)).toEqual(wod1);
  });
});
