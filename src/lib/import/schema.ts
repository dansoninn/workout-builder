import { z } from "zod";

import type { ImportDocument } from "./document";
import type { Layout } from "./layout";
import type { ImportChoices } from "./plan";
import type { ImportAnswers } from "./review";

/*
 * What an import keeps between visits (import_batches), checked whenever it
 * comes from the browser and when it is read back: Server Actions are public
 * endpoints, and a stored import outlives the code that wrote it.
 */

/** The most text an import may hold; Vercel takes requests up to 4.5 MB. */
export const MAX_DOCUMENT_CHARS = 4_000_000;

const cell = z.string().max(20_000);
export const documentSchema: z.ZodType<ImportDocument> = z.union([
  z.object({
    kind: z.literal("grid"),
    name: z.string().max(200),
    sheets: z.array(z.object({ name: z.string().max(200), rows: z.array(z.array(cell).max(200)).max(5000) })).max(60),
  }),
  z.object({ kind: z.literal("text"), name: z.string().max(200), text: z.string().max(MAX_DOCUMENT_CHARS) }),
]);

const column = z.number().int().min(0).max(200);
const isoDate = z.iso.date();
export const layoutSchema: z.ZodType<Layout> = z.union([
  z.object({
    kind: z.literal("grid"),
    sheets: z.array(z.string().max(200)).max(60),
    headerRow: z.number().int().min(-1).max(5000),
    dates: z.union([
      z.object({ from: z.literal("day-of-month"), column, year: z.number().int().min(1990).max(2100), months: z.record(z.string().max(200), z.number().int().min(1).max(12).nullable()) }),
      z.object({ from: z.literal("date"), column, year: z.number().int().min(1990).max(2100), dayFirst: z.boolean() }),
    ]),
    weekdayColumn: column.nullable(),
    sharedFocusColumn: column.nullable(),
    programs: z
      .array(
        z.object({
          name: z.string().max(200),
          headingColumn: column.nullable(),
          workoutColumns: z.array(column).min(1).max(10),
          titleColumn: column.nullable(),
          focusColumn: column.nullable(),
          where: z.object({ column, value: z.string().max(200) }).nullable(),
        }),
      )
      .min(1)
      .max(50),
  }),
  z.object({
    kind: z.literal("text"),
    days: z.union([
      z.object({ by: z.literal("date"), year: z.number().int().min(1990).max(2100), dayFirst: z.boolean() }),
      z.object({ by: z.literal("weekday"), firstMonday: isoDate }),
      z.object({ by: z.literal("week-day"), firstMonday: isoDate, weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7) }),
    ]),
  }),
]);

const key = z.string().max(300);
export const answersSchema: z.ZodType<ImportAnswers> = z.object({
  words: z.record(z.string().max(120), z.uuid()),
  labels: z.record(key, z.object({ focus: z.string().trim().max(40).nullable(), closed: z.string().trim().max(80).nullable() })),
  headings: z.record(z.string().max(200), z.enum(["strength", "conditioning", "skill", "mobility"])),
  edits: z.record(key, z.string().max(20_000)),
  skip: z.array(key).max(5000),
});

export const choicesSchema: z.ZodType<ImportChoices> = z.object({
  conflicts: z.enum(["skip", "replace", "add"]),
  publish: z.boolean(),
  templates: z.array(key).max(200),
  remember: z.array(z.string().max(120)).max(2000),
  keepPersonal: z.boolean(),
});
