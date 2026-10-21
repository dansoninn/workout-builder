import { describe, expect, it } from "vitest";

import { PACE_DEFAULTS } from "@/lib/library/pace-defaults";

import { paceFields, paceText, parsePaceValue } from "./pace-text";

const row = paceFields({ kind: "monostructural", modality: "row", defaultUnit: "distance_m" });
const run = paceFields({ kind: "monostructural", modality: "run", defaultUnit: "distance_m" });
const bike = paceFields({ kind: "monostructural", modality: "bike", defaultUnit: "calories" });
const squat = paceFields({ kind: "movement", modality: null, defaultUnit: "reps" });

describe("paces in coaching terms", () => {
  it("reads like the approved pace table", () => {
    expect(paceText(PACE_DEFAULTS["Row"]!, row)).toBe("2:14 /500 m · 4.5 s/cal");
    expect(paceText(PACE_DEFAULTS["Run"]!, run)).toBe("6:00 /km");
    expect(paceText(PACE_DEFAULTS["Back squat"]!, squat)).toBe("3 s/rep");
    expect(paceText(null, squat)).toBe("—");
    expect(bike[0]?.label).toBe("s/cal");
  });

  it("reads what a coach types back into stored seconds", () => {
    expect(parsePaceValue("2:00", row[0]!)).toBeCloseTo(120 / 500, 9);
    expect(parsePaceValue("5:30", run[0]!)).toBeCloseTo(330 / 1000, 9);
    expect(parsePaceValue("2.5", squat[0]!)).toBe(2.5);
    expect(parsePaceValue("0", squat[0]!)).toBeNull();
    expect(parsePaceValue("fast", squat[0]!)).toBeNull();
  });

  it("timed holds have no pace", () => {
    expect(paceFields({ kind: "movement", modality: null, defaultUnit: "time_s" })).toEqual([]);
  });
});
