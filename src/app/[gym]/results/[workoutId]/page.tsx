import { PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GymPage } from "@/components/app/gym-page";
import { PageBody, PageHeader } from "@/components/app/page";
import { ButtonLink } from "@/components/ui/button-link";
import { ENGINE_CONFIG } from "@/lib/engine/config";
import { scale } from "@/lib/engine/measure";
import { computeWorkout } from "@/lib/engine/workout";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { dayLabel } from "@/lib/week";
import { blockLabel, toEngineWorkout } from "@/lib/workout/draft";
import { durationText } from "@/lib/workout/fields";
import { loadLibrary } from "@/lib/workout/load-library";
import { loadLoggedResults } from "@/lib/workout/load-results";
import { loadWorkout } from "@/lib/workout/load-workout";
import { takesResults } from "@/lib/workout/results";

import { loadTracks } from "../../builder/load";
import { BlockResults, type ResultsBlock } from "../block-results";

export const metadata: Metadata = { title: "Log results" };

export default function WorkoutResultsPage({ params }: PageProps<"/[gym]/results/[workoutId]">) {
  return <GymPage params={params} render={(gym) => <WorkoutResults gym={gym} params={params} />} />;
}

async function WorkoutResults({ gym, params }: { gym: GymMembership; params: PageProps<"/[gym]/results/[workoutId]">["params"] }) {
  const { workoutId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(workoutId)) notFound();
  const [stored, library, tracks] = await Promise.all([loadWorkout(gym.id, workoutId), loadLibrary(gym.id), loadTracks(gym.id)]);
  if (!stored || stored.draft.kind !== "scheduled" || !stored.draft.date) notFound();
  const { draft } = stored;

  // The plan, as the builder shows it: the engine on the stored workout.
  const { workout } = toEngineWorkout(draft, library);
  const computed = computeWorkout(workout, ENGINE_CONFIG);
  const blocks: ResultsBlock[] = draft.blocks.flatMap((block, b) => {
    if (!takesResults(block.format)) return [];
    const p = block.params as Record<string, number | undefined>;
    const result = computed.blocks[b];
    const finish = result?.durationMin ? scale(result.durationMin, 60) : null;
    return [
      {
        id: block.id,
        label: blockLabel(b),
        title: block.title,
        intent: block.intent,
        format: block.format,
        params: block.params,
        heading:
          block.format === "amrap"
            ? `AMRAP ${durationText(p.time_s ?? 0)}`
            : ["For time", (p.rounds ?? 1) > 1 && `${p.rounds} rounds`, p.time_cap_s && `cap ${durationText(p.time_cap_s)}`]
                .filter(Boolean)
                .join(" · "),
        lines: workout.blocks[b]?.items.flatMap((item) => (item.rawLine ? [item.rawLine] : [])) ?? [],
        plan: block.format === "amrap" ? (result?.rounds ? { measure: result.rounds, unit: "rounds" } : null) : finish && { measure: finish, unit: "clock" },
        capSec: p.time_cap_s ?? null,
      },
    ];
  });
  const results = await loadLoggedResults(gym.id, blocks.map((b) => b.id));
  const track = tracks.find((t) => t.id === draft.trackId);
  const canLog = can.program(gym.role);

  return (
    <PageBody className="max-w-2xl">
      <PageHeader
        title={draft.title || "Untitled workout"}
        description={[dayLabel(draft.date!), track?.name].filter(Boolean).join(" · ")}
        actions={
          <ButtonLink href={`/${gym.slug}/builder/${draft.id}`} variant="outline" size="sm">
            <PencilIcon /> {canLog ? "Edit workout" : "Open workout"}
          </ButtonLink>
        }
      />
      {!canLog && <p className="mb-4 text-sm text-muted-foreground">Owners, head coaches and coaches log results.</p>}
      {blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-muted-foreground">
          This workout has no AMRAP or For time block. Results are logged for those.
        </p>
      ) : (
        <div className="grid gap-4">
          {blocks.map((block) => (
            <BlockResults
              key={block.id}
              slug={gym.slug}
              block={block}
              results={results.filter((r) => r.blockId === block.id)}
              canLog={canLog}
            />
          ))}
        </div>
      )}
    </PageBody>
  );
}
