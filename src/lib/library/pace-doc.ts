// Builds docs/pace-defaults.md: the proposed pace table for Daniel's review,
// plus what the calc spec §7 worked WODs come out as with these paces.

import { FIXTURE_CONFIG, WOD_1, WOD_2, WOD_3 } from "@/lib/engine/fixtures/worked-wods";
import type { EngineConfig, Measure, Pace, Workout } from "@/lib/engine/types";
import { weekSummary } from "@/lib/engine/weekly";
import { computeWorkout } from "@/lib/engine/workout";
import { CATEGORIES, CORE_EXERCISES, type Category, type CoreExercise } from "@/lib/library/core-exercises";
import { PROPOSED_PACES, PROPOSED_PACE_RULES } from "@/lib/library/pace-defaults";

export const PACE_DOC_PATH = "docs/pace-defaults.md";

const proposedConfig: EngineConfig = { ...FIXTURE_CONFIG, ...PROPOSED_PACE_RULES };

function withProposedPaces(workout: Workout): Workout {
  return {
    blocks: workout.blocks.map((block) => ({
      ...block,
      items: block.items.map((item) =>
        item.exercise ? { ...item, exercise: { ...item.exercise, pace: PROPOSED_PACES[item.exercise.name] ?? null } } : item,
      ),
    })),
  };
}

const mmss = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};
const one = (n: number): string => (Math.round(n * 10) / 10).toString();
const num = (m: Measure | null | undefined, digits = 0): string =>
  m ? `~${m.value.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}` : "—";

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
  const [w1, w2, w3] = [WOD_1, WOD_2, WOD_3].map((w) => computeWorkout(withProposedPaces(w), proposedConfig));
  const week = weekSummary(
    [w1, w2, w3].map((w, i) => ({ date: `2026-10-${19 + 2 * i}`, sRpe: w?.sRpe?.value ?? 0 })),
    "2026-10-19",
  );
  const { transitionSec, defaultRestSec, paceEffortFactor: f } = PROPOSED_PACE_RULES;

  const sections = (Object.keys(CATEGORIES) as Category[]).map((category) => {
    const rows = CORE_EXERCISES.filter((e) => e.category === category).map(
      (e) => `| ${e.name} | ${describe(e, PROPOSED_PACES[e.name])} |`,
    );
    return [`### ${CATEGORIES[category]}`, "", "| Exercise | Pace at Hard |", "|---|---|", ...rows].join("\n");
  });

  return `# Pace defaults — for review

**Status:** proposal for Daniel's approval (Step 3, calc spec §9.5). Not yet used in tests or stored in the database.

Generated from \`src/lib/library/pace-defaults.ts\` by \`npm run library:generate\`; do not edit by hand. Mark changes anywhere you like and Claude Code updates the source.

## What these paces mean

- **Who:** an intermediate adult class member (approved, §9.5). Every gym can override any pace in its settings.
- **What:** the working pace at Pace **Hard** ("fast, near limit"), including the short breaks such a member takes in a metcon. Transitions between exercises are added separately.
- **Anchors** from §9.5, at max effort: row 2:00/500 m and air bike ~20 cal per 90 s. With max = 0.9 × Hard, the Hard paces are row ${mmss((PROPOSED_PACES.Row?.secPerM ?? 0) * 500)} /500 m and air bike ${one(PROPOSED_PACES["Air bike"]?.secPerCal ?? 0)} s/cal.
- Used for: AMRAP rounds, For Time finish, max effort in a window, and set durations (calc spec §5).

## Rules (also for approval)

| Rule | Proposed |
|---|---|
| Transition between exercises (in a round or chipper) | ${transitionSec} s |
| Rest between sets when the coach gives none | strength ${defaultRestSec.strength} s, other blocks ${defaultRestSec.other} s |
| Pace effort scales the pace | Easy ×${f.easy} · Moderate ×${f.moderate} · Hard ×${f.hard} · Max ×${f.max} (time per rep; higher = slower) |

The spec does not yet say how pace effort changes the pace; the scaling above is a proposal. Without it, "Easy" and "Max" would give the same AMRAP estimate.

## Effect on your worked WODs (calc spec §7)

Your §7 estimates next to what the engine computes with the proposed paces and rules. Where they differ, either the paces or the §7 estimate should move.

| Worked WOD | §7 estimate | With proposed paces |
|---|---|---|
| WOD 1 C — AMRAP 8 rounds (Pace Hard) | ~10 | ${num(w1?.blocks[2]?.rounds, 1)} |
| WOD 2 — chipper finish (Pace Max, 25 min cap) | ~22 min | ${num(w2?.durationMin, 1)} min |
| WOD 2 — planned load | ~209 AU | ${num(w2?.sRpe)} AU |
| WOD 3 — row, 4 × 90 s (Pace Hard) | ~1,500 m | ${num(w3?.monostructural.row?.distanceM)} m |
| WOD 3 — air bike, 4 × 90 s | ~80 cal | ${num(w3?.monostructural.bike?.calories)} cal |
| WOD 3 — lunges, 4 × 90 s | ~72 reps | ${num(w3?.exposure.reps.lunge)} reps |
| Week planned load | ~669 AU | ${num({ value: week.total, confidence: "estimated" })} AU |

## Paces by exercise

${sections.join("\n\n")}
`;
}
