import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DeletedGyms } from "@/components/app/deleted-gyms";
import { AuthHeading } from "@/components/auth/auth-page";
import { getMyGyms, requireUser } from "@/lib/session";

import { GymForm } from "./gym-form";

export const metadata: Metadata = { title: "Create your gym" };

export default function OnboardingPage() {
  return (
    <>
      <AuthHeading title="Create your gym">You&apos;ll be its owner, and can invite your coaches next.</AuthHeading>
      <GymForm />
      <p className="mt-6 text-muted-foreground">
        Joining a gym that already uses Workout Builder? Open the invitation link its owner sent you.
      </p>
      <Suspense>
        <BackToGyms />
      </Suspense>
    </>
  );
}

/** Signed-in check, a way back for people who already have a gym, and gyms they deleted that can still come back. */
async function BackToGyms() {
  await requireUser("/onboarding");
  const [gym] = await getMyGyms();
  return (
    <>
      {gym && (
        <p className="mt-2 text-muted-foreground">
          <Link href={`/${gym.slug}/builder`} className="font-medium text-primary-text underline-offset-4 hover:underline">
            Back to {gym.name}
          </Link>
        </p>
      )}
      <DeletedGyms className="mt-10 grid gap-1" />
    </>
  );
}
