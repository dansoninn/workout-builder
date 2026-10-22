"use server";

import { refresh } from "next/cache";

import { guidelinesSchema } from "@/lib/analytics/guidelines";
import { type ActionResult, gymForAction, NOT_ALLOWED } from "@/lib/actions";
import type { Json } from "@/lib/database.types";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/** Replaces the gym's guidelines (owner only; the database checks the same). An empty set removes them. */
export async function setGuidelines(slug: string, input: unknown): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.editGym);
  if (!gym) return { ok: false, error: NOT_ALLOWED };
  const parsed = guidelinesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the numbers." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_gym_guidelines", { p_org: gym.id, p_guidelines: parsed.data as unknown as Json });
  if (error) return { ok: false, error: error.code === "42501" ? NOT_ALLOWED : error.code === "23514" ? error.message : "Could not save. Try again." };
  refresh();
  return { ok: true };
}
