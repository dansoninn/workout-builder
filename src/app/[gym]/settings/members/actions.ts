"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { type ActionResult, gymForAction, NOT_ALLOWED, uuidSchema } from "@/lib/actions";
import { emailSchema, fieldErrorsOf, type FormState, keepValues } from "@/lib/forms";
import { homePath } from "@/lib/home";
import { getOrigin } from "@/lib/origin";
import { can, type Role } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const roleSchema = z.enum(["owner", "head_coach", "coach", "viewer"], { error: "Choose a role" });

export type InviteState = FormState & { link?: string; email?: string };

async function inviteLink(token: string): Promise<string> {
  return `${await getOrigin()}/invite/${token}`;
}

/** Owner invites an email with a role; returns the link to share (shown once). */
export async function createInvitation(slug: string, _prev: InviteState, formData: FormData): Promise<InviteState> {
  const gym = await gymForAction(slug, can.manageMembers);
  if (!gym) return { error: NOT_ALLOWED };

  const values = keepValues(formData, ["email", "role"]);
  const parsed = z.object({ email: emailSchema, role: roleSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_org: gym.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error?.code === "23505") return { fieldErrors: { email: `${parsed.data.email} is already a member` }, values };
  if (error || !token) return { error: "Could not create the invitation. Try again.", values };

  refresh();
  return { ok: true, link: await inviteLink(token), email: parsed.data.email };
}

/** A fresh link for a pending invitation (the old link stops working). */
export async function renewInvitation(
  slug: string,
  invitationId: string,
): Promise<ActionResult<{ link: string; email: string }>> {
  const gym = await gymForAction(slug, can.manageMembers);
  if (!gym || !uuidSchema.safeParse(invitationId).success) return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("invitations")
    .select("email, role")
    .eq("id", invitationId)
    .eq("org_id", gym.id)
    .maybeSingle();
  if (!invitation) return { ok: false, error: "This invitation no longer exists." };

  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_org: gym.id,
    p_email: invitation.email,
    p_role: invitation.role,
  });
  if (error?.code === "23505") return { ok: false, error: `${invitation.email} has already joined.` };
  if (error || !token) return { ok: false, error: "Could not create a new link. Try again." };

  refresh();
  return { ok: true, link: await inviteLink(token), email: invitation.email };
}

export async function cancelInvitation(slug: string, invitationId: string): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.manageMembers);
  if (!gym || !uuidSchema.safeParse(invitationId).success) return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("org_id", gym.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id");
  if (error || data.length === 0) return { ok: false, error: "Could not cancel the invitation. It may already be used." };

  refresh();
  return { ok: true };
}

export async function changeRole(slug: string, userId: string, role: Role): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.manageMembers);
  if (!gym || !uuidSchema.safeParse(userId).success || !roleSchema.safeParse(role).success) {
    return { ok: false, error: NOT_ALLOWED };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({ role })
    .eq("org_id", gym.id)
    .eq("user_id", userId)
    .select("user_id");
  if (error?.code === "23514") return { ok: false, error: "A gym must keep at least one owner." };
  if (error || data.length === 0) return { ok: false, error: "Could not change the role. Try again." };

  refresh();
  return { ok: true };
}

/** Removes a member. An owner removing themself leaves the gym and goes home. */
export async function removeMember(slug: string, userId: string): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.manageMembers);
  if (!gym || !uuidSchema.safeParse(userId).success) return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .delete()
    .eq("org_id", gym.id)
    .eq("user_id", userId)
    .select("user_id");
  if (error?.code === "23514") return { ok: false, error: "A gym must keep at least one owner." };
  if (error || data.length === 0) return { ok: false, error: "Could not remove the member. Try again." };

  const me = await getCurrentUser();
  if (me?.id === userId) redirect(await homePath(supabase, me.id, undefined));
  refresh();
  return { ok: true };
}
