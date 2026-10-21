import type { Exercise, Pace } from "@/lib/engine/types";
import { normalizeAlias } from "@/lib/normalize-alias";
import type { MeasureUnit, ModalityKey, MuscleKey, PatternKey, PlaneKey } from "@/lib/taxonomy";

/**
 * The exercises a gym can program: the core library plus its own, with
 * aliases and its paces (an override replaces the default). Loaded once per
 * builder page (src/lib/workout/load-library.ts) and searched in the browser,
 * so finding an exercise never waits on the network.
 */
export interface LibraryExercise {
  id: string;
  name: string;
  /** null = core library. */
  orgId: string | null;
  kind: "movement" | "monostructural";
  modality: ModalityKey | null;
  plane: PlaneKey | null;
  defaultUnit: MeasureUnit;
  unilateral: boolean;
  implementCount: number;
  patterns: Partial<Record<PatternKey, number>>;
  primaryMuscles: MuscleKey[];
  secondaryMuscles: MuscleKey[];
  equipment: string[];
  defaultPace: Pace | null;
  gymPace: Pace | null;
  /** Normalised aliases: the gym's first, then core. */
  aliases: { text: string; gym: boolean }[];
}

export interface Library {
  exercises: LibraryExercise[];
  /** Generic words ("squat") and the core exercises they could mean, most likely first. */
  ambiguous: Record<string, string[]>;
}

/** The engine's view of an exercise: the gym's pace if it has one. */
export function toEngineExercise(e: LibraryExercise): Exercise {
  return {
    id: e.id,
    name: e.name,
    kind: e.kind,
    modality: e.modality,
    plane: e.plane,
    patterns: e.patterns,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    implementCount: e.implementCount,
    pace: e.gymPace ?? e.defaultPace,
  };
}

export type SearchResult = {
  exercise: LibraryExercise;
  /** The alias that matched, when it is not the name. */
  via: string | null;
};

export interface SearchResults {
  results: SearchResult[];
  /** The query is a generic word: these are the exercises it could mean. */
  ambiguous: LibraryExercise[];
}

/**
 * Finds exercises for what the coach typed. Exact gym alias first, then exact
 * core alias or name, then names and aliases starting with the query, then
 * containing it. A generic word ("squat") also lists the exercises it could
 * mean, so the coach picks one instead of the app guessing.
 */
export function searchExercises(library: Library, query: string, limit = 8): SearchResults {
  const q = normalizeAlias(query);
  if (!q) return { results: [], ambiguous: [] };

  const byId = new Map(library.exercises.map((e) => [e.id, e]));
  const ambiguous = (library.ambiguous[q] ?? []).flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));

  const scored: { result: SearchResult; score: number }[] = [];
  for (const exercise of library.exercises) {
    const name = normalizeAlias(exercise.name);
    let best: { score: number; via: string | null } | null = null;
    const consider = (text: string, via: string | null, gym: boolean) => {
      let score = 0;
      if (text === q) score = gym ? 100 : 90;
      else if (text.startsWith(q)) score = 70;
      else if (text.split(" ").some((word) => word.startsWith(q))) score = 60;
      else if (text.includes(q)) score = 40;
      if (score && (!best || score > best.score)) best = { score, via };
    };
    consider(name, null, exercise.orgId !== null);
    for (const alias of exercise.aliases) consider(alias.text, alias.text, alias.gym);
    if (best) {
      const { score, via } = best;
      // Gym exercises first among equals; then shorter names (closer matches).
      scored.push({ result: { exercise, via }, score: score + (exercise.orgId ? 5 : 0) - name.length / 100 });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.result.exercise.name.localeCompare(b.result.exercise.name));
  return { results: scored.slice(0, limit).map((s) => s.result), ambiguous };
}
