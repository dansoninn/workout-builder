// Notations found in a year of a gym's real programming (BACKLOG "Learnings
// from Afrek's 2024 programming", 2026-10-23). One gym's style is not a
// standard, so every rule is tested on other common ways of writing it too.

import { describe, expect, it } from "vitest";

import { type Answers, parseWorkoutText } from "./parse";
import { coreLibrary, idOf } from "./test-library";

const library = coreLibrary();
const parse = (text: string, answers: Answers = {}) => parseWorkoutText(text, library, answers);
const exercise = (id: string | null) => library.exercises.find((e) => e.id === id)?.name ?? null;
const lines = (text: string) => parse(text).blocks.map((b) => b.items.map((i) => exercise(i.exerciseId)));

describe("lines done back to back", () => {
  it('a line ending in "+" goes on with the next, in the same block', () => {
    const { blocks, lines: read } = parse("A. E2.5M x 4 Sets\n8-12 x Heavy Dbl. KB Deadlift +\n6/6 x Heavy DB Row");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.items.map((i) => [exercise(i.exerciseId), i.quantity])).toEqual([
      ["Kettlebell deadlift", "8-12"],
      ["Single-arm dumbbell row", "6/6"],
    ]);
    expect(read.filter((l) => l.status !== "blank").every((l) => l.status === "ok")).toBe(true);
  });
});

describe('"N sets of:" and "N rounds of:", with the lines under them', () => {
  it("sets of, rounds of, supersets and trisets, in words or digits", () => {
    const sets = (text: string) => parse(text).blocks.map((b) => [b.format, b.params.sets, b.title]);
    expect(sets("B. 4 x Sets Of:\n10 x Hip Thrust\n10 x Goblet Squat")).toEqual([["sets", 4, ""]]);
    expect(sets("C. Superset 2. - 5 Rounds of:\n10 x Push-ups\n10 x Ring Rows")).toEqual([["sets", 5, "Superset 2"]]);
    expect(sets("Triset - 3 Rounds of:\n10 x Push-ups\n10 x Air Squats\n10 x Sit-ups")).toEqual([["sets", 3, "Triset"]]);
    expect(sets("3 rounds of:\n10 push-ups\n20 air squats")).toEqual([["sets", 3, ""]]);
    expect(sets("Five rounds of:\n10 push-ups\n20 air squats")).toEqual([["sets", 5, ""]]);
  });

  it('"rounds of" is a circuit, said plainly: no "not for time" question', () => {
    const { lines: read } = parse("3 rounds of:\n10 push-ups\n20 air squats");
    expect(read.flatMap((l) => l.problems)).toEqual([]);
  });

  it("a range of sets is counted at its lower number, and says so", () => {
    const { blocks, lines: read } = parse("A. E2M x 4-5 Sets\n3-6 x Bench Press");
    expect(blocks[0]).toMatchObject({ format: "every", params: { interval_s: 120, rounds: 4 } });
    expect(read[0]!.problems).toContain("4–5 sets: counted as 4");
  });
});

describe("implements: double and single", () => {
  it('"Dbl." and "Double" are two implements, "Single" one; the words still find the exercise', () => {
    const { blocks } = parse("For time\n10 x Dbl. KB Clean\n10 x Double DB Thruster\n12 x Single KB Swing");
    expect(blocks[0]!.items.map((i) => [exercise(i.exerciseId), i.implementCount])).toEqual([
      ["Kettlebell clean", 2],
      ["Dumbbell thruster", 2],
      ["Kettlebell swing", 1],
    ]);
  });

  it('"single-arm" is part of the exercise, not an implement count', () => {
    expect(lines("3 x 10 Single-arm DB row")).toEqual([["Single-arm dumbbell row"]]);
  });
});

describe("heavy, medium, light inside a line", () => {
  it("are the line's load effort, not part of the exercise", () => {
    const { blocks } = parse("EMOM 12\n8 x Heavy KB Swing\n10 x Medium DB Snatch\n12 x Light KB Goblet Squat");
    expect(blocks[0]!.items.map((i) => [exercise(i.exerciseId), i.loadEffort])).toEqual([
      ["Kettlebell swing", "hard"],
      ["Dumbbell snatch", "moderate"],
      ["Goblet squat", "easy"],
    ]);
  });

  it('"heavy ball" is an implement (a heavy medicine ball), not an effort', () => {
    const { blocks } = parse("For time\n10 x Heavy Ball Over Shoulder");
    expect(blocks[0]!.items[0]!.loadEffort).toBeNull();
  });
});

describe("alternatives", () => {
  it("are counted on the first, and the others are kept on the line", () => {
    const { blocks } = parse("For time\n10 x Burpees/Sprawls\n20 x V-Ups or Tuck Ups\n8-12 x Pull Ups (Strict-Kipp-Bfly-C2B-MU)");
    expect(blocks[0]!.items.map((i) => [exercise(i.exerciseId), i.notes])).toEqual([
      ["Burpee", "or Sprawls"],
      ["V-up", "or Tuck Ups"],
      ["Pull-up", "Strict-Kipp-Bfly-C2B-MU"],
    ]);
  });

  it('"KB or DB" chooses the implement of the same exercise', () => {
    const { blocks } = parse("EMOM 10\n8-12 x Dbl. DB or KB Front Squat");
    expect(blocks[0]!.items.map((i) => [exercise(i.exerciseId), i.implementCount, i.notes])).toEqual([["Dumbbell front squat", 2, "or KB"]]);
  });

  it("an amount per option: 50 double-unders or 100 single-unders", () => {
    const { blocks } = parse("For time\n50 x DU/100 x SU");
    expect(blocks[0]!.items.map((i) => [exercise(i.exerciseId), i.quantity, i.notes])).toEqual([["Double-under", "50", "or 100 x SU"]]);
  });
});

describe("interval formats", () => {
  it("every 2.5 minutes, every 5 minutes, every 30 or 40 seconds", () => {
    const every = (text: string) => parse(`${text}\n5 burpees`).blocks.map((b) => [b.format, b.params.interval_s, b.params.rounds]);
    expect(every("E2.5M x 4 Sets")).toEqual([["every", 150, 4]]);
    expect(every("E5M x 6")).toEqual([["every", 300, 6]]);
    expect(every("E30S x 20")).toEqual([["every", 30, 20]]);
    expect(every("E40S x 15")).toEqual([["every", 40, 15]]);
    expect(every("Every 90 sec x 8")).toEqual([["every", 90, 8]]);
  });

  it('"Alt." before the format: alternating minutes, with lettered or numbered slots', () => {
    const lettered = parse("B. Alt. EMOM x 20 (4 Rounds)\nB1. 8-12 x Push-ups\nB2. 8-12 x Pull Ups\nB3. 10 x Air Squats\nB4. 10 cal Row\nB5. 8 x Burpees");
    expect(lettered.blocks).toHaveLength(1);
    expect(lettered.blocks[0]).toMatchObject({ format: "every", params: { interval_s: 60, rounds: 20, alternating: true } });
    expect(lettered.blocks[0]!.items.map((i) => i.slot)).toEqual([1, 2, 3, 4, 5]);

    const numbered = parse("Alt. E2M x 15 (5 Rounds)\n1.\n10 x Alt. Reverse Lunges\n8 x Thrusters\n2.\n30-40 x Wall Ball\n3.\n30 x Flutter Kicks\n10 x Hollow Rock");
    expect(numbered.blocks).toHaveLength(1);
    expect(numbered.blocks[0]).toMatchObject({ format: "every", params: { interval_s: 120, rounds: 15, alternating: true } });
    expect(numbered.blocks[0]!.items.map((i) => i.slot)).toEqual([1, 1, 2, 3, 3]);
  });

  it("minute markers in other styles: Min 1 / Min 2, odd / even (unchanged)", () => {
    const { blocks } = parse("EMOM 10\nMin 1: 12 cal row\nMin 2: 10 burpees");
    expect(blocks[0]!.items.map((i) => i.slot)).toEqual([1, 2]);
  });

  it("work and rest with stations listed, and the rounds written after them", () => {
    const { blocks } = parse("A. 25 sec On - 15 sec Off\nPush-ups\nAir Squats\nSit-ups\nX 2");
    expect(blocks[0]).toMatchObject({ format: "intervals", params: { rounds: 2, work_s: 25, rest_s: 15, stations: 3 } });
  });
});

describe("parts that follow each other without letters", () => {
  it('"First:", "Then straight to:", "Finish with:" each start a block', () => {
    const { blocks } = parse("First:\n14 Min AMRAP\n10 Burpees\nThen straight to:\nFor time\n40 KB Swing\nStraight to and finish with:\n3 rounds for time\n10 Air Squats");
    expect(blocks.map((b) => b.format)).toEqual(["amrap", "for_time", "for_time"]);
  });
});

describe("section words", () => {
  it("a finisher is conditioning, technique is skill, mobility and stretching are mobility — wherever the word is", () => {
    const intents = (text: string) => parse(text).blocks.map((b) => [b.intent, b.title]);
    expect(intents("E. Empty Barbell Finisher\n10 sets of:\n8 x Back Squat")).toEqual([["conditioning", "Empty Barbell Finisher"]]);
    expect(intents("Finisher: 3 rounds of\n10 burpees")).toEqual([["conditioning", "Finisher"]]);
    expect(intents("A. Snatch Technique\n5 x 2 Hang Power Snatch")).toEqual([["skill", "Snatch Technique"]]);
    expect(intents("F. Stretch and Relax")).toEqual([["mobility", "Stretch and Relax"]]);
    expect(intents("Cool-down\n2 min Pigeon Stretch")).toEqual([["mobility", "Cool-down"]]);
  });
});

describe("effort in words", () => {
  it('"easy-ish pace", "95%+ effort", "all out"', () => {
    expect(parse("AMRAP 40 min @ easy-ish pace\n10 burpees").blocks[0]!.paceEffort).toBe("easy");
    expect(parse("AMRAP 20 @ medium-ish pace\n10 burpees").blocks[0]!.paceEffort).toBe("moderate");
    expect(parse("5 x 200 m Run @ 95%+ Effort").blocks[0]!.items[0]!.paceEffort).toBe("max");
    expect(parse("EMOM 10\n8-11 cal Bike (All Out!)").blocks[0]!.items[0]!.paceEffort).toBe("max");
  });
});

describe("small things", () => {
  it('"Burpee\'s" is burpees', () => {
    expect(lines("For time\n4 x Burpee's")).toEqual([["Burpee"]]);
  });

  it('"Time Cap 18 min" on its own line caps the For time block', () => {
    expect(parse("4 Rounds For Time\n12 x DB Snatch\nTime Cap 18 min").blocks[0]!.params.time_cap_s).toBe(1080);
    expect(parse("For time\n50 burpees\nCap: 12 min").blocks[0]!.params.time_cap_s).toBe(720);
  });

  it('"???" is a day not planned yet: nothing to make', () => {
    const { blocks, lines: read } = parse("???");
    expect(blocks).toHaveLength(0);
    expect(read[0]!.meaning).toBe("Not planned yet");
  });

  it('"21 - 15 - 9" with spaces is the rep scheme', () => {
    const { blocks } = parse("21 - 15 - 9\nThrusters\nPull-ups");
    expect(blocks[0]).toMatchObject({ format: "for_time" });
    expect(blocks[0]!.items.map((i) => i.quantity)).toEqual(["21-15-9", "21-15-9"]);
  });

  it("bracketed counts that only describe the block are not exercises: (4 Rounds), (3 of Each), (Total time 18 min)", () => {
    const { lines: read } = parse("Alt. E5M x 6 Sets (3 of Each)\n1.\n10 x KB Swing\n2.\n10 x Thrusters");
    expect(read[0]!.items).toEqual([]);
    expect(read[0]!.status).toBe("ok");
  });
});

describe("other gyms' ways of writing still read the same", () => {
  it("the §7 workouts and common formats are unchanged by the new rules", () => {
    expect(lines("5 x 5 Back squat @75-80%\nEMOM 10: 10 KB swings")).toEqual([["Back squat"], ["Kettlebell swing"]]);
    expect(parse("Strength\nBack squat 5x5\nMetcon\nAMRAP 12: 10 wall balls, 10 burpees").blocks.map((b) => b.intent)).toEqual(["strength", "conditioning"]);
    expect(idOf("Burpee")).toBeTruthy();
  });
});

describe("effort spans", () => {
  it('"easy to medium-ish pace" is the higher of the two', () => {
    expect(parse("AMRAP 36 min @ easy to medium-ish pace\n10 burpees").blocks[0]!.paceEffort).toBe("moderate");
    expect(parse("AMRAP 20 @ moderate-hard pace\n10 burpees").blocks[0]!.paceEffort).toBe("hard");
  });
});

describe("more common ways of writing", () => {
  it("the lift named first, its sets and reps on the next line", () => {
    const { blocks } = parse("A. Bench Press\n5 sets of 4-8 Reps\nB. Back Squat\n5x5 @ 75%");
    expect(blocks.map((b) => [b.format, b.params.sets, b.items.map((i) => [exercise(i.exerciseId), i.quantity])])).toEqual([
      ["sets", 5, [["Bench press", "4-8 Reps"]]],
      ["sets", 5, [["Back squat", "5"]]],
    ]);
  });

  it('"5 sets of 6/6 reps" is sets of a per-side amount, not 6 s on, 6 s off', () => {
    const { blocks } = parse("B. Single-arm DB Row\n5 Sets of 6/6 Reps");
    expect(blocks[0]).toMatchObject({ format: "sets", params: { sets: 5 } });
    expect(blocks[0]!.items[0]!.quantity).toBe("6/6");
  });

  it('"Min." with a period, "AMRAP for 20 min", and a range of minutes at its middle', () => {
    expect(parse("18 Min. AMRAP\n10 burpees").blocks[0]!.params.time_s).toBe(1080);
    expect(parse("AMRAP for 20 min\n10 burpees").blocks[0]!.params.time_s).toBe(1200);
    const range = parse("AMRAP 20-25 min @ very easy pace\n10 burpees");
    expect(range.blocks[0]!.params.time_s).toBe(1350);
    expect(range.lines[0]!.problems).toContain("20–25 min: counted as 22:30");
  });

  it("work and rest taking turns: the count is of intervals in all, shared by the stations", () => {
    const withRounds = parse("B. Alt. 30 sec On - 20 sec Off x 15 (3 Rounds)\nB1. Push-ups\nB2. Air Squats\nB3. Sit-ups\nB4. Burpees\nB5. 10 cal Row");
    expect(withRounds.blocks[0]).toMatchObject({ format: "intervals", params: { rounds: 3, stations: 5, work_s: 30, rest_s: 20 } });
    const counted = parse("Alt. 40sec ON, 20sec OFF x 12\nPush-ups\nAir Squats\nSit-ups");
    expect(counted.blocks[0]).toMatchObject({ format: "intervals", params: { rounds: 4, stations: 3 } });
  });

  it("a list and then a time cap is for time", () => {
    const { blocks } = parse('B. "Filthy Fifty-ish"\n50 Wall Ball\n50 Burpees\nTime Cap 19 min');
    expect(blocks[0]).toMatchObject({ format: "for_time", params: { rounds: 1, time_cap_s: 1140 }, intent: "conditioning" });
    expect(parse("2 Rounds of:\n20 Thrusters\n20 Burpees\nTime Cap 8 min").blocks[0]).toMatchObject({ format: "for_time", params: { rounds: 2, time_cap_s: 480 } });
  });

  it("a block's name with a section word in it sets the intent", () => {
    expect(parse("B. Empty Barbell Finisher - 2 Rounds of:\n20 x Thrusters").blocks[0]).toMatchObject({ intent: "conditioning", title: "Empty Barbell Finisher" });
  });

  it('several amounts joined by "+" on one line are lines done back to back', () => {
    const { blocks } = parse("EMOM 12\n6 x Hang Power Snatch + 6 x Front Squat");
    expect(blocks[0]!.items.map((i) => [exercise(i.exerciseId), i.quantity])).toEqual([["Hang power snatch", "6"], ["Front squat", "6"]]);
  });

  it("a station without an amount stays a line, even when the app does not know the exercise", () => {
    const { blocks } = parse("30 sec on, 30 sec off x 4\nExplosive High Box Jump\nAir Squats");
    expect(blocks[0]!.items).toHaveLength(2);
  });
});

describe("names and efforts before a format", () => {
  it("a name running straight into the format", () => {
    expect(parse("C. Empty Barbell AMRAP 8 min\n5 x Thrusters").blocks[0]).toMatchObject({ format: "amrap", params: { time_s: 480 }, title: "Empty Barbell" });
  });

  it("an effort before the format is the block's effort", () => {
    const block = parse("B. Easy Pace AMRAP for 20 min\n10 burpees").blocks[0]!;
    expect(block).toMatchObject({ format: "amrap", params: { time_s: 1200 }, paceEffort: "easy", title: "" });
  });

  it('"x 3 rounds" after work and rest is rounds, even when the stations take turns', () => {
    const { blocks } = parse("Alt. 90 sec On - 30 sec Off x 3 Rounds\n10 x Push-ups\n10 x Air Squats");
    expect(blocks[0]).toMatchObject({ format: "intervals", params: { rounds: 3, stations: 2, work_s: 90, rest_s: 30 } });
  });
});
