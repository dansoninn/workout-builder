import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Page title, one line of context and (at most) one primary action. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="grid min-w-0 gap-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** The content column of every page inside a gym. */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10", className)}>{children}</div>;
}

/** Placeholder with the page's shape while it loads (never a spinner). */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <PageBody>
      <div aria-busy="true" aria-label="Loading" className="grid gap-6">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="grid gap-2">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </PageBody>
  );
}
