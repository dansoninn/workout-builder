"use client";

import { CheckIcon, CircleAlertIcon, CircleHelpIcon, CircleIcon } from "lucide-react";
import { useMemo } from "react";

import { SettingsSection } from "@/components/app/settings";
import { Bars } from "@/components/design/bars";
import { Estimate } from "@/components/design/estimate";
import { PatternTag } from "@/components/design/tags";
import { Button } from "@/components/ui/button";
import { summarisePeriod } from "@/lib/analytics/period";
import { ENGINE_CONFIG } from "@/lib/engine/config";
import type { Measure } from "@/lib/engine/types";
import { computeWorkout } from "@/lib/engine/workout";
import type { ImportPlan } from "@/lib/import/plan";
import type { ImportReading, ReadDay } from "@/lib/import/review";
import { PATTERNS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { dayLabel, monthLabel, monthWeeks } from "@/lib/week";
import { toEngineWorkout } from "@/lib/workout/draft";
import type { Library } from "@/lib/workout/library";

type Mark = "ready" | "draft" | "cannot" | "out" | "none";

const MARKS: Record<Exclude<Mark, "none">, { icon: React.ReactNode; label: string }> = {
  ready: { icon: <CheckIcon className="size-3.5 text-success" aria-hidden />, label: "Ready" },
  draft: { icon: <CircleHelpIcon className="size-3.5 text-warning" aria-hidden />, label: "Needs you: imported as a draft" },
  cannot: { icon: <CircleAlertIcon className="size-3.5 text-destructive" aria-hidden />, label: "Cannot be saved as written: fix it or leave it out" },
  out: { icon: <CircleIcon className="size-3.5 text-muted-foreground" aria-hidden />, label: "Not imported or not counted" },
};

/** Step 3: what each day becomes, and what the period adds up to, before anything is saved. */
export function PreviewStep({
  reading,
  plan,
  library,
  existing,
  onOpenDay,
  onNext,
}: {
  reading: ImportReading;
  plan: ImportPlan;
  library: Library;
  existing: { id: string; date: string; title: string | null }[];
  onOpenDay: (key: string) => void;
  onNext: () => void;
}) {
  const planned = useMemo(() => new Map(plan.workouts.map((w) => [w.dayKey, w])), [plan]);
  const cannot = useMemo(() => new Set(plan.cannotSave.map((c) => c.dayKey)), [plan]);
  const byDate = useMemo(() => {
    const map = new Map<string, ReadDay>();
    for (const r of reading.days) if (r.day.date && (r.text || r.closed || r.focus)) map.set(r.day.date, r);
    return map;
  }, [reading]);
  const there = useMemo(() => new Set(existing.map((w) => w.date)), [existing]);
  const markOf = (r: ReadDay | undefined): Mark => {
    if (!r) return "none";
    if (cannot.has(r.day.key)) return "cannot";
    const w = planned.get(r.day.key);
    if (w) return w.blocks.length === 0 ? "out" : w.ready ? "ready" : "draft";
    return r.text ? "out" : "none";
  };
  const months = [...new Set([...byDate.keys()].map((d) => d.slice(0, 7)))].sort();

  // The numbers, worked out the same way as after the import.
  const summary = useMemo(() => {
    const dates = plan.workouts.map((w) => w.date!).sort();
    if (dates.length === 0) return null;
    const workouts = plan.workouts.map((w) => ({
      id: w.id,
      date: w.date!,
      title: w.title,
      trackId: "preview",
      result: computeWorkout(toEngineWorkout(w, library).workout, ENGINE_CONFIG),
    }));
    return summarisePeriod(workouts, dates[0]!, dates.at(-1)!);
  }, [plan, library]);

  return (
    <div className="grid gap-10">
      <SettingsSection title="The calendar" description="Each day as it will be imported. Choose a day to see it next to the document, fix it, or leave it out.">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="What the marks mean">
          {Object.values(MARKS).map((m) => (
            <li key={m.label} className="flex items-center gap-1">
              {m.icon} {m.label}
            </li>
          ))}
          <li className="flex items-center gap-1">
            <span className="size-3 rounded-sm bg-warning-subtle" aria-hidden /> Closed
          </li>
          <li className="flex items-center gap-1">
            <span className="size-3 rounded-sm border-2 border-dashed border-border-strong" aria-hidden /> The program already has a workout
          </li>
        </ul>
        <div className="grid gap-6 lg:grid-cols-2">
          {months.map((month) => (
            <section key={month} aria-label={monthLabel(`${month}-01`)} className="grid gap-1.5">
              <h3 className="text-sm font-semibold">{monthLabel(`${month}-01`)}</h3>
              <div aria-hidden className="grid grid-cols-7 text-center text-2xs text-muted-foreground">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <ol className="grid grid-cols-7 gap-0.5">
                {monthWeeks(`${month}-01`)
                  .flat()
                  .map((date) => {
                    if (!date.startsWith(month)) return <li key={date} aria-hidden />;
                    const r = byDate.get(date);
                    const mark = markOf(r);
                    const label = `${dayLabel(date)}${r?.closed ? `, ${r.closed} (closed)` : ""}${r?.focus ? `, ${r.focus}` : ""}${mark !== "none" ? `: ${MARKS[mark].label}` : ""}${there.has(date) ? ", the program already has a workout" : ""}`;
                    return (
                      <li key={date}>
                        <button
                          type="button"
                          disabled={!r}
                          onClick={() => r && onOpenDay(r.day.key)}
                          aria-label={label}
                          title={label}
                          className={cn(
                            "flex h-12 w-full flex-col items-start justify-between rounded-sm border border-border p-1 text-left text-2xs transition-colors enabled:hover:bg-hover disabled:cursor-default",
                            r?.closed && "bg-warning-subtle",
                            there.has(date) && "border-2 border-dashed border-border-strong",
                          )}
                        >
                          <span className="flex w-full items-center justify-between">
                            <span className="tabular">{Number(date.slice(8))}</span>
                            {mark !== "none" && MARKS[mark].icon}
                          </span>
                          <span className="w-full truncate text-muted-foreground">{r?.focus ?? ""}</span>
                        </button>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="What the period adds up to"
        description="The four lenses for the workouts that will be imported, worked out as Analytics will. Lines that still need you count as far as they are understood."
      >
        {!summary ? (
          <p className="text-muted-foreground">No workouts to import yet.</p>
        ) : (
          <div className="grid gap-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Planned load" measure={summary.lenses.sRpe} unit="AU" />
              <Tile label="Training time" measure={summary.lenses.durationMin} unit="min" />
              <Tile label="Workouts" value={String(summary.workouts.length)} />
              <Tile label="Weeks" value={String(summary.weeks.length)} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Bars
                title="Hard sets by pattern"
                unit="sets"
                rows={PATTERNS.flatMap((p) => (summary.lenses.hardSets.byPattern[p] ? [{ key: p, label: <PatternTag pattern={p} />, measure: summary.lenses.hardSets.byPattern[p]! }] : []))}
                empty="No hard sets."
              />
              <Bars
                title="Reps by pattern"
                unit="reps"
                rows={PATTERNS.flatMap((p) => (summary.lenses.exposure.reps[p] ? [{ key: p, label: <PatternTag pattern={p} />, measure: summary.lenses.exposure.reps[p]! }] : []))}
                empty="No reps."
              />
            </div>
          </div>
        )}
      </SettingsSection>

      <div>
        <Button onClick={onNext}>Next: import</Button>
      </div>
    </div>
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
