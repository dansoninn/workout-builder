"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { gymHref, SETTINGS_PAGES } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Gym · Members · Tracks · Profile. Reads the URL, so it sits in a Suspense boundary. */
export function SettingsTabs() {
  const { gym } = useParams<{ gym: string }>();
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {SETTINGS_PAGES.map((p) => {
        const href = gymHref(gym, p.path);
        const active = pathname === href;
        return (
          <Link
            key={p.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex h-9 shrink-0 items-center border-b-2 border-transparent px-2.5 text-sm font-medium text-muted-foreground transition-colors duration-100 hover:text-foreground",
              active && "border-primary text-foreground",
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsTabsSkeleton() {
  return (
    <div aria-hidden className="flex h-9 gap-1 border-b border-border">
      {SETTINGS_PAGES.map((p) => (
        <span key={p.key} className="flex items-center px-2.5 text-sm font-medium text-muted-foreground">
          {p.label}
        </span>
      ))}
    </div>
  );
}
