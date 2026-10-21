"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { displayNameSchema, fieldErrorsOf, type FormState, keepValues, newPasswordSchema } from "@/lib/forms";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in again to change your profile." };

  const values = keepValues(formData, ["displayName"]);
  const parsed = displayNameSchema.safeParse(formData.get("displayName"));
  if (!parsed.success) return { fieldErrors: { displayName: parsed.error.issues[0]?.message }, values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data })
    .eq("id", user.id)
    .select("id");
  if (error || data.length === 0) return { error: "Could not save. Try again.", values };

  refresh();
  return { ok: true, values };
}

const passwordSchema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { error: "The passwords don't match", path: ["confirm"] });

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error?.code === "same_password") return { fieldErrors: { password: "That is your current password" } };
  if (error?.code === "reauthentication_needed") {
    return { error: "For your security, sign out and in again, then change the password." };
  }
  if (error) return { error: "Could not change the password. Try again." };
  return { ok: true };
}
