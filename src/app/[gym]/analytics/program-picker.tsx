"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { TrackOption } from "../builder/builder";

/**
 * Which programs analytics covers (decision 4, 2026-10-23): one by default;
 * several only when the coach ticks them, and then always named together.
 * "Only" switches to a single program in one click.
 */
export function ProgramPicker({
  programs,
  selected,
  onChange,
}: {
  /** The active programs, plus any archived one that is selected. */
  programs: TrackOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [ticked, setTicked] = useState(selected);
  const names = programs.filter((p) => selected.includes(p.id)).map((p) => p.name);
  const choose = (ids: string[]) => {
    setOpen(false);
    if (ids.join() !== selected.join()) onChange(ids);
  };

  return (
    <div className="grid gap-1">
      <span id={`${id}-label`} className="text-xs font-medium text-muted-foreground">
        {selected.length > 1 ? "Programs, together" : "Program"}
      </span>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setTicked(selected);
          setOpen(next);
        }}
      >
        <PopoverTrigger
          render={<Button variant="outline" className="max-w-80 justify-between font-normal" aria-labelledby={`${id}-label ${id}-value`} />}
        >
          <span id={`${id}-value`} className="flex min-w-0 items-center gap-1.5">
            {programs
              .filter((p) => selected.includes(p.id))
              .map((p) => (
                <ProgramDot key={p.id} color={p.color} />
              ))}
            <span className="truncate">{names.join(" + ")}</span>
          </span>
          <ChevronDownIcon className="text-muted-foreground" aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ticked.length > 0) choose(programs.filter((p) => ticked.includes(p.id)).map((p) => p.id));
            }}
          >
            <fieldset className="grid gap-0.5">
              <legend className="mb-1.5 text-sm font-medium">Programs</legend>
              {programs.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md px-1 hover:bg-hover">
                  <label className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ticked.includes(p.id)}
                      onChange={(e) => setTicked((t) => (e.target.checked ? [...t, p.id] : t.filter((x) => x !== p.id)))}
                      className="size-4 accent-primary"
                    />
                    <ProgramDot color={p.color} />
                    <span className="truncate">
                      {p.name}
                      {p.archived && <span className="text-muted-foreground"> (archived)</span>}
                    </span>
                  </label>
                  <Button type="button" variant="ghost" size="xs" onClick={() => choose([p.id])} aria-label={`Only ${p.name}`}>
                    Only
                  </Button>
                </div>
              ))}
            </fieldset>
            <p className="text-xs text-muted-foreground">
              Several programs are shown together, named. Warnings, monotony and week-on-week change stay per program.
            </p>
            <div className="flex items-center justify-end gap-2">
              {ticked.length === 0 && (
                <p role="alert" className="mr-auto text-xs text-destructive">
                  Choose at least one program.
                </p>
              )}
              <Button type="submit" disabled={ticked.length === 0}>
                Show
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ProgramDot({ color }: { color: string | null }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color ?? "var(--border-strong)" }} />;
}
