// The calculation engine: a pure, deterministic function from a workout to
// the four lenses of calc spec §6. No database access, no clock, no I/O.

import { countsAsHardSet, resolveBlockEffort } from "@/lib/engine/effort";
import { add, addTo, combine, estimated, exact, multiply, ratio, scale, sumKeys } from "@/lib/engine/measure";
import type {
  Block,
  BlockResult,
  ByPattern,
  EngineConfig,
  Exercise,
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

/** Calc spec §4.1 and §5: midpoints and max-effort windows are estimates. */
function amountOf(quantity: Quantity, pace: Pace | null, paceFactor: number, windowSec: number | null): Amount | null {
  switch (quantity.type) {
    case "reps":
      return { unit: "reps", value: exact(quantity.value), performed: exact(quantity.value) };
    case "reps_range": {
      const midpoint = estimated((quantity.min + quantity.max) / 2);
      return { unit: "reps", value: midpoint, performed: midpoint };
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
        value: quantity.min === quantity.max ? exact(quantity.min) : estimated((quantity.min + quantity.max) / 2),
      };
    case "time_s":
      return { unit: "time_s", value: exact(quantity.value) };
    case "max_effort": {
      // Max effort in a window = window ÷ pace (calc spec §5).
      if (windowSec === null) return null;
      const secPerUnit = secondsPerUnit(pace, quantity.unit);
      if (secPerUnit === null) return null;
      const value = estimated(windowSec / (secPerUnit * paceFactor));
      return { unit: quantity.unit, value, performed: quantity.unit === "reps" ? value : undefined };
    }
  }
}

/** Seconds one performance of a line takes. */
function timeOf(item: MatchedItem, amount: Amount, paceFactor: number, windowSec: number | null): Measure | null {
  if (item.quantity.type === "max_effort") return windowSec === null ? null : exact(windowSec);
  if (amount.unit === "time_s") return amount.value;
  const secPerUnit = secondsPerUnit(item.exercise.pace, amount.unit);
  if (secPerUnit === null) return null;
  const work = amount.performed ?? amount.value;
  return estimated(work.value * secPerUnit * paceFactor);
}

function sum(measures: Measure[]): Measure | undefined {
  return measures.reduce<Measure | undefined>((total, m) => add(total, m), undefined);
}

export function computeBlock(block: Block, config: EngineConfig): BlockResult {
  const warnings: string[] = [];
  const effort = resolveBlockEffort(block, config);

  const items = block.items.filter((item): item is MatchedItem => {
    if (item.exercise) return true;
    warnings.push(`unmatched line skipped: "${item.rawLine ?? "?"}"`);
    return false;
  });
  const n = items.length;

  // Time window for max-effort lines.
  let windowSec: number | null = null;
  if (block.format === "every") windowSec = block.params.interval_s;
  if (block.format === "intervals" || block.format === "tabata") windowSec = block.params.work_s;
  if (block.format === "amrap" && n === 1) windowSec = block.params.time_s;

  const rows = items.map((item) => {
    const paceEffort = item.paceEffort ?? effort.pace;
    const paceFactor = paceEffort ? config.paceEffortFactor[paceEffort] : 1;
    const amount = amountOf(item.quantity, item.exercise.pace, paceFactor, windowSec);
    if (!amount) warnings.push(`${item.exercise.name}: max effort needs a time window and a pace; not counted`);
    const time = amount ? timeOf(item, amount, paceFactor, windowSec) : null;
    return { item, amount, time, loadEffort: item.loadEffort ?? effort.load };
  });

  const missingPace = rows.filter((r) => r.amount && !r.time).map((r) => r.item.exercise.name);
  const workPerRound = missingPace.length === 0 ? sum(rows.flatMap((r) => (r.time ? [r.time] : []))) : undefined;
  const transitions = (count: number): Measure => (count > 0 ? estimated(count * config.transitionSec) : exact(0));
  const needsPace = () => warnings.push(`no pace for ${missingPace.join(", ")}; duration cannot be estimated`);

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
      if (workPerRound) durationSec = scale(add(add(workPerRound, transitions(n - 1)), rest), sets);
      else needsPace();
      break;
    }
    case "every": {
      const { interval_s, rounds: count } = block.params;
      rounds = exact(count);
      durationSec = exact(interval_s * count);
      break;
    }
    case "amrap": {
      durationSec = exact(block.params.time_s);
      if (block.targetRounds) {
        rounds = estimated(block.targetRounds);
      } else if (n === 1 && items[0]?.quantity.type === "max_effort") {
        rounds = exact(1);
      } else if (workPerRound) {
        // Rounds = time ÷ (sum of paces + transitions) (calc spec §5).
        const roundTime = add(workPerRound, transitions(n));
        rounds = estimated(block.params.time_s / roundTime.value);
      } else {
        needsPace();
      }
      // Each completed round is one set (calc spec Lens 1).
      completedSets = () => (rounds ? { value: Math.floor(rounds.value), confidence: rounds.confidence } : null);
      break;
    }
    case "for_time": {
      const { rounds: count, time_cap_s } = block.params;
      rounds = exact(count);
      if (workPerRound) {
        // Sum of paces, capped at the time cap (calc spec §5).
        const total = add(scale(workPerRound, count), transitions(count * n - 1));
        if (time_cap_s !== undefined && total.value > time_cap_s) {
          capped = true;
          durationSec = estimated(time_cap_s);
        } else {
          durationSec = total;
        }
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
      const share = (index: number) => exact(Math.floor(count / n) + (index < count % n ? 1 : 0));
      performances = share;
      completedSets = share;
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
    warnings.push("no pace or load effort; planned load not computed");
  } else if (lenses.durationMin) {
    lenses.sRpe = {
      value: lenses.durationMin.value * effort.plannedRpe,
      confidence: combine(lenses.durationMin.confidence, effort.source === "default" ? "estimated" : "exact"),
    };
  }

  return { ...lenses, label: block.label, plannedRpe: effort.plannedRpe, effortSource: effort.source, rounds, capped, warnings };
}

/** Adds `source` into `target` (durations and loads only when both are known). */
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

export function computeWorkout(workout: Workout, config: EngineConfig): WorkoutResult {
  const blocks = workout.blocks.map((block) => computeBlock(block, config));
  const totals = sumLenses(blocks);
  return {
    ...totals,
    blocks,
    ratios: computeRatios(totals.exposure.reps),
    warnings: blocks.flatMap((b) => b.warnings.map((w) => `${b.label}: ${w}`)),
  };
}
