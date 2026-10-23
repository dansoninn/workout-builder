import { z } from "zod";

/**
 * The database's rules for what a workout may contain (SPEC-data-model §6),
 * as zod schemas, so the builder can say what is wrong while the coach types.
 * The database stays the guard: these mirror private.block_params_valid,
 * private.item_quantity_valid, private.item_load_valid and
 * private.pace_is_valid. src/lib/workout/rule-cases.ts holds one list of
 * cases that both Vitest (here) and pgTAP (in the database) check, so the two
 * cannot drift apart.
 */

const whole = (min: number) => z.number().int().min(min);
const positive = z.number().positive();

export const blockParamsSchemas = {
  // time_s: sets within a time box; then the count is optional (estimated from what fits).
  sets: z
    .strictObject({ sets: whole(1).optional(), rest_s: whole(0).optional(), time_s: whole(1).optional() })
    .refine((p) => p.sets !== undefined || p.time_s !== undefined, { error: "Give the sets, or the time they fit in" }),
  every: z.strictObject({ interval_s: whole(1), rounds: whole(1), alternating: z.boolean().optional() }),
  amrap: z.strictObject({ time_s: whole(1) }),
  for_time: z.strictObject({ rounds: whole(1), time_cap_s: whole(1).optional() }),
  intervals: z.strictObject({
    rounds: whole(1),
    work_s: whole(1),
    rest_s: whole(0),
    stations: whole(1),
    rest_between_rounds_s: whole(0).optional(),
    // Station by station: all rounds of one station, then the next, with rest between stations.
    by_station: z.boolean().optional(),
    rest_between_stations_s: whole(0).optional(),
  }),
  tabata: z.strictObject({ rounds: whole(1), work_s: z.literal(20), rest_s: z.literal(10) }),
} as const;

export type BlockFormat = keyof typeof blockParamsSchemas;
export const BLOCK_FORMATS = Object.keys(blockParamsSchemas) as BlockFormat[];

export function blockParamsValid(format: BlockFormat, params: unknown): boolean {
  return blockParamsSchemas[format].safeParse(params).success;
}

export const MEASURE_UNITS = ["reps", "distance_m", "calories", "time_s"] as const;

export const quantitySchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("reps"), value: whole(1) }),
  z.strictObject({ type: z.literal("reps_per_side"), value: whole(1) }),
  z
    .strictObject({ type: z.literal("reps_per_side_range"), min: whole(1), max: whole(1) })
    .refine((q) => q.min < q.max, { error: "The first number must be smaller" }),
  z
    .strictObject({ type: z.literal("distance_m_range"), min: positive, max: positive })
    .refine((q) => q.min < q.max, { error: "The first distance must be shorter" }),
  z
    .strictObject({ type: z.literal("time_s_range"), min: whole(1), max: whole(1) })
    .refine((q) => q.min < q.max, { error: "The first time must be shorter" }),
  z
    .strictObject({ type: z.literal("reps_range"), min: whole(1), max: whole(1) })
    .refine((q) => q.min < q.max, { error: "The first number must be smaller" }),
  z.strictObject({ type: z.literal("reps_scheme"), scheme: z.array(whole(1)).min(1) }),
  z
    .strictObject({ type: z.literal("distance_m"), value: positive, rx: z.array(positive).min(2).max(4).optional() })
    .refine((q) => !q.rx || q.rx[0] === q.value, { error: "The first amount is the one that counts" }),
  z
    .strictObject({ type: z.literal("calories"), min: whole(1), max: whole(1), rx: z.array(whole(1)).min(2).max(4).optional() })
    .refine((q) => q.min <= q.max, { error: "The first number must not be larger" })
    .refine((q) => !q.rx || (q.rx[0] === q.min && q.min === q.max), { error: "The first amount is the one that counts" }),
  z.strictObject({ type: z.literal("time_s"), value: whole(1) }),
  z.strictObject({ type: z.literal("max_effort"), unit: z.enum(MEASURE_UNITS) }),
]);

/** A cap on a line (calc spec §5): a time, or an amount in reps, metres or calories. */
export const capSchema = z.strictObject({ type: z.enum(MEASURE_UNITS), value: positive }).refine(
  (c) => c.type === "distance_m" || Number.isInteger(c.value),
  { error: "Whole seconds, reps or calories" },
);

/** Alternatives to a line's exercise, as written: up to ten, each a short name. */
export const alternativesSchema = z.array(z.string().trim().min(1).max(80)).max(10);

export const loadSchema = z.discriminatedUnion("type", [
  z
    .strictObject({ type: z.literal("percent_1rm"), min: positive, max: positive })
    .refine((l) => l.min <= l.max && l.max <= 100, { error: "Use a range up to 100%" }),
  z.strictObject({ type: z.literal("absolute_kg"), rx: z.array(positive).min(1) }),
  z.strictObject({ type: z.literal("bodyweight") }),
]);

export const paceSchema = z
  .strictObject({ sec_per_rep: positive.optional(), sec_per_m: positive.optional(), sec_per_cal: positive.optional() })
  .refine((p) => Object.keys(p).length > 0, { error: "Give at least one pace" });
