import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { GymPage } from "@/components/app/gym-page";
import { PageBody, PageHeader } from "@/components/app/page";
import { ReadOnlyNote } from "@/components/app/settings";
import { Bars } from "@/components/design/bars";
import { Estimate } from "@/components/design/estimate";
import { PatternTag } from "@/components/design/tags";
import { CALC_VERSION } from "@/lib/engine";
import type { Measure, WorkoutResult } from "@/lib/engine/types";
import { loadImport } from "@/lib/import/load";
import { analyseProgramming, type ReportWorkout } from "@/lib/import/report";
import { MUSCLE_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { MUSCLES, PATTERNS } from "@/lib/taxonomy";
import { addDays, dayLabel } from "@/lib/week";
import { refreshStaleMetrics } from "@/lib/workout/metrics";
import { loadLibrary } from "@/lib/workout/load-library";

import { loadTracks } from "../../../builder/load";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Your programming, analysed" };

export default function ReportPage({ params }: PageProps<"/[gym]/import/[batchId]/report">) {
  return <GymPage params={params} render={(gym) => <Report gym={gym} params={params} />} />;
}

type Row = {
  id: string;
  date: string | null;
  title: string | null;
  track_id: string;
  workout_metrics: { calc_version: number; metrics: unknown }[];
  blocks: { block_items: { exercise_id: string | null }[] }[];
};

/**
 * "Your programming, analysed" (BACKLOG "Program import"): what an import
 * brought in, in the four lenses and in plain words, ready to print or save
 * as a PDF. Computed from the stored numbers, as Analytics is.
 */
async function Report({ gym, params }: { gym: GymMembership; params: PageProps<"/[gym]/import/[batchId]/report">["params"] }) {
  await connection();
  const { batchId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(batchId)) notFound();
  if (!can.program(gym.role)) {
    return (
      <PageBody>
        <PageHeader title="Your programming, analysed" />
        <ReadOnlyNote>Owners, head coaches and coaches see imports.</ReadOnlyNote>
      </PageBody>
    );
  }
  const stored = await loadImport(gym.id, batchId);
  if (!stored) notFound();
  if (stored.status !== "committed") {
    return (
      <PageBody>
        <PageHeader title="Your programming, analysed" />
        <p className="text-muted-foreground">{stored.status === "undone" ? "This import was undone." : "This import is not made yet."}</p>
      </PageBody>
    );
  }
  await refreshStaleMetrics(gym.id);
  const supabase = await createClient();
  const [tracks, library, rows] = await Promise.all([
    loadTracks(gym.id),
    loadLibrary(gym.id),
    supabase
      .from("workouts")
      .select("id, date, title, track_id, workout_metrics (calc_version, metrics), blocks (block_items (exercise_id))")
      .eq("org_id", gym.id)
      .eq("import_batch_id", batchId)
      .eq("kind", "scheduled")
      .is("deleted_at", null),
  ]);
  if (rows.error) throw rows.error;
  const names = new Map(library.exercises.map((e) => [e.id, e.name]));
  const workouts: ReportWorkout[] = (rows.data as unknown as Row[]).flatMap((w) => {
    const metrics = w.workout_metrics.find((m) => m.calc_version === CALC_VERSION)?.metrics;
    if (!w.date || !metrics || typeof metrics !== "object" || !("hardSets" in metrics)) return [];
    return [{
      id: w.id,
      date: w.date,
      title: w.title,
      trackId: w.track_id,
      result: metrics as WorkoutResult,
      exercises: [...new Set(w.blocks.flatMap((b) => b.block_items.flatMap((i) => (i.exercise_id ? [i.exercise_id] : []))))],
    }];
  });
  const report = analyseProgramming(workouts, (id) => names.get(id) ?? null);
  const program = tracks.find((t) => t.id === stored.trackId)?.name ?? "a program";
  const href = (path: string) => `/${gym.slug}/${path}`;
  if (!report) {
    return (
      <PageBody>
        <PageHeader title="Your programming, analysed" />
        <p className="text-muted-foreground">The import has no workouts left to analyse.</p>
      </PageBody>
    );
  }
  const { summary } = report;
  const { lenses } = summary;
  const from = summary.workouts[0]!.date;
  const to = summary.workouts.at(-1)!.date;

  return (
    <PageBody className="max-w-5xl print:max-w-none">
      <PageHeader
        title="Your programming, analysed"
        description={`${stored.sourceName} · ${program} · ${dayLabel(from)} ${from.slice(0, 4)} – ${dayLabel(to)} ${to.slice(0, 4)} · ${gym.name}`}
        actions={<PrintButton />}
      />
      <div className="grid gap-10">
        <section aria-labelledby="in-words" className="grid gap-3">
          <h2 id="in-words" className="text-lg font-semibold">
            In plain words
          </h2>
          <ul className="grid list-disc gap-1.5 pl-5">
            {report.findings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            What was programmed, as planned: estimates with their range (~), not measured results. Whether it is right is your call; Analytics checks it against your guidelines.
          </p>
        </section>

        <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Planned load" measure={lenses.sRpe} unit="AU" />
          <Tile label="Training time" measure={lenses.durationMin} unit="min" />
          <Tile label="Workouts" value={String(summary.workouts.length)} />
          <Tile label="Weeks" value={String(summary.weeks.length)} />
        </section>

        <div className="grid gap-8 lg:grid-cols-2 print:grid-cols-2">
          <Bars
            title="Hard sets by pattern"
            unit="sets"
            rows={PATTERNS.flatMap((p) => (lenses.hardSets.byPattern[p] ? [{ key: p, label: <PatternTag pattern={p} />, measure: lenses.hardSets.byPattern[p]! }] : []))}
            empty="No hard sets."
          />
          <Bars
            title="Reps by pattern"
            unit="reps"
            rows={PATTERNS.flatMap((p) => (lenses.exposure.reps[p] ? [{ key: p, label: <PatternTag pattern={p} />, measure: lenses.exposure.reps[p]! }] : []))}
            empty="No reps."
          />
          <Bars
            title="Hard sets by muscle"
            unit="sets"
            rows={MUSCLES.flatMap((m) => (lenses.hardSets.byMuscle[m] ? [{ key: m, label: MUSCLE_LABELS[m], measure: lenses.hardSets.byMuscle[m]! }] : []))}
          />
          <section aria-labelledby="most" className="grid content-start gap-2">
            <h3 id="most" className="text-sm font-medium">
              Most programmed exercises
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="h-7 font-medium">Exercise</th>
                  <th scope="col" className="h-7 text-right font-medium">Workouts</th>
                </tr>
              </thead>
              <tbody>
                {report.topExercises.map((e) => (
                  <tr key={e.name} className="border-b border-border last:border-0">
                    <th scope="row" className="py-1 text-left font-normal">{e.name}</th>
                    <td className="py-1 text-right tabular">
                      {e.sessions} <span className="text-muted-foreground">({e.share}%)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <section aria-labelledby="weeks" className="grid gap-2 print:break-inside-avoid">
          <h2 id="weeks" className="text-lg font-semibold">
            Week by week
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="h-8 px-3 font-medium">Week</th>
                  <th scope="col" className="h-8 px-3 text-right font-medium">Workouts</th>
                  <th scope="col" className="h-8 px-3 text-right font-medium">Planned load</th>
                  <th scope="col" className="h-8 px-3 text-right font-medium">Monotony</th>
                </tr>
              </thead>
              <tbody>
                {summary.weeks.map((w) => (
                  <tr key={w.weekStart} className="border-b border-border last:border-0">
                    <th scope="row" className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                      {dayLabel(w.weekStart)} – {dayLabel(addDays(w.weekStart, 6))}
                    </th>
                    <td className="px-3 py-1.5 text-right tabular">{summary.workouts.filter((x) => x.date >= w.weekStart && x.date <= addDays(w.weekStart, 6)).length}</td>
                    <td className="px-3 py-1.5 text-right tabular">
                      <Estimate measure={w.total} unit="AU" />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular">{w.monotony === null ? "—" : w.monotony.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="print:hidden">
          <Link href={href(`analytics?programs=${stored.trackId}&from=${from}&to=${to}`)} className="font-medium underline underline-offset-2">
            Open the period in Analytics
          </Link>
          <span className="text-muted-foreground"> · </span>
          <Link href={href(`import/${stored.id}`)} className="underline underline-offset-2">
            The import
          </Link>
        </p>
      </div>
    </PageBody>
  );
}

function Tile({ label, measure, unit, value }: { label: string; measure?: Measure | null; unit?: "AU" | "min"; value?: string }) {
  return (
    <div className="grid content-start gap-0.5 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value ?? (measure && unit ? <Estimate measure={measure} unit={unit} /> : <span className="text-muted-foreground">—</span>)}</span>
    </div>
  );
}
