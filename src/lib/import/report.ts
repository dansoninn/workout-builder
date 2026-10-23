import { type PeriodSummary, type PeriodWorkout, summarisePeriod } from "@/lib/analytics/period";
import { sumLenses } from "@/lib/engine/workout";
import { MODALITY_LABELS, PATTERN_LABELS } from "@/lib/labels";
import type { PatternKey } from "@/lib/taxonomy";
import { dayLabel, weekStart } from "@/lib/week";

/**
 * "Your programming, analysed" (BACKLOG "Program import", higher-level
 * additions): an imported period in the four lenses, and what stands out in
 * plain words. Observations, never verdicts: the numbers say what was
 * programmed; whether it is right is the coach's call, against the gym's own
 * guidelines.
 */

export interface ReportWorkout extends PeriodWorkout {
  /** The exercises of its lines, by id (each once). */
  exercises: string[];
}

export interface ProgrammingReport {
  summary: PeriodSummary;
  findings: string[];
  topExercises: { name: string; sessions: number; share: number }[];
}

/** The main patterns, whose absence over a week is worth saying. */
const MAIN_PATTERNS: PatternKey[] = ["squat", "hinge", "lunge", "h_push", "v_push", "h_pull", "v_pull"];

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export function analyseProgramming(workouts: ReportWorkout[], exerciseName: (id: string) => string | null): ProgrammingReport | null {
  if (workouts.length === 0) return null;
  const dates = workouts.map((w) => w.date).sort();
  const from = dates[0]!;
  const to = dates.at(-1)!;
  const summary = summarisePeriod(workouts, from, to);
  const findings: string[] = [];

  // How much: weeks, sessions a week, minutes a session.
  const weeks = summary.weeks.length;
  const minutes = summary.workouts.map((w) => w.result.durationMin?.mid).filter((m): m is number => m !== undefined);
  const averageMinutes = minutes.length ? minutes.reduce((a, b) => a + b, 0) / minutes.length : null;
  findings.push(
    `${weeks} ${weeks === 1 ? "week" : "weeks"}, ${workouts.length} workouts: ${(workouts.length / Math.max(weeks, 1)).toFixed(1)} a week` +
      (averageMinutes ? `, about ${Math.round(averageMinutes)} minutes each.` : "."),
  );

  // Balance, by reps per pattern.
  const ratios = [
    ["Knee : hip", summary.ratios.kneeHip],
    ["Push : pull", summary.ratios.pushPull],
    ["Upper : lower", summary.ratios.upperLower],
  ] as const;
  const shown = ratios.filter(([, r]) => r).map(([label, r]) => `${label} ${r!.mid.toFixed(1)}`);
  if (shown.length) findings.push(`${shown.join(", ")} (reps by pattern).`);

  // Weeks without hard sets in a main pattern that is trained hard at other times.
  const byWeek = new Map<string, PeriodWorkout[]>();
  for (const w of workouts) byWeek.set(weekStart(w.date), [...(byWeek.get(weekStart(w.date)) ?? []), w]);
  const weekly = [...byWeek.values()].map((ws) => sumLenses(ws.map((w) => w.result)).hardSets.byPattern);
  const gaps = MAIN_PATTERNS.map((p) => ({ p, missing: weekly.filter((h) => !(h[p]?.mid ?? 0)).length }))
    .filter((g) => g.missing > 0 && g.missing < weekly.length)
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 3);
  for (const g of gaps) findings.push(`No ${PATTERN_LABELS[g.p].toLowerCase()} hard sets in ${g.missing} of ${weekly.length} weeks.`);
  const never = MAIN_PATTERNS.filter((p) => weekly.every((h) => !(h[p]?.mid ?? 0)));
  if (never.length && weekly.length > 1) findings.push(`No hard sets at all for ${never.map((p) => PATTERN_LABELS[p].toLowerCase()).join(", ")}.`);

  // The exercises that come back most.
  const sessions = new Map<string, number>();
  for (const w of workouts) for (const id of new Set(w.exercises)) sessions.set(id, (sessions.get(id) ?? 0) + 1);
  const topExercises = [...sessions]
    .map(([id, count]) => ({ name: exerciseName(id) ?? "", sessions: count, share: share(count, workouts.length) }))
    .filter((e) => e.name)
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
    .slice(0, 8);
  if (topExercises.length) {
    findings.push(`Most programmed: ${topExercises.slice(0, 4).map((e) => `${e.name.toLowerCase()} in ${e.share}% of workouts`).join(", ")}.`);
  }

  // Conditioning by modality.
  const modalities = Object.entries(summary.lenses.monostructural).flatMap(([m, t]) => {
    const parts = [t?.distanceM && t.distanceM.mid > 0 ? `${n(t.distanceM.mid / 1000)} km` : null, t?.calories && t.calories.mid > 0 ? `${n(t.calories.mid)} cal` : null].filter(Boolean);
    return parts.length ? [`${MODALITY_LABELS[m as keyof typeof MODALITY_LABELS].toLowerCase()} ${parts.join(" and ")}`] : [];
  });
  if (modalities.length) findings.push(`Conditioning: ${modalities.join(", ")}.`);

  // The heaviest and the lightest week, by planned load; monotony.
  const loads = summary.weeks.filter((w) => w.total.mid > 0);
  if (loads.length >= 2) {
    const heaviest = loads.reduce((a, b) => (b.total.mid > a.total.mid ? b : a));
    const lightest = loads.reduce((a, b) => (b.total.mid < a.total.mid ? b : a));
    findings.push(`The heaviest week starts ${dayLabel(heaviest.weekStart)} (${n(heaviest.total.mid)} AU planned load); the lightest ${dayLabel(lightest.weekStart)} (${n(lightest.total.mid)} AU).`);
  }
  const monotony = summary.weeks.map((w) => w.monotony).filter((m): m is number => m !== null);
  if (monotony.length) findings.push(`Monotony averages ${(monotony.reduce((a, b) => a + b, 0) / monotony.length).toFixed(1)} a week.`);

  return { summary, findings, topExercises };
}
