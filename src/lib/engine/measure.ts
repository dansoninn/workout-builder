// Numbers that carry their confidence. Anything combined with an estimate is
// an estimate (calc spec §1.3).

import type { Confidence, Measure } from "@/lib/engine/types";

export const exact = (value: number): Measure => ({ value, confidence: "exact" });
export const estimated = (value: number): Measure => ({ value, confidence: "estimated" });

export function combine(...confidences: Confidence[]): Confidence {
  return confidences.includes("estimated") ? "estimated" : "exact";
}

export function add(a: Measure | undefined, b: Measure): Measure {
  if (!a) return b;
  return { value: a.value + b.value, confidence: combine(a.confidence, b.confidence) };
}

export function multiply(a: Measure, b: Measure): Measure {
  return { value: a.value * b.value, confidence: combine(a.confidence, b.confidence) };
}

export function scale(a: Measure, factor: number): Measure {
  return { value: a.value * factor, confidence: a.confidence };
}

/** Adds `value` under `key`, creating the entry if needed. */
export function addTo<K extends string>(target: Partial<Record<K, Measure>>, key: K, value: Measure): void {
  target[key] = add(target[key], value);
}

/** Sums the given keys; undefined if none of them has a value. */
export function sumKeys<K extends string>(source: Partial<Record<K, Measure>>, keys: readonly K[]): Measure | undefined {
  let total: Measure | undefined;
  for (const key of keys) {
    const value = source[key];
    if (value) total = add(total, value);
  }
  return total;
}

/** a ÷ b, or null when either side is missing or b is zero. */
export function ratio(a: Measure | undefined, b: Measure | undefined): Measure | null {
  if (!a || !b || b.value === 0) return null;
  return { value: a.value / b.value, confidence: combine(a.confidence, b.confidence) };
}
