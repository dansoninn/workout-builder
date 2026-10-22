import type { Metadata } from "next";

import { GymPage } from "@/components/app/gym-page";
import { SectionSkeleton } from "@/components/app/settings";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { loadLibrary } from "@/lib/workout/load-library";

import { PacesManager } from "./paces-manager";

export const metadata: Metadata = { title: "Paces" };

export default function PacesPage({ params }: PageProps<"/[gym]/settings/paces">) {
  return <GymPage params={params} fallback={<SectionSkeleton rows={8} />} render={(gym) => <Paces gym={gym} />} />;
}

async function Paces({ gym }: { gym: GymMembership }) {
  const library = await loadLibrary(gym.id);
  const rows = library.exercises.map(({ id, name, kind, modality, defaultUnit, defaultPace, gymPace, orgId }) => ({
    id, name, kind, modality, defaultUnit, defaultPace, gymPace, orgId,
  }));
  return <PacesManager slug={gym.slug} rows={rows} canEdit={can.editExerciseBank(gym.role)} />;
}
