import type { Metadata } from "next";
import { Suspense } from "react";

import { DeletedGyms } from "@/components/app/deleted-gyms";
import { SectionSkeleton, SettingsSection } from "@/components/app/settings";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { DeleteAccount, NameForm, PasswordForm, ThemeChoice } from "./profile-forms";

export const metadata: Metadata = { title: "Profile" };

/** Your own account, the same in every gym. */
export default function ProfilePage() {
  return (
    <div className="grid grid-cols-1 gap-10">
      <Suspense fallback={<SectionSkeleton rows={2} />}>
        <Account />
      </Suspense>
      <SettingsSection title="Theme" description="Light, dark, or follow this device. Remembered in this browser.">
        <ThemeChoice />
      </SettingsSection>
      <Suspense>
        <DeletedGyms className="grid gap-1" />
      </Suspense>
      <Suspense fallback={<SectionSkeleton rows={1} />}>
        <DeleteSection />
      </Suspense>
    </div>
  );
}

/** The gyms whose only owner this person is: they cannot leave those without an owner. */
async function soleOwnerOf(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: mine, error } = await supabase.from("memberships").select("org_id, organizations (name)").eq("user_id", userId).eq("role", "owner");
  if (error) throw error;
  if (mine.length === 0) return [];
  const { data: owners, error: ownersError } = await supabase
    .from("memberships")
    .select("org_id")
    .in("org_id", mine.map((m) => m.org_id))
    .eq("role", "owner");
  if (ownersError) throw ownersError;
  return mine
    .filter((m) => owners.filter((o) => o.org_id === m.org_id).length === 1)
    .map((m) => m.organizations?.name ?? "a gym")
    .sort((a, b) => a.localeCompare(b));
}

async function DeleteSection() {
  const user = await requireUser();
  return (
    <SettingsSection title="Delete your account" description="Your account is yours: you can delete it at any time. The gyms keep their workouts and results.">
      <DeleteAccount email={user.email} soleOwnerOf={await soleOwnerOf(user.id)} />
    </SettingsSection>
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
