import type { Load, Quantity } from "@/lib/engine/types";
import type { MeasureUnit } from "@/lib/taxonomy";

/**
 * What a coach types in a line's quantity and load fields, and back. These
 * are single fields, not the free-text parser (4c): the exercise is chosen
 * separately, so its default unit decides what a bare number means ("500"
 * on a row is 500 m, on a squat 500 reps).
 */

export type Parsed<T> = { ok: true; value: T; implementCount?: number } | { ok: false; error: string };

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const num = (text: string) => Number(text.replace(",", "."));
const isWhole = (n: number) => Number.isInteger(n) && n >= 1;

/** "0:30" → 30, "1:30" → 90, "90" → 90 (seconds). */
function seconds(text: string): number | null {
  const clock = text.match(/^(\d+):([0-5]\d)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minutes = text.match(new RegExp(`^(${NUMBER})\\s*(?:min|mins|minutes?|')$`, "i"));
  if (minutes) return Math.round(num(minutes[1]!) * 60);
  const secs = text.match(new RegExp(`^(${NUMBER})\\s*(?:s|sec|secs|seconds?|")?$`, "i"));
  if (secs) return Math.round(num(secs[1]!));
  return null;
}

const UNIT_WORDS: Record<string, MeasureUnit> = {
  rep: "reps", reps: "reps",
  m: "distance_m", meter: "distance_m", meters: "distance_m", metre: "distance_m", metres: "distance_m",
  km: "distance_m", k: "distance_m",
  cal: "calories", cals: "calories", calorie: "calories", calories: "calories",
  s: "time_s", sec: "time_s", secs: "time_s", second: "time_s", seconds: "time_s", time: "time_s",
  distance: "distance_m",
};

/**
 * Parses a quantity. `unit` is the exercise's default unit, used when the
 * coach types a bare number or "max".
 */
export function parseQuantity(input: string, unit: MeasureUnit = "reps"): Parsed<Quantity> {
  const read = readQuantity(input, unit);
  if (read.ok || !UNREAD.test(read.error)) return read;
  return { ok: false, error: whatWasNotRead(input, (t) => readQuantity(t, unit).ok, QUANTITY_EXAMPLES) };
}

const QUANTITY_EXAMPLES = "Try 5, 8-10, 21-15-9, 8/8, 400 m, 15 cal, 0:30 or max";
const LOAD_EXAMPLES = "Try 75-80%, 22.5/15 kg, 2x22.5 or bw";
/** Errors that only say the text was not read; the others (a range the wrong way round) say what to fix. */
const UNREAD = /^(?:Try |Unknown unit)/;

/**
 * Says which part was not understood: the longest start of the text that
 * reads, and what follows it ('Did not understand "effort" after 75-80%').
 */
function whatWasNotRead(input: string, reads: (text: string) => boolean, examples: string): string {
  const words = input.trim().split(/\s+/);
  for (let k = words.length - 1; k > 0; k--) {
    const head = words.slice(0, k).join(" ");
    if (reads(head)) return `Did not understand "${words.slice(k).join(" ")}" after ${head}. ${examples}`;
  }
  // "15a": a number with something stuck to it.
  const glued = input.trim().match(/^(\d+(?:[.,]\d+)?%?)([^\d\s].*)$/);
  if (glued && reads(glued[1]!)) return `Did not understand "${glued[2]}" after ${glued[1]}. ${examples}`;
  return `Did not understand "${input.trim()}". ${examples}`;
}

function readQuantity(input: string, unit: MeasureUnit): Parsed<Quantity> {
  const text = input.trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
  if (!text) return { ok: false, error: "Enter an amount" };

  // max · max cal · max reps · max m
  const max = text.match(/^max(?:imum)?(?: (\w+))?$/);
  if (max) {
    const word = max[1];
    const maxUnit = word ? UNIT_WORDS[word] : unit;
    return maxUnit ? { ok: true, value: { type: "max_effort", unit: maxUnit } } : { ok: false, error: `Unknown unit "${word}"` };
  }

  // 21-15-9 (three or more numbers)
  if (/^\d+(?:-\d+){2,}$/.test(text)) {
    const scheme = text.split("-").map(Number);
    return scheme.every(isWhole) ? { ok: true, value: { type: "reps_scheme", scheme } } : { ok: false, error: "Use whole reps" };
  }

  // 8/8 (per side)
  const perSide = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (perSide) {
    const [a, b] = [Number(perSide[1]), Number(perSide[2])];
    if (a !== b) return { ok: false, error: "Per side means the same number each side, e.g. 8/8" };
    return isWhole(a) ? { ok: true, value: { type: "reps_per_side", value: a } } : { ok: false, error: "Use whole reps" };
  }

  // Time: 0:30, 30 s, 2 min
  if (/^\d+:[0-5]\d$/.test(text) || /^\d+(?:[.,]\d+)?\s*(?:s|sec|secs|seconds?|min|mins|minutes?)$/.test(text)) {
    const s = seconds(text);
    return s && s >= 1 ? { ok: true, value: { type: "time_s", value: s } } : { ok: false, error: "Enter a time, e.g. 0:30" };
  }

  // A number or range, with an optional unit: 5 · 8-10 · 800 m · 1.5 km · 8-12 cal
  const amount = text.match(new RegExp(`^(${NUMBER})(?:\\s*-\\s*(${NUMBER}))?\\s*([a-z]+)?$`));
  if (!amount) return { ok: false, error: QUANTITY_EXAMPLES };
  const [, lowText, highText, word] = amount;
  const amountUnit = word ? UNIT_WORDS[word] : unit;
  if (!amountUnit) return { ok: false, error: `Unknown unit "${word}"` };
  const scale = word === "km" || word === "k" ? 1000 : 1;
  const low = num(lowText!) * scale;
  const high = highText !== undefined ? num(highText) * scale : undefined;

  switch (amountUnit) {
    case "reps":
      if (!isWhole(low) || (high !== undefined && !isWhole(high))) return { ok: false, error: "Use whole reps" };
      if (high === undefined) return { ok: true, value: { type: "reps", value: low } };
      return high > low
        ? { ok: true, value: { type: "reps_range", min: low, max: high } }
        : { ok: false, error: "The second number must be larger, e.g. 8-10" };
    case "calories":
      if (!isWhole(low) || (high !== undefined && !isWhole(high))) return { ok: false, error: "Use whole calories" };
      if (high !== undefined && high < low) return { ok: false, error: "The second number must be larger" };
      return { ok: true, value: { type: "calories", min: low, max: high ?? low } };
    case "distance_m":
      if (high !== undefined) return { ok: false, error: "Give one distance" };
      return low > 0 ? { ok: true, value: { type: "distance_m", value: low } } : { ok: false, error: "Enter a distance" };
    case "time_s":
      if (high !== undefined) return { ok: false, error: "Give one time" };
      return isWhole(low) ? { ok: true, value: { type: "time_s", value: low } } : { ok: false, error: "Use whole seconds" };
  }
}

/** Parses a load: 75% · 75-80% · 22.5 · 22.5/15 kg · bw · 2x22.5 (two implements). */
export function parseLoad(input: string): Parsed<Load | null> {
  const read = readLoad(input);
  if (read.ok || !UNREAD.test(read.error)) return read;
  return { ok: false, error: whatWasNotRead(input.replace(/^\s*@\s*/, ""), (t) => readLoad(t).ok, LOAD_EXAMPLES) };
}

function readLoad(input: string): Parsed<Load | null> {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^@\s*/, "")
    // 75% 1RM · 75-80% of 1RM · 80% of max: a load (calc spec §4.4).
    .replace(/%\s*(?:of\s*)?(?:1\s*rm|max)$/, "%");
  if (!text) return { ok: true, value: null };
  if (/^(bw|body ?weight)$/.test(text)) return { ok: true, value: { type: "bodyweight" } };

  const percent = text.match(new RegExp(`^(${NUMBER})(?:\\s*%?\\s*-\\s*(${NUMBER}))?\\s*%$`));
  if (percent) {
    const min = num(percent[1]!);
    const max = percent[2] !== undefined ? num(percent[2]) : min;
    if (!(min > 0) || max < min || max > 100) return { ok: false, error: "Use a percentage up to 100, e.g. 75-80%" };
    return { ok: true, value: { type: "percent_1rm", min, max } };
  }

  const kg = text.match(new RegExp(`^(?:([1-4])\\s*[x×]\\s*)?(${NUMBER}(?:\\s*/\\s*${NUMBER})*)\\s*(?:kg|kgs)?$`));
  if (kg) {
    const rx = kg[2]!.split("/").map((part) => num(part.trim()));
    if (!rx.every((w) => w > 0)) return { ok: false, error: "Enter a weight, e.g. 22.5/15" };
    return { ok: true, value: { type: "absolute_kg", rx }, ...(kg[1] ? { implementCount: Number(kg[1]) } : {}) };
  }
  return { ok: false, error: LOAD_EXAMPLES };
}

const UNIT_NAMES: Record<MeasureUnit, string> = { reps: "reps", distance_m: "m", calories: "cal", time_s: "time" };

/** "1:30" for 90 s; "45 s" under a minute. */
export function formatSeconds(s: number): string {
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** How a quantity reads back in the field (and in raw_line). */
export function quantityText(q: Quantity): string {
  switch (q.type) {
    case "reps": return String(q.value);
    case "reps_range": return `${q.min}-${q.max}`;
    case "reps_scheme": return q.scheme.join("-");
    case "reps_per_side": return `${q.value}/${q.value}`;
    case "distance_m": return `${q.value} m`;
    case "calories": return q.min === q.max ? `${q.min} cal` : `${q.min}-${q.max} cal`;
    case "time_s": return formatSeconds(q.value);
    case "max_effort": return q.unit === "reps" ? "max" : `max ${UNIT_NAMES[q.unit]}`;
  }
}

/** A short plain-language reading of the quantity, shown under the field. */
export function quantityMeaning(q: Quantity): string {
  switch (q.type) {
    case "reps": return `${q.value} ${q.value === 1 ? "rep" : "reps"}`;
    case "reps_range": return `${q.min}–${q.max} reps`;
    case "reps_scheme": return `${q.scheme.join("-")} (${q.scheme.reduce((a, b) => a + b, 0)} reps)`;
    case "reps_per_side": return `${q.value} each side`;
    case "distance_m": return `${q.value} m`;
    case "calories": return q.min === q.max ? `${q.min} cal` : `${q.min}–${q.max} cal`;
    case "time_s": return formatSeconds(q.value);
    case "max_effort": return q.unit === "reps" ? "max reps" : q.unit === "distance_m" ? "max distance" : q.unit === "calories" ? "max calories" : "max time";
  }
}

/** How a load reads back in the field. */
export function loadText(load: Load | null | undefined, implementCount?: number | null): string {
  if (!load) return "";
  switch (load.type) {
    case "bodyweight": return "bw";
    case "percent_1rm": return load.min === load.max ? `${load.min}%` : `${load.min}-${load.max}%`;
    // An explicit count is kept, "1x" included (one DB on a two-DB exercise).
    case "absolute_kg": return `${implementCount ? `${implementCount}x` : ""}${load.rx.join("/")} kg`;
  }
}

/** "2 × 22.5 kg" when the line uses two implements (calc spec §9.8). */
export function loadMeaning(load: Load | null | undefined, implementCount: number): string {
  if (!load) return "";
  switch (load.type) {
    case "bodyweight": return "bodyweight";
    case "percent_1rm": return load.min === load.max ? `@${load.min}%` : `@${load.min}–${load.max}%`;
    case "absolute_kg": return `${implementCount > 1 ? `${implementCount} × ` : ""}${load.rx.join("/")} kg`;
  }
}

/** The line as text, stored in block_items.raw_line: "5 Back squat @75–80%". */
export function rawLine(quantity: Quantity | null, exerciseName: string | null, load: Load | null, implementCount: number): string {
  return [quantity ? quantityText(quantity) : "", exerciseName ?? "?", load ? loadMeaning(load, implementCount) : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/ @/, " @");
}

/**
 * A duration field: "3:00", "3 min", "45 s", or a bare number in the field's
 * own unit (minutes for AMRAP, EMOM and caps; seconds for work and rest).
 */
export function parseDuration(input: string, bareUnit: "min" | "s"): number | null {
  const text = input.trim().toLowerCase().replace(",", ".");
  if (!text) return null;
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const value = Number(text);
    return Math.round(bareUnit === "min" ? value * 60 : value);
  }
  return seconds(text);
}

/** Seconds as m:ss ("3:00", "0:45"). */
export function durationText(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
