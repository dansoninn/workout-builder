import { CircleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { GymPage } from "@/components/app/gym-page";
import { PageBody, PageHeader } from "@/components/app/page";
import { Bars } from "@/components/design/bars";
import { Estimate } from "@/components/design/estimate";
import { PatternTag } from "@/components/design/tags";
import { checkPrograms, hasGuidelines, type ProgramWarning, RATIO_LABELS } from "@/lib/analytics/guidelines";
import { loadPeriod, type ProgramPeriod } from "@/lib/analytics/load";
import { PERIOD_PRESETS, type PeriodSummary } from "@/lib/analytics/period";
import type { Measure } from "@/lib/engine/types";
import { MODALITY_LABELS, MUSCLE_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { MODALITIES, MUSCLES, PATTERNS, PLANES } from "@/lib/taxonomy";
import { analyticsPrograms, programsParam } from "@/lib/tracks";
import { refreshStaleMetrics } from "@/lib/workout/metrics";
import { addDays, dayLabel, isoDate } from "@/lib/week";

import type { TrackOption } from "../builder/builder";
import { loadTracks } from "../builder/load";
import { type ChartDay, DailyChart } from "./daily-chart";
import { PeriodControls } from "./period-controls";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage({ params, searchParams }: PageProps<"/[gym]/analytics">) {
  return <GymPage params={params} render={(gym) => <Analytics gym={gym} searchParams={searchParams} />} />;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PLANE_LABELS = { sagittal: "Sagittal", frontal: "Frontal", transverse: "Transverse", multiplanar: "Multiplanar" } as const;

async function Analytics({ gym, searchParams }: { gym: GymMembership; searchParams: PageProps<"/[gym]/analytics">["searchParams"] }) {
  const query = await searchParams;
  await connection();
  const today = isoDate(new Date());
  const custom = typeof query.from === "string" && DATE.test(query.from) && typeof query.to === "string" && DATE.test(query.to);
  const days = custom ? null : (PERIOD_PRESETS.find((n) => String(n) === query.days) ?? 7);
  let [from, to] = custom ? [query.from as string, query.to as string] : [addDays(today, -(days! - 1)), today];
  if (from > to) [from, to] = [to, from];
  // At most a year at a time.
  if (addDays(from, 366) < to) from = addDays(to, -365);

  // One program by default (the person's calendar program); several only when chosen, always named (decision 4).
  const supabase = await createClient();
  const [tracks, remembered] = await Promise.all([
    loadTracks(gym.id),
    supabase.from("member_preferences").select("calendar_program_id").eq("org_id", gym.id).maybeSingle(),
  ]);
  const programIds = analyticsPrograms(programsParam(query), remembered.data?.calendar_program_id ?? null, tracks);
  const shown = tracks.filter((t) => programIds.includes(t.id));
  const names = shown.map((t) => t.name).join(" + ");
  const combined = shown.length > 1;
  // After a calculation version bump, a coach's visit works out the gym's workouts again first.
  if (can.program(gym.role)) await refreshStaleMetrics(gym.id);
  const { summary, byProgram } = await loadPeriod(gym.id, from, to, programIds);
  // Each program against its own guidelines (its own set, else the gym's; decision 5), never mixed.
  const warnings = checkPrograms(byProgram);
  // "Change them" opens the guidelines that apply: one program's own set, or the gym's.
  const single = byProgram.length === 1 ? byProgram[0]! : null;
  const settings =
    single?.ownGuidelines
      ? { href: `settings/guidelines?program=${single.programId}`, allowed: can.manageTracks(gym.role) }
      : { href: "settings/guidelines", allowed: single ? can.editGym(gym.role) : can.manageTracks(gym.role) };
  const programOf = (id: string) => tracks.find((t) => t.id === id);
  const href = (path: string) => `/${gym.slug}/${path}`;
  const { lenses } = summary;

  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        title="Analytics"
        description={`${dayLabel(from)} – ${dayLabel(to)} · ${summary.days} days · ${names || "no program"}`}
      />
      <div className="mb-6 grid gap-4">
        <PeriodControls slug={gym.slug} days={days} from={from} to={to} programIds={programIds} tracks={tracks} />
        {combined && (
          <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <span className="font-medium">{names}, together.</span>{" "}
            <span className="text-muted-foreground">
              The numbers below are these programs added up. Warnings, monotony and week-on-week change stay each program&apos;s own.
            </span>
          </p>
        )}
      </div>

      {summary.workouts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-muted-foreground">
          No saved workouts from {dayLabel(from)} to {dayLabel(to)}. Workouts saved in the builder show here.
        </p>
      ) : (
        <div className="grid gap-8">
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Planned load" measure={lenses.sRpe} unit="AU" />
            <Tile label="Training time" measure={lenses.durationMin} unit="min" />
            <Tile label="Workouts" value={String(summary.workouts.length)} />
            <Tile label="Hard sets" measure={sumMeasures(Object.values(lenses.hardSets.byPattern))} unit="sets" />
          </section>
          {summary.unknownLoad.length > 0 && (
            <p className="-mt-5 text-xs text-muted-foreground">
              Not in the load: {summary.unknownLoad.map((w, i) => (
                <span key={w.id}>
                  {i > 0 && ", "}
                  <Link href={href(`builder/${w.id}`)} className="underline underline-offset-2">{w.title || "Untitled workout"}</Link>
                </span>
              ))}{" "}
              (a line without an amount or a pace).
            </p>
          )}

          <Warnings
            summary={summary}
            warnings={warnings}
            programName={combined ? (id) => programOf(id)?.name ?? "" : null}
            source={
              single
                ? `${names} uses ${single.ownGuidelines ? "its own guidelines" : "the gym's guidelines"}`
                : "Each program is checked against its own guidelines (its own set, or the gym's)"
            }
            configured={byProgram.some((p) => hasGuidelines(p.guidelines))}
            settings={settings.allowed ? href(settings.href) : null}
            href={href}
          />

          <section aria-labelledby="lens-load" className="grid gap-4">
            <LensHeading id="lens-load" title="Session load" note="Planned RPE × minutes, block by block. Monotony and strain are per calendar week, Monday to Sunday." />
            <DailyChart
              today={today}
              days={summary.daily.map(
                (d): ChartDay => ({
                  date: d.date,
                  sRpe: d.sRpe,
                  titles: d.workouts.map((w) => `${w.title || "Untitled workout"}${combined ? ` (${programOf(w.trackId)?.name})` : ""}`),
                }),
              )}
            />
            {combined ? <ProgramsWeekTable summary={summary} byProgram={byProgram} programOf={programOf} /> : <WeekTable summary={summary} />}
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="lens-strength" className="grid content-start gap-4">
              <LensHeading id="lens-strength" title="Strength" note="Hard sets: sets at Load Moderate or Hard. A muscle counts 1 set as a main muscle, ½ as a helper." />
              <Bars
                title="Hard sets by pattern"
                unit="sets"
                rows={PATTERNS.flatMap((p) => (lenses.hardSets.byPattern[p] ? [{ key: p, label: <PatternTag pattern={p} />, measure: lenses.hardSets.byPattern[p]! }] : []))}
                empty="No hard sets in this period."
              />
              <Bars
                title="Hard sets by muscle"
                unit="sets"
                rows={MUSCLES.flatMap((m) => (lenses.hardSets.byMuscle[m] ? [{ key: m, label: MUSCLE_LABELS[m], measure: lenses.hardSets.byMuscle[m]! }] : []))}
              />
              {lenses.volumeLoadKg && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Volume load </span>
                  <Estimate measure={lenses.volumeLoadKg} unit="kg" className="font-medium" />
                </p>
              )}
            </section>

            <section aria-labelledby="lens-exposure" className="grid content-start gap-4">
              <LensHeading id="lens-exposure" title="Movement" note="Exposure: every rep of every block, by pattern weight." />
              <dl className="grid grid-cols-3 gap-3">
                {(Object.keys(RATIO_LABELS) as (keyof typeof RATIO_LABELS)[]).map((key) => (
                  <div key={key} className="grid gap-0.5 rounded-lg border border-border bg-surface px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{RATIO_LABELS[key]}</dt>
                    <dd className="text-lg font-semibold">{summary.ratios[key] ? <Estimate measure={summary.ratios[key]!} unit="ratio" /> : "—"}</dd>
                  </div>
                ))}
              </dl>
              <Bars
                title="Reps by pattern"
                unit="reps"
                rows={PATTERNS.flatMap((p) => (lenses.exposure.reps[p] ? [{ key: p, label: <PatternTag pattern={p} />, measure: lenses.exposure.reps[p]! }] : []))}
                empty="No reps in this period."
              />
              <Bars
                title="Reps by plane"
                unit="reps"
                rows={PLANES.flatMap((p) => (lenses.exposure.repsByPlane[p] ? [{ key: p, label: PLANE_LABELS[p], measure: lenses.exposure.repsByPlane[p]! }] : []))}
              />
            </section>
          </div>

          <section aria-labelledby="lens-conditioning" className="grid gap-4">
            <LensHeading id="lens-conditioning" title="Conditioning" note="Monostructural work by modality." />
            <Conditioning summary={summary} />
          </section>

          <section aria-labelledby="period-workouts" className="grid gap-2">
            <h2 id="period-workouts" className="text-lg font-semibold">
              Workouts in this period
            </h2>
            <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {summary.workouts.map((w) => (
                <li key={w.id}>
                  <Link href={href(`builder/${w.id}`)} className="flex items-baseline gap-2 rounded-md border border-border bg-surface px-3 py-2 hover:bg-hover">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">{dayLabel(w.date)}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{w.title || "Untitled workout"}</span>
                    {combined && <ProgramName program={programOf(w.trackId)} />}
                    {w.result.sRpe && <Estimate measure={w.result.sRpe} unit="AU" className="text-xs text-muted-foreground" />}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </PageBody>
  );
}

function LensHeading({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="grid gap-0.5">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

function sumMeasures(measures: (Measure | undefined)[]): Measure | null {
  const present = measures.filter((m): m is Measure => m !== undefined);
  if (present.length === 0) return null;
  return present.reduce((a, b) => ({
    low: a.low + b.low,
    mid: a.mid + b.mid,
    high: a.high + b.high,
    confidence: a.confidence === "estimated" || b.confidence === "estimated" ? "estimated" : a.confidence,
  }));
}

function Tile({ label, measure, unit, value }: { label: string; measure?: Measure | null; unit?: "AU" | "min" | "sets"; value?: string }) {
  return (
    <div className="grid content-start gap-0.5 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">
        {value ?? (measure && unit ? <Estimate measure={measure} unit={unit} /> : <span className="text-muted-foreground">—</span>)}
      </span>
    </div>
  );
}

function Warnings({
  summary,
  warnings,
  programName,
  source,
  configured,
  settings,
  href,
}: {
  summary: PeriodSummary;
  warnings: ProgramWarning[];
  /** Programs shown together: each warning names its program. */
  programName: ((id: string) => string) | null;
  /** Which guidelines apply, in a sentence. */
  source: string;
  configured: boolean;
  /** Where the guidelines that apply are changed, when this person may. */
  settings: string | null;
  href: (path: string) => string;
}) {
  if (!configured) {
    return (
      <p className="rounded-lg border border-dashed border-border-strong px-4 py-3 text-sm text-muted-foreground">
        No warnings: no guidelines are set yet (minimum hard sets per pattern, balance ratios, monotony, week-on-week increase). {source}.{" "}
        {settings ? (
          <Link href={settings} className="font-medium text-foreground underline underline-offset-2">
            Set them in Settings
          </Link>
        ) : (
          "The owner and head coaches set them in Settings."
        )}
      </p>
    );
  }
  return (
    <section aria-labelledby="warnings" className="grid gap-2">
      <h2 id="warnings" className="text-lg font-semibold">
        {warnings.length === 0 ? "Within your guidelines" : `${warnings.length} ${warnings.length === 1 ? "thing" : "things"} outside your guidelines`}
      </h2>
      <p className="text-sm text-muted-foreground">
        {source}: your own, not scientific limits. {summary.days} days.{" "}
        {settings && (
          <Link href={settings} className="font-medium text-foreground underline underline-offset-2">
            Change them in Settings
          </Link>
        )}
      </p>
      {warnings.length > 0 && (
        <ul className="grid gap-1.5">
          {warnings.map((w) => (
            <li key={w.key} className="grid gap-1 rounded-md bg-warning-subtle px-3 py-2 text-sm">
              <p className="flex items-start gap-2 font-medium">
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>
                  <span className="sr-only">Warning: </span>
                  {programName && <span className="font-normal text-muted-foreground">{programName(w.programId)}: </span>}
                  {w.text}
                </span>
              </p>
              <p className="pl-6 text-xs text-muted-foreground">Guideline: {w.guideline}</p>
              {w.workouts.length > 0 && (
                <p className="pl-6 text-xs">
                  {w.workouts.map((x, i) => (
                    <span key={x.id}>
                      {i > 0 && " · "}
                      <Link href={href(`builder/${x.id}`)} className="underline underline-offset-2">
                        {x.title || "Untitled workout"}
                      </Link>{" "}
                      <span className="text-muted-foreground">{dayLabel(x.date)}</span>
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WeekTable({ summary }: { summary: PeriodSummary }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">Planned load per calendar week</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="h-8 px-3 font-medium">Week</th>
            <th scope="col" className="h-8 px-3 text-right font-medium">Planned load</th>
            <th scope="col" className="h-8 px-3 text-right font-medium">Monotony</th>
            <th scope="col" className="h-8 px-3 text-right font-medium">Strain</th>
            <th scope="col" className="h-8 px-3 text-right font-medium">vs week before</th>
          </tr>
        </thead>
        <tbody>
          {summary.weeks.map((w) => (
            <tr key={w.weekStart} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                {dayLabel(w.weekStart)} – {dayLabel(addDays(w.weekStart, 6))}
              </th>
              <td className="px-3 py-2 text-right tabular">
                <Estimate measure={w.total} unit="AU" />
              </td>
              <td className="px-3 py-2 text-right tabular">{w.monotony === null ? "—" : w.monotony.toFixed(2)}</td>
              <td className="px-3 py-2 text-right tabular">{w.strain === null ? "—" : Math.round(w.strain).toLocaleString("en-US")}</td>
              <td className="px-3 py-2 text-right tabular">{w.change === null ? "—" : `${w.change > 0 ? "+" : ""}${Math.round(w.change * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        Monotony is the week&apos;s average daily load divided by how much it varies (Foster); strain is the week&apos;s load times monotony. The change is a trend, never an injury prediction.
      </p>
    </div>
  );
}

/** Programs shown together: each program's planned load per week, and their total. Monotony and change are per program only. */
function ProgramsWeekTable({
  summary,
  byProgram,
  programOf,
}: {
  summary: PeriodSummary;
  byProgram: ProgramPeriod[];
  programOf: (id: string) => TrackOption | undefined;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">Planned load per calendar week, per program</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="h-8 px-3 font-medium">Week</th>
            {byProgram.map((p) => (
              <th key={p.programId} scope="col" className="h-8 px-3 text-right font-medium">
                <ProgramName program={programOf(p.programId)} />
              </th>
            ))}
            <th scope="col" className="h-8 px-3 text-right font-medium">Together</th>
          </tr>
        </thead>
        <tbody>
          {summary.weeks.map((w) => (
            <tr key={w.weekStart} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                {dayLabel(w.weekStart)} – {dayLabel(addDays(w.weekStart, 6))}
              </th>
              {byProgram.map((p) => {
                const own = p.summary.weeks.find((x) => x.weekStart === w.weekStart);
                return (
                  <td key={p.programId} className="px-3 py-2 text-right tabular">
                    {own && own.total.mid > 0 ? <Estimate measure={own.total} unit="AU" /> : "—"}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right font-medium tabular">
                <Estimate measure={w.total} unit="AU" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        Monotony, strain and the change from the week before are each program&apos;s own: choose one program to see them.
      </p>
    </div>
  );
}

function ProgramName({ program }: { program: TrackOption | undefined }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: program?.color ?? "var(--border-strong)" }} />
      {program?.name}
    </span>
  );
}

function Conditioning({ summary }: { summary: PeriodSummary }) {
  const rows = MODALITIES.flatMap((m) => (summary.lenses.monostructural[m] ? [[m, summary.lenses.monostructural[m]!] as const] : []));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No monostructural work in this period.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[28rem] text-sm">
        <caption className="sr-only">Monostructural work by modality</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="h-8 px-3 font-medium">Modality</th>
            <th scope="col" className="h-8 px-3 text-right font-medium">Distance</th>
            <th scope="col" className="h-8 px-3 text-right font-medium">Calories</th>
            <th scope="col" className="h-8 px-3 text-right font-medium">Work time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([m, t]) => (
            <tr key={m} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-medium">{MODALITY_LABELS[m]}</th>
              <td className="px-3 py-2 text-right tabular">{t.distanceM ? <Estimate measure={t.distanceM} unit="m" /> : "—"}</td>
              <td className="px-3 py-2 text-right tabular">{t.calories ? <Estimate measure={t.calories} unit="cal" /> : "—"}</td>
              <td className="px-3 py-2 text-right tabular">{t.workSec ? <Estimate measure={{ ...t.workSec, low: t.workSec.low / 60, mid: t.workSec.mid / 60, high: t.workSec.high / 60 }} unit="min" /> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
