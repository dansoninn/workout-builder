// Checks the proposed pace table itself (complete, positive, anchored to calc
// spec §9.5). The engine's tests do not use it until Daniel approves it.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CORE_EXERCISES } from "@/lib/library/core-exercises";
import { PACE_DOC_PATH, buildPaceMarkdown } from "@/lib/library/pace-doc";
import { PROPOSED_PACES, PROPOSED_PACE_RULES } from "@/lib/library/pace-defaults";

const names = new Set(CORE_EXERCISES.map((e) => e.name));

describe("proposed pace table", () => {
  it("only lists core exercises, with positive values", () => {
    for (const [name, pace] of Object.entries(PROPOSED_PACES)) {
      expect(names.has(name), name).toBe(true);
      for (const value of Object.values(pace)) expect(value, name).toBeGreaterThan(0);
    }
  });

  it("covers every core exercise in its default unit (timed holds need none)", () => {
    for (const exercise of CORE_EXERCISES) {
      const pace = PROPOSED_PACES[exercise.name];
      if (exercise.unit === "time_s") continue;
      const key = { reps: "secPerRep", distance_m: "secPerM", calories: "secPerCal" }[exercise.unit] as keyof NonNullable<typeof pace>;
      expect(pace?.[key], `${exercise.name} needs ${key}`).toBeDefined();
    }
  });

  it("rowing and ski ergs, prescribed in metres or calories, have both", () => {
    for (const name of ["Row", "Ski erg", "Bike erg"]) {
      expect(PROPOSED_PACES[name]?.secPerM, name).toBeDefined();
      expect(PROPOSED_PACES[name]?.secPerCal, name).toBeDefined();
    }
  });

  it("matches the calc spec §9.5 anchors at max effort: row 2:00/500 m, air bike ~20 cal per 90 s", () => {
    const max = PROPOSED_PACE_RULES.paceEffortFactor.max;
    expect(500 * (PROPOSED_PACES.Row?.secPerM ?? 0) * max).toBeCloseTo(120, 0);
    expect(90 / ((PROPOSED_PACES["Air bike"]?.secPerCal ?? 0) * max)).toBeCloseTo(20, 0);
  });

  it("pace effort factors slow down easier efforts and never go below zero", () => {
    const f = PROPOSED_PACE_RULES.paceEffortFactor;
    expect(f.easy).toBeGreaterThan(f.moderate);
    expect(f.moderate).toBeGreaterThan(f.hard);
    expect(f.hard).toBeGreaterThan(f.max);
    expect(f.max).toBeGreaterThan(0);
  });

  it("docs/pace-defaults.md is up to date with the source", () => {
    expect(readFileSync(PACE_DOC_PATH, "utf8"), "run npm run library:generate").toBe(buildPaceMarkdown());
  });
});
