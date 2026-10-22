"use server";

import { refresh } from "next/cache";

import { type ActionResult, gymForAction, NOT_ALLOWED, uuidSchema } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resultInputSchema } from "@/lib/workout/results";

/** The database's rule messages are written for coaches; anything else is not. */
function resultError(error: { code?: string; message: string }): string {
  if (error.code === "42501") return NOT_ALLOWED;
  if (error.code === "23514" && !error.message.startsWith("new row")) return error.message;
  if (error.code === "23503") return "That block no longer exists. Reload the page.";
  return "Could not save the result. Try again.";
}

/** Logs what the group did in a block (a new result, or a correction when `id` is given). */
export async function saveResult(slug: string, id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const gym = await gymForAction(slug, can.program);
  if (!gym || (id !== null && !uuidSchema.safeParse(id).success)) return { ok: false, error: NOT_ALLOWED };
  const parsed = resultInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The result could not be read. Check the numbers and try again." };
  const { blockId, sessionLabel, note, ...measure } = parsed.data;

  const supabase = await createClient();
  const row = { session_label: sessionLabel, note, ...measure };
  const { data, error } = id
    ? await supabase.from("block_results").update(row).eq("id", id).eq("org_id", gym.id).is("deleted_at", null).select("id")
    : await supabase.from("block_results").insert({ ...row, org_id: gym.id, block_id: blockId }).select("id");
  if (error) return { ok: false, error: resultError(error) };
  if (!data[0]) return { ok: false, error: "That result was removed. Reload the page." };
  refresh();
  return { ok: true, id: data[0].id };
}

/** Removes a result (soft delete: it stays in the audit log), or brings it back. */
export async function setResultRemoved(slug: string, id: string, removed: boolean): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.program);
  if (!gym || !uuidSchema.safeParse(id).success) return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("block_results")
    .update({ deleted_at: removed ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("org_id", gym.id)
    .select("id");
  if (error) return { ok: false, error: resultError(error) };
  if (!data[0]) return { ok: false, error: "That result no longer exists." };
  refresh();
  return { ok: true };
}
