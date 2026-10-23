// Named benchmark workouts (BACKLOG "Program import", higher-level additions,
// 2026-10-23): a day written only as "Fran" or "Murph" is the benchmark, read
// by the same parser as everything else. Standard definitions, Rx loads in kg
// (men/women, the first counts: calc spec decision 17). For Daniel's review:
// change, add or drop any (STATUS).
//
// Gyms' own named workouts are their templates (BACKLOG follow-up).

export interface Benchmark {
  name: string;
  /** Other ways of writing the name. */
  aliases?: string[];
  /** The workout, written as a coach would paste it. */
  text: string;
}

export const BENCHMARKS: Benchmark[] = [
  { name: "Angie", text: "For time\n100 Pull-ups\n100 Push-ups\n100 Sit-ups\n100 Air squats" },
  { name: "Annie", text: "50-40-30-20-10 for time\nDouble-unders\nSit-ups" },
  { name: "Chelsea", text: "EMOM 30\n5 Pull-ups\n10 Push-ups\n15 Air squats" },
  { name: "Cindy", text: "AMRAP 20\n5 Pull-ups\n10 Push-ups\n15 Air squats" },
  { name: "Diane", text: "21-15-9 for time\nDeadlifts 102/70 kg\nHandstand push-ups" },
  { name: "Elizabeth", text: "21-15-9 for time\nSquat cleans 61/43 kg\nRing dips" },
  { name: "Fran", text: "21-15-9 for time\nThrusters 43/30 kg\nPull-ups" },
  { name: "Grace", text: "For time\n30 Clean and jerks 61/43 kg" },
  { name: "Helen", text: "3 rounds for time\n400 m Run\n21 Kettlebell swings 24/16 kg\n12 Pull-ups" },
  { name: "Jackie", text: "For time\n1000 m Row\n50 Thrusters 20/15 kg\n30 Pull-ups" },
  { name: "Karen", text: "For time\n150 Wall balls 9/6 kg" },
  { name: "Kelly", text: "5 rounds for time\n400 m Run\n30 Box jumps (24/20 in)\n30 Wall balls 9/6 kg" },
  { name: "Mary", text: "AMRAP 20\n5 Handstand push-ups\n10 Pistols (alternating legs)\n15 Pull-ups" },
  { name: "Nancy", text: "5 rounds for time\n400 m Run\n15 Overhead squats 43/30 kg" },
  { name: "Amanda", text: "9-7-5 for time\nRing muscle-ups\nSquat snatches 61/43 kg" },
  { name: "Eva", text: "5 rounds for time\n800 m Run\n30 Kettlebell swings 32/24 kg\n30 Pull-ups" },
  { name: "DT", text: "5 rounds for time\n12 Deadlifts 70/47 kg\n9 Hang power cleans 70/47 kg\n6 Push jerks 70/47 kg" },
  { name: "Murph", aliases: ["Hero Murph"], text: "For time (with a 9/6 kg vest)\n1600 m Run\n100 Pull-ups\n200 Push-ups\n300 Air squats\n1600 m Run" },
];

const key = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const BY_NAME = new Map(BENCHMARKS.flatMap((b) => [b.name, ...(b.aliases ?? [])].map((n) => [key(n), b] as const)));

/**
 * The benchmark a day is, when the day says only its name: "Fran", "Murph!",
 * "WOD: Cindy", "Benchmark - Helen (Rx)". A day that also writes the workout
 * out is read as written.
 */
export function benchmarkOf(text: string): Benchmark | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length !== 1) return null;
  const name = lines[0]!
    .replace(/^(?:wod|benchmark|hero(?:\s*wod)?|the girls?)\s*[:\-–]?\s*/i, "")
    .replace(/\s*\((?:rx|scaled)\)\s*$/i, "")
    .replace(/\s*(?:for time|rx)\s*$/i, "");
  return BY_NAME.get(key(name)) ?? null;
}
