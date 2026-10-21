"use client";

import { EllipsisIcon, MessageSquareTextIcon, Trash2Icon } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { EffortKey } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import type { DraftBlock, DraftItem, DraftProblem } from "@/lib/workout/draft";
import { parseLine } from "@/lib/workout/draft";
import { loadMeaning, quantityMeaning } from "@/lib/workout/fields";
import type { Library } from "@/lib/workout/library";

import { EffortPicker } from "./controls";
import { ExerciseField } from "./exercise-field";

export type LineKeys = {
  /** Enter: a new line after this one. */
  onNewLine: () => void;
  /** ⌘ Enter: a new block after this block. */
  onNewBlock: () => void;
  /** ⌥ ↑ / ↓ */
  onMove: (delta: -1 | 1) => void;
  /** ⌘ ⌫ */
  onDelete: () => void;
};

const INPUT =
  "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm tabular text-foreground transition-[border-color,box-shadow] duration-100 " +
  "placeholder:text-subtle-foreground hover:border-border focus-visible:border-ring focus-visible:bg-surface focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_22%,transparent)] focus-visible:outline-none " +
  "disabled:hover:border-transparent aria-invalid:border-warning";

export function LineRow({
  block,
  item,
  label,
  library,
  problems,
  slots,
  readOnly,
  highlighted,
  onChange,
  keys,
}: {
  block: DraftBlock;
  item: DraftItem;
  /** "A2": block letter and line number, also used in warnings. */
  label: string;
  library: Library;
  problems: DraftProblem[];
  /** Alternating EMOM: how many minutes the rotation has (for the minute picker). */
  slots: number | null;
  readOnly: boolean;
  highlighted: boolean;
  onChange: (patch: Partial<Omit<DraftItem, "id">>, focusNext?: "quantity") => void;
  keys: LineKeys;
}) {
  const errorId = useId();
  const line = parseLine(item, library);
  const quantityProblem = problems.find((p) => p.field === "quantity");
  const loadProblem = problems.find((p) => p.field === "load");
  const unmatched = item.exerciseId === null && (item.quantity.trim() !== "" || item.load.trim() !== "");

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, popupOpen = false) => {
    const mod = event.metaKey || event.ctrlKey;
    if (event.key === "Enter" && mod) {
      event.preventDefault();
      keys.onNewBlock();
    } else if (event.key === "Enter" && !popupOpen && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      keys.onNewLine();
    } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      keys.onMove(event.key === "ArrowUp" ? -1 : 1);
    } else if (mod && event.key === "Backspace") {
      event.preventDefault();
      keys.onDelete();
    }
  };

  const meaning = [
    line.quantity.ok ? quantityMeaning(line.quantity.value) : null,
    line.load.ok && line.load.value ? loadMeaning(line.load.value, line.implementCount) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const errors = [quantityProblem?.message, loadProblem?.message, unmatched ? "Choose an exercise (needed to publish)" : null].filter(Boolean);
  const overrides = [item.paceEffort && "pace", item.loadEffort && "load", item.notes && "note", item.implementCount && `×${item.implementCount}`].filter(Boolean);

  return (
    <div
      data-line-row={item.id}
      className={cn(
        "group/line grid grid-cols-[2rem_minmax(0,1fr)_6.5rem_7.5rem_2rem] items-center gap-x-1 rounded-md px-1 transition-colors duration-100 sm:grid-cols-[2rem_minmax(0,1.4fr)_7rem_8rem_minmax(0,1fr)_2rem]",
        highlighted && "bg-warning-subtle",
      )}
    >
      <span className="text-right text-xs text-muted-foreground tabular" aria-hidden>
        {label}
      </span>
      <ExerciseField
        library={library}
        value={item.exerciseId}
        lineId={item.id}
        label={`${label} exercise`}
        disabled={readOnly}
        invalid={unmatched}
        onChange={(exerciseId) => onChange({ exerciseId }, item.quantity.trim() === "" ? "quantity" : undefined)}
        onKeyDown={onKeyDown}
      />
      <input
        aria-label={`${label} amount`}
        aria-invalid={quantityProblem ? true : undefined}
        aria-describedby={errors.length ? errorId : undefined}
        data-line={item.id}
        data-field="quantity"
        value={item.quantity}
        placeholder={line.exercise?.defaultUnit === "distance_m" ? "500 m" : line.exercise?.defaultUnit === "calories" ? "15 cal" : "5"}
        disabled={readOnly}
        onChange={(e) => onChange({ quantity: e.target.value })}
        onKeyDown={onKeyDown}
        className={INPUT}
      />
      <input
        aria-label={`${label} load`}
        aria-invalid={loadProblem ? true : undefined}
        aria-describedby={errors.length ? errorId : undefined}
        data-line={item.id}
        data-field="load"
        value={item.load}
        placeholder={readOnly ? "" : "load"}
        disabled={readOnly}
        onChange={(e) => onChange({ load: e.target.value })}
        onKeyDown={onKeyDown}
        className={INPUT}
      />
      <span className="hidden truncate px-1 text-xs text-muted-foreground sm:block" title={meaning}>
        {meaning}
        {overrides.length > 0 && <span className="ml-1.5 text-muted-foreground">· {overrides.join(", ")}</span>}
      </span>
      <LineMenu block={block} item={item} label={label} slots={slots} readOnly={readOnly} line={line} onChange={onChange} onDelete={keys.onDelete} />
      {errors.length > 0 && (
        <p id={errorId} className="col-span-full col-start-2 px-2 pb-1 text-xs text-warning">
          {errors.join(" · ")}
        </p>
      )}
    </div>
  );
}

function LineMenu({
  block,
  item,
  label,
  slots,
  readOnly,
  line,
  onChange,
  onDelete,
}: {
  block: DraftBlock;
  item: DraftItem;
  label: string;
  slots: number | null;
  readOnly: boolean;
  line: ReturnType<typeof parseLine>;
  onChange: (patch: Partial<Omit<DraftItem, "id">>) => void;
  onDelete: () => void;
}) {
  const notesId = useId();
  const showImplements = (line.exercise?.implementCount ?? 1) > 1 || item.implementCount !== null;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${label} options`}
            className={cn("opacity-60 group-hover/line:opacity-100 focus-visible:opacity-100", item.notes && "opacity-100")}
          />
        }
      >
        {item.notes ? <MessageSquareTextIcon /> : <EllipsisIcon />}
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-3 p-3">
        <p className="text-xs font-medium text-muted-foreground">Line {label}: only when it differs from the block</p>
        <EffortPicker<EffortKey>
          axis="pace"
          value={item.paceEffort}
          onChange={(paceEffort) => onChange({ paceEffort })}
          fallback={block.paceEffort}
          disabled={readOnly}
        />
        <EffortPicker<Exclude<EffortKey, "max">>
          axis="load"
          value={item.loadEffort}
          onChange={(loadEffort) => onChange({ loadEffort })}
          fallback={block.loadEffort}
          disabled={readOnly}
        />
        {slots !== null && (
          <fieldset className="flex items-center gap-1.5" disabled={readOnly}>
            <legend className="sr-only">Minute of the rotation</legend>
            <span aria-hidden className="w-9 text-xs font-medium text-muted-foreground">
              Min
            </span>
            {Array.from({ length: slots + 1 }, (_, i) => i + 1).map((slot) => (
              <Button
                key={slot}
                type="button"
                size="xs"
                variant={item.slot === slot ? "secondary" : "ghost"}
                aria-pressed={item.slot === slot}
                aria-label={slot > slots ? `New minute ${slot}` : `Minute ${slot}`}
                onClick={() => onChange({ slot })}
              >
                {slot > slots ? `+${slot}` : slot}
              </Button>
            ))}
          </fieldset>
        )}
        {showImplements && (
          <fieldset className="flex items-center gap-1.5" disabled={readOnly}>
            <legend className="sr-only">Implements</legend>
            <span aria-hidden className="w-9 text-xs font-medium text-muted-foreground">
              Uses
            </span>
            {[1, 2].map((count) => (
              <Button
                key={count}
                type="button"
                size="xs"
                variant={line.implementCount === count ? "secondary" : "ghost"}
                aria-pressed={line.implementCount === count}
                onClick={() => onChange({ implementCount: count === line.exercise?.implementCount ? null : count })}
              >
                {count === 1 ? "One implement" : "Two implements"}
              </Button>
            ))}
          </fieldset>
        )}
        <div className="grid gap-1">
          <label htmlFor={notesId} className="text-xs font-medium text-muted-foreground">
            Note
          </label>
          <Textarea
            id={notesId}
            value={item.notes}
            rows={2}
            disabled={readOnly}
            placeholder="e.g. I go, you go"
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>
        {!readOnly && (
          <Button variant="ghost" size="sm" className="justify-self-start text-destructive" onClick={onDelete}>
            <Trash2Icon /> Delete line <span className="text-muted-foreground">⌘⌫</span>
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
