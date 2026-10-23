import "server-only";

import { strToU8, zipSync } from "fflate";

import { createClient } from "@/lib/supabase/server";

import { toCsv } from "./csv";

/** The API returns at most this many rows per request. */
const PAGE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Every row of a query, a page at a time, in a fixed order. */
async function everyRow<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return rows;
  }
}

const README = (gym: string, at: string) => `Workout Builder: the data of ${gym}, exported ${at} (UTC).

data.json   Everything below, exactly as stored, in one file.
csv/        The same as spreadsheets, one file per kind of data.

  programs.csv         The gym's programs (Class, Strength club, ...), with their own guidelines if any.
  workouts.csv         Scheduled workouts and templates, with the text they were written or pasted as.
                       Deleted workouts are included, with the time they were deleted (deleted_at).
  blocks.csv           The blocks of each workout (A, B, C ...), linked by workout_id.
  block_items.csv      The lines of each block, linked by block_id, each as it was written (raw_line).
  block_results.csv    What the groups did in AMRAP and For time blocks.
  exercises.csv        The gym's own exercises (the shared core library is not included).
  exercise_names.csv   The gym's own names for exercises (aliases).
  pace_overrides.csv   The gym's own paces for exercises.
  members.csv          Members and their roles, with their email addresses.
  invitations.csv      Invitations sent, and what became of them.
  audit_log.csv        Every change to the gym's programming: who, when, and what changed.

Planned load and the other numbers per workout are in data.json (workoutMetrics); they
are worked out from the workouts and can always be worked out again.

In the CSV files, text that starts with = + - or @ begins with an apostrophe, so that a
spreadsheet does not treat it as a formula. data.json has every value as stored.
Times are in UTC. Ids link the files together.
`;

/**
 * Everything a gym has stored, as a zip file of JSON and CSV (PLAN-step-6 6c:
 * the owner's export). Read as the signed-in owner, so RLS returns only this
 * gym's rows. Not included: the shared core library, and each member's private
 * preferences (only they can read them).
 */
export async function gymExport(gym: { id: string; name: string }, now: Date): Promise<Uint8Array> {
  const supabase = await createClient();
  const org = gym.id;
  const [organization, members, invitations, programs, workouts, blocks, items, results, metrics, exercises, aliases, paces, audit] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, country, settings, created_at").eq("id", org).single(),
    supabase.rpc("list_gym_members", { p_org: org }),
    everyRow((a, b) =>
      supabase.from("invitations").select("id, email, role, created_at, expires_at, accepted_at, revoked_at").eq("org_id", org).order("created_at").order("id").range(a, b),
    ),
    everyRow((a, b) => supabase.from("tracks").select("*").eq("org_id", org).order("position").order("id").range(a, b)),
    everyRow((a, b) => supabase.from("workouts").select("*").eq("org_id", org).order("date").order("id").range(a, b)),
    everyRow((a, b) => supabase.from("blocks").select("*").eq("org_id", org).order("workout_id").order("position").order("id").range(a, b)),
    everyRow((a, b) => supabase.from("block_items").select("*").eq("org_id", org).order("block_id").order("position").order("id").range(a, b)),
    everyRow((a, b) => supabase.from("block_results").select("*").eq("org_id", org).order("created_at").order("id").range(a, b)),
    everyRow((a, b) => supabase.from("workout_metrics").select("*").eq("org_id", org).order("workout_id").order("calc_version").range(a, b)),
    everyRow((a, b) =>
      supabase
        .from("exercises")
        .select("*, exercise_patterns (pattern_key, weight), exercise_muscles (muscle_key, role), exercise_equipment (equipment_key)")
        .eq("org_id", org)
        .order("name")
        .order("id")
        .range(a, b),
    ),
    everyRow((a, b) => supabase.from("exercise_aliases").select("*").eq("org_id", org).order("alias_normalized").order("id").range(a, b)),
    everyRow((a, b) => supabase.from("exercise_pace_overrides").select("*").eq("org_id", org).order("exercise_id").range(a, b)),
    everyRow((a, b) => supabase.from("audit_log").select("*").eq("org_id", org).order("id").range(a, b)),
  ]);
  if (organization.error) throw new Error(organization.error.message);
  if (members.error) throw new Error(members.error.message);

  const at = now.toISOString();
  const data = {
    app: "Workout Builder",
    exportedAt: at,
    gym: organization.data,
    members: members.data,
    invitations,
    programs,
    workouts,
    blocks,
    blockItems: items,
    blockResults: results,
    workoutMetrics: metrics,
    exercises,
    exerciseNames: aliases,
    paceOverrides: paces,
    auditLog: audit,
  };
  const flatExercises = exercises.map(({ exercise_patterns, exercise_muscles, exercise_equipment, ...e }) => ({
    ...e,
    patterns: exercise_patterns.map((p) => `${p.pattern_key} ${p.weight}`).join("; "),
    muscles: exercise_muscles.map((m) => `${m.muscle_key} (${m.role})`).join("; "),
    equipment_list: exercise_equipment.map((x) => x.equipment_key).join("; "),
  }));

  const csv = (rows: readonly Record<string, unknown>[], columns: string[]) => strToU8(toCsv(rows, rows.length ? undefined : columns));
  return zipSync(
    {
      "README.txt": strToU8(README(gym.name, at)),
      "data.json": strToU8(JSON.stringify(data, null, 2)),
      csv: {
        "programs.csv": csv(programs, ["id", "name", "color", "position", "archived_at", "guidelines"]),
        "workouts.csv": csv(workouts, ["id", "track_id", "kind", "date", "title", "status", "raw_text"]),
        "blocks.csv": csv(blocks, ["id", "workout_id", "position", "label", "format", "params"]),
        "block_items.csv": csv(items, ["id", "block_id", "position", "exercise_id", "raw_line"]),
        "block_results.csv": csv(results, ["id", "block_id", "session_label", "rounds_low", "rounds_high", "finish_low_s", "finish_high_s"]),
        "exercises.csv": csv(flatExercises, ["id", "name", "kind", "patterns", "muscles"]),
        "exercise_names.csv": csv(aliases, ["id", "alias_normalized", "exercise_id"]),
        "pace_overrides.csv": csv(paces, ["exercise_id"]),
        "members.csv": csv(members.data ?? [], ["user_id", "display_name", "email", "role", "joined_at"]),
        "invitations.csv": csv(invitations, ["id", "email", "role", "created_at", "expires_at", "accepted_at", "revoked_at"]),
        "audit_log.csv": csv(audit, ["id", "actor_id", "table_name", "row_id", "action", "diff", "at"]),
      },
    },
    { level: 6, mtime: now },
  );
}
