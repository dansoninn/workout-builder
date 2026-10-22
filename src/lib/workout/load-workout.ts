import "server-only";

import type { Load, Quantity } from "@/lib/engine/types";
import { createClient } from "@/lib/supabase/server";
import type { EffortKey } from "@/lib/taxonomy";

import type { DraftWorkout } from "./draft";
import { loadText, quantityText } from "./fields";
import type { BlockFormat } from "./rules";

export interface StoredWorkout {
  draft: DraftWorkout;
  updatedAt: string;
}

/** A saved workout as the builder edits it, or null (deleted, or not this gym's). */
export async function loadWorkout(orgId: string, workoutId: string): Promise<StoredWorkout | null> {
  const supabase = await createClient();
  const { data: w } = await supabase
    .from("workouts")
    .select("id, kind, date, track_id, title, focus, status, updated_at, raw_text, parser_version")
    .eq("id", workoutId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!w) return null;

  const { data: blocks, error } = await supabase
    .from("blocks")
    .select(
      "id, position, title, intent, format, params, pace_effort, load_effort, partner, target_rounds, notes, rest_after_s, " +
        "block_items (id, position, exercise_id, raw_line, quantity, load, pace_effort, load_effort, implement_count, notes, slot)",
    )
    .eq("workout_id", workoutId)
    .order("position");
  if (error) throw error;

  type Row = {
    id: string; title: string | null; intent: DraftWorkout["blocks"][number]["intent"]; format: BlockFormat;
    params: Record<string, number | boolean>; pace_effort: string | null; load_effort: string | null; partner: boolean;
    target_rounds: number | null; notes: string; rest_after_s: number | null;
    block_items: { id: string; position: number; exercise_id: string | null; raw_line: string; quantity: Quantity; load: Load | null;
      pace_effort: string | null; load_effort: string | null; implement_count: number | null; notes: string; slot: number | null }[];
  };

  return {
    updatedAt: w.updated_at,
    draft: {
      id: w.id,
      kind: w.kind,
      date: w.date,
      trackId: w.track_id,
      title: w.title ?? "",
      focus: w.focus ?? "",
      status: w.status,
      blocks: ((blocks ?? []) as unknown as Row[]).map((b) => ({
        id: b.id,
        title: b.title ?? "",
        intent: b.intent,
        format: b.format,
        params: b.params,
        paceEffort: b.pace_effort as EffortKey | null,
        loadEffort: b.load_effort as Exclude<EffortKey, "max"> | null,
        partner: b.partner,
        targetRounds: b.target_rounds === null ? null : Number(b.target_rounds),
        notes: b.notes,
        restAfterSec: b.rest_after_s,
        items: [...b.block_items]
          .sort((x, y) => x.position - y.position)
          .map((i) => ({
            id: i.id,
            exerciseId: i.exercise_id,
            quantity: quantityText(i.quantity),
            // A two-dumbbell line reads back as "2x22.5 kg", as the coach typed it.
            load: loadText(i.load, i.load?.type === "absolute_kg" ? i.implement_count : null),
            implementCount: i.load?.type === "absolute_kg" ? null : i.implement_count,
            paceEffort: i.pace_effort as EffortKey | null,
            loadEffort: i.load_effort as Exclude<EffortKey, "max"> | null,
            notes: i.notes,
            slot: i.slot,
            rawLine: i.raw_line,
          })),
      })),
      rawText: w.raw_text,
      parserVersion: w.parser_version,
    },
  };
}
