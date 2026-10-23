import { z } from "zod";

import { BLOCK_FORMATS } from "./rules";

/**
 * The shape of a draft as the browser sends it to the save action. The
 * content (amounts, loads, params) is then checked by draftProblems() and,
 * finally, by the database.
 */
const effort = z.enum(["easy", "moderate", "hard", "max"]).nullable();
const loadEffort = z.enum(["easy", "moderate", "hard"]).nullable();

export const draftSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(["scheduled", "template"]),
  date: z.iso.date().nullable(),
  trackId: z.uuid().nullable(),
  title: z.string().max(120),
  focus: z.string().max(60),
  status: z.enum(["draft", "published"]),
  blocks: z
    .array(
      z.strictObject({
        id: z.uuid(),
        title: z.string().max(120),
        intent: z.enum(["strength", "conditioning", "skill", "mobility"]),
        format: z.enum(BLOCK_FORMATS as [string, ...string[]]),
        params: z.record(z.string(), z.union([z.number(), z.boolean()]).optional()),
        paceEffort: effort,
        loadEffort,
        partner: z.enum(["split", "alternate", "each"]).nullable(),
        targetRounds: z.number().positive().nullable(),
        notes: z.string().max(2000),
        restAfterSec: z.number().int().min(0).nullable(),
        items: z
          .array(
            z.strictObject({
              id: z.uuid(),
              exerciseId: z.uuid().nullable(),
              quantity: z.string().max(60),
              load: z.string().max(60),
              implementCount: z.number().int().min(1).max(4).nullable(),
              paceEffort: effort,
              loadEffort,
              notes: z.string().max(500),
              slot: z.number().int().min(1).nullable(),
              rawLine: z.string().max(500).nullable().optional(),
            }),
          )
          .max(60),
      }),
    )
    .max(30),
  rawText: z.string().max(20000).nullable().optional(),
  parserVersion: z.number().int().positive().nullable().optional(),
});
