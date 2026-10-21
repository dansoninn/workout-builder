import "server-only";

import { paceFromJson } from "@/lib/engine/pace";
import { createClient } from "@/lib/supabase/server";
import type { MeasureUnit, ModalityKey, MuscleKey, PatternKey, PlaneKey } from "@/lib/taxonomy";

import type { Library, LibraryExercise } from "./library";

/** The core library plus the gym's own exercises, aliases and paces (RLS keeps other gyms out). */
export async function loadLibrary(orgId: string): Promise<Library> {
  const supabase = await createClient();
  const [exercises, patterns, muscles, equipment, aliases, ambiguous, paces] = await Promise.all([
    supabase
      .from("exercises")
      .select("id, name, org_id, kind, modality, plane, default_unit, unilateral, implement_count, pace_default")
      .is("deleted_at", null)
      .neq("status", "archived")
      .or(`org_id.is.null,org_id.eq.${orgId}`)
      .order("name"),
    supabase.from("exercise_patterns").select("exercise_id, pattern_key, weight"),
    supabase.from("exercise_muscles").select("exercise_id, muscle_key, role"),
    supabase.from("exercise_equipment").select("exercise_id, equipment_key"),
    supabase.from("exercise_aliases").select("id, exercise_id, alias_normalized, org_id").or(`org_id.is.null,org_id.eq.${orgId}`),
    supabase.from("ambiguous_exercise_terms").select("term, exercise_id, position").order("position"),
    supabase.from("exercise_pace_overrides").select("exercise_id, pace").eq("org_id", orgId),
  ]);
  for (const result of [exercises, patterns, muscles, equipment, aliases, ambiguous, paces]) {
    if (result.error) throw result.error;
  }

  const byExercise = new Map<string, LibraryExercise>();
  for (const e of exercises.data ?? []) {
    byExercise.set(e.id, {
      id: e.id,
      name: e.name,
      orgId: e.org_id,
      kind: e.kind,
      modality: e.modality as ModalityKey | null,
      plane: e.plane as PlaneKey | null,
      defaultUnit: e.default_unit as MeasureUnit,
      unilateral: e.unilateral,
      implementCount: e.implement_count,
      patterns: {},
      primaryMuscles: [],
      secondaryMuscles: [],
      equipment: [],
      defaultPace: paceFromJson(e.pace_default),
      gymPace: null,
      aliases: [],
    });
  }
  for (const p of patterns.data ?? []) {
    const e = byExercise.get(p.exercise_id);
    if (e) e.patterns[p.pattern_key as PatternKey] = Number(p.weight);
  }
  for (const m of muscles.data ?? []) {
    const e = byExercise.get(m.exercise_id);
    if (!e) continue;
    (m.role === "primary" ? e.primaryMuscles : e.secondaryMuscles).push(m.muscle_key as MuscleKey);
  }
  for (const q of equipment.data ?? []) byExercise.get(q.exercise_id)?.equipment.push(q.equipment_key);
  for (const a of aliases.data ?? []) {
    byExercise.get(a.exercise_id)?.aliases.push({ id: a.id, text: a.alias_normalized, gym: a.org_id !== null });
  }
  for (const e of byExercise.values()) e.aliases.sort((a, b) => Number(b.gym) - Number(a.gym));
  for (const p of paces.data ?? []) {
    const e = byExercise.get(p.exercise_id);
    if (e) e.gymPace = paceFromJson(p.pace);
  }

  const terms: Record<string, string[]> = {};
  for (const t of ambiguous.data ?? []) (terms[t.term] ??= []).push(t.exercise_id);

  return { exercises: [...byExercise.values()], ambiguous: terms };
}
