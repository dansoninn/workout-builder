import "server-only";

import type { Load, PartnerMode, Quantity } from "@/lib/engine/types";
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
  const [stored] = await loadWorkouts(orgId, [workoutId]);
  return stored ?? null;
}

/** Saved workouts as the builder edits them, in the order asked for; deleted ones and other gyms' are left out. */
export async function loadWorkouts(orgId: string, workoutIds: string[]): Promise<StoredWorkout[]> {
  if (workoutIds.length === 0) return [];
  const supabase = await createClient();
  const { data: workouts, error: workoutsError } = await supabase
    .from("workouts")
    .select("id, kind, date, track_id, title, focus, status, updated_at, raw_text, parser_version")
    .in("id", workoutIds)
    .eq("org_id", orgId)
    .is("deleted_at", null);
  if (workoutsError) throw workoutsError;
  if (workouts.length === 0) return [];

  const { data: blocks, error } = await supabase
    .from("blocks")
    .select(
      "id, workout_id, position, title, intent, format, params, pace_effort, load_effort, partner_mode, target_rounds, notes, rest_after_s, " +
        "block_items (id, position, exercise_id, raw_line, quantity, load, pace_effort, load_effort, implement_count, notes, slot)",
    )
    .in("workout_id", workouts.map((w) => w.id))
    .order("position");
  if (error) throw error;

  type Row = {
    id: string; workout_id: string; title: string | null; intent: DraftWorkout["blocks"][number]["intent"]; format: BlockFormat;
    params: Record<string, number | boolean>; pace_effort: string | null; load_effort: string | null; partner_mode: PartnerMode | null;
    target_rounds: number | null; notes: string; rest_after_s: number | null;
    block_items: { id: string; position: number; exercise_id: string | null; raw_line: string; quantity: Quantity; load: Load | null;
      pace_effort: string | null; load_effort: string | null; implement_count: number | null; notes: string; slot: number | null }[];
  };
  const rows = (blocks ?? []) as unknown as Row[];
  const byId = new Map(workouts.map((w) => [w.id, w]));

  return workoutIds.flatMap((id) => {
    const w = byId.get(id);
    if (!w) return [];
    return [{
      updatedAt: w.updated_at,
      draft: {
        id: w.id,
        kind: w.kind,
        date: w.date,
        trackId: w.track_id,
        title: w.title ?? "",
        focus: w.focus ?? "",
        status: w.status,
        blocks: rows.filter((b) => b.workout_id === w.id).map((b) => ({
          id: b.id,
          title: b.title ?? "",
          intent: b.intent,
          format: b.format,
          params: b.params,
          paceEffort: b.pace_effort as EffortKey | null,
          loadEffort: b.load_effort as Exclude<EffortKey, "max"> | null,
          partner: b.partner_mode,
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
    }];
  });
}
