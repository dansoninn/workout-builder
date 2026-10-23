// Proposed core library additions, from running a year of a gym's programming
// through the parser (docs/library-coverage.md, 2026-10-23). NOT seeded:
// library changes need Daniel's approval. Written in the core library's own
// shape and conventions (core-exercises.ts, pace-defaults.ts) so an approved
// entry moves there as it is, with one generated migration for all of them.
//
// Names and aliases are general, the way most gyms write them. A gym's own
// phrasing ("DB in rubber band row") becomes that gym's alias when it imports
// its programming, not a core alias.

import type { Pace } from "@/lib/engine/types";
import type { CoreExercise } from "@/lib/library/core-exercises";
import type { EquipmentKey } from "@/lib/library/equipment";

const S = "sagittal";
const F = "frontal";
const T = "transverse";

export interface ProposedExercise {
  exercise: CoreExercise;
  pace: Pace | null;
}

const ISOLATION_NOTE = "No pattern: a single joint fits none of the patterns (as the calf raise). Counts in the muscle lens only.";

/** New exercises, by the core library's categories. */
export const PROPOSED_EXERCISES: ProposedExercise[] = [
  // --- Isolation: no pattern (Daniel to confirm the convention) --------------
  { exercise: { name: "Biceps curl", category: "isolation", kind: "movement", patterns: {}, plane: S, unit: "reps", implementCount: 2,
      primary: ["biceps"], secondary: ["forearms_grip"], equipment: ["dumbbell", "kettlebell", "barbell", "resistance_band"],
      aliases: ["bicep curl", "db curl", "dumbbell curl", "hammer curl", "spider curl", "crush grip curl", "crush grip bicep curl"],
      note: ISOLATION_NOTE }, pace: { secPerRep: 2.5 } },
  { exercise: { name: "Triceps extension", category: "isolation", kind: "movement", patterns: {}, plane: S, unit: "reps",
      primary: ["triceps"], equipment: ["dumbbell", "kettlebell", "resistance_band", "cable_machine"],
      aliases: ["tricep extension", "overhead tricep extension", "overhead triceps extension", "skull crusher", "lying tricep extension",
        "tricep kickback", "tricep kick back", "triceps kickback", "tricep pushdown", "triceps pushdown"],
      note: ISOLATION_NOTE }, pace: { secPerRep: 2.5 } },
  { exercise: { name: "Lateral raise", category: "isolation", kind: "movement", patterns: {}, plane: F, unit: "reps", implementCount: 2,
      primary: ["shoulders"], secondary: ["upper_back"], equipment: ["dumbbell", "kettlebell", "weight_plate", "resistance_band"],
      aliases: ["side raise", "lateral raises", "side lateral raise"], note: ISOLATION_NOTE }, pace: { secPerRep: 2.5 } },
  { exercise: { name: "Front raise", category: "isolation", kind: "movement", patterns: {}, plane: S, unit: "reps", implementCount: 2,
      primary: ["shoulders"], secondary: ["chest"], equipment: ["dumbbell", "kettlebell", "weight_plate", "resistance_band"],
      aliases: ["forward raise", "plate front raise"], note: ISOLATION_NOTE }, pace: { secPerRep: 2.5 } },
  { exercise: { name: "Side-lying leg raise", category: "isolation", kind: "movement", patterns: {}, plane: F, unit: "reps", unilateral: true,
      primary: ["glutes"], secondary: ["hip_flexors"],
      aliases: ["side lying leg raise", "side leg raise", "side lying hip abduction", "jane fonda"], note: ISOLATION_NOTE }, pace: { secPerRep: 1.5 } },
  { exercise: { name: "Halo", category: "isolation", kind: "movement", patterns: {}, plane: T, unit: "reps",
      primary: ["shoulders"], secondary: ["upper_back", "abs"], equipment: ["kettlebell", "dumbbell", "weight_plate"],
      aliases: ["kb halo", "kettlebell halo", "plate halo"],
      note: "Shoulder mobility under a light load. No pattern (as the calf raise) — or core: Daniel to choose." }, pace: { secPerRep: 3.0 } },

  // --- Hinge ----------------------------------------------------------------
  { exercise: { name: "Kettlebell sumo deadlift", category: "hinge", kind: "movement", patterns: { hinge: 1 }, plane: S, unit: "reps",
      primary: ["glutes", "adductors", "hamstrings"], secondary: ["quads", "lower_back", "forearms_grip"], equipment: ["kettlebell", "dumbbell"],
      aliases: ["kb sumo deadlift", "db sumo deadlift", "kb sumo dl", "sumo kb deadlift"],
      note: "One bell between the feet; \"Dbl. DB\" on the line makes it two." }, pace: { secPerRep: 2.5 } },
  { exercise: { name: "Kettlebell Romanian deadlift", category: "hinge", kind: "movement", patterns: { hinge: 1 }, plane: S, unit: "reps",
      primary: ["hamstrings", "glutes"], secondary: ["lower_back", "forearms_grip"], equipment: ["kettlebell"],
      aliases: ["kb romanian deadlift", "kb rdl", "kettlebell rdl"],
      note: "One bell in both hands (the Dumbbell Romanian deadlift holds two)." }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Suitcase deadlift", category: "hinge", kind: "movement", patterns: { hinge: 1 }, plane: F, unit: "reps", unilateral: true,
      primary: ["glutes", "hamstrings", "obliques"], secondary: ["forearms_grip", "lower_back", "quads"], equipment: ["kettlebell", "dumbbell"],
      aliases: ["suitcase dl", "single arm deadlift", "rotation suitcase deadlift"] }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Sumo deadlift high pull", category: "hinge", kind: "movement", patterns: { hinge: 0.7, v_pull: 0.3 }, plane: S, unit: "reps",
      primary: ["glutes", "hamstrings", "upper_back"], secondary: ["shoulders", "adductors", "forearms_grip"], equipment: ["barbell", "kettlebell"],
      aliases: ["sdhp", "sdlhp", "sumo deadlift high pull", "sumo high pull"], note: "Same split as the power clean." }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "High pull", category: "olympic", kind: "movement", patterns: { hinge: 0.6, v_pull: 0.4 }, plane: S, unit: "reps",
      primary: ["glutes", "hamstrings", "upper_back"], secondary: ["shoulders", "biceps", "forearms_grip"], equipment: ["barbell", "kettlebell", "dumbbell"],
      aliases: ["snatch high pull", "clean high pull", "snatch grip high pull", "standing high pull"] }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Kettlebell windmill", category: "core", kind: "movement", patterns: { core: 0.6, hinge: 0.4 }, plane: F, unit: "reps", unilateral: true,
      primary: ["obliques", "glutes", "hamstrings"], secondary: ["shoulders", "abs"], equipment: ["kettlebell", "dumbbell"],
      aliases: ["windmill", "kb windmill", "half kneeling windmill", "half kneeling kb windmill"],
      note: "Lateral bend and hinge under an overhead hold; the hold is not a press." }, pace: { secPerRep: 5.0 } },
  { exercise: { name: "Hamstring curl", category: "hinge", kind: "movement", patterns: { hinge: 1 }, plane: S, unit: "reps",
      primary: ["hamstrings"], secondary: ["calves"], equipment: ["resistance_band", "cable_machine"],
      aliases: ["leg curl", "lying hamstring curl", "lying leg curl"],
      note: "Knee flexion; hinge as for the Nordic hamstring curl (posterior chain). Please confirm." }, pace: { secPerRep: 2.5 } },
  { exercise: { name: "Ball over shoulder", category: "olympic", kind: "movement", patterns: { hinge: 0.7, squat: 0.3 }, plane: S, unit: "reps",
      primary: ["glutes", "hamstrings", "lower_back"], secondary: ["upper_back", "quads", "forearms_grip"], equipment: ["slam_ball", "sandbag"],
      aliases: ["heavy ball over shoulder", "d ball over shoulder", "sandbag over shoulder", "atlas stone over shoulder"],
      note: "\"Heavy ball\" (a dead ball) is listed as a slam ball until the equipment list has one." }, pace: { secPerRep: 5.0 } },

  // --- Squat and single leg ------------------------------------------------------
  { exercise: { name: "Bear-hug squat", category: "squat", kind: "movement", patterns: { squat: 1 }, plane: S, unit: "reps",
      primary: ["quads", "glutes"], secondary: ["upper_back", "abs", "adductors"], equipment: ["slam_ball", "sandbag"],
      aliases: ["bear hug squat", "heavy ball squat", "ball squat", "sandbag squat", "d ball squat"] }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Split squat", category: "lunge", kind: "movement", patterns: { lunge: 1 }, plane: S, unit: "reps", implementCount: 2, unilateral: true,
      primary: ["quads", "glutes"], secondary: ["adductors", "hamstrings"],
      aliases: ["static lunge", "stationary lunge"], note: "Load (DB/KB/barbell) goes on the workout line." }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Forward lunge", category: "lunge", kind: "movement", patterns: { lunge: 1 }, plane: S, unit: "reps", implementCount: 2, unilateral: true,
      primary: ["quads", "glutes"], secondary: ["adductors", "hamstrings"],
      aliases: ["front lunge"], note: "In place, stepping forward and back. Load goes on the workout line." }, pace: { secPerRep: 3.0 } },

  // --- Push -----------------------------------------------------------------
  { exercise: { name: "Floor press", category: "h_push", kind: "movement", patterns: { h_push: 1 }, plane: S, unit: "reps", implementCount: 2,
      primary: ["chest", "triceps"], secondary: ["shoulders"], equipment: ["dumbbell", "kettlebell", "barbell", "slam_ball"],
      aliases: ["db floor press", "kb floor press", "heavy ball floor press", "ball floor press", "hollow body floor press"] }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Incline dumbbell bench press", category: "h_push", kind: "movement", patterns: { h_push: 0.7, v_push: 0.3 }, plane: S, unit: "reps", implementCount: 2,
      primary: ["chest", "shoulders", "triceps"], equipment: ["dumbbell", "kettlebell", "bench"],
      aliases: ["db incline bench press", "incline db bench press", "incline dumbbell press", "db incline press", "incline db press", "kb incline bench press"],
      note: "Between a bench press and an overhead press." }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Chest fly", category: "h_push", kind: "movement", patterns: { h_push: 1 }, plane: T, unit: "reps", implementCount: 2,
      primary: ["chest"], secondary: ["shoulders"], equipment: ["dumbbell", "cable_machine", "resistance_band"],
      aliases: ["db chest fly", "dumbbell fly", "incline chest fly", "db incline chest fly"] }, pace: { secPerRep: 2.5 } },
  { exercise: { name: "Hindu push-up", category: "h_push", kind: "movement", patterns: { h_push: 0.6, v_push: 0.4 }, plane: S, unit: "reps",
      primary: ["chest", "shoulders", "triceps"], secondary: ["lower_back", "abs"],
      aliases: ["hindu push up", "dive bomber push up", "soft yoga press"],
      note: "\"Soft yoga press\" taken as its easier form: please confirm." }, pace: { secPerRep: 4.0 } },
  { exercise: { name: "Arnold press", category: "v_push", kind: "movement", patterns: { v_push: 1 }, plane: S, unit: "reps", implementCount: 2,
      primary: ["shoulders", "triceps"], secondary: ["upper_back"], equipment: ["dumbbell", "kettlebell"],
      aliases: ["db arnold press", "seated arnold press", "seated db arnold press"] }, pace: { secPerRep: 3.5 } },
  { exercise: { name: "Kettlebell press", category: "v_push", kind: "movement", patterns: { v_push: 1 }, plane: S, unit: "reps", unilateral: true,
      primary: ["shoulders", "triceps"], secondary: ["upper_back", "abs"], equipment: ["kettlebell"],
      aliases: ["kb press", "kb strict press", "strict kb press", "kb shoulder press", "seated kb press", "kb seated press",
        "single arm kb press", "bottoms up press", "kb bottoms up press"] }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Seesaw press", category: "v_push", kind: "movement", patterns: { v_push: 1 }, plane: S, unit: "reps", implementCount: 2, unilateral: true,
      primary: ["shoulders", "triceps"], secondary: ["obliques", "upper_back"], equipment: ["kettlebell", "dumbbell"],
      aliases: ["see saw press", "seated seesaw press", "incline seesaw press"], note: "Two bells, one arm up while the other comes down." }, pace: { secPerRep: 3.0 } },

  // --- Pull -----------------------------------------------------------------
  { exercise: { name: "Dumbbell bent-over row", category: "h_pull", kind: "movement", patterns: { h_pull: 1 }, plane: S, unit: "reps", implementCount: 2,
      primary: ["upper_back", "lats"], secondary: ["biceps", "lower_back", "forearms_grip"], equipment: ["dumbbell", "kettlebell"],
      aliases: ["db bent over row", "kb bent over row", "bent over db row", "bent over kb row", "seesaw row", "kb seesaw row"] }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Gorilla row", category: "h_pull", kind: "movement", patterns: { h_pull: 1 }, plane: S, unit: "reps", implementCount: 2, unilateral: true,
      primary: ["upper_back", "lats"], secondary: ["biceps", "lower_back", "hamstrings"], equipment: ["kettlebell", "dumbbell"],
      aliases: ["kb gorilla row"], note: "Alternating rows from a deep hinge; the hinge is a hold, not a pattern." }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Bent-over shoulder fly", category: "h_pull", kind: "movement", patterns: { h_pull: 1 }, plane: T, unit: "reps", implementCount: 2,
      primary: ["shoulders", "upper_back"], equipment: ["dumbbell", "weight_plate", "resistance_band", "cable_machine"],
      aliases: ["bent over shoulder fly", "shoulder fly", "rear delt fly", "reverse fly", "bent over reverse fly", "bent over reverse shoulder fly",
        "bent over lateral raise", "rear delt raise"],
      note: "Rear shoulders, arms out to the side: h_pull, as the band pull-apart." }, pace: { secPerRep: 2.5 } },
  { exercise: { name: "Band row", category: "h_pull", kind: "movement", patterns: { h_pull: 1 }, plane: S, unit: "reps",
      primary: ["upper_back", "lats"], secondary: ["biceps"], equipment: ["resistance_band", "cable_machine"],
      aliases: ["seated band row", "band seated row", "seated row", "seated cable row", "cable row"] }, pace: { secPerRep: 2.5 } },
  { exercise: { name: "Dumbbell pullover", category: "v_pull", kind: "movement", patterns: { v_pull: 1 }, plane: S, unit: "reps",
      primary: ["lats", "chest"], secondary: ["triceps", "abs"], equipment: ["dumbbell", "kettlebell", "bench"],
      aliases: ["pullover", "db pullover", "lat pullover", "lat pull over", "lat pull over on bench", "db lat pull over"],
      note: "Shoulder extension, overhead to the hips: v_pull." }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Kip swing", category: "v_pull", kind: "movement", patterns: { core: 0.6, v_pull: 0.4 }, plane: S, unit: "reps",
      primary: ["lats", "abs", "shoulders"], secondary: ["hip_flexors", "forearms_grip"], equipment: ["pull_up_bar"],
      aliases: ["beat swing", "kipping swing", "hollow arch swing", "beat swing work"] }, pace: { secPerRep: 2.0 } },

  // --- Core -----------------------------------------------------------------
  { exercise: { name: "Bicycle crunch", category: "core", kind: "movement", patterns: { core: 0.5, rotation: 0.5 }, plane: T, unit: "reps",
      primary: ["abs", "obliques"], secondary: ["hip_flexors"], aliases: ["bicycle", "bicycle sit up"] }, pace: { secPerRep: 1.5 } },
  { exercise: { name: "Reverse crunch", category: "core", kind: "movement", patterns: { core: 1 }, plane: S, unit: "reps",
      primary: ["abs"], secondary: ["hip_flexors"] }, pace: { secPerRep: 2.0 } },
  { exercise: { name: "Lying leg raise", category: "core", kind: "movement", patterns: { core: 1 }, plane: S, unit: "reps",
      primary: ["abs", "hip_flexors"], aliases: ["leg raise", "leg lift", "lying leg lift", "russian leg lift"],
      note: "\"Russian leg lifts\" taken as lying leg raises: please confirm." }, pace: { secPerRep: 2.0 } },
  { exercise: { name: "Toe touch", category: "core", kind: "movement", patterns: { core: 1 }, plane: S, unit: "reps",
      primary: ["abs"], secondary: ["hip_flexors"], aliases: ["straight leg toe touch", "lying toe touch", "toe touch crunch"] }, pace: { secPerRep: 2.0 } },
  { exercise: { name: "Flutter kick", category: "core", kind: "movement", patterns: { core: 1 }, plane: S, unit: "reps",
      primary: ["abs", "hip_flexors"], aliases: ["hollow body flutter kick", "hollow flutter kick"] }, pace: { secPerRep: 0.7 } },
  { exercise: { name: "Ab wheel rollout", category: "core", kind: "movement", patterns: { core: 1 }, plane: S, unit: "reps",
      primary: ["abs"], secondary: ["lats", "shoulders"], aliases: ["ab wheel", "ab rollout", "rollout", "evil wheel"],
      note: "No ab wheel in the equipment list (locked): bodyweight here. \"Evil wheel\" taken as an ab wheel: please confirm." }, pace: { secPerRep: 3.5 } },
  { exercise: { name: "Dynamic side plank", category: "core", kind: "movement", patterns: { core: 1 }, plane: F, unit: "reps", unilateral: true,
      primary: ["obliques"], secondary: ["abs", "shoulders"],
      aliases: ["side plank hip dip", "side plank dip", "side plank with rotation", "side plank rotation"] }, pace: { secPerRep: 2.5 } },
  { exercise: { name: "Plank shoulder tap", category: "core", kind: "movement", patterns: { core: 1 }, plane: S, unit: "reps",
      primary: ["abs", "obliques"], secondary: ["shoulders"], aliases: ["shoulder tap", "tall plank shoulder tap", "high plank shoulder tap"] }, pace: { secPerRep: 1.5 } },
  { exercise: { name: "Plank drag-through", category: "core", kind: "movement", patterns: { core: 1 }, plane: T, unit: "reps",
      primary: ["abs", "obliques"], secondary: ["shoulders", "upper_back"], equipment: ["kettlebell", "dumbbell"],
      aliases: ["drag through", "kb drag through", "tall plank drag through", "tall plank kb drag through", "plank pull through", "kb pull through"] },
    pace: { secPerRep: 2.5 } },
  { exercise: { name: "Up-down plank", category: "core", kind: "movement", patterns: { core: 0.7, h_push: 0.3 }, plane: S, unit: "reps",
      primary: ["abs", "triceps", "shoulders"], secondary: ["chest"], aliases: ["up down plank", "plank up down", "plank walk up", "commando plank"] },
    pace: { secPerRep: 3.0 } },
  { exercise: { name: "Bird dog", category: "core", kind: "movement", patterns: { core: 1 }, plane: S, unit: "reps", unilateral: true,
      primary: ["lower_back", "glutes", "abs"] }, pace: { secPerRep: 3.0 } },
  { exercise: { name: "Bear crawl hold", category: "core", kind: "movement", patterns: { core: 1 }, plane: S, unit: "time_s",
      primary: ["abs", "shoulders", "quads"], aliases: ["strict bear crawl hold", "bear hold", "bear plank", "hover hold"] }, pace: null },
  { exercise: { name: "Superman hold", category: "core", kind: "movement", patterns: { core: 1 }, plane: S, unit: "time_s",
      primary: ["lower_back", "glutes"], secondary: ["upper_back"], aliases: ["superman", "arch hold"] }, pace: null },
  { exercise: { name: "Handstand hold", category: "v_push", kind: "movement", patterns: { v_push: 1 }, plane: S, unit: "time_s",
      primary: ["shoulders", "triceps"], secondary: ["abs", "upper_back"],
      aliases: ["handstand", "wall facing handstand hold", "wall handstand hold", "chest to wall handstand hold", "hs hold"],
      note: "A hold, by time: v_push as the closest pattern — or none, as the overhead squat's hold. Daniel to choose." }, pace: null },

  // --- Jump and burpee --------------------------------------------------------
  { exercise: { name: "Sprawl", category: "h_push", kind: "movement", patterns: { squat: 0.5, core: 0.5 }, plane: S, unit: "reps",
      primary: ["quads", "abs", "hip_flexors"], secondary: ["chest", "shoulders", "glutes"], aliases: ["target sprawl"],
      note: "A burpee without the push-up and the jump." }, pace: { secPerRep: 3.5 } },
  { exercise: { name: "Pogo jump", category: "jump", kind: "movement", patterns: { jump: 1 }, plane: S, unit: "reps",
      primary: ["calves"], secondary: ["quads"], aliases: ["pogo hop", "pogos"] }, pace: { secPerRep: 0.8 } },
];

/** New aliases and equipment for exercises already in the core library. */
export const PROPOSED_CHANGES: { exercise: string; aliases?: string[]; equipment?: EquipmentKey[]; why: string }[] = [
  { exercise: "Single-arm dumbbell row", aliases: ["kb row", "single arm kb row", "one arm row", "bird dog row", "bird dog row on bench"], equipment: ["kettlebell"],
    why: "\"KB Row (Box Support)\": one arm, supported. A bare \"row\" with a count is asked." },
  { exercise: "Single-leg Romanian deadlift", aliases: ["slrdl", "sl deadlift"], why: "Common short form (\"KB SLRDL\")." },
  { exercise: "Kettlebell swing", aliases: ["swing", "hike swing", "single arm swing", "one arm swing", "single arm kb swing"], why: "\"Swing\" alone is a kettlebell swing in practice." },
  { exercise: "Hip thrust", aliases: ["hip thrust on bench"], equipment: ["dumbbell", "kettlebell"], why: "DB hip thrusts (18 in the year)." },
  { exercise: "Bent-over row", aliases: ["pendley row"], why: "A frequent spelling of Pendlay." },
  { exercise: "Ring row", aliases: ["trx row", "suspension row"], why: "Rings or a suspension trainer, the same row." },
  { exercise: "Band pull-apart", aliases: ["band apart"], why: "\"20 x Band Apart\"." },
  { exercise: "Bulgarian split squat", aliases: ["bulgarian squat", "bulgarian"], why: "Short form." },
  { exercise: "Goblet squat", aliases: ["heel elevated goblet squat", "heel elevated narrow stance goblet squat", "narrow stance goblet squat"],
    why: "Variations of the same lift." },
  { exercise: "Bar dip", aliases: ["dips in rack", "dip in rack", "rack dip"], why: "Dips between the rack's arms." },
  { exercise: "Jump squat", aliases: ["air squat jump"], why: "Same movement." },
  { exercise: "Jumping lunge", aliases: ["split squat jump"], why: "Same movement." },
  { exercise: "Box jump", aliases: ["high box jump"], why: "Same movement, a higher box." },
  { exercise: "Sit-up", aliases: ["butterfly sit up", "weighted sit up"], why: "The AbMat sit-up is a butterfly sit-up." },
  { exercise: "V-up", aliases: ["tuck up"], why: "The tucked form of the same movement." },
  { exercise: "Burpee", aliases: ["burpee over kb", "burpee over db", "burpee over dumbbell", "lateral burpee", "lateral burpee over bar", "lat burpee over bar", "lateral burpee over db"],
    why: "Burpees over an implement are burpees (as \"burpee over bar\" already is)." },
  { exercise: "Mountain climber", aliases: ["mt climber"], why: "Short form." },
  { exercise: "Plank", aliases: ["tall plank", "high plank"], why: "The plank on the hands." },
  { exercise: "Lat pulldown", equipment: ["resistance_band"], why: "\"Rubber band lat pull down\" (15 in the year): read already, as a band on a bodyweight-listed exercise; the equipment should say it." },
  { exercise: "Pull-up", aliases: ["wide grip pull up", "band assisted pull up"], why: "Grip and assistance on the same exercise (\"Strict Wide Grip Pull Ups\")." },
  { exercise: "Reverse lunge", aliases: ["reverse lunge from plate", "deficit reverse lunge", "goblet reverse lunge"], why: "Variations of the same lunge." },
  { exercise: "Air bike", aliases: ["assault"], why: "Short form." },
  { exercise: "Row", aliases: ["row on rower", "row erg", "rowing machine"], why: "Always the machine." },
  { exercise: "Shoulder-to-overhead", equipment: ["dumbbell", "kettlebell"], why: "\"DB S2OH\", \"KB STOH\" (14 in the year)." },
  { exercise: "Dumbbell thruster", aliases: ["kb thruster"], equipment: ["kettlebell"], why: "Same movement with kettlebells." },
  { exercise: "Dumbbell push press", aliases: ["kb push press"], equipment: ["kettlebell"], why: "Same movement with kettlebells." },
  { exercise: "Dumbbell clean and jerk", aliases: ["kb clean and jerk"], equipment: ["kettlebell"], why: "Same movement with a kettlebell." },
  { exercise: "Dumbbell snatch", aliases: ["db hang snatch", "hang db snatch"], why: "The hang start is the same exercise (as for the DB clean)." },
  { exercise: "Strict press", aliases: ["z press", "strict overhead press"], why: "Seated or standing, the same press." },
  { exercise: "Woodchop", aliases: ["half kneeling chop", "half kneeling woodchop"], equipment: ["kettlebell", "dumbbell"], why: "\"Half-kneeling KB chop\"." },
  { exercise: "Overhead squat", aliases: ["oh squat"], why: "Short form." },
  { exercise: "Bench press", aliases: ["close grip bench press"], why: "A grip of the same lift." },
  { exercise: "Deadlift", aliases: ["snatch grip deadlift"], why: "A grip of the same lift." },
  { exercise: "Wall walk", aliases: ["wall climb"], why: "Another name." },
];

/** New generic words: asked once, saved as the gym's answer. */
export const PROPOSED_AMBIGUOUS: { term: string; candidates: string[] }[] = [
  { term: "hang snatch", candidates: ["Hang power snatch", "Dumbbell snatch", "Squat snatch"] },
];

/** Words seen often whose meaning the library cannot guess: Daniel to say what they are. */
export const UNCLEAR_WORDS: { words: string; seen: string }[] = [
  { words: "punt lunges", seen: "\"8-16 x Alt. DB Punt Lunges\"" },
  { words: "forward press", seen: "\"10 x Forward Press\", \"DB Forward Press\"" },
  { words: "hip to overhead", seen: "\"20 x Hip to Overhead\", \"… with straight arms\"" },
  { words: "90° hold", seen: "\"20 sec 90° Hold\"" },
  { words: "horse stance hold", seen: "\"40 sec Horse Stance Hold\", \"… with KB if able\"" },
  { words: "heel tap", seen: "\"20 x Heel Tap\", \"30s Heel Tap\"" },
  { words: "reverse salamander", seen: "\"Reverse Salamander\" as a station" },
];
