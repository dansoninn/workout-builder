import { describe, expect, it } from "vitest";

import { ENGINE_CONFIG } from "@/lib/engine/config";
import { coreExercise } from "@/lib/engine/fixtures/worked-wods";
import { computeWorkout } from "@/lib/engine/workout";
import { exerciseByName } from "@/lib/library/generate";
import type { MeasureUnit } from "@/lib/taxonomy";

import {
  blockLabel,
  draftProblems,
  type DraftBlock,
  type DraftItem,
  type DraftWorkout,
  newBlock,
  newItem,
  toEngineWorkout,
  toSavePayload,
} from "./draft";
import type { Library, LibraryExercise } from "./library";
import { blockParamsSchemas, loadSchema, quantitySchema } from "./rules";

/** A library built from the core exercises, as the database would load it. */
function libraryOf(names: string[]): Library {
  const exercises: LibraryExercise[] = names.map((name) => {
    const e = coreExercise(name);
    return {
      ...e,
      orgId: null,
      defaultUnit: exerciseByName(name).unit as MeasureUnit,
      unilateral: false,
      equipment: [],
      defaultPace: e.pace,
      gymPace: null,
      aliases: [],
    };
  });
  return { exercises, ambiguous: {} };
}

const NAMES = ["Back squat", "Dumbbell bench press", "Single-arm dumbbell row", "Kettlebell swing", "Air squat", "Double-under", "Row", "Burpee", "Wall ball"];
const library = libraryOf(NAMES);
const idOf = (name: string) => library.exercises.find((e) => e.name === name)!.id;

const line = (name: string | null, quantity: string, extra: Partial<DraftItem> = {}): DraftItem => ({
  ...newItem(),
  exerciseId: name ? idOf(name) : null,
  quantity,
  ...extra,
});
const block = (b: Partial<DraftBlock> & Pick<DraftBlock, "format" | "params" | "intent" | "items">): DraftBlock => ({ ...newBlock(), ...b });

/** WOD 1 (calc spec §7) entered the way a coach types it. */
const WOD_1: DraftWorkout = {
  id: crypto.randomUUID(),
  kind: "scheduled",
  date: "2026-10-22",
  trackId: null,
  title: "WOD 1",
  focus: "",
  status: "draft",
  blocks: [
    block({ intent: "strength", format: "every", params: { interval_s: 180, rounds: 5 }, loadEffort: "moderate",
      items: [line("Back squat", "5", { load: "75-80%" })] }),
    block({ intent: "strength", format: "every", params: { interval_s: 120, rounds: 4 }, loadEffort: "moderate",
      items: [line("Dumbbell bench press", "8-10"), line("Single-arm dumbbell row", "8/8")] }),
    block({ intent: "conditioning", format: "amrap", params: { time_s: 480 }, paceEffort: "hard",
      items: [line("Kettlebell swing", "5"), line("Air squat", "10"), line("Double-under", "15"), newItem()] }),
  ],
};

describe("the builder's draft", () => {
  it("WOD 1 typed into the builder gives the approved numbers: 202 AU, ~7.7 rounds", () => {
    const { workout } = toEngineWorkout(WOD_1, library);
    const result = computeWorkout(workout, ENGINE_CONFIG);
    expect(result.sRpe?.mid).toBeCloseTo(202, 6);
    expect(result.blocks[2]?.rounds?.mid).toBeCloseTo(7.7, 1);
    expect(result.warnings).toEqual([]);
  });

  it("labels blocks A, B, C … and ignores untouched empty lines", () => {
    expect([0, 1, 25, 26, 27].map(blockLabel)).toEqual(["A", "B", "Z", "AA", "AB"]);
    const { workout, itemIndex } = toEngineWorkout(WOD_1, library);
    expect(workout.blocks[2]?.items).toHaveLength(3);
    expect(itemIndex[2]).toEqual([0, 1, 2]);
  });

  it("saves exactly what the database accepts", () => {
    expect(draftProblems(WOD_1, library)).toEqual([]);
    const payload = toSavePayload(WOD_1, library);
    expect(payload.blocks.map((b) => b.label)).toEqual(["A", "B", "C"]);
    for (const b of payload.blocks) {
      expect(blockParamsSchemas[b.format].safeParse(b.params).success).toBe(true);
      for (const item of b.items) {
        expect(quantitySchema.safeParse(item.quantity).success).toBe(true);
        if (item.load) expect(loadSchema.safeParse(item.load).success).toBe(true);
      }
    }
    expect(payload.blocks[0]?.items[0]).toMatchObject({
      raw_line: "5 Back squat @75–80%",
      quantity: { type: "reps", value: 5 },
      load: { type: "percent_1rm", min: 75, max: 80 },
      implement_count: null,
      slot: null,
    });
    expect(payload.blocks[2]?.items).toHaveLength(3);
  });

  it("says which line needs fixing", () => {
    const broken: DraftWorkout = {
      ...WOD_1,
      blocks: [block({ intent: "strength", format: "sets", params: { sets: 0 }, items: [line("Back squat", "10-8"), line("Air squat", "5", { load: "heavy" })] })],
    };
    expect(draftProblems(broken, library)).toEqual([
      { block: 0, item: null, field: "sets", message: "Check the block's numbers" },
      { block: 0, item: 0, field: "quantity", message: "The second number must be larger, e.g. 8-10" },
      { block: 0, item: 1, field: "load", message: "Try 75-80%, 22.5/15 kg, 2x22.5 or bw" },
    ]);
  });

  it("keeps a line without an exercise (it blocks publishing, not saving)", () => {
    const draft: DraftWorkout = { ...WOD_1, blocks: [block({ intent: "conditioning", format: "for_time", params: { rounds: 1 }, paceEffort: "hard",
      items: [line(null, "20")] })] };
    expect(draftProblems(draft, library)).toEqual([]);
    expect(toSavePayload(draft, library).blocks[0]?.items[0]).toMatchObject({ exercise_id: null, raw_line: "20 ?" });
    expect(computeWorkout(toEngineWorkout(draft, library).workout, ENGINE_CONFIG).issues).toEqual([
      { block: 0, items: [0], message: 'unmatched line skipped: "20 ?"' },
    ]);
  });

  it("alternating EMOM: slots are renumbered 1…k and 2 × load is kept as the line's own count", () => {
    const draft: DraftWorkout = { ...WOD_1, blocks: [block({ intent: "conditioning", format: "every",
      params: { interval_s: 60, rounds: 6, alternating: true }, paceEffort: "moderate",
      items: [line("Row", "10 cal", { slot: 2 }), line("Burpee", "5", { slot: 2 }), line("Wall ball", "12", { slot: 5, load: "2x9/6" })] })] };
    const payload = toSavePayload(draft, library);
    expect(payload.blocks[0]?.params).toEqual({ interval_s: 60, rounds: 6, alternating: true });
    expect(payload.blocks[0]?.items.map((i) => i.slot)).toEqual([1, 1, 2]);
    expect(payload.blocks[0]?.items[2]).toMatchObject({ implement_count: 2, raw_line: "12 Wall ball 2 × 9/6 kg" });
    // 6 rotations × 2 slots × 1 min.
    expect(computeWorkout(toEngineWorkout(draft, library).workout, ENGINE_CONFIG).durationMin?.mid).toBe(12);
  });

  it("drops params the chosen format does not have", () => {
    const draft: DraftWorkout = { ...WOD_1, blocks: [block({ intent: "conditioning", format: "amrap",
      params: { time_s: 600, rounds: 3, interval_s: 60 }, items: [line("Air squat", "10")] })] };
    expect(toSavePayload(draft, library).blocks[0]?.params).toEqual({ time_s: 600 });
  });
});
