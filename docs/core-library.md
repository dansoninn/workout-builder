# Core exercise library

**Status:** approved by Daniel on 2026-10-21 (Step 2). Seeded by migration `20261021001000_core_exercise_library.sql`. The **Implements** column (calc spec §9.8) was added in Step 3 and is a proposal pending review.

Generated from `src/lib/library/` by `npm run library:generate`; do not edit by hand. To change the library, edit the source and regenerate. Once the seed is on the remote database, changes need a new migration (see BACKLOG).

## Conventions

- Pattern weights sum to 1.00, in steps of 0.1, at most three patterns. Dominant phase 0.6–0.7, secondary phase 0.3–0.4. The seven examples in calc spec §3 are used unchanged.
- Holds and braces are not presses: overhead squat, overhead lunges, carries, the Turkish get-up and the arms on a sled push have no v_push or h_push.
- A movement that fits none of the 11 patterns (calf raise) has no pattern and counts in muscle analytics only.
- Monostructural exercises (run, row, bike, ski, jump rope, swim) have a modality and **no patterns and no muscles**: they are measured by Lens 3 (distance, calories, time).
- Muscles: primary = prime movers (1.0 hard set), secondary = 0.5 set (calc spec Lens 1). At most three of each.
- Every core exercise has a plane (none left uncurated).
- Equipment is what the exercise is done with; several items means any one of them. Bodyweight exercises list none. Optional loading (e.g. a DB walking lunge) is recorded as the load on the workout line, not as a separate exercise. Barbell, dumbbell and kettlebell versions of the main lifts are separate exercises.
- Implements: how many implements the exercise uses when loaded (2 for two dumbbells or kettlebells). Volume load = kg per implement × implements × reps. The coach can override it on a workout line.
- Aliases are stored normalised (lower case, no punctuation). The canonical name is always an alias. Plurals ("kb swings") are handled by the parser in Step 4.
- Generic words that could mean several exercises are **not** aliases: they are ambiguous terms (below). The parser asks the coach once and saves the answer as a gym alias.
- Pace defaults are left empty until calc spec §9.5 (which population to calibrate to) is decided.

## Summary

128 exercises. ↔ = unilateral.

| Category | Exercises |
|---|---|
| Squat | 10 |
| Lunge & single leg | 9 |
| Hinge | 14 |
| Olympic lifts & ballistics | 21 |
| Vertical push | 9 |
| Horizontal push & burpees | 6 |
| Vertical pull | 7 |
| Horizontal pull | 6 |
| Core & rotation | 21 |
| Jump & plyometrics | 8 |
| Carry & sled | 8 |
| Isolation (no pattern) | 1 |
| Monostructural | 8 |

## Equipment (26)

| Key | Label | Used by |
|---|---|---|
| `barbell` | Barbell | 27 |
| `trap_bar` | Trap bar | 1 |
| `dumbbell` | Dumbbell | 22 |
| `kettlebell` | Kettlebell | 11 |
| `medicine_ball` | Medicine ball | 4 |
| `slam_ball` | Slam ball | 1 |
| `sandbag` | Sandbag | 2 |
| `weight_plate` | Weight plate | 4 |
| `bench` | Bench | 6 |
| `box` | Plyo box | 5 |
| `pull_up_bar` | Pull-up bar | 8 |
| `rings` | Gymnastic rings | 3 |
| `parallettes` | Parallettes | 1 |
| `dip_station` | Dip station | 1 |
| `climbing_rope` | Climbing rope | 1 |
| `jump_rope` | Jump rope | 2 |
| `ghd` | GHD | 2 |
| `ab_mat` | Ab mat | 1 |
| `resistance_band` | Resistance band | 4 |
| `cable_machine` | Cable machine | 2 |
| `landmine` | Landmine | 1 |
| `sled` | Sled | 3 |
| `rower` | Rower | 1 |
| `ski_erg` | Ski erg | 1 |
| `air_bike` | Air bike | 1 |
| `bike_erg` | Bike erg | 1 |

## Ambiguous terms (13)

Not aliases. When a coach writes one of these, the parser asks which exercise the gym means (candidates in this order) and saves the answer as a gym alias.

| Term | Candidates |
|---|---|
| squat | Back squat, Front squat, Air squat, Goblet squat |
| db squat | Goblet squat, Dumbbell front squat |
| lunge | Walking lunge, Reverse lunge |
| clean | Squat clean, Power clean, Hang power clean, Hang squat clean, Dumbbell clean |
| hang clean | Hang squat clean, Hang power clean |
| snatch | Squat snatch, Power snatch, Hang power snatch, Dumbbell snatch, Kettlebell snatch |
| jerk | Push jerk, Split jerk |
| press | Strict press, Push press, Dumbbell shoulder press |
| shoulder press | Strict press, Dumbbell shoulder press |
| dip | Ring dip, Bar dip |
| muscle up | Ring muscle-up, Bar muscle-up |
| bike | Air bike, Bike erg |
| hollow | Hollow hold, Hollow rock |

## Exercises

### Squat (10)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Back squat** | squat 1.0 | sagittal | reps | quads, glutes | adductors, lower_back | Barbell | 1 | bs, barbell back squat |  |
| **Front squat** | squat 1.0 | sagittal | reps | quads, glutes | upper_back, abs | Barbell | 1 | fs, barbell front squat |  |
| **Overhead squat** | squat 1.0 | sagittal | reps | quads, glutes | shoulders, upper_back, abs | Barbell | 1 | ohs | Overhead position is a hold, not a press: no v_push. |
| **Air squat** | squat 1.0 | sagittal | reps | quads, glutes | adductors | — | 1 | bodyweight squat, bw squat |  |
| **Goblet squat** | squat 1.0 | sagittal | reps | quads, glutes | adductors, abs | Kettlebell, Dumbbell | 1 | kb goblet squat, db goblet squat |  |
| **Dumbbell front squat** | squat 1.0 | sagittal | reps | quads, glutes | abs, upper_back | Dumbbell | 2 | db front squat |  |
| **Wall ball** | squat 0.6 · v_push 0.4 | sagittal | reps | quads, glutes, shoulders | triceps, abs | Medicine ball | 1 | wb, wbs, wall ball shot, wallball | Spec example. |
| **Thruster** | squat 0.6 · v_push 0.4 | sagittal | reps | quads, glutes, shoulders | triceps, abs, upper_back | Barbell | 1 | barbell thruster, bb thruster | Same split as wall ball. |
| **Dumbbell thruster** | squat 0.6 · v_push 0.4 | sagittal | reps | quads, glutes, shoulders | triceps, abs | Dumbbell | 2 | db thruster |  |
| **Wall sit** | squat 1.0 | sagittal | time_s | quads | glutes | — | 1 | — |  |

### Lunge & single leg (9)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Walking lunge** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | adductors, hamstrings | — | 2 | db walking lunge, kb walking lunge | Load (DB/KB/barbell) goes on the workout line. |
| **Reverse lunge** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | adductors, hamstrings | — | 2 | back lunge, rev lunge, db reverse lunge |  |
| **Overhead walking lunge** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | shoulders, abs, upper_back | Weight plate, Dumbbell, Barbell | 1 | overhead lunge, oh lunge, plate overhead lunge |  |
| **Bulgarian split squat** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | adductors | Bench | 2 | bss, rear foot elevated split squat, rfess |  |
| **Step-up** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | hamstrings | Plyo box | 2 | box step up, db step up, db box step up |  |
| **Box step-over** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | hamstrings | Plyo box | 1 | step over |  |
| **Pistol** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | abs, calves | — | 1 | pistol squat, single leg squat | Single-leg, so lunge (spec §2.1), not squat. |
| **Lateral lunge** ↔ | lunge 1.0 | frontal | reps | adductors, quads, glutes | — | — | 1 | side lunge |  |
| **Cossack squat** ↔ | lunge 1.0 | frontal | reps | adductors, quads, glutes | hamstrings | — | 1 | — |  |

### Hinge (14)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Deadlift** | hinge 1.0 | sagittal | reps | hamstrings, glutes, lower_back | forearms_grip, upper_back, quads | Barbell | 1 | dl, barbell deadlift, conventional deadlift |  |
| **Trap bar deadlift** | hinge 1.0 | sagittal | reps | glutes, hamstrings, quads | lower_back, forearms_grip, upper_back | Trap bar | 1 | trap bar dl, hex bar deadlift, hex bar dl | Hinge, with more quads than a barbell deadlift. |
| **Sumo deadlift** | hinge 1.0 | sagittal | reps | glutes, adductors, hamstrings | lower_back, quads, forearms_grip | Barbell | 1 | sumo dl |  |
| **Romanian deadlift** | hinge 1.0 | sagittal | reps | hamstrings, glutes | lower_back, forearms_grip | Barbell | 1 | rdl, barbell rdl |  |
| **Dumbbell Romanian deadlift** | hinge 1.0 | sagittal | reps | hamstrings, glutes | lower_back, forearms_grip | Dumbbell | 2 | db rdl |  |
| **Dumbbell deadlift** | hinge 1.0 | sagittal | reps | hamstrings, glutes, lower_back | forearms_grip, quads | Dumbbell | 2 | db deadlift, db dl |  |
| **Single-leg Romanian deadlift** ↔ | hinge 1.0 | sagittal | reps | hamstrings, glutes | lower_back, abs | Dumbbell, Kettlebell | 1 | single leg rdl, sl rdl, single leg deadlift |  |
| **Kettlebell swing** | hinge 1.0 | sagittal | reps | glutes, hamstrings | lower_back, forearms_grip, shoulders | Kettlebell | 1 | kbs, kb swing, russian kbs, russian kb swing, russian swing, american kb swing, american swing | Spec example. Russian and American swings are one exercise (spec §5). |
| **Kettlebell deadlift** | hinge 1.0 | sagittal | reps | hamstrings, glutes | lower_back, forearms_grip | Kettlebell | 1 | kb deadlift, kb dl |  |
| **Good morning** | hinge 1.0 | sagittal | reps | hamstrings, lower_back | glutes | Barbell | 1 | — |  |
| **Hip thrust** | hinge 1.0 | sagittal | reps | glutes | hamstrings | Barbell, Bench | 1 | barbell hip thrust |  |
| **Glute bridge** | hinge 1.0 | sagittal | reps | glutes | hamstrings | — | 1 | hip bridge |  |
| **Back extension** | hinge 1.0 | sagittal | reps | lower_back, glutes, hamstrings | — | GHD | 1 | hyperextension, back ext, ghd back extension, hip extension, ghd hip extension |  |
| **Nordic hamstring curl** | hinge 1.0 | sagittal | reps | hamstrings | glutes, calves | — | 1 | nordic curl, nordic, nordic ham curl | Knee flexion, not a hip hinge; hinge is the closest pattern (posterior chain). Please confirm. |

### Olympic lifts & ballistics (21)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Power clean** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, quads | upper_back, lower_back, forearms_grip | Barbell | 1 | pc | Same split as the spec's DB snatch. |
| **Squat clean** | hinge 0.5 · squat 0.3 · v_pull 0.2 | sagittal | reps | glutes, hamstrings, quads | upper_back, lower_back, forearms_grip | Barbell | 1 | full clean | The catch in a full squat adds squat. |
| **Hang power clean** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, quads | upper_back, lower_back, forearms_grip | Barbell | 1 | hpc |  |
| **Hang squat clean** | hinge 0.5 · squat 0.3 · v_pull 0.2 | sagittal | reps | glutes, hamstrings, quads | upper_back, lower_back, forearms_grip | Barbell | 1 | hsc |  |
| **Clean and jerk** | hinge 0.5 · v_push 0.3 · squat 0.2 | sagittal | reps | glutes, hamstrings, quads | shoulders, triceps, upper_back | Barbell | 1 | cj, c and j |  |
| **Power snatch** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, quads | shoulders, upper_back, lower_back | Barbell | 1 | — |  |
| **Squat snatch** | hinge 0.5 · squat 0.3 · v_pull 0.2 | sagittal | reps | glutes, hamstrings, quads | shoulders, upper_back, lower_back | Barbell | 1 | full snatch |  |
| **Hang power snatch** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, quads | shoulders, upper_back, lower_back | Barbell | 1 | hps |  |
| **Push press** | v_push 1.0 | sagittal | reps | shoulders, triceps | quads, upper_back, abs | Barbell | 1 | — | The leg drive is a dip, not a squat: v_push only. |
| **Push jerk** | v_push 1.0 | sagittal | reps | shoulders, triceps | quads, upper_back, abs | Barbell | 1 | pj |  |
| **Split jerk** | v_push 1.0 | sagittal | reps | shoulders, triceps | quads, glutes, abs | Barbell | 1 | — |  |
| **Shoulder-to-overhead** | v_push 1.0 | sagittal | reps | shoulders, triceps | quads, upper_back, abs | Barbell | 1 | s2oh, stoh |  |
| **Ground-to-overhead** | hinge 0.6 · v_push 0.4 | sagittal | reps | glutes, hamstrings, shoulders | quads, triceps, upper_back | Barbell, Dumbbell, Weight plate | 1 | g2oh, gtoh | Any style from floor to overhead. |
| **Dumbbell snatch** ↔ | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, shoulders | upper_back, abs, quads | Dumbbell | 1 | db snatch, alt db snatch, alternating db snatch, alternating dumbbell snatch, single arm db snatch | Spec example (alt. DB snatch). |
| **Dumbbell clean** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, quads | upper_back, forearms_grip, abs | Dumbbell | 2 | db clean, db hang clean, db power clean, db hang power clean | Includes hang variants. |
| **Dumbbell clean and jerk** | hinge 0.6 · v_push 0.4 | sagittal | reps | glutes, hamstrings, shoulders | quads, triceps, abs | Dumbbell | 1 | db clean and jerk, db c and j, db cj, db hang clean and jerk |  |
| **Kettlebell snatch** ↔ | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, shoulders | upper_back, abs, forearms_grip | Kettlebell | 1 | kb snatch |  |
| **Kettlebell clean** ↔ | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings | upper_back, forearms_grip, abs | Kettlebell | 1 | kb clean |  |
| **Sandbag clean** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, lower_back | upper_back, biceps, forearms_grip | Sandbag | 1 | — |  |
| **Devil press** | hinge 0.6 · h_push 0.4 | sagittal | reps | glutes, hamstrings, shoulders | chest, triceps, upper_back | Dumbbell | 2 | devils press | Burpee on the dumbbells (h_push) plus a double DB snatch (hinge). |
| **Turkish get-up** ↔ | core 0.6 · lunge 0.4 | multiplanar | reps | shoulders, abs, obliques | glutes, triceps | Kettlebell, Dumbbell | 1 | tgu, turkish getup, get up | The overhead arm is a hold, not a press. |

### Vertical push (9)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Strict press** | v_push 1.0 | sagittal | reps | shoulders, triceps | upper_back, abs | Barbell | 1 | overhead press, ohp, military press |  |
| **Dumbbell shoulder press** | v_push 1.0 | sagittal | reps | shoulders, triceps | upper_back | Dumbbell | 2 | db press, db shoulder press, db strict press, db ohp |  |
| **Dumbbell push press** | v_push 1.0 | sagittal | reps | shoulders, triceps | quads, upper_back | Dumbbell | 2 | db push press |  |
| **Handstand push-up** | v_push 1.0 | sagittal | reps | shoulders, triceps | upper_back, abs | — | 1 | hspu, strict hspu, kipping hspu, strict handstand push up, kipping handstand push up |  |
| **Pike push-up** | v_push 1.0 | sagittal | reps | shoulders, triceps | upper_back | — | 1 | pike pushup |  |
| **Wall walk** | v_push 0.6 · core 0.4 | sagittal | reps | shoulders, abs | triceps, upper_back | — | 1 | — |  |
| **Handstand walk** | v_push 0.7 · core 0.3 | sagittal | distance_m | shoulders | triceps, abs, upper_back | — | 1 | hs walk, hsw |  |
| **Ring dip** | v_push 1.0 | sagittal | reps | triceps, chest | shoulders | Gymnastic rings | 1 | — | Dips counted as vertical push (pressing along the body's long axis). |
| **Bar dip** | v_push 1.0 | sagittal | reps | triceps, chest | shoulders | Dip station | 1 | parallel bar dip |  |

### Horizontal push & burpees (6)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Bench press** | h_push 1.0 | sagittal | reps | chest, triceps | shoulders | Barbell, Bench | 1 | bench, bp, barbell bench press |  |
| **Dumbbell bench press** | h_push 1.0 | sagittal | reps | chest, triceps | shoulders | Dumbbell, Bench | 2 | db bench, db bench press |  |
| **Push-up** | h_push 1.0 | sagittal | reps | chest, triceps | shoulders, abs | — | 1 | pushup, hand release push up, hand release pushup, hrpu |  |
| **Burpee** | h_push 0.5 · jump 0.5 | sagittal | reps | chest, quads, glutes | shoulders, triceps, abs | — | 1 | burpee over rower, bar facing burpee, burpee over bar, burpee over the bar | Spec example (burpee over rower). |
| **Burpee box jump-over** | h_push 0.5 · jump 0.5 | sagittal | reps | chest, quads, glutes | calves, triceps, abs | Plyo box | 1 | bbjo, burpee box jump |  |
| **Burpee pull-up** | h_push 0.4 · v_pull 0.3 · jump 0.3 | sagittal | reps | chest, quads, lats | glutes, biceps, triceps | Pull-up bar | 1 | burpee pullup, burpee to pull up | Burpee split plus the pull-up. |

### Vertical pull (7)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Pull-up** | v_pull 1.0 | sagittal | reps | lats, biceps | upper_back, forearms_grip | Pull-up bar | 1 | pullup, kipping pull up, strict pull up, butterfly pull up |  |
| **Chest-to-bar pull-up** | v_pull 1.0 | sagittal | reps | lats, biceps | upper_back, forearms_grip | Pull-up bar | 1 | c2b, ctb, chest to bar |  |
| **Chin-up** | v_pull 1.0 | sagittal | reps | lats, biceps | forearms_grip | Pull-up bar | 1 | chinup |  |
| **Lat pulldown** | v_pull 1.0 | sagittal | reps | lats, biceps | upper_back | Cable machine | 1 | pulldown, lat pull down |  |
| **Bar muscle-up** | v_pull 0.6 · v_push 0.4 | sagittal | reps | lats, triceps | chest, abs, forearms_grip | Pull-up bar | 1 | bmu |  |
| **Ring muscle-up** | v_pull 0.6 · v_push 0.4 | sagittal | reps | lats, triceps | chest, biceps, abs | Gymnastic rings | 1 | rmu |  |
| **Rope climb** | v_pull 1.0 | sagittal | reps | lats, biceps, forearms_grip | abs | Climbing rope | 1 | legless rope climb |  |

### Horizontal pull (6)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Ring row** | h_pull 1.0 | sagittal | reps | upper_back, lats | biceps | Gymnastic rings | 1 | inverted row, body row |  |
| **Bent-over row** | h_pull 1.0 | sagittal | reps | upper_back, lats | biceps, lower_back | Barbell | 1 | barbell row, bb row, pendlay row, bent over barbell row |  |
| **Single-arm dumbbell row** ↔ | h_pull 1.0 | sagittal | reps | lats, upper_back | biceps | Dumbbell, Bench | 1 | db row, sa db row, single arm db row, one arm db row |  |
| **Renegade row** ↔ | h_pull 0.6 · core 0.4 | sagittal | reps | lats, upper_back, abs | biceps, obliques | Dumbbell | 2 | — |  |
| **Band pull-apart** | h_pull 1.0 | sagittal | reps | upper_back, shoulders | — | Resistance band | 1 | pull apart, banded pull apart |  |
| **Face pull** | h_pull 1.0 | sagittal | reps | upper_back, shoulders | — | Cable machine, Resistance band | 1 | band face pull, cable face pull |  |

### Core & rotation (21)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Toes-to-bar** | core 0.7 · v_pull 0.3 | sagittal | reps | abs, hip_flexors | lats, forearms_grip | Pull-up bar | 1 | t2b, ttb | Spec example. |
| **Knees-to-elbows** | core 0.7 · v_pull 0.3 | sagittal | reps | abs, hip_flexors | lats, forearms_grip | Pull-up bar | 1 | k2e, kte |  |
| **Hanging knee raise** | core 0.7 · v_pull 0.3 | sagittal | reps | hip_flexors, abs | lats, forearms_grip | Pull-up bar | 1 | knee raise, hkr |  |
| **Sit-up** | core 1.0 | sagittal | reps | abs | hip_flexors | Ab mat | 1 | situp, abmat sit up, abmat situp |  |
| **GHD sit-up** | core 1.0 | sagittal | reps | abs, hip_flexors | quads | GHD | 1 | ghd situp |  |
| **V-up** | core 1.0 | sagittal | reps | abs, hip_flexors | — | — | 1 | vup |  |
| **Hollow hold** | core 1.0 | sagittal | time_s | abs | hip_flexors | — | 1 | — |  |
| **Hollow rock** | core 1.0 | sagittal | reps | abs | hip_flexors | — | 1 | — |  |
| **Plank** | core 1.0 | sagittal | time_s | abs | shoulders, obliques | — | 1 | front plank, forearm plank, plank hold |  |
| **Side plank** ↔ | core 1.0 | frontal | time_s | obliques | abs, shoulders | — | 1 | — |  |
| **Copenhagen plank** ↔ | core 1.0 | frontal | time_s | adductors, obliques | abs | Bench | 1 | copenhagen, copenhagen side plank, copenhagen adductor plank |  |
| **Dead bug** | core 1.0 | sagittal | reps | abs | — | — | 1 | — |  |
| **L-sit** | core 1.0 | sagittal | time_s | abs, hip_flexors | triceps, quads | Parallettes | 1 | lsit, l sit hold |  |
| **Mountain climber** | core 1.0 | sagittal | reps | abs, hip_flexors | shoulders, quads | — | 1 | — |  |
| **Bear crawl** | core 0.6 · h_push 0.4 | sagittal | distance_m | abs, shoulders | quads, triceps | — | 1 | — |  |
| **Ball slam** | core 0.6 · hinge 0.4 | sagittal | reps | abs, lats | shoulders, glutes | Slam ball | 1 | slam ball, med ball slam, slam |  |
| **Russian twist** | rotation 1.0 | transverse | reps | obliques | abs | Medicine ball, Weight plate | 1 | — |  |
| **Woodchop** | rotation 1.0 | transverse | reps | obliques | abs, shoulders | Medicine ball, Resistance band | 1 | wood chop, med ball woodchop |  |
| **Rotational med ball throw** | rotation 1.0 | transverse | reps | obliques | shoulders, glutes | Medicine ball | 1 | rotational throw, med ball rotational throw, side toss |  |
| **Landmine rotation** | rotation 1.0 | transverse | reps | obliques | shoulders, abs | Landmine, Barbell | 1 | landmine 180 |  |
| **Pallof press** ↔ | core 1.0 | transverse | reps | obliques, abs | — | Resistance band | 1 | — | Anti-rotation counts as core (spec §2.1), not rotation. |

### Jump & plyometrics (8)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Box jump** | jump 1.0 | sagittal | reps | quads, glutes, calves | — | Plyo box | 1 | bj |  |
| **Box jump-over** | jump 1.0 | sagittal | reps | quads, glutes, calves | — | Plyo box | 1 | bjo | Spec example. |
| **Broad jump** | jump 1.0 | sagittal | reps | quads, glutes | calves, hamstrings | — | 1 | standing long jump |  |
| **Jump squat** | jump 1.0 | sagittal | reps | quads, glutes | calves | — | 1 | squat jump, jumping squat |  |
| **Jumping lunge** ↔ | lunge 0.5 · jump 0.5 | sagittal | reps | quads, glutes | calves, adductors | — | 1 | split jump, lunge jump |  |
| **Tuck jump** | jump 1.0 | sagittal | reps | quads, glutes, calves | abs | — | 1 | — |  |
| **Skater jump** ↔ | jump 1.0 | frontal | reps | glutes, quads | adductors, calves | — | 1 | skater, skater hop |  |
| **Jumping jack** | jump 1.0 | frontal | reps | calves | shoulders, glutes | — | 1 | star jump |  |

### Carry & sled (8)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Farmer carry** | carry 1.0 | sagittal | distance_m | forearms_grip, upper_back | abs, glutes | Dumbbell, Kettlebell | 2 | farmers carry, farmer walk, farmers walk |  |
| **Front rack carry** | carry 1.0 | sagittal | distance_m | abs, upper_back | forearms_grip, shoulders | Kettlebell, Dumbbell | 2 | rack carry, kb front rack carry |  |
| **Overhead carry** | carry 1.0 | sagittal | distance_m | shoulders, abs | upper_back, triceps | Kettlebell, Dumbbell, Weight plate | 1 | overhead walk, oh carry, waiter carry, waiters walk |  |
| **Suitcase carry** ↔ | carry 1.0 | frontal | distance_m | obliques, forearms_grip | upper_back, abs | Kettlebell, Dumbbell | 1 | single arm farmer carry |  |
| **Sandbag carry** | carry 1.0 | sagittal | distance_m | upper_back, abs | glutes, quads, forearms_grip | Sandbag | 1 | bear hug carry, sandbag bear hug carry |  |
| **Sled push** | lunge 0.6 · carry 0.4 | sagittal | distance_m | quads, glutes, calves | abs, shoulders, hamstrings | Sled | 1 | prowler push, prowler | Arms are a brace, not a press: no h_push (Daniel, 2026-10-21). |
| **Sled drag** | carry 1.0 | sagittal | distance_m | quads, glutes | calves, hamstrings | Sled | 1 | backward sled drag, reverse sled drag | Walking with the sled behind or in front (harness or straps). |
| **Sled pull** | h_pull 1.0 | sagittal | distance_m | upper_back, lats, biceps | forearms_grip, abs | Sled | 1 | rope sled pull, hand over hand sled pull | Hand-over-hand rope pull while standing still. |

### Isolation (no pattern) (1)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Calf raise** | — (no pattern) | sagittal | reps | calves | — | — | 1 | standing calf raise, heel raise | Ankle work fits none of the 11 patterns: no pattern, counted in muscle analytics only. Please confirm. |

### Monostructural (8)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Implements | Aliases | Note |
|---|---|---|---|---|---|---|---|---|---|
| **Run** | *run* (modality) | sagittal | distance_m | — | — | — | — | running, jog, shuttle run |  |
| **Row** | *row* (modality) | sagittal | distance_m | — | — | Rower | — | rowing, rower |  |
| **Air bike** | *bike* (modality) | sagittal | calories | — | — | Air bike | — | assault bike, echo bike, airbike |  |
| **Bike erg** | *bike* (modality) | sagittal | calories | — | — | Bike erg | — | bikeerg, c2 bike, concept2 bike | Separate from the air bike: calories come much easier. |
| **Ski erg** | *ski* (modality) | sagittal | distance_m | — | — | Ski erg | — | ski, skierg |  |
| **Double-under** | *jump_rope* (modality) | sagittal | reps | — | — | Jump rope | — | du |  |
| **Single-under** | *jump_rope* (modality) | sagittal | reps | — | — | Jump rope | — | su, jump rope, skipping |  |
| **Swim** | *swim* (modality) | sagittal | distance_m | — | — | — | — | swimming |  |
