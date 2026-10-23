import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { GymPage } from "@/components/app/gym-page";
import { PageBody, PageHeader } from "@/components/app/page";
import { ReadOnlyNote } from "@/components/app/settings";
import { formatShortDate } from "@/lib/dates";
import { loadImport, loadImportContext } from "@/lib/import/load";
import type { ImportPlan } from "@/lib/import/plan";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";

import { loadTracks } from "../../builder/load";
import { ImportWorkspace } from "./import-workspace";
import { UndoImport } from "./undo-import";

export const metadata: Metadata = { title: "Import" };

export default function ImportBatchPage({ params }: PageProps<"/[gym]/import/[batchId]">) {
  return <GymPage params={params} render={(gym) => <Batch gym={gym} params={params} />} />;
}

async function Batch({ gym, params }: { gym: GymMembership; params: PageProps<"/[gym]/import/[batchId]">["params"] }) {
  await connection();
  const { batchId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(batchId)) notFound();
  if (!can.program(gym.role)) {
    return (
      <PageBody>
        <PageHeader title="Import" />
        <ReadOnlyNote>Owners, head coaches and coaches import programming.</ReadOnlyNote>
      </PageBody>
    );
  }
  const stored = await loadImport(gym.id, batchId);
  if (!stored) notFound();
  const [tracks, context] = await Promise.all([loadTracks(gym.id), loadImportContext(gym.id, stored.trackId)]);
  const program = tracks.find((t) => t.id === stored.trackId);
  const href = (path: string) => `/${gym.slug}/${path}`;

  if (stored.status !== "draft") {
    const summary = (stored.summary ?? {}) as Partial<ImportPlan["summary"]> & { workouts?: number | string[] };
    const count = Array.isArray(summary.workouts) ? summary.workouts.length : summary.workouts ?? 0;
    return (
      <PageBody>
        <PageHeader
          title={stored.sourceName}
          description={`Imported into ${program?.name ?? "a program"} on ${formatShortDate(stored.committedAt ?? stored.createdAt)}${stored.undoneAt ? ` · undone on ${formatShortDate(stored.undoneAt)}` : ""}`}
        />
        <div className="grid max-w-2xl gap-6">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Workouts" value={count} />
            <Fact label="Templates" value={summary.templates ?? 0} />
            <Fact label="Day focuses" value={summary.days ?? 0} />
            <Fact label="Closed days" value={summary.closed ?? 0} />
          </dl>
          {stored.status === "committed" ? (
            <>
              <p>
                <Link href={href(`import/${stored.id}/report`)} className="font-medium underline underline-offset-2">
                  Your programming, analysed
                </Link>
                <span className="text-muted-foreground"> — the imported period in the four lenses, in plain words.</span>
              </p>
              <UndoImport slug={gym.slug} batchId={stored.id} workouts={count} />
            </>
          ) : (
            <p className="text-muted-foreground">This import was undone: its workouts were taken off the calendar and what it replaced was brought back.</p>
          )}
          <p>
            <Link href={href("import")} className="text-sm underline underline-offset-2">
              All imports
            </Link>
          </p>
        </div>
      </PageBody>
    );
  }

  return (
    <ImportWorkspace
      slug={gym.slug}
      batchId={stored.id}
      sourceName={stored.sourceName}
      programName={program?.name ?? "the program"}
      today={new Date().toISOString().slice(0, 10)}
      document={stored.document}
      initial={{ layout: stored.layout, programIndex: stored.programIndex, answers: stored.answers, choices: stored.choices }}
      library={context.library}
      focusNames={context.focusNames}
      existing={context.existing}
      canManage={can.manageTracks(gym.role)}
      country={gym.country}
    />
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-0.5 rounded-lg border border-border bg-surface px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular">{value}</dd>
    </div>
  );
}
