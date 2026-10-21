"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { authPath } from "@/lib/paths";

/** Title and one line of context above an auth form. */
export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 grid gap-1">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children && <p className="text-muted-foreground">{children}</p>}
    </div>
  );
}

function NextInputInner() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

/**
 * Carries `?next=` into the form. In its own Suspense boundary so the form
 * itself is part of the static page and shows instantly.
 */
export function NextInput() {
  return (
    <Suspense fallback={null}>
      <NextInputInner />
    </Suspense>
  );
}

function SwitchLinkInner({ page, children }: { page: "/sign-in" | "/sign-up"; children: React.ReactNode }) {
  const next = useSearchParams().get("next");
  return (
    <Link href={authPath(page, next)} className="font-medium text-primary-text underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

/** Link to the other auth page, keeping `?next=`. */
export function SwitchLink({ page, children }: { page: "/sign-in" | "/sign-up"; children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <Link href={page} className="font-medium text-primary-text underline-offset-4 hover:underline">
          {children}
        </Link>
      }
    >
      <SwitchLinkInner page={page}>{children}</SwitchLinkInner>
    </Suspense>
  );
}
