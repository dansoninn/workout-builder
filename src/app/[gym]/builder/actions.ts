"use server";

import { redirect } from "next/navigation";

import { type ActionResult, gymForAction, NOT_ALLOWED, uuidSchema } from "@/lib/actions";
import type { Json } from "@/lib/database.types";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { draftProblems, toSavePayload } from "@/lib/workout/draft";
import { draftSchema } from "@/lib/workout/draft-schema";
import { loadLibrary } from "@/lib/workout/load-library";
import { storeMetrics } from "@/lib/workout/metrics";

/** The database's own messages for rules a coach can break are written for people. */
function savedError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return NOT_ALLOWED;
  if (error.code === "23514" && /published|slot|alternating|results|archived/i.test(error.message)) return error.message;
  if (error.code === "23502") return "Choose a program.";
  if (error.code === "23505") return "This workout belongs to another gym or was deleted.";
  if (error.code === "23503") return "The program or an exercise no longer exists. Pick another.";
  return "Could not save. Your changes are kept in this browser; try again.";
}

/**
 * Saves the workout (one transaction, save_workout), then recomputes it on the
 * server and stores the metrics. Returns when both are done.
 */
export async function saveWorkout(slug: string, input: unknown): Promise<ActionResult<{ id: string; savedAt: string }>> {
  const gym = await gymForAction(slug, can.program);
  if (!gym) return { ok: false, error: NOT_ALLOWED };

  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The workout could not be read. Reload the page and try again." };
  const draft = parsed.data as Parameters<typeof toSavePayload>[0];

  const library = await loadLibrary(gym.id);
  const [problem] = draftProblems(draft, library);
  if (problem) return { ok: false, error: problem.message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_workout", {
    p_org: gym.id,
    p_workout: toSavePayload(draft, library) as unknown as Json,
  });
  if (error) return { ok: false, error: savedError(error) };

  await storeMetrics(gym.id, draft.id);
  return { ok: true, id: draft.id, savedAt: new Date().toISOString() };
}

/** Publish (every line must have an exercise; the database checks) or back to draft. */
export async function setWorkoutStatus(
  slug: string,
  workoutId: string,
  status: "draft" | "published",
): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.program);
  if (!gym || !uuidSchema.safeParse(workoutId).success) return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .update({ status })
    .eq("id", workoutId)
    .eq("org_id", gym.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: savedError(error) };
  if (data.length === 0) return { ok: false, error: "Save the workout first." };
  return { ok: true };
}

/** Moves a workout to the bin (soft delete; SPEC-data-model §1) and opens the calendar. */
export async function deleteWorkout(slug: string, workoutId: string): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.program);
  if (!gym || !uuidSchema.safeParse(workoutId).success) return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workouts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", workoutId)
    .eq("org_id", gym.id);
  if (error) return { ok: false, error: "Could not delete the workout. Try again." };
  redirect(`/${slug}/calendar`);
}
