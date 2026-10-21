import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionSkeleton, SettingsSection } from "@/components/app/settings";
import { requireUser } from "@/lib/session";

import { NameForm, PasswordForm, ThemeChoice } from "./profile-forms";

export const metadata: Metadata = { title: "Profile" };

/** Your own account, the same in every gym. */
export default function ProfilePage() {
  return (
    <div className="grid gap-10">
      <Suspense fallback={<SectionSkeleton rows={2} />}>
        <Account />
      </Suspense>
      <SettingsSection title="Theme" description="Light, dark, or follow this device. Remembered in this browser.">
        <ThemeChoice />
      </SettingsSection>
    </div>
  );
}

async function Account() {
  const user = await requireUser();
  return (
    <>
      <SettingsSection title="Profile" description={<>Signed in as {user.email}.</>}>
        <NameForm displayName={user.displayName} />
      </SettingsSection>
      <SettingsSection title="Password">
        <PasswordForm />
      </SettingsSection>
    </>
  );
}
