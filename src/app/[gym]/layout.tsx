import { Suspense } from "react";

import { AppChrome } from "@/components/app/app-chrome";
import { MobileBar } from "@/components/app/mobile-bar";
import { ShellProvider } from "@/components/app/shell-context";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyGyms, requireUser } from "@/lib/session";

/**
 * The app shell. The frame is static and shows instantly; the sidebar (which
 * needs the user and their gyms) streams in behind its own boundary, and each
 * page checks membership itself.
 */
export default function GymLayout({ children, params }: LayoutProps<"/[gym]">) {
  return (
    <ShellProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Suspense fallback={<SidebarSkeleton />}>
          <Chrome params={params} />
        </Suspense>
        <main id="main" className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <MobileBar />
          {children}
        </main>
      </div>
    </ShellProvider>
  );
}

async function Chrome({ params }: { params: LayoutProps<"/[gym]">["params"] }) {
  const { gym } = await params;
  const [user, gyms] = await Promise.all([requireUser(`/${gym}/builder`), getMyGyms()]);
  return <AppChrome user={user} gyms={gyms} current={gyms.find((g) => g.slug === gym) ?? null} />;
}

function SidebarSkeleton() {
  return (
    <aside aria-hidden className="hidden w-60 shrink-0 border-r border-border bg-surface-sunken p-2 lg:flex lg:flex-col lg:gap-3">
      <div className="flex h-10 items-center gap-2 px-1.5">
        <Skeleton className="size-6" />
        <Skeleton className="h-4 flex-1" />
      </div>
      <Skeleton className="h-8" />
      <div className="grid gap-px">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="my-1.5 h-4 w-3/4" />
        ))}
      </div>
    </aside>
  );
}
