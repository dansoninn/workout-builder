import "server-only";

import { CALC_VERSION } from "@/lib/engine";
import type { WorkoutResult } from "@/lib/engine/types";
import { createClient } from "@/lib/supabase/server";

import { type Guidelines, parseGuidelines, readGuidelines } from "./guidelines";
import { type PeriodSummary, summarisePeriod, weeksAround } from "./period";

/** One program's own part of a period, and the guidelines it is checked against. */
export interface ProgramPeriod {
  programId: string;
  summary: PeriodSummary;
  guidelines: Guidelines;
  /** True when the program has its own guidelines; false when it uses the gym's (decision 5). */
  ownGuidelines: boolean;
}

/**
 * A period's analytics for the programs asked for (decision 4: one by
 * default, several only when chosen), from the stored metrics of the current
 * calc version (period_metrics). `summary` is the programs together;
 * `byProgram` each one on its own with its guidelines (its own, else the
 * gym's), for what is only meaningful per program (warnings, monotony). The
 * whole weeks around the period are loaded so weekly numbers are right.
 *
 * With a day focus, only the workouts on days their program has that focus
 * ("all Squat days this quarter"); the weekly numbers then describe those
 * days only, and the page says so.
 */
export async function loadPeriod(
  orgId: string,
  from: string,
  to: string,
  programIds: string[],
  focusId: string | null = null,
): Promise<{ summary: PeriodSummary; byProgram: ProgramPeriod[] }> {
  const supabase = await createClient();
  const { loadFrom, loadTo } = weeksAround(from, to);
  const [rows, gym, programs, focusDays] = await Promise.all([
    supabase.rpc("period_metrics", { p_org: orgId, p_from: loadFrom, p_to: loadTo, p_calc_version: CALC_VERSION, p_tracks: programIds }),
    supabase.from("organizations").select("settings").eq("id", orgId).single(),
    supabase.from("tracks").select("id, guidelines").eq("org_id", orgId).in("id", programIds),
    focusId
      ? supabase.from("program_days").select("track_id, date").eq("org_id", orgId).eq("focus_id", focusId).in("track_id", programIds).gte("date", loadFrom).lte("date", loadTo)
      : null,
  ]);
  if (rows.error) throw rows.error;
  if (focusDays?.error) throw focusDays.error;
  const onFocusDay = focusDays ? new Set(focusDays.data.map((d) => `${d.track_id}:${d.date}`)) : null;
  const gymGuidelines = readGuidelines(gym.data?.settings);
  const ownOf = (id: string) => parseGuidelines(programs.data?.find((p) => p.id === id)?.guidelines);
  // Only metrics in the engine's shape (a snapshot from this calc version always is).
  const workouts = rows.data
    .filter((r) => r.metrics !== null && typeof r.metrics === "object" && "hardSets" in r.metrics)
    .filter((r) => !onFocusDay || onFocusDay.has(`${r.track_id}:${r.date}`))
    .map((r) => ({
      id: r.workout_id,
      date: r.date,
      title: r.title,
      trackId: r.track_id,
      result: r.metrics as unknown as WorkoutResult,
    }));
  return {
    summary: summarisePeriod(workouts, from, to),
    byProgram: programIds.map((programId) => {
      const own = ownOf(programId);
      return {
        programId,
        summary: summarisePeriod(workouts.filter((w) => w.trackId === programId), from, to),
        guidelines: own ?? gymGuidelines,
        ownGuidelines: own !== null,
      };
    }),
  };
}
