import { describe, expect, it } from "vitest";

import { ENGINE_CONFIG } from "@/lib/engine/config";
import { WOD_1, WOD_2, WOD_3 } from "@/lib/engine/fixtures/worked-wods";
import { computeWorkout } from "@/lib/engine/workout";

import { checkGuidelines, guidelinesSchema, hasGuidelines, readGuidelines } from "./guidelines";
import { type PeriodWorkout, summarisePeriod, weeksAround } from "./period";

const workout = (id: string, date: string, result = computeWorkout(WOD_1, ENGINE_CONFIG)): PeriodWorkout => ({ id, date, title: id, trackId: null, result });

/** Calc spec §7, "If these three were one week": Monday, Wednesday, Friday. */
const WEEK = [
  workout("WOD 1", "2026-10-19", computeWorkout(WOD_1, ENGINE_CONFIG)),
  workout("WOD 2", "2026-10-21", computeWorkout(WOD_2, ENGINE_CONFIG)),
  workout("WOD 3", "2026-10-23", computeWorkout(WOD_3, ENGINE_CONFIG)),
];

describe("a period of workouts, from their stored metrics", () => {
  const summary = summarisePeriod(WEEK, "2026-10-19", "2026-10-25");

  it("the §7 week: ~593 AU (569–625), monotony 0.85, the same numbers as the engine's", () => {
    expect(summary.lenses.sRpe?.mid).toBeCloseTo(593.4, 1);
    expect(summary.lenses.sRpe?.low).toBeCloseTo(569.5, 1);
    expect(summary.weeks).toHaveLength(1);
    expect(summary.weeks[0]!.total.mid).toBeCloseTo(593.4, 1);
    expect(summary.weeks[0]!.monotony).toBeCloseTo(0.85, 2);
  });

  it("the §7 week's lenses: hard sets squat 5, h_push 4, h_pull 4, no hinge; push:pull 1.3; knee:hip ~4.1", () => {
    expect(summary.lenses.hardSets.byPattern).toMatchObject({ squat: { mid: 5 }, h_push: { mid: 4 }, h_pull: { mid: 4 } });
    expect(summary.lenses.hardSets.byPattern.hinge).toBeUndefined();
    expect(summary.ratios.pushPull?.mid).toBeCloseTo(61 / 47, 2);
    expect(summary.ratios.kneeHip?.mid).toBeCloseTo(4.06, 2);
  });

  it("each day of the period, rest days included", () => {
    expect(summary.daily.map((d) => [d.date, d.workouts.length])).toEqual([
      ["2026-10-19", 1], ["2026-10-20", 0], ["2026-10-21", 1], ["2026-10-22", 0], ["2026-10-23", 1], ["2026-10-24", 0], ["2026-10-25", 0],
    ]);
    expect(summary.daily[0]!.sRpe?.mid).toBeCloseTo(202, 6);
  });

  it("weekly numbers are over whole weeks, even when the period starts mid-week; change is from the week before", () => {
    const later = [...WEEK, workout("next", "2026-10-27", computeWorkout(WOD_1, ENGINE_CONFIG))];
    const s = summarisePeriod(later, "2026-10-22", "2026-10-28");
    expect(weeksAround("2026-10-22", "2026-10-28")).toEqual({ first: "2026-10-19", last: "2026-10-26", loadFrom: "2026-10-12", loadTo: "2026-11-01" });
    expect(s.weeks.map((w) => w.weekStart)).toEqual(["2026-10-19", "2026-10-26"]);
    expect(s.weeks[0]!.total.mid).toBeCloseTo(593.4, 1); // the whole week, not only from the 22nd
    expect(s.weeks[0]!.change).toBeNull(); // nothing the week before
    expect(s.weeks[1]!.change).toBeCloseTo(202 / 593.4 - 1, 3);
    expect(s.workouts.map((w) => w.id)).toEqual(["WOD 3", "next"]); // the lenses use the period's own days
  });

  it("a workout whose load is unknown is left out of the load and named, never guessed", () => {
    const unknown = workout("no pace", "2026-10-20", { ...computeWorkout(WOD_1, ENGINE_CONFIG), sRpe: null, durationMin: null });
    const s = summarisePeriod([...WEEK, unknown], "2026-10-19", "2026-10-25");
    expect(s.unknownLoad.map((w) => w.id)).toEqual(["no pace"]);
    expect(s.lenses.sRpe?.mid).toBeCloseTo(593.4, 1);
  });
});

describe("the gym's guidelines", () => {
  const summary = summarisePeriod(WEEK, "2026-10-19", "2026-10-25");

  it("nothing warns that the gym has not set", () => {
    expect(hasGuidelines({})).toBe(false);
    expect(checkGuidelines(summary, {})).toEqual([]);
  });

  it("the §7 week against guidelines: no hinge, knee-heavy; push:pull fine; monotony fine", () => {
    const warnings = checkGuidelines(summary, {
      hardSetsPerWeek: { hinge: 4, squat: 3 },
      pushPull: { min: 0.8, max: 1.5 },
      kneeHip: { max: 2 },
      monotonyMax: 2,
    });
    expect(warnings.map((w) => [w.key, w.text, w.guideline])).toEqual([
      ["hard-sets:hinge", "Hinge: no hard sets in 7 days", "At least 4 a week (4 for 7 days)"],
      ["ratio:kneeHip", "Knee : hip ~4.1: knee-heavy (exposure reps)", "At most 2"],
    ]);
    // The workouts behind the knee-heavy week, most knee reps first: WOD 3's ~109 lunges, WOD 1's squats, WOD 2's wall balls.
    expect(warnings[1]!.workouts.map((w) => w.id)).toEqual(["WOD 3", "WOD 1", "WOD 2"]);
  });

  it("guidelines scale with the period: 4 a week is 8 over 14 days", () => {
    const fortnight = summarisePeriod(WEEK, "2026-10-19", "2026-11-01");
    const [warning] = checkGuidelines(fortnight, { hardSetsPerWeek: { squat: 4 } });
    expect(warning).toMatchObject({ text: "Squat: 5 hard sets in 14 days", guideline: "At least 4 a week (8 for 14 days)" });
    expect(warning!.workouts.map((w) => w.id)).toEqual(["WOD 1"]);
  });

  it("a week's jump in load", () => {
    // The same three workouts the next week, plus WOD 3 once more: 38% more than the §7 week.
    const nextWeek = WEEK.map((w, i) => workout(`B${i}`, ["2026-10-26", "2026-10-27", "2026-10-28"][i]!, w.result));
    const s = summarisePeriod([...WEEK, ...nextWeek, workout("extra", "2026-10-29", computeWorkout(WOD_3, ENGINE_CONFIG))], "2026-10-26", "2026-11-01");
    const [warning] = checkGuidelines(s, { weekIncreaseMaxPercent: 20 });
    expect(warning?.text).toBe("Week of Mon 26 Oct: planned load 38% above the week before");
    expect(warning?.workouts[0]!.id).toBe("B2"); // WOD 3, the highest load
  });

  it("guidelines are read from the gym's settings; anything that does not read is no guideline", () => {
    expect(readGuidelines({ guidelines: { monotonyMax: 2 } })).toEqual({ monotonyMax: 2 });
    expect(readGuidelines({ guidelines: { monotonyMax: -1 } })).toEqual({});
    expect(readGuidelines(null)).toEqual({});
    expect(guidelinesSchema.safeParse({ kneeHip: { min: 3, max: 2 } }).success).toBe(false);
    expect(guidelinesSchema.safeParse({ hardSetsPerWeek: { deadlift: 3 } }).success).toBe(false);
  });
});
