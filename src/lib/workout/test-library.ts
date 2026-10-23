// For tests: the whole core library as a gym loads it (aliases, generic
// words, approved paces), without a database. Also the core library with
// proposed additions, to measure what they would cover before they are
// approved (scripts/library-coverage.ts).

import type { Pace } from "@/lib/engine/types";
import { AMBIGUOUS_TERMS } from "@/lib/library/ambiguous-terms";
import { CORE_EXERCISES, type CoreExercise } from "@/lib/library/core-exercises";
import { aliasesOf, exerciseId, implementCountOf, musclesOf, patternsOf } from "@/lib/library/generate";
import { PACE_DEFAULTS } from "@/lib/library/pace-defaults";
import { normalizeAlias } from "@/lib/normalize-alias";
import type { MeasureUnit } from "@/lib/taxonomy";

import type { Library, LibraryExercise } from "./library";

/** Exercises, changes to core ones and generic words, as proposed in src/lib/library/proposed-additions.ts. */
export interface LibraryAdditions {
  exercises: { exercise: CoreExercise; pace: Pace | null }[];
  changes: { exercise: string; aliases?: string[]; equipment?: string[] }[];
  ambiguous: { term: string; candidates: string[] }[];
}

function libraryExercise(core: CoreExercise, pace: Pace | null, gymAliases: string[]): LibraryExercise {
  const { primary, secondary } = musclesOf(core);
  return {
    id: exerciseId(core),
    name: core.name,
    orgId: null,
    kind: core.kind,
    modality: core.kind === "monostructural" ? core.modality : null,
    plane: core.plane,
    defaultUnit: core.unit as MeasureUnit,
    unilateral: core.unilateral ?? false,
    implementCount: implementCountOf(core),
    patterns: Object.fromEntries(patternsOf(core)),
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    equipment: core.equipment ?? [],
    defaultPace: pace,
    gymPace: null,
    aliases: [
      ...gymAliases.map((text) => ({ id: `gym:${text}`, text, gym: true })),
      ...aliasesOf(core).map((text) => ({ id: `core:${text}`, text, gym: false })),
    ],
  };
}

export function coreLibrary(gym: { aliases?: Record<string, string> } = {}, additions?: LibraryAdditions): Library {
  const changed = (core: CoreExercise): CoreExercise => {
    const change = additions?.changes.filter((c) => c.exercise === core.name) ?? [];
    if (!change.length) return core;
    return {
      ...core,
      aliases: [...(core.aliases ?? []), ...change.flatMap((c) => c.aliases ?? [])],
      equipment: [...new Set([...(core.equipment ?? []), ...change.flatMap((c) => c.equipment ?? [])])],
    } as CoreExercise;
  };
  const cores = [
    ...CORE_EXERCISES.map((core) => ({ core: changed(core), pace: PACE_DEFAULTS[core.name] ?? null })),
    ...(additions?.exercises ?? []).map(({ exercise, pace }) => ({ core: exercise, pace })),
  ];
  const exercises = cores.map(({ core, pace }) =>
    libraryExercise(core, pace, Object.entries(gym.aliases ?? {}).filter(([, name]) => name === core.name).map(([text]) => normalizeAlias(text))),
  );
  const byName = new Map(exercises.map((e) => [e.name, e.id]));
  const ambiguous = Object.fromEntries(
    [...AMBIGUOUS_TERMS, ...(additions?.ambiguous ?? [])]
      .filter((t) => !gym.aliases?.[t.term])
      .map((t) => [t.term, t.candidates.map((name) => byName.get(name) ?? name)]),
  );
  return { exercises, ambiguous };
}

export const idOf = (name: string) => exerciseId(CORE_EXERCISES.find((e) => e.name === name) ?? { name } as CoreExercise);
