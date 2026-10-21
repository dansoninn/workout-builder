import type { Metadata } from "next";

import { GymPage } from "@/components/app/gym-page";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { newWorkout } from "@/lib/workout/draft";
import { loadLibrary } from "@/lib/workout/load-library";

import { Builder } from "./builder";
import { BuilderSkeleton } from "./builder-skeleton";
import { loadTracks } from "./load";

export const metadata: Metadata = { title: "Builder" };

/** A new workout, for ?date=YYYY-MM-DD and ?track=<id> when given (the calendar's "+"), else today and the first track. */
export default function NewWorkoutPage({ params, searchParams }: PageProps<"/[gym]/builder">) {
  return (
    <GymPage
      params={params}
      fallback={<BuilderSkeleton />}
      render={(gym) => <NewWorkout gym={gym} searchParams={searchParams} />}
    />
  );
}

async function NewWorkout({ gym, searchParams }: { gym: GymMembership; searchParams: PageProps<"/[gym]/builder">["searchParams"] }) {
  const query = await searchParams;
  const [library, tracks] = await Promise.all([loadLibrary(gym.id), loadTracks(gym.id)]);
  const asked = typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : null;
  const template = query.template === "1";
  const date = template ? null : (asked ?? new Date().toISOString().slice(0, 10));
  const track = tracks.find((t) => t.id === query.track && !t.archived) ?? tracks.find((t) => !t.archived) ?? null;
  const initial = newWorkout(date, track?.id ?? null);

  return (
    <Builder
      // A fresh workout on every visit, even when Next.js kept the last one alive.
      key={initial.id}
      slug={gym.slug}
      library={library}
      tracks={tracks}
      initial={initial}
      isNew
      canEdit={can.program(gym.role)}
    />
  );
}
