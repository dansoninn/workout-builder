"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { ReadOnlyNote, SettingsSection } from "@/components/app/settings";
import { PatternTag } from "@/components/design/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_GUIDELINES, type Guidelines, guidelinesSchema, RATIO_LABELS } from "@/lib/analytics/guidelines";
import { PATTERNS, type PatternKey } from "@/lib/taxonomy";

import { setGuidelines, setProgramGuidelines } from "./actions";

type RatioKey = keyof typeof RATIO_LABELS;
type Form = {
  hardSets: Record<PatternKey, string>;
  ratios: Record<RatioKey, { min: string; max: string }>;
  monotonyMax: string;
  weekIncreaseMaxPercent: string;
};

const text = (n: number | undefined) => (n === undefined ? "" : String(n));
const RATIOS = Object.keys(RATIO_LABELS) as RatioKey[];

function toForm(g: Guidelines): Form {
  return {
    hardSets: Object.fromEntries(PATTERNS.map((p) => [p, text(g.hardSetsPerWeek?.[p])])) as Record<PatternKey, string>,
    ratios: Object.fromEntries(RATIOS.map((r) => [r, { min: text(g[r]?.min), max: text(g[r]?.max) }])) as Form["ratios"],
    monotonyMax: text(g.monotonyMax),
    weekIncreaseMaxPercent: text(g.weekIncreaseMaxPercent),
  };
}

/** Empty fields are no guideline; "1,5" is 1.5. */
function fromForm(f: Form): unknown {
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s.trim().replace(",", ".")));
  const hardSets = Object.fromEntries(PATTERNS.flatMap((p) => (num(f.hardSets[p]) === undefined ? [] : [[p, num(f.hardSets[p])]])));
  const result: Record<string, unknown> = {};
  if (Object.keys(hardSets).length) result.hardSetsPerWeek = hardSets;
  for (const r of RATIOS) {
    const min = num(f.ratios[r].min);
    const max = num(f.ratios[r].max);
    if (min !== undefined || max !== undefined) result[r] = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
  }
  if (num(f.monotonyMax) !== undefined) result.monotonyMax = num(f.monotonyMax);
  if (num(f.weekIncreaseMaxPercent) !== undefined) result.weekIncreaseMaxPercent = num(f.weekIncreaseMaxPercent);
  return result;
}

/**
 * Guidelines (calc spec §6): the gym's own, not scientific limits. Analytics
 * warns when a period is outside them; an empty field never warns. The gym's
 * are every program's default, set by the owner; a program can have its own
 * (decision 5, 2026-10-23), set by owners and head coaches.
 */
export function GuidelinesForm({
  slug,
  program,
  initial,
  gymGuidelines,
  canEdit,
}: {
  slug: string;
  /** null: the gym's guidelines. */
  program: { id: string; name: string; own: boolean } | null;
  /** The guidelines in force: the gym's, or the program's (its own, else the gym's). */
  initial: Guidelines;
  gymGuidelines: Guidelines;
  canEdit: boolean;
}) {
  const id = useId();
  const [form, setForm] = useState(() => toForm(initial));
  const [own, setOwn] = useState(program?.own ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = canEdit && own;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const value = own ? fromForm(form) : null;
    if (value !== null) {
      const parsed = guidelinesSchema.safeParse(value);
      if (!parsed.success) return void setError(parsed.error.issues[0]?.message ?? "Check the numbers.");
    }
    setError(null);
    startTransition(async () => {
      const result = program ? await setProgramGuidelines(slug, program.id, value) : await setGuidelines(slug, value);
      if (!result.ok) return void setError(result.error);
      toast.success(program && !own ? `${program.name} uses the gym's guidelines` : "Guidelines saved");
    });
  };

  const field = (label: React.ReactNode, value: string, onChange: (v: string) => void, key: string, suffix?: string) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${key}`} className="text-xs text-muted-foreground">
        {label}
      </label>
      <span className="flex items-center gap-1.5">
        <Input id={`${id}-${key}`} inputMode="decimal" value={value} placeholder="—" disabled={!editable} onChange={(e) => onChange(e.target.value)} className="w-20 tabular" />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </div>
  );

  return (
    <form onSubmit={save} className="grid gap-10" noValidate>
      <SettingsSection
        title={program ? program.name : "Gym guidelines"}
        description={
          program
            ? "A program uses the gym's guidelines unless it has its own. Analytics checks each program against its own guidelines, also when programs are shown together."
            : "Your gym's own guidelines for its programming, not scientific limits. Analytics warns when a period is outside them. Every program uses these unless it has its own. A new gym starts with the defaults; change them to fit your members, or leave a field empty for no warning."
        }
        action={
          canEdit && (
            <div className="flex gap-2">
              {own && (
                <Button type="button" variant="outline" onClick={() => setForm(toForm(DEFAULT_GUIDELINES))} disabled={pending}>
                  Back to the defaults
                </Button>
              )}
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save guidelines"}</Button>
            </div>
          )
        }
      >
        {program && (
          <fieldset className="grid gap-1.5" disabled={!canEdit}>
            <legend className="mb-1 text-sm font-medium">{program.name} uses</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${id}-source`}
                checked={!own}
                onChange={() => {
                  setOwn(false);
                  setForm(toForm(gymGuidelines));
                }}
                className="size-4 accent-primary"
              />
              The gym&apos;s guidelines
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name={`${id}-source`} checked={own} onChange={() => setOwn(true)} className="size-4 accent-primary" />
              Its own guidelines
            </label>
          </fieldset>
        )}
        {!canEdit && (
          <ReadOnlyNote>{program ? "Owners and head coaches set a program's guidelines." : "The owner sets the gym's guidelines."}</ReadOnlyNote>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </SettingsSection>

      <SettingsSection title="Strength: hard sets per week" description="At least this many hard sets (Load Moderate or Hard) per movement pattern every 7 days; over 14 days, twice as many.">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {PATTERNS.map((p) =>
            field(<PatternTag pattern={p} />, form.hardSets[p], (v) => setForm((f) => ({ ...f, hardSets: { ...f.hardSets, [p]: v } })), `sets-${p}`, "a week"),
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Balance" description="Exposure reps (every rep, by pattern weight) over the period, as a ratio: push : pull 1.0 means as much pushing as pulling.">
        <div className="grid gap-4 sm:grid-cols-3">
          {RATIOS.map((r) => (
            <fieldset key={r} className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{RATIO_LABELS[r]}</legend>
              <div className="flex gap-3">
                {field("Lowest", form.ratios[r].min, (v) => setForm((f) => ({ ...f, ratios: { ...f.ratios, [r]: { ...f.ratios[r], min: v } } })), `${r}-min`)}
                {field("Highest", form.ratios[r].max, (v) => setForm((f) => ({ ...f, ratios: { ...f.ratios, [r]: { ...f.ratios[r], max: v } } })), `${r}-max`)}
              </div>
            </fieldset>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Load" description="Per calendar week (Monday to Sunday), from the planned load.">
        <div className="flex flex-wrap gap-6">
          {field("Monotony, at most", form.monotonyMax, (v) => setForm((f) => ({ ...f, monotonyMax: v })), "monotony")}
          {field("More than the week before, at most", form.weekIncreaseMaxPercent, (v) => setForm((f) => ({ ...f, weekIncreaseMaxPercent: v })), "increase", "%")}
        </div>
      </SettingsSection>
    </form>
  );
}
