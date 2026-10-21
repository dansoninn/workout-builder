// Calc spec §7: Daniel's three real WODs as engine input, with the approved
// pace table (PACE_DEFAULTS) and rules (ENGINE_CONFIG).
//
// Efforts as decided by Daniel on 2026-10-21:
//   WOD 1 A  Load Moderate (RPE 6)     WOD 1 B  Load Moderate (RPE 6)
//   WOD 1 C  Pace Hard (RPE 8)         WOD 2    Pace Hard (RPE 8)
//   WOD 3    Pace Hard (RPE 8)

import { ENGINE_CONFIG } from "@/lib/engine/config";
import type { EngineConfig, Exercise, Pace, Workout } from "@/lib/engine/types";
import { exerciseByName, exerciseId, implementCountOf, musclesOf, patternsOf } from "@/lib/library/generate";
import { PACE_DEFAULTS } from "@/lib/library/pace-defaults";

/** For rule tests: no effort scaling, no fatigue, no band, so each rule shows alone. */
export const NEUTRAL_CONFIG: EngineConfig = {
  ...ENGINE_CONFIG,
  paceEffortFactor: { easy: 1, moderate: 1, hard: 1, max: 1 },
  fatigue: { ...ENGINE_CONFIG.fatigue, medium: 1, long: 1 },
  paceBand: { fast: 1, slow: 1 },
};

/** An engine exercise from the core library, with its approved pace unless one is given. */
export function coreExercise(name: string, pace: Pace | null = PACE_DEFAULTS[name] ?? null): Exercise {
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
      label: "A", intent: "strength", format: "every", params: { interval_s: 180, rounds: 5 }, loadEffort: "moderate",
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
 * WOD 2 — Chipper, 25 min cap: 800 m run, 50 wall balls (9/6 kg), 30
 * alternating DB snatches (22.5/15 kg), 20 toes-to-bar, 40 box jump-overs,
 * 10 burpees over the rower, 800 m row (reconstructed from §7's totals).
 */
export const WOD_2: Workout = {
  blocks: [
    {
      label: "A", intent: "conditioning", format: "for_time", params: { rounds: 1, time_cap_s: 1500 }, paceEffort: "hard",
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

/** WOD 3 — Intervals 4 × 3 stations, 90/30, 90 s between rounds: max row, max cal bike, max lunges. */
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
