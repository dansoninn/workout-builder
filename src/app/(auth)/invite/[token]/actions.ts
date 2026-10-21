"use server";

import { redirect } from "next/navigation";

import type { FormState } from "@/lib/forms";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user joins the gym; the database checks the link, the email and the expiry. */
export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  await requireUser(`/invite/${token}`);

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("accept_invitation", { p_token: token });
  // The database's own messages for a used, cancelled, expired or wrong-email link are written for people.
  if (error && ["22023", "42501", "23505"].includes(error.code)) return { error: error.message };
  if (error || !slug) return { error: "Could not join the gym. Try again." };
  redirect(`/${slug}/builder`);
}
