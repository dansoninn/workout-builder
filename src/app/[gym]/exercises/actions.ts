"use server";

import { refresh } from "next/cache";
import { type ActionResult, gymForAction, NOT_ALLOWED, uuidSchema } from "@/lib/actions";
import { normalizeAlias } from "@/lib/normalize-alias";
import { can } from "@/lib/permissions";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { gymExerciseSchema } from "@/lib/workout/gym-exercise-schema";

/** Adds or edits one of the gym's own exercises (owners and head coaches). */
export async function saveGymExercise(slug: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const gym = await gymForAction(slug, can.editExerciseBank);
  if (!gym) return { ok: false, error: NOT_ALLOWED };
  const parsed = gymExerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const e = parsed.data;

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("save_gym_exercise", {
    p_org: gym.id,
    p_exercise: {
      id: e.id,
      name: e.name,
      slug: slugify(e.name),
      kind: e.kind,
      modality: e.kind === "monostructural" ? e.modality : null,
      plane: e.plane,
      unilateral: e.unilateral,
      default_unit: e.defaultUnit,
      implement_count: e.implementCount,
      pace_default: e.pace,
      patterns: e.kind === "movement" ? e.patterns : {},
      primary_muscles: e.primaryMuscles,
      secondary_muscles: e.secondaryMuscles,
      equipment: e.equipment,
    },
  });
  if (error?.code === "23505") return { ok: false, error: "Your gym already has an exercise with this name." };
  if (error?.code === "23514") return { ok: false, error: "Pattern weights must add up to 1.00." };
  if (error || !id) return { ok: false, error: "Could not save the exercise. Try again." };
  refresh();
  return { ok: true, id };
}

/** Archived exercises stay in old workouts but are no longer offered in the builder. */
export async function archiveGymExercise(slug: string, exerciseId: string): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.editExerciseBank);
  if (!gym || !uuidSchema.safeParse(exerciseId).success) return { ok: false, error: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update({ status: "archived" })
    .eq("id", exerciseId)
    .eq("org_id", gym.id)
    .select("id");
  if (error || data.length === 0) return { ok: false, error: "Could not archive the exercise. Try again." };
  refresh();
  return { ok: true };
}

/** A gym's own name for an exercise ("bs" → back squat), found first when searching. */
export async function addGymAlias(slug: string, exerciseId: string, text: string): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.editExerciseBank);
  if (!gym || !uuidSchema.safeParse(exerciseId).success) return { ok: false, error: NOT_ALLOWED };
  const alias = normalizeAlias(text);
  if (!alias) return { ok: false, error: "Enter a name" };

  const supabase = await createClient();
  const { error } = await supabase.from("exercise_aliases").insert({ org_id: gym.id, alias_normalized: alias, exercise_id: exerciseId });
  if (error?.code === "23505") return { ok: false, error: `“${alias}” already points to another exercise in your gym.` };
  if (error) return { ok: false, error: "Could not add the name. Try again." };
  refresh();
  return { ok: true };
}

export async function removeGymAlias(slug: string, aliasId: string): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.editExerciseBank);
  if (!gym || !uuidSchema.safeParse(aliasId).success) return { ok: false, error: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercise_aliases").delete().eq("id", aliasId).eq("org_id", gym.id).select("id");
  if (error || data.length === 0) return { ok: false, error: "Could not remove the name. Try again." };
  refresh();
  return { ok: true };
}
