import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";
import { GymPage } from "@/components/app/gym-page";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage({ params }: PageProps<"/[gym]/analytics">) {
  return (
    <GymPage
      params={params}
      render={() => (
        <ComingSoon
          title="Analytics"
          description="Training load and balance over days, weeks and blocks."
          when="step 5"
          points={[
            "Weekly load with monotony, strain and week-on-week change.",
            "Movement pattern, plane, region and muscle balance over any date range.",
            "Warnings against your own thresholds, each linked to the workout that causes it.",
          ]}
        />
      )}
    />
  );
}
