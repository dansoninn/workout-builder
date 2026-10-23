import "server-only";

import { CALC_VERSION } from "@/lib/engine";
import type { WorkoutResult } from "@/lib/engine/types";
import { createClient } from "@/lib/supabase/server";

import { readGuidelines, type Guidelines } from "./guidelines";
import { type PeriodSummary, summarisePeriod, weeksAround } from "./period";

/** One program's own part of a period. */
export interface ProgramPeriod {
  programId: string;
  summary: PeriodSummary;
}

/**
 * A period's analytics for the programs asked for (decision 4: one by
 * default, several only when chosen), from the stored metrics of the current
 * calc version (period_metrics), plus the gym's guidelines. `summary` is the
 * programs together; `byProgram` each one on its own, for what is only
 * meaningful per program (warnings, monotony). The whole weeks around the
 * period are loaded so weekly numbers are right.
 */
export async function loadPeriod(
  orgId: string,
  from: string,
  to: string,
  programIds: string[],
): Promise<{ summary: PeriodSummary; byProgram: ProgramPeriod[]; guidelines: Guidelines }> {
  const supabase = await createClient();
  const { loadFrom, loadTo } = weeksAround(from, to);
  const [rows, gym] = await Promise.all([
    supabase.rpc("period_metrics", { p_org: orgId, p_from: loadFrom, p_to: loadTo, p_calc_version: CALC_VERSION, p_tracks: programIds }),
    supabase.from("organizations").select("settings").eq("id", orgId).single(),
  ]);
  if (rows.error) throw rows.error;
  // Only metrics in the engine's shape (a snapshot from this calc version always is).
  const workouts = rows.data.filter((r) => r.metrics !== null && typeof r.metrics === "object" && "hardSets" in r.metrics).map((r) => ({
    id: r.workout_id,
    date: r.date,
    title: r.title,
    trackId: r.track_id,
    result: r.metrics as unknown as WorkoutResult,
  }));
  return {
    summary: summarisePeriod(workouts, from, to),
    byProgram: programIds.map((programId) => ({ programId, summary: summarisePeriod(workouts.filter((w) => w.trackId === programId), from, to) })),
    guidelines: readGuidelines(gym.data?.settings),
  };
}
