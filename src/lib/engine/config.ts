// Calculation rules approved by Daniel on 2026-10-21 (calc spec §5, §9).
// Changing any value here changes results: bump CALC_VERSION.

import type { EngineConfig } from "@/lib/engine/types";
import { EFFORT_LEVELS } from "@/lib/taxonomy";

export const ENGINE_CONFIG: EngineConfig = {
  effortLevels: EFFORT_LEVELS,
  transitionSec: 5,
  defaultRestSec: { strength: 120, other: 60 },
  paceEffortFactor: { easy: 1.4, moderate: 1.15, hard: 1, max: 0.9 },
  fatigue: { mediumFromMin: 10, longAboveMin: 20, medium: 1.1, long: 1.2 },
  paceBand: { fast: 0.85, slow: 1.2 },
};

/** Fatigue factor for a continuous piece: <10 min ×1.0, 10–20 min ×1.1, >20 min ×1.2. */
export function fatigueFactor(minutes: number, config: EngineConfig): number {
  const { mediumFromMin, longAboveMin, medium, long } = config.fatigue;
  if (minutes > longAboveMin) return long;
  if (minutes >= mediumFromMin) return medium;
  return 1;
}
