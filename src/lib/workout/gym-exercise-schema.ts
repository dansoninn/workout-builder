import { z } from "zod";

import { EQUIPMENT } from "@/lib/library/equipment";
import { MODALITIES, MUSCLES, PATTERNS, PLANES } from "@/lib/taxonomy";

import { paceSchema } from "./rules";

/** A gym's own exercise as the Exercises form sends it (the database checks the same rules). */
const enumOf = <T extends readonly string[]>(values: T) => z.enum(values as unknown as [T[number], ...T[number][]]);

export const gymExerciseSchema = z
  .strictObject({
    id: z.uuid().nullable(),
    name: z.string().trim().min(2, { error: "Enter a name" }).max(80),
    kind: z.enum(["movement", "monostructural"]),
    modality: enumOf(MODALITIES).nullable(),
    plane: enumOf(PLANES).nullable(),
    unilateral: z.boolean(),
    defaultUnit: z.enum(["reps", "distance_m", "calories", "time_s"]),
    implementCount: z.number().int().min(1).max(4),
    patterns: z.partialRecord(enumOf(PATTERNS), z.number().gt(0).max(1)),
    primaryMuscles: z.array(enumOf(MUSCLES)),
    secondaryMuscles: z.array(enumOf(MUSCLES)),
    equipment: z.array(z.enum(EQUIPMENT.map((e) => e.key) as [string, ...string[]])),
    pace: paceSchema.nullable(),
  })
  .superRefine((e, ctx) => {
    const total = Math.round(Object.values(e.patterns).reduce((a, b) => a + (b ?? 0), 0) * 100);
    if (e.kind === "monostructural") {
      if (!e.modality) ctx.addIssue({ code: "custom", path: ["modality"], message: "Choose what it is (run, row …)" });
      if (Object.keys(e.patterns).length > 0) ctx.addIssue({ code: "custom", path: ["patterns"], message: "Cardio has no movement patterns" });
    } else if (total !== 100) {
      ctx.addIssue({ code: "custom", path: ["patterns"], message: "Pattern weights must add up to 1.00" });
    }
    if (e.primaryMuscles.some((m) => e.secondaryMuscles.includes(m))) {
      ctx.addIssue({ code: "custom", path: ["secondaryMuscles"], message: "A muscle is primary or secondary, not both" });
    }
  });

export type GymExerciseInput = z.input<typeof gymExerciseSchema>;
