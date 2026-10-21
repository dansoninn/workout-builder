// Generic words that could mean several core exercises (Daniel, 2026-10-21).
// They are deliberately NOT core aliases. The Step 4 parser asks the coach
// once which exercise the gym means and saves the answer as a gym alias.
// Candidates are listed most likely first.
//
// Generic words kept as plain core aliases because they are unambiguous in
// practice: "bench" → Bench press, "row" → Row (rowing machine; strength rows
// are always qualified, e.g. "DB row"), "ski" → Ski erg (the only ski
// exercise), "run" → Run.

export const AMBIGUOUS_TERMS: { term: string; candidates: string[] }[] = [
  { term: "squat", candidates: ["Back squat", "Front squat", "Air squat", "Goblet squat"] },
  { term: "db squat", candidates: ["Goblet squat", "Dumbbell front squat"] },
  { term: "lunge", candidates: ["Walking lunge", "Reverse lunge"] },
  { term: "clean", candidates: ["Squat clean", "Power clean", "Hang power clean", "Hang squat clean", "Dumbbell clean"] },
  { term: "hang clean", candidates: ["Hang squat clean", "Hang power clean"] },
  { term: "snatch", candidates: ["Squat snatch", "Power snatch", "Hang power snatch", "Dumbbell snatch", "Kettlebell snatch"] },
  { term: "jerk", candidates: ["Push jerk", "Split jerk"] },
  { term: "press", candidates: ["Strict press", "Push press", "Dumbbell shoulder press"] },
  { term: "shoulder press", candidates: ["Strict press", "Dumbbell shoulder press"] },
  { term: "dip", candidates: ["Ring dip", "Bar dip"] },
  { term: "muscle up", candidates: ["Ring muscle-up", "Bar muscle-up"] },
  { term: "bike", candidates: ["Air bike", "Bike erg"] },
  { term: "hollow", candidates: ["Hollow hold", "Hollow rock"] },
];
