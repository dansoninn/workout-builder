"use client";

import { CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { addDays, addMonths, dayLabel, monthLabel, monthWeeks } from "@/lib/week";

import type { TrackOption } from "../builder/builder";
import { applyTemplate } from "./actions";

export interface TemplateOption {
  id: string;
  title: string;
  /** The template's own program: the copies go there unless the coach picks another. */
  trackId: string | null;
}

/**
 * A template on several dates (PLAN-step-5 5b): pick the template, the program
 * and any number of days. Each day gets its own copy, made together.
 */
export function ApplyTemplateDialog({
  slug,
  templates,
  tracks,
  today,
  open,
  onOpenChange,
  fixedTemplateId = null,
  initialTrackId = null,
}: {
  slug: string;
  templates: TemplateOption[];
  tracks: TrackOption[];
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** From a template in the builder: that template, no choice. */
  fixedTemplateId?: string | null;
  initialTrackId?: string | null;
}) {
  const router = useRouter();
  const id = useId();
  const active = tracks.filter((t) => !t.archived);
  const [templateId, setTemplateId] = useState<string | null>(fixedTemplateId ?? templates[0]?.id ?? null);
  const programOf = (id: string | null) => active.find((t) => t.id === templates.find((x) => x.id === id)?.trackId)?.id;
  const [trackId, setTrackId] = useState<string | null>(initialTrackId ?? programOf(templateId) ?? active[0]?.id ?? null);
  // Until the coach picks a program, it follows the template's own.
  const [trackChosen, setTrackChosen] = useState(initialTrackId !== null);
  const [dates, setDates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const template = templates.find((t) => t.id === templateId);

  const toggle = (date: string) => setDates((d) => (d.includes(date) ? d.filter((x) => x !== date) : [...d, date].sort()));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId) return setError("Pick a template.");
    if (!trackId) return setError("Pick a program.");
    if (dates.length === 0) return setError("Pick at least one day.");
    setError(null);
    startTransition(async () => {
      const result = await applyTemplate(slug, { templateId, trackId, dates });
      if (!result.ok) return void setError(result.error);
      toast.success(`${template?.title || "Template"} added to ${dates.length === 1 ? dayLabel(dates[0]!) : `${dates.length} days`}`);
      onOpenChange(false);
      setDates([]);
      if (fixedTemplateId) router.push(`/${slug}/calendar?view=month&date=${dates[0]}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fixedTemplateId ? "Use this template on dates" : "Apply a template"}</DialogTitle>
          <DialogDescription>Each day gets its own copy as a draft. Changing a copy later leaves the template and the other days as they are.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          {!fixedTemplateId && (
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-template`} className="text-sm font-medium">
                Template
              </label>
              <Select items={templates.map((t) => ({ value: t.id, label: t.title }))} value={templateId}
                onValueChange={(v) => {
                  setTemplateId(v);
                  if (!trackChosen) setTrackId(programOf(v) ?? trackId);
                }}
              >
                <SelectTrigger id={`${id}-template`} className="w-full">
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-track`} className="text-sm font-medium">
              Program
            </label>
            <Select items={active.map((t) => ({ value: t.id, label: t.name }))} value={trackId}
              onValueChange={(v) => {
                setTrackId(v ?? null);
                setTrackChosen(true);
              }}
            >
              <SelectTrigger id={`${id}-track`} className="w-full">
                <SelectValue placeholder="Pick a program" />
              </SelectTrigger>
              <SelectContent>
                {active.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DayPicker today={today} selected={dates} onToggle={toggle} />
          {dates.length > 0 && (
            <ul aria-label="Days chosen" className="flex flex-wrap gap-1">
              {dates.map((date) => (
                <li key={date}>
                  <Button type="button" variant="secondary" size="xs" onClick={() => toggle(date)}>
                    {dayLabel(date)} <XIcon aria-hidden />
                    <span className="sr-only">(remove)</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : dates.length > 1 ? `Add to ${dates.length} days` : "Add to calendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A month of day buttons to switch on and off; arrow keys move between days, Space or Enter picks. */
function DayPicker({ today, selected, onToggle }: { today: string; selected: string[]; onToggle: (date: string) => void }) {
  const [month, setMonth] = useState(today);
  const [focusDay, setFocusDay] = useState(today);
  const grid = useRef<HTMLDivElement>(null);
  const weeks = monthWeeks(month);
  const ym = month.slice(0, 7);

  const moveFocus = (date: string) => {
    if (!date.startsWith(ym)) setMonth(date);
    setFocusDay(date);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-day="${date}"]`)?.focus());
  };
  const onKeyDown = (e: React.KeyboardEvent, date: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    moveFocus(addDays(date, step));
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Days</legend>
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeftIcon />
        </Button>
        <span className="text-sm font-medium" aria-live="polite">
          {monthLabel(month)}
        </span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRightIcon />
        </Button>
      </div>
      <div ref={grid} role="group" aria-label={monthLabel(month)} className="grid grid-cols-7 gap-1 text-center">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} aria-hidden className="text-xs text-muted-foreground">
            {d}
          </span>
        ))}
        {weeks.flat().map((date) => {
          const inMonth = date.startsWith(ym);
          const on = selected.includes(date);
          const tabbable = date === (focusDay.startsWith(ym) ? focusDay : `${ym}-01`);
          return (
            <button
              key={date}
              type="button"
              data-day={date}
              aria-pressed={on}
              aria-label={dayLabel(date)}
              tabIndex={tabbable ? 0 : -1}
              onClick={() => {
                setFocusDay(date);
                onToggle(date);
              }}
              onKeyDown={(e) => onKeyDown(e, date)}
              className={cn(
                "flex h-8 items-center justify-center rounded-md text-sm tabular transition-colors duration-100 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                !inMonth && "text-muted-foreground",
                date === today && "font-semibold text-primary-text",
                on && "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The calendar's "Apply template" button and its dialog. */
export function ApplyTemplateButton(props: Omit<React.ComponentProps<typeof ApplyTemplateDialog>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={props.templates.length === 0}>
        <CalendarPlusIcon /> Apply template
      </Button>
      <ApplyTemplateDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}
