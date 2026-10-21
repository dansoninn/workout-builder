import { describe, expect, it } from "vitest";

import { gymExerciseSchema } from "./gym-exercise-schema";

const base = {
  id: null,
  name: "Sandbag bear-hug carry",
  kind: "movement" as const,
  modality: null,
  plane: "sagittal" as const,
  unilateral: false,
  defaultUnit: "distance_m" as const,
  implementCount: 1,
  patterns: { squat: 0.6, carry: 0.4 },
  primaryMuscles: ["quads" as const],
  secondaryMuscles: ["abs" as const],
  equipment: ["sandbag"],
  pace: { sec_per_m: 0.6 },
};

const issues = (input: unknown) => {
  const result = gymExerciseSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("a gym exercise", () => {
  it("accepts some of the patterns, weights adding up to 1.00", () => {
    expect(issues(base)).toEqual([]);
    expect(issues({ ...base, patterns: { carry: 1 } })).toEqual([]);
  });

  it("refuses weights that do not add up to 1.00", () => {
    expect(issues({ ...base, patterns: { squat: 0.6, carry: 0.3 } })).toEqual(["Pattern weights must add up to 1.00"]);
  });

  it("cardio has a modality and no patterns", () => {
    const cardio = { ...base, kind: "monostructural", modality: "row", patterns: {} };
    expect(issues(cardio)).toEqual([]);
    expect(issues({ ...cardio, modality: null })).toEqual(["Choose what it is (run, row …)"]);
    expect(issues({ ...cardio, patterns: { carry: 1 } })).toEqual(["Cardio has no movement patterns"]);
  });

  it("a muscle is primary or secondary, not both", () => {
    expect(issues({ ...base, secondaryMuscles: ["quads"] })).toEqual(["A muscle is primary or secondary, not both"]);
  });
});
