import type { Metadata } from "next";

import { GymPage } from "@/components/app/gym-page";
import { SectionSkeleton } from "@/components/app/settings";
import { readGuidelines } from "@/lib/analytics/guidelines";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { GuidelinesForm } from "./guidelines-form";

export const metadata: Metadata = { title: "Guidelines" };

export default function GuidelinesPage({ params }: PageProps<"/[gym]/settings/guidelines">) {
  return <GymPage params={params} fallback={<SectionSkeleton rows={6} />} render={(gym) => <Guidelines gym={gym} />} />;
}

async function Guidelines({ gym }: { gym: GymMembership }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").select("settings").eq("id", gym.id).single();
  if (error) throw error;
  return <GuidelinesForm slug={gym.slug} initial={readGuidelines(data.settings)} canEdit={can.editGym(gym.role)} />;
}
