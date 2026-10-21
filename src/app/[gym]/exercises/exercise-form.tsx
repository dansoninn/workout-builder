"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Pace } from "@/lib/engine/types";
import { paceToJson } from "@/lib/engine/pace";
import { MODALITY_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from "@/lib/labels";
import { EQUIPMENT } from "@/lib/library/equipment";
import { type ModalityKey, MODALITIES, type MuscleKey, MUSCLES, type PatternKey, PATTERNS, type PlaneKey, PLANES } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import type { LibraryExercise } from "@/lib/workout/library";
import { paceFields, paceValueText, parsePaceValue } from "@/lib/workout/pace-text";

import { saveGymExercise } from "./actions";

const UNITS = [
  { value: "reps", label: "Reps" },
  { value: "distance_m", label: "Metres" },
  { value: "calories", label: "Calories" },
  { value: "time_s", label: "Time (hold)" },
];
const PLANE_LABELS: Record<PlaneKey, string> = { sagittal: "Sagittal", frontal: "Frontal", transverse: "Transverse", multiplanar: "Multiplanar" };

type FormState = {
  name: string;
  kind: "movement" | "monostructural";
  modality: ModalityKey | null;
  plane: PlaneKey | null;
  unilateral: boolean;
  defaultUnit: "reps" | "distance_m" | "calories" | "time_s";
  implementCount: number;
  patterns: { pattern: PatternKey; weight: string }[];
  primary: MuscleKey[];
  secondary: MuscleKey[];
  equipment: string[];
  pace: Record<string, string>;
};

function fromExercise(e: LibraryExercise | null): FormState {
  if (!e) {
    return { name: "", kind: "movement", modality: null, plane: null, unilateral: false, defaultUnit: "reps", implementCount: 1,
      patterns: [{ pattern: "squat", weight: "1" }], primary: [], secondary: [], equipment: [], pace: {} };
  }
  const fields = paceFields(e);
  return {
    name: e.name,
    kind: e.kind,
    modality: e.modality,
    plane: e.plane,
    unilateral: e.unilateral,
    defaultUnit: e.defaultUnit,
    implementCount: e.implementCount,
    patterns: (Object.entries(e.patterns) as [PatternKey, number][]).map(([pattern, weight]) => ({ pattern, weight: String(weight) })),
    primary: e.primaryMuscles,
    secondary: e.secondaryMuscles,
    equipment: e.equipment,
    pace: Object.fromEntries(fields.map((f) => [f.key, paceValueText(e.defaultPace, f)])),
  };
}

/** Add or edit one of the gym's own exercises (owners and head coaches). */
export function ExerciseForm({
  slug,
  exercise,
  open,
  onOpenChange,
}: {
  slug: string;
  exercise: LibraryExercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState(() => fromExercise(exercise));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameId = useId();
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const total = form.patterns.reduce((sum, p) => sum + (Number(p.weight.replace(",", ".")) || 0), 0);
  const totalOk = form.kind === "monostructural" || Math.round(total * 100) === 100;
  const fields = paceFields({ kind: form.kind, modality: form.modality, defaultUnit: form.defaultUnit });

  const toggle = (list: "primary" | "secondary", muscle: MuscleKey) =>
    setForm((f) => {
      const other = list === "primary" ? "secondary" : "primary";
      const has = f[list].includes(muscle);
      return { ...f, [list]: has ? f[list].filter((m) => m !== muscle) : [...f[list], muscle], [other]: f[other].filter((m) => m !== muscle) };
    });

  const submit = () => {
    const pace: Pace = {};
    for (const field of fields) {
      const value = parsePaceValue(form.pace[field.key] ?? "", field);
      if (value !== null) pace[field.key] = value;
    }
    startTransition(async () => {
      const result = await saveGymExercise(slug, {
        id: exercise?.id ?? null,
        name: form.name,
        kind: form.kind,
        modality: form.kind === "monostructural" ? form.modality : null,
        plane: form.plane,
        unilateral: form.unilateral,
        defaultUnit: form.defaultUnit,
        implementCount: form.implementCount,
        patterns: form.kind === "movement" ? Object.fromEntries(form.patterns.map((p) => [p.pattern, Number(p.weight.replace(",", "."))])) : {},
        primaryMuscles: form.primary,
        secondaryMuscles: form.secondary,
        equipment: form.equipment,
        pace: Object.keys(pace).length > 0 ? paceToJson(pace) : null,
      });
      if (!result.ok) return setError(result.error);
      toast.success(exercise ? `${form.name} saved` : `${form.name} added to your gym`);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{exercise ? `Edit ${exercise.name}` : "New gym exercise"}</DialogTitle>
          <DialogDescription>Only your gym sees it. Its movement patterns decide what it counts toward.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormError>{error}</FormError>
          <div className="grid gap-1.5">
            <label htmlFor={nameId} className="text-sm font-medium">
              Name
            </label>
            <Input id={nameId} value={form.name} autoFocus required onChange={(e) => set({ name: e.target.value })} placeholder="Sandbag bear-hug carry" />
          </div>

          <div className="flex flex-wrap gap-4">
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Kind</legend>
              <div className="flex gap-1">
                {(["movement", "monostructural"] as const).map((kind) => (
                  <Button key={kind} type="button" size="sm" variant={form.kind === kind ? "secondary" : "ghost"} aria-pressed={form.kind === kind}
                    onClick={() => set({ kind, defaultUnit: kind === "monostructural" ? "distance_m" : "reps" })}>
                    {kind === "movement" ? "Movement" : "Cardio (run, row, bike …)"}
                  </Button>
                ))}
              </div>
            </fieldset>
            {form.kind === "monostructural" && (
              <LabelledSelect label="What" value={form.modality} onChange={(v) => set({ modality: v as ModalityKey })}
                items={MODALITIES.map((m) => ({ value: m, label: MODALITY_LABELS[m] }))} placeholder="Choose" />
            )}
            <LabelledSelect label="Counted in" value={form.defaultUnit} onChange={(v) => set({ defaultUnit: v as FormState["defaultUnit"] })} items={UNITS} />
            <LabelledSelect label="Plane" value={form.plane} onChange={(v) => set({ plane: v as PlaneKey })}
              items={PLANES.map((p) => ({ value: p, label: PLANE_LABELS[p] }))} placeholder="Not set" />
            <LabelledSelect label="Implements" value={String(form.implementCount)} onChange={(v) => set({ implementCount: Number(v) })}
              items={[1, 2, 3, 4].map((n) => ({ value: String(n), label: n === 1 ? "One" : `${n} (e.g. 2 DBs)` }))} />
            <label className="flex items-end gap-1.5 pb-1.5 text-sm">
              <input type="checkbox" checked={form.unilateral} onChange={(e) => set({ unilateral: e.target.checked })} className="accent-[var(--primary)]" />
              One side at a time
            </label>
          </div>

          {form.kind === "movement" && (
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-sm font-medium">Movement patterns</legend>
              {form.patterns.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select items={PATTERNS.map((k) => ({ value: k, label: PATTERN_LABELS[k] }))} value={p.pattern}
                    onValueChange={(v) => v && set({ patterns: form.patterns.map((x, j) => (j === i ? { ...x, pattern: v as PatternKey } : x)) })}>
                    <SelectTrigger className="w-48" aria-label={`Pattern ${i + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PATTERNS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {PATTERN_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input aria-label={`Weight of pattern ${i + 1}`} value={p.weight} inputMode="decimal" className="w-20 tabular"
                    onChange={(e) => set({ patterns: form.patterns.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)) })} />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove pattern ${i + 1}`} disabled={form.patterns.length === 1}
                    onClick={() => set({ patterns: form.patterns.filter((_, j) => j !== i) })}>
                    <XIcon />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button type="button" variant="ghost" size="sm" className="w-fit"
                  onClick={() => set({ patterns: [...form.patterns, { pattern: PATTERNS.find((k) => !form.patterns.some((p) => p.pattern === k)) ?? "core", weight: "" }] })}>
                  <PlusIcon /> Pattern
                </Button>
                <span className={cn("text-xs tabular", totalOk ? "text-muted-foreground" : "text-warning")} role="status">
                  Total {total.toFixed(2)} {totalOk ? "✓" : "(must be 1.00)"}
                </span>
              </div>
            </fieldset>
          )}

          <MuscleChips title="Primary muscles" selected={form.primary} onToggle={(m) => toggle("primary", m)} />
          <MuscleChips title="Secondary muscles" selected={form.secondary} onToggle={(m) => toggle("secondary", m)} />

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Equipment</legend>
            <div className="flex flex-wrap gap-1">
              {EQUIPMENT.map((e) => (
                <Chip key={e.key} pressed={form.equipment.includes(e.key)}
                  onClick={() => set({ equipment: form.equipment.includes(e.key) ? form.equipment.filter((k) => k !== e.key) : [...form.equipment, e.key] })}>
                  {e.label}
                </Chip>
              ))}
            </div>
          </fieldset>

          {fields.length > 0 && (
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-sm font-medium">
                Pace at Hard <span className="font-normal text-muted-foreground">(optional; for estimates)</span>
              </legend>
              <div className="flex flex-wrap gap-3">
                {fields.map((f) => (
                  <label key={f.key} className="flex items-center gap-1.5 text-sm">
                    <Input value={form.pace[f.key] ?? ""} className="w-20 tabular" aria-label={`Pace ${f.label}`}
                      onChange={(e) => set({ pace: { ...form.pace, [f.key]: e.target.value } })} />
                    <span className="text-muted-foreground">{f.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending || !totalOk}>
              {pending ? "Saving…" : exercise ? "Save exercise" : "Add exercise"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LabelledSelect({
  label,
  value,
  onChange,
  items,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger id={id} className="w-40">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-7 rounded-md border px-2 text-xs font-medium transition-colors duration-100",
        pressed ? "border-ring bg-primary-subtle text-foreground" : "border-border text-muted-foreground hover:bg-hover hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function MuscleChips({ title, selected, onToggle }: { title: string; selected: MuscleKey[]; onToggle: (m: MuscleKey) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{title}</legend>
      <div className="flex flex-wrap gap-1">
        {MUSCLES.map((m) => (
          <Chip key={m} pressed={selected.includes(m)} onClick={() => onToggle(m)}>
            {MUSCLE_LABELS[m]}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
