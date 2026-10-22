import type { Metadata } from "next";

import { GymPage } from "@/components/app/gym-page";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { loadLibrary } from "@/lib/workout/load-library";

import { ExercisesManager } from "./exercises-manager";

export const metadata: Metadata = { title: "Exercises" };

export default function ExercisesPage({ params }: PageProps<"/[gym]/exercises">) {
  return <GymPage params={params} render={(gym) => <Exercises gym={gym} />} />;
}

async function Exercises({ gym }: { gym: GymMembership }) {
  const library = await loadLibrary(gym.id);
  return <ExercisesManager slug={gym.slug} library={library} canEdit={can.editExerciseBank(gym.role)} />;
}
