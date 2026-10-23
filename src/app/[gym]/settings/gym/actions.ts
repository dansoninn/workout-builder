"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { gymForAction, NOT_ALLOWED } from "@/lib/actions";
import { fieldErrorsOf, type FormState, keepValues } from "@/lib/forms";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1, { error: "Enter the gym's name" }).max(80, { error: "Use at most 80 characters" }),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .catch(null),
});

export async function updateGym(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const gym = await gymForAction(slug, can.editGym);
  if (!gym) return { error: NOT_ALLOWED };

  const values = keepValues(formData, ["name", "country"]);
  const parsed = schema.safeParse({ name: formData.get("name"), country: formData.get("country") || null });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name, country: parsed.data.country })
    .eq("id", gym.id)
    .select("id");
  if (error || data.length === 0) return { error: "Could not save. Try again.", values };

  refresh();
  return { ok: true, values };
}

/**
 * Deletes the gym (owners; PLAN-step-6 6c), confirmed by typing its name. It
 * disappears for everyone at once; its owners can bring it back for 30 days.
 */
export async function deleteGym(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const gym = await gymForAction(slug, can.editGym);
  if (!gym) return { error: NOT_ALLOWED };
  const values = keepValues(formData, ["confirm"]);
  const typed = String(formData.get("confirm") ?? "").trim();
  if (typed.toLowerCase() !== gym.name.trim().toLowerCase()) return { fieldErrors: { confirm: "Type the gym's name exactly as shown" }, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_gym", { p_org: gym.id, p_name: typed });
  if (error) return { error: error.code === "42501" ? NOT_ALLOWED : "Could not delete the gym. Try again.", values };
  redirect("/");
}
