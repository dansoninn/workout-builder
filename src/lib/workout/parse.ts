import type { BlockIntent } from "@/lib/engine/types";
import { normalizeAlias } from "@/lib/normalize-alias";
import type { EffortKey } from "@/lib/taxonomy";

import { type BlockParams, type DraftBlock, type DraftItem, FORMAT_LABELS, newBlock, newItem } from "./draft";
import { type EffortFound, effortFromPercent, takeEffortText } from "./effort-text";
import { durationText, loadMeaning, parseDuration, parseLoad, parseQuantity, quantityMeaning } from "./fields";
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
export const PARSER_VERSION = 1;

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

const FILLER = new Set(["the", "a", "an", "of"]);
const MODIFIERS = new Set(["alt", "alternating"]);

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

export function resolveExercise(library: Library, words: string, answers: Answers = {}): Resolution {
  const term = normalizeAlias(words);
  const index = indexOf(library);
  const forms = variants(term);
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
    .replace(/^(?:[-•*·▪>]+\s+|\d+\)\s+)/, "")
    .trim();
}

/** "8" in minutes, "1:30", "90 s", "2 min" → seconds. */
function seconds(text: string, bare: "min" | "s"): number | null {
  return parseDuration(text.replace(/'$/, " min").replace(/"$/, " s").replace(/\bm$/, "min"), bare);
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
    String.raw`|\d+\s*\/\s*\d+(?:\s*(?:cal(?:orie)?s?|m)\b)?` +
    String.raw`|\d*:\d\d` +
    String.raw`|\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?(?:\s*${UNIT})?)`,
  "i",
);
const QUANTITY_START = new RegExp(String.raw`^(${QUANTITY.source})(?=\s|$|[,.:])`, "i");
const QUANTITY_END = new RegExp(String.raw`\s(${QUANTITY.source})$`, "i");
const LOAD_END = /(?:^|\s)((?:[1-4]\s*x\s*)?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*\s*kgs?|\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*%|bw|body ?weight)$/i;
const PER_SIDE = /\s*(?:\b(?:each|per)\s+(?:side|arm|leg)\b|\/\s*(?:side|arm|leg)\b|\be\/s\b)/i;

interface ItemParts {
  /** Something written that the app does not read yet (pounds). */
  problems: string[];
  sets: number | null;
  quantity: string | null;
  words: string;
  load: string | null;
  notes: string[];
  efforts: EffortFound[];
}

const looksLikeLoad = (text: string) => parseLoad(text).ok && /\d|bw|body/i.test(text);

function splitItem(original: string): ItemParts {
  // 75% 1RM · 75-80% of 1RM · 80% of max: a load (calc spec §4.4), before "max" can read as an effort.
  const efforts = takeEffortText(original.replace(/(\d)\s*%\s*(?:of\s*)?(?:1\s*rm|max)\b/gi, "$1%"));
  let s = efforts.text;
  const notes: string[] = [];
  const problems: string[] = [];
  let load: string | null = null;
  if (/\d\s*(?:lbs?|pounds?|#)(?![a-z])/i.test(s)) problems.push("Pounds are not read yet: write the load in kg");

  // (9/6 kg) is a load; anything else in brackets is a note.
  s = s.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    const text = inner.trim();
    if (!load && looksLikeLoad(text)) load = text.replace(/^@\s*/, "");
    else if (text) notes.push(text);
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

  const perSide = PER_SIDE.test(s);
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
  if (perSide && quantity && /^\d+$/.test(quantity)) quantity = `${quantity}/${quantity}`;

  const words = s
    .replace(/^[\s,.:;-]*(?:x\s+|of\s+)?/i, "")
    .replace(/[\s,.:;-]+$/, "")
    .trim();
  return { problems, sets, quantity, words, load, notes, efforts: efforts.found };
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
  alternating: boolean;
  /** What is left after the format: inline lines, or an exercise ("Tabata air squats"). */
  rest: string;
  problems: string[];
}

const TIME = String.raw`(\d+(?::\d\d)?)`;
const MIN = String.raw`(?:\s*(?:min(?:ute)?s?|'))?`;

/** A format at the start of the text ("AMRAP 8", "E3M x 5", "For time", "4 rounds 90/30"), or null. */
function readFormat(input: string): FormatRead | null {
  // Matched in lower case; what is left keeps the coach's own spelling (it becomes raw lines).
  let s = input.toLowerCase();
  let original = s.length === input.length ? input : s;
  const problems: string[] = [];
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
  if ((m = take(new RegExp(`^amrap\\s*(?:in\\s*|of\\s*)?${TIME}${MIN}`))) || (m = take(new RegExp(`^${TIME}${MIN}\\s*amrap\\b`)))) {
    make("amrap", { time_s: seconds(m[1]!, "min") ?? undefined });
  } else if ((m = take(/^amrap\b/))) {
    make("amrap", { time_s: undefined });
    problems.push("Add the AMRAP's time, e.g. AMRAP 12");
  } else if ((m = take(new RegExp(`^emom\\s*(?:x\\s*|for\\s*)?(\\d+)${MIN}`))) || (m = take(new RegExp(`^(\\d+)${MIN}\\s*emom\\b`)))) {
    make("every", { interval_s: 60, rounds: Number(m[1]) });
  } else if ((m = take(/^e(\d+(?::\d\d)?)\s*(m|s)(?:om)?\s*(?:x|for)\s*(\d+)(\s*(?:min(?:ute)?s?|'))?/))) {
    const interval = seconds(m[1]!, m[2] === "s" ? "s" : "min");
    const count = Number(m[3]);
    make("every", { interval_s: interval ?? undefined, rounds: m[4] && interval ? Math.round((count * 60) / interval) : count });
  } else if ((m = take(/^every\s*(\d+(?::\d\d)?)\s*(min(?:ute)?s?|m|s|sec(?:ond)?s?|')?\s*(?:x|for)\s*(\d+)\s*(rounds?|sets?|min(?:ute)?s?|')?/))) {
    const interval = seconds(`${m[1]}${m[2] ? ` ${m[2]}` : ""}`, "min");
    const count = Number(m[3]);
    const totalMinutes = m[4] !== undefined && /^(?:min|')/.test(m[4]);
    make("every", { interval_s: interval ?? undefined, rounds: totalMinutes && interval ? Math.round((count * 60) / interval) : count });
  } else if ((m = take(/^tabata\b(?:\s*x\s*(\d+))?/))) {
    make("tabata", { rounds: 8 * Number(m[1] ?? 1), work_s: 20, rest_s: 10 });
  } else if ((m = take(/^(\d+(?:-\d+){2,})\b/))) {
    make("for_time", { rounds: 1 }, { scheme: m[1]! });
  } else if (
    (m = take(/^(\d+)\s*(?:rounds?|rds?|x|sets?)\s*(?:of\s*)?[,:]?\s*(\d+)\s*(s|secs?)?\s*(?:on|work)?\s*\/\s*(\d+)\s*(s|secs?)?\s*(?:off|rest)?(?=[\s,:;.]|$)/))
  ) {
    make("intervals", { rounds: Number(m[1]), work_s: Number(m[2]), rest_s: Number(m[4]), stations: 1 }, { scheme: m[3] || m[5] ? "units" : null });
  } else if ((m = take(/^(\d+)\s*(?:s|secs?)?\s*(?:on|work)?\s*\/\s*(\d+)\s*(?:s|secs?)?\s*(?:off|rest)?\s*x\s*(\d+)\b/))) {
    make("intervals", { rounds: Number(m[3]), work_s: Number(m[1]), rest_s: Number(m[2]), stations: 1 }, { scheme: "units" });
  } else if ((m = take(/^(\d+)\s*(?:rounds?|rds?)\s*(?:of\s*)?,?\s*(?:for\s*time|ft)\b/)) || (m = take(/^(\d+)\s*rft\b/))) {
    make("for_time", { rounds: Number(m[1]) });
  } else if ((m = take(/^(?:for\s*time|chipper|ft)\b/))) {
    make("for_time", { rounds: 1 });
  } else if ((m = take(/^(\d+)\s*sets?\b/))) {
    make("sets", { sets: Number(m[1]) });
  } else if ((m = take(/^(\d+)\s*(?:rounds?|rds?)\b/))) {
    make("sets", { sets: Number(m[1]) }, { roundsOnly: true });
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
  const stations = take(/(?:x\s*)?(\d+)\s*stations?\b/);
  const alternating = !!take(/\b(?:alternating|alt)\b/);
  if (alternating && result.format !== "every") problems.push("Alternating minutes belong to an EMOM");

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
  [/^(?:skill|gymnastics)\b/i, "skill"],
  [/^(?:mobility|warm[- ]?up|cool[- ]?down|stretch(?:ing)?)\b/i, "mobility"],
  [/^(?:metcon|wod|conditioning|finisher|engine)\b/i, "conditioning"],
];

interface Heading {
  /** "A" in "A.", "Part A", "A1."; null without one. */
  letter: string | null;
  /** A1, A2 …: a line of block A (supersets), not a new block. */
  itemOfBlock: boolean;
  intent: BlockIntent | null;
  section: string | null;
  rest: string;
}

function readHeading(text: string): Heading {
  let rest = text;
  let letter: string | null = null;
  let itemOfBlock = false;
  const part = rest.match(/^(?:part|block)\s+([a-z])\b[\s.:)-]*/i);
  const label = rest.match(/^([A-H])(\d)?\s*[.):]\s*/);
  if (part) {
    letter = part[1]!.toUpperCase();
    rest = rest.slice(part[0].length);
  } else if (label) {
    letter = label[1]!;
    itemOfBlock = label[2] !== undefined;
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
  return { letter, itemOfBlock, intent, section, rest: rest.trim() };
}


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
  /** Every heading line of the block ("Metcon", then "EMOM 12"). */
  headingLines: ParsedLine[];
  /** The block's efforts, set once its lines are known ("heavy" is Load only if the block has a load). */
  efforts: { found: EffortFound; line: ParsedLine }[];
}

const NOTE_LINE = /^(?:scale[sd]?|scaling|score|rx|note|notes|coach(?:'s)? notes?|goal|stimulus|target|options?|tip)\s*[:-]/i;

export function parseWorkoutText(text: string, library: Library, answers: Answers = {}): ParseResult {
  const lines: ParsedLine[] = [];
  const blocks: Building[] = [];
  const items = new Map<string, { item: DraftItem; building: Building }>();
  let title = "";
  let current: Building | null = null;
  /** The last line read, while it still lacks its amount ("Back squat" then "5 x 5 @ 80%"). */
  let waiting: { item: DraftItem; parsed: ParsedItem } | null = null;
  let seenContent = false;

  const startBlock = (letter: string | null): Building => {
    const building: Building = { block: { ...newBlock(), items: [] }, letter, hasFormat: false, intentFrom: "format", scheme: null, headingLine: null, setsFromLine: false, roundsOnly: false, headingLines: [], efforts: [] };
    blocks.push(building);
    current = building;
    waiting = null;
    return building;
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
    if (!parts.words && waiting && (parts.quantity || parts.sets !== null)) {
      fill(building, waiting.item, parts, waiting.parsed.resolution, line);
      line.items.push(waiting.parsed);
      waiting = null;
      return true;
    }
    if (!parts.words && !parts.quantity) return false;

    const resolution = parts.words ? resolveExercise(library, parts.words, answers) : null;
    // Words without an amount that are no exercise ("Leave nothing behind!"): a note, not a line.
    if (resolution?.kind === "unmatched" && !parts.quantity && parts.sets === null && !parts.load) return false;
    const item = { ...newItem(slot), rawLine: partText.trim() };
    if (resolution?.kind === "matched") item.exerciseId = resolution.exercise.id;
    if (parts.notes.length) item.notes = parts.notes.join("; ");
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
        line.problems.push(/^\d+\s*\/\s*\d+\s*(?:cal|m)/i.test(item.quantity) ? "Men/women amounts are not read yet: write one amount or a range, e.g. 12-15 cal" : q.error);
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
    const tidied = tidy(original);
    if (!tidied) {
      line.status = "blank";
      return;
    }
    const heading = readHeading(tidied);
    const efforts = takeEffortText(heading.rest);
    const read = readFormat(efforts.text);
    const startsBlock = (heading.letter !== null && !heading.itemOfBlock) || heading.intent !== null || read !== null;

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
    if (NOTE_LINE.test(tidied)) {
      note(line, open ?? startBlock(null));
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
    const restLine = tidied.match(/^rest\s*:?\s*(\d+(?::\d\d)?\s*(?:s|secs?|seconds?|min(?:ute)?s?|')?)\s*(?:between\s*(sets|rounds))?\.?$/i);
    if (restLine && open) {
      const secs = seconds(restLine[1]!, "min");
      const between = restLine[2]?.toLowerCase();
      const fits = secs !== null && (!between || (between === "sets" && open.block.format === "sets") || (between === "rounds" && open.block.format === "intervals"));
      if (!fits) {
        note(line, open);
        return;
      }
      if (between === "sets") open.block.params.rest_s = secs!;
      else if (between === "rounds") open.block.params.rest_between_rounds_s = secs!;
      else open.block.restAfterSec = secs!;
      line.meaning = between ? `Rest ${durationText(secs!)} between ${between}` : `Rest ${durationText(secs!)} after block ${letterOf(blocks.indexOf(open))}`;
      line.block = blocks.indexOf(open);
      return;
    }
    if (open && /^(?:with a partner|partner(?:\s*wod)?|in pairs|teams? of 2)\.?$/i.test(tidied)) {
      open.block.partner = true;
      line.meaning = "Partner";
      line.block = blocks.indexOf(open);
      return;
    }

    if (startsBlock) {
      // A heading continues an empty block ("A. Strength" then "E3M x 5"), otherwise starts one.
      const reuse = open && open.block.items.length === 0 && !(open.hasFormat && read) && (heading.letter === null || open.letter === null || open.letter === heading.letter);
      const building = reuse ? open : startBlock(heading.letter);
      if (heading.letter) building.letter = heading.letter;
      if (heading.section) building.block.title ||= capitalise(heading.section);
      if (heading.intent) {
        building.block.intent = heading.intent;
        building.intentFrom = "section";
      }
      for (const found of efforts.found) building.efforts.push({ found, line });
      if (/\b(?:partner|in pairs|teams? of 2)\b/i.test(tidied)) building.block.partner = true;
      if (read) {
        building.block.format = read.format;
        building.block.params = { ...read.params, ...(read.alternating ? { alternating: true } : {}) };
        building.hasFormat = true;
        building.scheme = read.scheme;
        building.roundsOnly = read.roundsOnly;
        if (read.roundsOnly) line.problems.push(`Not for time: read as ${read.params.sets} sets. Write "for time" if it is.`);
        line.problems.push(...read.problems);
        if (Object.values(read.params).some((v) => v === undefined)) line.blocking = true;
      }
      if (read || !building.headingLine) building.headingLine = line;
      building.headingLines.push(line);
      line.block = blocks.indexOf(building);

      // Lines written after the heading: "AMRAP 8: 5 KB swing, 10 air squat" or "Tabata air squats".
      const rest = (read ? read.rest : efforts.text).replace(/\b(?:with a )?partners?\b|\bin pairs\b|\bteams? of 2\b/gi, "").replace(/\(\s*\)/g, "").trim();
      const inline = rest.includes(":") ? rest.slice(rest.indexOf(":") + 1) : read || heading.letter ? rest : "";
      for (const part of inline.split(/\s*(?:,|;|\s\+\s)\s*/)) if (/[a-z0-9]/i.test(part)) addItem(part, line, null);
      return;
    }

    // A1. Bench 4 x 8 · A2. Row 4 x 10: lines of block A.
    if (heading.itemOfBlock && open?.letter !== heading.letter) startBlock(heading.letter);
    if (!addItem(heading.itemOfBlock ? heading.rest : tidied, line, null)) {
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
      block.params.stations = Math.max(1, block.items.length);
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
  return [`Block ${letterOf(index)}`, formatMeaning(block), intent, ...efforts, block.partner && "partner"].filter(Boolean).join(" · ");
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
