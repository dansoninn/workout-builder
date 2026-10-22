// For tests: the whole core library as a gym loads it (aliases, generic
// words, approved paces), without a database.

import { coreExercise } from "@/lib/engine/fixtures/worked-wods";
import { AMBIGUOUS_TERMS } from "@/lib/library/ambiguous-terms";
import { CORE_EXERCISES } from "@/lib/library/core-exercises";
import { aliasesOf, exerciseByName, exerciseId } from "@/lib/library/generate";
import type { MeasureUnit } from "@/lib/taxonomy";

import type { Library, LibraryExercise } from "./library";

export function coreLibrary(gym: { aliases?: Record<string, string> } = {}): Library {
  const exercises: LibraryExercise[] = CORE_EXERCISES.map((core) => {
    const e = coreExercise(core.name);
    const gymAliases = Object.entries(gym.aliases ?? {}).filter(([, name]) => name === core.name);
    return {
      ...e,
      orgId: null,
      defaultUnit: core.unit as MeasureUnit,
      unilateral: core.unilateral ?? false,
      equipment: core.equipment ?? [],
      defaultPace: e.pace,
      gymPace: null,
      aliases: [
        ...gymAliases.map(([text]) => ({ id: `gym:${text}`, text, gym: true })),
        ...aliasesOf(core).map((text) => ({ id: `core:${text}`, text, gym: false })),
      ],
    };
  });
  const ambiguous = Object.fromEntries(
    AMBIGUOUS_TERMS.filter((t) => !gym.aliases?.[t.term]).map((t) => [t.term, t.candidates.map((name) => exerciseId(exerciseByName(name)))]),
  );
  return { exercises, ambiguous };
}

export const idOf = (name: string) => exerciseId(exerciseByName(name));
