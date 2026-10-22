import { cn } from "cn";

import type { Measure } from "@/lib/engine/types";
import type { Unit } from "@/lib/format";

import { Estimate } from "./estimate";

/**
 * A measure per row as a thin bar (docs/DESIGN.md): the middle estimate
 * filled, the likely range a lighter band behind it, the number at the end.
 * The builder's load panel and Analytics use the same bars.
 */
export function Bars({
  title,
  rows,
  unit,
  empty,
  labelWidth = "8.5rem",
}: {
  title: string;
  rows: { key: string; label: React.ReactNode; measure: Measure }[];
  unit: Unit;
  empty?: string;
  labelWidth?: string;
}) {
  const max = Math.max(...rows.map((r) => r.measure.high), 1);
  return (
    <section aria-label={title} className="grid gap-1.5">
      <h3 className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {rows.length === 0 ? (
        empty && <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-1">
          {rows.map((r) => (
            <li key={r.key} className="grid items-center gap-2 text-sm" style={{ gridTemplateColumns: `${labelWidth} minmax(0,1fr) auto` }}>
              <span className="truncate">{r.label}</span>
              <span className="relative h-1.5 rounded-full bg-border" aria-hidden>
                <span className={cn("absolute inset-y-0 left-0 rounded-full bg-primary")} style={{ width: `${(r.measure.mid / max) * 100}%` }} />
                {r.measure.confidence === "estimated" && r.measure.high > r.measure.low && (
                  <span
                    className="absolute inset-y-0 rounded-full bg-primary/30"
                    style={{ left: `${(r.measure.low / max) * 100}%`, width: `${((r.measure.high - r.measure.low) / max) * 100}%` }}
                  />
                )}
              </span>
              <Estimate measure={r.measure} unit={unit} className="text-right" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
