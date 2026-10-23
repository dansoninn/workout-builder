"use server";

import { z } from "zod";

import { type ActionResult, gymForAction, NOT_ALLOWED } from "@/lib/actions";
import type { Json } from "@/lib/database.types";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { type DraftWorkout, draftProblems, toSavePayload } from "@/lib/workout/draft";
import { loadLibrary } from "@/lib/workout/load-library";
import { storeMetrics } from "@/lib/workout/metrics";
import { PARSER_VERSION, parseWorkoutText } from "@/lib/workout/parse";

const inputSchema = z.strictObject({
  text: z.string().trim().min(1).max(20000),
  date: z.iso.date(),
  trackId: z.uuid().nullable(),
  /** The coach's answers: normalised words → exercise id. */
  answers: z.record(z.string().max(80), z.uuid()),
  /** Unknown words to keep as the gym's names (owners and head coaches). */
  remember: z.array(z.string().max(80)).max(50),
});

/**
 * Makes a workout from pasted text. The text is read again here, with the
 * gym's library and the coach's answers, so what is saved never depends on
 * what the browser sends. One transaction stores the workout, the text and the
 * gym's names for the words answered (a generic word always; an unknown word
 * when an owner or head coach asked to remember it).
 */
export async function createFromText(slug: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const gym = await gymForAction(slug, can.program);
  if (!gym) return { ok: false, error: NOT_ALLOWED };
  const parsedInput = inputSchema.safeParse(input);
  if (!parsedInput.success) return { ok: false, error: "The text could not be read. Reload the page and try again." };
  const { text, date, trackId, answers, remember } = parsedInput.data;

  const library = await loadLibrary(gym.id);
  const parsed = parseWorkoutText(text, library, answers);
  const blocking = parsed.lines.find((l) => l.blocking);
  if (blocking) return { ok: false, error: `Line ${blocking.line + 1}: ${blocking.problems[0] ?? "check it"}` };
  if (parsed.blocks.length === 0) return { ok: false, error: "There is no exercise in the text yet." };

  const draft: DraftWorkout = {
    id: crypto.randomUUID(),
    kind: "scheduled",
    date,
    trackId,
    title: parsed.title.slice(0, 120),
    focus: "",
    status: "draft",
    blocks: parsed.blocks,
    rawText: text,
    parserVersion: PARSER_VERSION,
  };
  const [problem] = draftProblems(draft, library);
  if (problem) return { ok: false, error: problem.message };

  const named = new Map<string, string>();
  for (const line of parsed.lines) {
    for (const item of line.items) {
      const r = item.resolution;
      if (r?.kind !== "matched" || r.via !== "answer") continue;
      const generic = library.ambiguous[r.term] !== undefined;
      if (generic || (remember.includes(r.term) && can.editExerciseBank(gym.role))) named.set(r.term, r.exercise.id);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_pasted_workout", {
    p_org: gym.id,
    p_workout: toSavePayload(draft, library) as unknown as Json,
    p_aliases: [...named].map(([term, exercise_id]) => ({ term, exercise_id })) as unknown as Json,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, error: NOT_ALLOWED };
    if (error.code === "23514" && /archived/.test(error.message)) return { ok: false, error: error.message };
    return { ok: false, error: "Could not make the workout. Your text is kept here; try again." };
  }
  await storeMetrics(gym.id, draft.id);
  return { ok: true, id: draft.id };
}
