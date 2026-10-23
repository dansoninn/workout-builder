"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { type ActionResult, gymForAction, NOT_ALLOWED, uuidSchema } from "@/lib/actions";
import { fieldErrorsOf, type FormState, keepValues } from "@/lib/forms";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { TRACK_COLORS } from "@/lib/tracks";

const trackSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter a name" }).max(40, { error: "Use at most 40 characters" }),
  color: z.enum(TRACK_COLORS.map((c) => c.value) as [string, ...string[]], { error: "Choose a colour" }),
});

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function nameTaken(supabase: Supabase, orgId: string, name: string, exceptId?: string): Promise<boolean> {
  const { data } = await supabase.from("tracks").select("id, name").eq("org_id", orgId).is("archived_at", null);
  return (data ?? []).some((t) => t.id !== exceptId && t.name.trim().toLowerCase() === name.toLowerCase());
}

/** Creates a program (stored in `tracks`, last in the order), or renames and recolours one when `trackId` is given. */
export async function saveTrack(
  slug: string,
  trackId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gym = await gymForAction(slug, can.manageTracks);
  if (!gym || (trackId && !uuidSchema.safeParse(trackId).success)) return { error: NOT_ALLOWED };

  const values = keepValues(formData, ["name", "color"]);
  const parsed = trackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  if (await nameTaken(supabase, gym.id, parsed.data.name, trackId ?? undefined)) {
    return { fieldErrors: { name: "There is already a program with this name" }, values };
  }

  if (trackId) {
    const { data, error } = await supabase
      .from("tracks")
      .update(parsed.data)
      .eq("id", trackId)
      .eq("org_id", gym.id)
      .select("id");
    if (error?.code === "23505") return { fieldErrors: { name: "There is already a program with this name" }, values };
    if (error || data.length === 0) return { error: "Could not save the program. Try again.", values };
  } else {
    const { data: last } = await supabase
      .from("tracks")
      .select("position")
      .eq("org_id", gym.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from("tracks")
      .insert({ ...parsed.data, org_id: gym.id, position: (last?.position ?? -1) + 1 });
    if (error?.code === "23505") return { fieldErrors: { name: "There is already a program with this name" }, values };
    if (error) return { error: "Could not create the program. Try again.", values };
  }

  refresh();
  return { ok: true, values };
}

/**
 * Archive hides a program from new programming; its workouts stay. Restore
 * brings it back, unless an active program has its name. A gym keeps at least
 * one active program (the database checks both).
 */
export async function setTrackArchived(slug: string, trackId: string, archived: boolean): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.manageTracks);
  if (!gym || !uuidSchema.safeParse(trackId).success) return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tracks")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", trackId)
    .eq("org_id", gym.id)
    .select("id");
  if (error?.code === "23505") return { ok: false, error: "An active program has the same name. Rename one of them first." };
  if (error?.code === "23514") return { ok: false, error: error.message };
  if (error || data.length === 0) return { ok: false, error: "Could not update the program. Try again." };

  refresh();
  return { ok: true };
}

const orderSchema = z.array(z.uuid()).min(1).max(500);

/** Puts the gym's programs in the order given: every program, archived ones too, each once. */
export async function reorderPrograms(slug: string, ids: unknown): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.manageTracks);
  const parsed = orderSchema.safeParse(ids);
  if (!gym || !parsed.success) return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_programs", { p_org: gym.id, p_ids: parsed.data });
  if (error?.code === "42501") return { ok: false, error: NOT_ALLOWED };
  if (error?.code === "22023") return { ok: false, error: "The programs changed in the meantime. Reload the page and try again." };
  if (error) return { ok: false, error: "Could not change the order. Try again." };

  refresh();
  return { ok: true };
}
