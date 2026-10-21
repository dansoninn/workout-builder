import type { Metadata } from "next";

import { ComingSoon } from "@/components/app/coming-soon";
import { GymPage } from "@/components/app/gym-page";

export const metadata: Metadata = { title: "Builder" };

export default function BuilderPage({ params }: PageProps<"/[gym]/builder">) {
  return (
    <GymPage
      params={params}
      render={() => (
        <ComingSoon
          title="Builder"
          description="Program a workout block by block and see its training load while you type."
          when="step 4b"
          points={[
            "Blocks A, B, C… with intent, format (sets, EMOM, AMRAP, for time, intervals, tabata), and Pace and Load as effort words.",
            "Lines with exercise search (your gym's names first), reps, distance, calories or time, and loads like 22.5/15 kg or 75–80%.",
            "A live load panel: session length and planned load as honest ranges, movement patterns, muscles, and warnings that point to their line.",
            "Save with ⌘S. Unsaved work is backed up in this browser.",
          ]}
        />
      )}
    />
  );
}
