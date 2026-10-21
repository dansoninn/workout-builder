// Locked taxonomy keys, mirroring the reference tables (taxonomy version 2).
// The database is authoritative: a key that is not in its table fails the
// foreign key when the seed migration is applied.

export const PATTERNS = [
  "squat", "lunge", "hinge", "h_push", "v_push", "h_pull", "v_pull",
  "carry", "core", "rotation", "jump",
] as const;
export type PatternKey = (typeof PATTERNS)[number];

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
