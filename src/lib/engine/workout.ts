// The calculation engine: a pure, deterministic function from a workout to
// the four lenses of calc spec §6. No database access, no clock, no I/O.

import { fatigueFactor } from "@/lib/engine/config";
import { countsAsHardSet, resolveBlockEffort } from "@/lib/engine/effort";
import {
  add,
  addTo,
  capAt,
  combine,
  divide,
  estimated,
  exact,
  floor,
  multiply,
  ratio,
  scale,
  sumKeys,
} from "@/lib/engine/measure";
import type {
  Block,
  BlockResult,
  ByPattern,
  EngineConfig,
  Exercise,
  Issue,
  Item,
  Lenses,
  Measure,
  Pace,
  Quantity,
  Ratios,
  Workout,
  WorkoutResult,
} from "@/lib/engine/types";
import { PATTERNS, PATTERN_REGION, type MeasureUnit, type PatternKey } from "@/lib/taxonomy";

type MatchedItem = Item & { exercise: Exercise };

/** Work in one performance of a line, in the line's unit. */
interface Amount {
  unit: MeasureUnit;
  value: Measure;
  /** Reps actually performed, both sides for 8/8 (used for time and volume load). */
  performed?: Measure;
}

export function emptyLenses(): Lenses {
  return {
    hardSets: { byPattern: {}, byMuscle: {} },
    volumeLoadKg: null,
    intensityZones: [],
    exposure: { reps: {}, distanceM: {}, timeSec: {}, repsByPlane: {} },
    monostructural: {},
    durationMin: null,
    sRpe: null,
  };
}

function secondsPerUnit(pace: Pace | null, unit: MeasureUnit): number | null {
  if (unit === "time_s") return 1;
  if (!pace) return null;
  if (unit === "reps") return pace.secPerRep ?? null;
  if (unit === "distance_m") return pace.secPerM ?? null;
  return pace.secPerCal ?? null;
}

/** Effective seconds per unit as a range: table pace × factors, widened by the pace band (calc spec §5). */
function paceRange(secPerUnit: number, factor: number, config: EngineConfig): Measure {
  const mid = secPerUnit * factor;
  return estimated(mid, mid * config.paceBand.fast, mid * config.paceBand.slow);
}

/** Calc spec §4.1 and §5: prescribed ranges and max-effort windows are estimates. */
function amountOf(quantity: Quantity, pace: Pace | null, factor: number, windowSec: number | null, config: EngineConfig): Amount | null {
  switch (quantity.type) {
    case "reps":
      return { unit: "reps", value: exact(quantity.value), performed: exact(quantity.value) };
    case "reps_range": {
      const reps = estimated((quantity.min + quantity.max) / 2, quantity.min, quantity.max);
      return { unit: "reps", value: reps, performed: reps };
    }
    case "reps_scheme": {
      const total = exact(quantity.scheme.reduce((a, b) => a + b, 0));
      return { unit: "reps", value: total, performed: total };
    }
    case "reps_per_side":
      // Unilateral rule (approved): 8/8 = 8 reps of exposure; 16 reps are performed.
      return { unit: "reps", value: exact(quantity.value), performed: exact(quantity.value * 2) };
    case "distance_m":
      return { unit: "distance_m", value: exact(quantity.value) };
    case "calories":
      return {
        unit: "calories",
        value: quantity.min === quantity.max ? exact(quantity.min) : estimated((quantity.min + quantity.max) / 2, quantity.min, quantity.max),
      };
    case "time_s":
      return { unit: "time_s", value: exact(quantity.value) };
    case "max_effort": {
      // Max effort in a window = window ÷ pace (calc spec §5).
      if (windowSec === null) return null;
      if (quantity.unit === "time_s") return { unit: "time_s", value: estimated(windowSec) };
      const secPerUnit = secondsPerUnit(pace, quantity.unit);
      if (secPerUnit === null) return null;
      const value = divide(exact(windowSec), paceRange(secPerUnit, factor, config));
      return { unit: quantity.unit, value, performed: quantity.unit === "reps" ? value : undefined };
    }
  }
}

/** Seconds one performance of a line takes. */
function timeOf(item: MatchedItem, amount: Amount, factor: number, windowSec: number | null, config: EngineConfig): Measure | null {
  if (item.quantity.type === "max_effort") return windowSec === null ? null : exact(windowSec);
  if (amount.unit === "time_s") return amount.value;
  const secPerUnit = secondsPerUnit(item.exercise.pace, amount.unit);
  if (secPerUnit === null) return null;
  return multiply(amount.performed ?? amount.value, paceRange(secPerUnit, factor, config));
}

function sum(measures: Measure[]): Measure | undefined {
  return measures.reduce<Measure | undefined>((total, m) => add(total, m), undefined);
}

/**
 * How often each of n lines is done when they take turns over `count`
 * intervals (tabata): the first lines get one more when the count does not
 * divide evenly.
 */
function rotation(count: number, n: number): (index: number) => Measure {
  return (index) => exact(Math.floor(count / n) + (index < count % n ? 1 : 0));
}

/** Alternating EMOM: number of slots in the rotation. Lines without a slot count as a slot each. */
function slotCount(items: Item[]): number {
  const slots = new Set(items.flatMap((item) => (item.slot ? [item.slot] : [])));
  return Math.max(1, slots.size + items.filter((item) => !item.slot).length);
}

export function computeBlock(block: Block, config: EngineConfig): BlockResult {
  const issues: Issue[] = [];
  const position = new Map(block.items.map((item, index) => [item, index]));
  const warn = (message: string, lines: Item[] = []) =>
    issues.push({ message, items: lines.map((item) => position.get(item) ?? -1).filter((i) => i >= 0) });
  const effort = resolveBlockEffort(block, config);

  const items = block.items.filter((item): item is MatchedItem => {
    if (item.exercise) return true;
    warn(`unmatched line skipped: "${item.rawLine ?? "?"}"`, [item]);
    return false;
  });
  const n = items.length;
  const alternating = block.format === "every" && block.params.alternating === true;
  const slots = alternating ? slotCount(block.items) : 1;

  // Time window for max-effort lines.
  let windowSec: number | null = null;
  if (block.format === "every") windowSec = block.params.interval_s;
  if (block.format === "intervals" || block.format === "tabata") windowSec = block.params.work_s;
  if (block.format === "amrap" && n === 1) windowSec = block.params.time_s;

  // Max-effort lines: fatigue by the block's total work time in interval-type
  // blocks (intervals: rounds × stations × work; EMOM: rounds × interval;
  // tabata: rounds × work), otherwise by their window.
  let maxEffortFatigueSec = windowSec;
  if (block.format === "intervals") maxEffortFatigueSec = block.params.rounds * block.params.stations * block.params.work_s;
  if (block.format === "every") maxEffortFatigueSec = block.params.rounds * slots * block.params.interval_s;
  if (block.format === "tabata") maxEffortFatigueSec = block.params.rounds * block.params.work_s;

  /** Per-line amount and time, given the fatigue factor of the piece. */
  const buildRows = (pieceFatigue: number) =>
    items.map((item) => {
      const paceEffort = item.paceEffort ?? effort.pace;
      const effortFactor = paceEffort ? config.paceEffortFactor[paceEffort] : 1;
      const fatigue = item.quantity.type === "max_effort" && maxEffortFatigueSec !== null
        ? fatigueFactor(maxEffortFatigueSec / 60, config)
        : pieceFatigue;
      const factor = effortFactor * fatigue;
      const amount = amountOf(item.quantity, item.exercise.pace, factor, windowSec, config);
      const time = amount ? timeOf(item, amount, factor, windowSec, config) : null;
      return { item, amount, time, loadEffort: item.loadEffort ?? effort.load };
    });
  const roundWork = (rows: ReturnType<typeof buildRows>) =>
    rows.every((r) => !r.amount || r.time) ? sum(rows.flatMap((r) => (r.time ? [r.time] : []))) : undefined;

  // Continuous pieces slow down with their length (calc spec §5).
  let rows = buildRows(block.format === "amrap" ? fatigueFactor(block.params.time_s / 60, config) : 1);

  for (const row of rows) {
    if (!row.amount) warn(`${row.item.exercise.name}: max effort needs a time window and a pace; not counted`, [row.item]);
  }
  const missingPace = rows.filter((r) => r.amount && !r.time);
  // With no readable line at all, the unmatched-line issues already say why.
  const needsPace = () => {
    if (missingPace.length === 0) return;
    warn(
      `no pace for ${missingPace.map((r) => r.item.exercise.name).join(", ")}; duration cannot be estimated`,
      missingPace.map((r) => r.item),
    );
  };
  const transitions = (count: number): Measure => (count > 0 ? estimated(count * config.transitionSec) : exact(0));

  // How many times each line is performed, and how long the block takes (calc spec §4.3, §5).
  let rounds: Measure | null = null;
  let durationSec: Measure | null = null;
  let capped = false;
  let performances: (index: number) => Measure | null = () => rounds;
  let completedSets: (index: number) => Measure | null = () => rounds;

  switch (block.format) {
    case "sets": {
      const { sets, rest_s } = block.params;
      rounds = exact(sets);
      const rest = rest_s !== undefined
        ? exact(rest_s)
        : estimated(block.intent === "strength" ? config.defaultRestSec.strength : config.defaultRestSec.other);
      const work = roundWork(rows);
      if (work) durationSec = scale(add(add(work, transitions(n - 1)), rest), sets);
      else needsPace();
      break;
    }
    case "every": {
      // Alternating: `rounds` rotations through the slots, one slot per
      // interval; each line is done once per rotation (calc spec §4.3).
      const { interval_s, rounds: count } = block.params;
      rounds = exact(count);
      durationSec = exact(interval_s * count * slots);
      break;
    }
    case "amrap": {
      durationSec = exact(block.params.time_s);
      const work = roundWork(rows);
      if (block.targetRounds) {
        rounds = estimated(block.targetRounds);
      } else if (n === 1 && items[0]?.quantity.type === "max_effort") {
        rounds = exact(1);
      } else if (work) {
        // Rounds = time ÷ (sum of paces + transitions) (calc spec §5).
        rounds = divide(exact(block.params.time_s), add(work, transitions(n)));
      } else {
        needsPace();
      }
      // Each completed round is one set (calc spec Lens 1).
      completedSets = () => (rounds ? floor(rounds) : null);
      break;
    }
    case "for_time": {
      const { rounds: count, time_cap_s } = block.params;
      rounds = exact(count);
      const finish = (work: Measure) => add(scale(work, count), transitions(count * n - 1));
      const baseWork = roundWork(rows);
      if (baseWork) {
        // Fatigue is chosen from the estimate before fatigue, then applied.
        rows = buildRows(fatigueFactor(finish(baseWork).mid / 60, config));
        const total = finish(roundWork(rows) ?? baseWork);
        // Sum of paces, capped at the time cap (calc spec §5).
        capped = time_cap_s !== undefined && total.mid > time_cap_s;
        durationSec = time_cap_s !== undefined ? capAt(total, time_cap_s) : total;
      } else {
        needsPace();
        if (time_cap_s !== undefined) durationSec = estimated(time_cap_s);
      }
      break;
    }
    case "intervals": {
      const { rounds: count, stations, work_s, rest_s, rest_between_rounds_s = 0 } = block.params;
      rounds = exact(count);
      durationSec = exact(count * stations * (work_s + rest_s) + (count - 1) * rest_between_rounds_s);
      break;
    }
    case "tabata": {
      const { rounds: count, work_s, rest_s } = block.params;
      rounds = exact(count);
      durationSec = exact(count * (work_s + rest_s));
      // Several exercises in one tabata alternate rounds: A, B, A, B, …
      performances = rotation(count, n);
      completedSets = rotation(count, n);
      break;
    }
  }

  const lenses = emptyLenses();

  rows.forEach((row, index) => {
    const performed = performances(index);
    if (!row.amount || !performed) return;
    const { item, amount } = row;
    const exercise = item.exercise;
    const total = multiply(amount.value, performed);

    // Lens 3: monostructural volume.
    if (exercise.kind === "monostructural") {
      if (!exercise.modality) return;
      const totals = (lenses.monostructural[exercise.modality] ??= {});
      if (amount.unit === "distance_m") totals.distanceM = add(totals.distanceM, total);
      if (amount.unit === "calories") totals.calories = add(totals.calories, total);
      if (amount.unit === "reps") totals.reps = add(totals.reps, total);
      if (row.time) totals.workSec = add(totals.workSec, multiply(row.time, performed));
      return;
    }

    const patterns = Object.entries(exercise.patterns) as [PatternKey, number][];

    // Lens 2: exposure, all blocks.
    const exposure =
      amount.unit === "reps" ? lenses.exposure.reps
      : amount.unit === "distance_m" ? lenses.exposure.distanceM
      : amount.unit === "time_s" ? lenses.exposure.timeSec
      : null;
    if (exposure) for (const [pattern, weight] of patterns) addTo(exposure, pattern, scale(total, weight));
    if (amount.unit === "reps" && exercise.plane) addTo(lenses.exposure.repsByPlane, exercise.plane, total);

    // Lens 1: hard sets, by load effort only (not block type).
    const sets = completedSets(index);
    if (sets && countsAsHardSet(row.loadEffort, config)) {
      for (const [pattern, weight] of patterns) addTo(lenses.hardSets.byPattern, pattern, scale(sets, weight));
      for (const muscle of exercise.primaryMuscles) addTo(lenses.hardSets.byMuscle, muscle, sets);
      for (const muscle of exercise.secondaryMuscles) addTo(lenses.hardSets.byMuscle, muscle, scale(sets, 0.5));
    }

    // Volume load: reps × kg per implement (first Rx) × implements (calc spec §9.6, §9.8).
    const firstRx = item.load?.type === "absolute_kg" ? item.load.rx[0] : undefined;
    if (firstRx !== undefined && amount.performed) {
      const implementCount = item.implementCount ?? exercise.implementCount;
      const volume = scale(multiply(amount.performed, performed), firstRx * implementCount);
      lenses.volumeLoadKg = add(lenses.volumeLoadKg ?? undefined, volume);
    }
    if (item.load?.type === "percent_1rm") {
      lenses.intensityZones.push({
        exerciseId: exercise.id,
        exercise: exercise.name,
        minPercent: item.load.min,
        maxPercent: item.load.max,
        sets: performed,
      });
    }
  });

  // Lens 4: planned session load = planned RPE × duration (min).
  lenses.durationMin = durationSec ? scale(durationSec, 1 / 60) : null;
  if (effort.plannedRpe === null) {
    warn("no pace or load effort; planned load not computed");
  } else if (lenses.durationMin) {
    const load = scale(lenses.durationMin, effort.plannedRpe);
    lenses.sRpe = { ...load, confidence: combine(load.confidence, effort.source === "default" ? "estimated" : "exact") };
  }

  return {
    ...lenses,
    label: block.label,
    plannedRpe: effort.plannedRpe,
    effortSource: effort.source,
    rounds,
    capped,
    issues,
    warnings: issues.map((issue) => issue.message),
  };
}

/** Adds `source` into `target` (durations and loads are handled by sumLenses). */
export function mergeLenses(target: Lenses, source: Lenses): void {
  for (const [k, v] of Object.entries(source.hardSets.byPattern)) addTo(target.hardSets.byPattern, k as PatternKey, v);
  for (const [k, v] of Object.entries(source.hardSets.byMuscle)) addTo(target.hardSets.byMuscle, k as keyof typeof target.hardSets.byMuscle, v);
  if (source.volumeLoadKg) target.volumeLoadKg = add(target.volumeLoadKg ?? undefined, source.volumeLoadKg);
  target.intensityZones.push(...source.intensityZones);
  for (const key of ["reps", "distanceM", "timeSec"] as const) {
    for (const [k, v] of Object.entries(source.exposure[key])) addTo(target.exposure[key], k as PatternKey, v);
  }
  for (const [k, v] of Object.entries(source.exposure.repsByPlane)) {
    addTo(target.exposure.repsByPlane, k as keyof typeof target.exposure.repsByPlane, v);
  }
  for (const [modality, totals] of Object.entries(source.monostructural)) {
    const into = (target.monostructural[modality as keyof typeof target.monostructural] ??= {});
    for (const field of ["distanceM", "calories", "reps", "workSec"] as const) {
      const value = totals[field];
      if (value) into[field] = add(into[field], value);
    }
  }
}

/** Sums lenses; duration and sRPE are null if any part is unknown. */
export function sumLenses(parts: Lenses[]): Lenses {
  const total = emptyLenses();
  for (const part of parts) mergeLenses(total, part);
  const durations = parts.map((p) => p.durationMin);
  const loads = parts.map((p) => p.sRpe);
  total.durationMin = durations.every((d): d is Measure => d !== null) ? (sum(durations) ?? exact(0)) : null;
  total.sRpe = loads.every((l): l is Measure => l !== null) ? (sum(loads) ?? exact(0)) : null;
  return total;
}

/** Balance ratios from exposure reps (calc spec Lens 2). */
export function computeRatios(reps: ByPattern): Ratios {
  const byRegion = (region: string) => sumKeys(reps, PATTERNS.filter((p) => PATTERN_REGION[p] === region));
  return {
    pushPull: ratio(sumKeys(reps, ["h_push", "v_push"]), sumKeys(reps, ["h_pull", "v_pull"])),
    kneeHip: ratio(sumKeys(reps, ["squat", "lunge"]), reps.hinge),
    upperLower: ratio(byRegion("upper"), byRegion("lower")),
  };
}

/** Block durations plus the rest between blocks (calc spec Lens 4). */
function sessionLength(workout: Workout, durationMin: Measure | null): Measure | null {
  if (!durationMin) return null;
  const restSec = workout.blocks.slice(0, -1).reduce((total, b) => total + (b.restAfterSec ?? 0), 0);
  return add(durationMin, exact(restSec / 60));
}

export function computeWorkout(workout: Workout, config: EngineConfig): WorkoutResult {
  const blocks = workout.blocks.map((block) => computeBlock(block, config));
  const totals = sumLenses(blocks);
  return {
    ...totals,
    sessionMin: sessionLength(workout, totals.durationMin),
    blocks,
    ratios: computeRatios(totals.exposure.reps),
    issues: blocks.flatMap((b, block) => b.issues.map((issue) => ({ ...issue, block }))),
    warnings: blocks.flatMap((b) => b.warnings.map((w) => `${b.label}: ${w}`)),
  };
}
