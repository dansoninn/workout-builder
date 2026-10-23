import type { BlockIntent, PartnerMode } from "@/lib/engine/types";
import { normalizeAlias } from "@/lib/normalize-alias";
import type { EffortKey } from "@/lib/taxonomy";

import { type BlockParams, type DraftBlock, type DraftItem, FORMAT_LABELS, newBlock, newItem, PARTNER_LABELS } from "./draft";
import { type EffortFound, effortFromPercent, takeEffortText } from "./effort-text";
import { durationText, loadMeaning, parseCap, parseDuration, parseLoad, parseQuantity, quantityMeaning } from "./fields";
import { type Library, type LibraryExercise, searchExercises } from "./library";
import type { BlockFormat } from "./rules";

/**
 * Reads a workout pasted as text, the way coaches write it on a whiteboard,
 * into the builder's draft (PLAN-step-4 4c). Amounts and loads go through the
 * builder's own field parsers, so what can be typed in the builder and what
 * can be pasted are the same language. Nothing is guessed: a generic word
 * ("squat") is asked once, an unknown exercise is left for the coach to pick,
 * and a line the parser cannot place is kept as a note. Efforts are only set
 * from the app's own words ("Pace Hard", "Load Moderate").
 */
export const PARSER_VERSION = 3;

// ---------------------------------------------------------------------------
// Exercise lookup: gym alias → core alias → generic word (ask) → unmatched.
// ---------------------------------------------------------------------------

/** The coach's answers: normalised words → exercise id. */
export type Answers = Record<string, string>;

/** `term` is the words' normalised form that matched (the generic word itself, "lunge" for "lunges"): the answers' key and a gym alias's text. */
export type Resolution =
  | { kind: "matched"; term: string; exercise: LibraryExercise; via: "gym" | "core" | "answer" }
  | { kind: "ambiguous"; term: string; candidates: LibraryExercise[] }
  | { kind: "unmatched"; term: string; suggestions: LibraryExercise[] };

interface LibraryIndex {
  gym: Map<string, LibraryExercise>;
  core: Map<string, LibraryExercise>;
  byId: Map<string, LibraryExercise>;
}

const indexes = new WeakMap<Library, LibraryIndex>();

function indexOf(library: Library): LibraryIndex {
  const known = indexes.get(library);
  if (known) return known;
  const index: LibraryIndex = { gym: new Map(), core: new Map(), byId: new Map() };
  const put = (map: Map<string, LibraryExercise>, text: string, exercise: LibraryExercise) => {
    if (text && !map.has(text)) map.set(text, exercise);
  };
  for (const exercise of library.exercises) {
    index.byId.set(exercise.id, exercise);
    put(exercise.orgId ? index.gym : index.core, normalizeAlias(exercise.name), exercise);
    for (const alias of exercise.aliases) put(alias.gym ? index.gym : index.core, alias.text, exercise);
  }
  indexes.set(library, index);
  return index;
}

const FILLER = new Set(["the", "a", "an", "of", "and"]);
/**
 * Words on how a movement is done, not which: "alt", "explosive box jumps", "tempo back squat", "slow and controlled".
 * "Strict" too, as the library already has it ("strict pull up" is a pull-up) — except where it is the name ("strict press").
 */
const MODIFIERS = new Set(["alt", "alternating", "explosive", "tempo", "slow", "controlled", "strict"]);

const singular = (word: string) =>
  word.length <= 2 ? word
  : /(?:ches|shes|sses|xes)$/.test(word) ? word.slice(0, -2)
  : word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1)
  : word;

/** The written words, then the same in the singular, without filler words, without "alt". */
function variants(term: string): string[] {
  const words = term.split(" ");
  const forms = [words, [...words.slice(0, -1), singular(words.at(-1)!)], words.map(singular)];
  const all = [...forms, ...forms.map((w) => w.filter((x) => !FILLER.has(x)))];
  const plain = all.map((w) => w.filter((x) => !MODIFIERS.has(x)));
  return [...new Set([...all, ...plain].map((w) => w.join(" ")).filter(Boolean))];
}

/** Words for an implement, before an exercise's name; "bw" for none. */
const IMPLEMENT_WORDS: Record<string, string | null> = {
  kb: "kettlebell", kettlebell: "kettlebell", db: "dumbbell", dumbbell: "dumbbell", bb: "barbell", barbell: "barbell",
  plate: "weight_plate", sandbag: "sandbag", band: "resistance_band", banded: "resistance_band", bw: null, bodyweight: null,
};
const FREE_WEIGHTS = new Set(["barbell", "trap_bar", "dumbbell", "kettlebell", "medicine_ball", "slam_ball", "sandbag", "weight_plate"]);
/** "G2OH w plate", "Squat with a KB": the implement written after the exercise. */
const WITH_IMPLEMENT = /^(.+?) (?:w|with) (?:an? )?(kb|db|bb|kettlebell|dumbbell|barbell|plate|sandbag|band)s?$/;

/** What a bare "row" is with a count instead of calories, meters or a time: a strength row, most likely first. */
const STRENGTH_ROWS = ["Bent-over row", "Single-arm dumbbell row", "Ring row", "Row"];

/**
 * How the line's amount reads, for words whose meaning depends on it: "row" is
 * the rowing machine only with calories, meters or a time (or as a station of
 * a timed block); with a count it is a strength row and the coach is asked
 * (BACKLOG, 2026-10-23). "machine" also where the amount does not matter.
 */
export type AmountKind = "machine" | "count";

/** The words as the library looks them up: normalised, "rubber band" as "band". An unknown exercise's term. */
export const termOf = (words: string) => normalizeAlias(words).replace(/\brubber ?bands?\b/g, "band");

export function resolveExercise(library: Library, words: string, answers: Answers = {}, amount: AmountKind = "machine"): Resolution {
  const term = termOf(words);
  const index = indexOf(library);
  const forms = variants(term);
  if (forms.includes("row")) {
    const machine = index.core.get("row");
    if (amount === "machine" && machine) return { kind: "matched", term: "row", exercise: machine, via: "core" };
    // A gym's own "row", or the coach's answer, is what "row" means with a count.
    if (amount === "count") {
      const answered = answers.row ? index.byId.get(answers.row) : undefined;
      if (answered) return { kind: "matched", term: "row", exercise: answered, via: "answer" };
      const gym = index.gym.get("row");
      if (gym) return { kind: "matched", term: "row", exercise: gym, via: "gym" };
      const candidates = STRENGTH_ROWS.flatMap((name) => library.exercises.filter((e) => !e.orgId && e.name === name));
      if (candidates.length) return { kind: "ambiguous", term: "row", candidates };
    }
  }
  for (const form of forms) {
    const answered = answers[form] ? index.byId.get(answers[form]) : undefined;
    if (answered) return { kind: "matched", term: form, exercise: answered, via: "answer" };
  }
  for (const form of forms) {
    const hit = index.gym.get(form);
    if (hit) return { kind: "matched", term: form, exercise: hit, via: "gym" };
  }
  for (const form of forms) {
    const hit = index.core.get(form);
    if (hit) return { kind: "matched", term: form, exercise: hit, via: "core" };
  }
  // "KB farmers carry", "Barbell good morning": the implement, then an exercise done with it — or one done
  // without free weights, the implement then its load ("KB split squat", "DB box step-ups", "BW lateral lunges").
  const withImplement = term.match(WITH_IMPLEMENT);
  const [first, ...rest] = (withImplement ? `${withImplement[2]} ${withImplement[1]}` : term).split(" ").filter((w) => !MODIFIERS.has(w));
  const implement = IMPLEMENT_WORDS[first!];
  if (implement !== undefined && rest.length) {
    const inner = resolveExercise(library, rest.join(" "), answers, amount);
    const e = inner.kind === "matched" && inner.via !== "answer" ? inner.exercise : null;
    if (e && e.kind === "movement" && ((implement && e.equipment.includes(implement)) || !e.equipment.some((x) => FREE_WEIGHTS.has(x)))) return inner;
  }
  for (const form of forms) {
    const ids = library.ambiguous[form];
    if (ids?.length) return { kind: "ambiguous", term: form, candidates: ids.flatMap((id) => index.byId.get(id) ?? []) };
  }
  return { kind: "unmatched", term, suggestions: searchExercises(library, words, 5).results.map((r) => r.exercise) };
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** One line as typed, tidied: one kind of dash and "x", no bullets, single spaces. */
function tidy(line: string): string {
  return line
    .replace(/ /g, " ")
    .replace(/[×✕✖]/g, "x")
    .replace(/[–—−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:[-•*·▪>]+\s*|\d+\)\s+)/, "")
    // A line ending in "+" is done back to back with the next one: the same block either way.
    .replace(/\s*\+$/, "")
    // "21 - 15 - 9": a rep scheme written with spaces.
    .replace(/\b\d+(?:\s+-\s+\d+){2,}\b/g, (scheme) => scheme.replace(/\s+/g, ""))
    .trim();
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };

/** "Five rounds", "three sets": the number in digits. */
function digitsForWords(text: string): string {
  return text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b(?=\s+(?:rounds?|sets?|times)\b)/gi, (w) => String(WORD_NUMBERS[w.toLowerCase()]));
}

/** "8" in minutes, "1:30", "90 s", "2 min" → seconds. */
function seconds(text: string, bare: "min" | "s"): number | null {
  return parseDuration(text.replace(/'$/, " min").replace(/"$/, " s").replace(/\bm$/, "min"), bare);
}

/** "20" or "20-25" minutes as seconds: a range counts at its middle, and the coach is told. */
function minutesBetween(low: string, high: string | undefined, problems: string[]): number | null {
  const a = seconds(low, "min");
  const b = high === undefined ? null : seconds(high, "min");
  if (a === null || b === null || b <= a) return a;
  const middle = Math.round((a + b) / 2);
  problems.push(`${low}–${high} min: counted as ${durationText(middle)}`);
  return middle;
}

/** An effort read from the text and what it set, for the check screen ("heavy" → Load Hard). */
export interface EffortSet {
  source: string;
  axis: "pace" | "load";
  level: EffortKey;
  /** Load has no Max: said when a Max became Load Hard. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Lines with an exercise: amount, exercise, load, notes
// ---------------------------------------------------------------------------

const UNIT = String.raw`(?:km|k|m|meters?|metres?|cal(?:orie)?s?|reps?|s|secs?|seconds?|min(?:ute)?s?)\b`;
const QUANTITY = new RegExp(
  String.raw`(?:max(?:imum)?(?:\s+(?:cal(?:orie)?s?|reps?|m|meters?|metres?|distance)\b)?` +
    String.raw`|\d+(?:-\d+){2,}` +
    String.raw`|\d+\s*-\s*\d+\s*\/\s*\d+\s*-\s*\d+` +
    String.raw`|\d+\s*\/\s*\d+(?:\s*(?:cal(?:orie)?s?|m)\b)?` +
    String.raw`|\d*:\d\d` +
    String.raw`|\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?(?:\s*${UNIT})?)`,
  "i",
);
const QUANTITY_START = new RegExp(String.raw`^(${QUANTITY.source})(?=\s|$|[,.:])`, "i");
const QUANTITY_END = new RegExp(String.raw`\s(${QUANTITY.source})$`, "i");
const LOAD_END = /(?:^|\s)((?:[1-4]\s*x\s*)?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*\s*kgs?|\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*%|bw|body ?weight)$/i;
const PER_SIDE = /\s*(?:\b(?:each|per)\s+(?:side|arm|leg)\b|\/\s*(?:side|arm|leg)\b|\be\/s\b|\b[lr]\s*\/\s*[rl]\b)/i;

interface ItemParts {
  /** Something written that the app does not read yet (pounds). */
  problems: string[];
  /** "Dbl. KB" = 2, "Single DB" = 1 (calc spec §9.8); null when the line does not say. */
  implementCount: number | null;
  /** "(Right Arm)", "(L Arm)": one side; "other": the side the line before did not do. */
  side: "left" | "right" | "other" | null;
  /** "(max 40 sec)", "(max 10 reps)": a cap on the line, as written. */
  cap: string | null;
  sets: number | null;
  quantity: string | null;
  words: string;
  load: string | null;
  notes: string[];
  efforts: EffortFound[];
}

/** "machine" when the amount is calories, meters or a time, or the line is a station of a timed block; otherwise a count. */
function amountKind(parts: ItemParts, station: boolean): AmountKind {
  // No amount, or "max" alone, as a station of a timed block: as much as fits in the window.
  if (!parts.quantity || /^max(?:imum)?$/i.test(parts.quantity.trim())) return station && parts.sets === null ? "machine" : "count";
  const read = parseQuantity(parts.quantity, "reps");
  if (!read.ok) return "count";
  const q = read.value;
  return q.type === "reps" || q.type === "reps_range" || q.type === "reps_per_side" || q.type === "reps_per_side_range" || q.type === "reps_scheme"
    || (q.type === "max_effort" && q.unit === "reps")
    ? "count"
    : "machine";
}

const looksLikeLoad = (text: string) => parseLoad(text).ok && /\d|bw|body/i.test(text);

function splitItem(original: string): ItemParts {
  // 75% 1RM · 75-80% of 1RM · 80% of max: a load (calc spec §4.4), before "max" can read as an effort.
  const efforts = takeEffortText(original.replace(/(\d)\s*%\s*(?:of\s*)?(?:1\s*rm|max)\b/gi, "$1%"));
  let s = efforts.text;
  const notes: string[] = [];
  const problems: string[] = [];
  let load: string | null = null;
  let side: ItemParts["side"] = null;
  let cap: string | null = null;
  let sidesBoth = false;
  if (/\d\s*(?:lbs?|pounds?|#)(?![a-z])/i.test(s)) problems.push("Pounds are not read yet: write the load in kg");

  // (9/6 kg) is a load; (max 40 sec) a cap; (Right Arm) one side; (L/R) both sides; anything else in brackets is a note.
  s = s.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    const text = inner.trim();
    const sided = text.match(SIDE);
    if (!load && looksLikeLoad(text)) load = text.replace(/^@\s*/, "");
    else if (!cap && /^max(?:imum)?\s*\d/i.test(text) && parseCap(text).ok) cap = text.replace(/^max(?:imum)?\s*/i, "");
    else if (/^[lr]\s*\/\s*[rl]$/i.test(text)) sidesBoth = true;
    else if (!side && sided) {
      side = sideOf(sided[1]!);
      const rest = text.slice(sided[0].length).replace(/^[\s,;:-]+/, "").trim();
      if (rest) notes.push(rest);
    } else if (text) notes.push(text);
    return " ";
  });
  // @75-80% · @ 60 kg: the load runs to the end of the line.
  const at = s.match(/@\s*(.+)$/);
  if (at) {
    if (!load) load = at[1]!.trim();
    s = s.slice(0, at.index);
  }
  s = s.replace(/\s+/g, " ").trim();
  // 2 x 22.5 kg DB lunges: a load in kilos at the start.
  const leadingLoad = !load ? s.match(/^((?:[1-4]\s*x\s*)?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*\s*kgs?)(?=\s|$)/i) : null;
  if (leadingLoad) {
    load = leadingLoad[1]!.trim();
    s = s.slice(leadingLoad[0].length).trim();
  }
  const trailingLoad = !load ? s.match(LOAD_END) : null;
  if (trailingLoad) {
    load = trailingLoad[1]!.trim();
    s = s.slice(0, trailingLoad.index).trim();
  }

  const perSide = sidesBoth || PER_SIDE.test(s);
  s = s.replace(PER_SIDE, " ").replace(/\s+/g, " ").trim();

  // 5 x 5 back squat · back squat 5x5 · 3 x 8-10 DB bench
  let sets: number | null = null;
  let quantity: string | null = null;
  const setsFirst = s.match(new RegExp(String.raw`^(\d+)\s*x\s*(${QUANTITY.source})(?=\s|$)`, "i"));
  const setsLast = s.match(new RegExp(String.raw`\s(\d+)\s*x\s*(${QUANTITY.source})$`, "i"));
  if (setsFirst) {
    sets = Number(setsFirst[1]);
    quantity = setsFirst[2]!;
    s = s.slice(setsFirst[0].length);
  } else if (setsLast) {
    sets = Number(setsLast[1]);
    quantity = setsLast[2]!;
    s = s.slice(0, setsLast.index);
  } else {
    const first = s.match(QUANTITY_START);
    const last = !first ? s.match(QUANTITY_END) : null;
    if (first) {
      quantity = first[1]!;
      s = s.slice(first[0].length);
    } else if (last) {
      quantity = last[1]!;
      s = s.slice(0, last.index);
    }
  }
  if (quantity) quantity = quantity.replace(/\s+/g, " ").trim().replace(/^:(\d\d)$/, "0:$1");
  // "Side Plank L", "Copenhagen plank right": one side, written last.
  const sideLast = !side && !sidesBoth ? s.match(/^(.*[a-z].*?)\s+(l|r|left|right)\.?$/i) : null;
  if (sideLast) {
    side = sideOf(sideLast[2]!);
    s = sideLast[1]!;
  }
  if (perSide && quantity && /^\d+$/.test(quantity)) quantity = `${quantity}/${quantity}`;

  let words = s
    .replace(/^[\s,.:;-]*(?:x\s+|of\s+)?(?:reps?\b\s*(?:of\s+)?)?/i, "")
    .replace(/[\s,.:;-]+$/, "")
    .trim();

  // Heavy, medium, light in the line: the line's effort, Load on a weighted lift (calc spec §4.4).
  // "Heavy ball" and "light ball" are implements (a heavy medicine ball), part of the exercise.
  const found = [...efforts.found];
  words = words.replace(/\b(?:(heavy|medium|light)(?:[- ]?ish)?(?:\s+to\s+(heavy|medium|light)(?:[- ]?ish)?)?)\b(?!\s*(?:ball|med(?:icine)?\s*ball))/gi, (source, a: string, b?: string) => {
    const level = (w: string) => ({ heavy: "hard", medium: "moderate", light: "easy" })[w.toLowerCase()] as EffortKey;
    const rank: EffortKey[] = ["easy", "moderate", "hard"];
    const levels = [level(a), ...(b ? [level(b)] : [])];
    found.push({ source: source.trim(), level: levels.sort((x, y) => rank.indexOf(y) - rank.indexOf(x))[0]!, axis: "loaded" });
    return " ";
  });
  // Dbl. KB, Double DB: two implements; Single DB: one. Not "single-arm" or "single-leg", which are exercises.
  let implementCount: number | null = null;
  words = words
    .replace(/\b(?:dbl\.?|double|pair of)\s*(?=(?:kb|db|kettlebells?|dumbbells?|bells?|plates?)\b)/gi, () => {
      implementCount = 2;
      return "";
    })
    .replace(/\bsingle\s+(?=(?:kb|db|kettlebell|dumbbell|plate)\b)/gi, () => {
      implementCount = 1;
      return "";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { problems, implementCount, side, cap, sets, quantity, words, load, notes, efforts: found };
}

/** One side, in brackets: "Right Arm", "R Arm - in place", "Left Leg", "Other Arm", "Left or Right Arm". */
const SIDE = /^(right|left|r|l|other|left or right|right or left|one)\s*(?:arm|leg|side|hand)?\b|^(right|left)$/i;

function sideOf(word: string): ItemParts["side"] {
  const w = word.toLowerCase();
  return w === "right" || w === "r" ? "right" : w === "other" ? "other" : "left";
}

/** Implement words alone ("KB", "Dbl. DB", "dumbbells"): an option that only changes the implement. */
const IMPLEMENT_ONLY = /^(?:kb|db|bb|kettlebells?|dumbbells?|barbells?|plates?|sandbags?|med(?:icine)? balls?|wall balls?|bands?)$/i;

/**
 * Alternatives on a line ("Burpees/Sprawls", "V-ups or tuck ups", "KB or DB
 * row", "50 x DU/100 x SU"): the first is counted, the others are kept with
 * the line (BACKLOG, 2026-10-23). A slash inside a name ("Over/Under") is not
 * an alternative: the first option must be an exercise, or an implement.
 */
function splitAlternatives(words: string, isExercise: (words: string) => boolean): { first: string; others: string[] } | null {
  const options = words.split(/\s+or\s+|\s*\/\s*(?=[a-z\d])(?<=[a-z.]\s*\/\s*)/i).map((o) => o.trim()).filter(Boolean);
  if (options.length < 2) return null;
  const [first, ...others] = options;
  // "KB or DB Row": the exercise is named once, at the end.
  if (IMPLEMENT_ONLY.test(first!)) {
    const last = others.at(-1)!;
    const name = last.replace(/^(?:kb|db|bb|kettlebells?|dumbbells?|barbells?|plates?|sandbags?)\s+/i, "");
    if (name === last || !name) return null;
    return { first: `${first} ${name}`, others: [...others.slice(0, -1), last.slice(0, last.length - name.length).trim()] };
  }
  if (isExercise(first!)) return { first: first!, others };
  // "Power or Squat Clean", "Push or Split Jerk": the options share their last words, written once at the end.
  const lastWords = others.at(-1)!.split(/\s+/);
  for (let k = 1; k < lastWords.length; k++) {
    const tail = lastWords.slice(k).join(" ");
    if (isExercise(`${first} ${tail}`)) {
      return { first: `${first} ${tail}`, others: others.map((o, i) => (i < others.length - 1 && !o.includes(" ") ? `${o} ${tail}` : o)) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Block headings: formats
// ---------------------------------------------------------------------------

interface FormatRead {
  format: BlockFormat;
  params: BlockParams;
  /** 21-15-9: the reps of every line that has none. */
  scheme: string | null;
  /** "3 rounds" without "for time": taken as sets, and said so. */
  roundsOnly: boolean;
  /** Work and rest without rounds: the rounds may follow the stations ("X 2"). */
  roundsPending?: boolean;
  /** "Alt. 30 sec on - 20 sec off x 25": 25 intervals in all, the stations taking turns. */
  totalIntervals?: number;
  /** "x 3 rounds": the count is rounds, said so. */
  roundsSaid?: boolean;
  /** "In 12-15 min find a heavy 3", "12-14 min technique work": sets within a time box. */
  timeBox?: boolean;
  alternating: boolean;
  /** What is left after the format: inline lines, or an exercise ("Tabata air squats"). */
  rest: string;
  problems: string[];
}

const TIME = String.raw`(\d+(?::\d\d)?)`;
const MIN = String.raw`(?:\s*(?:min(?:ute)?s?\.?|'))?`;

/** A format at the start of the text ("AMRAP 8", "E3M x 5", "For time", "4 rounds 90/30"), or null. */
function readFormat(input: string): FormatRead | null {
  // Matched in lower case; what is left keeps the coach's own spelling (it becomes raw lines).
  const prepared = digitsForWords(input);
  let s = prepared.toLowerCase();
  let original = s.length === prepared.length ? prepared : s;
  const problems: string[] = [];
  // "Alt. EMOM x 20", "Alternating E2M": alternating minutes, said before the format.
  const altFirst = s.match(/^alt(?:ernating)?\.?\s+(?=e\d|emom|every\b|\d)/);
  if (altFirst) {
    s = s.slice(altFirst[0].length);
    original = original.slice(altFirst[0].length);
  }
  /** "x 4-5 sets": the lower number, and the coach is told. */
  const count = (low: string, high: string | undefined, what: string) => {
    if (high !== undefined && Number(high) > Number(low)) problems.push(`${low}–${high} ${what}: counted as ${low}`);
    return Number(low);
  };
  let read: Omit<FormatRead, "rest" | "problems" | "alternating"> | null = null;
  const take = (re: RegExp) => {
    const m = s.match(re);
    if (m) {
      const [start, end] = [m.index!, m.index! + m[0].length];
      s = s.slice(0, start) + " " + s.slice(end);
      original = original.slice(0, start) + " " + original.slice(end);
    }
    return m;
  };
  const make = (format: BlockFormat, params: BlockParams, extra: Partial<typeof read> = {}) => {
    read = { format, params, scheme: null, roundsOnly: false, ...extra };
  };

  let m: RegExpMatchArray | null;
  if (
    (m = take(new RegExp(`^amrap\\s*(?:in\\s*|of\\s*|for\\s*)?${TIME}(?:\\s*-\\s*${TIME})?${MIN}`))) ||
    (m = take(new RegExp(`^${TIME}(?:\\s*-\\s*${TIME})?${MIN}\\s*amrap\\b`)))
  ) {
    make("amrap", { time_s: minutesBetween(m[1]!, m[2], problems) ?? undefined });
  } else if ((m = take(/^amrap\b/))) {
    make("amrap", { time_s: undefined });
    problems.push("Add the AMRAP's time, e.g. AMRAP 12");
  } else if ((m = take(new RegExp(`^emom\\s*(?:x\\s*|for\\s*)?(\\d+)${MIN}(?:\\s*(?:sets?|rounds?|intervals?)\\b)?`))) || (m = take(new RegExp(`^(\\d+)${MIN}\\s*(?:alt(?:ernating)?\\.?\\s*)?emom\\b`)))) {
    make("every", { interval_s: 60, rounds: Number(m[1]) });
  } else if ((m = take(/^e(\d+(?:[.,]\d+)?(?::\d\d)?)\s*(m|s)(?:om)?\s*(?:x|for)\s*(\d+)(?:\s*-\s*(\d+))?(\s*(?:min(?:ute)?s?|'))?(?:\s*(?:sets?|rounds?|intervals?)\b)?/))) {
    const interval = seconds(m[1]!, m[2] === "s" ? "s" : "min");
    const times = count(m[3]!, m[4], "sets");
    make("every", { interval_s: interval ?? undefined, rounds: m[5] && interval ? Math.round((times * 60) / interval) : times });
  } else if ((m = take(/^every\s*(\d+(?::\d\d)?)\s*(min(?:ute)?s?|m|s|sec(?:ond)?s?|')?\s*(?:x|for)\s*(\d+)\s*(rounds?|sets?|min(?:ute)?s?|')?/))) {
    const interval = seconds(`${m[1]}${m[2] ? ` ${m[2]}` : ""}`, "min");
    const count = Number(m[3]);
    const totalMinutes = m[4] !== undefined && /^(?:min|')/.test(m[4]);
    make("every", { interval_s: interval ?? undefined, rounds: totalMinutes && interval ? Math.round((count * 60) / interval) : count });
  } else if (
    // "In 12-15 min find heaviest 3-4 rep", "12-14 min technique work", "Last 5-10 min": sets within a time box.
    (m = take(new RegExp(`^(?:in\\s+|last\\s+)?${TIME}(?:\\s*-\\s*${TIME})?\\s*(?:min(?:ute)?s?\\.?|')(?=[\\s:!.-]|$)(?!\\s*(?:amrap|emom|alt|cap|time\\s*cap|rest|on\\b|of\\b|x\\b|every|for\\s*time))`)))
  ) {
    make("sets", { time_s: minutesBetween(m[1]!, m[2], problems) ?? undefined }, { timeBox: true });
  } else if ((m = take(/^tabata\b(?:\s*x\s*(\d+))?/))) {
    make("tabata", { rounds: 8 * Number(m[1] ?? 1), work_s: 20, rest_s: 10 });
  } else if ((m = take(/^(\d+(?:-\d+){2,})\b/))) {
    make("for_time", { rounds: 1 }, { scheme: m[1]! });
  } else if (
    (m = take(/^(\d+)\s*(?:rounds?|rds?|x|sets?)\s*(?:of\s*)?[,:]?\s*(\d+)\s*(s|secs?)?\s*(?:on|work)?\s*\/\s*(\d+)\s*(s|secs?)?\s*(?:off|rest)?(?=[\s,:;.]|$)(?!\s*reps?\b)/))
  ) {
    make("intervals", { rounds: Number(m[1]), work_s: Number(m[2]), rest_s: Number(m[4]), stations: 1 }, { scheme: m[3] || m[5] ? "units" : null });
  } else if ((m = take(/^(\d+)\s*(?:s|secs?)?\s*(?:on|work)?\s*\/\s*(\d+)\s*(?:s|secs?)?\s*(?:off|rest)?\s*x\s*(\d+)\b/))) {
    make("intervals", { rounds: Number(m[3]), work_s: Number(m[1]), rest_s: Number(m[2]), stations: 1 }, { scheme: "units" });
  } else if (
    // "25 sec on - 15 sec off", "30sec ON, 12sec OFF x 6", "6x 30 sec on, 12 sec off", "4 rounds, 40 sec on 20 sec off", "90 sec on - 30 sec off x 3 rounds".
    (m = take(/^(?:(\d+)\s*(?:x|rounds?|rds?|sets?)\s*(?:of\s*)?[,:]?\s*)?(\d+)\s*(?:s|secs?|seconds?)\s*(?:on|work)\b[\s,/-]*(\d+)\s*(?:s|secs?|seconds?)\s*(?:off|rest)\b(?:\s*x\s*(\d+)(\s*(?:rounds?|sets?)\b)?)?/))
  ) {
    const rounds = m[1] ?? m[4];
    make("intervals", { rounds: rounds ? Number(rounds) : 1, work_s: Number(m[2]), rest_s: Number(m[3]), stations: 1 }, { scheme: "units", roundsPending: !rounds, roundsSaid: !!m[5] });
  } else if ((m = take(/^(\d+)\s*(?:rounds?|rds?)\s*(?:of\s*)?,?\s*(?:for\s*time|ft)\b/)) || (m = take(/^(\d+)\s*rft\b/))) {
    make("for_time", { rounds: Number(m[1]) });
  } else if ((m = take(/^(?:for\s*time|chipper|ft)\b/))) {
    make("for_time", { rounds: 1 });
  } else if ((m = take(/^(\d+)(?:\s*-\s*(\d+))?\s*(?:x\s*)?sets?\b(?:\s*of\b)?/))) {
    make("sets", { sets: count(m[1]!, m[2], "sets") });
  } else if ((m = take(/^(\d+)(?:\s*-\s*(\d+))?\s*(?:x\s*)?(?:rounds?|rds?)\s*(?:each\s+)?of\b/))) {
    // "3 rounds of:" lists a circuit: plainly sets.
    make("sets", { sets: count(m[1]!, m[2], "rounds") });
  } else if ((m = take(/^(\d+)(?:\s*-\s*(\d+))?\s*(?:rounds?|rds?)\b/))) {
    make("sets", { sets: count(m[1]!, m[2], "rounds") }, { roundsOnly: true });
  }
  if (!read) return null;
  const result = read as Omit<FormatRead, "rest" | "problems" | "alternating">;

  // Words after the format that belong to it.
  if (result.roundsOnly && take(/[,:]?\s*\b(?:for\s*time|ft)\b/)) {
    result.format = "for_time";
    result.params = { rounds: result.params.sets };
    result.roundsOnly = false;
  }
  if (result.format === "for_time" && !result.scheme && take(/^[\s,:]*(?:for\s*time|ft)\b/)) {
    // "21-15-9 for time" and "For time" said twice: nothing more to read.
  }
  if (result.scheme && result.format === "for_time") take(/[\s,:]*\b(?:for\s*time|ft)\b/);
  const cap = take(new RegExp(`(?:time\\s*cap|\\bcap|\\btc)\\s*:?\\s*${TIME}${MIN}|${TIME}${MIN}\\s*(?:time\\s*)?cap\\b`));
  if (cap) {
    const capSec = seconds(cap[1] ?? cap[2]!, "min");
    if (result.format === "for_time" && capSec) result.params.time_cap_s = capSec;
    else problems.push("A time cap belongs to a For time block");
  }
  const between = take(/(?:rest\s*)?(\d+(?::\d\d)?)\s*(s|secs?|seconds?|min(?:ute)?s?|')?\s*(?:rest\s*)?between\s*rounds/);
  if (between) {
    const restSec = seconds(`${between[1]}${between[2] ? ` ${between[2]}` : ""}`, "s");
    if (result.format === "intervals" && restSec !== null) result.params.rest_between_rounds_s = restSec;
    else problems.push("Rest between rounds belongs to an intervals block");
  }
  const restSets = result.format === "sets" ? take(/(?:rest\s*)?(\d+(?::\d\d)?)\s*(s|secs?|seconds?|min(?:ute)?s?|')?\s*(?:rest\s*)?between\s*sets|\brest\s*(\d+(?::\d\d)?)\s*(s|secs?|seconds?|min(?:ute)?s?|')?/) : null;
  if (restSets) {
    const text = restSets[1] ? `${restSets[1]}${restSets[2] ? ` ${restSets[2]}` : ""}` : `${restSets[3]}${restSets[4] ? ` ${restSets[4]}` : ""}`;
    const restSec = seconds(text, "s");
    if (restSec !== null) result.params.rest_s = restSec;
  }
  // "EMOM 4 on each station", "Every 90s x 4 (each box)": all intervals of one station, then the next.
  if (result.format === "every" && take(/[\s(]*(?:on\s+)?each\s+(?:station|box)\b\)?/)) {
    result.format = "intervals";
    result.params = { rounds: result.params.rounds, work_s: result.params.interval_s, rest_s: 0, stations: 1, by_station: true };
  }
  const betweenStations = take(/(?:with\s+)?(?:rest\s*)?(\d+(?::\d\d)?)\s*(s|secs?|seconds?|min(?:ute)?s?\.?|')?\s*(?:rest\s*)?between\s*(?:stations|boxes)/);
  if (betweenStations) {
    const restSec = seconds(`${betweenStations[1]}${betweenStations[2] ? ` ${betweenStations[2].replace(".", "")}` : ""}`, "s");
    if (result.format === "intervals" && restSec !== null) {
      result.params.by_station = true;
      result.params.rest_between_stations_s = restSec;
    } else problems.push("Rest between stations belongs to an intervals block");
  }
  const stations = take(/(?:x\s*)?(\d+)\s*stations?\b/);
  const alternating = !!altFirst || !!take(/\b(?:alternating|alt)\b\.?/);
  // Brackets that describe the block: "(4 Rounds)", "(3 of Each)", "(Total time 18 min)", "(5 Rounds - Total 21 min)".
  const bracketRounds = take(/\(\s*(\d+)\s*(?:rounds?|sets?)\b[^)]*\)/);
  take(/\(\s*(?:\d+\s*of\s*each|total\s*time[^)]*)\s*\)/);
  if (alternating && result.format === "intervals") {
    // Work and rest taking turns ("Alt. 30 sec on - 20 sec off x 25 (5 rounds)"): the count is of intervals in all,
    // unless it says rounds ("x 3 rounds").
    if (!result.roundsSaid) result.totalIntervals = Number(result.params.rounds);
    if (bracketRounds) result.params.rounds = Number(bracketRounds[1]);
  } else if (alternating && result.format !== "every") {
    problems.push("Alternating minutes belong to an EMOM");
  }

  // Intervals without units ("4 x 8/8 ...") followed by an exercise are sets of a per-side amount, not 8 s on, 8 s off.
  const rest = original.replace(/^[\s,.;-]+/, "").replace(/[\s,.;-]+$/, "").trim();
  if (result.format === "intervals" && result.scheme !== "units" && /[a-z]/i.test(rest.split(":")[0] ?? "")) return null;
  if (result.format === "intervals") {
    result.scheme = null;
    if (stations) result.params.stations = Number(stations[1]);
  }
  return { ...result, alternating, rest, problems };
}

// ---------------------------------------------------------------------------
// Headings: block letters and section words
// ---------------------------------------------------------------------------

const SECTION_WORDS: [RegExp, BlockIntent | null][] = [
  [/^(?:strength|weightlifting|olympic lifting|power|accessory|accessories)\b/i, "strength"],
  [/^(?:skill|gymnastics|technique(?:\s+work)?)\b/i, "skill"],
  [/^(?:mobility|warm[- ]?up|cool[- ]?down|stretch(?:ing)?(?:\s+(?:and|&)\s+relax(?:ation)?)?|relax(?:ation)?)\b/i, "mobility"],
  [/^(?:metcon|wod|conditioning|finisher|engine)\b/i, "conditioning"],
];

interface Heading {
  /** "A" in "A.", "Part A", "A1."; null without one. */
  letter: string | null;
  /** A1, A2 …: a line of block A (supersets), not a new block. */
  itemOfBlock: boolean;
  /** The 1 in "B1.": in alternating minutes, the slot. */
  item: number | null;
  intent: BlockIntent | null;
  section: string | null;
  rest: string;
}

function readHeading(text: string): Heading {
  let rest = text;
  let letter: string | null = null;
  let itemOfBlock = false;
  let item: number | null = null;
  const part = rest.match(/^(?:part|block)\s+([a-z])\b[\s.:)-]*/i);
  // "A.", "B1)", "C:" — not "E2.5M", which is a format (every 2.5 minutes).
  const label = rest.match(/^([A-H])(\d)?\s*[.):](?:\s+|$|(?=[^\d\s]))/);
  if (part) {
    letter = part[1]!.toUpperCase();
    rest = rest.slice(part[0].length);
  } else if (label) {
    letter = label[1]!;
    itemOfBlock = label[2] !== undefined;
    item = label[2] !== undefined ? Number(label[2]) : null;
    rest = rest.slice(label[0].length);
  }
  let intent: BlockIntent | null = null;
  let section: string | null = null;
  for (const [re, kind] of SECTION_WORDS) {
    const m = rest.match(re);
    if (m) {
      intent = kind;
      section = m[0];
      rest = rest.slice(m[0].length).replace(/^[\s.:)-]+/, "");
      break;
    }
  }
  // The word later in a block's name: "E. Empty Barbell Finisher", "A. Snatch Technique", "Stretch and Relax".
  // Without a letter only words that are never an exercise, so "Couch stretch" stays a line.
  const named = !intent && !/\d/.test(rest) && rest.match(letter && !itemOfBlock ? SECTION_IN_NAME : SECTION_ALONE);
  if (named) {
    intent = SECTION_INTENT[named.slice(1).find(Boolean)!.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
    section = rest.replace(/[\s:!.]+$/, "");
    rest = "";
  }
  return { letter, itemOfBlock, item, intent, section, rest: rest.trim() };
}

const SECTION_IN_NAME = /\b(finisher|technique|mobility|stretch(?:ing)?|relax|cool[- ]?down|warm[- ]?up)\b/i;
const SECTION_ALONE = /^(?:.*\b(finisher)!?|(stretch)(?:ing)?(?:\s+and\s+relax)?|(relax))\s*[:!.]?$/i;
const SECTION_INTENT: Record<string, BlockIntent> = {
  finisher: "conditioning",
  technique: "skill",
  mobility: "mobility",
  stretch: "mobility",
  stretching: "mobility",
  relax: "mobility",
  cooldown: "mobility",
  warmup: "mobility",
};


// ---------------------------------------------------------------------------
// The workout
// ---------------------------------------------------------------------------

/** ✓ understood · ? the coach decides (a choice, an unknown exercise, a missing number) · ✗ not understood, kept as a note. */
export type LineStatus = "ok" | "ask" | "note" | "blank";

export interface ParsedItem {
  /** The draft line this became. */
  itemId: string;
  /** What the coach wrote for the exercise. */
  words: string;
  resolution: Resolution | null;
  meaning: string;
}

export interface ParsedLine {
  line: number;
  text: string;
  status: LineStatus;
  /** What the app understood, in words. */
  meaning: string;
  /** Why the coach is asked, when they are. */
  problems: string[];
  /** The block this line belongs to (index), if any. */
  block: number | null;
  items: ParsedItem[];
  /** The efforts this line set, and from which words. */
  efforts: EffortSet[];
  /** A number is missing or unreadable: the workout cannot be made until the text says it. */
  blocking: boolean;
}

export interface ParseResult {
  title: string;
  blocks: DraftBlock[];
  lines: ParsedLine[];
}

interface Building {
  block: DraftBlock;
  letter: string | null;
  hasFormat: boolean;
  intentFrom: "section" | "format";
  /** 21-15-9: the reps of the lines that have none. */
  scheme: string | null;
  headingLine: ParsedLine | null;
  /** The sets came from a line ("Back squat 5 x 5"), not a heading. */
  setsFromLine: boolean;
  /** "3 rounds" without "for time": a circuit, read as sets. */
  roundsOnly: boolean;
  /** Work and rest without rounds yet: "X 2" after the stations gives them. */
  roundsPending: boolean;
  /** Alternating work and rest: the intervals in all, shared by the stations. */
  totalIntervals: number | null;
  /** "6. Rest" in a list of stations: a station of rest, with no line. */
  restStations: number;
  /** Every heading line of the block ("Metcon", then "EMOM 12"). */
  headingLines: ParsedLine[];
  /** The block's efforts, set once its lines are known ("heavy" is Load only if the block has a load). */
  efforts: { found: EffortFound; line: ParsedLine }[];
}

// ---------------------------------------------------------------------------
// Partner blocks (calc spec §4.5): how the partners share the work.
// ---------------------------------------------------------------------------

/** "I go, you go" (I go U go, IGUG), "take turns". */
const TAKE_TURNS = /\bi\s*go,?\s*(?:you|u)\s*go\b|\b(?:you|u)\s*go,?\s*i\s*go\b|\big(?:u|y)g\b|\btake turns\b/i;
/** "Split reps at will", "split the work", "split everything as needed" — not "split jerk" or "split squat". */
const SPLIT_WORK =
  /\bsplit\s+(?:(?:the\s+)?(?:reps|work|everything|it)(?:\s+(?:at will|as (?:needed|you (?:like|wish|want))|however))?|at will|as (?:needed|you (?:like|wish|want)))\b/i;
/** Partner, in pairs, teams of 2 — not "a pair of dumbbells". */
const PARTNERS = /\bpartners?\b|\bin pairs\b|\bpair up\b|\b(?:in\s+)?teams? of (?:2|two|3|three)\b/i;
/** Amounts for each athlete: "five rounds each", "each partner" — not "each side" or "(each)" on a line. */
const EACH_ATHLETE = /\b(?:rounds?|sets?)\s+each\b(?!\s*(?:side|arm|leg|hand|way|station|box))|\beach (?:partner|athlete|person)\b/i;

/**
 * A partner block's mode from the words of a heading or a line of its own:
 * taking turns → alternate (with amounts for each athlete → each), splitting
 * the work or just "partner" → split. Null when the words say nothing of it.
 */
export function readPartner(text: string): PartnerMode | null {
  const turns = TAKE_TURNS.test(text);
  const partners = PARTNERS.test(text);
  if (!turns && !partners && !SPLIT_WORK.test(text)) return null;
  if (EACH_ATHLETE.test(text) && (turns || partners)) return "each";
  return turns ? "alternate" : "split";
}

/** Two partner modes for one block: amounts for each athlete win, then taking turns. */
function strongerPartner(a: PartnerMode | null, b: PartnerMode | null): PartnerMode | null {
  const rank = (m: PartnerMode | null) => (m === "each" ? 3 : m === "alternate" ? 2 : m === "split" ? 1 : 0);
  return rank(b) > rank(a) ? b : a;
}

/** The partner words, taken out of a heading so what is left can be read. */
function withoutPartnerWords(text: string): string {
  return text
    .replace(new RegExp(TAKE_TURNS.source, "gi"), "")
    .replace(new RegExp(SPLIT_WORK.source, "gi"), "")
    .replace(/\b(?:with a )?partners?\b(?:\s*(?:up|wod|workout)\b!?)?|\bin pairs\b|\bpair up\b|\b(?:in\s+)?teams? of (?:2|two|3|three)\b!?/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s*([,;:!–—-])(?:\s*[,;!–—-])+/g, "$1")
    .replace(/^[\s,;:!.–—-]+|[\s,;!–—-]+$/g, "")
    .replace(/\s{2,}/g, " ");
}

/** "Find heaviest 3-4 rep back squat", "to find 3 rep max deadlift", "build to a heavy 5": a ramp to a heavy set. */
const FIND_HEAVY =
  /^(?:to\s+)?(?:find|build(?:\s+up)?\s+to|work\s+up\s+to|go\s+for)\s+(?:a\s+|your\s+|the\s+)?(?:heaviest|heavy|max(?:imum)?|daily\s+max)?\s*(\d+(?:\s*-\s*\d+)?)\s*(?:-?\s*rep|rm)s?\b(?:\s*max)?\s*(.*)$/i;

/** "First:", "Then straight to:", "Straight to and finish with:", "Followed by:" — a new part of the workout. */
const SEQUENCE =
  /^(?:first|then(?:\s+(?:straight\s+)?(?:to|into))?|(?:and\s+)?(?:straight\s+(?:to|into)\s*(?:and\s+)?)?finish(?:\s+(?:with|off))?|straight\s+(?:to|into)|followed\s+by|after\s+that|next)\s*[:-]\s*/i;

const NOTE_LINE = /^(?:scale[sd]?|scaling|score|rx|note|notes|coach(?:'s)? notes?|goal|stimulus|target|options?|tip)\s*[:-]/i;
/** "Use 1 x heavy KB", "Use pair of light DB's", "- Next round -": instructions, kept as notes. */
const INSTRUCTION_LINE =
  /^(?:(?:use|using|grab)\s+(?:a\s+|an\s+|one\s+|two\s+|\d\s*x\s+|pair\s+of\s+)?.*\b(?:kbs?|dbs?|kettlebells?|dumbbells?|plates?|barbells?|bands?|boxe?s?|balls?)(?:'?s)?\b.*|-*\s*next\s+round\s*-*)$/i;

export function parseWorkoutText(text: string, library: Library, answers: Answers = {}): ParseResult {
  const lines: ParsedLine[] = [];
  const blocks: Building[] = [];
  const items = new Map<string, { item: DraftItem; building: Building }>();
  let title = "";
  let current: Building | null = null;
  /** The last line read, while it still lacks its amount ("Back squat" then "5 x 5 @ 80%"). */
  let waiting: { item: DraftItem; parsed: ParsedItem } | null = null;
  let seenContent = false;
  /** In alternating minutes: the slot the lines are in ("2." starts slot 2). */
  let slot: number | null = null;
  /** The lift whose sets came from a line ("2 x 5 Rep"), so "2 x 4 Rep" after it builds on it. */
  let lastSets: { item: DraftItem; building: Building; scheme: number[] } | null = null;

  const startBlock = (letter: string | null): Building => {
    const building: Building = { block: { ...newBlock(), items: [] }, letter, hasFormat: false, intentFrom: "format", scheme: null, headingLine: null, setsFromLine: false, roundsOnly: false, roundsPending: false, totalIntervals: null, restStations: 0, headingLines: [], efforts: [] };
    blocks.push(building);
    current = building;
    waiting = null;
    slot = null;
    lastSets = null;
    return building;
  };
  /** The slot for a line of the current block, when its minutes alternate. */
  const slotHere = () => {
    const block = (current as Building | null)?.block;
    return block?.format === "every" && block.params.alternating ? slot : null;
  };
  const note = (line: ParsedLine, building: Building) => {
    building.block.notes = [building.block.notes, line.text.trim()].filter(Boolean).join("\n");
    line.status = "note";
    line.meaning = "Kept as a note";
    line.block = blocks.indexOf(building);
  };

  /** One exercise line (or one part of a line) into the current block; false when there is no exercise and no amount. */
  const addItem = (partText: string, line: ParsedLine, slot: number | null): boolean => {
    const building = current ?? startBlock(null);
    const parts = splitItem(partText);
    // "2 x 5 Rep", then "2 x 4 Rep", "3 x 3 Rep" under the same lift: sets building up, one number per set.
    const repsHere = parts.quantity?.match(/^(\d+)(?:\s*reps?)?$/i);
    const built = lastSets as { item: DraftItem; building: Building; scheme: number[] } | null;
    if (!parts.words && parts.sets !== null && repsHere && built?.building === building && building.setsFromLine) {
      built.scheme.push(...Array<number>(parts.sets).fill(Number(repsHere[1])));
      building.block.params.sets = built.scheme.length;
      built.item.quantity = built.scheme.join("-");
      line.items.push({ itemId: built.item.id, words: "", resolution: null, meaning: `+ ${parts.sets} × ${repsHere[1]}` });
      return true;
    }
    // Where lines have no amount (work windows, alternating minutes), a line without one is a station.
    const stations = building.block.format === "intervals" || building.block.format === "tabata" || (building.block.format === "every" && Boolean(building.block.params.alternating));
    if (!parts.words && waiting && (parts.quantity || parts.sets !== null)) {
      // "Row", then "500 m" on the next line: the amount decides which row.
      if (waiting.parsed.resolution?.term === "row") {
        const again = resolveExercise(library, waiting.parsed.words, answers, amountKind(parts, false));
        waiting.parsed.resolution = again;
        waiting.item.exerciseId = again.kind === "matched" ? again.exercise.id : null;
      }
      fill(building, waiting.item, parts, waiting.parsed.resolution, line);
      line.items.push(waiting.parsed);
      waiting = null;
      return true;
    }
    if (!parts.words && !parts.quantity) return false;

    // Alternatives: the first is counted, the others kept with the line.
    const alternatives = parts.words
      ? splitAlternatives(parts.words, (words) => resolveExercise(library, words, answers).kind !== "unmatched")
      : null;
    if (alternatives) parts.words = alternatives.first;
    const resolution = parts.words ? resolveExercise(library, parts.words, answers, amountKind(parts, stations)) : null;
    // Words without an amount that are no exercise ("Leave nothing behind!"): a note, not a line — except as a station.
    if (resolution?.kind === "unmatched" && !parts.quantity && parts.sets === null && !parts.load && !stations) return false;
    const item = { ...newItem(slot), rawLine: partText.trim() };
    if (resolution?.kind === "matched") item.exerciseId = resolution.exercise.id;
    if (parts.notes.length) item.notes = parts.notes.join("; ");
    // "(Building)": sets that build up to heavy, so the work is at Load Hard.
    if (parts.notes.some((n) => /^building\b/i.test(n))) item.loadEffort ??= "hard";
    if (alternatives) item.alternatives = alternatives.others.slice(0, 10);
    if (parts.cap) item.cap = parts.cap;
    if (parts.side) {
      // "(Other Arm)": the side the last one-sided line of the block did not do.
      const before = [...building.block.items].reverse().find((i) => i.side)?.side;
      item.side = parts.side === "other" ? (before === "right" ? "left" : "right") : parts.side;
    }
    fill(building, item, parts, resolution, line);
    building.block.items.push(item);
    items.set(item.id, { item, building });

    const parsed: ParsedItem = { itemId: item.id, words: parts.words, resolution, meaning: "" };
    line.items.push(parsed);
    waiting = parts.words && !parts.quantity && parts.sets === null ? { item, parsed } : null;
    return true;
  };

  const fill = (building: Building, item: DraftItem, parts: ItemParts, resolution: Resolution | null, line: ParsedLine) => {
    if (parts.problems.length) {
      line.problems.push(...parts.problems);
      line.blocking = true;
    }
    if (parts.quantity) item.quantity = parts.quantity;
    if (parts.load) item.load = parts.load;
    if (parts.implementCount !== null && !/\d\s*x\s*\d/i.test(item.load)) item.implementCount = parts.implementCount;
    const exercise = resolution?.kind === "matched" ? resolution.exercise : null;
    const efforts = [...parts.efforts];
    // A bare "%" is a load on a loaded lift; on a row, a run or bodyweight work it is effort (calc spec §4.4).
    const percent = item.load ? parseLoad(item.load) : null;
    if (percent?.ok && percent.value?.type === "percent_1rm" && exercise && !isWeightedLift(exercise)) {
      efforts.push({ source: item.load, level: effortFromPercent((percent.value.min + percent.value.max) / 2), axis: "pace" });
      item.load = "";
    }
    const loaded = item.load.trim() !== "";
    for (const effort of efforts) setEffort(item, effort, loaded, loaded || (exercise !== null && isWeightedLift(exercise)), line);
    if (parts.sets !== null) {
      const { block } = building;
      if (!building.hasFormat && !building.setsFromLine) {
        block.format = "sets";
        block.params = { sets: parts.sets };
        building.setsFromLine = true;
        const reps = item.quantity.match(/^(\d+)(?:\s*reps?)?$/i);
        lastSets = reps ? { item, building, scheme: Array<number>(parts.sets).fill(Number(reps[1])) } : null;
      } else if (block.format !== "sets") {
        line.problems.push(`"${parts.sets} x" inside ${FORMAT_LABELS[block.format]}: read as the amount only`);
      } else if (block.params.sets !== parts.sets) {
        line.problems.push(`${parts.sets} sets here, ${block.params.sets} in the block: check`);
      }
    }
    const unit = resolution?.kind === "matched" ? resolution.exercise.defaultUnit : "reps";
    if (item.quantity) {
      const q = parseQuantity(item.quantity, unit);
      if (!q.ok) {
        line.problems.push(q.error);
        line.blocking = true;
      }
    }
    if (item.load) {
      const l = parseLoad(item.load);
      if (!l.ok) {
        line.problems.push(/lb/i.test(item.load) ? "Pounds are not read yet: write the load in kg" : l.error);
        line.blocking = true;
      }
    }
  };

  text.replace(/\r\n?/g, "\n").split("\n").forEach((original, index) => {
    const line: ParsedLine = { line: index, text: original, status: "ok", meaning: "", problems: [], block: null, items: [], efforts: [], blocking: false };
    lines.push(line);
    let tidied = tidy(original);
    if (!tidied) {
      line.status = "blank";
      return;
    }
    // "???": a day not planned yet.
    if (/^\?{2,}$/.test(tidied)) {
      line.status = "note";
      line.meaning = "Not planned yet";
      return;
    }
    // Parts that follow each other without letters: "First:", "Then straight to:", "Finish with:".
    const sequence = tidied.match(SEQUENCE);
    if (sequence) {
      tidied = tidied.slice(sequence[0].length).trim();
      seenContent = true;
      const next = startBlock(null);
      line.block = blocks.indexOf(next);
      if (!tidied) {
        line.meaning = "Next part";
        return;
      }
    }
    // "1." "2)": in alternating minutes the slot, in a list its number.
    const numbered = tidied.match(/^(\d{1,2})[.)](?:\s+|$|(?=[a-z(]))/i);
    if (numbered) {
      const open = current as Building | null;
      tidied = tidied.slice(numbered[0].length).trim();
      if (open?.block.format === "every") {
        open.block.params.alternating = true;
        slot = Number(numbered[1]);
      }
      if (!tidied || /^\?+$/.test(tidied)) {
        line.meaning = open?.block.format === "every" ? `Minute ${numbered[1]} of the rotation` : tidied ? "Not planned yet" : `Part ${numbered[1]}`;
        line.block = open ? blocks.indexOf(open) : null;
        return;
      }
    }
    const heading = readHeading(tidied);
    const efforts = takeEffortText(heading.rest);
    // Partner words ("Partner Up! - I go, you go") are read on their own, so what is left can be read as a format.
    const partnerHere = readPartner(efforts.text);
    const formatText = partnerHere ? withoutPartnerWords(efforts.text) : efforts.text;
    let read = readFormat(formatText);
    // A name, then the format: "Superset 2. - 5 Rounds of:", "Single DB Pump - 3 Rounds Of:" (not "Back squat: 5 x 5").
    let named: string | null = null;
    if (!read) {
      const split =
        formatText.match(/^([^:]*?[a-z][^:]*?)(?:\s+-\s*|\s*:\s*)((?:\d|alt|every|emom|amrap|for time|tabata|e\d).*)$/i) ??
        // "Empty Barbell AMRAP 8 min", "Easy Pace AMRAP for 20 min": the name runs straight into the format.
        formatText.match(/^([a-z][^:\d]*?)\s+((?:\d+\s*min\.?\s*)?(?:amrap|emom|for time|tabata)\b.*)$/i);
      const name = split?.[1]!.replace(/[\s.:-]+$/, "");
      if (split && name && !/\d/.test(name.replace(/\b(?:superset|super set|triset|tri-set|giant set|circuit|part|complex)\s*\d+$/i, ""))
        && resolveExercise(library, name, answers).kind === "unmatched") {
        const after = readFormat(split[2]!);
        if (after) {
          read = after;
          // "Easy pace AMRAP": the words before are the block's effort, not a name.
          const effort = takeEffortText(`@ ${name}`);
          if (effort.found.length && !effort.text.replace(/@/g, "").trim()) efforts.found.push(...effort.found);
          else named = name;
        }
      }
    }
    const partnerOnly = partnerHere !== null && !/[a-z0-9]/i.test(formatText);
    const startsBlock =
      (heading.letter !== null && !heading.itemOfBlock) || heading.intent !== null || read !== null || (partnerOnly && current === null);

    // The first line, when it is not a block or an exercise, is the workout's title ("WOD 1", "Engine day").
    if (!seenContent) {
      seenContent = true;
      const sectionWithName = heading.intent !== null && heading.letter === null && !read && efforts.text !== "";
      if (!startsBlock || sectionWithName) {
        const parts = splitItem(tidied);
        const resolution = parts.words ? resolveExercise(library, parts.words, answers) : null;
        if (sectionWithName || (!parts.quantity && parts.sets === null && (resolution === null || resolution.kind === "unmatched"))) {
          title = tidied.replace(/[:\s]+$/, "");
          line.meaning = "Title";
          return;
        }
      }
    }

    const open = current as Building | null;
    if (NOTE_LINE.test(tidied) || INSTRUCTION_LINE.test(tidied)) {
      note(line, open ?? startBlock(null));
      return;
    }

    // "Time Cap 18 min" on its own line: the For time block's cap.
    const capLine = tidied.match(/^(?:time\s*cap|cap|tc)\s*:?\s*(\d+(?::\d\d)?)\s*(?:min(?:ute)?s?|')?\.?$/i);
    if (capLine && open) {
      const cap = seconds(capLine[1]!, "min");
      if (open.block.format === "sets" && !open.setsFromLine) {
        // A list, or "4 rounds (of)", and then a time cap: it is for time.
        open.block.format = "for_time";
        open.block.params = { rounds: open.hasFormat ? open.block.params.sets : 1 };
        open.hasFormat = true;
        open.roundsOnly = false;
        if (open.headingLine) open.headingLine.problems = open.headingLine.problems.filter((p) => !p.startsWith("Not for time"));
        if (open.intentFrom === "format") open.block.intent = "conditioning";
      }
      if (open.block.format === "for_time" && cap) {
        open.block.params.time_cap_s = cap;
        line.meaning = `Time cap ${durationText(cap)}`;
      } else {
        line.problems.push("A time cap belongs to a For time block");
      }
      line.block = blocks.indexOf(open);
      return;
    }
    // "X 2" after a list of stations: how many times through.
    const times = tidied.match(/^x\s*(\d+)(?:\s*(?:rounds?|sets?|times))?$/i);
    if (times && open) {
      const n = Number(times[1]);
      if (open.block.format === "sets") open.block.params.sets = n;
      else open.block.params.rounds = n;
      open.roundsPending = false;
      line.meaning = `${n} rounds`;
      line.block = blocks.indexOf(open);
      return;
    }

    // "Pace Hard", "Load Moderate" on their own line: the block's effort.
    if (open && efforts.text === "" && !heading.letter && !heading.intent && efforts.found.length > 0) {
      for (const found of efforts.found) open.efforts.push({ found, line });
      line.block = blocks.indexOf(open);
      line.meaning = `Effort for block ${letterOf(blocks.indexOf(open))}`;
      return;
    }

    // Alternating EMOM minutes: "Min 1: 10 cal row + 5 burpees", "Odd: …", "M2 - …".
    const slotLine = open?.block.format === "every" ? tidied.match(/^(?:min(?:ute)?\s*(\d+)|m(\d+)|(odd)|(even))\s*[:.)-]\s*(.*)$/i) : null;
    if (open && slotLine) {
      const slot = slotLine[3] ? 1 : slotLine[4] ? 2 : Number(slotLine[1] ?? slotLine[2]);
      open.block.params.alternating = true;
      for (const part of slotLine[5]!.split(/\s*(?:\+|,|;|\sand\s)\s*/i).filter(Boolean)) addItem(part, line, slot);
      line.block = blocks.indexOf(open);
      if (line.items.length === 0) note(line, open);
      return;
    }

    // Rest on its own line: between sets, between rounds, or after the block.
    const restLine =
      tidied.match(/^(?:with\s+)?rest\s*:?\s*(\d+(?::\d\d)?(?:\s*-\s*\d+(?::\d\d)?)?\s*(?:s|secs?|seconds?|min(?:ute)?s?\.?|')?)\s*(?:between\s*(sets|rounds|stations|boxes))?\.?$/i) ??
      tidied.match(/^(?:with\s+)?(\d+(?::\d\d)?(?:\s*-\s*\d+(?::\d\d)?)?\s*(?:s|secs?|seconds?|min(?:ute)?s?\.?|')?)\s*rest\s*(?:between\s*(sets|rounds|stations|boxes))\.?$/i);
    if (restLine && open) {
      // "Rest 90-120 sec": a range counts at its middle.
      const [lowText, highText] = restLine[1]!.replace(/\.$/, "").split(/\s*-\s*/);
      const unit = (highText ?? lowText!).match(/[a-z']+$/i)?.[0] ?? "";
      const low = seconds(lowText!.match(/[a-z']/i) ? lowText! : `${lowText}${unit ? ` ${unit}` : ""}`, "min");
      const high = highText ? seconds(highText, "min") : null;
      const secs = low !== null && high !== null && high > low ? Math.round((low + high) / 2) : low;
      let between = restLine[2]?.toLowerCase();
      if (between === "boxes") between = "stations";
      const fits =
        secs !== null &&
        (!between || (between === "sets" && open.block.format === "sets") || ((between === "rounds" || between === "stations") && open.block.format === "intervals"));
      if (!fits) {
        note(line, open);
        return;
      }
      if (between === "sets") open.block.params.rest_s = secs!;
      else if (between === "rounds") open.block.params.rest_between_rounds_s = secs!;
      else if (between === "stations") {
        open.block.params.by_station = true;
        open.block.params.rest_between_stations_s = secs!;
      } else open.block.restAfterSec = secs!;
      if (high !== null && high > low!) line.problems.push(`${restLine[1]!.trim()}: counted as ${durationText(secs!)}`);
      line.meaning = between ? `Rest ${durationText(secs!)} between ${between}` : `Rest ${durationText(secs!)} after block ${letterOf(blocks.indexOf(open))}`;
      line.block = blocks.indexOf(open);
      return;
    }
    // In a partner block, amounts written for each athlete ("5 rounds each") make it "each".
    if (open?.block.partner && EACH_ATHLETE.test(tidied)) open.block.partner = "each";
    // A line of its own about partners: "Partner Up!", "Split reps at will", "I go, you go".
    if (open && partnerHere && !startsBlock && !/\d/.test(formatText)) {
      open.block.partner = strongerPartner(open.block.partner, partnerHere);
      if (/\bteams? of (?:3|three)\b/i.test(tidied)) line.problems.push("Teams of 3: counted as partners (half each) for now");
      const meaning = `Partner: ${PARTNER_LABELS[open.block.partner!].toLowerCase()}`;
      if (/[a-z]/i.test(formatText)) note(line, open);
      line.status = "ok";
      line.meaning = /[a-z]/i.test(formatText) ? `${meaning}; the rest kept as a note` : meaning;
      line.block = blocks.indexOf(open);
      return;
    }

    if (startsBlock) {
      // "A. Bench Press" then "5 sets of 4-8 reps": the lift is named first, its sets and reps under it.
      const liftFirst =
        read !== null && waiting !== null && open !== null && !open.hasFormat && !open.setsFromLine && heading.letter === null && !heading.intent &&
        open.block.items.length === 1 && open.block.items[0] === (waiting as { item: DraftItem }).item;
      // "For time:" then "21-15-9" on the next line: the scheme of the block just started.
      const schemeOnto =
        read !== null && read.format === "for_time" && read.scheme !== null && read.scheme !== "units" && !/[a-z]/i.test(read.rest) &&
        open !== null && open.block.items.length === 0 && open.hasFormat && open.block.format === "for_time" && open.scheme === null && heading.letter === null;
      // A heading continues an empty block ("A. Strength" then "E3M x 5"), otherwise starts one.
      const reuse = liftFirst || schemeOnto || (open && open.block.items.length === 0 && !(open.hasFormat && read) && (heading.letter === null || open.letter === null || open.letter === heading.letter));
      const building = reuse ? open : startBlock(heading.letter);
      if (heading.letter) building.letter = heading.letter;
      // A section word is tidied ("STRENGTH" → "Strength"); a block's own name keeps the coach's spelling.
      if (heading.section) building.block.title ||= /\s/.test(heading.section) ? heading.section : capitalise(heading.section);
      if (named) building.block.title ||= named;
      const sectionInName = !heading.intent && named?.match(SECTION_IN_NAME);
      if (sectionInName) {
        building.block.intent = SECTION_INTENT[sectionInName[1]!.toLowerCase().replace(/[^a-z]/g, "")] ?? building.block.intent;
        building.intentFrom = "section";
      }
      if (heading.intent) {
        building.block.intent = heading.intent;
        building.intentFrom = "section";
      }
      // Stretching is in the session's length, not in planned load (BACKLOG, 2026-10-23).
      if (/\b(?:stretch|relax)/i.test(heading.section ?? "")) building.block.countsInLoad = false;
      for (const found of efforts.found) building.efforts.push({ found, line });
      building.block.partner = strongerPartner(building.block.partner, readPartner(tidied));
      if (/\bteams? of (?:3|three)\b/i.test(tidied)) line.problems.push("Teams of 3: counted as partners (half each) for now");
      if (read && schemeOnto) {
        building.scheme = read.scheme;
      } else if (read) {
        building.block.format = read.format;
        building.block.params = { ...read.params, ...(read.alternating ? { alternating: true } : {}) };
        building.hasFormat = true;
        building.scheme = read.scheme;
        building.roundsOnly = read.roundsOnly;
        building.roundsPending = read.roundsPending ?? false;
        building.totalIntervals = read.totalIntervals ?? null;
        if (read.roundsOnly) line.problems.push(`Not for time: read as ${read.params.sets} sets. Write "for time" if it is.`);
        line.problems.push(...read.problems);
        if (Object.values(read.params).some((v) => v === undefined)) line.blocking = true;
      }
      if (read || !building.headingLine) building.headingLine = line;
      building.headingLines.push(line);
      line.block = blocks.indexOf(building);

      // A time box: "find heaviest 3-4 rep back squat" is the line; other words are the block's name.
      if (read?.timeBox) {
        const words = read.rest.replace(/^[\s:!.-]+|[\s:!.]+$/g, "");
        const find = words.match(FIND_HEAVY);
        if (find) {
          if (addItem(`${find[1]} ${find[2] ?? ""}`, line, null)) {
            const item = building.block.items.at(-1)!;
            item.loadEffort ??= "hard";
            line.efforts.push({ source: find[0].split(/\s+/).slice(0, 2).join(" "), axis: "load", level: "hard" });
          }
        } else if (words) {
          const section = words.match(SECTION_IN_NAME);
          building.block.title ||= words;
          if (section && building.intentFrom === "format") {
            building.block.intent = SECTION_INTENT[section[1]!.toLowerCase().replace(/[^a-z]/g, "")] ?? building.block.intent;
            building.intentFrom = "section";
          }
          if (/\b(?:stretch|relax)/i.test(words)) building.block.countsInLoad = false;
        }
        return;
      }

      // Lines written after the heading: "AMRAP 8: 5 KB swing, 10 air squat" or "Tabata air squats".
      const rest = withoutPartnerWords(read ? read.rest : efforts.text).trim();
      const inline = rest.includes(":") ? rest.slice(rest.indexOf(":") + 1) : read || heading.letter ? rest : "";
      for (const part of inline.split(/\s*(?:,|;|\s\+\s)\s*/)) if (/[a-z0-9]/i.test(part)) addItem(part, line, slotHere());
      return;
    }

    // A1. Bench 4 x 8 · A2. Row 4 x 10: lines of block A. In alternating minutes, B1 … B5 are its slots.
    if (heading.itemOfBlock && open?.letter === null && open.block.format === "every") open.letter = heading.letter;
    if (heading.itemOfBlock && open?.letter !== heading.letter) startBlock(heading.letter);
    else if (heading.itemOfBlock && open?.block.format === "every" && heading.item !== null) {
      open.block.params.alternating = true;
      slot = heading.item;
    }
    // "6. Rest" among stations: a station of rest.
    if (open && (open.block.format === "intervals" || open.block.format === "tabata") && /^(?:rest|recover(?:y)?|active recovery)\.?$/i.test(tidied)) {
      open.restStations++;
      line.meaning = "A station of rest";
      line.block = blocks.indexOf(open);
      return;
    }
    // "6 x Hang Snatch + 3/3 x S2OH + 6 x Front Squat": lines done back to back, written on one line.
    const lineText = heading.itemOfBlock ? heading.rest : tidied;
    const together = lineText.split(/\s+\+\s+/);
    if (together.length > 1 && together.every((part) => QUANTITY_START.test(part))) {
      for (const part of together) addItem(part, line, slotHere());
      line.block = blocks.indexOf(current!);
      return;
    }
    if (!addItem(lineText, line, slotHere())) {
      note(line, (current as Building | null) ?? startBlock(null));
      return;
    }
    line.block = blocks.indexOf(current!);
  });

  // Each block, now that all its lines are known.
  blocks.forEach((building, b) => {
    const { block } = building;
    const blockLines = lines.filter((l) => l.block === b);
    if (!building.hasFormat && !building.setsFromLine) {
      block.format = "sets";
      block.params = { sets: 1 };
      const first = blockLines.find((l) => l.items.length > 0);
      first?.problems.push("No format found (e.g. 5 x 5, AMRAP 12, For time): read as done once");
    }
    // Lines without an amount: 21-15-9 gives them their reps; in timed work they go for max.
    for (const item of block.items) {
      if (item.quantity) continue;
      if (building.scheme) item.quantity = building.scheme;
      else if (block.format === "intervals" || block.format === "tabata") item.quantity = "max";
    }
    if (block.format === "intervals") {
      const stated = block.params.stations;
      block.params.stations = Math.max(1, block.items.length + building.restStations);
      if (building.totalIntervals !== null) {
        // The stations take turns over the intervals in all: rounds = intervals ÷ stations.
        const perRound = block.params.stations;
        const rounds = building.totalIntervals / perRound;
        if (building.headingLine && Number.isInteger(rounds) && block.params.rounds !== rounds && block.params.rounds !== building.totalIntervals) {
          building.headingLine.problems.push(`${building.totalIntervals} intervals with ${perRound} stations is ${rounds} rounds, not ${block.params.rounds}`);
        }
        if (block.params.rounds === building.totalIntervals) block.params.rounds = Math.max(1, Math.round(rounds));
        if (!Number.isInteger(rounds)) building.headingLine?.problems.push(`${building.totalIntervals} intervals do not share evenly between ${perRound} stations`);
      }
      if (building.headingLine && stated !== undefined && stated !== 1 && stated !== block.items.length) {
        building.headingLine.problems.push(`${stated} stations written, ${block.items.length} lines found`);
      }
    }
    if (block.format === "every" && block.params.alternating) {
      const order = [...new Set(block.items.map((i) => i.slot ?? 1))].sort((x, y) => x - y);
      for (const item of block.items) item.slot = order.indexOf(item.slot ?? 1) + 1;
    } else {
      for (const item of block.items) item.slot = null;
    }
    if (building.intentFrom === "format") block.intent = building.roundsOnly ? "conditioning" : intentFromFormat(block, library);
    // The block's efforts, now that its lines say whether it has a load.
    const index = indexOf(library);
    const loaded = block.items.some((i) => i.load.trim() !== "");
    const lift = loaded || block.items.some((i) => {
      const exercise = i.exerciseId ? index.byId.get(i.exerciseId) : undefined;
      return exercise !== undefined && isWeightedLift(exercise);
    });
    for (const { found, line } of building.efforts) {
      setEffort(block, found, loaded, lift, line);
      if (line.meaning.startsWith("Effort for block")) line.meaning = `Effort for block ${letterOf(b)}: ${effortsText(line.efforts)}`;
    }
  });

  // What each line now means, and whether it needs the coach.
  for (const line of lines) {
    if (line.status === "blank" || line.status === "note" || line.meaning) continue;
    for (const parsed of line.items) {
      const found = items.get(parsed.itemId)!;
      parsed.meaning = itemMeaning(found.item, parsed.resolution);
      if (!found.item.quantity && !line.problems.includes(NO_AMOUNT)) {
        line.problems.push(NO_AMOUNT);
        line.blocking = true;
      }
    }
    const building = line.block !== null ? blocks[line.block] : undefined;
    const parts = line.items.map((i) => i.meaning).join(" + ");
    const slot = line.items.length ? items.get(line.items[0]!.itemId)!.item.slot : null;
    line.meaning =
      building && building.headingLine === line ? [headingMeaning(building, line.block!), parts].filter(Boolean).join(": ")
      : building?.headingLines.includes(line) ? `Block ${letterOf(line.block!)}${building.block.title ? ` · ${building.block.title}` : ""}`
      : slot ? `Minute ${slot}: ${parts}`
      : parts;
    if (line.efforts.length) line.meaning = `${line.meaning} · ${effortsText(line.efforts)}`;
    const needs = line.problems.length > 0 || line.blocking || line.items.some((i) => i.resolution !== null && i.resolution.kind !== "matched");
    line.status = needs ? "ask" : "ok";
  }

  return { title, blocks: blocks.map((b) => b.block), lines };
}

const NO_AMOUNT = "Add the amount, e.g. 10 burpees";

/** A movement done with weights: a bare "%" on it is a load, and % effort or RPE on it sets Load. */
const isWeightedLift = (exercise: LibraryExercise) => exercise.kind === "movement" && exercise.equipment.some((e) => WEIGHTS.has(e));

/**
 * Sets a read effort on a line or block, on the axis it belongs to
 * (calc spec §4.4), and records it for the check screen. Load has no Max.
 */
function setEffort(
  target: { paceEffort: EffortKey | null; loadEffort: Exclude<EffortKey, "max"> | null },
  effort: EffortFound,
  loaded: boolean,
  lift: boolean,
  line: ParsedLine,
) {
  // heavy/light and % effort, RPE, @ n/10: Load on a line with a load or a lift with weights, else Pace.
  const axis = effort.axis === "pace" || effort.axis === "load" ? effort.axis : loaded || lift ? "load" : "pace";
  if (axis === "load") {
    const level = effort.level === "max" ? "hard" : effort.level;
    target.loadEffort = level;
    line.efforts.push({ source: effort.source, axis, level, ...(effort.level === "max" && { note: "Load has no Max" }) });
  } else {
    target.paceEffort = effort.level;
    line.efforts.push({ source: effort.source, axis, level: effort.level });
  }
}

/** “heavy” → Load Hard, “sprint” → Pace Max; the app's own words as they are. */
function effortsText(efforts: EffortSet[]): string {
  return efforts
    .map((e) => {
      const result = `${capitalise(e.axis)} ${capitalise(e.level)}`;
      return e.source.toLowerCase() === result.toLowerCase() ? result : `“${e.source}” → ${result}${e.note ? ` (${e.note})` : ""}`;
    })
    .join(", ");
}
const letterOf = (index: number) => String.fromCharCode(65 + index);
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

/**
 * The block's intent when no section word says it: sets are strength; an EMOM
 * of loaded or weighted movements (a load written, or a barbell, dumbbell or
 * kettlebell exercise) with nothing monostructural is strength; AMRAP, For
 * time, intervals, tabata and other EMOMs are conditioning. The check screen
 * says it was read "from the format", so the coach sees it.
 */
const WEIGHTS = new Set(["barbell", "dumbbell", "kettlebell", "sandbag", "medicine_ball", "trap_bar"]);

function intentFromFormat(block: DraftBlock, library: Library): BlockIntent {
  if (block.format === "sets") return "strength";
  if (block.format !== "every" || block.items.length === 0) return "conditioning";
  const index = indexOf(library);
  const strength = block.items.every((item) => {
    const exercise = item.exerciseId ? index.byId.get(item.exerciseId) : undefined;
    if (!exercise || exercise.kind === "monostructural") return false;
    return item.load.trim() !== "" || exercise.equipment.some((e) => WEIGHTS.has(e));
  });
  return strength ? "strength" : "conditioning";
}

function formatMeaning(block: DraftBlock): string {
  const p = block.params as Record<string, number | undefined> & { alternating?: boolean };
  const t = (s: number | undefined) => (s === undefined ? "?" : durationText(s));
  switch (block.format) {
    case "sets":
      return `${p.sets ?? "?"} ${p.sets === 1 ? "set" : "sets"}${p.rest_s ? `, rest ${t(p.rest_s)}` : ""}`;
    case "every":
      return `Every ${t(p.interval_s)} × ${p.rounds ?? "?"}${p.alternating ? ", alternating" : ""}`;
    case "amrap":
      return `AMRAP ${t(p.time_s)}`;
    case "for_time":
      return ["For time", (p.rounds ?? 1) > 1 && `${p.rounds} rounds`, p.time_cap_s && `cap ${t(p.time_cap_s)}`].filter(Boolean).join(", ");
    case "intervals":
      return `${p.rounds} rounds × ${p.stations} ${p.stations === 1 ? "station" : "stations"}, ${t(p.work_s)} work / ${t(p.rest_s)} rest${p.rest_between_rounds_s ? `, ${t(p.rest_between_rounds_s)} between rounds` : ""}`;
    case "tabata":
      return `Tabata, ${p.rounds} rounds`;
  }
}

function headingMeaning(building: Building, index: number): string {
  const { block } = building;
  const intent = `${block.intent}${building.intentFrom === "section" ? "" : " (from the format)"}`;
  const efforts = [block.paceEffort && `Pace ${capitalise(block.paceEffort)}`, block.loadEffort && `Load ${capitalise(block.loadEffort)}`];
  return [`Block ${letterOf(index)}`, formatMeaning(block), intent, ...efforts, block.partner && `partner, ${PARTNER_LABELS[block.partner].toLowerCase()}`].filter(Boolean).join(" · ");
}

function itemMeaning(item: DraftItem, resolution: Resolution | null): string {
  const exercise = resolution?.kind === "matched" ? resolution.exercise : null;
  const name = exercise?.name ?? (resolution?.kind === "ambiguous" ? `which “${resolution.term}”?` : resolution?.kind === "unmatched" ? "unknown exercise" : "no exercise");
  const q = item.quantity ? parseQuantity(item.quantity, exercise?.defaultUnit ?? "reps") : null;
  const amount = q?.ok ? quantityMeaning(q.value) : item.quantity ? `"${item.quantity}"` : "no amount";
  const l = item.load ? parseLoad(item.load) : null;
  const load = l?.ok && l.value ? ` · ${loadMeaning(l.value, l.implementCount ?? exercise?.implementCount ?? 1)}` : "";
  return `${amount} · ${name}${load}`;
}
