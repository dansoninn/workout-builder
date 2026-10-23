// Calculation engine (calc spec v0.2). Pure TypeScript: same input, same output.
export * from "@/lib/engine/types";
export { ENGINE_CONFIG, fatigueFactor } from "@/lib/engine/config";
export { countsAsHardSet, defaultEfforts, resolveBlockEffort } from "@/lib/engine/effort";
export { paceFromJson, paceToJson, resolvePace } from "@/lib/engine/pace";
export { computeBlock, computeRatios, computeWorkout, sumLenses } from "@/lib/engine/workout";
export { weekOnWeekChange, weekSummary } from "@/lib/engine/weekly";

/**
 * Increment whenever a formula or ENGINE_CONFIG changes; stored with every
 * metrics snapshot (calc spec §8). 2: partner blocks (§4.5, 2026-10-23). 3: one-sided lines, caps, blocks not
 * counted, time boxes, per-set schemes, station by station, ranges (§4.1, §4.3, §5).
 */
export const CALC_VERSION = 3;
