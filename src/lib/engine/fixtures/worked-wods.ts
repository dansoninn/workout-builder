// Calc spec §7: Daniel's three real WODs as engine input.
//
// Exercises come from the approved core library. Paces are TEST-ONLY values
// that reproduce the estimates stated in §7 and §9.5 (row 2:00/500 m and air
// bike 20 cal per 90 s at max effort; ~10 AMRAP rounds; ~22 min chipper;
// ~72 lunges in 4 × 90 s). They are not the proposed pace table
// (docs/pace-defaults.md), which needs Daniel's approval before tests use it.
//
// Efforts follow the approved two-axis model (§4.4). §7 was written with RPE
// numbers; where a block's RPE has no exact level, the nearest word is used:
//   WOD 1 A  "RPE 7": not set → strength default Load Hard (RPE 8)
//   WOD 1 B  "RPE 6": Load Moderate (RPE 6), set by the coach (accessory)
//   WOD 1 C  "RPE 8": Pace Hard (RPE 8)
//   WOD 2    "RPE 9": Pace Max (RPE 9.5)
//   WOD 3    "RPE 8": Pace Hard (RPE 8)

import type { EngineConfig, Exercise, Pace, Workout } from "@/lib/engine/types";
import { exerciseByName, exerciseId, implementCountOf, musclesOf, patternsOf } from "@/lib/library/generate";
import { EFFORT_LEVELS } from "@/lib/taxonomy";

export const FIXTURE_PACES: Record<string, Pace> = {
  "Kettlebell swing": { secPerRep: 2.0 },
  "Air squat": { secPerRep: 1.5 },
  "Double-under": { secPerRep: 0.6 },
  "Wall ball": { secPerRep: 4.5 },
  "Dumbbell snatch": { secPerRep: 4.0 },
  "Toes-to-bar": { secPerRep: 5.5 },
  "Box jump-over": { secPerRep: 6.0 },
  "Burpee": { secPerRep: 7.0 },
  "Run": { secPerM: 0.375 },
  "Row": { secPerM: 0.24 },
  "Air bike": { secPerCal: 4.5 },
  "Walking lunge": { secPerRep: 5.0 },
};

/** Neutral rules: pace effort does not scale the fixture paces. */
export const FIXTURE_CONFIG: EngineConfig = {
  effortLevels: EFFORT_LEVELS,
  transitionSec: 5,
  defaultRestSec: { strength: 120, other: 60 },
  paceEffortFactor: { easy: 1, moderate: 1, hard: 1, max: 1 },
};

/** An engine exercise from the core library, with an optional pace. */
export function coreExercise(name: string, pace: Pace | null = FIXTURE_PACES[name] ?? null): Exercise {
  const core = exerciseByName(name);
  const { primary, secondary } = musclesOf(core);
  return {
    id: exerciseId(core),
    name: core.name,
    kind: core.kind,
    modality: core.kind === "monostructural" ? core.modality : null,
    plane: core.plane,
    patterns: Object.fromEntries(patternsOf(core)),
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    implementCount: implementCountOf(core),
    pace,
  };
}

/** WOD 1 — Strength + accessory + AMRAP. */
export const WOD_1: Workout = {
  blocks: [
    {
      label: "A", intent: "strength", format: "every", params: { interval_s: 180, rounds: 5 },
      items: [
        { exercise: coreExercise("Back squat"), rawLine: "5 back squat @75-80%",
          quantity: { type: "reps", value: 5 }, load: { type: "percent_1rm", min: 75, max: 80 } },
      ],
    },
    {
      label: "B", intent: "strength", format: "every", params: { interval_s: 120, rounds: 4 }, loadEffort: "moderate",
      items: [
        { exercise: coreExercise("Dumbbell bench press"), rawLine: "8-10 DB bench", quantity: { type: "reps_range", min: 8, max: 10 } },
        { exercise: coreExercise("Single-arm dumbbell row"), rawLine: "8/8 SA DB row", quantity: { type: "reps_per_side", value: 8 } },
      ],
    },
    {
      label: "C", intent: "conditioning", format: "amrap", params: { time_s: 480 }, paceEffort: "hard",
      items: [
        { exercise: coreExercise("Kettlebell swing"), rawLine: "5 KB swing", quantity: { type: "reps", value: 5 } },
        { exercise: coreExercise("Air squat"), rawLine: "10 air squat", quantity: { type: "reps", value: 10 } },
        { exercise: coreExercise("Double-under"), rawLine: "15 DU", quantity: { type: "reps", value: 15 } },
      ],
    },
  ],
};

/**
 * WOD 2 — Chipper, 25 min cap. §7 lists only its totals; the movements are
 * reconstructed from them: 800 m run, 50 wall balls (9/6 kg), 30 alternating
 * DB snatches (22.5/15 kg), 20 toes-to-bar, 40 box jump-overs, 10 burpees
 * over the rower, 800 m row.
 */
export const WOD_2: Workout = {
  blocks: [
    {
      label: "A", intent: "conditioning", format: "for_time", params: { rounds: 1, time_cap_s: 1500 }, paceEffort: "max",
      items: [
        { exercise: coreExercise("Run"), rawLine: "800 m run", quantity: { type: "distance_m", value: 800 } },
        { exercise: coreExercise("Wall ball"), rawLine: "50 wall balls 9/6 kg",
          quantity: { type: "reps", value: 50 }, load: { type: "absolute_kg", rx: [9, 6] } },
        { exercise: coreExercise("Dumbbell snatch"), rawLine: "30 alt DB snatch 22.5/15 kg",
          quantity: { type: "reps", value: 30 }, load: { type: "absolute_kg", rx: [22.5, 15] } },
        { exercise: coreExercise("Toes-to-bar"), rawLine: "20 toes to bar", quantity: { type: "reps", value: 20 } },
        { exercise: coreExercise("Box jump-over"), rawLine: "40 box jump overs", quantity: { type: "reps", value: 40 } },
        { exercise: coreExercise("Burpee"), rawLine: "10 burpees over the rower", quantity: { type: "reps", value: 10 } },
        { exercise: coreExercise("Row"), rawLine: "800 m row", quantity: { type: "distance_m", value: 800 } },
      ],
    },
  ],
};

/** WOD 3 — Intervals 4 × 3 stations, 90/30, 90 s between rounds. */
export const WOD_3: Workout = {
  blocks: [
    {
      label: "A", intent: "conditioning", format: "intervals", paceEffort: "hard",
      params: { rounds: 4, stations: 3, work_s: 90, rest_s: 30, rest_between_rounds_s: 90 },
      items: [
        { exercise: coreExercise("Row"), rawLine: "max m row", quantity: { type: "max_effort", unit: "distance_m" } },
        { exercise: coreExercise("Air bike"), rawLine: "max cal bike", quantity: { type: "max_effort", unit: "calories" } },
        { exercise: coreExercise("Walking lunge"), rawLine: "max lunges", quantity: { type: "max_effort", unit: "reps" } },
      ],
    },
  ],
};
