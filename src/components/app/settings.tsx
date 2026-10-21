import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** One settings area: a heading, a line of context, an optional action, the content. */
export function SettingsSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cn("grid grid-cols-1 gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 id={id} className="text-lg font-semibold">
            {title}
          </h2>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Shown when you can see but not change a setting. */
export function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid gap-4">
      <div className="grid gap-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg border border-border">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 rounded-none" />
        ))}
      </div>
    </div>
  );
}
