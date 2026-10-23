"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { fieldErrorsOf, type FormState, keepValues } from "@/lib/forms";
import { RESERVED_SLUGS } from "@/lib/paths";
import { requireUser } from "@/lib/session";
import { SLUG_MAX, SLUG_PATTERN } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

const gymSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter the gym's name" }).max(80, { error: "Use at most 80 characters" }),
  slug: z
    .string()
    .trim()
    .min(3, { error: "Use at least 3 characters" })
    .max(SLUG_MAX, { error: `Use at most ${SLUG_MAX} characters` })
    .regex(SLUG_PATTERN, { error: "Use lowercase letters, numbers and single dashes" })
    .refine((s) => !RESERVED_SLUGS.has(s), { error: "This address is reserved. Try another." }),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** Creates the gym with the signed-in user as its owner, then opens it. */
export async function createGym(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/onboarding");
  const values = keepValues(formData, ["name", "slug", "country"]);
  const parsed = gymSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_country: parsed.data.country,
  });
  if (error?.code === "23505") return { fieldErrors: { slug: "This address is taken. Try another." }, values };
  if (error) return { error: "Could not create the gym. Try again.", values };

  redirect(`/${parsed.data.slug}/builder`);
}

const restoreSchema = z.uuid();

/** An owner brings back a gym they deleted, within 30 days (PLAN-step-6 6c), and opens it. */
export async function restoreGym(gymId: string): Promise<{ error: string } | undefined> {
  await requireUser();
  if (!restoreSchema.safeParse(gymId).success) return { error: "That gym cannot be brought back." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_gym", { p_org: gymId });
  if (error || !data) return { error: "That gym cannot be brought back. It may already have been erased." };
  redirect(`/${data}/builder`);
}
