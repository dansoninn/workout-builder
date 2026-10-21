import { Skeleton } from "@/components/ui/skeleton";

/** The builder's shape while the workout and library load (never a spinner). */
export function BuilderSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex min-h-full flex-col">
      <div className="flex h-12 items-center gap-2 border-b border-border px-4 lg:px-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="ml-auto h-7 w-20" />
        <Skeleton className="h-7 w-20" />
      </div>
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="grid content-start gap-4 px-4 py-5 lg:px-6">
          <div className="flex gap-3">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-44" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
        <div className="hidden border-l border-border bg-surface-sunken p-4 lg:grid lg:content-start lg:gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-24" />
        </div>
      </div>
    </div>
  );
}
