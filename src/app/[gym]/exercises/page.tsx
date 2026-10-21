import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";
import { GymPage } from "@/components/app/gym-page";

export const metadata: Metadata = { title: "Exercises" };

export default function ExercisesPage({ params }: PageProps<"/[gym]/exercises">) {
  return (
    <GymPage
      params={params}
      render={() => (
        <ComingSoon
          title="Exercises"
          description="The core library plus your gym's own exercises and names."
          when="step 4b"
          points={[
            "Search the 128-exercise core library with movement patterns, muscles and equipment.",
            "Owners and head coaches add gym exercises (pattern weights add up to 1.00) and gym names for existing ones.",
            "Gym paces: set how fast an exercise is done in your gym, next to the default.",
          ]}
        />
      )}
    />
  );
}
