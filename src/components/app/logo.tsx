import { cn } from "@/lib/utils";

/** Three rising bars: training load over time. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={cn("size-5 shrink-0", className)}>
      <rect width="20" height="20" rx="5" className="fill-primary" />
      <rect x="4.5" y="10.5" width="2.6" height="5" rx="1" className="fill-primary-foreground" />
      <rect x="8.7" y="7.5" width="2.6" height="8" rx="1" className="fill-primary-foreground" />
      <rect x="12.9" y="4.5" width="2.6" height="11" rx="1" className="fill-primary-foreground" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-semibold tracking-tight", className)}>
      <LogoMark />
      Workout Builder
    </span>
  );
}
