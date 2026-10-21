"use client";

import { RotateCcwIcon, SearchIcon } from "lucide-react";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { ReadOnlyNote, SettingsSection } from "@/components/app/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Pace } from "@/lib/engine/types";
import { paceToJson } from "@/lib/engine/pace";
import { normalizeAlias } from "@/lib/normalize-alias";
import { cn } from "@/lib/utils";
import type { LibraryExercise } from "@/lib/workout/library";
import { type PaceField, paceFields, paceText, paceValueText, parsePaceValue } from "@/lib/workout/pace-text";

import { setGymPace } from "./actions";

type Row = Pick<LibraryExercise, "id" | "name" | "kind" | "modality" | "defaultUnit" | "defaultPace" | "gymPace" | "orgId">;

export function PacesManager({ slug, rows, canEdit }: { slug: string; rows: Row[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [onlyGym, setOnlyGym] = useState(false);
  const [paces, setOptimistic] = useOptimistic(
    new Map(rows.map((r) => [r.id, r.gymPace])),
    (state, change: { id: string; pace: Pace | null }) => new Map(state).set(change.id, change.pace),
  );
  const [, startTransition] = useTransition();

  const shown = useMemo(() => {
    const q = normalizeAlias(query);
    return rows.filter((r) => (!q || normalizeAlias(r.name).includes(q)) && (!onlyGym || paces.get(r.id)));
  }, [rows, query, onlyGym, paces]);
  const overridden = rows.filter((r) => paces.get(r.id)).length;

  const save = (row: Row, pace: Pace | null) =>
    startTransition(async () => {
      setOptimistic({ id: row.id, pace });
      const result = await setGymPace(slug, row.id, pace ? paceToJson(pace) : null);
      if (!result.ok) toast.error(result.error);
      else toast.success(pace ? `${row.name}: your gym's pace saved` : `${row.name}: back to the default pace`);
    });

  return (
    <SettingsSection
      title="Paces"
      description="How fast your members move at Pace Hard. Used to estimate AMRAP rounds, finish times and max efforts. Empty means the default (an intermediate adult class member)."
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input aria-label="Find an exercise" placeholder="Find an exercise" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={onlyGym} onChange={(e) => setOnlyGym(e.target.checked)} className="accent-[var(--primary)]" />
          Only your gym&apos;s paces ({overridden})
        </label>
      </div>
      {!canEdit && <ReadOnlyNote>Owners and head coaches set the gym&apos;s paces.</ReadOnlyNote>}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th scope="col" className="h-8 px-3 font-medium">Exercise</th>
              <th scope="col" className="hidden h-8 px-3 font-medium sm:table-cell">Default</th>
              <th scope="col" className="h-8 px-3 font-medium">Your gym</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const fields = paceFields(row);
              const gymPace = paces.get(row.id) ?? null;
              return (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">
                    {row.name}
                    {row.orgId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(gym)</span>}
                  </th>
                  <td className="hidden px-3 py-1.5 text-muted-foreground tabular sm:table-cell">
                    {fields.length === 0 ? "timed hold" : paceText(row.defaultPace, fields)}
                  </td>
                  <td className="px-3 py-1">
                    {fields.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {fields.map((field) => (
                          <PaceInput
                            key={`${row.id}-${field.key}-${paceValueText(gymPace, field)}`}
                            row={row}
                            field={field}
                            pace={gymPace}
                            disabled={!canEdit}
                            onSave={(value) => {
                              const next: Pace = { ...(gymPace ?? {}) };
                              if (value === null) delete next[field.key];
                              else next[field.key] = value;
                              save(row, Object.keys(next).length > 0 ? next : null);
                            }}
                          />
                        ))}
                        {canEdit && gymPace && (
                          <Button variant="ghost" size="icon-sm" aria-label={`Use the default pace for ${row.name}`} onClick={() => save(row, null)}>
                            <RotateCcwIcon />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-3 py-6 text-center text-muted-foreground">No exercise matches.</p>}
      </div>
    </SettingsSection>
  );
}

function PaceInput({
  row,
  field,
  pace,
  disabled,
  onSave,
}: {
  row: Row;
  field: PaceField;
  pace: Pace | null;
  disabled: boolean;
  onSave: (secondsPerUnit: number | null) => void;
}) {
  const saved = paceValueText(pace, field);
  const [text, setText] = useState(saved);
  const parsed = parsePaceValue(text, field);
  const invalid = text.trim() !== "" && parsed === null;
  const commit = () => {
    if (invalid || text === saved) return;
    onSave(text.trim() === "" ? null : parsed);
  };
  return (
    <span className="flex items-center gap-1">
      <input
        aria-label={`${row.name} pace ${field.label}`}
        value={text}
        placeholder={paceValueText(row.defaultPace, field) || "—"}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setText(saved);
        }}
        className={cn(
          "h-7 w-16 rounded-md border border-input bg-surface px-2 text-sm tabular placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:outline-none disabled:border-transparent disabled:bg-transparent aria-invalid:border-destructive",
          pace?.[field.key] !== undefined && "font-medium",
        )}
      />
      <span className="text-xs text-muted-foreground">{field.label}</span>
    </span>
  );
}
