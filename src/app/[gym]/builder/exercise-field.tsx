"use client";

import { Combobox } from "@base-ui/react/combobox";
import { useMemo, useRef, useState } from "react";

import { PatternTag } from "@/components/design/tags";
import type { PatternKey } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { type Library, type LibraryExercise, searchExercises } from "@/lib/workout/library";

type Option = { exercise: LibraryExercise; via: string | null; candidate: boolean };

/**
 * Picks an exercise for a line, searching the gym's library in the browser.
 * The first match is highlighted, so typing then Enter picks it. A generic
 * word ("squat") lists the exercises it could mean instead of guessing.
 */
export function ExerciseField({
  library,
  value,
  onChange,
  onKeyDown,
  onPicked,
  disabled,
  invalid,
  label,
  lineId,
}: {
  library: Library;
  value: string | null;
  onChange: (exerciseId: string | null) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>, open: boolean) => void;
  /**
   * After an exercise is picked and the list has closed, to move on to the
   * amount. Keys typed in between (a fast coach, a busy page) are kept and
   * passed along instead of landing in the search.
   */
  onPicked?: (typedAhead: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label: string;
  lineId: string;
}) {
  const selected = useMemo(() => library.exercises.find((e) => e.id === value) ?? null, [library, value]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const picked = useRef(false);
  const typedAhead = useRef("");
  const highlighted = useRef<Option | undefined>(undefined);

  const options = useMemo<Option[]>(() => {
    const { results, ambiguous } = searchExercises(library, query);
    const seen = new Set(ambiguous.map((e) => e.id));
    return [
      ...ambiguous.map((exercise) => ({ exercise, via: null, candidate: true })),
      ...results.filter((r) => !seen.has(r.exercise.id)).map((r) => ({ ...r, candidate: false })),
    ];
  }, [library, query]);

  const items = useMemo(
    () => (selected && !options.some((o) => o.exercise.id === selected.id) ? [...options, { exercise: selected, via: null, candidate: false }] : options),
    [options, selected],
  );
  const isAmbiguous = options.some((o) => o.candidate);

  return (
    <Combobox.Root<Option>
      items={items}
      value={items.find((o) => o.exercise.id === value) ?? null}
      onValueChange={(option) => {
        onChange(option?.exercise.id ?? null);
        setQuery("");
        picked.current = option !== null;
        typedAhead.current = "";
      }}
      onInputValueChange={(text, { reason }) => {
        if (reason !== "item-press") setQuery(text);
      }}
      itemToStringLabel={(option) => option.exercise.name}
      isItemEqualToValue={(a, b) => a.exercise.id === b.exercise.id}
      filter={null}
      // A generic word ("squat") never picks for the coach: they choose one.
      autoHighlight={!isAmbiguous}
      open={open}
      onOpenChange={setOpen}
      onItemHighlighted={(option) => {
        highlighted.current = option;
      }}
      onOpenChangeComplete={(isOpen) => {
        // Move on only once the list has closed and returned focus to the input.
        if (!isOpen && picked.current) {
          picked.current = false;
          const typed = typedAhead.current;
          typedAhead.current = "";
          onPicked?.(typed);
        }
      }}
      disabled={disabled}
    >
      <Combobox.Input
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder="Exercise"
        data-line={lineId}
        data-field="exercise"
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement> & { preventBaseUIHandler?: () => void }) => {
          // Picked, but the list is still closing (focus cannot move yet): what is typed now is the amount.
          const typing = event.key.length === 1 || event.key === "Backspace";
          if (picked.current && onPicked && typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            event.preventBaseUIHandler?.();
            typedAhead.current = event.key === "Backspace" ? typedAhead.current.slice(0, -1) : typedAhead.current + event.key;
            return;
          }
          // A generic word: Enter waits until the coach has picked one (↑ ↓), keeping what they typed.
          if (event.key === "Enter" && open && isAmbiguous && !highlighted.current) {
            event.preventDefault();
            event.preventBaseUIHandler?.();
            return;
          }
          onKeyDown?.(event, open);
        }}
        className={cn(
          "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-foreground transition-[border-color,box-shadow] duration-100",
          "placeholder:text-subtle-foreground hover:border-border focus-visible:border-ring focus-visible:bg-surface focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_22%,transparent)] focus-visible:outline-none",
          "disabled:cursor-default disabled:hover:border-transparent",
          invalid && "border-warning",
          !value && !disabled && "font-normal",
          value && "font-medium",
        )}
      />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} align="start" className="z-50">
          <Combobox.Popup className="max-h-[min(22rem,var(--available-height))] w-[max(var(--anchor-width),20rem)] max-w-[var(--available-width)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-raised">
            {isAmbiguous && (
              <div className="px-2 pt-1.5 pb-1 text-2xs font-medium text-muted-foreground uppercase">
                &ldquo;{query.trim()}&rdquo; could mean <span className="font-normal normal-case">(pick one with ↑ ↓)</span>
              </div>
            )}
            <Combobox.Empty>
              <div className="px-2 py-3 text-sm text-muted-foreground">
                {query.trim() ? `No exercise matches “${query.trim()}”.` : "Type to search the exercise library."}
              </div>
            </Combobox.Empty>
            <Combobox.List>
              {(option: Option) => (
                <Combobox.Item
                  key={option.exercise.id}
                  value={option}
                  className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-hover"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.exercise.name}</span>
                    {option.via && option.via !== option.exercise.name.toLowerCase() && (
                      <span className="block truncate text-xs text-muted-foreground">“{option.via}”</span>
                    )}
                  </span>
                  <ExerciseHint exercise={option.exercise} />
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

/** The exercise's main pattern (or modality) and whether it is the gym's own. */
function ExerciseHint({ exercise }: { exercise: LibraryExercise }) {
  const main = Object.entries(exercise.patterns).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] as PatternKey | undefined;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      {exercise.orgId && <span className="rounded-sm border border-border px-1 text-2xs">Gym</span>}
      {main ? <PatternTag pattern={main} className="h-4 text-2xs" /> : exercise.modality ? <span className="capitalize">{exercise.modality.replace("_", " ")}</span> : null}
    </span>
  );
}
