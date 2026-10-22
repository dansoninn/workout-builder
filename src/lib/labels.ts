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

/** CSS custom property for a semantic colour (pattern keys use dashes in CSS). */
export function semanticColor(kind: "pattern" | "intent" | "effort", key: string): string {
  return `var(--${kind}-${key.replace(/_/g, "-")})`;
}
