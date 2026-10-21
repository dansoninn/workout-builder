import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/** Where `/` leads: the builder of the gym opened last (or the first gym by name), or "create your gym". */
export async function homePath(
  supabase: SupabaseClient<Database>,
  userId: string,
  lastGymSlug: string | undefined,
): Promise<string> {
  const { data } = await supabase.from("memberships").select("organizations (slug, name)").eq("user_id", userId);
  const gyms = (data ?? [])
    .flatMap((m) => (m.organizations ? [m.organizations] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
  const gym = gyms.find((g) => g.slug === lastGymSlug) ?? gyms[0];
  return gym ? `/${gym.slug}/builder` : "/onboarding";
}
