"use client";

import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { ReadOnlyNote, SettingsSection } from "@/components/app/settings";
import { FormError, SubmitButton, TextField } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { type FormState, initialFormState } from "@/lib/forms";
import { TRACK_COLORS, trackColorLabel } from "@/lib/tracks";
import { cn } from "@/lib/utils";
import { dayLabel } from "@/lib/week";

import { TrackDot } from "../programs/programs-manager";
import { addCalendarDay, addHolidays, removeCalendarDay, reorderFocuses, saveFocus, setDayClosed, setFocusArchived } from "./actions";

export type Focus = { id: string; name: string; color: string | null; archived: boolean };
export type CalendarDay = { id: string; date: string; name: string; closed: boolean; holidayOf: string | null };

/**
 * The gym's days: its list of day focuses (the calendar's menu for a day), and
 * its holidays and closed days for a year, with a country's public holidays in
 * one click. Owners and head coaches change them; everyone sees them.
 */
export function DaysManager({
  slug,
  canManage,
  year,
  focuses,
  days,
  countries,
}: {
  slug: string;
  canManage: boolean;
  year: number;
  focuses: Focus[];
  days: CalendarDay[];
  countries: { code: string; label: string; holidays: number; added: number }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-10">
      <FocusList slug={slug} canManage={canManage} focuses={focuses} />
      <DayList slug={slug} canManage={canManage} year={year} days={days} countries={countries} />
    </div>
  );
}

function FocusList({ slug, canManage, focuses }: { slug: string; canManage: boolean; focuses: Focus[] }) {
  const [optimistic, setArchivedOptimistic] = useOptimistic(focuses, (state, change: { id: string; archived: boolean }) =>
    state.map((f) => (f.id === change.id ? { ...f, archived: change.archived } : f)),
  );
  const [order, setOrder] = useState<string[] | null>(null);
  const [orderedFrom, setOrderedFrom] = useState(focuses);
  if (orderedFrom !== focuses) {
    setOrderedFrom(focuses);
    setOrder(null);
  }
  const shown = order ? order.flatMap((id) => optimistic.filter((f) => f.id === id)) : optimistic;
  const active = shown.filter((f) => !f.archived);
  const archived = shown.filter((f) => f.archived);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<Focus | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const openEditor = (target: Focus | "new" | null) => {
    if (target) setFormKey((k) => k + 1);
    setEditing(target);
  };

  const onArchive = (focus: Focus, archive: boolean) =>
    startTransition(async () => {
      setArchivedOptimistic({ id: focus.id, archived: archive });
      const result = await setFocusArchived(slug, focus.id, archive);
      if (result.ok) toast.success(archive ? `${focus.name} archived` : `${focus.name} restored`);
      else toast.error(result.error);
    });

  const onMove = (focus: Focus, direction: -1 | 1) => {
    const ids = active.map((f) => f.id);
    const from = ids.indexOf(focus.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    const all = [...ids, ...archived.map((f) => f.id)];
    flushSync(() => setOrder(all));
    // The keyboard stays on the moved focus: the same arrow, or the other one at either end.
    const arrow = (d: number) => document.querySelector<HTMLButtonElement>(`[data-order="${focus.id}:${d}"]`);
    const same = arrow(direction);
    (same && !same.disabled ? same : arrow(-direction))?.focus();
    startTransition(async () => {
      const result = await reorderFocuses(slug, all);
      if (!result.ok) {
        toast.error(result.error);
        setOrder(null);
      }
    });
  };

  const rows = (list: Focus[]) => (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {list.map((f, index) => (
        <li key={f.id} className="flex h-11 items-center gap-3 px-3">
          <TrackDot color={f.color} />
          <span className={cn("min-w-0 flex-1 truncate font-medium", f.archived && "text-muted-foreground")}>{f.name}</span>
          <span className="sr-only">Colour: {trackColorLabel(f.color)}</span>
          {f.archived && <Badge variant="outline">Archived</Badge>}
          {canManage && (
            <div className="flex gap-1">
              {!f.archived && list.length > 1 && (
                <>
                  <Button variant="ghost" size="icon-sm" data-order={`${f.id}:-1`} disabled={index === 0} onClick={() => onMove(f, -1)} aria-label={`Move ${f.name} up`}>
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-order={`${f.id}:1`}
                    disabled={index === list.length - 1}
                    onClick={() => onMove(f, 1)}
                    aria-label={`Move ${f.name} down`}
                  >
                    <ArrowDownIcon />
                  </Button>
                </>
              )}
              {!f.archived && (
                <Button variant="ghost" size="sm" onClick={() => openEditor(f)} aria-label={`Edit ${f.name}`}>
                  Edit
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => onArchive(f, !f.archived)} aria-label={`${f.archived ? "Restore" : "Archive"} ${f.name}`}>
                {f.archived ? "Restore" : "Archive"}
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <SettingsSection
        title="Day focus"
        description="What a day of a program is about: PP, Squat, DL, Oly / Core, Mix, Partner. Coaches set it on the calendar, ahead of the workouts, and Analytics can show one focus at a time."
        action={
          canManage && (
            <Button onClick={() => openEditor("new")}>
              <PlusIcon /> New day focus
            </Button>
          )
        }
      >
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-muted-foreground">
            {canManage ? "No day focuses yet. Add the ones your gym plans its days by." : "No day focuses yet. An owner or head coach adds them."}
          </p>
        ) : (
          rows(active)
        )}
        {!canManage && <ReadOnlyNote>Owners and head coaches keep the list; coaches set a day&apos;s focus on the calendar.</ReadOnlyNote>}
      </SettingsSection>
      {archived.length > 0 && (
        <SettingsSection title="Archived day focuses" description="Kept on the days that have them; not offered for new days.">
          {rows(archived)}
        </SettingsSection>
      )}
      {canManage && (
        <FocusDialog key={formKey} slug={slug} focus={editing === "new" ? null : editing} open={editing !== null} onOpenChange={(open) => !open && openEditor(null)} />
      )}
    </>
  );
}

function FocusDialog({ slug, focus, open, onOpenChange }: { slug: string; focus: Focus | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveFocus(slug, focus?.id ?? null, prev, formData);
    if (result.ok) {
      toast.success(focus ? "Day focus saved" : `${result.values?.name} added`);
      onOpenChange(false);
    }
    return result;
  }, initialFormState);
  const [color, setColor] = useState(focus?.color?.toUpperCase() ?? TRACK_COLORS[0]?.value ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{focus ? `Edit ${focus.name}` : "New day focus"}</DialogTitle>
          <DialogDescription>The colour marks the day on the calendar, always next to its name.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4" noValidate>
          <FormError>{state.error}</FormError>
          <TextField label="Name" name="name" autoFocus required placeholder="Squat" defaultValue={state.values?.name ?? focus?.name} error={state.fieldErrors?.name} />
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {TRACK_COLORS.map((c) => (
                <label
                  key={c.value}
                  className="relative flex size-8 cursor-pointer items-center justify-center rounded-md border border-border transition-colors duration-100 hover:bg-hover has-checked:border-ring has-checked:bg-hover has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                  title={c.label}
                >
                  <input type="radio" name="color" value={c.value} checked={color === c.value} onChange={() => setColor(c.value)} className="sr-only" aria-label={c.label} />
                  <span className="size-4 rounded-full" style={{ backgroundColor: c.value }} aria-hidden />
                </label>
              ))}
            </div>
            {state.fieldErrors?.color && <FieldError className="text-xs">{state.fieldErrors.color}</FieldError>}
          </fieldset>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <SubmitButton pendingLabel="Saving…">{focus ? "Save day focus" : "Add day focus"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DayList({
  slug,
  canManage,
  year,
  days,
  countries,
}: {
  slug: string;
  canManage: boolean;
  year: number;
  days: CalendarDay[];
  countries: { code: string; label: string; holidays: number; added: number }[];
}) {
  const [shown, change] = useOptimistic(days, (state, c: { id: string; closed?: boolean; removed?: boolean }) =>
    c.removed ? state.filter((d) => d.id !== c.id) : state.map((d) => (d.id === c.id ? { ...d, closed: c.closed ?? d.closed } : d)),
  );
  const [pending, startTransition] = useTransition();
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addCalendarDay(slug, prev, formData);
    if (result.ok) toast.success(`${formData.get("name")} added`);
    return result;
  }, initialFormState);
  const href = (y: number) => `/${slug}/settings/days?year=${y}`;

  const onClosed = (day: CalendarDay, closed: boolean) =>
    startTransition(async () => {
      change({ id: day.id, closed });
      const result = await setDayClosed(slug, day.id, closed);
      if (!result.ok) toast.error(result.error);
    });
  const onRemove = (day: CalendarDay) =>
    startTransition(async () => {
      change({ id: day.id, removed: true });
      const result = await removeCalendarDay(slug, day.id);
      if (result.ok) toast.success(`${day.name} removed`);
      else toast.error(result.error);
    });
  const onHolidays = (code: string, label: string) =>
    startTransition(async () => {
      const result = await addHolidays(slug, code, year);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.added === 0 ? `${label}'s holidays for ${year} are on the calendar already` : `${result.added} of ${label}'s holidays added for ${year}`);
    });

  return (
    <SettingsSection
      title="Holidays and closed days"
      description="Shown on every program's calendar. A closed day gets a warning when a workout is put on it; a holiday the gym is open on keeps its name."
      action={
        <nav aria-label="Year" className="flex items-center gap-1">
          <ButtonLink href={href(year - 1)} variant="outline" size="icon" aria-label={`${year - 1}`}>
            <ChevronLeftIcon />
          </ButtonLink>
          <span className="w-12 text-center font-medium tabular" aria-current="page">
            {year}
          </span>
          <ButtonLink href={href(year + 1)} variant="outline" size="icon" aria-label={`${year + 1}`}>
            <ChevronRightIcon />
          </ButtonLink>
        </nav>
      }
    >
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {countries.map((c) => (
            <Button key={c.code} variant="outline" disabled={pending || c.added >= c.holidays} onClick={() => onHolidays(c.code, c.label)}>
              {c.added >= c.holidays ? `${c.label}'s public holidays for ${year} are added` : `Add ${c.label}'s public holidays for ${year}`}
            </Button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-muted-foreground">No holidays or closed days in {year}.</p>
      ) : (
        <ul aria-label={`Holidays and closed days in ${year}`} className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {shown.map((d) => (
            <li key={d.id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
              <span className="w-28 shrink-0 text-sm text-muted-foreground tabular">{dayLabel(d.date)}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
              {canManage ? (
                <>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={d.closed} onChange={(e) => onClosed(d, e.target.checked)} className="accent-[var(--primary)]" />
                    Closed<span className="sr-only"> on {d.name}</span>
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => onRemove(d)} aria-label={`Remove ${d.name}`}>
                    Remove
                  </Button>
                </>
              ) : (
                <Badge variant={d.closed ? "outline" : "secondary"}>{d.closed ? "Closed" : "Open"}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <form action={action} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-end" noValidate>
          <FormError>{state.error}</FormError>
          <TextField label="Date" name="date" type="date" required defaultValue={state.values?.date ?? ""} error={state.fieldErrors?.date} />
          <TextField label="What it is" name="name" required placeholder="Closed for a competition" defaultValue={state.values?.name ?? ""} error={state.fieldErrors?.name} />
          <label className="flex h-8 items-center gap-1.5 text-sm">
            <input type="checkbox" name="closed" defaultChecked={state.values?.closed !== ""} className="accent-[var(--primary)]" />
            Closed
          </label>
          <SubmitButton pendingLabel="Adding…">Add the day</SubmitButton>
        </form>
      ) : (
        <ReadOnlyNote>Owners and head coaches keep the gym&apos;s holidays and closed days.</ReadOnlyNote>
      )}
    </SettingsSection>
  );
}
