import type { Metadata } from "next";

import { Logo } from "@/components/app/logo";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-background px-4 pt-[16vh]">
      <div className="grid w-full max-w-sm gap-4">
        <Logo />
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground">The address may be mistyped, or the page has moved.</p>
        <ButtonLink href="/" className="w-fit">
          Go to the start
        </ButtonLink>
      </div>
    </main>
  );
}
