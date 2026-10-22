import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { GymPage } from "@/components/app/gym-page";
import { PageBody, PageHeader } from "@/components/app/page";
import { ButtonLink } from "@/components/ui/button-link";
import type { GymMembership } from "@/lib/session";
import { addDays, dayLabel, isoDate } from "@/lib/week";
import { loadResultsWorkouts } from "@/lib/workout/load-results";

import { loadTracks } from "../builder/load";

export const metadata: Metadata = { title: "Results" };

/** How many days the list shows at a time. */
const SPAN = 14;

export default function ResultsPage({ params, searchParams }: PageProps<"/[gym]/results">) {
  return <GymPage params={params} render={(gym) => <Recent gym={gym} searchParams={searchParams} />} />;
}

async function Recent({ gym, searchParams }: { gym: GymMembership; searchParams: PageProps<"/[gym]/results">["searchParams"] }) {
  const query = await searchParams;
  await connection();
  const today = isoDate(new Date());
  const to = typeof query.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.until) && query.until < today ? query.until : today;
  const from = addDays(to, -(SPAN - 1));
  const [workouts, tracks] = await Promise.all([loadResultsWorkouts(gym.id, from, to), loadTracks(gym.id)]);

  const days = [...new Set(workouts.map((w) => w.date))];
  const dayName = (day: string) => (day === today ? "Today" : day === addDays(today, -1) ? "Yesterday" : dayLabel(day));
  const href = (path: string) => `/${gym.slug}/${path}`;

  return (
    <PageBody className="max-w-2xl">
      <PageHeader
        title="Results"
        description="What each class did in AMRAP and For time blocks, logged after class."
      />

      {workouts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-muted-foreground">
          No workouts with an AMRAP or For time block from {dayLabel(from)} to {dayLabel(to)}.
        </p>
      ) : (
        <div className="grid gap-5">
          {days.map((day) => (
            <section key={day} aria-labelledby={`day-${day}`} className="grid gap-1.5">
              <h2 id={`day-${day}`} className="text-sm font-medium text-muted-foreground">
                {dayName(day)}
                {day === today || day === addDays(today, -1) ? <span className="font-normal"> · {dayLabel(day)}</span> : null}
              </h2>
              <ul className="grid gap-1.5">
                {workouts
                  .filter((w) => w.date === day)
                  .map((w) => {
                    const track = tracks.find((t) => t.id === w.trackId);
                    const logged = w.blocks.reduce((n, b) => n + b.results, 0);
                    return (
                      <li key={w.id}>
                        <Link
                          href={href(`results/${w.id}`)}
                          className="flex min-h-14 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 transition-colors duration-100 hover:bg-hover"
                        >
                          <span className="grid min-w-0 flex-1 gap-0.5">
                            <span className="flex items-center gap-1.5">
                              {track && (
                                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: track.color ?? "var(--border-strong)" }} />
                              )}
                              <span className="truncate font-medium">{w.title || "Untitled workout"}</span>
                              {track && <span className="shrink-0 text-sm text-muted-foreground">{track.name}</span>}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {w.blocks.map((b) => `${b.label} ${b.format === "amrap" ? "AMRAP" : "For time"}`).join(" · ")}
                              {" · "}
                              {logged === 0 ? "no results yet" : `${logged} ${logged === 1 ? "result" : "results"}`}
                            </span>
                          </span>
                          <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <nav aria-label="Earlier results" className="mt-6 flex justify-center gap-2">
        <ButtonLink href={`${href("results")}?until=${addDays(from, -1)}`} variant="outline">
          Earlier
        </ButtonLink>
        {to !== today && (
          <ButtonLink href={href("results")} variant="ghost">
            Back to today
          </ButtonLink>
        )}
      </nav>
    </PageBody>
  );
}
