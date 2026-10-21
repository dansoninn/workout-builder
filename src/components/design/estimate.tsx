import { cn } from "cn";

import type { Measure } from "@/lib/engine/types";
import { formatMeasure, type Unit } from "@/lib/format";

/**
 * A computed number, honest about uncertainty (docs/DESIGN.md): exact values
 * are plain; estimates show "~" and their range in a quieter tone.
 */
export function Estimate({ measure, unit, className }: { measure: Measure; unit: Unit; className?: string }) {
  const f = formatMeasure(measure, unit);
  return (
    <span className={cn("tabular inline-flex items-baseline gap-1 whitespace-nowrap", className)} aria-label={f.label} title={f.label}>
      <span aria-hidden>{f.main}</span>
      {f.range && (
        <span aria-hidden className="text-[0.8em] font-normal text-muted-foreground">
          {f.range}
        </span>
      )}
    </span>
  );
}
