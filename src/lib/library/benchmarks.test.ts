import { describe, expect, it } from "vitest";

import { parseWorkoutText } from "@/lib/workout/parse";
import { coreLibrary } from "@/lib/workout/test-library";

import { benchmarkOf, BENCHMARKS } from "./benchmarks";

const library = coreLibrary();

describe("named benchmark workouts", () => {
  it("each reads with the core library: every line understood, every exercise known", () => {
    for (const b of BENCHMARKS) {
      const parsed = parseWorkoutText(b.text, library);
      const lines = parsed.lines.filter((l) => l.status !== "blank");
      expect(lines.filter((l) => l.status !== "ok").map((l) => `${l.text}: ${l.problems.join("; ")}`), b.name).toEqual([]);
      expect(parsed.blocks.flatMap((block) => block.items).every((i) => i.exerciseId !== null), b.name).toBe(true);
    }
  });

  it("a day that says only the name is the benchmark; one that writes it out is read as written", () => {
    expect(["Fran", "fran!", "WOD: Cindy", "Benchmark - Helen (Rx)", "Murph for time", "Hero WOD: Murph"].map((t) => benchmarkOf(t)?.name)).toEqual([
      "Fran", "Fran", "Cindy", "Helen", "Murph", "Murph",
    ]);
    expect(benchmarkOf("Fran\n21-15-9\nThrusters\nPull-ups")).toBeNull();
    expect(benchmarkOf("Frank's favourite")).toBeNull();
  });

  it("Paste reads a benchmark's name as the benchmark", () => {
    const parsed = parseWorkoutText("Fran", library);
    expect(parsed.title).toBe("Fran");
    expect(parsed.blocks[0]!.items.map((i) => i.quantity)).toEqual(["21-15-9", "21-15-9"]);
  });
});
