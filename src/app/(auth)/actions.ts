"use server";

import type { AuthError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  displayNameSchema,
  emailSchema,
  fieldErrorsOf,
  type FormState,
  keepValues,
  newPasswordSchema,
} from "@/lib/forms";
import { homePath } from "@/lib/home";
import { getOrigin } from "@/lib/origin";
import { authPath, LAST_GYM_COOKIE, safeNext } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

function authErrorMessage(error: AuthError, fallback: string): string {
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  switch (error.code) {
    case "email_not_confirmed":
      return "Confirm your email first: open the link we sent you.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "weak_password":
      return "Choose a stronger password.";
    case "same_password":
      return "Choose a password you haven't used here before.";
    case "email_address_invalid":
      return "Enter a valid email address.";
    case "email_address_not_authorized":
    case "over_email_send_rate_limit":
      return "We couldn't send an email to this address right now. Try again later or use another address.";
    default:
      return fallback;
  }
}

const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, { error: "Enter your password" }) });

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keepValues(formData, ["email"]);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error, "Email or password is incorrect."), values };

  const next = safeNext(formData.get("next"), "");
  redirect(next || (await homePath(supabase, data.user.id, (await cookies()).get(LAST_GYM_COOKIE)?.value)));
}

const signUpSchema = z.object({ displayName: displayNameSchema, email: emailSchema, password: newPasswordSchema });

/**
 * Creates the account. When it signs in straight away (email confirmation
 * off) and came from an invitation, it also accepts the invitation, so a
 * coach goes from the link to the gym in one step.
 */
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keepValues(formData, ["displayName", "email"]);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  // A new account belongs to no gym yet: next stop is creating one, unless it came from an invitation.
  const next = safeNext(formData.get("next"), "/onboarding");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${await getOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: authErrorMessage(error, "Could not create the account. Try again."), values };

  // Email confirmation is on: the user continues from the link in the email.
  if (!data.session) return { ok: true, values };

  const invitation = next.match(/^\/invite\/([0-9a-f]{64})$/);
  if (invitation?.[1]) {
    const { data: slug } = await supabase.rpc("accept_invitation", { p_token: invitation[1] });
    if (slug) redirect(`/${slug}/builder`);
  }
  redirect(next);
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keepValues(formData, ["email"]);
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0]?.message }, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await getOrigin()}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the account exists, so the form cannot be used to find accounts.
  if (error && error.status === 429) return { error: authErrorMessage(error, ""), values };
  return { ok: true, values };
}

const resetSchema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { error: "The passwords don't match", path: ["confirm"] });

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "This reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error, "Could not change the password. Try again.") };
  redirect(await homePath(supabase, data.claims.sub, (await cookies()).get(LAST_GYM_COOKIE)?.value));
}

/** Signs out; an optional `next` field returns there after signing in again. */
export async function signOut(formData?: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const next = formData?.get("next");
  redirect(authPath("/sign-in", typeof next === "string" ? next : null));
}
