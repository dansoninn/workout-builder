"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { type ActionResult, gymForAction, NOT_ALLOWED } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { storeMetricsForCopies } from "@/lib/workout/metrics";

const moveSchema = z.strictObject({ workoutId: z.uuid(), date: z.iso.date(), trackId: z.uuid().nullable() });

/** Moves a workout on the calendar to another day (and track). One audited update; templates and deleted workouts stay put. */
export async function moveWorkout(slug: string, input: unknown): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.program);
  const parsed = moveSchema.safeParse(input);
  if (!gym || !parsed.success) return { ok: false, error: NOT_ALLOWED };
  const { workoutId, date, trackId } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .update({ date, track_id: trackId })
    .eq("id", workoutId)
    .eq("org_id", gym.id)
    .eq("kind", "scheduled")
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: error.code === "23503" ? "That track no longer exists." : "Could not move the workout. Try again." };
  if (data.length === 0) return { ok: false, error: "That workout was deleted or moved. Reload the page." };
  refresh();
  return { ok: true };
}

const applySchema = z.strictObject({
  templateId: z.uuid(),
  trackId: z.uuid().nullable(),
  dates: z.array(z.iso.date()).min(1).max(60),
});

/**
 * Puts a template on several dates: one scheduled draft per date, each with
 * its own ids and history (copy_workout, one transaction), then each copy's
 * metrics. The template stays as it is.
 */
export async function applyTemplate(slug: string, input: unknown): Promise<ActionResult<{ ids: string[] }>> {
  const gym = await gymForAction(slug, can.program);
  const parsed = applySchema.safeParse(input);
  if (!gym || !parsed.success) return { ok: false, error: NOT_ALLOWED };
  const { templateId, trackId } = parsed.data;
  const dates = [...new Set(parsed.data.dates)].sort();

  const supabase = await createClient();
  const targets = dates.map((date) => ({ id: crypto.randomUUID(), date, track_id: trackId }));
  const { error } = await supabase.rpc("copy_workout", { p_org: gym.id, p_source: templateId, p_targets: targets });
  if (error) {
    if (error.code === "42501") return { ok: false, error: NOT_ALLOWED };
    if (error.code === "P0002") return { ok: false, error: "That template was deleted. Reload the page." };
    return { ok: false, error: "Could not add the template to those dates. Nothing was added; try again." };
  }
  await storeMetricsForCopies(gym.id, templateId, targets.map((t) => t.id));
  refresh();
  return { ok: true, ids: targets.map((t) => t.id) };
}
