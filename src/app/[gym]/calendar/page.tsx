import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";
import { GymPage } from "@/components/app/gym-page";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage({ params }: PageProps<"/[gym]/calendar">) {
  return (
    <GymPage
      params={params}
      render={() => (
        <ComingSoon
          title="Calendar"
          description="Your programming by week, per track."
          when="step 4b"
          points={[
            "A simple week list per track: open a workout, or start a new one on any day.",
            "The full calendar (day, week and month, drag and drop, templates on many dates) follows in step 5.",
          ]}
        />
      )}
    />
  );
}
