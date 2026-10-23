import { type DraftBlock, type DraftWorkout, draftProblems } from "@/lib/workout/draft";
import type { Library } from "@/lib/workout/library";
import { PARSER_VERSION } from "@/lib/workout/parse";

import type { ImportReading, ReadDay } from "./review";

/**
 * What an import makes, worked out from the reading and the coach's choices.
 * Computed in the browser for the preview and again on the server for the
 * commit (from the stored answers), so what is saved never depends on what
 * the browser sends.
 */

export interface ImportChoices {
  /** Days that already have a workout in the program: leave them, replace them, or add alongside. */
  conflicts: "skip" | "replace" | "add";
  /** Publish the workouts that are ready; the rest are drafts to finish in the builder. */
  publish: boolean;
  /** Repeated workouts to keep as templates, by the key of their first day. */
  templates: string[];
  /** Unknown words whose answer the gym keeps as its name for the exercise (owners and head coaches). */
  remember: string[];
  /** Personal data found in the document was kept (it is removed unless the coach says so). */
  keepPersonal: boolean;
}

export const DEFAULT_CHOICES: ImportChoices = { conflicts: "skip", publish: false, templates: [], remember: [], keepPersonal: false };

export interface PlanContext {
  trackId: string;
  library: Library;
  /** The gym's active day focuses, by name. */
  focusNames: string[];
  /** Owners and head coaches: may add day focuses and closed days, and keep names for unknown words. */
  canManage: boolean;
  /** The program's scheduled workouts on the import's dates. */
  existing: { id: string; date: string }[];
  choices: ImportChoices;
  newId: () => string;
}

export interface PlannedWorkout extends DraftWorkout {
  /** Published at once (ready, and asked for); else a draft. */
  publish: boolean;
  /** The day it came from. */
  dayKey: string;
  ready: boolean;
}

export interface ImportPlan {
  workouts: PlannedWorkout[];
  /** Days that cannot be saved as written (an AMRAP without its time): fixed or left out before the import. */
  cannotSave: { dayKey: string; date: string; message: string }[];
  templates: DraftWorkout[];
  /** Workouts of the program the import replaces. */
  replace: string[];
  /** The program's focus for a day, by the focus's name. */
  days: { date: string; focus: string }[];
  /** Day focuses to add to the gym's list. */
  newFocuses: string[];
  closed: { date: string; name: string }[];
  /** The gym's names for words answered. */
  aliases: { term: string; exerciseId: string }[];
  summary: {
    workouts: number;
    cannotSave: number;
    ready: number;
    drafts: number;
    published: number;
    templates: number;
    replaced: number;
    /** Days left as they are because the program already has a workout then. */
    keptExisting: number;
    days: number;
    closed: number;
    /** Labels that need an owner or head coach (a new focus, a closed day) and are left out. */
    leftOut: number;
    from: string | null;
    to: string | null;
  };
}

const lower = (s: string) => s.trim().toLowerCase();

export function planImport(reading: ImportReading, ctx: PlanContext): ImportPlan {
  const { choices, library } = ctx;
  const byDate = new Map<string, string[]>();
  for (const w of ctx.existing) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w.id]);

  const workouts: PlannedWorkout[] = [];
  const cannotSave: ImportPlan["cannotSave"] = [];
  const replace = new Set<string>();
  let keptExisting = 0;
  const importable = reading.days.filter((r): r is ReadDay & { parsed: NonNullable<ReadDay["parsed"]> } => r.parsed !== null && r.day.date !== null && r.status !== "skipped" && r.status !== "no-date");
  for (const r of importable) {
    if (r.parsed.blocks.length === 0) continue;
    const date = r.day.date!;
    const there = byDate.get(date) ?? [];
    if (there.length > 0 && choices.conflicts === "skip") {
      keptExisting++;
      continue;
    }
    if (there.length > 0 && choices.conflicts === "replace") there.forEach((id) => replace.add(id));
    const draft: DraftWorkout = {
      id: ctx.newId(),
      kind: "scheduled",
      date,
      trackId: ctx.trackId,
      title: (r.day.title ?? r.benchmark ?? r.parsed.title).slice(0, 120),
      focus: "",
      status: "draft",
      blocks: r.parsed.blocks,
      rawText: r.text,
      parserVersion: PARSER_VERSION,
    };
    // What the builder would not save is not imported either; the coach fixes the day or leaves it out.
    const [problem] = draftProblems(draft, library);
    if (problem) {
      const where = problem.block >= 0 ? `Block ${String.fromCharCode(65 + problem.block)}: ` : "";
      cannotSave.push({ dayKey: r.day.key, date, message: `${where}${problem.message}` });
      continue;
    }
    const ready = r.status === "ok";
    workouts.push({ ...draft, dayKey: r.day.key, ready, publish: ready && choices.publish });
  }

  // Templates from repeated workouts: a copy of the first day's blocks, with their own ids.
  const fresh = (blocks: DraftBlock[]): DraftBlock[] =>
    blocks.map((b) => ({ ...structuredClone(b), id: ctx.newId(), items: b.items.map((i) => ({ ...structuredClone(i), id: ctx.newId() })) }));
  const templates: DraftWorkout[] = reading.repeated
    .filter((group) => choices.templates.includes(group.days[0]!))
    .flatMap((group) => {
      const first = reading.days.find((r) => r.day.key === group.days[0]);
      if (!first?.parsed) return [];
      return [{
        id: ctx.newId(),
        kind: "template",
        date: null,
        trackId: ctx.trackId,
        // A template is found by its name: the workout's title, else its first line ("AMRAP 12").
        title: (first.day.title ?? first.benchmark ?? (first.parsed.title || first.text.split("\n")[0]!.trim())).slice(0, 120) || "Template",
        focus: "",
        status: "draft",
        blocks: fresh(first.parsed.blocks),
        rawText: first.text,
        parserVersion: PARSER_VERSION,
      }];
    });

  // Day focuses and closed days from the labels: new focuses and closed days are the gym's lists (owners and head coaches).
  const known = new Map(ctx.focusNames.map((n) => [lower(n), n]));
  const newFocuses = new Map<string, string>();
  const days: { date: string; focus: string }[] = [];
  const closed: { date: string; name: string }[] = [];
  let leftOut = 0;
  for (const r of reading.days) {
    if (!r.day.date || r.status === "skipped") continue;
    if (r.focus) {
      const name = known.get(lower(r.focus)) ?? newFocuses.get(lower(r.focus));
      if (name) days.push({ date: r.day.date, focus: name });
      else if (ctx.canManage) {
        newFocuses.set(lower(r.focus), r.focus.trim());
        days.push({ date: r.day.date, focus: r.focus.trim() });
      } else leftOut++;
    }
    if (r.closed) {
      if (ctx.canManage) closed.push({ date: r.day.date, name: r.closed.slice(0, 80) });
      else leftOut++;
    }
  }

  // Words answered: a generic word is always the gym's answer (as in Paste); an unknown word when kept by an owner or head coach.
  const aliases = new Map<string, string>();
  for (const r of importable) {
    for (const item of r.parsed.lines.flatMap((l) => l.items)) {
      const res = item.resolution;
      if (res?.kind !== "matched" || res.via !== "answer") continue;
      const generic = library.ambiguous[res.term] !== undefined;
      if (generic || (ctx.canManage && choices.remember.includes(res.term))) aliases.set(res.term, res.exercise.id);
    }
  }

  const dates = workouts.map((w) => w.date!).sort();
  return {
    workouts,
    cannotSave,
    templates,
    replace: [...replace],
    days,
    newFocuses: [...newFocuses.values()],
    closed,
    aliases: [...aliases].map(([term, exerciseId]) => ({ term, exerciseId })),
    summary: {
      workouts: workouts.length,
      cannotSave: cannotSave.length,
      ready: workouts.filter((w) => w.ready).length,
      drafts: workouts.filter((w) => !w.publish).length,
      published: workouts.filter((w) => w.publish).length,
      templates: templates.length,
      replaced: replace.size,
      keptExisting,
      days: days.length,
      closed: closed.length,
      leftOut,
      from: dates[0] ?? null,
      to: dates.at(-1) ?? null,
    },
  };
}
