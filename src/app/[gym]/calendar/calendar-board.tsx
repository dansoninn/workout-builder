"use client";

import { MoveIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Estimate } from "@/components/design/estimate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { add } from "@/lib/engine/measure";
import type { Measure } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { dayLabel } from "@/lib/week";

import type { TrackOption } from "../builder/builder";
import { moveWorkout } from "./actions";

export interface CalendarWorkout {
  id: string;
  date: string;
  title: string | null;
  status: "draft" | "published";
  trackId: string | null;
  sessionMin: Measure | null;
  sRpe: Measure | null;
  /** Results logged for its blocks (4d). */
  results: number;
}

type Column = Pick<TrackOption, "id" | "name" | "color" | "archived"> | { id: null; name: string; color: null; archived: false };

const DRAG_TYPE = "application/x-workout";

/**
 * The calendar's days with their workouts. Coaches move a workout by dragging
 * it to another day (and, in the week view, another track), or with its
 * "Move" button (keyboard and touch). The card moves at once; if the server
 * refuses, it goes back and a message says why.
 */
export function CalendarBoard({
  slug,
  view,
  days,
  month,
  today,
  tracks,
  workouts,
  canProgram,
}: {
  slug: string;
  view: "month" | "week";
  /** Week view: seven days. Month view: whole weeks covering the month. */
  days: string[];
  /** Month view: "2026-10" (days outside it are quieter). */
  month: string | null;
  today: string;
  tracks: TrackOption[];
  workouts: CalendarWorkout[];
  canProgram: boolean;
}) {
  const [shown, moveShown] = useOptimistic(workouts, (state, move: { id: string; date: string; trackId: string | null }) =>
    state.map((w) => (w.id === move.id ? { ...w, date: move.date, trackId: move.trackId } : w)),
  );
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ workout: CalendarWorkout; date: string; trackId: string | null } | null>(null);
  const href = (path: string) => `/${slug}/${path}`;
  const defaultTrack = tracks.find((t) => !t.archived)?.id ?? null;

  const move = (workout: CalendarWorkout, date: string, trackId: string | null, undo = false) => {
    if (workout.date === date && workout.trackId === trackId) return;
    startTransition(async () => {
      moveShown({ id: workout.id, date, trackId });
      const result = await moveWorkout(slug, { workoutId: workout.id, date, trackId });
      if (!result.ok) return void toast.error(result.error);
      if (undo) return void toast.success("Moved back");
      toast.success(`${workout.title || "Untitled workout"} moved to ${dayLabel(date)}`, {
        action: { label: "Undo", onClick: () => move({ ...workout, date, trackId }, workout.date, workout.trackId, true) },
      });
    });
  };

  /** A day (and track) that takes a dropped workout. */
  const dropTarget = (key: string, date: string, trackId: string | null | undefined) =>
    canProgram
      ? {
          "data-drop-target": key,
          onDragOver: (e: React.DragEvent) => {
            if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOver(key);
          },
          onDragLeave: () => setOver((o) => (o === key ? null : o)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setOver(null);
            const workout = shown.find((w) => w.id === e.dataTransfer.getData(DRAG_TYPE));
            if (workout) move(workout, date, trackId === undefined ? workout.trackId : trackId);
          },
        }
      : {};

  const card = (w: CalendarWorkout) => (
    <WorkoutCard
      key={w.id}
      workout={w}
      href={href(`builder/${w.id}`)}
      track={view === "month" ? tracks.find((t) => t.id === w.trackId) : undefined}
      canMove={canProgram}
      dragging={dragging === w.id}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, w.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(w.id);
      }}
      onDragEnd={() => {
        setDragging(null);
        setOver(null);
      }}
      onMove={() => setMoving({ workout: w, date: w.date, trackId: w.trackId })}
    />
  );

  /** "Add" on a day: shown on hover or focus where there is a pointer, always on a phone; "Another" when the day has workouts. */
  const addLink = (date: string, trackId: string | null, label: string, quiet: boolean, another: boolean) =>
    canProgram && (
      <Link
        href={`${href("builder")}?date=${date}${trackId ? `&program=${trackId}` : ""}`}
        className={cn(
          "flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-100 hover:bg-hover hover:text-foreground focus-visible:opacity-100",
          quiet && "md:opacity-0 md:group-hover/cell:opacity-100",
        )}
      >
        <PlusIcon className="size-3.5" aria-hidden /> {another ? "Another" : "Add"}
        <span className="sr-only"> workout on {label}</span>
      </Link>
    );

  return (
    <>
      {view === "month" ? (
        <MonthGrid days={days} month={month!} today={today} over={over} dropTarget={dropTarget}>
          {(day) => {
            const here = shown.filter((w) => w.date === day);
            return (
              <>
                {here.map(card)}
                {addLink(day, defaultTrack, dayLabel(day), true, here.length > 0)}
              </>
            );
          }}
        </MonthGrid>
      ) : (
        <WeekTable days={days} today={today} tracks={tracks} workouts={shown} over={over} dropTarget={dropTarget}>
          {(day, column) => {
            const here = shown.filter((w) => w.date === day && w.trackId === column.id);
            return (
              <>
                {here.map(card)}
                {column.id !== null && !column.archived && addLink(day, column.id, `${dayLabel(day)}, ${column.name}`, here.length > 0, here.length > 0)}
              </>
            );
          }}
        </WeekTable>
      )}

      <MoveDialog
        moving={moving}
        tracks={tracks}
        onChange={setMoving}
        onMove={() => {
          if (moving) move(moving.workout, moving.date, moving.trackId);
          setMoving(null);
        }}
      />
    </>
  );
}

function WorkoutCard({
  workout: w,
  href,
  track,
  canMove,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  workout: CalendarWorkout;
  href: string;
  track: TrackOption | undefined;
  canMove: boolean;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMove: () => void;
}) {
  const title = w.title || "Untitled workout";
  return (
    <div
      draggable={canMove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-workout={w.id}
      className={cn(
        "group/card relative min-w-0 rounded-md border border-border bg-background transition-[opacity,background-color] duration-100 hover:bg-hover",
        canMove && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50",
      )}
    >
      <Link href={href} draggable={false} title={title} className="grid grid-cols-[minmax(0,1fr)] gap-0.5 rounded-md px-2 py-1.5 pr-6">
        <span className="flex items-center gap-1.5">
          {track && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: track.color ?? "var(--border-strong)" }} />}
          <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        </span>
        {track && <span className="sr-only">{track.name}</span>}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {w.status === "draft" && (
            <Badge variant="outline" className="h-4 shrink-0 px-1 text-2xs">
              Draft
            </Badge>
          )}
          {w.sessionMin ? <Estimate measure={w.sessionMin} unit="min" /> : null}
          {w.sRpe ? <Estimate measure={w.sRpe} unit="AU" /> : null}
          {w.results > 0 && <span>{w.results === 1 ? "1 result" : `${w.results} results`}</span>}
        </span>
      </Link>
      {canMove && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Move ${title}`}
          onClick={onMove}
          className="absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
        >
          <MoveIcon />
        </Button>
      )}
    </div>
  );
}

type DropTarget = (key: string, date: string, trackId: string | null | undefined) => Record<string, unknown>;

/** Monday-first weeks; on a phone, a list of days. */
function MonthGrid({
  days,
  month,
  today,
  over,
  dropTarget,
  children,
}: {
  days: string[];
  month: string;
  today: string;
  over: string | null;
  dropTarget: DropTarget;
  children: (day: string) => React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div aria-hidden className="hidden grid-cols-[repeat(7,minmax(0,1fr))] border-b border-border md:grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <ol className="grid md:grid-cols-[repeat(7,minmax(0,1fr))]" aria-label="Days">
        {days.map((day) => {
          const outside = !day.startsWith(month);
          return (
            <li
              key={day}
              {...dropTarget(day, day, undefined)}
              className={cn(
                "group/cell grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1 border-b border-border p-1.5 md:min-h-28 md:border-r md:[&:nth-child(7n)]:border-r-0",
                outside && "bg-surface-sunken/60 max-md:hidden",
                day === today && "bg-primary-subtle/40",
                over === day && "bg-primary-subtle ring-2 ring-ring ring-inset",
              )}
            >
              <h3 className={cn("px-0.5 text-xs font-medium", outside ? "text-muted-foreground" : "text-foreground", day === today && "text-primary-text")}>
                <span className="md:hidden">{dayLabel(day)}</span>
                <span className="max-md:hidden" aria-hidden>
                  {Number(day.slice(8))}
                </span>
                <span className="sr-only max-md:hidden">{dayLabel(day)}</span>
                {day === today && <span className="ml-1 font-normal">today</span>}
              </h3>
              {children(day)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** One week, a column per track, and the week's planned load per track. */
function WeekTable({
  days,
  today,
  tracks,
  workouts,
  over,
  dropTarget,
  children,
}: {
  days: string[];
  today: string;
  tracks: TrackOption[];
  workouts: CalendarWorkout[];
  over: string | null;
  dropTarget: DropTarget;
  children: (day: string, column: Column) => React.ReactNode;
}) {
  // Columns: active tracks, plus any archived track or "no track" that has workouts this week.
  const columns: Column[] = [
    ...tracks.filter((t) => !t.archived || workouts.some((w) => w.trackId === t.id)),
    ...(workouts.some((w) => w.trackId === null) ? [{ id: null, name: "No program", color: null, archived: false as const }] : []),
  ];
  const weekTotal = (trackId: string | null): Measure | null =>
    workouts
      .filter((w) => w.trackId === trackId && w.sRpe)
      .reduce<Measure | null>((total, w) => (total ? add(total, w.sRpe!) : w.sRpe), null);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
        <caption className="sr-only">Workouts by day and program</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Day
            </th>
            {columns.map((t) => (
              <th key={t.id ?? "none"} scope="col" className="px-3 py-2 text-left text-xs font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: t.color ?? "var(--border-strong)" }} />
                  {t.name}
                  {t.archived && <span className="font-normal text-muted-foreground">(archived)</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day} className={cn("border-b border-border align-top last:border-0", day === today && "bg-primary-subtle/40")}>
              <th scope="row" className="px-3 py-2 text-left text-sm font-medium whitespace-nowrap">
                {dayLabel(day)}
                {day === today && <span className="ml-1.5 text-xs font-normal text-primary-text">today</span>}
              </th>
              {columns.map((column) => {
                const key = `${day}:${column.id ?? "none"}`;
                return (
                  <td
                    key={column.id ?? "none"}
                    {...dropTarget(key, day, column.id)}
                    className={cn("group/cell px-2 py-1.5", over === key && "bg-primary-subtle ring-2 ring-ring ring-inset")}
                  >
                    <div className="grid gap-1">{children(day, column)}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border-strong">
            <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Planned load
            </th>
            {columns.map((t) => {
              const total = weekTotal(t.id);
              return (
                <td key={t.id ?? "none"} className="px-3 py-2 text-xs text-muted-foreground tabular">
                  {total ? <Estimate measure={total} unit="AU" /> : "—"}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** "Move to…": the keyboard and touch way to move a workout. */
function MoveDialog({
  moving,
  tracks,
  onChange,
  onMove,
}: {
  moving: { workout: CalendarWorkout; date: string; trackId: string | null } | null;
  tracks: TrackOption[];
  onChange: (next: { workout: CalendarWorkout; date: string; trackId: string | null } | null) => void;
  onMove: () => void;
}) {
  const id = useId();
  const trackItems = tracks.filter((t) => !t.archived || t.id === moving?.workout.trackId).map((t) => ({ value: t.id, label: t.name }));
  return (
    <Dialog open={moving !== null} onOpenChange={(open) => !open && onChange(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move {moving?.workout.title || "the workout"}</DialogTitle>
          <DialogDescription>To another day or program. Its results and history move with it.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onMove();
          }}
        >
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-date`} className="text-sm font-medium">
              Date
            </label>
            <input
              id={`${id}-date`}
              type="date"
              required
              value={moving?.date ?? ""}
              onChange={(e) => moving && e.target.value && onChange({ ...moving, date: e.target.value })}
              className="h-8 rounded-md border border-input bg-surface px-2 text-sm tabular focus-visible:border-ring focus-visible:outline-none max-sm:text-base"
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-track`} className="text-sm font-medium">
              Program
            </label>
            <Select items={trackItems} value={moving?.trackId ?? null} onValueChange={(v) => moving && onChange({ ...moving, trackId: v ?? null })}>
              <SelectTrigger id={`${id}-track`} className="w-full">
                <SelectValue placeholder="No program" />
              </SelectTrigger>
              <SelectContent>
                {trackItems.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit">Move</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
