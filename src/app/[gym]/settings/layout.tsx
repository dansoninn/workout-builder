import { Suspense } from "react";

import { PageBody, PageHeader } from "@/components/app/page";
import { SettingsTabs, SettingsTabsSkeleton } from "@/components/app/settings-tabs";

export default function SettingsLayout({ children }: LayoutProps<"/[gym]/settings">) {
  return (
    <PageBody>
      <PageHeader title="Settings" description="Your gym, its people and tracks, and your own profile." />
      <Suspense fallback={<SettingsTabsSkeleton />}>
        <SettingsTabs />
      </Suspense>
      <div className="pt-8">{children}</div>
    </PageBody>
  );
}
