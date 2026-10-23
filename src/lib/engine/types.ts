// Input and output types for the calculation engine (calc spec §4–§6).
// Inputs mirror the stored data (SPEC-data-model §5–§6) so the engine can be
// fed straight from the database; it never reads the database itself.

import type {
  EffortKey,
  EffortLevel,
  MeasureUnit,
  ModalityKey,
  MuscleKey,
  PatternKey,
  PlaneKey,
} from "@/lib/taxonomy";

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/** Every computed number says whether it is exact or an estimate (calc spec §1.3). */
export type Confidence = "exact" | "estimated";

/**
 * A computed number. Estimates are ranges (calc spec §5): `low` and `high`
 * come from the pace band and from prescribed ranges (8–10 reps); `mid` is
 * the central estimate. Exact values have low = mid = high.
 */
export interface Measure {
  low: number;
  mid: number;
  high: number;
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Working pace (exercises.pace_default / exercise_pace_overrides.pace). */
export interface Pace {
  secPerRep?: number;
  secPerM?: number;
  secPerCal?: number;
}

export interface Exercise {
  id: string;
  name: string;
  kind: "movement" | "monostructural";
  modality: ModalityKey | null;
  plane: PlaneKey | null;
  patterns: Partial<Record<PatternKey, number>>;
  primaryMuscles: MuscleKey[];
  secondaryMuscles: MuscleKey[];
  implementCount: number;
  /** Resolved pace: gym override if set, else the core default; null if none. */
  pace: Pace | null;
}

/** block_items.quantity — exactly one type (calc spec §4.1). */
export type Quantity =
  | { type: "reps"; value: number }
  | { type: "reps_range"; min: number; max: number }
  | { type: "reps_scheme"; scheme: number[] }
  | { type: "reps_per_side"; value: number }
  /** 8-10/8-10: a range each side (an estimate, like 8-10). */
  | { type: "reps_per_side_range"; min: number; max: number }
  /** rx: men/women amounts ("400/300 m"); value is the first, which every calculation uses (calc spec decision 17). */
  | { type: "distance_m"; value: number; rx?: number[] }
  /** rx: men/women amounts ("15/12 cal"); min = max = the first, which every calculation uses. */
  | { type: "calories"; min: number; max: number; rx?: number[] }
  /** 800-1000 m: a range of distance, an estimate. */
  | { type: "distance_m_range"; min: number; max: number }
  | { type: "time_s"; value: number }
  /** 20-30 s: a range of time, an estimate. */
  | { type: "time_s_range"; min: number; max: number }
  | { type: "max_effort"; unit: MeasureUnit };

/** block_items.load — optional (calc spec §4.2). */
export type Load =
  | { type: "percent_1rm"; min: number; max: number }
  | { type: "absolute_kg"; rx: number[] }
  | { type: "bodyweight" };

export interface Item {
  /** null = not matched to an exercise yet; skipped with a warning. */
  exercise: Exercise | null;
  rawLine?: string;
  quantity: Quantity;
  load?: Load | null;
  paceEffort?: EffortKey | null;
  loadEffort?: EffortKey | null;
  /** Overrides exercise.implementCount for this line. */
  implementCount?: number | null;
  /**
   * Alternating EMOM only: the slot (interval of the rotation) this line
   * belongs to, 1, 2, …; several lines can share one (block_items.slot).
   */
  slot?: number | null;
  /** One side only ("Right arm"): its reps count half in exposure and hard sets, like one side of 8/8 (calc spec §5). */
  side?: "left" | "right" | null;
  /** "(max 40 sec)", "(max 10 reps)": the line stops there (calc spec §5). */
  cap?: { type: MeasureUnit; value: number } | null;
}

export type BlockIntent = "strength" | "conditioning" | "skill" | "mobility";

/**
 * A partner block (calc spec §4.5, decided 2026-10-23); numbers are per
 * athlete. `split`: the team shares the written amounts at will. `alternate`:
 * "I go, you go", one works while the other rests. `each`: "I go, you go" with
 * amounts written for each athlete ("five rounds each").
 */
export type PartnerMode = "split" | "alternate" | "each";

interface BlockBase {
  label: string;
  intent: BlockIntent;
  /** A partner block, and how the partners share the work; null or absent = alone. */
  partner?: PartnerMode | null;
  /** False: in the session's length but not in planned load or the lenses (stretching; calc spec §5). */
  countsInLoad?: boolean;
  paceEffort?: EffortKey | null;
  loadEffort?: EffortKey | null;
  /** Coach's AMRAP estimate; overrides the pace estimate. */
  targetRounds?: number | null;
  /**
   * Rest after this block, before the next (blocks.rest_after_s). Counts in the
   * session length, never in planned load (approved 2026-10-21).
   */
  restAfterSec?: number | null;
  items: Item[];
}

/** blocks.format + blocks.params (SPEC-data-model §6). */
export type Block = BlockBase &
  (
    /** time_s: sets within a time box ("in 12-15 min find a heavy 3"); sets are then optional (estimated). */
    | { format: "sets"; params: { sets?: number; rest_s?: number; time_s?: number } }
    | {
        format: "every";
        /**
         * alternating: ordered slots, one per interval, each with one or more
         * lines (Item.slot), taking turns for `rounds` intervals; the last
         * rotation may be partial.
         */
        params: { interval_s: number; rounds: number; alternating?: boolean };
      }
    | { format: "amrap"; params: { time_s: number } }
    | { format: "for_time"; params: { rounds: number; time_cap_s?: number } }
    | {
        format: "intervals";
        /** by_station: all rounds of a station, then the next, with rest_between_stations_s between them. */
        params: {
          rounds: number;
          work_s: number;
          rest_s: number;
          rest_between_rounds_s?: number;
          stations: number;
          by_station?: boolean;
          rest_between_stations_s?: number;
        };
      }
    | { format: "tabata"; params: { rounds: number; work_s: number; rest_s: number } }
  );

export type BlockFormat = Block["format"];

export interface Workout {
  blocks: Block[];
}

/** Rules that are not per exercise (calc spec §5). Approved values: ENGINE_CONFIG. */
export interface EngineConfig {
  effortLevels: Record<EffortKey, EffortLevel>;
  /** Seconds between exercises within a round or chipper. */
  transitionSec: number;
  /** Rest between sets when a `sets` block gives none. */
  defaultRestSec: { strength: number; other: number };
  /** Time-per-rep multiplier by pace effort (1 = the table's Hard pace). */
  paceEffortFactor: Record<EffortKey, number>;
  /**
   * Fatigue in continuous pieces (AMRAP, For Time, max-effort windows), by the
   * piece's estimated duration: under mediumFromMin ×1, up to longAboveMin
   * ×medium, longer ×long. In intervals, EMOM and tabata blocks, max-effort
   * windows use the block's total work time.
   */
  fatigue: { mediumFromMin: number; longAboveMin: number; medium: number; long: number };
  /** Pace band for estimate ranges: fast = pace × fast, slow = pace × slow. */
  paceBand: { fast: number; slow: number };
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type ByPattern = Partial<Record<PatternKey, Measure>>;
export type ByMuscle = Partial<Record<MuscleKey, Measure>>;
export type ByPlane = Partial<Record<PlaneKey, Measure>>;

export interface ModalityTotals {
  distanceM?: Measure;
  calories?: Measure;
  reps?: Measure;
  workSec?: Measure;
}

export interface IntensityZone {
  exerciseId: string;
  exercise: string;
  minPercent: number;
  maxPercent: number;
  sets: Measure;
}

/** The four lenses (calc spec §6), for a block or summed over a session. */
export interface Lenses {
  /** Lens 1: hard sets (load effort Moderate or Hard) by pattern and muscle. */
  hardSets: { byPattern: ByPattern; byMuscle: ByMuscle };
  volumeLoadKg: Measure | null;
  intensityZones: IntensityZone[];
  /** Lens 2: pattern exposure from all blocks. Reps feed the balance ratios. */
  exposure: { reps: ByPattern; distanceM: ByPattern; timeSec: ByPattern; repsByPlane: ByPlane };
  /** Lens 3: monostructural volume per modality. */
  monostructural: Partial<Record<ModalityKey, ModalityTotals>>;
  /** Lens 4: planned session load. */
  durationMin: Measure | null;
  sRpe: Measure | null;
}

export type EffortSource = "coach" | "default" | "none";

/** Something the coach should know, and the lines it is about (indexes into Block.items; empty = the whole block). */
export interface Issue {
  message: string;
  items: number[];
}

export interface BlockResult extends Lenses {
  label: string;
  /** Planned RPE = the higher of pace and load effort (calc spec §4.4). */
  plannedRpe: number | null;
  effortSource: EffortSource;
  /** Times each item is performed: sets, intervals or rounds (AMRAP: estimated, may be fractional). */
  rounds: Measure | null;
  /**
   * AMRAP: each line of one round in order, as the units it asks for (reps,
   * calories, metres, seconds; both sides of 8/8) and its estimated seconds
   * (middle estimate); null when a line has no pace. Used to turn a logged
   * "7 + 12" into rounds (calc spec decision 16).
   */
  roundLines?: { units: number; seconds: number }[] | null;
  /** For time: the estimated finish hit the time cap. */
  capped: boolean;
  issues: Issue[];
  /** The issues' messages. */
  warnings: string[];
}

export interface Ratios {
  /** (h_push + v_push) : (h_pull + v_pull) exposure reps. */
  pushPull: Measure | null;
  /** (squat + lunge) : hinge exposure reps. */
  kneeHip: Measure | null;
  /** Upper-region : lower-region exposure reps. */
  upperLower: Measure | null;
}

export interface WorkoutResult extends Lenses {
  /**
   * Session length for the calendar: block durations plus the rest between
   * blocks (rest after the last block is not counted). Planned load uses the
   * block durations only (`durationMin`). Null if a block's duration is unknown.
   */
  sessionMin: Measure | null;
  blocks: BlockResult[];
  ratios: Ratios;
  /** Every block's issues, with the block's index. */
  issues: (Issue & { block: number })[];
  /** "A: message" for every issue. */
  warnings: string[];
}
