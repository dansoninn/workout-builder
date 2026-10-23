"use client";

import { useId } from "react";

import { SettingsSection } from "@/components/app/settings";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ImportDay } from "@/lib/import/days";
import type { ImportDocument } from "@/lib/import/document";
import { columnLetter, type GridLayout, type Layout, nextMonday, type TextLayout } from "@/lib/import/layout";
import { dayLabel } from "@/lib/week";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const fieldClass = "h-8 rounded-md border border-input bg-surface px-2 text-sm tabular focus-visible:border-ring focus-visible:outline-none max-sm:text-base";

/** Step 1: how the document is laid out, as the app found it; the coach corrects it once. */
export function LayoutStep({
  document,
  layout,
  setLayout,
  programIndex,
  setProgramIndex,
  days,
  onNext,
}: {
  document: ImportDocument;
  layout: Layout | null;
  setLayout: (layout: Layout) => void;
  programIndex: number;
  setProgramIndex: (index: number) => void;
  days: ImportDay[];
  onNext: () => void;
}) {
  const workouts = days.filter((d) => d.text);
  const undated = workouts.filter((d) => !d.date).length;
  const dated = workouts.filter((d) => d.date).map((d) => d.date!).sort();

  return (
    <div className="grid gap-8">
      <SettingsSection title="How the document is laid out" description="What the app found. Change anything it got wrong; the days below follow at once.">
        {!layout ? (
          <p className="text-muted-foreground">No days were found in this document.</p>
        ) : layout.kind === "grid" && document.kind === "grid" ? (
          <GridSettings document={document} layout={layout} setLayout={setLayout} programIndex={programIndex} setProgramIndex={setProgramIndex} />
        ) : layout.kind === "text" ? (
          <TextSettings layout={layout} setLayout={setLayout} />
        ) : null}
      </SettingsSection>

      <section aria-labelledby="days-found" className="grid gap-2">
        <h2 id="days-found" className="text-lg font-semibold">
          {workouts.length} workouts{dated.length ? `, ${dayLabel(dated[0]!)} ${dated[0]!.slice(0, 4)} – ${dayLabel(dated.at(-1)!)} ${dated.at(-1)!.slice(0, 4)}` : ""}
        </h2>
        {undated > 0 && <p className="text-sm text-muted-foreground">{undated} without a date: see “Needs you”.</p>}
        <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {workouts.slice(0, 6).map((d) => (
            <li key={d.key} className="flex gap-3 px-3 py-2 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">{d.date ? dayLabel(d.date) : "No date"}</span>
              <span className="min-w-0 truncate">{d.text.split("\n").slice(0, 2).join(" · ")}</span>
            </li>
          ))}
        </ol>
        <div>
          <Button onClick={onNext} disabled={workouts.length === 0}>
            Looks right: next
          </Button>
        </div>
      </section>
    </div>
  );
}

function GridSettings({
  document,
  layout,
  setLayout,
  programIndex,
  setProgramIndex,
}: {
  document: Extract<ImportDocument, { kind: "grid" }>;
  layout: GridLayout;
  setLayout: (layout: Layout) => void;
  programIndex: number;
  setProgramIndex: (index: number) => void;
}) {
  const id = useId();
  const width = Math.max(...document.sheets.map((s) => s.rows[0]?.length ?? 0));
  const columns = [{ value: "none", label: "None" }, ...Array.from({ length: width }, (_, c) => ({ value: String(c), label: `Column ${columnLetter(c)}` }))];
  const program = layout.programs[programIndex];
  const setProgram = (patch: Partial<GridLayout["programs"][number]>) =>
    setLayout({ ...layout, programs: layout.programs.map((p, i) => (i === programIndex ? { ...p, ...patch } : p)) });
  const { dates } = layout;

  return (
    <div className="grid gap-5">
      {layout.programs.length > 1 && (
        <Field id={`${id}-program`} label="The program in the document" note="Import the others into their own programs after.">
          <Select items={layout.programs.map((p, i) => ({ value: String(i), label: p.name }))} value={String(programIndex)} onValueChange={(v) => setProgramIndex(Number(v))}>
            <SelectTrigger id={`${id}-program`} className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {layout.programs.map((p, i) => (
                <SelectItem key={i} value={String(i)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <div className="flex flex-wrap gap-5">
        <Field id={`${id}-year`} label={dates.from === "day-of-month" ? "Year" : "Year, when a date has none"}>
          <input
            id={`${id}-year`}
            type="number"
            min={1990}
            max={2100}
            value={dates.year}
            onChange={(e) => {
              const year = Number(e.target.value);
              if (year >= 1990 && year <= 2100) setLayout({ ...layout, dates: { ...dates, year } });
            }}
            className={`${fieldClass} w-24`}
          />
        </Field>
        {dates.from === "date" && (
          <Field id={`${id}-order`} label="Dates are written">
            <Select
              items={[{ value: "day", label: "Day first (5.1.2026)" }, { value: "month", label: "Month first (1/5/2026)" }]}
              value={dates.dayFirst ? "day" : "month"}
              onValueChange={(v) => setLayout({ ...layout, dates: { ...dates, dayFirst: v === "day" } })}
            >
              <SelectTrigger id={`${id}-order`} className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day first (5.1.2026)</SelectItem>
                <SelectItem value="month">Month first (1/5/2026)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        <ColumnField id={`${id}-shared`} label="Day labels for every program" note="A focus or a holiday on each day" columns={columns} value={layout.sharedFocusColumn} onChange={(c) => setLayout({ ...layout, sharedFocusColumn: c })} />
        {program && (
          <ColumnField id={`${id}-own`} label={`${program.name}'s own day focus`} columns={columns} value={program.focusColumn} onChange={(c) => setProgram({ focusColumn: c })} />
        )}
        {program && (
          <ColumnField
            id={`${id}-workout`}
            label="The workouts"
            columns={columns.slice(1)}
            value={program.workoutColumns[0] ?? 0}
            onChange={(c) => c !== null && setProgram({ workoutColumns: [c] })}
          />
        )}
      </div>
      {dates.from === "day-of-month" && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Each sheet&apos;s month</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {document.sheets.map((sheet) => {
              const read = layout.sheets.includes(sheet.name);
              const month = dates.months[sheet.name] ?? null;
              return (
                <label key={sheet.name} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-sm">
                  <span className="truncate font-medium">{sheet.name}</span>
                  <select
                    aria-label={`Month of the sheet ${sheet.name}`}
                    value={read ? String(month ?? "") : "skip"}
                    onChange={(e) => {
                      const value = e.target.value;
                      const sheets = value === "skip" ? layout.sheets.filter((s) => s !== sheet.name) : [...new Set([...layout.sheets, sheet.name])];
                      const months = { ...dates.months, [sheet.name]: value === "skip" || value === "" ? null : Number(value) };
                      setLayout({ ...layout, sheets: document.sheets.map((s) => s.name).filter((n) => sheets.includes(n)), dates: { ...dates, months } });
                    }}
                    className={`${fieldClass} w-36`}
                  >
                    <option value="">Which month?</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                    <option value="skip">Not read</option>
                  </select>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}

function TextSettings({ layout, setLayout }: { layout: TextLayout; setLayout: (layout: Layout) => void }) {
  const id = useId();
  const { days } = layout;
  const monday = "firstMonday" in days ? days.firstMonday : nextMonday(new Date().toISOString().slice(0, 10));
  const set = (next: TextLayout["days"]) => setLayout({ kind: "text", days: next });
  return (
    <div className="flex flex-wrap gap-5">
      <Field id={`${id}-by`} label="A day starts at">
        <Select
          items={[
            { value: "date", label: "A date (Monday 5 January)" },
            { value: "weekday", label: "A weekday (Monday)" },
            { value: "week-day", label: "Week 1 Day 1, or Day 1" },
          ]}
          value={days.by}
          onValueChange={(v) =>
            set(v === "date" ? { by: "date", year: Number(monday.slice(0, 4)), dayFirst: true } : v === "weekday" ? { by: "weekday", firstMonday: monday } : { by: "week-day", firstMonday: monday, weekdays: [0, 1, 2, 3, 4] })
          }
        >
          <SelectTrigger id={`${id}-by`} className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">A date (Monday 5 January)</SelectItem>
            <SelectItem value="weekday">A weekday (Monday)</SelectItem>
            <SelectItem value="week-day">Week 1 Day 1, or Day 1</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {days.by === "date" ? (
        <Field id={`${id}-year`} label="Year, when a date has none">
          <input id={`${id}-year`} type="number" min={1990} max={2100} value={days.year} onChange={(e) => set({ ...days, year: Number(e.target.value) || days.year })} className={`${fieldClass} w-24`} />
        </Field>
      ) : (
        <Field id={`${id}-monday`} label="The first week starts on" note="A Monday">
          <input
            id={`${id}-monday`}
            type="date"
            value={days.firstMonday}
            onChange={(e) => e.target.value && set({ ...days, firstMonday: nextMonday(e.target.value) })}
            className={fieldClass}
          />
        </Field>
      )}
      {days.by === "week-day" && (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-sm font-medium">Day 1, Day 2 … are</legend>
          <div className="flex gap-1">
            {WEEKDAYS.map((w, i) => (
              <label key={w} className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-sm has-checked:border-ring has-checked:bg-hover">
                <input
                  type="checkbox"
                  className="accent-[var(--primary)]"
                  checked={days.weekdays.includes(i)}
                  onChange={(e) => {
                    const weekdays = e.target.checked ? [...days.weekdays, i].sort() : days.weekdays.filter((d) => d !== i);
                    if (weekdays.length) set({ ...days, weekdays });
                  }}
                />
                {w}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

function Field({ id, label, note, children }: { id: string; label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function ColumnField({
  id,
  label,
  note,
  columns,
  value,
  onChange,
}: {
  id: string;
  label: string;
  note?: string;
  columns: { value: string; label: string }[];
  value: number | null;
  onChange: (column: number | null) => void;
}) {
  return (
    <Field id={id} label={label} note={note}>
      <Select items={columns} value={value === null ? "none" : String(value)} onValueChange={(v) => onChange(v === "none" || v === null ? null : Number(v))}>
        <SelectTrigger id={id} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {columns.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
