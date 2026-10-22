import type { Metadata } from "next";

import { GymPage } from "@/components/app/gym-page";
import { ReadOnlyNote } from "@/components/app/settings";
import { PageBody, PageHeader } from "@/components/app/page";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { loadLibrary } from "@/lib/workout/load-library";

import { loadTracks } from "../load";
import { PasteWorkout } from "./paste-workout";

export const metadata: Metadata = { title: "Paste a workout" };

/** Paste a workout as text, for ?date and ?track when given (else today and the first track). */
export default function PastePage({ params, searchParams }: PageProps<"/[gym]/builder/paste">) {
  return <GymPage params={params} render={(gym) => <Paste gym={gym} searchParams={searchParams} />} />;
}

async function Paste({ gym, searchParams }: { gym: GymMembership; searchParams: PageProps<"/[gym]/builder/paste">["searchParams"] }) {
  const query = await searchParams;
  if (!can.program(gym.role)) {
    return (
      <PageBody>
        <PageHeader title="Paste a workout" />
        <ReadOnlyNote>Owners, head coaches and coaches add workouts.</ReadOnlyNote>
      </PageBody>
    );
  }
  const [library, tracks] = await Promise.all([loadLibrary(gym.id), loadTracks(gym.id)]);
  const date = typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : new Date().toISOString().slice(0, 10);
  const track = tracks.find((t) => t.id === query.track && !t.archived) ?? tracks.find((t) => !t.archived) ?? null;
  return (
    <PasteWorkout
      slug={gym.slug}
      library={library}
      tracks={tracks}
      initialDate={date}
      initialTrackId={track?.id ?? null}
      canNameWords={can.editExerciseBank(gym.role)}
    />
  );
}
