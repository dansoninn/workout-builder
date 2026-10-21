// Pace defaults, approved by Daniel on 2026-10-21 as the starting point (calc
// spec §9.5). Seeded into exercises.pace_default by a generated migration;
// every gym can override any pace (exercise_pace_overrides).
//
// Who: an intermediate adult class member. What: the working pace at Pace
// "Hard" (fast, near limit) including the short breaks such a member takes;
// transitions, pace-effort scaling, fatigue and the estimate band are rules in
// ENGINE_CONFIG (src/lib/engine/config.ts).
// Anchors from calc spec §9.5, at max effort (0.9 × Hard): row 2:00/500 m,
// air bike ~20 cal per 90 s.
//
// docs/pace-defaults.md is generated from this file.

import type { Pace } from "@/lib/engine/types";

/** Pace per core exercise, keyed by canonical name. Hold exercises (time) need none. */
export const PACE_DEFAULTS: Record<string, Pace> = {
  // Squat
  "Back squat": { secPerRep: 3.0 },
  "Front squat": { secPerRep: 3.0 },
  "Overhead squat": { secPerRep: 4.0 },
  "Air squat": { secPerRep: 2.0 },
  "Goblet squat": { secPerRep: 3.0 },
  "Dumbbell front squat": { secPerRep: 3.0 },
  "Wall ball": { secPerRep: 3.5 },
  "Thruster": { secPerRep: 3.5 },
  "Dumbbell thruster": { secPerRep: 3.5 },
  // Lunge & single leg
  "Walking lunge": { secPerRep: 3.0 },
  "Reverse lunge": { secPerRep: 3.0 },
  "Overhead walking lunge": { secPerRep: 3.5 },
  "Bulgarian split squat": { secPerRep: 3.5 },
  "Step-up": { secPerRep: 3.0 },
  "Box step-over": { secPerRep: 3.5 },
  "Pistol": { secPerRep: 5.0 },
  "Lateral lunge": { secPerRep: 3.5 },
  "Cossack squat": { secPerRep: 4.0 },
  // Hinge
  "Deadlift": { secPerRep: 3.0 },
  "Trap bar deadlift": { secPerRep: 3.0 },
  "Sumo deadlift": { secPerRep: 3.0 },
  "Romanian deadlift": { secPerRep: 3.0 },
  "Dumbbell Romanian deadlift": { secPerRep: 3.0 },
  "Dumbbell deadlift": { secPerRep: 3.0 },
  "Single-leg Romanian deadlift": { secPerRep: 4.0 },
  "Kettlebell swing": { secPerRep: 2.5 },
  "Kettlebell deadlift": { secPerRep: 2.5 },
  "Good morning": { secPerRep: 3.0 },
  "Hip thrust": { secPerRep: 3.0 },
  "Glute bridge": { secPerRep: 2.5 },
  "Back extension": { secPerRep: 3.0 },
  "Nordic hamstring curl": { secPerRep: 6.0 },
  // Olympic lifts & ballistics
  "Power clean": { secPerRep: 5.0 },
  "Squat clean": { secPerRep: 6.0 },
  "Hang power clean": { secPerRep: 4.0 },
  "Hang squat clean": { secPerRep: 5.0 },
  "Clean and jerk": { secPerRep: 8.0 },
  "Power snatch": { secPerRep: 5.0 },
  "Squat snatch": { secPerRep: 6.0 },
  "Hang power snatch": { secPerRep: 4.0 },
  "Push press": { secPerRep: 3.5 },
  "Push jerk": { secPerRep: 4.0 },
  "Split jerk": { secPerRep: 4.5 },
  "Shoulder-to-overhead": { secPerRep: 4.0 },
  "Ground-to-overhead": { secPerRep: 6.0 },
  "Dumbbell snatch": { secPerRep: 3.0 },
  "Dumbbell clean": { secPerRep: 3.5 },
  "Dumbbell clean and jerk": { secPerRep: 5.0 },
  "Kettlebell snatch": { secPerRep: 3.0 },
  "Kettlebell clean": { secPerRep: 3.0 },
  "Sandbag clean": { secPerRep: 6.0 },
  "Devil press": { secPerRep: 7.0 },
  "Turkish get-up": { secPerRep: 25.0 },
  // Vertical push
  "Strict press": { secPerRep: 3.0 },
  "Dumbbell shoulder press": { secPerRep: 3.0 },
  "Dumbbell push press": { secPerRep: 3.0 },
  "Handstand push-up": { secPerRep: 5.0 },
  "Pike push-up": { secPerRep: 3.5 },
  "Wall walk": { secPerRep: 20.0 },
  "Handstand walk": { secPerM: 5.0 },
  "Ring dip": { secPerRep: 4.0 },
  "Bar dip": { secPerRep: 3.5 },
  // Horizontal push & burpees
  "Bench press": { secPerRep: 3.0 },
  "Dumbbell bench press": { secPerRep: 3.0 },
  "Push-up": { secPerRep: 3.0 },
  "Burpee": { secPerRep: 5.0 },
  "Burpee box jump-over": { secPerRep: 7.0 },
  "Burpee pull-up": { secPerRep: 8.0 },
  // Vertical pull
  "Pull-up": { secPerRep: 3.5 },
  "Chest-to-bar pull-up": { secPerRep: 4.5 },
  "Chin-up": { secPerRep: 4.0 },
  "Lat pulldown": { secPerRep: 3.0 },
  "Bar muscle-up": { secPerRep: 10.0 },
  "Ring muscle-up": { secPerRep: 12.0 },
  "Rope climb": { secPerRep: 40.0 },
  // Horizontal pull
  "Ring row": { secPerRep: 3.0 },
  "Bent-over row": { secPerRep: 3.0 },
  "Single-arm dumbbell row": { secPerRep: 3.0 },
  "Renegade row": { secPerRep: 5.0 },
  "Band pull-apart": { secPerRep: 2.0 },
  "Face pull": { secPerRep: 2.5 },
  // Core & rotation
  "Toes-to-bar": { secPerRep: 4.5 },
  "Knees-to-elbows": { secPerRep: 3.5 },
  "Hanging knee raise": { secPerRep: 3.0 },
  "Sit-up": { secPerRep: 2.5 },
  "GHD sit-up": { secPerRep: 3.5 },
  "V-up": { secPerRep: 3.0 },
  "Hollow rock": { secPerRep: 1.5 },
  "Dead bug": { secPerRep: 3.0 },
  "Mountain climber": { secPerRep: 1.0 },
  "Bear crawl": { secPerM: 2.5 },
  "Ball slam": { secPerRep: 3.0 },
  "Russian twist": { secPerRep: 1.5 },
  "Woodchop": { secPerRep: 3.0 },
  "Rotational med ball throw": { secPerRep: 3.5 },
  "Landmine rotation": { secPerRep: 3.5 },
  "Pallof press": { secPerRep: 3.0 },
  // Jump & plyometrics
  "Box jump": { secPerRep: 4.0 },
  "Box jump-over": { secPerRep: 4.5 },
  "Broad jump": { secPerRep: 4.0 },
  "Jump squat": { secPerRep: 2.5 },
  "Jumping lunge": { secPerRep: 2.5 },
  "Tuck jump": { secPerRep: 3.0 },
  "Skater jump": { secPerRep: 2.0 },
  "Jumping jack": { secPerRep: 1.2 },
  // Carry & sled (seconds per metre)
  "Farmer carry": { secPerM: 1.2 },
  "Front rack carry": { secPerM: 1.4 },
  "Overhead carry": { secPerM: 1.6 },
  "Suitcase carry": { secPerM: 1.4 },
  "Sandbag carry": { secPerM: 1.6 },
  "Sled push": { secPerM: 2.0 },
  "Sled drag": { secPerM: 1.8 },
  "Sled pull": { secPerM: 3.0 },
  // Isolation
  "Calf raise": { secPerRep: 2.0 },
  // Monostructural
  "Run": { secPerM: 0.36 },
  "Row": { secPerM: 0.267, secPerCal: 4.5 },
  "Air bike": { secPerCal: 5.0 },
  "Bike erg": { secPerM: 0.13, secPerCal: 3.5 },
  "Ski erg": { secPerM: 0.3, secPerCal: 5.0 },
  "Double-under": { secPerRep: 1.0 },
  "Single-under": { secPerRep: 0.5 },
  "Swim": { secPerM: 1.5 },
};

