import { cn } from "cn";

import { EFFORT_BOXES, EFFORT_LABELS, semanticColor } from "@/lib/labels";
import { EFFORT_KEYS } from "@/lib/taxonomy";

/** The four effort boxes with what each means (calc spec §4.4): the same words in the builder, the parser and here. */
export function EffortLegend({ className }: { className?: string }) {
  return (
    <section aria-label="Effort boxes" className={cn("grid gap-1.5", className)}>
      <h3 className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">Effort</h3>
      <dl className="grid gap-1.5 text-xs">
        {EFFORT_KEYS.map((key) => (
          <div key={key} className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-2">
            <dt className="flex items-center gap-1.5 font-medium">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: semanticColor("effort", key) }} />
              {EFFORT_LABELS[key]}
            </dt>
            <dd className="text-muted-foreground">
              <span className="tabular text-foreground">
                {EFFORT_BOXES[key].percent} · RPE {EFFORT_BOXES[key].rpe}
              </span>{" "}
              {EFFORT_BOXES[key].description}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
