import "server-only";

import { ENGINE_CONFIG } from "@/lib/engine/config";
import { CALC_VERSION } from "@/lib/engine";
import type { Json } from "@/lib/database.types";
import { computeWorkout } from "@/lib/engine/workout";
import { createClient } from "@/lib/supabase/server";

import { toEngineWorkout } from "./draft";
import { loadLibrary } from "./load-library";
import { loadWorkout } from "./load-workout";

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
