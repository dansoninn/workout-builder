import type { Metadata } from "next";
import { Logo } from "@/components/app/logo";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = { title: "Link expired" };

export default function LinkExpiredPage() {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-background px-4 pt-[16vh]">
      <div className="grid w-full max-w-sm gap-4">
        <Logo />
        <h1 className="text-xl font-semibold">This link has expired or was already used</h1>
        <p className="text-muted-foreground">
          Email links work once, for a limited time, and some only in the browser where you asked for them. Ask for a new
          one, or sign in if you already confirmed.
        </p>
        <div className="flex gap-2">
          <ButtonLink href="/sign-in">Sign in</ButtonLink>
          <ButtonLink href="/forgot-password" variant="outline">
            Reset password
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
