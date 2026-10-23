import { z } from "zod";

import type { ByPattern, Measure } from "@/lib/engine/types";
import { formatMeasure } from "@/lib/format";
import { PATTERN_LABELS } from "@/lib/labels";
import { PATTERNS, type PatternKey } from "@/lib/taxonomy";
import { dayLabel } from "@/lib/week";

import type { PeriodSummary, PeriodWorkout } from "./period";

/**
 * A gym's own guidelines for its programming (calc spec §6: coach-configurable
 * guidelines, not scientific thresholds). Stored in organizations.settings
 * under "guidelines"; the owner sets them. Each is optional: a guideline that
 * is not set never warns. Default values are Daniel's decision (STATUS).
 */
const range = z
  .strictObject({ min: z.number().positive().max(100).optional(), max: z.number().positive().max(100).optional() })
  .refine((r) => r.min === undefined || r.max === undefined || r.min <= r.max, { error: "The lowest must not be above the highest" });

export const guidelinesSchema = z.strictObject({
  /** At least this many hard sets per pattern per 7 days (Lens 1). */
  hardSetsPerWeek: z.partialRecord(z.enum(PATTERNS), z.number().positive().max(200)).optional(),
  /** Exposure ratios (Lens 2). */
  pushPull: range.optional(),
  kneeHip: range.optional(),
  upperLower: range.optional(),
  /** A calendar week's monotony at most this (Lens 4). */
  monotonyMax: z.number().positive().max(10).optional(),
  /** A week's planned load at most this many percent above the week before (Lens 4). */
  weekIncreaseMaxPercent: z.number().positive().max(500).optional(),
});
export type Guidelines = z.infer<typeof guidelinesSchema>;

/**
 * A new gym's guidelines (calc spec decision 18, approved 2026-10-22). The
 * database gives every new gym the same (private.default_guidelines).
 */
export const DEFAULT_GUIDELINES: Guidelines = {
  hardSetsPerWeek: { squat: 4, hinge: 4, h_push: 3, h_pull: 3, v_push: 2, v_pull: 3 },
  pushPull: { min: 0.8, max: 1.2 },
  kneeHip: { min: 0.7, max: 1.5 },
  monotonyMax: 2,
  weekIncreaseMaxPercent: 15,
};

export const RATIO_LABELS = { pushPull: "Push : pull", kneeHip: "Knee : hip", upperLower: "Upper : lower" } as const;
type RatioKey = keyof typeof RATIO_LABELS;

/** The settings' guidelines, or none if what is stored does not read. */
export function readGuidelines(settings: unknown): Guidelines {
  const raw = settings && typeof settings === "object" ? (settings as Record<string, unknown>).guidelines : undefined;
  const parsed = guidelinesSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export const hasGuidelines = (g: Guidelines) =>
  Object.keys(g.hardSetsPerWeek ?? {}).length > 0 || [g.pushPull, g.kneeHip, g.upperLower, g.monotonyMax, g.weekIncreaseMaxPercent].some((v) => v !== undefined);

export interface Warning {
  key: string;
  /** What is off, in a coach's words. */
  text: string;
  /** The guideline it is checked against. */
  guideline: string;
  /** The workouts behind it, most first. */
  workouts: PeriodWorkout[];
}

const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const PATTERN_SIDES: Record<RatioKey, [PatternKey[], PatternKey[], [string, string]]> = {
  pushPull: [["h_push", "v_push"], ["h_pull", "v_pull"], ["push", "pull"]],
  kneeHip: [["squat", "lunge"], ["hinge"], ["knee", "hip"]],
  upperLower: [["h_push", "v_push", "h_pull", "v_pull"], ["squat", "lunge", "hinge", "jump"], ["upper", "lower"]],
};

/** The workouts that add most to some patterns' measure, most first. */
function topWorkouts(workouts: PeriodWorkout[], measure: (w: PeriodWorkout) => ByPattern, patterns: PatternKey[], count = 3): PeriodWorkout[] {
  const score = (w: PeriodWorkout) => patterns.reduce((n, p) => n + (measure(w)[p]?.mid ?? 0), 0);
  return workouts
    .filter((w) => score(w) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, count);
}

/** The period checked against the gym's guidelines. Nothing warns that the gym has not set. */
export function checkGuidelines(summary: PeriodSummary, g: Guidelines): Warning[] {
  const warnings: Warning[] = [];
  const weeksInPeriod = summary.days / 7;

  for (const [pattern, perWeek] of Object.entries(g.hardSetsPerWeek ?? {}) as [PatternKey, number][]) {
    const expected = perWeek * weeksInPeriod;
    const actual = summary.lenses.hardSets.byPattern[pattern];
    if ((actual?.mid ?? 0) >= expected) continue;
    const label = PATTERN_LABELS[pattern];
    warnings.push({
      key: `hard-sets:${pattern}`,
      text: `${label}: ${actual ? formatMeasure(actual, "sets").main : "no"} hard ${actual?.mid === 1 ? "set" : "sets"} in ${summary.days} days`,
      guideline: `At least ${one(perWeek)} a week (${one(expected)} for ${summary.days} days)`,
      workouts: topWorkouts(summary.workouts, (w) => w.result.hardSets.byPattern, [pattern]),
    });
  }

  for (const key of Object.keys(RATIO_LABELS) as RatioKey[]) {
    const limit = g[key];
    const ratio: Measure | null = summary.ratios[key];
    if (!limit || !ratio) continue;
    const [first, second, [a, b]] = PATTERN_SIDES[key];
    const tooHigh = limit.max !== undefined && ratio.mid > limit.max;
    const tooLow = limit.min !== undefined && ratio.mid < limit.min;
    if (!tooHigh && !tooLow) continue;
    warnings.push({
      key: `ratio:${key}`,
      text: `${RATIO_LABELS[key]} ${formatMeasure(ratio, "ratio").main}: ${tooHigh ? `${a}-heavy` : `${b}-heavy`} (exposure reps)`,
      guideline: [limit.min !== undefined && `at least ${one(limit.min)}`, limit.max !== undefined && `at most ${one(limit.max)}`].filter(Boolean).join(", ").replace(/^a/, "A"),
      workouts: topWorkouts(summary.workouts, (w) => w.result.exposure.reps, tooHigh ? first : second),
    });
  }

  for (const week of summary.weeks) {
    const byLoad = [...week.workouts].filter((w) => w.result.sRpe).sort((x, y) => y.result.sRpe!.mid - x.result.sRpe!.mid).slice(0, 3);
    if (g.monotonyMax !== undefined && week.monotony !== null && week.monotony > g.monotonyMax) {
      warnings.push({
        key: `monotony:${week.weekStart}`,
        text: `Week of ${dayLabel(week.weekStart)}: monotony ${week.monotony.toFixed(1)} (the days' loads are much alike)`,
        guideline: `At most ${one(g.monotonyMax)}`,
        workouts: byLoad,
      });
    }
    if (g.weekIncreaseMaxPercent !== undefined && week.change !== null && week.change * 100 > g.weekIncreaseMaxPercent) {
      warnings.push({
        key: `increase:${week.weekStart}`,
        text: `Week of ${dayLabel(week.weekStart)}: planned load ${Math.round(week.change * 100)}% above the week before`,
        guideline: `At most ${one(g.weekIncreaseMaxPercent)}% more than the week before`,
        workouts: byLoad,
      });
    }
  }
  return warnings;
}

/** A warning about one program's own numbers. */
export type ProgramWarning = Warning & { programId: string };

/**
 * Each program checked on its own numbers against its own guidelines
 * (decisions 4 and 5, 2026-10-23): programs shown together are never mixed
 * for warnings.
 */
export function checkPrograms(byProgram: { programId: string; summary: PeriodSummary }[], guidelinesOf: (programId: string) => Guidelines): ProgramWarning[] {
  return byProgram.flatMap(({ programId, summary }) =>
    checkGuidelines(summary, guidelinesOf(programId)).map((w) => ({ ...w, key: `${programId}:${w.key}`, programId })),
  );
}
