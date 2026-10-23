import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { TrackOption } from "./builder";

/** The gym's tracks for the builder, active first, in their order. */
export async function loadTracks(orgId: string): Promise<TrackOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("id, name, color, archived_at, position, starts_on, ends_on")
    .eq("org_id", orgId)
    .order("position")
    .order("name");
  if (error) throw error;
  return data
    .map((t) => ({ id: t.id, name: t.name, color: t.color, archived: t.archived_at !== null, startsOn: t.starts_on, endsOn: t.ends_on }))
    .sort((a, b) => Number(a.archived) - Number(b.archived));
}

/** The gym's closed days from a year ago on, for the builder's warning (a few dozen rows at most). */
export async function loadClosedDays(orgId: string): Promise<{ date: string; name: string }[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 366 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from("calendar_days").select("date, name").eq("org_id", orgId).eq("closed", true).gte("date", since).order("date");
  if (error) throw error;
  return data;
}

/** The program asked for in the address: ?program=<id>, or ?track=<id> from links made before the rename. */
export function programParam(query: Record<string, string | string[] | undefined>): string | null {
  const value = query.program ?? query.track;
  return typeof value === "string" && /^[0-9a-f-]{36}$/.test(value) ? value : null;
}
