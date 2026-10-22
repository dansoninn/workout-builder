import type { EffortKey } from "@/lib/taxonomy";

/**
 * Effort written in words or numbers (calc spec §4.4, approved 2026-10-22):
 * one framework of four boxes for pace and load. % effort ≈ RPE × 10; a value
 * between two boxes goes to the nearer one; a range uses its midpoint.
 */
export function effortFromPercent(percent: number): EffortKey {
  return percent < 47.5 ? "easy" : percent < 67.5 ? "moderate" : percent < 87.5 ? "hard" : "max";
}

export const effortFromRpe = (rpe: number): EffortKey => effortFromPercent(rpe * 10);

/**
 * Which axis an effort sets: "pace" and "load" are said outright ("Pace Hard",
 * "heavy load"); "loaded" (heavy, light) is Load on a line or block with a
 * load, otherwise Pace; "lift" (% effort, RPE, @ n/10) is Load on a loaded
 * lift, otherwise Pace.
 */
export type EffortAxis = "pace" | "load" | "loaded" | "lift";

export interface EffortFound {
  /** The words as written ("heavy", "75-80% effort", "RPE 8"). */
  source: string;
  level: EffortKey;
  axis: EffortAxis;
}

const WORDS: Record<string, { level: EffortKey; axis: EffortAxis }> = {
  light: { level: "easy", axis: "loaded" },
  easy: { level: "easy", axis: "pace" },
  moderate: { level: "moderate", axis: "pace" },
  medium: { level: "moderate", axis: "pace" },
  steady: { level: "moderate", axis: "pace" },
  heavy: { level: "hard", axis: "loaded" },
  hard: { level: "hard", axis: "pace" },
  fast: { level: "hard", axis: "pace" },
  max: { level: "max", axis: "pace" },
  "all out": { level: "max", axis: "pace" },
  "all-out": { level: "max", axis: "pace" },
  sprint: { level: "max", axis: "pace" },
};
const WORD = String.raw`(light|easy|moderate|medium|steady|heavy|hard|fast|max|all[ -]out|sprint)`;
/** "hard pace", "heavy load": a word that says the axis. */
const AXIS_WORD = String.raw`(?:\s+(pace|effort|intensity|load|weight))?`;
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const RANGE = String.raw`${NUMBER}(?:\s*[-–]\s*${NUMBER})?`;

const num = (text: string | undefined) => (text === undefined ? undefined : Number(text.replace(",", ".")));
const midpoint = (a: string, b: string | undefined) => (b === undefined ? num(a)! : (num(a)! + num(b)!) / 2);

/**
 * Takes the effort out of a line of text: the app's own words ("Pace Hard",
 * "Load Moderate"), "% effort", "RPE n", "@ n/10", and effort words in
 * brackets, after "@", at the end of the line, or as the whole line. A word
 * at the start is left alone: "Max cal bike" is an amount, not an effort.
 */
export function takeEffortText(input: string): { text: string; found: EffortFound[] } {
  const found: EffortFound[] = [];
  let text = input;
  const take = (re: RegExp, read: (m: RegExpExecArray) => EffortFound | null) => {
    text = text.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      const effort = read(m);
      if (!effort) return m[0];
      found.push(effort);
      return " ";
    });
  };

  // The app's own words.
  take(/\bpace\s*:?\s*(easy|moderate|hard|max)\b/gi, (m) => ({ source: m[0].trim(), level: m[1]!.toLowerCase() as EffortKey, axis: "pace" }));
  take(/\bload\s*:?\s*(easy|moderate|hard)\b/gi, (m) => ({ source: m[0].trim(), level: m[1]!.toLowerCase() as EffortKey, axis: "load" }));
  // 75-80% effort · @ 80 % intensity
  take(new RegExp(String.raw`@?\s*${RANGE}\s*%\s*(?:effort|eff\.?|intensity)\b`, "gi"), (m) => ({
    source: m[0].replace(/^@\s*/, "").trim(),
    level: effortFromPercent(midpoint(m[1]!, m[2])),
    axis: "lift",
  }));
  // RPE 8 · RPE 7-8 · @RPE 8
  take(new RegExp(String.raw`@?\s*\brpe\s*:?\s*${RANGE}`, "gi"), (m) => ({
    source: m[0].replace(/^@\s*/, "").trim(),
    level: effortFromRpe(midpoint(m[1]!, m[2])),
    axis: "lift",
  }));
  // @ 7/10
  take(new RegExp(String.raw`@\s*${NUMBER}\s*\/\s*10\b(?!\s*kg)`, "gi"), (m) =>
    num(m[1])! <= 10 ? { source: m[0].replace(/^@\s*/, "").trim(), level: effortFromRpe(num(m[1])!), axis: "lift" } : null,
  );
  // Words: in brackets, after "@", at the end, or the whole line.
  const word = (m: RegExpExecArray, w: number, a: number): EffortFound => {
    const known = WORDS[m[w]!.toLowerCase().replace(" ", " ")]!;
    const said = m[a]?.toLowerCase();
    const axis: EffortAxis = said === "load" || said === "weight" ? "load" : said ? "pace" : known.axis;
    return { source: m[0].replace(/^[\s(@,;:–-]+|[\s),.;:–-]+$/g, ""), level: known.level, axis };
  };
  take(new RegExp(String.raw`\(\s*${WORD}${AXIS_WORD}\s*\)`, "gi"), (m) => word(m, 1, 2));
  take(new RegExp(String.raw`@\s*${WORD}${AXIS_WORD}\b`, "gi"), (m) => word(m, 1, 2));
  const whole = new RegExp(String.raw`^\s*${WORD}${AXIS_WORD}\s*\.?\s*$`, "i").exec(text);
  if (whole) {
    found.push(word(whole, 1, 2));
    text = "";
  } else {
    take(new RegExp(String.raw`(?:[\s,;:–-]+)${WORD}${AXIS_WORD}\s*\.?\s*$`, "i"), (m) => word(m, 1, 2));
  }
  if (found.length === 0) return { text: input.trim(), found };
  // Only where something was taken out: "Back squat 5x5 , " → "Back squat 5x5,".
  return { text: text.replace(/\s+/g, " ").replace(/\s+([,;])/g, "$1").trim(), found };
}
