// Locked taxonomy keys, mirroring the reference tables (taxonomy version 2).
// The database is authoritative: a key that is not in its table fails the
// foreign key when the seed migration is applied.

export const PATTERNS = [
  "squat", "lunge", "hinge", "h_push", "v_push", "h_pull", "v_pull",
  "carry", "core", "rotation", "jump",
] as const;
export type PatternKey = (typeof PATTERNS)[number];

export type BodyRegion = "lower" | "upper" | "core" | "systemic";

/** movement_patterns.region (calc spec §2.1). */
export const PATTERN_REGION: Record<PatternKey, BodyRegion> = {
  squat: "lower", lunge: "lower", hinge: "lower", jump: "lower",
  h_push: "upper", v_push: "upper", h_pull: "upper", v_pull: "upper",
  core: "core", rotation: "core",
  carry: "systemic",
};

export const PLANES = ["sagittal", "frontal", "transverse", "multiplanar"] as const;
export type PlaneKey = (typeof PLANES)[number];

export const MODALITIES = ["run", "row", "bike", "ski", "jump_rope", "swim"] as const;
export type ModalityKey = (typeof MODALITIES)[number];

export const MUSCLES = [
  "quads", "hamstrings", "glutes", "adductors", "hip_flexors", "calves",
  "chest", "lats", "upper_back", "shoulders", "biceps", "triceps", "forearms_grip",
  "abs", "obliques", "lower_back",
] as const;
export type MuscleKey = (typeof MUSCLES)[number];

export const MEASURE_UNITS = ["reps", "distance_m", "calories", "time_s"] as const;
export type MeasureUnit = (typeof MEASURE_UNITS)[number];

export const EFFORT_KEYS = ["easy", "moderate", "hard", "max"] as const;
export type EffortKey = (typeof EFFORT_KEYS)[number];

export interface EffortLevel {
  rpeCalc: number;
  rirMin: number;
  /** null = open-ended ("4+"). */
  rirMax: number | null;
}

/** effort_levels (calc spec §4.4, approved). */
export const EFFORT_LEVELS: Record<EffortKey, EffortLevel> = {
  easy: { rpeCalc: 4, rirMin: 4, rirMax: null },
  moderate: { rpeCalc: 6, rirMin: 2, rirMax: 3 },
  hard: { rpeCalc: 8, rirMin: 0, rirMax: 1 },
  max: { rpeCalc: 9.5, rirMin: 0, rirMax: 0 },
};
