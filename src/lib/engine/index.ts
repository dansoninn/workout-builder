// Calculation engine (calc spec v0.2). Pure TypeScript: same input, same output.
export * from "@/lib/engine/types";
export { countsAsHardSet, defaultEfforts, resolveBlockEffort } from "@/lib/engine/effort";
export { paceFromJson, paceToJson, resolvePace } from "@/lib/engine/pace";
export { computeBlock, computeRatios, computeWorkout, sumLenses } from "@/lib/engine/workout";
export { weekOnWeekChange, weekSummary } from "@/lib/engine/weekly";

/** Increment whenever a formula changes; stored with every metrics snapshot (calc spec §8). */
export const CALC_VERSION = 1;
