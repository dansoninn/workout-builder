import type { Metadata } from "next";

import { Logo } from "@/components/app/logo";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = { title: "Account deleted" };

/** Where someone lands after deleting their own account. */
export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-background px-4 pt-[16vh]">
      <div className="grid w-full max-w-sm gap-4">
        <Logo />
        <h1 className="text-xl font-semibold">Your account was deleted</h1>
        <p className="text-muted-foreground">
          Your sign-in, your name and your place in your gyms are gone. The workouts and results you wrote stay with each gym,
          shown as written by a former member.
        </p>
        <div className="flex gap-2">
          <ButtonLink href="/sign-up" variant="outline">
            Create a new account
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
