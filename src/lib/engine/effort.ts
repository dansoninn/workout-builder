// Effort on two axes, pace and load (calc spec §4.4, approved).

import type { Block, EffortSource, EngineConfig } from "@/lib/engine/types";
import type { EffortKey } from "@/lib/taxonomy";

/**
 * Effort used when the coach sets none: calc spec §9.4, still PROVISIONAL.
 *   strength → Load Hard / Pace Easy; AMRAP & intervals → Pace Moderate;
 *   chipper (for time) → Pace Hard.
 * §9.4's "accessory = Load Moderate" cannot be applied: blocks have no
 * accessory intent, so the coach sets it. Formats §9.4 does not name follow
 * the nearest rule (tabata and EMOM like intervals; skill and mobility easy)
 * and are listed for review in docs/STATUS.md.
 */
export function defaultEfforts(block: Pick<Block, "intent" | "format">): { pace: EffortKey | null; load: EffortKey | null } {
  if (block.intent === "strength") return { pace: "easy", load: "hard" };
  if (block.intent === "skill" || block.intent === "mobility") return { pace: "easy", load: null };
  if (block.format === "for_time") return { pace: "hard", load: null };
  return { pace: "moderate", load: null };
}

export interface ResolvedEffort {
  pace: EffortKey | null;
  load: EffortKey | null;
  /** The higher of the two axes' calc RPE; null when neither axis is set. */
  plannedRpe: number | null;
  /** Where the effort that sets the planned RPE came from. */
  source: EffortSource;
}

/** Block effort: each axis is the coach's choice, else the default. */
export function resolveBlockEffort(block: Block, config: EngineConfig): ResolvedEffort {
  const defaults = defaultEfforts(block);
  const axes = [
    { key: block.paceEffort ?? defaults.pace, source: block.paceEffort ? "coach" : "default" },
    { key: block.loadEffort ?? defaults.load, source: block.loadEffort ? "coach" : "default" },
  ] as const;

  let plannedRpe: number | null = null;
  let source: EffortSource = "none";
  for (const axis of axes) {
    if (!axis.key) continue;
    const rpe = config.effortLevels[axis.key].rpeCalc;
    if (plannedRpe === null || rpe > plannedRpe || (rpe === plannedRpe && axis.source === "coach")) {
      plannedRpe = rpe;
      source = axis.source;
    }
  }
  return { pace: axes[0].key, load: axes[1].key, plannedRpe, source };
}

/** A hard set: load effort Moderate or Hard, i.e. at most 3 reps in reserve (calc spec Lens 1). */
export function countsAsHardSet(loadEffort: EffortKey | null, config: EngineConfig): boolean {
  if (!loadEffort) return false;
  const { rirMax } = config.effortLevels[loadEffort];
  return rirMax !== null && rirMax <= 3;
}
