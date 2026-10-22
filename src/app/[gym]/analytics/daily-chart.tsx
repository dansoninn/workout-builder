"use client";

import { useState } from "react";

import type { Measure } from "@/lib/engine/types";
import { formatMeasure } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dayLabel } from "@/lib/week";

export interface ChartDay {
  date: string;
  sRpe: Measure | null;
  titles: string[];
}

/**
 * Planned load per day (Lens 4) as columns: one series, so no legend; the
 * middle estimate filled, its likely range as a thin whisker. Hovering a day
 * says its load and workouts. Screen readers get the same as a table.
 */
export function DailyChart({ days, today }: { days: ChartDay[]; today: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.sRpe?.high ?? 0), 1);
  const ticks = niceTicks(max);
  const top = ticks.at(-1)!;
  const dense = days.length > 16;

  return (
    <figure className="grid gap-2">
      <div className="relative" aria-hidden>
        <div className="relative ml-10 h-44 border-b border-border">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-border/60" style={{ bottom: `${(t / top) * 100}%` }}>
              <span className="absolute -left-10 w-8 -translate-y-1/2 text-right text-2xs text-muted-foreground tabular">{t}</span>
            </div>
          ))}
          <div className="absolute inset-0 flex items-end gap-0.5">
            {days.map((d, i) => {
              const m = d.sRpe;
              return (
                <div
                  key={d.date}
                  className={cn("relative flex h-full flex-1 items-end justify-center", hover === i && "bg-hover/60")}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                >
                  {m && (
                    <>
                      <div
                        className={cn("w-full max-w-6 rounded-t-[4px]", d.date > today ? "bg-primary/45" : "bg-primary")}
                        style={{ height: `${(m.mid / top) * 100}%` }}
                      />
                      {m.confidence === "estimated" && m.high > m.low && (
                        <div className="absolute w-px bg-foreground/50" style={{ bottom: `${(m.low / top) * 100}%`, height: `${((m.high - m.low) / top) * 100}%` }} />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {hover !== null && days[hover] && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-raised"
              style={{ left: `${((hover + 0.5) / days.length) * 100}%`, bottom: "100%" }}
            >
              <p className="font-medium">{dayLabel(days[hover]!.date)}</p>
              <p className="tabular">{days[hover]!.sRpe ? formatMeasure(days[hover]!.sRpe!, "AU").main : "Rest day"}</p>
              {days[hover]!.titles.map((t) => (
                <p key={t} className="text-muted-foreground">
                  {t}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="ml-10 flex gap-0.5 pt-1">
          {days.map((d, i) => (
            <span key={d.date} className={cn("flex-1 text-center text-2xs text-muted-foreground tabular", d.date === today && "font-semibold text-foreground")}>
              {!dense || i % 7 === 0 || d.date === today ? dayLabel(d.date).split(" ").slice(1).join(" ") : ""}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="text-xs text-muted-foreground">Planned load per day (AU). Lighter columns are days still to come; a line through a column is its likely range.</figcaption>
      <table className="sr-only">
        <caption>Planned load per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Planned load</th>
            <th scope="col">Workouts</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayLabel(d.date)}</th>
              <td>{d.sRpe ? formatMeasure(d.sRpe, "AU").label : "Rest day"}</td>
              <td>{d.titles.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Round axis ticks: 0 and three or four steps of 1, 2 or 5 × 10ⁿ up to at least `max`. */
function niceTicks(max: number): number[] {
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * power).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let t = 0; t < max + step; t += step) ticks.push(Math.round(t));
  return ticks;
}
