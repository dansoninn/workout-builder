// Builds docs/pace-defaults.md: the approved pace table and rules, plus the
// calc spec §7 worked WODs computed with them.

import { ENGINE_CONFIG } from "@/lib/engine/config";
import { WOD_1, WOD_2, WOD_3 } from "@/lib/engine/fixtures/worked-wods";
import type { Measure, Pace } from "@/lib/engine/types";
import { weekSummary } from "@/lib/engine/weekly";
import { computeWorkout } from "@/lib/engine/workout";
import { CATEGORIES, CORE_EXERCISES, type Category, type CoreExercise } from "@/lib/library/core-exercises";
import { PACE_DEFAULTS } from "@/lib/library/pace-defaults";

export const PACE_DOC_PATH = "docs/pace-defaults.md";

const mmss = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};
const one = (n: number): string => (Math.round(n * 10) / 10).toString();
const fmt = (n: number, digits: number) => n.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** "~7.7 (6.7–8.7)" for an estimate, "15" for an exact value. */
export function rangeText(m: Measure | null | undefined, digits = 0): string {
  if (!m) return "—";
  if (m.confidence === "exact") return fmt(m.mid, digits);
  return `~${fmt(m.mid, digits)} (${fmt(m.low, digits)}–${fmt(m.high, digits)})`;
}

/** The pace in coaching terms. */
function describe(exercise: CoreExercise, pace: Pace | undefined): string {
  if (!pace) return exercise.unit === "time_s" ? "— (timed hold)" : "**missing**";
  const parts: string[] = [];
  if (pace.secPerRep !== undefined) parts.push(`${one(pace.secPerRep)} s/rep (${one(60 / pace.secPerRep)} reps/min)`);
  if (pace.secPerM !== undefined) {
    const s = pace.secPerM;
    const modality = exercise.kind === "monostructural" ? exercise.modality : null;
    if (modality === "run") parts.push(`${mmss(s * 1000)} /km`);
    else if (modality === "row" || modality === "ski") parts.push(`${mmss(s * 500)} /500 m`);
    else if (modality === "swim") parts.push(`${mmss(s * 100)} /100 m`);
    else if (modality === "bike") parts.push(`${mmss(s * 1000)} /1,000 m`);
    else parts.push(`${one(s)} s/m (${Math.round(60 / s)} m/min)`);
  }
  if (pace.secPerCal !== undefined) parts.push(`${one(pace.secPerCal)} s/cal (${one(60 / pace.secPerCal)} cal/min)`);
  return parts.join(" · ");
}

export function buildPaceMarkdown(): string {
  const [w1, w2, w3] = [WOD_1, WOD_2, WOD_3].map((w) => computeWorkout(w, ENGINE_CONFIG));
  const week = weekSummary(
    [w1, w2, w3].map((w, i) => ({ date: `2026-10-${19 + 2 * i}`, sRpe: w?.sRpe ?? { low: 0, mid: 0, high: 0, confidence: "exact" as const } })),
    "2026-10-19",
  );
  const { transitionSec, defaultRestSec, paceEffortFactor: f, fatigue, paceBand } = ENGINE_CONFIG;

  const sections = (Object.keys(CATEGORIES) as Category[]).map((category) => {
    const rows = CORE_EXERCISES.filter((e) => e.category === category).map(
      (e) => `| ${e.name} | ${describe(e, PACE_DEFAULTS[e.name])} |`,
    );
    return [`### ${CATEGORIES[category]}`, "", "| Exercise | Pace at Hard |", "|---|---|", ...rows].join("\n");
  });

  return `# Pace defaults

**Status:** approved by Daniel on 2026-10-21 as the starting point (calc spec §9.5). Seeded into \`exercises.pace_default\` by migration \`20261021001300_core_pace_defaults.sql\`. Every gym can override any pace in its settings.

Generated from \`src/lib/library/pace-defaults.ts\` and \`src/lib/engine/config.ts\` by \`npm run library:generate\`; do not edit by hand.

## What these paces mean

- **Who:** an intermediate adult class member.
- **What:** the working pace at Pace **Hard** ("fast, near limit"), including the short breaks such a member takes in a metcon. Transitions between exercises are added separately.
- **Anchors** from §9.5, at max effort: row 2:00/500 m and air bike ~20 cal per 90 s (Hard: row ${mmss((PACE_DEFAULTS.Row?.secPerM ?? 0) * 500)} /500 m, air bike ${one(PACE_DEFAULTS["Air bike"]?.secPerCal ?? 0)} s/cal).
- Used for: AMRAP rounds, For Time finish, max effort in a window, and set durations (calc spec §5).

## Rules

| Rule | Value |
|---|---|
| Pace effort scales the pace (time per rep) | Easy ×${f.easy} · Moderate ×${f.moderate} · Hard ×${f.hard} · Max ×${f.max} |
| Fatigue in continuous pieces (AMRAP, For Time, max-effort windows), by estimated duration | under ${fatigue.mediumFromMin} min ×1.0 · ${fatigue.mediumFromMin}–${fatigue.longAboveMin} min ×${fatigue.medium} · over ${fatigue.longAboveMin} min ×${fatigue.long} |
| Estimate range (pace band, after effort and fatigue) | fast = pace ×${paceBand.fast}, slow = pace ×${paceBand.slow} |
| Transition between exercises (in a round or chipper) | ${transitionSec} s |
| Rest between sets when the coach gives none | strength ${defaultRestSec.strength} s, other blocks ${defaultRestSec.other} s |

## Worked WODs with these paces (calc spec §7)

Estimates shown as middle (low–high). "Initial estimate" is the first rough guess in §7, not coach-validated.

| Worked WOD | Initial estimate | Engine |
|---|---|---|
| WOD 1 C — AMRAP 8 rounds (Pace Hard) | ~10 | ${rangeText(w1?.blocks[2]?.rounds, 1)} |
| WOD 2 — chipper finish, min (Pace Hard, 25 min cap) | ~22 | ${rangeText(w2?.durationMin, 1)} |
| WOD 2 — planned load, AU | ~198 | ${rangeText(w2?.sRpe)} |
| WOD 3 — row m, 4 × 90 s (Pace Hard) | ~1,500 | ${rangeText(w3?.monostructural.row?.distanceM)} |
| WOD 3 — air bike cal, 4 × 90 s | ~80 | ${rangeText(w3?.monostructural.bike?.calories)} |
| WOD 3 — lunges, 4 × 90 s | ~72 | ${rangeText(w3?.exposure.reps.lunge)} |
| Week planned load, AU | 643 | ${rangeText(week.total)} |

## Paces by exercise

${sections.join("\n\n")}
`;
}
