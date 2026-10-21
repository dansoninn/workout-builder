import type { Metadata } from "next";

import { GymPage } from "@/components/app/gym-page";
import { SectionSkeleton } from "@/components/app/settings";
import { daysUntil, formatShortDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { getCurrentUser, type GymMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { type Invite, type Member, MembersManager } from "./members-manager";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage({ params }: PageProps<"/[gym]/settings/members">) {
  return (
    <GymPage params={params} fallback={<SectionSkeleton rows={4} />} render={(gym) => <Members gym={gym} />} />
  );
}

async function Members({ gym }: { gym: GymMembership }) {
  const canManage = can.manageMembers(gym.role);
  const supabase = await createClient();
  const [user, { data: memberRows, error }, { data: inviteRows }] = await Promise.all([
    getCurrentUser(),
    supabase.rpc("list_gym_members", { p_org: gym.id }),
    canManage
      ? supabase
          .from("invitations")
          .select("id, email, role, created_at, expires_at")
          .eq("org_id", gym.id)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw error;

  const members: Member[] = memberRows.map((m) => ({
    userId: m.user_id,
    name: m.display_name || m.email || "Unnamed member",
    email: m.email,
    role: m.role,
    joined: formatShortDate(m.joined_at),
    isYou: m.user_id === user?.id,
  }));
  const invites: Invite[] = (inviteRows ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    invited: formatShortDate(i.created_at),
    expiresInDays: daysUntil(i.expires_at),
  }));

  return (
    <MembersManager slug={gym.slug} gymName={gym.name} canManage={canManage} members={members} invites={invites} />
  );
}
