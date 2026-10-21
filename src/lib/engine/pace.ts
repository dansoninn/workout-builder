// Paces: reading them from stored JSON, gym overrides, and how long one
// performance of an item takes.

import type { Pace } from "@/lib/engine/types";

/**
 * Reads exercises.pace_default / exercise_pace_overrides.pace entries
 * ({ "sec_per_rep": 2, "sec_per_m": 0.25, "sec_per_cal": 4.5 }).
 * Unknown keys and non-positive values are ignored; null if nothing usable.
 */
export function paceFromJson(json: unknown): Pace | null {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return null;
  const source = json as Record<string, unknown>;
  const read = (key: string) => {
    const value = source[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const pace: Pace = {};
  const secPerRep = read("sec_per_rep");
  const secPerM = read("sec_per_m");
  const secPerCal = read("sec_per_cal");
  if (secPerRep !== undefined) pace.secPerRep = secPerRep;
  if (secPerM !== undefined) pace.secPerM = secPerM;
  if (secPerCal !== undefined) pace.secPerCal = secPerCal;
  return Object.keys(pace).length > 0 ? pace : null;
}

export function paceToJson(pace: Pace): Record<string, number> {
  const json: Record<string, number> = {};
  if (pace.secPerRep !== undefined) json.sec_per_rep = pace.secPerRep;
  if (pace.secPerM !== undefined) json.sec_per_m = pace.secPerM;
  if (pace.secPerCal !== undefined) json.sec_per_cal = pace.secPerCal;
  return json;
}

/** A gym's override replaces the core default for that exercise (calc spec §9.5). */
export function resolvePace(coreDefault: Pace | null, gymOverride?: Pace | null): Pace | null {
  return gymOverride ?? coreDefault;
}
