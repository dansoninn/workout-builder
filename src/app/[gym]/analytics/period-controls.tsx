"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIOD_PRESETS } from "@/lib/analytics/period";
import { cn } from "@/lib/utils";

import type { TrackOption } from "../builder/builder";

/** The period (7, 14 or 30 days ending today, or any range) and the track, kept in the address. */
export function PeriodControls({
  slug,
  days,
  from,
  to,
  trackId,
  tracks,
}: {
  slug: string;
  /** The preset in use, or null for a custom range. */
  days: number | null;
  from: string;
  to: string;
  trackId: string | null;
  tracks: TrackOption[];
}) {
  const router = useRouter();
  const id = useId();
  const [custom, setCustom] = useState({ from, to });
  const go = (params: Record<string, string | null>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ program: trackId, ...params })) if (value) query.set(key, value);
    router.push(`/${slug}/analytics?${query}`);
  };
  const trackItems = [{ value: "all", label: "All programs" }, ...tracks.filter((t) => !t.archived || t.id === trackId).map((t) => ({ value: t.id, label: t.name }))];

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
      <div className="grid gap-1">
        <label htmlFor={`${id}-track`} className="text-xs font-medium text-muted-foreground">
          Program
        </label>
        <Select items={trackItems} value={trackId ?? "all"} onValueChange={(v) => go({ program: v === "all" ? null : v, ...(days ? { days: String(days) } : { from, to }) })}>
          <SelectTrigger id={`${id}-track`} className="w-44">
            <SelectValue />
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
    </div>
  );
}
