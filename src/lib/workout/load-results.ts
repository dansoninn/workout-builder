import "server-only";

import { ENGINE_CONFIG } from "@/lib/engine/config";
import { computeWorkout } from "@/lib/engine/workout";
import { createClient } from "@/lib/supabase/server";

import { toEngineWorkout } from "./draft";
import { loadLibrary } from "./load-library";
import { loadWorkout } from "./load-workout";
import type { ResultMeasure, RoundLine } from "./results";
import type { BlockFormat } from "./rules";

/** A result as the results page shows it. */
export interface LoggedResult extends ResultMeasure {
  id: string;
  blockId: string;
  sessionLabel: string | null;
  /** As the coach wrote it ("7 + 12 – 9 + 3"), for AMRAP rounds. */
  rawText: string | null;
  note: string | null;
  loggedBy: string | null;
  loggedAt: string;
}

/** The live (not deleted) results of these blocks, oldest first. */
export async function loadLoggedResults(orgId: string, blockIds: string[]): Promise<LoggedResult[]> {
  if (blockIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("block_results")
    .select("id, block_id, session_label, raw_text, rounds_low, rounds_high, finish_low_s, finish_high_s, note, created_at, profiles (display_name)")
    .eq("org_id", orgId)
    .in("block_id", blockIds)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    blockId: r.block_id,
    sessionLabel: r.session_label,
    rawText: r.raw_text,
    rounds_low: r.rounds_low,
    rounds_high: r.rounds_high,
    finish_low_s: r.finish_low_s,
    finish_high_s: r.finish_high_s,
    note: r.note,
    // No profile to read: the person deleted their account or left the gym.
    loggedBy: r.profiles ? r.profiles.display_name : "a former member",
    loggedAt: r.created_at,
  }));
}

/** A workout that has AMRAP or For Time blocks, for the results list. */
export interface ResultsWorkout {
  id: string;
  date: string;
  title: string | null;
  trackId: string | null;
  blocks: { id: string; label: string; format: Extract<BlockFormat, "amrap" | "for_time">; results: number }[];
}

/** Scheduled workouts from `from` to `to` (inclusive) with blocks that take results, newest first. */
export async function loadResultsWorkouts(orgId: string, from: string, to: string): Promise<ResultsWorkout[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select("id, date, title, track_id, created_at, blocks!inner (id, label, position, format, block_results (id, deleted_at))")
    .eq("org_id", orgId)
    .eq("kind", "scheduled")
    .is("deleted_at", null)
    .gte("date", from)
    .lte("date", to)
    .in("blocks.format", ["amrap", "for_time"])
    .order("date", { ascending: false })
    .order("created_at");
  if (error) throw error;
  return data.map((w) => ({
    id: w.id,
    date: w.date!,
    title: w.title,
    trackId: w.track_id,
    blocks: [...w.blocks]
      .sort((a, b) => a.position - b.position)
      .map((b) => ({
        id: b.id,
        label: b.label,
        format: b.format as "amrap" | "for_time",
        results: b.block_results.filter((r) => r.deleted_at === null).length,
      })),
  }));
}

/** An AMRAP block's round, line by line, from the engine on the saved workout: what "7 + 12" is read against. */
export async function loadRoundLines(orgId: string, blockId: string): Promise<RoundLine[] | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("blocks").select("workout_id").eq("id", blockId).eq("org_id", orgId).maybeSingle();
  if (!data) return null;
  const [stored, library] = await Promise.all([loadWorkout(orgId, data.workout_id), loadLibrary(orgId)]);
  const index = stored?.draft.blocks.findIndex((b) => b.id === blockId) ?? -1;
  if (!stored || index < 0) return null;
  const result = computeWorkout(toEngineWorkout(stored.draft, library).workout, ENGINE_CONFIG);
  return result.blocks[index]?.roundLines ?? null;
}
