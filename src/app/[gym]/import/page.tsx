import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { GymPage } from "@/components/app/gym-page";
import { PageBody, PageHeader } from "@/components/app/page";
import { ReadOnlyNote } from "@/components/app/settings";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/dates";
import { loadImports } from "@/lib/import/load";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";

import { loadTracks } from "../builder/load";
import { StartImport } from "./start-import";

export const metadata: Metadata = { title: "Import" };

/** Program import (BACKLOG "Program import"): start one, or go on with one, or see what earlier ones made. */
export default function ImportPage({ params }: PageProps<"/[gym]/import">) {
  return <GymPage params={params} render={(gym) => <Imports gym={gym} />} />;
}

async function Imports({ gym }: { gym: GymMembership }) {
  await connection();
  if (!can.program(gym.role)) {
    return (
      <PageBody>
        <PageHeader title="Import" />
        <ReadOnlyNote>Owners, head coaches and coaches import programming.</ReadOnlyNote>
      </PageBody>
    );
  }
  const [tracks, imports] = await Promise.all([loadTracks(gym.id), loadImports(gym.id)]);
  const programName = (id: string) => tracks.find((t) => t.id === id)?.name ?? "a program";
  const drafts = imports.filter((i) => i.status === "draft");
  const done = imports.filter((i) => i.status !== "draft");
  const href = (path: string) => `/${gym.slug}/${path}`;

  return (
    <PageBody>
      <PageHeader
        title="Import"
        description="Bring weeks, months or a year of programming into a program's calendar and analytics: from Excel, Google Sheets, CSV, Word or pasted text. Nothing reaches the calendar until you say so."
      />
      <div className="grid gap-10">
        <StartImport slug={gym.slug} tracks={tracks.filter((t) => !t.archived)} today={new Date().toISOString().slice(0, 10)} />

        {drafts.length > 0 && (
          <section aria-labelledby="unfinished" className="grid gap-3">
            <h2 id="unfinished" className="text-lg font-semibold">
              Unfinished
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {drafts.map((i) => (
                <li key={i.id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <Link href={href(`import/${i.id}`)} className="min-w-0 flex-1 truncate font-medium underline-offset-2 hover:underline">
                    {i.source_name}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    into {programName(i.track_id)} · started {formatShortDate(i.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {done.length > 0 && (
          <section aria-labelledby="done" className="grid gap-3">
            <h2 id="done" className="text-lg font-semibold">
              Imported
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {done.map((i) => {
                const summary = (i.summary ?? {}) as { workouts?: number };
                return (
                  <li key={i.id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <Link href={href(`import/${i.id}`)} className="min-w-0 flex-1 truncate font-medium underline-offset-2 hover:underline">
                      {i.source_name}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {summary.workouts ?? 0} workouts into {programName(i.track_id)} · {formatShortDate(i.committed_at ?? i.created_at)}
                    </span>
                    {i.status === "undone" ? <Badge variant="outline">Undone</Badge> : (
                      <Link href={href(`import/${i.id}/report`)} className="text-sm font-medium underline underline-offset-2">
                        Your programming, analysed
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </PageBody>
  );
}
