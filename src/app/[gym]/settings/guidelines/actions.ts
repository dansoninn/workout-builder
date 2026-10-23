"use server";

import { refresh } from "next/cache";

import { guidelinesSchema } from "@/lib/analytics/guidelines";
import { type ActionResult, gymForAction, NOT_ALLOWED, uuidSchema } from "@/lib/actions";
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

/**
 * A program's own guidelines (decision 5), or null to use the gym's again.
 * Owners and head coaches, who manage programs; the database checks the same.
 */
export async function setProgramGuidelines(slug: string, programId: string, input: unknown): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.manageTracks);
  if (!gym || !uuidSchema.safeParse(programId).success) return { ok: false, error: NOT_ALLOWED };
  const parsed = input === null ? null : guidelinesSchema.safeParse(input);
  if (parsed && !parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the numbers." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tracks")
    .update({ guidelines: parsed ? (parsed.data as unknown as Json) : null })
    .eq("id", programId)
    .eq("org_id", gym.id)
    .select("id");
  if (error?.code === "23514") return { ok: false, error: error.message };
  if (error || data.length === 0) return { ok: false, error: "Could not save. Try again." };
  refresh();
  return { ok: true };
}
