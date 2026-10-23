"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { type ActionResult, gymForAction, NOT_ALLOWED, uuidSchema } from "@/lib/actions";
import { HOLIDAY_COUNTRIES } from "@/lib/calendar/holidays";
import { fieldErrorsOf, type FormState, keepValues } from "@/lib/forms";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { TRACK_COLORS } from "@/lib/tracks";

/*
 * The gym's days (item 4 of Daniel's list, 2026-10-23): its list of day
 * focuses, and its holidays and closed days. Owners and head coaches keep
 * both, as they keep the programs (RLS: orgs_where_can_manage_tracks).
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const focusSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter a name" }).max(40, { error: "Use at most 40 characters" }),
  color: z.enum(TRACK_COLORS.map((c) => c.value) as [string, ...string[]], { error: "Choose a colour" }),
});

const TAKEN = "There is already a day focus with this name";

/** Adds a day focus (last in the order), or renames and recolours one when `focusId` is given. */
export async function saveFocus(slug: string, focusId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const gym = await gymForAction(slug, can.manageTracks);
  if (!gym || (focusId && !uuidSchema.safeParse(focusId).success)) return { error: NOT_ALLOWED };
  const values = keepValues(formData, ["name", "color"]);
  const parsed = focusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { data: active } = await supabase.from("day_focuses").select("id, name").eq("org_id", gym.id).is("archived_at", null);
  if ((active ?? []).some((f) => f.id !== focusId && f.name.trim().toLowerCase() === parsed.data.name.toLowerCase())) {
    return { fieldErrors: { name: TAKEN }, values };
  }
  if (focusId) {
    const { data, error } = await supabase.from("day_focuses").update(parsed.data).eq("id", focusId).eq("org_id", gym.id).select("id");
    if (error?.code === "23505") return { fieldErrors: { name: TAKEN }, values };
    if (error || data.length === 0) return { error: "Could not save the day focus. Try again.", values };
  } else {
    const { data: last } = await supabase
      .from("day_focuses")
      .select("position")
      .eq("org_id", gym.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("day_focuses").insert({ ...parsed.data, org_id: gym.id, position: (last?.position ?? -1) + 1 });
    if (error?.code === "23505") return { fieldErrors: { name: TAKEN }, values };
    if (error) return { error: "Could not add the day focus. Try again.", values };
  }
  refresh();
  return { ok: true, values };
}

/** Archive keeps a focus on the days that have it, and takes it off the menus. */
export async function setFocusArchived(slug: string, focusId: string, archived: boolean): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.manageTracks);
  if (!gym || !uuidSchema.safeParse(focusId).success) return { ok: false, error: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("day_focuses")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", focusId)
    .eq("org_id", gym.id)
    .select("id");
  if (error?.code === "23505") return { ok: false, error: "An active day focus has the same name. Rename one of them first." };
  if (error || data.length === 0) return { ok: false, error: "Could not update the day focus. Try again." };
  refresh();
  return { ok: true };
}

/** Puts the day focuses in the order given (the order of the calendar's menu). */
export async function reorderFocuses(slug: string, ids: unknown): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.manageTracks);
  const parsed = z.array(z.uuid()).min(1).max(100).safeParse(ids);
  if (!gym || !parsed.success) return { ok: false, error: NOT_ALLOWED };
  const supabase = await createClient();
  const results = await Promise.all(
    parsed.data.map((id, position) => supabase.from("day_focuses").update({ position }).eq("id", id).eq("org_id", gym.id).select("id")),
  );
  if (results.some((r) => r.error || r.data?.length === 0)) return { ok: false, error: "Could not change the order. Reload the page and try again." };
  refresh();
  return { ok: true };
}

const daySchema = z.object({
  date: z.string().regex(DATE, { error: "Choose a date" }),
  name: z.string().trim().min(1, { error: "Say what the day is" }).max(80, { error: "Use at most 80 characters" }),
  closed: z.literal("on").optional(),
});

/** Adds one of the gym's own days: closed (a team day, a move), or open with a name. */
export async function addCalendarDay(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const gym = await gymForAction(slug, can.manageTracks);
  if (!gym) return { error: NOT_ALLOWED };
  const values = keepValues(formData, ["date", "name", "closed"]);
  const parsed = daySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_days")
    .insert({ org_id: gym.id, date: parsed.data.date, name: parsed.data.name, closed: parsed.data.closed === "on" });
  if (error?.code === "23505") return { fieldErrors: { date: "This day is on the list already: change it there" }, values };
  if (error) return { error: "Could not add the day. Try again.", values };
  refresh();
  return { ok: true, values: { date: "", name: "", closed: "on" } };
}

/** Open or closed: a holiday the gym is open on keeps its name on the calendar. */
export async function setDayClosed(slug: string, dayId: string, closed: boolean): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.manageTracks);
  if (!gym || !uuidSchema.safeParse(dayId).success) return { ok: false, error: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_days").update({ closed }).eq("id", dayId).eq("org_id", gym.id).select("id");
  if (error || data.length === 0) return { ok: false, error: "Could not change the day. Try again." };
  refresh();
  return { ok: true };
}

export async function removeCalendarDay(slug: string, dayId: string): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.manageTracks);
  if (!gym || !uuidSchema.safeParse(dayId).success) return { ok: false, error: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_days").delete().eq("id", dayId).eq("org_id", gym.id).select("id");
  if (error || data.length === 0) return { ok: false, error: "Could not remove the day. Try again." };
  refresh();
  return { ok: true };
}

/**
 * Adds a country's public holidays for a year, closed. Days already on the
 * gym's list are left as the gym has them (a removed holiday can be added
 * again this way; a changed one is not overwritten).
 */
export async function addHolidays(slug: string, country: string, year: number): Promise<ActionResult<{ added: number }>> {
  const gym = await gymForAction(slug, can.manageTracks);
  const preset = HOLIDAY_COUNTRIES[country];
  if (!gym || !preset || !Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_days")
    .upsert(
      preset.holidays(year).map((h) => ({ org_id: gym.id, date: h.date, name: h.name, closed: true, holiday_of: country })),
      { onConflict: "org_id,date", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return { ok: false, error: "Could not add the holidays. Try again." };
  refresh();
  return { ok: true, added: data.length };
}
