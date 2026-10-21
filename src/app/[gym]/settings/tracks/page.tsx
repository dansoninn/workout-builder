import type { Metadata } from "next";

import { GymPage } from "@/components/app/gym-page";
import { SectionSkeleton } from "@/components/app/settings";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { TracksManager } from "./tracks-manager";

export const metadata: Metadata = { title: "Tracks" };

export default function TracksPage({ params }: PageProps<"/[gym]/settings/tracks">) {
  return <GymPage params={params} fallback={<SectionSkeleton rows={2} />} render={(gym) => <Tracks gym={gym} />} />;
}

async function Tracks({ gym }: { gym: GymMembership }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("id, name, color, archived_at, position")
    .eq("org_id", gym.id)
    .order("position")
    .order("name");
  if (error) throw error;

  return (
    <TracksManager
      slug={gym.slug}
      canManage={can.manageTracks(gym.role)}
      tracks={data.map((t) => ({ id: t.id, name: t.name, color: t.color, archived: t.archived_at !== null }))}
    />
  );
}
