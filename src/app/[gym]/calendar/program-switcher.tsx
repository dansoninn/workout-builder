"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { TrackOption } from "../builder/builder";
import { rememberCalendarProgram } from "./actions";

/**
 * Which program the calendar shows (decision 3, 2026-10-23): one program, as
 * its own space, or "All programs" with their colours. The choice is
 * remembered for this person in this gym, on any device.
 */
export function ProgramSwitcher({
  slug,
  programs,
  value,
  query,
}: {
  slug: string;
  /** The active programs, plus the one shown if it is archived. */
  programs: TrackOption[];
  /** A program id, or "all". */
  value: string;
  /** The rest of the calendar's address (view and date), kept when switching. */
  query: string;
}) {
  const router = useRouter();
  const id = useId();
  const [, startTransition] = useTransition();
  const label = (v: string) => {
    const program = programs.find((p) => p.id === v);
    return program ? `${program.name}${program.archived ? " (archived)" : ""}` : "All programs";
  };
  const items = [...programs.map((p) => ({ value: p.id, label: label(p.id) })), { value: "all", label: "All programs" }];

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground max-sm:sr-only">
        Program
      </label>
      <Select
        items={items}
        value={value}
        onValueChange={(v) => {
          if (!v || v === value) return;
          startTransition(async () => {
            router.push(`/${slug}/calendar?${query}&program=${v}`);
            await rememberCalendarProgram(slug, v);
          });
        }}
      >
        <SelectTrigger id={id} className="w-48">
          <SelectValue>
            {(v: string) => (
              <>
                <ProgramDot colors={v === "all" ? programs.map((p) => p.color) : [programs.find((p) => p.id === v)?.color ?? null]} />
                <span className="truncate">{label(v)}</span>
              </>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {programs.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <ProgramDot colors={[p.color]} />
              {label(p.id)}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value="all">
            <ProgramDot colors={programs.map((p) => p.color)} />
            All programs
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** A program's colour; for all programs, their colours share one dot. */
function ProgramDot({ colors }: { colors: (string | null)[] }) {
  const shown = colors.map((c) => c ?? "var(--border-strong)");
  const slice = 100 / Math.max(shown.length, 1);
  const background =
    shown.length > 1 ? `conic-gradient(${shown.map((c, i) => `${c} ${i * slice}% ${(i + 1) * slice}%`).join(", ")})` : (shown[0] ?? "var(--border-strong)");
  return <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background }} />;
}
