"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { type ActionResult, gymForAction, NOT_ALLOWED } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { storeMetricsForCopies } from "@/lib/workout/metrics";

/** The database's answer when the chosen program cannot take a workout (archived, or gone). */
function programError(error: { code?: string; message: string }): string | null {
  if (error.code === "23514" && /archived/.test(error.message)) return error.message;
  if (error.code === "23503") return "That program no longer exists. Reload the page.";
  return null;
}

const moveSchema = z.strictObject({ workoutId: z.uuid(), date: z.iso.date(), trackId: z.uuid() });

/** Moves a workout on the calendar to another day (and program). One audited update; templates and deleted workouts stay put. */
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
  if (error) return { ok: false, error: programError(error) ?? "Could not move the workout. Try again." };
  if (data.length === 0) return { ok: false, error: "That workout was deleted or moved. Reload the page." };
  refresh();
  return { ok: true };
}

const applySchema = z.strictObject({
  templateId: z.uuid(),
  trackId: z.uuid(),
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
    const program = programError(error);
    if (program) return { ok: false, error: program };
    return { ok: false, error: "Could not add the template to those dates. Nothing was added; try again." };
  }
  await storeMetricsForCopies(gym.id, templateId, targets.map((t) => t.id));
  refresh();
  return { ok: true, ids: targets.map((t) => t.id) };
}

const viewSchema = z.union([z.literal("all"), z.uuid()]);

/** Remembers which program this person's calendar shows in this gym, or all of them, for next time on any device. */
export async function rememberCalendarProgram(slug: string, choice: unknown): Promise<ActionResult> {
  const gym = await gymForAction(slug, () => true);
  const parsed = viewSchema.safeParse(choice);
  if (!gym || !parsed.success) return { ok: false, error: NOT_ALLOWED };

  const all = parsed.data === "all";
  const supabase = await createClient();
  const { error } = await supabase
    .from("member_preferences")
    .upsert({ org_id: gym.id, calendar_all_programs: all, calendar_program_id: all ? null : parsed.data }, { onConflict: "org_id,user_id" });
  if (error) return { ok: false, error: "Could not remember the program." };
  return { ok: true };
}

const focusSchema = z.strictObject({ trackId: z.uuid(), date: z.iso.date(), focusId: z.uuid().nullable() });

/** A program's focus for a day (PP, Squat …), or none. Coaches set it ahead of the workouts. */
export async function setDayFocus(slug: string, input: unknown): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.program);
  const parsed = focusSchema.safeParse(input);
  if (!gym || !parsed.success) return { ok: false, error: NOT_ALLOWED };
  const { trackId, date, focusId } = parsed.data;

  const supabase = await createClient();
  const { error } = focusId
    ? await supabase
        .from("program_days")
        .upsert({ org_id: gym.id, track_id: trackId, date, focus_id: focusId }, { onConflict: "track_id,date" })
    : await supabase.from("program_days").delete().eq("org_id", gym.id).eq("track_id", trackId).eq("date", date);
  if (error?.code === "23514") return { ok: false, error: "That day focus was archived. Reload the page." };
  if (error?.code === "23503") return { ok: false, error: "That program or day focus no longer exists. Reload the page." };
  if (error) return { ok: false, error: "Could not set the day's focus. Try again." };
  refresh();
  return { ok: true };
}
