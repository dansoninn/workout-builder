import { describe, expect, it } from "vitest";

import { ENGINE_CONFIG } from "@/lib/engine/config";
import { computeWorkout } from "@/lib/engine/workout";

import { type DraftWorkout, toEngineWorkout, toSavePayload } from "./draft";
import { type Answers, parseWorkoutText, resolveExercise } from "./parse";
import { blockParamsSchemas } from "./rules";
import { coreLibrary, idOf } from "./test-library";

const library = coreLibrary();

function parse(text: string, answers: Answers = {}, lib = library) {
  return parseWorkoutText(text, lib, answers);
}

/** The parsed blocks as a workout, the way "Confirm" makes it. */
function asWorkout(text: string, answers: Answers = {}): DraftWorkout {
  const { title, blocks } = parse(text, answers);
  return { id: crypto.randomUUID(), kind: "scheduled", date: "2026-10-22", trackId: "5b3c4e2a-8f1d-4c6e-9a7b-2d1e0f3c4b5a", title, focus: "", status: "draft", blocks, rawText: text, parserVersion: 1 };
}

function numbers(text: string, answers: Answers = {}) {
  return computeWorkout(toEngineWorkout(asWorkout(text, answers), library).workout, ENGINE_CONFIG);
}

const statuses = (text: string, answers: Answers = {}) => parse(text, answers).lines.filter((l) => l.status !== "blank").map((l) => l.status);

describe("pasting Daniel's three §7 workouts gives the approved numbers", () => {
  it("WOD 1 as written in the spec: 202 AU and ~7.7 rounds", () => {
    const text = [
      "WOD 1",
      "A. E3M x 5, Load Moderate: 5 back squat @75-80%",
      "B. E2M x 4, Load Moderate: 8-10 DB bench, 8/8 SA DB row",
      "C. AMRAP 8, Pace Hard: 5 KB swing, 10 air squat, 15 DU",
    ].join("\n");
    const result = parse(text);
    expect(result.title).toBe("WOD 1");
    expect(result.lines.map((l) => l.status)).toEqual(["ok", "ok", "ok", "ok"]);
    expect(result.blocks.map((b) => [b.format, b.params, b.intent])).toEqual([
      ["every", { interval_s: 180, rounds: 5 }, "strength"],
      ["every", { interval_s: 120, rounds: 4 }, "strength"],
      ["amrap", { time_s: 480 }, "conditioning"],
    ]);
    expect(result.blocks[1]!.items.map((i) => [i.exerciseId, i.quantity])).toEqual([
      [idOf("Dumbbell bench press"), "8-10"],
      [idOf("Single-arm dumbbell row"), "8/8"],
    ]);
    const computed = numbers(text);
    expect(computed.sRpe?.mid).toBeCloseTo(202, 6);
    expect(computed.blocks[2]?.rounds?.mid).toBeCloseTo(7.7, 1);
  });

  it("WOD 1 written down the whiteboard, one line each, reads the same", () => {
    const text = `WOD 1

A. E3M x 5
Load Moderate
5 Back squats @ 75-80%

B. E2M x 4
Load Moderate
8-10 DB bench press
8/8 single arm DB row

C. AMRAP 8
Pace Hard
5 KB swings
10 Air squats
15 Double unders`;
    expect(statuses(text).every((s) => s === "ok")).toBe(true);
    expect(numbers(text).sRpe?.mid).toBeCloseTo(202, 6);
  });

  it("WOD 2, the chipper: ~163 AU, every line understood", () => {
    const text = `For time (25 min cap), Pace Hard
800 m run
50 wall balls (9/6 kg)
30 alt. DB snatches (22.5/15 kg)
20 toes-to-bar
40 box jump-overs
10 burpees over the rower
800 m row`;
    expect(statuses(text).every((s) => s === "ok")).toBe(true);
    const [block] = parse(text).blocks;
    expect(block).toMatchObject({ format: "for_time", params: { rounds: 1, time_cap_s: 1500 }, intent: "conditioning", paceEffort: "hard" });
    expect(block!.items.map((i) => i.exerciseId)).toEqual(
      ["Run", "Wall ball", "Dumbbell snatch", "Toes-to-bar", "Box jump-over", "Burpee", "Row"].map(idOf),
    );
    const computed = numbers(text);
    expect(computed.sRpe?.mid).toBeCloseTo(163.4, 1);
    expect(computed.sRpe?.low).toBeCloseTo(139.5, 1);
  });

  it("WOD 3, intervals: asks which bike and which lunge, then 228 AU", () => {
    const text = `4 rounds, 90/30, 90 s rest between rounds, Pace Hard
Max row
Max cal bike
Max lunges`;
    const first = parse(text);
    expect(first.lines.map((l) => l.status)).toEqual(["ok", "ok", "ask", "ask"]);
    expect(first.lines[2]!.items[0]!.resolution).toMatchObject({ kind: "ambiguous", term: "bike" });
    expect(first.lines[3]!.items[0]!.resolution).toMatchObject({ kind: "ambiguous", term: "lunge" });

    const answers = { bike: idOf("Air bike"), lunge: idOf("Walking lunge") };
    expect(statuses(text, answers)).toEqual(["ok", "ok", "ok", "ok"]);
    const [block] = parse(text, answers).blocks;
    expect(block).toMatchObject({ format: "intervals", params: { rounds: 4, work_s: 90, rest_s: 30, stations: 3, rest_between_rounds_s: 90 } });
    expect(numbers(text, answers).sRpe?.mid).toBeCloseTo(228, 6);
  });

  it("what is saved: the pasted text, and each line as it was written", () => {
    const text = "C. AMRAP 8: 5 KB swing, 10 air squat";
    const payload = toSavePayload(asWorkout(text), library);
    expect(payload).toMatchObject({ raw_text: text, parser_version: 1 });
    expect(payload.blocks[0]!.items.map((i) => i.raw_line)).toEqual(["5 KB swing", "10 air squat"]);
  });
});

describe("common whiteboard formats", () => {
  const block = (text: string, answers: Answers = {}) => parse(text, answers).blocks[0]!;

  it.each([
    ["AMRAP 12", "amrap", { time_s: 720 }],
    ["12 min AMRAP", "amrap", { time_s: 720 }],
    ["AMRAP 7:30", "amrap", { time_s: 450 }],
    ["EMOM 10", "every", { interval_s: 60, rounds: 10 }],
    ["E3MOM x 5", "every", { interval_s: 180, rounds: 5 }],
    ["E90S x 8", "every", { interval_s: 90, rounds: 8 }],
    ["Every 2:00 x 6", "every", { interval_s: 120, rounds: 6 }],
    ["Every 2 min for 10 min", "every", { interval_s: 120, rounds: 5 }],
    ["For time", "for_time", { rounds: 1 }],
    ["3 RFT", "for_time", { rounds: 3 }],
    ["5 rounds for time, 20 min cap", "for_time", { rounds: 5, time_cap_s: 1200 }],
    ["Chipper, time cap 30", "for_time", { rounds: 1, time_cap_s: 1800 }],
    ["21-15-9 for time", "for_time", { rounds: 1 }],
    ["Tabata", "tabata", { rounds: 8, work_s: 20, rest_s: 10 }],
    ["8 x 40/20", "intervals", { rounds: 8, work_s: 40, rest_s: 20, stations: 1 }],
    ["40 s on / 20 s off x 8", "intervals", { rounds: 8, work_s: 40, rest_s: 20, stations: 1 }],
    ["4 sets", "sets", { sets: 4 }],
  ] as const)("%s", (heading, format, params) => {
    const b = block(`${heading}\n10 burpees`);
    expect(b.format).toBe(format);
    expect(b.params).toEqual(params);
    expect(blockParamsSchemas[format].safeParse(b.params).success).toBe(true);
  });

  it("21-15-9 gives its reps to every line", () => {
    const b = block("21-15-9\nThrusters (43/30 kg)\nPull-ups");
    expect(b.items.map((i) => [i.exerciseId, i.quantity, i.load])).toEqual([
      [idOf("Thruster"), "21-15-9", "43/30 kg"],
      [idOf("Pull-up"), "21-15-9", ""],
    ]);
  });

  it("alternating EMOM: minutes with one or more lines", () => {
    const b = block("EMOM 12\nMin 1: 10 cal row + 5 burpees\nMin 2: 12 wall balls (9/6)");
    expect(b.params).toEqual({ interval_s: 60, rounds: 12, alternating: true });
    expect(b.items.map((i) => [i.exerciseId, i.quantity, i.slot])).toEqual([
      [idOf("Row"), "10 cal", 1],
      [idOf("Burpee"), "5", 1],
      [idOf("Wall ball"), "12", 2],
    ]);
  });

  it("strength: sets x reps on the line, before or after the exercise, or on the next line", () => {
    expect(block("Back squat 5x5 @ 75%")).toMatchObject({ format: "sets", params: { sets: 5 }, intent: "strength" });
    expect(block("5 x 3 deadlift @ 80-85%").items[0]).toMatchObject({ exerciseId: idOf("Deadlift"), quantity: "3", load: "80-85%" });
    const twoLines = parse("A. Back squat\n5 x 5 @ 80%");
    expect(twoLines.blocks).toHaveLength(1);
    expect(twoLines.blocks[0]!.items).toHaveLength(1);
    expect(twoLines.blocks[0]!.items[0]).toMatchObject({ exerciseId: idOf("Back squat"), quantity: "5", load: "80%" });
    expect(twoLines.lines.map((l) => l.status)).toEqual(["ok", "ok"]);
  });

  it("supersets: A1 and A2 are lines of one block; rest between sets", () => {
    const b = block("A1. Bench press 4 x 8\nA2. Ring row 4 x 10\nRest 2:00 between sets");
    expect(b).toMatchObject({ format: "sets", params: { sets: 4, rest_s: 120 } });
    expect(b.items.map((i) => i.exerciseId)).toEqual([idOf("Bench press"), idOf("Ring row")]);
  });

  it("section words set the intent; a section word before the format is one block", () => {
    const { blocks } = parse("Strength\nBack squat 5 x 5\n\nMetcon\nAMRAP 10\n10 burpees");
    expect(blocks.map((b) => [b.intent, b.format, b.title])).toEqual([
      ["strength", "sets", "Strength"],
      ["conditioning", "amrap", "Metcon"],
    ]);
  });

  it("an EMOM of conditioning is conditioning; an EMOM of weighted lifts is strength", () => {
    expect(block("EMOM 10\n10 cal row").intent).toBe("conditioning");
    expect(block("EMOM 10\n3 power cleans").intent).toBe("strength");
    expect(block("EMOM 10\n5 KB swings\n10 air squats").intent).toBe("conditioning");
  });

  it("amounts and loads as coaches write them", () => {
    const items = parse("For time\n1 km run\n500m row\n15 cal bike\n8 each side reverse lunges\nPlank :45\n2 x 22.5 kg 20 lunges\n20 wall balls @ 9 kg", { bike: idOf("Air bike"), lunge: idOf("Walking lunge") }).blocks[0]!.items;
    expect(items.map((i) => [i.quantity, i.load])).toEqual([
      ["1 km", ""],
      ["500m", ""],
      ["15 cal", ""],
      ["8/8", ""],
      ["0:45", ""],
      ["20", "2 x 22.5 kg"],
      ["20", "9 kg"],
    ]);
  });

  it("rest after a block, partner, and the app's own effort words", () => {
    const { blocks } = parse("AMRAP 10, partner\n10 burpees\nRest 3 min\nFor time\nPace Moderate\n20 pull-ups");
    expect(blocks[0]).toMatchObject({ partner: "split", restAfterSec: 180 });
    expect(blocks[1]).toMatchObject({ paceEffort: "moderate", partner: null });
  });
});

describe("partner blocks (calc spec §4.5): how partners share the work", () => {
  const partnerOf = (text: string) => parse(text).blocks.map((b) => b.partner);

  it("splitting the work, in any common wording", () => {
    expect(partnerOf("Partner WOD, for time\n100 wall balls")).toEqual(["split"]);
    expect(partnerOf("For time, split reps at will\n100 wall balls")).toEqual(["split"]);
    expect(partnerOf("AMRAP 20 in pairs\n10 burpees")).toEqual(["split"]);
    expect(partnerOf("For time\nSplit the work as needed\n100 wall balls")).toEqual(["split"]);
    expect(partnerOf("Partner Up - 40 Min AMRAP - Split at will\n10 burpees")).toEqual(["split"]);
  });

  it("taking turns: I go, you go (any spelling), or take turns", () => {
    expect(partnerOf("AMRAP 12 - I go, you go\n10 burpees")).toEqual(["alternate"]);
    expect(partnerOf("Partner AMRAP 14 min - I Go U Go\n10 burpees")).toEqual(["alternate"]);
    expect(partnerOf("EMOM 20, partners take turns\n8 burpees")).toEqual(["alternate"]);
    expect(partnerOf("5 rounds for time\nYou go, I go\n10 burpees")).toEqual(["alternate"]);
  });

  it("amounts written for each athlete: each does them all", () => {
    expect(partnerOf("Partner Up! - I GO U GO\nFor time, 5 rounds each\n10 burpees\n10 air squats")).toEqual(["each"]);
    expect(partnerOf("For time, I go you go, 5 rounds each\n10 burpees")).toEqual(["each"]);
  });

  it("not partner work: split jerks and squats, a pair of dumbbells, reps for each side", () => {
    expect(partnerOf("5 x 3\nSplit jerk")).toEqual([null]);
    expect(partnerOf("4 sets of 8\nBarbell split squat")).toEqual([null]);
    expect(partnerOf("3 rounds for time (use a pair of light DB)\n10 DB thrusters")).toEqual([null]);
    expect(partnerOf("4 x 6-8 (each)\nSingle-arm DB row")).toEqual([null]);
  });

  it("teams of 3 are read as partners and say so", () => {
    const { blocks, lines } = parse("For time - in teams of 3\n100 wall balls");
    expect(blocks[0]!.partner).toBe("split");
    expect(lines[0]!.problems).toContain("Teams of 3: counted as partners (half each) for now");
  });
});

describe("effort in pasted text (calc spec §4.4)", () => {
  const item = (text: string, answers: Answers = {}) => parse(`For time\n${text}`, answers).blocks[0]!.items[0]!;
  const line = (text: string) => parse(`For time\n${text}`).lines[1]!;

  it('"%" is a load on a lift and effort elsewhere; "% effort" is always effort', () => {
    expect(item("5 back squat @ 80%")).toMatchObject({ load: "80%", loadEffort: null, paceEffort: null });
    expect(item("5 back squat @ 75-80% of 1RM")).toMatchObject({ load: "75-80%" });
    expect(item("5 deadlift @ 80% of max")).toMatchObject({ load: "80%" });
    expect(item("5 back squat @ 75-80% effort")).toMatchObject({ load: "", loadEffort: "hard" });
    expect(item("Row 500 m @ 80%")).toMatchObject({ load: "", paceEffort: "hard" });
    expect(item("10 burpees @ 50% effort")).toMatchObject({ paceEffort: "moderate" });
  });

  it("effort words, RPE and @ n/10 go to the boxes, on Load for lifts and Pace otherwise", () => {
    expect(item("5 back squat (heavy)")).toMatchObject({ loadEffort: "hard", paceEffort: null });
    expect(item("10 burpees, light")).toMatchObject({ paceEffort: "easy" });
    expect(item("400 m run fast")).toMatchObject({ paceEffort: "hard" });
    expect(item("200 m run - sprint")).toMatchObject({ paceEffort: "max" });
    expect(item("500 m row RPE 6")).toMatchObject({ paceEffort: "moderate" });
    expect(item("3 deadlift @ 7/10")).toMatchObject({ loadEffort: "hard" });
  });

  it("Load has no Max, and the check screen says which word set which effort", () => {
    expect(item("1 deadlift @ 9/10")).toMatchObject({ loadEffort: "hard" });
    expect(line("1 deadlift @ 9/10").meaning).toContain("“9/10” → Load Hard (Load has no Max)");
    expect(line("5 back squat (heavy)").meaning).toContain("“heavy” → Load Hard");
    expect(line("200 m run - sprint").meaning).toContain("“sprint” → Pace Max");
  });

  it("a block's effort: on its heading or a line of its own; heavy is Load when the block lifts", () => {
    const { blocks, lines } = parse("AMRAP 12, moderate pace\n10 burpees\n\nA. Back squat 5x5\nHeavy");
    expect(blocks[0]).toMatchObject({ paceEffort: "moderate" });
    expect(blocks[1]).toMatchObject({ loadEffort: "hard", paceEffort: null });
    expect(lines[4]!.meaning).toBe("Effort for block B: “Heavy” → Load Hard");
    expect(parse("Metcon (hard)\nAMRAP 10\n10 burpees").blocks[0]).toMatchObject({ paceEffort: "hard" });
  });
});

describe("nothing is guessed", () => {
  it("a generic word is asked once, and the answer covers its plural", () => {
    const r = parse("For time\n50 squats\n20 squat");
    expect(r.lines.slice(1).map((l) => l.items[0]!.resolution?.kind)).toEqual(["ambiguous", "ambiguous"]);
    const answered = parse("For time\n50 squats\n20 squat", { squat: idOf("Air squat") });
    expect(answered.blocks[0]!.items.map((i) => i.exerciseId)).toEqual([idOf("Air squat"), idOf("Air squat")]);
  });

  it("the gym's own name for a generic word is used without asking", () => {
    const gym = coreLibrary({ aliases: { squat: "Back squat" } });
    expect(resolveExercise(gym, "squats")).toMatchObject({ kind: "matched", via: "gym", exercise: { name: "Back squat" } });
  });

  it("an unknown exercise is left for the coach to pick, with suggestions", () => {
    const r = parse("For time\n20 zercher squats");
    expect(r.lines[1]).toMatchObject({ status: "ask", blocking: false });
    expect(r.lines[1]!.items[0]!.resolution).toMatchObject({ kind: "unmatched" });
    expect(r.blocks[0]!.items[0]).toMatchObject({ exerciseId: null, quantity: "20" });
  });

  it("a missing number stops the workout from being made until the text says it", () => {
    const r = parse("AMRAP\n10 burpees\nFor time\nburpees");
    expect(r.lines[0]).toMatchObject({ status: "ask", blocking: true, problems: ["Add the AMRAP's time, e.g. AMRAP 12"] });
    expect(r.lines[3]).toMatchObject({ status: "ask", blocking: true, problems: ["Add the amount, e.g. 10 burpees"] });
  });

  it("men/women amounts are read, the first one counting (decision 17); pounds are asked for, not converted", () => {
    const r = parse("For time\n15/12 cal row\n400/300 m run\n20 wall balls (20/14 lb)", {});
    expect(r.blocks[0]!.items.slice(0, 2).map((i) => i.quantity)).toEqual(["15/12 cal", "400/300 m"]);
    expect(r.lines[1]).toMatchObject({ status: "ok", meaning: "15/12 cal (15 cal in the numbers) · Row" });
    expect(r.lines[3]).toMatchObject({ blocking: true, problems: [expect.stringContaining("Pounds")] });
  });

  it('"3 rounds" without "for time" is read as sets, and says so', () => {
    const r = parse("3 rounds\n10 push-ups\n15 sit-ups");
    expect(r.blocks[0]).toMatchObject({ format: "sets", params: { sets: 3 }, intent: "conditioning" });
    expect(r.lines[0]).toMatchObject({ status: "ask", blocking: false });
  });

  it("lines it cannot place are kept as the block's notes", () => {
    const r = parse("AMRAP 12\n10 burpees\nScale: step-ups\nScore: rounds + reps\nLeave nothing behind!");
    expect(r.lines.slice(2).map((l) => l.status)).toEqual(["note", "note", "note"]);
    expect(r.blocks[0]!.notes).toBe("Scale: step-ups\nScore: rounds + reps\nLeave nothing behind!");
  });

  it("a block without a format is done once, and says so", () => {
    const r = parse("Mobility\nCouch stretch 1:00");
    expect(r.blocks[0]).toMatchObject({ format: "sets", params: { sets: 1 }, intent: "mobility" });
    expect(r.lines[1]!.problems).toEqual([expect.stringContaining("No format found")]);
  });
});
