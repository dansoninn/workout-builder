import "server-only";

import { CALC_VERSION } from "@/lib/engine";
import type { WorkoutResult } from "@/lib/engine/types";
import { createClient } from "@/lib/supabase/server";

import { readGuidelines, type Guidelines } from "./guidelines";
import { type PeriodSummary, summarisePeriod, weeksAround } from "./period";

/**
 * A period's analytics for a gym (one track or all), from the stored metrics
 * of the current calc version (period_metrics), plus the gym's guidelines.
 * The whole weeks around the period are loaded so weekly numbers are right.
 */
export async function loadPeriod(orgId: string, from: string, to: string, trackId: string | null): Promise<{ summary: PeriodSummary; guidelines: Guidelines }> {
  const supabase = await createClient();
  const { loadFrom, loadTo } = weeksAround(from, to);
  const [rows, gym] = await Promise.all([
    supabase.rpc("period_metrics", { p_org: orgId, p_from: loadFrom, p_to: loadTo, p_calc_version: CALC_VERSION, ...(trackId ? { p_track: trackId } : {}) }),
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
  return { summary: summarisePeriod(workouts, from, to), guidelines: readGuidelines(gym.data?.settings) };
}
