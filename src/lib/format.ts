// "Honest numbers" (docs/DESIGN.md): how every computed value is written.
// Exact values are plain. Estimates get "~" and their range, which is shown
// whenever its rounded ends differ. Precision follows the unit, and estimated
// distances never claim more precision than they have.

import type { Measure } from "@/lib/engine/types";

export type Unit = "min" | "AU" | "reps" | "rounds" | "sets" | "m" | "cal" | "kg" | "ratio" | "clock";

interface UnitRule {
  /** Decimals for a value of this size. */
  decimals: (value: number) => number;
  /** Round estimates to this step (e.g. 10 m). */
  estimateStep?: number;
  /** Text after the number; empty for none. */
  suffix: string;
  /** Writes the rounded number its own way (a clock time from seconds). */
  text?: (value: number) => string;
}

const RULES: Record<Unit, UnitRule> = {
  min: { decimals: (v) => (v < 10 ? 1 : 0), suffix: " min" },
  AU: { decimals: () => 0, suffix: " AU" },
  reps: { decimals: () => 0, suffix: "" },
  rounds: { decimals: () => 1, suffix: "" },
  sets: { decimals: (v) => (Number.isInteger(v) ? 0 : 1), suffix: "" },
  m: { decimals: () => 0, estimateStep: 10, suffix: " m" },
  cal: { decimals: () => 0, suffix: " cal" },
  // Single loads keep their half kilos (22.5 kg); volume load in the hundreds or thousands is whole kilos.
  kg: { decimals: (v) => (Number.isInteger(v) || v >= 100 ? 0 : 1), suffix: " kg" },
  ratio: { decimals: () => 1, suffix: "" },
  // Seconds as a finish time on the clock (12:30); estimates to the nearest 10 s.
  clock: { decimals: () => 0, estimateStep: 10, suffix: "", text: clockText },
};

/** 750 → "12:30"; 3750 → "1:02:30". */
function clockText(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function round(value: number, decimals: number, step?: number): number {
  if (step) return Math.round(value / step) * step;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function number(value: number, decimals: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

export interface FormattedMeasure {
  /** "~20 min", "202 AU" */
  main: string;
  /** "17–24", or null when exact or when the range rounds to one number */
  range: string | null;
  estimated: boolean;
  /** Plain-language reading for screen readers and tooltips. */
  label: string;
}

export function formatMeasure(measure: Measure, unit: Unit): FormattedMeasure {
  const rule = RULES[unit];
  const estimated = measure.confidence === "estimated";
  const step = estimated ? rule.estimateStep : undefined;
  const decimals = rule.decimals(measure.mid);
  const write = (value: number) => {
    const rounded = round(value, decimals, step);
    return rule.text ? rule.text(rounded) : number(rounded, step ? 0 : decimals);
  };
  const mid = write(measure.mid);
  const main = `${estimated ? "~" : ""}${mid}${rule.suffix}`;

  let range: string | null = null;
  if (estimated) {
    const low = write(measure.low);
    const high = write(measure.high);
    if (low !== high) range = `${low}–${high}`;
  }

  const label = estimated
    ? `about ${mid}${rule.suffix}${range ? `, likely between ${range.replace("–", " and ")}` : ""}`
    : `${mid}${rule.suffix}`;
  return { main, range, estimated, label };
}
