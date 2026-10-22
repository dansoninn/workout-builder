import { describe, expect, it } from "vitest";

import { finishText, parseFinish, parseRounds, partialRound, resultInputSchema, resultText } from "./results";

/** A round of 5 KB swings (15 s), 10 air squats (20 s), 15 double-unders (15 s): 30 reps, 50 s. */
const ROUND = [
  { units: 5, seconds: 15 },
  { units: 10, seconds: 20 },
  { units: 15, seconds: 15 },
];

describe("block results as a coach types them", () => {
  it("rounds: whole, decimal, or with a phone's decimal comma", () => {
    expect(parseRounds("7")).toEqual({ ok: true, value: 7 });
    expect(parseRounds(" 7.5 ")).toEqual({ ok: true, value: 7.5 });
    expect(parseRounds("7,5")).toEqual({ ok: true, value: 7.5 });
    expect(parseRounds("")).toEqual({ ok: true, value: null });
    expect(parseRounds("7+12").ok).toBe(false);
    expect(parseRounds("-1").ok).toBe(false);
  });

  it('"7 + 12": the 12 reps go through the round in order and count by their share of its time', () => {
    // 5 swings (15 s) + 7 of the 10 squats (14 s) = 29 s of a 50 s round.
    expect(partialRound(12, ROUND)).toBeCloseTo(0.58, 6);
    expect(parseRounds("7 + 12", ROUND)).toEqual({ ok: true, value: 7.58 });
    expect(parseRounds("7+5", ROUND)).toEqual({ ok: true, value: 7.3 });
    expect(parseRounds("0 + 20", ROUND)).toEqual({ ok: true, value: 0.8 });
    expect(parseRounds("7 + 30", ROUND)).toEqual({ ok: false, error: "A round here is 30 reps: “+30” would be a whole round or more" });
    expect(parseRounds("7 + 12", null).ok).toBe(false);
    expect(resultText({ rounds_low: 7.58, rounds_high: 9.3, finish_low_s: null, finish_high_s: null }, "7 + 12 – 9 + 5")).toBe("7 + 12 – 9 + 5 rounds (≈ 7.58–9.3)");
  });

  it("finish times: m:ss, h:mm:ss, or digits from a number pad", () => {
    expect(parseFinish("12:15")).toEqual({ ok: true, value: 735 });
    expect(parseFinish("1215")).toEqual({ ok: true, value: 735 });
    expect(parseFinish("930")).toEqual({ ok: true, value: 570 });
    expect(parseFinish("12")).toEqual({ ok: true, value: 720 });
    expect(parseFinish("1:02:30")).toEqual({ ok: true, value: 3750 });
    expect(parseFinish("")).toEqual({ ok: true, value: null });
    expect(parseFinish("12:75").ok).toBe(false);
    expect(parseFinish("1290").ok).toBe(false);
    expect(parseFinish("0").ok).toBe(false);
    expect(parseFinish("12:5").ok).toBe(false);
  });

  it("reads back the way coaches write them", () => {
    expect(finishText(735)).toBe("12:15");
    expect(finishText(3750)).toBe("1:02:30");
    expect(resultText({ rounds_low: 6.5, rounds_high: 8, finish_low_s: null, finish_high_s: null })).toBe("6.5–8 rounds");
    expect(resultText({ rounds_low: 1, rounds_high: 1, finish_low_s: null, finish_high_s: null })).toBe("1 round");
    expect(resultText({ rounds_low: null, rounds_high: null, finish_low_s: 570, finish_high_s: 900 })).toBe("9:30–15:00");
    expect(resultText({ rounds_low: null, rounds_high: null, finish_low_s: 735, finish_high_s: 735 })).toBe("12:15");
  });

  it("the server reads the form: empty class and note are nothing, not empty text", () => {
    const parsed = resultInputSchema.parse({
      blockId: "0f0f0f0f-0000-4000-8000-000000000000",
      sessionLabel: "  ",
      rounds_low: 7,
      rounds_high: 8,
      finish_low_s: null,
      finish_high_s: null,
      note: " Scaled ",
    });
    expect(parsed).toMatchObject({ sessionLabel: null, note: "Scaled" });
  });
});
