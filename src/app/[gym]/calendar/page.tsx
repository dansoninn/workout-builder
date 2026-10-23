import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { GymPage } from "@/components/app/gym-page";
import { PageBody, PageHeader } from "@/components/app/page";
import { Estimate } from "@/components/design/estimate";
import { ButtonLink } from "@/components/ui/button-link";
import { CALC_VERSION } from "@/lib/engine";
import type { Measure } from "@/lib/engine/types";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { calendarProgramView, programViewParam } from "@/lib/tracks";
import { cn } from "@/lib/utils";
import { addDays, addMonths, isoDate, monthLabel, monthWeeks, weekDays, weekLabel, weekNumber, weekStart } from "@/lib/week";

import { loadTracks } from "../builder/load";
import { ApplyTemplateButton } from "./apply-template";
import { CalendarBoard, type CalendarWorkout } from "./calendar-board";
import { ProgramSwitcher } from "./program-switcher";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage({ params, searchParams }: PageProps<"/[gym]/calendar">) {
  return <GymPage params={params} render={(gym) => <Calendar gym={gym} searchParams={searchParams} />} />;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Row = {
  id: string;
  date: string | null;
  title: string | null;
  status: "draft" | "published";
  track_id: string;
  workout_metrics: { calc_version: number; sessionMin: Measure | null; sRpe: Measure | null }[];
  blocks?: { block_results: { deleted_at: string | null }[] }[];
};

async function Calendar({ gym, searchParams }: { gym: GymMembership; searchParams: PageProps<"/[gym]/calendar">["searchParams"] }) {
  const query = await searchParams;
  const today = isoDate(new Date());
  // ?week= is the week view's older address; it still works.
  const legacyWeek = typeof query.week === "string" && DATE.test(query.week) ? query.week : null;
  const view = legacyWeek || query.view === "week" ? "week" : "month";
  const anchor = legacyWeek ?? (typeof query.date === "string" && DATE.test(query.date) ? query.date : today);
  const days = view === "week" ? weekDays(weekStart(anchor)) : monthWeeks(anchor).flat();

  const supabase = await createClient();
  // Only the numbers the calendar shows, not the whole stored metrics.
  const metrics = "workout_metrics (calc_version, sessionMin:metrics->sessionMin, sRpe:metrics->sRpe)";
  // Every program's workouts in one query; the page shows the chosen program's.
  const [tracks, remembered, scheduled, templates] = await Promise.all([
    loadTracks(gym.id),
    supabase.from("member_preferences").select("calendar_program_id, calendar_all_programs").eq("org_id", gym.id).maybeSingle(),
    supabase
      .from("workouts")
      .select(`id, date, title, status, track_id, ${metrics}, blocks (block_results (deleted_at))`)
      .eq("org_id", gym.id)
      .eq("kind", "scheduled")
      .is("deleted_at", null)
      .gte("date", days[0]!)
      .lte("date", days.at(-1)!)
      .order("created_at"),
    supabase.from("workouts").select(`id, date, title, status, track_id, ${metrics}`).eq("org_id", gym.id).eq("kind", "template").is("deleted_at", null).order("title"),
  ]);
  if (scheduled.error) throw scheduled.error;

  // One program by default, each its own space; all programs only when chosen (decision 3).
  const choice = calendarProgramView(
    programViewParam(query),
    remembered.data ? { programId: remembered.data.calendar_program_id, all: remembered.data.calendar_all_programs } : null,
    tracks,
  );
  const programId = choice.all ? null : choice.programId;
  const inView = (w: Row) => programId === null || w.track_id === programId;
  const templateRows = ((templates.data ?? []) as unknown as Row[]).filter(inView);

  const current = (w: Row) => w.workout_metrics.find((m) => m.calc_version === CALC_VERSION);
  const workouts: CalendarWorkout[] = (scheduled.data as unknown as Row[]).filter(inView).map((w) => ({
    id: w.id,
    date: w.date!,
    title: w.title,
    status: w.status,
    trackId: w.track_id,
    sessionMin: current(w)?.sessionMin ?? null,
    sRpe: current(w)?.sRpe ?? null,
    results: (w.blocks ?? []).reduce((n, b) => n + b.block_results.filter((r) => r.deleted_at === null).length, 0),
  }));
  const canProgram = can.program(gym.role);
  const href = (path: string) => `/${gym.slug}/${path}`;
  const at = (v: "month" | "week", date: string) => `${href("calendar")}?view=${v}&date=${date}&program=${programId ?? "all"}`;
  const programColor = (id: string) => tracks.find((t) => t.id === id)?.color ?? "var(--border-strong)";
  const [previous, next] = view === "week" ? [addDays(anchor, -7), addDays(anchor, 7)] : [addMonths(anchor, -1), addMonths(anchor, 1)];

  return (
    <PageBody className="max-w-none">
      <PageHeader
        title="Calendar"
        description={view === "week" ? `Week ${weekNumber(days[0]!)} · ${weekLabel(days[0]!)}` : monthLabel(anchor)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProgramSwitcher
              slug={gym.slug}
              programs={tracks.filter((t) => !t.archived || t.id === programId)}
              value={programId ?? "all"}
              query={`view=${view}&date=${anchor}`}
            />
            {canProgram && (
              <ApplyTemplateButton
                key={programId ?? "all"}
                slug={gym.slug}
                templates={templateRows.map((t) => ({ id: t.id, title: t.title || "Untitled template", trackId: t.track_id }))}
                tracks={tracks}
                today={today}
                initialTrackId={programId}
              />
            )}
            <nav aria-label="View" className="flex rounded-md border border-border p-0.5">
              {(["month", "week"] as const).map((v) => (
                <Link
                  key={v}
                  href={at(v, anchor)}
                  aria-current={view === v ? "page" : undefined}
                  className={cn(
                    "flex h-7 items-center rounded-sm px-2.5 text-sm text-muted-foreground transition-colors duration-100 hover:text-foreground",
                    view === v && "bg-hover font-medium text-foreground",
                  )}
                >
                  {v === "month" ? "Month" : "Week"}
                </Link>
              ))}
            </nav>
            <nav aria-label={view === "week" ? "Weeks" : "Months"} className="flex items-center gap-1">
              <ButtonLink href={at(view, previous)} variant="outline" size="icon" aria-label={view === "week" ? "Previous week" : "Previous month"}>
                <ChevronLeftIcon />
              </ButtonLink>
              <ButtonLink href={at(view, today)} variant="outline">
                {view === "week" ? "This week" : "This month"}
              </ButtonLink>
              <ButtonLink href={at(view, next)} variant="outline" size="icon" aria-label={view === "week" ? "Next week" : "Next month"}>
                <ChevronRightIcon />
              </ButtonLink>
            </nav>
          </div>
        }
      />

      <CalendarBoard
        slug={gym.slug}
        view={view}
        days={days}
        month={view === "month" ? anchor.slice(0, 7) : null}
        today={today}
        tracks={tracks}
        programId={programId}
        workouts={workouts}
        canProgram={canProgram}
      />
      {canProgram && <p className="mt-2 text-xs text-muted-foreground">Drag a workout to another day to move it, or use its move button.</p>}

      <section aria-labelledby="templates" className="mt-10 grid gap-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 id="templates" className="text-lg font-semibold">
              Templates
            </h2>
            <p className="text-muted-foreground">
              Workouts without a date, to start from{programId ? ` in ${tracks.find((t) => t.id === programId)?.name}` : ""}.
            </p>
          </div>
          {canProgram && (
            <ButtonLink href={`${href("builder")}?template=1${programId ? `&program=${programId}` : ""}`} variant="outline">
              <PlusIcon /> New template
            </ButtonLink>
          )}
        </div>
        {templateRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-muted-foreground">
            No templates yet. In the builder, choose “Save as template”.
          </p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {templateRows.map((w) => {
              const m = current(w);
              return (
                <li key={w.id}>
                  <Link href={href(`builder/${w.id}`)} className="grid gap-0.5 rounded-md border border-border bg-surface px-3 py-2 hover:bg-hover">
                    <span className="flex items-center gap-1.5">
                      {programId === null && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: programColor(w.track_id) }} />}
                      <span className="truncate font-medium">{w.title || "Untitled template"}</span>
                    </span>
                    {programId === null && <span className="sr-only">{tracks.find((t) => t.id === w.track_id)?.name}</span>}
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
