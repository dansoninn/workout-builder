// Checks the approved pace table (complete, positive, anchored to calc spec
// §9.5) and that its generated migration and document are current.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ENGINE_CONFIG } from "@/lib/engine/config";
import type { Pace } from "@/lib/engine/types";
import { CORE_EXERCISES } from "@/lib/library/core-exercises";
import { PACE_MIGRATION_PATH, buildPaceDefaultsMigrationSql } from "@/lib/library/generate";
import { PACE_DOC_PATH, buildPaceMarkdown } from "@/lib/library/pace-doc";
import { PACE_DEFAULTS } from "@/lib/library/pace-defaults";

const names = new Set(CORE_EXERCISES.map((e) => e.name));
const keyForUnit: Record<string, keyof Pace> = { reps: "secPerRep", distance_m: "secPerM", calories: "secPerCal" };

describe("approved pace table", () => {
  it("only lists core exercises, with positive values", () => {
    for (const [name, pace] of Object.entries(PACE_DEFAULTS)) {
      expect(names.has(name), name).toBe(true);
      for (const value of [pace.secPerRep, pace.secPerM, pace.secPerCal]) {
        if (value !== undefined) expect(value, name).toBeGreaterThan(0);
      }
    }
  });

  it("covers every core exercise in its default unit (timed holds need none)", () => {
    for (const exercise of CORE_EXERCISES) {
      const key = keyForUnit[exercise.unit];
      if (!key) continue;
      expect(PACE_DEFAULTS[exercise.name]?.[key], `${exercise.name} needs ${key}`).toBeDefined();
    }
  });

  it("rowing, ski and bike ergs, prescribed in metres or calories, have both", () => {
    for (const name of ["Row", "Ski erg", "Bike erg"]) {
      expect(PACE_DEFAULTS[name]?.secPerM, name).toBeDefined();
      expect(PACE_DEFAULTS[name]?.secPerCal, name).toBeDefined();
    }
  });

  it("matches the calc spec §9.5 anchors at max effort: row 2:00/500 m, air bike ~20 cal per 90 s", () => {
    const max = ENGINE_CONFIG.paceEffortFactor.max;
    expect(500 * (PACE_DEFAULTS.Row?.secPerM ?? 0) * max).toBeCloseTo(120, 0);
    expect(90 / ((PACE_DEFAULTS["Air bike"]?.secPerCal ?? 0) * max)).toBeCloseTo(20, 0);
  });

  it("the pace migration is up to date with the source", () => {
    expect(readFileSync(PACE_MIGRATION_PATH, "utf8"), "run npm run library:generate").toBe(buildPaceDefaultsMigrationSql());
  });

  it("docs/pace-defaults.md is up to date with the source", () => {
    expect(readFileSync(PACE_DOC_PATH, "utf8"), "run npm run library:generate").toBe(buildPaceMarkdown());
  });
});
