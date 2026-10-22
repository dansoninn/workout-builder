import { describe, expect, it } from "vitest";

import { effortFromPercent, effortFromRpe, takeEffortText } from "./effort-text";

describe("effort in words and numbers (calc spec §4.4)", () => {
  it("% effort goes to the four boxes; between two boxes, the nearer", () => {
    expect([40, 45, 47, 50, 65, 67, 70, 85, 87, 88, 90, 100].map(effortFromPercent)).toEqual([
      "easy", "easy", "easy", "moderate", "moderate", "moderate", "hard", "hard", "hard", "max", "max", "max",
    ]);
    expect([3, 4, 5, 6, 7, 8, 9, 10, 6.5, 8.8].map(effortFromRpe)).toEqual([
      "easy", "easy", "moderate", "moderate", "hard", "hard", "max", "max", "moderate", "max",
    ]);
  });

  it.each([
    ["5 back squat @ 75-80% effort", "5 back squat", [{ source: "75-80% effort", level: "hard", axis: "lift" }]],
    ["Row 500 m RPE 6", "Row 500 m", [{ source: "RPE 6", level: "moderate", axis: "lift" }]],
    ["400 m run @ 7/10", "400 m run", [{ source: "7/10", level: "hard", axis: "lift" }]],
    ["5 back squats (heavy)", "5 back squats", [{ source: "heavy", level: "hard", axis: "loaded" }]],
    ["Back squat 5x5, heavy", "Back squat 5x5", [{ source: "heavy", level: "hard", axis: "loaded" }]],
    ["AMRAP 12, moderate pace", "AMRAP 12", [{ source: "moderate pace", level: "moderate", axis: "pace" }]],
    ["10 burpees - all out", "10 burpees", [{ source: "all out", level: "max", axis: "pace" }]],
    ["Run 400 m fast", "Run 400 m", [{ source: "fast", level: "hard", axis: "pace" }]],
    ["Sprint", "", [{ source: "Sprint", level: "max", axis: "pace" }]],
    ["Light", "", [{ source: "Light", level: "easy", axis: "loaded" }]],
    ["EMOM 10 @ steady", "EMOM 10", [{ source: "steady", level: "moderate", axis: "pace" }]],
    ["C. AMRAP 8, Pace Hard: 5 KB swing", "C. AMRAP 8, : 5 KB swing", [{ source: "Pace Hard", level: "hard", axis: "pace" }]],
    ["Deadlift 3x5 heavy load", "Deadlift 3x5", [{ source: "heavy load", level: "hard", axis: "load" }]],
  ] as const)("%s", (input, text, found) => {
    expect(takeEffortText(input)).toEqual({ text, found });
  });

  it("leaves amounts and loads alone", () => {
    expect(takeEffortText("Max cal bike")).toEqual({ text: "Max cal bike", found: [] });
    expect(takeEffortText("5 back squat @75-80%")).toEqual({ text: "5 back squat @75-80%", found: [] });
    expect(takeEffortText("20 wall balls @ 9/6 kg")).toEqual({ text: "20 wall balls @ 9/6 kg", found: [] });
    expect(takeEffortText("Hard style plank")).toEqual({ text: "Hard style plank", found: [] });
    expect(takeEffortText("Plank :45")).toEqual({ text: "Plank :45", found: [] });
  });
});
