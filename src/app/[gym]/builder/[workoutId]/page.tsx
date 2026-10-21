import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GymPage } from "@/components/app/gym-page";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { loadLibrary } from "@/lib/workout/load-library";
import { loadWorkout } from "@/lib/workout/load-workout";

import { Builder } from "../builder";
import { BuilderSkeleton } from "../builder-skeleton";
import { loadTracks } from "../load";

export const metadata: Metadata = { title: "Workout" };

export default function WorkoutPage({ params }: PageProps<"/[gym]/builder/[workoutId]">) {
  return (
    <GymPage
      params={params}
      fallback={<BuilderSkeleton />}
      render={(gym) => <SavedWorkout gym={gym} params={params} />}
    />
  );
}

async function SavedWorkout({ gym, params }: { gym: GymMembership; params: PageProps<"/[gym]/builder/[workoutId]">["params"] }) {
  const { workoutId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(workoutId)) notFound();
  const [stored, library, tracks] = await Promise.all([loadWorkout(gym.id, workoutId), loadLibrary(gym.id), loadTracks(gym.id)]);
  if (!stored) notFound();

  return (
    <Builder
      key={stored.draft.id}
      slug={gym.slug}
      library={library}
      tracks={tracks}
      initial={stored.draft}
      isNew={false}
      canEdit={can.program(gym.role)}
    />
  );
}
