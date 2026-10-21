// Numbers that carry their confidence and range. Every estimate is a range
// {low, mid, high} (calc spec §1.3, §5); exact values have low = mid = high.
// Anything combined with an estimate is an estimate. All quantities are
// non-negative, so ranges combine by simple interval arithmetic.

import type { Confidence, Measure } from "@/lib/engine/types";

export const exact = (value: number): Measure => ({ low: value, mid: value, high: value, confidence: "exact" });

export const estimated = (mid: number, low = mid, high = mid): Measure => ({ low, mid, high, confidence: "estimated" });

export function combine(...confidences: Confidence[]): Confidence {
  return confidences.includes("estimated") ? "estimated" : "exact";
}

export function add(a: Measure | undefined, b: Measure): Measure {
  if (!a) return b;
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high, confidence: combine(a.confidence, b.confidence) };
}

export function multiply(a: Measure, b: Measure): Measure {
  return { low: a.low * b.low, mid: a.mid * b.mid, high: a.high * b.high, confidence: combine(a.confidence, b.confidence) };
}

/** a ÷ b: the lowest result comes from the largest divisor. */
export function divide(a: Measure, b: Measure): Measure {
  return { low: a.low / b.high, mid: a.mid / b.mid, high: a.high / b.low, confidence: combine(a.confidence, b.confidence) };
}

export function scale(a: Measure, factor: number): Measure {
  return { low: a.low * factor, mid: a.mid * factor, high: a.high * factor, confidence: a.confidence };
}

export function floor(a: Measure): Measure {
  return { low: Math.floor(a.low), mid: Math.floor(a.mid), high: Math.floor(a.high), confidence: a.confidence };
}

export function capAt(a: Measure, cap: number): Measure {
  return { low: Math.min(a.low, cap), mid: Math.min(a.mid, cap), high: Math.min(a.high, cap), confidence: a.confidence };
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

/** a ÷ b, or null when either side is missing or b can be zero. */
export function ratio(a: Measure | undefined, b: Measure | undefined): Measure | null {
  if (!a || !b || b.low <= 0) return null;
  return divide(a, b);
}
