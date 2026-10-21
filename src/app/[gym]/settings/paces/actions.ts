"use server";

import { refresh } from "next/cache";

import { type ActionResult, gymForAction, NOT_ALLOWED, uuidSchema } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { paceSchema } from "@/lib/workout/rules";

/** Sets the gym's pace for an exercise, or clears it (back to the default) when `pace` is null. */
export async function setGymPace(slug: string, exerciseId: string, pace: unknown): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.editExerciseBank);
  if (!gym || !uuidSchema.safeParse(exerciseId).success) return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  if (pace === null) {
    const { error } = await supabase.from("exercise_pace_overrides").delete().eq("org_id", gym.id).eq("exercise_id", exerciseId);
    if (error) return { ok: false, error: "Could not reset the pace. Try again." };
    refresh();
    return { ok: true };
  }

  const parsed = paceSchema.safeParse(pace);
  if (!parsed.success) return { ok: false, error: "Enter a pace above zero." };
  const { error } = await supabase
    .from("exercise_pace_overrides")
    .upsert({ org_id: gym.id, exercise_id: exerciseId, pace: parsed.data }, { onConflict: "org_id,exercise_id" });
  if (error) return { ok: false, error: "Could not save the pace. Try again." };
  refresh();
  return { ok: true };
}
