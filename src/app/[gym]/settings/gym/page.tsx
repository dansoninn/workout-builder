import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";

import { GymPage } from "@/components/app/gym-page";
import { ReadOnlyNote, SectionSkeleton, SettingsSection } from "@/components/app/settings";
import { buttonVariants } from "@/components/ui/button";
import { countryName } from "@/lib/countries";
import { can } from "@/lib/permissions";

import { GymSettingsForm } from "./gym-settings-form";

export const metadata: Metadata = { title: "Gym settings" };

export default function GymSettingsPage({ params }: PageProps<"/[gym]/settings/gym">) {
  return (
    <GymPage
      params={params}
      fallback={<SectionSkeleton rows={2} />}
      render={(gym) => (
        <div className="grid grid-cols-1 gap-10">
          <SettingsSection title="Gym" description="How your gym appears to everyone in it.">
            {can.editGym(gym.role) ? (
              <GymSettingsForm slug={gym.slug} name={gym.name} country={gym.country} />
            ) : (
              <>
                <dl className="grid max-w-md grid-cols-[8rem_1fr] gap-x-4 gap-y-2">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{gym.name}</dd>
                  <dt className="text-muted-foreground">Country</dt>
                  <dd>{countryName(gym.country) ?? "Not set"}</dd>
                </dl>
                <ReadOnlyNote>Only the gym&apos;s owners can change these.</ReadOnlyNote>
              </>
            )}
          </SettingsSection>
          <SettingsSection title="Address" description="Where the gym's pages live. Bookmarks and shared links use it.">
            <p className="font-mono text-sm">/{gym.slug}</p>
            <ReadOnlyNote>The address can&apos;t be changed yet.</ReadOnlyNote>
          </SettingsSection>
          {can.editGym(gym.role) && (
            <SettingsSection
              title="Your gym's data"
              description="Everything your gym has stored here: programs, workouts with the text they were written as, results, your own exercises and names, members and invitations, guidelines, and the history of changes. One zip file, as JSON and as spreadsheets (CSV)."
            >
              {/* A plain link: a download is never prefetched. */}
              <a href={`/${gym.slug}/settings/gym/export`} download className={buttonVariants({ variant: "outline", className: "w-fit" })}>
                <DownloadIcon /> Export the gym&apos;s data
              </a>
            </SettingsSection>
          )}
        </div>
      )}
    />
  );
}
