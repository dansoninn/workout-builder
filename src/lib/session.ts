import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { authPath } from "@/lib/paths";
import type { Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer for "who is this and where may they go". Every page and
 * Server Action starts here. Results are memoised per request with React
 * `cache`, so the layout and the page share one lookup.
 */

export type CurrentUser = { id: string; email: string; displayName: string | null };

export type GymMembership = { id: string; name: string; slug: string; country: string | null; role: Role };

/** The signed-in user (verified on the server), or null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", data.claims.sub).maybeSingle();
  return { id: data.claims.sub, email: data.claims.email ?? "", displayName: profile?.display_name ?? null };
});

/** The signed-in user, or a redirect to sign in (coming back to `next`). */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(authPath("/sign-in", next));
  return user;
}

/** Every gym the signed-in user belongs to, with their role, by name. */
export const getMyGyms = cache(async (): Promise<GymMembership[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organizations (id, name, slug, country)")
    .eq("user_id", user.id);
  if (error) throw error;

  return data
    .flatMap(({ role, organizations: gym }) => (gym ? [{ ...gym, role }] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
});

/** The gym at this address if the user belongs to it. */
export const getGym = cache(async (slug: string): Promise<GymMembership | null> => {
  const gyms = await getMyGyms();
  return gyms.find((g) => g.slug === slug) ?? null;
});

/**
 * The gym at this address with the user's role, or "not found". Gyms you do
 * not belong to are indistinguishable from gyms that do not exist.
 */
export async function requireGym(slug: string): Promise<GymMembership> {
  const gym = await getGym(slug);
  if (!gym) notFound();
  return gym;
}
