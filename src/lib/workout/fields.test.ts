import { describe, expect, it } from "vitest";

import { loadMeaning, loadText, parseLoad, parseQuantity, quantityMeaning, quantityText, rawLine } from "./fields";
import { loadSchema, quantitySchema } from "./rules";

describe("parseQuantity", () => {
  it.each([
    ["5", "reps", { type: "reps", value: 5 }],
    ["8-10", "reps", { type: "reps_range", min: 8, max: 10 }],
    ["8–10", "reps", { type: "reps_range", min: 8, max: 10 }],
    ["21-15-9", "reps", { type: "reps_scheme", scheme: [21, 15, 9] }],
    ["8/8", "reps", { type: "reps_per_side", value: 8 }],
    ["500", "distance_m", { type: "distance_m", value: 500 }],
    ["800 m", "reps", { type: "distance_m", value: 800 }],
    ["1.5 km", "reps", { type: "distance_m", value: 1500 }],
    ["15", "calories", { type: "calories", min: 15, max: 15 }],
    ["8-12 cal", "reps", { type: "calories", min: 8, max: 12 }],
    ["0:30", "reps", { type: "time_s", value: 30 }],
    ["1:30", "reps", { type: "time_s", value: 90 }],
    ["45 s", "reps", { type: "time_s", value: 45 }],
    ["2 min", "reps", { type: "time_s", value: 120 }],
    ["30", "time_s", { type: "time_s", value: 30 }],
    ["max", "reps", { type: "max_effort", unit: "reps" }],
    ["max", "calories", { type: "max_effort", unit: "calories" }],
    ["max cal", "distance_m", { type: "max_effort", unit: "calories" }],
    ["Max m", "reps", { type: "max_effort", unit: "distance_m" }],
  ] as const)("%s (%s) → %o", (input, unit, expected) => {
    const parsed = parseQuantity(input, unit);
    expect(parsed).toEqual({ ok: true, value: expected });
    if (parsed.ok) expect(quantitySchema.safeParse(parsed.value).success).toBe(true);
  });

  it.each([
    ["", "Enter an amount"],
    ["10-8", "The second number must be larger, e.g. 8-10"],
    ["8/6", "Per side means the same number each side, e.g. 8/8"],
    ["2.5", "Use whole reps"],
    ["5 kg", 'Unknown unit "kg"'],
    ["lots", "Try 5, 8-10, 21-15-9, 8/8, 400 m, 15 cal, 0:30 or max"],
  ])("%s is refused: %s", (input, error) => {
    expect(parseQuantity(input)).toEqual({ ok: false, error });
  });

  it("reads back the way it was typed", () => {
    for (const [input, unit] of [["21-15-9", "reps"], ["8/8", "reps"], ["8-12 cal", "reps"], ["800 m", "reps"], ["1:30", "reps"], ["max cal", "reps"]] as const) {
      const parsed = parseQuantity(input, unit);
      if (!parsed.ok) throw new Error(parsed.error);
      expect(parseQuantity(quantityText(parsed.value), unit)).toEqual(parsed);
    }
  });

  it("says what it understood", () => {
    expect(quantityMeaning({ type: "reps_scheme", scheme: [21, 15, 9] })).toBe("21-15-9 (45 reps)");
    expect(quantityMeaning({ type: "reps_per_side", value: 8 })).toBe("8 each side");
    expect(quantityMeaning({ type: "max_effort", unit: "calories" })).toBe("max calories");
  });
});

describe("parseLoad", () => {
  it.each([
    ["", null, undefined],
    ["75%", { type: "percent_1rm", min: 75, max: 75 }, undefined],
    ["75-80%", { type: "percent_1rm", min: 75, max: 80 }, undefined],
    ["@75–80 %", { type: "percent_1rm", min: 75, max: 80 }, undefined],
    ["22.5", { type: "absolute_kg", rx: [22.5] }, undefined],
    ["22,5/15 kg", { type: "absolute_kg", rx: [22.5, 15] }, undefined],
    ["2x22.5/15", { type: "absolute_kg", rx: [22.5, 15] }, 2],
    ["2 × 22.5 kg", { type: "absolute_kg", rx: [22.5] }, 2],
    ["bw", { type: "bodyweight" }, undefined],
    ["Bodyweight", { type: "bodyweight" }, undefined],
  ] as const)("%s", (input, expected, implementCount) => {
    const parsed = parseLoad(input);
    expect(parsed).toEqual(implementCount ? { ok: true, value: expected, implementCount } : { ok: true, value: expected });
    if (parsed.ok && parsed.value) expect(loadSchema.safeParse(parsed.value).success).toBe(true);
  });

  it.each(["80-75%", "110%", "heavy", "0 kg"])("%s is refused", (input) => {
    expect(parseLoad(input).ok).toBe(false);
  });

  it("shows two implements as 2 × load", () => {
    expect(loadMeaning({ type: "absolute_kg", rx: [22.5, 15] }, 2)).toBe("2 × 22.5/15 kg");
    expect(loadText({ type: "absolute_kg", rx: [22.5, 15] }, 2)).toBe("2x22.5/15 kg");
    expect(loadMeaning({ type: "percent_1rm", min: 75, max: 80 }, 1)).toBe("@75–80%");
  });
});

describe("rawLine", () => {
  it("writes the line the way a coach would", () => {
    expect(rawLine({ type: "reps", value: 5 }, "Back squat", { type: "percent_1rm", min: 75, max: 80 }, 1)).toBe("5 Back squat @75–80%");
    expect(rawLine({ type: "reps_per_side", value: 8 }, "Single-arm DB row", { type: "absolute_kg", rx: [22.5] }, 1)).toBe(
      "8/8 Single-arm DB row 22.5 kg",
    );
    expect(rawLine({ type: "calories", min: 15, max: 15 }, null, null, 1)).toBe("15 cal ?");
  });
});
