import { cn } from "cn";

import type { BlockIntent } from "@/lib/engine/types";
import { EFFORT_LABELS, INTENT_LABELS, PATTERN_LABELS, semanticColor } from "@/lib/labels";
import type { EffortKey, PatternKey } from "@/lib/taxonomy";

// Semantic tags (docs/DESIGN.md): a colour dot plus the label. Colour is never
// the only signal; the dot meets 3:1 against the surface in both themes.

function Tag({ color, children, className }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap text-foreground",
        className,
      )}
      style={{ backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </span>
  );
}

export function PatternTag({ pattern, className }: { pattern: PatternKey; className?: string }) {
  return (
    <Tag color={semanticColor("pattern", pattern)} className={className}>
      {PATTERN_LABELS[pattern]}
    </Tag>
  );
}

export function IntentTag({ intent, className }: { intent: BlockIntent; className?: string }) {
  return (
    <Tag color={semanticColor("intent", intent)} className={className}>
      {INTENT_LABELS[intent]}
    </Tag>
  );
}

/** Effort word with its axis, e.g. "Pace · Hard". */
export function EffortTag({ axis, effort, className }: { axis: "pace" | "load"; effort: EffortKey; className?: string }) {
  return (
    <Tag color={semanticColor("effort", effort)} className={className}>
      <span className="text-muted-foreground">{axis === "pace" ? "Pace" : "Load"}</span>
      {EFFORT_LABELS[effort]}
    </Tag>
  );
}
