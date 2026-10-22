import { add, exact } from "@/lib/engine/measure";
import type { Lenses, Measure, Ratios, WorkoutResult } from "@/lib/engine/types";
import { weekOnWeekChange, weekSummary } from "@/lib/engine/weekly";
import { computeRatios, sumLenses } from "@/lib/engine/workout";
import { addDays, weekStart } from "@/lib/week";

/**
 * Analytics over a period (PLAN-step-5 5c): the four lenses summed from the
 * stored metrics of the period's workouts, with the engine's own sums, so the
 * builder's panel, the calendar and analytics can never disagree. Estimates
 * stay ranges. Weekly load, monotony and strain are per calendar week
 * (Monday–Sunday, calc spec Lens 4), always over the whole week.
 */

/** The period presets: this many days, ending today. */
export const PERIOD_PRESETS = [7, 14, 30] as const;

export interface PeriodWorkout {
  id: string;
  date: string;
  title: string | null;
  trackId: string | null;
  result: WorkoutResult;
}

export interface DayLoad {
  date: string;
  /** Planned load of the day's workouts whose load is known. */
  sRpe: Measure | null;
  workouts: PeriodWorkout[];
}

export interface WeekLoad {
  weekStart: string;
  total: Measure;
  /** Seven daily loads (AU, middle estimate). */
  dailyLoad: number[];
  monotony: number | null;
  strain: number | null;
  /** Relative change from the week before; null when that week had no load. */
  change: number | null;
  workouts: PeriodWorkout[];
}

export interface PeriodSummary {
  from: string;
  to: string;
  /** Number of days in the period. */
  days: number;
  workouts: PeriodWorkout[];
  /** Workouts whose planned load is unknown (a line without an amount or pace): left out of the load, never guessed. */
  unknownLoad: PeriodWorkout[];
  lenses: Lenses;
  ratios: Ratios;
  daily: DayLoad[];
  weeks: WeekLoad[];
}

/** The calendar weeks that overlap the period, and the week before the first (for its change). */
export function weeksAround(from: string, to: string): { first: string; last: string; loadFrom: string; loadTo: string } {
  const first = weekStart(from);
  const last = weekStart(to);
  return { first, last, loadFrom: addDays(first, -7), loadTo: addDays(last, 6) };
}

/**
 * `around` holds the workouts of the whole weeks around the period (see
 * weeksAround), so weekly numbers are right even when the period starts or
 * ends mid-week; the lenses use only the period's own days.
 */
export function summarisePeriod(around: PeriodWorkout[], from: string, to: string): PeriodSummary {
  const inPeriod = around.filter((w) => w.date >= from && w.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const known = inPeriod.filter((w) => w.result.sRpe !== null);

  const lenses = sumLenses(inPeriod.map((w) => w.result));
  // Load and minutes over the workouts whose load is known (sumLenses gives null if any is unknown).
  lenses.sRpe = known.reduce<Measure>((total, w) => add(total, w.result.sRpe!), exact(0));
  lenses.durationMin = inPeriod
    .filter((w) => w.result.durationMin !== null)
    .reduce<Measure>((total, w) => add(total, w.result.durationMin!), exact(0));

  const daily: DayLoad[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const workouts = inPeriod.filter((w) => w.date === date);
    const loads = workouts.flatMap((w) => (w.result.sRpe ? [w.result.sRpe] : []));
    daily.push({ date, sRpe: loads.length ? loads.reduce((a, b) => add(a, b)) : null, workouts });
  }

  const { first, last, loadFrom } = weeksAround(from, to);
  const sessions = around.flatMap((w) => (w.result.sRpe ? [{ date: w.date, sRpe: w.result.sRpe }] : []));
  const weeks: WeekLoad[] = [];
  let previous = weekSummary(sessions, loadFrom);
  for (let monday = first; monday <= last; monday = addDays(monday, 7)) {
    const summary = weekSummary(sessions, monday);
    weeks.push({
      weekStart: monday,
      total: summary.total,
      dailyLoad: summary.dailyLoad,
      monotony: summary.monotony,
      strain: summary.strain,
      change: weekOnWeekChange(summary.total.mid, previous.total.mid),
      workouts: around.filter((w) => w.date >= monday && w.date <= addDays(monday, 6)),
    });
    previous = summary;
  }

  return {
    from,
    to,
    days: daily.length,
    workouts: inPeriod,
    unknownLoad: inPeriod.filter((w) => w.result.sRpe === null),
    lenses,
    ratios: computeRatios(lenses.exposure.reps),
    daily,
    weeks,
  };
}
