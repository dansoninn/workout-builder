import type { Pace } from "@/lib/engine/types";
import type { ModalityKey } from "@/lib/taxonomy";

import { durationText, parseDuration } from "./fields";

/**
 * Paces in coaching terms, as in docs/pace-defaults.md: seconds per rep or
 * calorie, and distance as time per 500 m (row, ski), per km (run), per
 * 100 m (swim) or per 1,000 m (bike). Stored as sec_per_rep / sec_per_m /
 * sec_per_cal.
 */
export type PaceField = { key: keyof Pace; label: string; per: number; clock: boolean };

export function paceFields(exercise: { kind: "movement" | "monostructural"; modality: ModalityKey | null; defaultUnit: string }): PaceField[] {
  if (exercise.kind === "monostructural") {
    const distance: Record<string, [string, number]> = {
      run: ["/km", 1000],
      row: ["/500 m", 500],
      ski: ["/500 m", 500],
      swim: ["/100 m", 100],
      bike: ["/1,000 m", 1000],
    };
    const [label, per] = (exercise.modality && distance[exercise.modality]) || ["s/m", 1];
    const fields: PaceField[] = [{ key: "secPerM", label, per, clock: per > 1 }];
    if (exercise.modality === "row" || exercise.modality === "ski" || exercise.modality === "bike") {
      fields.push({ key: "secPerCal", label: "s/cal", per: 1, clock: false });
    }
    return exercise.modality === "bike" ? fields.reverse() : fields;
  }
  if (exercise.defaultUnit === "distance_m") return [{ key: "secPerM", label: "s/m", per: 1, clock: false }];
  if (exercise.defaultUnit === "calories") return [{ key: "secPerCal", label: "s/cal", per: 1, clock: false }];
  if (exercise.defaultUnit === "time_s") return [];
  return [{ key: "secPerRep", label: "s/rep", per: 1, clock: false }];
}

const one = (n: number) => (Math.round(n * 10) / 10).toString();

/** "2:14" for a row's 0.268 s/m (per 500 m), "3" for 3 s/rep. */
export function paceValueText(pace: Pace | null, field: PaceField): string {
  const value = pace?.[field.key];
  if (value === undefined) return "";
  const total = value * field.per;
  return field.clock ? durationText(Math.round(total)) : one(total);
}

/** Reads what the coach typed back into seconds per rep / metre / calorie; null if unreadable. */
export function parsePaceValue(text: string, field: PaceField): number | null {
  const t = text.trim();
  if (!t) return null;
  const seconds = field.clock ? parseDuration(t, "min") : Number(t.replace(",", "."));
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds / field.per;
}

/** The whole pace as one line: "2:14 /500 m · 4.5 s/cal". */
export function paceText(pace: Pace | null, fields: PaceField[]): string {
  if (!pace) return "—";
  const parts = fields.flatMap((f) => {
    const text = paceValueText(pace, f);
    return text ? [`${text} ${f.label}`] : [];
  });
  return parts.join(" · ") || "—";
}
