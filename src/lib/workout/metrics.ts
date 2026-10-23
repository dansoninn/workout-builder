import "server-only";

import { ENGINE_CONFIG } from "@/lib/engine/config";
import { CALC_VERSION } from "@/lib/engine";
import type { Json } from "@/lib/database.types";
import { computeWorkout } from "@/lib/engine/workout";
import { createClient } from "@/lib/supabase/server";

import { toEngineWorkout } from "./draft";
import { loadLibrary } from "./load-library";
import { loadWorkout, loadWorkouts } from "./load-workout";

/**
 * Recomputes a saved workout with the engine on the server, from what is in
 * the database, and stores the result in workout_metrics with the calc and
 * taxonomy versions (calc spec §8). The browser shows the same numbers live;
 * the calendar and analytics read these.
 */
export async function storeMetrics(orgId: string, workoutId: string): Promise<void> {
  const supabase = await createClient();
  const [stored, library, taxonomy] = await Promise.all([
    loadWorkout(orgId, workoutId),
    loadLibrary(orgId),
    supabase.from("taxonomy_versions").select("version").order("version", { ascending: false }).limit(1).single(),
  ]);
  if (!stored || taxonomy.error) throw taxonomy.error ?? new Error("Workout not found");

  const result = computeWorkout(toEngineWorkout(stored.draft, library).workout, ENGINE_CONFIG);
  const { error } = await supabase.from("workout_metrics").upsert(
    {
      workout_id: workoutId,
      org_id: orgId,
      calc_version: CALC_VERSION,
      taxonomy_version: taxonomy.data.version,
      computed_at: new Date().toISOString(),
      metrics: JSON.parse(JSON.stringify(result)) as { [key: string]: Json },
      confidence: {},
    },
    { onConflict: "workout_id,calc_version" },
  );
  if (error) throw error;
}

/**
 * Stores metrics for copies of a workout (a template on several dates): the
 * copies have the same content, so the source is computed once and the result
 * stored for each copy.
 */
export async function storeMetricsForCopies(orgId: string, sourceId: string, copyIds: string[]): Promise<void> {
  if (copyIds.length === 0) return;
  const supabase = await createClient();
  const [stored, library, taxonomy] = await Promise.all([
    loadWorkout(orgId, sourceId),
    loadLibrary(orgId),
    supabase.from("taxonomy_versions").select("version").order("version", { ascending: false }).limit(1).single(),
  ]);
  if (!stored || taxonomy.error) throw taxonomy.error ?? new Error("Workout not found");

  const result = computeWorkout(toEngineWorkout(stored.draft, library).workout, ENGINE_CONFIG);
  const metrics = JSON.parse(JSON.stringify(result)) as { [key: string]: Json };
  const computedAt = new Date().toISOString();
  const { error } = await supabase.from("workout_metrics").upsert(
    copyIds.map((id) => ({
      workout_id: id,
      org_id: orgId,
      calc_version: CALC_VERSION,
      taxonomy_version: taxonomy.data.version,
      computed_at: computedAt,
      metrics,
      confidence: {},
    })),
    { onConflict: "workout_id,calc_version" },
  );
  if (error) throw error;
}

/** Workouts worked out again per round trip, and metrics rows written per request. */
const CHUNK = 100;

/**
 * Works out again every workout of the gym whose stored numbers are not from
 * the calculation version the app runs (after a version bump, calc spec §8),
 * so no screen mixes versions. Runs for coaches (who may write metrics) when
 * they open the calendar or analytics; cheap when nothing is stale.
 */
export async function refreshStaleMetrics(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { data: stale, error } = await supabase.rpc("stale_workouts", { p_org: orgId, p_calc_version: CALC_VERSION });
  if (error) throw error;
  if (stale.length === 0) return 0;

  const [library, taxonomy] = await Promise.all([
    loadLibrary(orgId),
    supabase.from("taxonomy_versions").select("version").order("version", { ascending: false }).limit(1).single(),
  ]);
  if (taxonomy.error) throw taxonomy.error;
  for (let start = 0; start < stale.length; start += CHUNK) {
    const stored = await loadWorkouts(orgId, stale.slice(start, start + CHUNK));
    const rows = stored.map(({ draft }) => ({
      workout_id: draft.id,
      org_id: orgId,
      calc_version: CALC_VERSION,
      taxonomy_version: taxonomy.data.version,
      computed_at: new Date().toISOString(),
      metrics: JSON.parse(JSON.stringify(computeWorkout(toEngineWorkout(draft, library).workout, ENGINE_CONFIG))) as { [key: string]: Json },
      confidence: {},
    }));
    const { error: upsertError } = await supabase.from("workout_metrics").upsert(rows, { onConflict: "workout_id,calc_version" });
    if (upsertError) throw upsertError;
  }
  return stale.length;
}
