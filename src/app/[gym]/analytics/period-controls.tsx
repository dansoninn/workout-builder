"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { PERIOD_PRESETS } from "@/lib/analytics/period";
import { cn } from "@/lib/utils";

import type { TrackOption } from "../builder/builder";
import { ProgramPicker } from "./program-picker";

/** The period (7, 14 or 30 days ending today, or any range) and the programs, kept in the address. */
export function PeriodControls({
  slug,
  days,
  from,
  to,
  programIds,
  tracks,
}: {
  slug: string;
  /** The preset in use, or null for a custom range. */
  days: number | null;
  from: string;
  to: string;
  /** The programs shown: one, or several the coach chose. */
  programIds: string[];
  tracks: TrackOption[];
}) {
  const router = useRouter();
  const id = useId();
  const [custom, setCustom] = useState({ from, to });
  const go = (params: Record<string, string | null>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ programs: programIds.join(","), ...params })) if (value) query.set(key, value);
    router.push(`/${slug}/analytics?${query}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <nav aria-label="Period" className="flex rounded-md border border-border p-0.5">
        {PERIOD_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            aria-current={days === n ? "true" : undefined}
            onClick={() => go({ days: String(n) })}
            className={cn(
              "flex h-7 items-center rounded-sm px-2.5 text-sm text-muted-foreground transition-colors duration-100 hover:text-foreground",
              days === n && "bg-hover font-medium text-foreground",
            )}
          >
            {n} days
          </button>
        ))}
      </nav>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.from && custom.to) go(custom.from <= custom.to ? { from: custom.from, to: custom.to } : { from: custom.to, to: custom.from });
        }}
      >
        <div className="grid gap-1">
          <label htmlFor={`${id}-from`} className="text-xs font-medium text-muted-foreground">
            From
          </label>
          <input id={`${id}-from`} type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            className="h-8 rounded-md border border-input bg-surface px-2 text-sm tabular focus-visible:border-ring focus-visible:outline-none max-sm:text-base" />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-to`} className="text-xs font-medium text-muted-foreground">
            To
          </label>
          <input id={`${id}-to`} type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            className="h-8 rounded-md border border-input bg-surface px-2 text-sm tabular focus-visible:border-ring focus-visible:outline-none max-sm:text-base" />
        </div>
        <Button type="submit" variant="outline">
          Show
        </Button>
      </form>
      <ProgramPicker
        programs={tracks.filter((t) => !t.archived || programIds.includes(t.id))}
        selected={programIds}
        onChange={(ids) => go({ programs: ids.join(","), ...(days ? { days: String(days) } : { from, to }) })}
      />
    </div>
  );
}
