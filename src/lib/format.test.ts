import { describe, expect, it } from "vitest";

import { estimated, exact } from "@/lib/engine/measure";
import { formatMeasure } from "@/lib/format";

describe("formatMeasure: honest numbers", () => {
  it("exact values are plain, without ~ or range", () => {
    expect(formatMeasure(exact(202), "AU")).toMatchObject({ main: "202 AU", range: null, estimated: false, label: "202 AU" });
    expect(formatMeasure(exact(15), "min").main).toBe("15 min");
  });

  it("estimates show ~ and their range (the §7 chipper)", () => {
    expect(formatMeasure(estimated(20.42, 17.43, 24.41), "min")).toMatchObject({ main: "~20 min", range: "17–24", estimated: true });
    expect(formatMeasure(estimated(163.4, 139.5, 195.2), "AU")).toMatchObject({ main: "~163 AU", range: "140–195" });
  });

  it("rounds per unit: AMRAP rounds to one decimal, short durations to one decimal", () => {
    expect(formatMeasure(estimated(7.68, 6.67, 8.67), "rounds")).toMatchObject({ main: "~7.7", range: "6.7–8.7" });
    expect(formatMeasure(estimated(8.4, 7.1, 10.1), "min")).toMatchObject({ main: "~8.4 min", range: "7.1–10.1" });
  });

  it("estimated metres round to 10 m and use thousands separators", () => {
    expect(formatMeasure(estimated(1225.74, 1021.45, 1442.05), "m")).toMatchObject({ main: "~1,230 m", range: "1,020–1,440" });
    expect(formatMeasure(exact(1225), "m").main).toBe("1,225 m");
  });

  it("hides a range that rounds to a single number, but keeps the ~", () => {
    expect(formatMeasure(estimated(120.2, 119.9, 120.4), "AU")).toMatchObject({ main: "~120 AU", range: null, estimated: true });
  });

  it("fractional hard sets keep one decimal; whole sets none", () => {
    expect(formatMeasure(exact(2.5), "sets").main).toBe("2.5");
    expect(formatMeasure(exact(4), "sets").main).toBe("4");
  });

  it("finish times read as a clock; estimates to the nearest 10 s", () => {
    expect(formatMeasure({ low: 641, mid: 754, high: 905, confidence: "estimated" }, "clock")).toMatchObject({
      main: "~12:30",
      range: "10:40–15:10",
    });
    expect(formatMeasure({ low: 3750, mid: 3750, high: 3750, confidence: "exact" }, "clock").main).toBe("1:02:30");
  });

  it("reads naturally for screen readers", () => {
    expect(formatMeasure(estimated(20.42, 17.43, 24.41), "min").label).toBe("about 20 min, likely between 17 and 24");
  });
});
