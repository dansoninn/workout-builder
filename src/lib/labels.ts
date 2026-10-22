// English labels for the locked taxonomy and engine terms, matching the
// reference tables (taxonomy v2). The database stays the source of truth.

import type { BlockIntent } from "@/lib/engine/types";
import type { EffortKey, ModalityKey, MuscleKey, PatternKey } from "@/lib/taxonomy";

export const PATTERN_LABELS: Record<PatternKey, string> = {
  squat: "Squat",
  lunge: "Lunge",
  hinge: "Hinge",
  h_push: "Horizontal push",
  v_push: "Vertical push",
  h_pull: "Horizontal pull",
  v_pull: "Vertical pull",
  carry: "Carry",
  core: "Core",
  rotation: "Rotation",
  jump: "Jump",
};

export const MUSCLE_LABELS: Record<MuscleKey, string> = {
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  adductors: "Adductors",
  hip_flexors: "Hip flexors",
  calves: "Calves",
  chest: "Chest",
  lats: "Lats",
  upper_back: "Upper back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms_grip: "Forearms & grip",
  abs: "Abs",
  obliques: "Obliques",
  lower_back: "Lower back",
};

export const MODALITY_LABELS: Record<ModalityKey, string> = {
  run: "Run",
  row: "Row",
  bike: "Bike",
  ski: "Ski",
  jump_rope: "Jump rope",
  swim: "Swim",
};

export const INTENT_LABELS: Record<BlockIntent, string> = {
  strength: "Strength",
  conditioning: "Conditioning",
  skill: "Skill",
  mobility: "Mobility",
};

export const EFFORT_LABELS: Record<EffortKey, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
  max: "Max",
};

/** The four effort boxes (calc spec §4.4, approved 2026-10-22): one framework for pace and load, shown wherever effort is. */
export const EFFORT_BOXES: Record<EffortKey, { percent: string; rpe: string; description: string }> = {
  easy: { percent: "≤45%", rpe: "3–4", description: "Can talk in full sentences. Warm-up, flow, recovery." },
  moderate: { percent: "50–65%", rpe: "5–6", description: "Short sentences. A steady pace you could hold for a long time." },
  hard: { percent: "70–85%", rpe: "7–8", description: "A few words at a time. Challenging, but you control the pace and finish." },
  max: { percent: "≥90%", rpe: "9–10", description: "Nothing left. Sprints, short all-out windows." },
};

/** CSS custom property for a semantic colour (pattern keys use dashes in CSS). */
export function semanticColor(kind: "pattern" | "intent" | "effort", key: string): string {
  return `var(--${kind}-${key.replace(/_/g, "-")})`;
}
