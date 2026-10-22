import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { GymPage } from "@/components/app/gym-page";
import { PageBody, PageHeader } from "@/components/app/page";
import { Estimate } from "@/components/design/estimate";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { CALC_VERSION } from "@/lib/engine";
import { add } from "@/lib/engine/measure";
import type { Measure } from "@/lib/engine/types";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { addDays, dayLabel, isoDate, weekDays, weekLabel, weekNumber, weekStart } from "@/lib/week";

import { loadTracks } from "../builder/load";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage({ params, searchParams }: PageProps<"/[gym]/calendar">) {
  return <GymPage params={params} render={(gym) => <Week gym={gym} searchParams={searchParams} />} />;
}

type Metrics = { sessionMin: Measure | null; sRpe: Measure | null } | null;
type Row = {
  id: string;
  date: string | null;
  title: string | null;
  status: "draft" | "published";
  track_id: string | null;
  workout_metrics: { calc_version: number; metrics: Metrics }[];
};

async function Week({ gym, searchParams }: { gym: GymMembership; searchParams: PageProps<"/[gym]/calendar">["searchParams"] }) {
  const query = await searchParams;
  const today = isoDate(new Date());
  const asked = typeof query.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.week) ? query.week : today;
  const monday = weekStart(asked);
  const days = weekDays(monday);

  const supabase = await createClient();
  const select = "id, date, title, status, track_id, workout_metrics (calc_version, metrics)";
  const [tracks, scheduled, templates] = await Promise.all([
    loadTracks(gym.id),
    supabase
      .from("workouts")
      .select(select)
      .eq("org_id", gym.id)
      .eq("kind", "scheduled")
      .is("deleted_at", null)
      .gte("date", days[0]!)
      .lte("date", days[6]!)
      .order("created_at"),
    supabase.from("workouts").select(select).eq("org_id", gym.id).eq("kind", "template").is("deleted_at", null).order("title"),
  ]);
  if (scheduled.error) throw scheduled.error;

  const workouts = scheduled.data as unknown as Row[];
  const metricsOf = (w: Row): Metrics => w.workout_metrics.find((m) => m.calc_version === CALC_VERSION)?.metrics ?? null;
  // Columns: active tracks, plus any archived track or "no track" that has workouts this week.
  const columns = [
    ...tracks.filter((t) => !t.archived || workouts.some((w) => w.track_id === t.id)),
    ...(workouts.some((w) => w.track_id === null) ? [{ id: null, name: "No track", color: null, archived: false }] : []),
  ];
  const canProgram = can.program(gym.role);
  const href = (path: string) => `/${gym.slug}/${path}`;

  /** Planned load of a track's week: the sum of its workouts' loads, a range if any is an estimate. */
  const weekTotal = (trackId: string | null): Measure | null =>
    workouts
      .filter((w) => w.track_id === trackId)
      .reduce<Measure | null>((total, w) => {
        const load = metricsOf(w)?.sRpe;
        return load ? (total ? add(total, load) : load) : total;
      }, null);

  return (
    <PageBody className="max-w-none">
      <PageHeader
        title="Calendar"
        description={`Week ${weekNumber(monday)} · ${weekLabel(monday)}`}
        actions={
          <nav aria-label="Weeks" className="flex items-center gap-1">
            <ButtonLink href={`${href("calendar")}?week=${addDays(monday, -7)}`} variant="outline" size="icon" aria-label="Previous week">
              <ChevronLeftIcon />
            </ButtonLink>
            <ButtonLink href={href("calendar")} variant="outline">
              This week
            </ButtonLink>
            <ButtonLink href={`${href("calendar")}?week=${addDays(monday, 7)}`} variant="outline" size="icon" aria-label="Next week">
              <ChevronRightIcon />
            </ButtonLink>
          </nav>
        }
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
          <caption className="sr-only">Workouts by day and track, week of {weekLabel(monday)}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Day
              </th>
              {columns.map((t) => (
                <th key={t.id ?? "none"} scope="col" className="px-3 py-2 text-left text-xs font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: t.color ?? "var(--border-strong)" }} />
                    {t.name}
                    {t.archived && <span className="font-normal text-muted-foreground">(archived)</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day} className={cn("border-b border-border align-top last:border-0", day === today && "bg-primary-subtle/40")}>
                <th scope="row" className="px-3 py-2 text-left text-sm font-medium whitespace-nowrap">
                  {dayLabel(day)}
                  {day === today && <span className="ml-1.5 text-xs font-normal text-primary-text">today</span>}
                </th>
                {columns.map((t) => {
                  const here = workouts.filter((w) => w.date === day && w.track_id === t.id);
                  return (
                    <td key={t.id ?? "none"} className="group/cell px-2 py-1.5">
                      <div className="grid gap-1">
                        {here.map((w) => {
                          const m = metricsOf(w);
                          return (
                            <Link
                              key={w.id}
                              href={href(`builder/${w.id}`)}
                              className="grid gap-0.5 rounded-md border border-border bg-background px-2 py-1.5 transition-colors duration-100 hover:bg-hover"
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="min-w-0 flex-1 truncate font-medium">{w.title || "Untitled workout"}</span>
                                {w.status === "draft" && (
                                  <Badge variant="outline" className="h-4 px-1 text-2xs">
                                    Draft
                                  </Badge>
                                )}
                              </span>
                              <span className="flex gap-2 text-xs text-muted-foreground">
                                {m?.sessionMin ? <Estimate measure={m.sessionMin} unit="min" /> : null}
                                {m?.sRpe ? <Estimate measure={m.sRpe} unit="AU" /> : null}
                              </span>
                            </Link>
                          );
                        })}
                        {canProgram && t.id !== null && !t.archived && (
                          <Link
                            href={`${href("builder")}?date=${day}&track=${t.id}`}
                            className={cn(
                              "flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-100 hover:bg-hover hover:text-foreground focus-visible:opacity-100",
                              here.length > 0 && "opacity-0 group-hover/cell:opacity-100",
                            )}
                          >
                            <PlusIcon className="size-3.5" aria-hidden /> {here.length === 0 ? "Add" : "Another"}
                            <span className="sr-only">
                              {" "}workout on {dayLabel(day)}, {t.name}
                            </span>
                          </Link>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-strong">
              <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Planned load
              </th>
              {columns.map((t) => (
                <td key={t.id ?? "none"} className="px-3 py-2 text-xs text-muted-foreground tabular">
                  {(() => {
                    const total = weekTotal(t.id);
                    return total ? <Estimate measure={total} unit="AU" /> : "—";
                  })()}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <section aria-labelledby="templates" className="mt-10 grid gap-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 id="templates" className="text-lg font-semibold">
              Templates
            </h2>
            <p className="text-muted-foreground">Workouts without a date, to start from.</p>
          </div>
          {canProgram && (
            <ButtonLink href={`${href("builder")}?template=1`} variant="outline">
              <PlusIcon /> New template
            </ButtonLink>
          )}
        </div>
        {(templates.data ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-muted-foreground">
            No templates yet. In the builder, choose “Save as template”.
          </p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {(templates.data as unknown as Row[]).map((w) => {
              const m = metricsOf(w);
              return (
                <li key={w.id}>
                  <Link href={href(`builder/${w.id}`)} className="grid gap-0.5 rounded-md border border-border bg-surface px-3 py-2 hover:bg-hover">
                    <span className="truncate font-medium">{w.title || "Untitled template"}</span>
                    <span className="flex gap-2 text-xs text-muted-foreground">
                      {m?.sessionMin && <Estimate measure={m.sessionMin} unit="min" />}
                      {m?.sRpe && <Estimate measure={m.sRpe} unit="AU" />}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageBody>
  );
}
