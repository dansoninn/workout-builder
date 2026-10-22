"use client";

import { useId, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EFFORT_BOXES, EFFORT_LABELS, semanticColor } from "@/lib/labels";
import type { EffortKey } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { durationText, parseDuration } from "@/lib/workout/fields";

const FIELD =
  "h-8 rounded-md border border-input bg-surface px-2 text-sm text-foreground tabular transition-[border-color,box-shadow] duration-100 " +
  "placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_22%,transparent)] focus-visible:outline-none " +
  "disabled:cursor-default disabled:border-border disabled:bg-transparent aria-invalid:border-destructive";

/** A small labelled field in a block's settings row. */
export function SmallField({ label, children, hint }: { label: string; children: (id: string) => React.ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
        {hint && <span className="font-normal"> {hint}</span>}
      </label>
      {children(id)}
    </div>
  );
}

/** Whole number ≥ min; commits on blur or Enter so typing "12" never passes through an invalid "1". */
export function NumberInput({
  id,
  value,
  onChange,
  min = 1,
  optional,
  disabled,
  className,
  placeholder,
}: {
  id: string;
  value: number | undefined | null;
  onChange: (value: number | undefined) => void;
  min?: number;
  optional?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const show = (v: number | undefined | null) => (v === undefined || v === null ? "" : String(v));
  const [text, setText] = useState(show(value));
  // Follow changes from outside (undo, restore) without fighting the typing.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(show(value));
  }
  const parsed = text.trim() === "" ? undefined : Number(text);
  const invalid = parsed === undefined ? !optional : !Number.isInteger(parsed) || parsed < min;
  const commit = () => {
    if (!invalid && parsed !== value) onChange(parsed);
  };
  return (
    <input
      id={id}
      inputMode="numeric"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        setText(e.target.value);
        const next = e.target.value.trim() === "" ? undefined : Number(e.target.value);
        if (next === undefined ? optional : Number.isInteger(next) && next >= min) onChange(next);
      }}
      onBlur={commit}
      className={cn(FIELD, "w-16", className)}
    />
  );
}

/** A duration as m:ss; a bare number is in `bareUnit` (minutes for AMRAP/EMOM, seconds for rest). */
export function DurationInput({
  id,
  value,
  onChange,
  bareUnit,
  optional,
  disabled,
  className,
  placeholder,
}: {
  id: string;
  value: number | undefined | null;
  onChange: (seconds: number | undefined) => void;
  bareUnit: "min" | "s";
  optional?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const show = (v: number | undefined | null) => (v === undefined || v === null ? "" : durationText(v));
  const [text, setText] = useState(show(value));
  const [focused, setFocused] = useState(false);
  // Follow changes from outside (undo, restore), but never while the coach types.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    if (!focused) setText(show(value));
  }
  const parsed = parseDuration(text, bareUnit);
  const invalid = text.trim() === "" ? !optional : parsed === null || parsed < (optional ? 0 : 1);
  return (
    <input
      id={id}
      value={text}
      placeholder={placeholder ?? (bareUnit === "min" ? "min" : "sec")}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value.trim() === "") {
          if (optional) onChange(undefined);
          return;
        }
        const next = parseDuration(e.target.value, bareUnit);
        if (next !== null && next >= (optional ? 0 : 1)) onChange(next);
      }}
      onBlur={() => {
        setFocused(false);
        setText(show(value));
      }}
      className={cn(FIELD, "w-[4.5rem]", className)}
    />
  );
}

const PACE_LEVELS: EffortKey[] = ["easy", "moderate", "hard", "max"];
const LOAD_LEVELS: Exclude<EffortKey, "max">[] = ["easy", "moderate", "hard"];

/** Effort in words (calc spec §4.4): the coach never types an RPE number. */
export function EffortPicker<T extends EffortKey>({
  axis,
  value,
  onChange,
  fallback,
  disabled,
}: {
  axis: "pace" | "load";
  value: T | null;
  onChange: (value: T | null) => void;
  /** What applies when nothing is chosen (the block's default or the block's own effort). */
  fallback?: EffortKey | null;
  disabled?: boolean;
}) {
  const levels = (axis === "pace" ? PACE_LEVELS : LOAD_LEVELS) as T[];
  const name = useId();
  return (
    <fieldset className="flex items-center gap-1.5" disabled={disabled}>
      <legend className="sr-only">{axis === "pace" ? "Pace effort" : "Load effort"}</legend>
      <span aria-hidden className="w-9 text-xs font-medium text-muted-foreground">
        {axis === "pace" ? "Pace" : "Load"}
      </span>
      <div className="flex rounded-md border border-border bg-surface p-0.5">
        {levels.map((level) => {
          const checked = value === level;
          const implied = value === null && fallback === level;
          return (
            <Tooltip key={level}>
              <TooltipTrigger
                render={
                  <label
                    className={cn(
                      "relative flex h-6 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs font-medium text-muted-foreground transition-colors duration-100 select-none hover:text-foreground",
                      "has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-ring",
                      checked && "bg-hover text-foreground",
                      implied && "text-foreground",
                      disabled && "cursor-default",
                    )}
                  />
                }
              >
                <input
                  type="radio"
                  name={name}
                  value={level}
                  checked={checked}
                  onChange={() => onChange(level)}
                  onClick={() => checked && onChange(null)}
                  className="sr-only"
                  aria-label={`${axis === "pace" ? "Pace" : "Load"} ${EFFORT_LABELS[level]}`}
                  aria-describedby={`${name}-${level}`}
                />
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-full", !checked && !implied && "opacity-0")}
                  style={{ backgroundColor: semanticColor("effort", level) }}
                />
                {EFFORT_LABELS[level]}
                {implied && <span className="sr-only"> (default)</span>}
                <span id={`${name}-${level}`} className="sr-only">
                  {EFFORT_BOXES[level].percent} effort, RPE {EFFORT_BOXES[level].rpe}. {EFFORT_BOXES[level].description}
                </span>
              </TooltipTrigger>
              <TooltipContent className="flex-col items-start gap-0.5">
                <span className="font-medium">
                  {axis === "pace" ? "Pace" : "Load"} {EFFORT_LABELS[level]}
                  {implied && " (the block's default)"} · {EFFORT_BOXES[level].percent} · RPE {EFFORT_BOXES[level].rpe}
                </span>
                <span>{EFFORT_BOXES[level].description}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </fieldset>
  );
}
