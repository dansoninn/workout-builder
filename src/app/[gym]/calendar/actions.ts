"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { type ActionResult, gymForAction, NOT_ALLOWED } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

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
