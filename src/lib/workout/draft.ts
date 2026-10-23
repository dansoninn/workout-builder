import type { BlockIntent, Block as EngineBlock, Item as EngineItem, Load, Quantity, Workout } from "@/lib/engine/types";
import type { EffortKey } from "@/lib/taxonomy";

import { parseLoad, parseQuantity, rawLine } from "./fields";
import { type Library, type LibraryExercise, toEngineExercise } from "./library";
import { type BlockFormat, blockParamsSchemas } from "./rules";

/**
 * What the coach is editing in the builder. Text fields keep exactly what was
 * typed; they are parsed when the engine runs and when the workout is saved.
 * Every block and line has a stable id from the start, so saving can tell
 * what changed (save_workout) and the browser backup survives a reload.
 */
export interface DraftItem {
  id: string;
  exerciseId: string | null;
  quantity: string;
  load: string;
  /** Overrides the exercise's implement count (2 × 22.5 kg); null = the exercise's default. */
  implementCount: number | null;
  paceEffort: EffortKey | null;
  loadEffort: Exclude<EffortKey, "max"> | null;
  notes: string;
  /** Alternating EMOM: the slot (minute) of the rotation, 1, 2, … */
  slot: number | null;
  /**
   * The line as the coach pasted it (4c), stored as its raw_line until the
   * line is edited; then the builder writes the line from its fields.
   */
  rawLine?: string | null;
}

export type BlockParams = Record<string, number | boolean | undefined>;

export interface DraftBlock {
  id: string;
  title: string;
  intent: BlockIntent;
  format: BlockFormat;
  params: BlockParams;
  paceEffort: EffortKey | null;
  loadEffort: Exclude<EffortKey, "max"> | null;
  partner: boolean;
  targetRounds: number | null;
  notes: string;
  /** Rest before the next block (s); in session length, never in planned load. */
  restAfterSec: number | null;
  items: DraftItem[];
}

export interface DraftWorkout {
  id: string;
  kind: "scheduled" | "template";
  date: string | null;
  trackId: string | null;
  title: string;
  focus: string;
  status: "draft" | "published";
  blocks: DraftBlock[];
  /** The text the workout was pasted from (4c) and the parser that read it; kept as they are. */
  rawText?: string | null;
  parserVersion?: number | null;
}

export const FORMAT_LABELS: Record<BlockFormat, string> = {
  sets: "Sets",
  every: "Every (EMOM)",
  amrap: "AMRAP",
  for_time: "For time",
  intervals: "Intervals",
  tabata: "Tabata",
};

/** Sensible starting values when a coach picks a format. */
export const DEFAULT_PARAMS: Record<BlockFormat, BlockParams> = {
  sets: { sets: 5 },
  every: { interval_s: 60, rounds: 10 },
  amrap: { time_s: 600 },
  for_time: { rounds: 1 },
  intervals: { rounds: 4, work_s: 40, rest_s: 20, stations: 1 },
  tabata: { rounds: 8, work_s: 20, rest_s: 10 },
};

/** Labels run A, B, C … Z, then AA, AB … */
export function blockLabel(index: number): string {
  const letter = (i: number) => String.fromCharCode(65 + (i % 26));
  return index < 26 ? letter(index) : letter(Math.floor(index / 26) - 1) + letter(index);
}

const uuid = () => crypto.randomUUID();

export function newItem(slot: number | null = null): DraftItem {
  return { id: uuid(), exerciseId: null, quantity: "", load: "", implementCount: null, paceEffort: null, loadEffort: null, notes: "", slot };
}

export function newBlock(format: BlockFormat = "sets", intent: BlockIntent = "strength"): DraftBlock {
  return {
    id: uuid(),
    title: "",
    intent,
    format,
    params: { ...DEFAULT_PARAMS[format] },
    paceEffort: null,
    loadEffort: null,
    partner: false,
    targetRounds: null,
    notes: "",
    restAfterSec: null,
    items: [newItem()],
  };
}

export function newWorkout(date: string | null, trackId: string | null): DraftWorkout {
  return {
    id: uuid(),
    kind: date ? "scheduled" : "template",
    date,
    trackId,
    title: "",
    focus: "",
    status: "draft",
    blocks: [newBlock()],
  };
}

export const isAlternating = (block: DraftBlock) => block.format === "every" && block.params.alternating === true;

/**
 * How an alternating EMOM's intervals fall on its minutes: 10 intervals over
 * 3 minutes → "3 rotations + minute 1" (the last rotation may be partial, calc
 * spec §4.3). Null when there is nothing to say.
 */
export function rotationText(intervals: number | undefined, slots: number): string | null {
  if (!intervals || slots < 2) return null;
  const full = Math.floor(intervals / slots);
  const extra = intervals % slots;
  const rotations = full > 0 ? `${full} ${full === 1 ? "rotation" : "rotations"}` : null;
  const partial = extra === 0 ? null : extra === 1 ? "minute 1" : `minutes 1–${extra}`;
  return [rotations, partial].filter(Boolean).join(" + ");
}

/** A line the coach has started (an exercise or an amount); untouched empty lines are ignored. */
export const isStarted = (item: DraftItem) => item.exerciseId !== null || item.quantity.trim() !== "" || item.load.trim() !== "";

export interface LineParse {
  exercise: LibraryExercise | null;
  quantity: { ok: true; value: Quantity } | { ok: false; error: string };
  load: { ok: true; value: Load | null } | { ok: false; error: string };
  /** The line's own implement count (typed "2x22.5" or set on the line), stored as an override; null = the exercise's. */
  implementOverride: number | null;
  /** The count in use: the override, else the exercise's default. */
  implementCount: number;
}

/** Parses one line against the library (the exercise's unit gives a bare number its meaning). */
export function parseLine(item: DraftItem, library: Library): LineParse {
  const exercise = item.exerciseId ? (library.exercises.find((e) => e.id === item.exerciseId) ?? null) : null;
  const quantity = parseQuantity(item.quantity, exercise?.defaultUnit ?? "reps");
  const load = parseLoad(item.load);
  const implementOverride = item.implementCount ?? (load.ok ? (load.implementCount ?? null) : null);
  return {
    exercise,
    quantity: quantity.ok ? { ok: true, value: quantity.value } : quantity,
    load: load.ok ? { ok: true, value: load.value } : load,
    implementOverride,
    implementCount: implementOverride ?? exercise?.implementCount ?? 1,
  };
}

/**
 * The workout as the engine sees it. Lines that cannot be read yet (no
 * amount, or one that does not parse) are left out; `itemIndex` maps each
 * engine line back to the draft line, so issues can point at it.
 */
export function toEngineWorkout(draft: DraftWorkout, library: Library): { workout: Workout; itemIndex: number[][] } {
  const itemIndex: number[][] = [];
  const blocks = draft.blocks.map((block, b): EngineBlock => {
    const indexes: number[] = [];
    const items: EngineItem[] = [];
    block.items.forEach((item, i) => {
      if (!isStarted(item)) return;
      const line = parseLine(item, library);
      if (!line.quantity.ok || !line.load.ok) return;
      indexes.push(i);
      items.push({
        exercise: line.exercise ? toEngineExercise(line.exercise) : null,
        rawLine: rawLine(line.quantity.value, line.exercise?.name ?? null, line.load.value, line.implementCount),
        quantity: line.quantity.value,
        load: line.load.value,
        paceEffort: item.paceEffort,
        loadEffort: item.loadEffort,
        implementCount: line.implementOverride,
        slot: isAlternating(block) ? item.slot : null,
      });
    });
    itemIndex[b] = indexes;
    return {
      label: blockLabel(b),
      intent: block.intent,
      paceEffort: block.paceEffort,
      loadEffort: block.loadEffort,
      targetRounds: block.format === "amrap" ? block.targetRounds : null,
      restAfterSec: block.restAfterSec,
      items,
      ...paramsFor(block),
    } as EngineBlock;
  });
  return { workout: { blocks }, itemIndex };
}

/** Only the params the format has (a format change keeps old values in the draft until saved). */
function paramsFor(block: DraftBlock): { format: BlockFormat; params: BlockParams } {
  const keys = Object.keys(blockParamsSchemas[block.format].shape);
  const params = Object.fromEntries(
    keys.flatMap((k) => (block.params[k] === undefined || block.params[k] === false ? [] : [[k, block.params[k]]])),
  );
  if (block.format === "tabata") Object.assign(params, { work_s: 20, rest_s: 10 });
  return { format: block.format, params };
}

export type DraftProblem = { block: number; item: number | null; field: string; message: string };

/** What must be fixed before the workout can be saved (unmatched exercises are allowed in a draft). */
export function draftProblems(draft: DraftWorkout, library: Library): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (draft.kind === "scheduled" && !draft.date) problems.push({ block: -1, item: null, field: "date", message: "Choose a date" });
  if (!draft.trackId) problems.push({ block: -1, item: null, field: "trackId", message: "Choose a program" });
  draft.blocks.forEach((block, b) => {
    const { format, params } = paramsFor(block);
    const parsed = blockParamsSchemas[format].safeParse(params);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      problems.push({ block: b, item: null, field: String(issue?.path[0] ?? "params"), message: "Check the block's numbers" });
    }
    if (block.restAfterSec !== null && !(Number.isInteger(block.restAfterSec) && block.restAfterSec >= 0)) {
      problems.push({ block: b, item: null, field: "restAfterSec", message: "Rest is whole seconds" });
    }
    block.items.forEach((item, i) => {
      if (!isStarted(item)) return;
      const line = parseLine(item, library);
      if (!line.quantity.ok) problems.push({ block: b, item: i, field: "quantity", message: line.quantity.error });
      if (!line.load.ok) problems.push({ block: b, item: i, field: "load", message: line.load.error });
    });
  });
  return problems;
}

/** The JSON save_workout expects (SPEC-data-model §6). Call only when draftProblems() is empty. */
export function toSavePayload(draft: DraftWorkout, library: Library) {
  return {
    id: draft.id,
    track_id: draft.trackId,
    kind: draft.kind,
    date: draft.kind === "scheduled" ? draft.date : null,
    title: draft.title.trim() || null,
    focus: draft.focus.trim() || null,
    raw_text: draft.rawText ?? null,
    parser_version: draft.parserVersion ?? null,
    blocks: draft.blocks.map((block, b) => {
      const { format, params } = paramsFor(block);
      // Alternating slots are renumbered 1…k in order, so they never have gaps.
      const slotOrder = [...new Set(block.items.filter(isStarted).map((i) => i.slot ?? 1))].sort((x, y) => x - y);
      return {
        id: block.id,
        label: blockLabel(b),
        title: block.title.trim() || null,
        intent: block.intent,
        format,
        params,
        pace_effort: block.paceEffort,
        load_effort: block.loadEffort,
        partner: block.partner,
        target_rounds: format === "amrap" ? block.targetRounds : null,
        notes: block.notes,
        rest_after_s: block.restAfterSec,
        items: block.items.filter(isStarted).map((item) => {
          const line = parseLine(item, library);
          if (!line.quantity.ok || !line.load.ok) throw new Error("toSavePayload called with problems in the draft");
          return {
            id: item.id,
            exercise_id: line.exercise?.id ?? null,
            // As pasted, until the line is edited; then as the builder writes it.
            raw_line: item.rawLine?.trim() || rawLine(line.quantity.value, line.exercise?.name ?? null, line.load.value, line.implementCount),
            quantity: line.quantity.value,
            load: line.load.value,
            pace_effort: item.paceEffort,
            load_effort: item.loadEffort,
            implement_count: line.implementOverride,
            notes: item.notes,
            station_label: null,
            slot: isAlternating(block) ? slotOrder.indexOf(item.slot ?? 1) + 1 : null,
          };
        }),
      };
    }),
  };
}

export type SavePayload = ReturnType<typeof toSavePayload>;
