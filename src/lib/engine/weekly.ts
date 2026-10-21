// Weekly planned load (calc spec Lens 4): total, monotony and strain
// (Foster 1998), and week-on-week change. ACWR is deliberately not here: it
// may only ever be shown as a trend (Impellizzeri et al. 2020).

import { add, exact } from "@/lib/engine/measure";
import type { Measure } from "@/lib/engine/types";

export interface SessionLoad {
  /** YYYY-MM-DD */
  date: string;
  /** Planned sRPE of the session (AU). */
  sRpe: Measure;
}

export interface WeekSummary {
  weekStart: string;
  /** Seven daily loads (AU, middle estimate), rest days as 0. */
  dailyLoad: number[];
  /** Weekly load as a range. */
  total: Measure;
  mean: number;
  /** Standard deviation of the seven daily loads (population). */
  sd: number;
  /** Mean ÷ SD of daily load; null when every day has the same load. */
  monotony: number | null;
  /** Weekly load × monotony; null when monotony is. */
  strain: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (isoDate: string) => Math.round(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);

/** Summarises the seven days starting at `weekStart`; sessions outside are ignored. Monotony uses middle estimates. */
export function weekSummary(sessions: SessionLoad[], weekStart: string): WeekSummary {
  const start = dayNumber(weekStart);
  const dailyLoad = Array.from({ length: 7 }, () => 0);
  let total: Measure = exact(0);
  for (const session of sessions) {
    const day = dayNumber(session.date) - start;
    if (day < 0 || day >= 7) continue;
    dailyLoad[day] = (dailyLoad[day] ?? 0) + session.sRpe.mid;
    total = add(total, session.sRpe);
  }
  const mean = total.mid / 7;
  const sd = Math.sqrt(dailyLoad.reduce((acc, load) => acc + (load - mean) ** 2, 0) / 7);
  const monotony = sd > 0 ? mean / sd : null;
  return { weekStart, dailyLoad, total, mean, sd, monotony, strain: monotony === null ? null : total.mid * monotony };
}

/** Relative change from the previous week's total; null when the previous week was empty. */
export function weekOnWeekChange(currentTotal: number, previousTotal: number): number | null {
  return previousTotal > 0 ? (currentTotal - previousTotal) / previousTotal : null;
}
