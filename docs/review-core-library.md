# Core exercise library — for review

**Status:** proposal for Daniel's approval (Step 2). Applied to the local database only, not to the remote project yet.

Generated from `src/lib/library/` by `npm run library:generate`; do not edit the tables by hand. Mark changes anywhere you like (in this file, or tell Claude chat), and Claude Code updates the source and regenerates. The approved version becomes the seed migration that goes to the remote database.

## What to check

1. **Pattern weights**: especially compound movements (two or three patterns).
2. **Muscles**: primary = prime movers (1.0 hard set), secondary = 0.5 set (calc spec Lens 1).
3. **Equipment list** (below) and each exercise's equipment.
4. **Aliases**: what coaches type. Generic words map as follows; change any you disagree with:
   "squat" → Air squat · "lunge" → Walking lunge · "clean" → Squat clean · "snatch" → Squat snatch · "jerk" → Push jerk ·
   "press" → Strict press · "bench" → Bench press · "dip" → Bar dip · "muscle up" → Ring muscle-up · "bike" → Air bike ·
   "ski" → Ski erg · "row" → Row (rowing machine).
5. **Anything missing or unnecessary.** Adding later is easy; this is the starting library, gyms add their own on top.

## Conventions used

- Pattern weights sum to 1.00, in steps of 0.1, at most three patterns. Dominant phase 0.6–0.7, secondary phase 0.3–0.4. The seven examples in calc spec §3 are used unchanged.
- Holds are not presses: overhead squat, overhead lunges, carries and the Turkish get-up have no v_push.
- Monostructural exercises (run, row, bike, ski, jump rope, swim) have a modality and **no patterns and no muscles**: they are measured by Lens 3 (distance, calories, time).
- Every core exercise has a plane (none left uncurated).
- Equipment is what the exercise is done with; several items means any one of them. Bodyweight exercises list none. Optional loading (e.g. a DB walking lunge) is recorded as the load on the workout line, not as a separate exercise. Barbell, dumbbell and kettlebell versions of the main lifts are separate exercises.
- Aliases are stored normalised (lower case, no punctuation). The canonical name is always an alias. Plurals ("kb swings") are handled by the parser in Step 4, not listed here.
- Pace defaults are left empty until calc spec §9.5 (which population to calibrate to) is decided.

## Summary

120 exercises. ↔ = unilateral.

| Category | Exercises |
|---|---|
| Squat | 10 |
| Lunge & single leg | 8 |
| Hinge | 12 |
| Olympic lifts & ballistics | 21 |
| Vertical push | 9 |
| Horizontal push & burpees | 5 |
| Vertical pull | 6 |
| Horizontal pull | 5 |
| Core & rotation | 20 |
| Jump & plyometrics | 8 |
| Carry & sled | 8 |
| Monostructural | 8 |

## Equipment (24)

| Key | Label | Used by |
|---|---|---|
| `barbell` | Barbell | 27 |
| `dumbbell` | Dumbbell | 22 |
| `kettlebell` | Kettlebell | 11 |
| `medicine_ball` | Medicine ball | 4 |
| `slam_ball` | Slam ball | 1 |
| `sandbag` | Sandbag | 2 |
| `weight_plate` | Weight plate | 4 |
| `bench` | Bench | 5 |
| `box` | Plyo box | 4 |
| `pull_up_bar` | Pull-up bar | 7 |
| `rings` | Gymnastic rings | 3 |
| `parallettes` | Parallettes | 1 |
| `dip_station` | Dip station | 1 |
| `climbing_rope` | Climbing rope | 1 |
| `jump_rope` | Jump rope | 2 |
| `ghd` | GHD | 2 |
| `ab_mat` | Ab mat | 1 |
| `resistance_band` | Resistance band | 3 |
| `landmine` | Landmine | 1 |
| `sled` | Sled | 3 |
| `rower` | Rower | 1 |
| `ski_erg` | Ski erg | 1 |
| `air_bike` | Air bike | 1 |
| `bike_erg` | Bike erg | 1 |

## Exercises

### Squat (10)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Back squat** | squat 1.0 | sagittal | reps | quads, glutes | adductors, lower_back | Barbell | bs, barbell back squat |  |
| **Front squat** | squat 1.0 | sagittal | reps | quads, glutes | upper_back, abs | Barbell | fs, barbell front squat |  |
| **Overhead squat** | squat 1.0 | sagittal | reps | quads, glutes | shoulders, upper_back, abs | Barbell | ohs | Overhead position is a hold, not a press: no v_push. |
| **Air squat** | squat 1.0 | sagittal | reps | quads, glutes | adductors | — | squat, bodyweight squat, bw squat | "squat" on its own maps here (metcon usage). |
| **Goblet squat** | squat 1.0 | sagittal | reps | quads, glutes | adductors, abs | Kettlebell, Dumbbell | kb goblet squat, db goblet squat |  |
| **Dumbbell front squat** | squat 1.0 | sagittal | reps | quads, glutes | abs, upper_back | Dumbbell | db front squat, db squat |  |
| **Wall ball** | squat 0.6 · v_push 0.4 | sagittal | reps | quads, glutes, shoulders | triceps, abs | Medicine ball | wb, wbs, wall ball shot, wallball | Spec example. |
| **Thruster** | squat 0.6 · v_push 0.4 | sagittal | reps | quads, glutes, shoulders | triceps, abs, upper_back | Barbell | barbell thruster, bb thruster | Same split as wall ball. |
| **Dumbbell thruster** | squat 0.6 · v_push 0.4 | sagittal | reps | quads, glutes, shoulders | triceps, abs | Dumbbell | db thruster |  |
| **Wall sit** | squat 1.0 | sagittal | time_s | quads | glutes | — | — |  |

### Lunge & single leg (8)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Walking lunge** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | adductors, hamstrings | — | lunge, db walking lunge, kb walking lunge | "lunge" on its own maps here. Load (DB/KB/barbell) goes on the workout line. |
| **Reverse lunge** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | adductors, hamstrings | — | back lunge, rev lunge, db reverse lunge |  |
| **Overhead walking lunge** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | shoulders, abs, upper_back | Weight plate, Dumbbell, Barbell | overhead lunge, oh lunge, plate overhead lunge |  |
| **Bulgarian split squat** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | adductors | Bench | bss, rear foot elevated split squat, rfess |  |
| **Step-up** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | hamstrings | Plyo box | box step up, db step up, db box step up |  |
| **Pistol** ↔ | lunge 1.0 | sagittal | reps | quads, glutes | abs, calves | — | pistol squat, single leg squat | Single-leg, so lunge (spec §2.1), not squat. |
| **Lateral lunge** ↔ | lunge 1.0 | frontal | reps | adductors, quads, glutes | — | — | side lunge |  |
| **Cossack squat** ↔ | lunge 1.0 | frontal | reps | adductors, quads, glutes | hamstrings | — | — |  |

### Hinge (12)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Deadlift** | hinge 1.0 | sagittal | reps | hamstrings, glutes, lower_back | forearms_grip, upper_back, quads | Barbell | dl, barbell deadlift, conventional deadlift |  |
| **Sumo deadlift** | hinge 1.0 | sagittal | reps | glutes, adductors, hamstrings | lower_back, quads, forearms_grip | Barbell | sumo dl |  |
| **Romanian deadlift** | hinge 1.0 | sagittal | reps | hamstrings, glutes | lower_back, forearms_grip | Barbell | rdl, barbell rdl |  |
| **Dumbbell Romanian deadlift** | hinge 1.0 | sagittal | reps | hamstrings, glutes | lower_back, forearms_grip | Dumbbell | db rdl |  |
| **Dumbbell deadlift** | hinge 1.0 | sagittal | reps | hamstrings, glutes, lower_back | forearms_grip, quads | Dumbbell | db deadlift, db dl |  |
| **Single-leg Romanian deadlift** ↔ | hinge 1.0 | sagittal | reps | hamstrings, glutes | lower_back, abs | Dumbbell, Kettlebell | single leg rdl, sl rdl, single leg deadlift |  |
| **Kettlebell swing** | hinge 1.0 | sagittal | reps | glutes, hamstrings | lower_back, forearms_grip, shoulders | Kettlebell | kbs, kb swing, russian kbs, russian kb swing, russian swing, american kb swing, american swing | Spec example. Russian and American swings are one exercise (spec §5). |
| **Kettlebell deadlift** | hinge 1.0 | sagittal | reps | hamstrings, glutes | lower_back, forearms_grip | Kettlebell | kb deadlift, kb dl |  |
| **Good morning** | hinge 1.0 | sagittal | reps | hamstrings, lower_back | glutes | Barbell | — |  |
| **Hip thrust** | hinge 1.0 | sagittal | reps | glutes | hamstrings | Barbell, Bench | barbell hip thrust |  |
| **Glute bridge** | hinge 1.0 | sagittal | reps | glutes | hamstrings | — | hip bridge |  |
| **Back extension** | hinge 1.0 | sagittal | reps | lower_back, glutes, hamstrings | — | GHD | hyperextension, back ext, ghd back extension, hip extension, ghd hip extension |  |

### Olympic lifts & ballistics (21)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Power clean** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, quads | upper_back, lower_back, forearms_grip | Barbell | pc | Same split as the spec's DB snatch. |
| **Squat clean** | hinge 0.5 · squat 0.3 · v_pull 0.2 | sagittal | reps | glutes, hamstrings, quads | upper_back, lower_back, forearms_grip | Barbell | clean, full clean | "clean" on its own maps here. The catch in a full squat adds squat. |
| **Hang power clean** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, quads | upper_back, lower_back, forearms_grip | Barbell | hpc |  |
| **Hang squat clean** | hinge 0.5 · squat 0.3 · v_pull 0.2 | sagittal | reps | glutes, hamstrings, quads | upper_back, lower_back, forearms_grip | Barbell | hang clean, hsc |  |
| **Clean and jerk** | hinge 0.5 · v_push 0.3 · squat 0.2 | sagittal | reps | glutes, hamstrings, quads | shoulders, triceps, upper_back | Barbell | cj, c and j |  |
| **Power snatch** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, quads | shoulders, upper_back, lower_back | Barbell | — |  |
| **Squat snatch** | hinge 0.5 · squat 0.3 · v_pull 0.2 | sagittal | reps | glutes, hamstrings, quads | shoulders, upper_back, lower_back | Barbell | snatch, full snatch | "snatch" on its own maps here. |
| **Hang power snatch** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, quads | shoulders, upper_back, lower_back | Barbell | hps |  |
| **Push press** | v_push 1.0 | sagittal | reps | shoulders, triceps | quads, upper_back, abs | Barbell | — | The leg drive is a dip, not a squat: v_push only. |
| **Push jerk** | v_push 1.0 | sagittal | reps | shoulders, triceps | quads, upper_back, abs | Barbell | pj, jerk | "jerk" on its own maps here. |
| **Split jerk** | v_push 1.0 | sagittal | reps | shoulders, triceps | quads, glutes, abs | Barbell | — |  |
| **Shoulder-to-overhead** | v_push 1.0 | sagittal | reps | shoulders, triceps | quads, upper_back, abs | Barbell | s2oh, stoh |  |
| **Ground-to-overhead** | hinge 0.6 · v_push 0.4 | sagittal | reps | glutes, hamstrings, shoulders | quads, triceps, upper_back | Barbell, Dumbbell, Weight plate | g2oh, gtoh | Any style from floor to overhead. |
| **Dumbbell snatch** ↔ | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, shoulders | upper_back, abs, quads | Dumbbell | db snatch, alt db snatch, alternating db snatch, alternating dumbbell snatch, single arm db snatch | Spec example (alt. DB snatch). |
| **Dumbbell clean** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, quads | upper_back, forearms_grip, abs | Dumbbell | db clean, db hang clean, db power clean, db hang power clean | Includes hang variants. |
| **Dumbbell clean and jerk** | hinge 0.6 · v_push 0.4 | sagittal | reps | glutes, hamstrings, shoulders | quads, triceps, abs | Dumbbell | db clean and jerk, db c and j, db cj, db hang clean and jerk |  |
| **Kettlebell snatch** ↔ | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, shoulders | upper_back, abs, forearms_grip | Kettlebell | kb snatch |  |
| **Kettlebell clean** ↔ | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings | upper_back, forearms_grip, abs | Kettlebell | kb clean |  |
| **Sandbag clean** | hinge 0.7 · v_pull 0.3 | sagittal | reps | glutes, hamstrings, lower_back | upper_back, biceps, forearms_grip | Sandbag | — |  |
| **Devil press** | hinge 0.6 · h_push 0.4 | sagittal | reps | glutes, hamstrings, shoulders | chest, triceps, upper_back | Dumbbell | devils press | Burpee on the dumbbells (h_push) plus a double DB snatch (hinge). |
| **Turkish get-up** ↔ | core 0.6 · lunge 0.4 | multiplanar | reps | shoulders, abs, obliques | glutes, triceps | Kettlebell, Dumbbell | tgu, turkish getup, get up | The overhead arm is a hold, not a press. |

### Vertical push (9)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Strict press** | v_push 1.0 | sagittal | reps | shoulders, triceps | upper_back, abs | Barbell | press, shoulder press, overhead press, ohp, military press |  |
| **Dumbbell shoulder press** | v_push 1.0 | sagittal | reps | shoulders, triceps | upper_back | Dumbbell | db press, db shoulder press, db strict press, db ohp |  |
| **Dumbbell push press** | v_push 1.0 | sagittal | reps | shoulders, triceps | quads, upper_back | Dumbbell | db push press |  |
| **Handstand push-up** | v_push 1.0 | sagittal | reps | shoulders, triceps | upper_back, abs | — | hspu, strict hspu, kipping hspu, strict handstand push up, kipping handstand push up |  |
| **Pike push-up** | v_push 1.0 | sagittal | reps | shoulders, triceps | upper_back | — | pike pushup |  |
| **Wall walk** | v_push 0.6 · core 0.4 | sagittal | reps | shoulders, abs | triceps, upper_back | — | — |  |
| **Handstand walk** | v_push 0.7 · core 0.3 | sagittal | distance_m | shoulders | triceps, abs, upper_back | — | hs walk, hsw |  |
| **Ring dip** | v_push 1.0 | sagittal | reps | triceps, chest | shoulders | Gymnastic rings | — | Dips counted as vertical push (pressing along the body's long axis). |
| **Bar dip** | v_push 1.0 | sagittal | reps | triceps, chest | shoulders | Dip station | dip, parallel bar dip |  |

### Horizontal push & burpees (5)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Bench press** | h_push 1.0 | sagittal | reps | chest, triceps | shoulders | Barbell, Bench | bench, bp, barbell bench press |  |
| **Dumbbell bench press** | h_push 1.0 | sagittal | reps | chest, triceps | shoulders | Dumbbell, Bench | db bench, db bench press |  |
| **Push-up** | h_push 1.0 | sagittal | reps | chest, triceps | shoulders, abs | — | pushup, hand release push up, hand release pushup, hrpu |  |
| **Burpee** | h_push 0.5 · jump 0.5 | sagittal | reps | chest, quads, glutes | shoulders, triceps, abs | — | burpee over rower, bar facing burpee, burpee over bar, burpee over the bar | Spec example (burpee over rower). |
| **Burpee box jump-over** | h_push 0.5 · jump 0.5 | sagittal | reps | chest, quads, glutes | calves, triceps, abs | Plyo box | bbjo, burpee box jump |  |

### Vertical pull (6)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Pull-up** | v_pull 1.0 | sagittal | reps | lats, biceps | upper_back, forearms_grip | Pull-up bar | pullup, kipping pull up, strict pull up, butterfly pull up |  |
| **Chest-to-bar pull-up** | v_pull 1.0 | sagittal | reps | lats, biceps | upper_back, forearms_grip | Pull-up bar | c2b, ctb, chest to bar |  |
| **Chin-up** | v_pull 1.0 | sagittal | reps | lats, biceps | forearms_grip | Pull-up bar | chinup |  |
| **Bar muscle-up** | v_pull 0.6 · v_push 0.4 | sagittal | reps | lats, triceps | chest, abs, forearms_grip | Pull-up bar | bmu |  |
| **Ring muscle-up** | v_pull 0.6 · v_push 0.4 | sagittal | reps | lats, triceps | chest, biceps, abs | Gymnastic rings | rmu, muscle up | "muscle up" on its own maps here. |
| **Rope climb** | v_pull 1.0 | sagittal | reps | lats, biceps, forearms_grip | abs | Climbing rope | legless rope climb |  |

### Horizontal pull (5)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Ring row** | h_pull 1.0 | sagittal | reps | upper_back, lats | biceps | Gymnastic rings | inverted row, body row |  |
| **Bent-over row** | h_pull 1.0 | sagittal | reps | upper_back, lats | biceps, lower_back | Barbell | barbell row, bb row, pendlay row, bent over barbell row |  |
| **Single-arm dumbbell row** ↔ | h_pull 1.0 | sagittal | reps | lats, upper_back | biceps | Dumbbell, Bench | db row, sa db row, single arm db row, one arm db row |  |
| **Renegade row** ↔ | h_pull 0.6 · core 0.4 | sagittal | reps | lats, upper_back, abs | biceps, obliques | Dumbbell | — |  |
| **Band pull-apart** | h_pull 1.0 | sagittal | reps | upper_back, shoulders | — | Resistance band | pull apart, banded pull apart |  |

### Core & rotation (20)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Toes-to-bar** | core 0.7 · v_pull 0.3 | sagittal | reps | abs | lats, forearms_grip | Pull-up bar | t2b, ttb | Spec example. |
| **Knees-to-elbows** | core 0.7 · v_pull 0.3 | sagittal | reps | abs | lats, forearms_grip | Pull-up bar | k2e, kte |  |
| **Hanging knee raise** | core 0.7 · v_pull 0.3 | sagittal | reps | abs | lats, forearms_grip | Pull-up bar | knee raise, hkr |  |
| **Sit-up** | core 1.0 | sagittal | reps | abs | — | Ab mat | situp, abmat sit up, abmat situp |  |
| **GHD sit-up** | core 1.0 | sagittal | reps | abs | quads | GHD | ghd situp |  |
| **V-up** | core 1.0 | sagittal | reps | abs | — | — | vup |  |
| **Hollow hold** | core 1.0 | sagittal | time_s | abs | — | — | hollow |  |
| **Hollow rock** | core 1.0 | sagittal | reps | abs | — | — | — |  |
| **Plank** | core 1.0 | sagittal | time_s | abs | shoulders, obliques | — | front plank, forearm plank, plank hold |  |
| **Side plank** ↔ | core 1.0 | frontal | time_s | obliques | abs, shoulders | — | — |  |
| **Dead bug** | core 1.0 | sagittal | reps | abs | — | — | — |  |
| **L-sit** | core 1.0 | sagittal | time_s | abs | triceps, quads | Parallettes | lsit, l sit hold |  |
| **Mountain climber** | core 1.0 | sagittal | reps | abs | shoulders, quads | — | — |  |
| **Bear crawl** | core 0.6 · h_push 0.4 | sagittal | distance_m | abs, shoulders | quads, triceps | — | — |  |
| **Ball slam** | core 0.6 · hinge 0.4 | sagittal | reps | abs, lats | shoulders, glutes | Slam ball | slam ball, med ball slam, slam |  |
| **Russian twist** | rotation 1.0 | transverse | reps | obliques | abs | Medicine ball, Weight plate | — |  |
| **Woodchop** | rotation 1.0 | transverse | reps | obliques | abs, shoulders | Medicine ball, Resistance band | wood chop, med ball woodchop |  |
| **Rotational med ball throw** | rotation 1.0 | transverse | reps | obliques | shoulders, glutes | Medicine ball | rotational throw, med ball rotational throw, side toss |  |
| **Landmine rotation** | rotation 1.0 | transverse | reps | obliques | shoulders, abs | Landmine, Barbell | landmine 180 |  |
| **Pallof press** ↔ | core 1.0 | transverse | reps | obliques, abs | — | Resistance band | — | Anti-rotation counts as core (spec §2.1), not rotation. |

### Jump & plyometrics (8)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Box jump** | jump 1.0 | sagittal | reps | quads, glutes, calves | — | Plyo box | bj |  |
| **Box jump-over** | jump 1.0 | sagittal | reps | quads, glutes, calves | — | Plyo box | bjo | Spec example. |
| **Broad jump** | jump 1.0 | sagittal | reps | quads, glutes | calves, hamstrings | — | standing long jump |  |
| **Jump squat** | jump 1.0 | sagittal | reps | quads, glutes | calves | — | squat jump, jumping squat |  |
| **Jumping lunge** ↔ | lunge 0.5 · jump 0.5 | sagittal | reps | quads, glutes | calves, adductors | — | split jump, lunge jump |  |
| **Tuck jump** | jump 1.0 | sagittal | reps | quads, glutes, calves | abs | — | — |  |
| **Skater jump** ↔ | jump 1.0 | frontal | reps | glutes, quads | adductors, calves | — | skater, skater hop |  |
| **Jumping jack** | jump 1.0 | frontal | reps | calves | shoulders, glutes | — | star jump |  |

### Carry & sled (8)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Farmer carry** | carry 1.0 | sagittal | distance_m | forearms_grip, upper_back | abs, glutes | Dumbbell, Kettlebell | farmers carry, farmer walk, farmers walk |  |
| **Front rack carry** | carry 1.0 | sagittal | distance_m | abs, upper_back | forearms_grip, shoulders | Kettlebell, Dumbbell | rack carry, kb front rack carry |  |
| **Overhead carry** | carry 1.0 | sagittal | distance_m | shoulders, abs | upper_back, triceps | Kettlebell, Dumbbell, Weight plate | overhead walk, oh carry, waiter carry, waiters walk |  |
| **Suitcase carry** ↔ | carry 1.0 | frontal | distance_m | obliques, forearms_grip | upper_back, abs | Kettlebell, Dumbbell | single arm farmer carry |  |
| **Sandbag carry** | carry 1.0 | sagittal | distance_m | upper_back, abs | glutes, quads, forearms_grip | Sandbag | bear hug carry, sandbag bear hug carry |  |
| **Sled push** | carry 0.6 · h_push 0.4 | sagittal | distance_m | quads, glutes, calves | chest, triceps, shoulders | Sled | prowler push, prowler | From your example (h_push / carry): proposed carry 0.6 / h_push 0.4 because the legs drive it. Please confirm. |
| **Sled drag** | carry 1.0 | sagittal | distance_m | quads, glutes | calves, hamstrings | Sled | backward sled drag, reverse sled drag | Walking with the sled behind or in front (harness or straps). |
| **Sled pull** | h_pull 1.0 | sagittal | distance_m | upper_back, lats, biceps | forearms_grip, abs | Sled | rope sled pull, hand over hand sled pull | Hand-over-hand rope pull while standing still. |

### Monostructural (8)

| Exercise | Patterns | Plane | Unit | Primary | Secondary | Equipment | Aliases | Note |
|---|---|---|---|---|---|---|---|---|
| **Run** | *run* (modality) | sagittal | distance_m | — | — | — | running, jog |  |
| **Row** | *row* (modality) | sagittal | distance_m | — | — | Rower | rowing, rower |  |
| **Air bike** | *bike* (modality) | sagittal | calories | — | — | Air bike | bike, assault bike, echo bike, airbike | "bike" on its own maps here. |
| **Bike erg** | *bike* (modality) | sagittal | calories | — | — | Bike erg | bikeerg, c2 bike, concept2 bike | Separate from the air bike: calories come much easier. |
| **Ski erg** | *ski* (modality) | sagittal | distance_m | — | — | Ski erg | ski, skierg |  |
| **Double-under** | *jump_rope* (modality) | sagittal | reps | — | — | Jump rope | du |  |
| **Single-under** | *jump_rope* (modality) | sagittal | reps | — | — | Jump rope | su, jump rope, skipping |  |
| **Swim** | *swim* (modality) | sagittal | distance_m | — | — | — | swimming |  |
