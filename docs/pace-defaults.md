# Pace defaults

**Status:** approved by Daniel on 2026-10-21 as the starting point (calc spec §9.5). Seeded into `exercises.pace_default` by migration `20261021001300_core_pace_defaults.sql`. Every gym can override any pace in its settings.

Generated from `src/lib/library/pace-defaults.ts` and `src/lib/engine/config.ts` by `npm run library:generate`; do not edit by hand.

## What these paces mean

- **Who:** an intermediate adult class member.
- **What:** the working pace at Pace **Hard** ("fast, near limit"), including the short breaks such a member takes in a metcon. Transitions between exercises are added separately.
- **Anchors** from §9.5, at max effort: row 2:00/500 m and air bike ~20 cal per 90 s (Hard: row 2:14 /500 m, air bike 5 s/cal).
- Used for: AMRAP rounds, For Time finish, max effort in a window, and set durations (calc spec §5).

## Rules

| Rule | Value |
|---|---|
| Pace effort scales the pace (time per rep) | Easy ×1.4 · Moderate ×1.15 · Hard ×1 · Max ×0.9 |
| Fatigue in continuous pieces (AMRAP, For Time, max-effort windows), by estimated duration | under 10 min ×1.0 · 10–20 min ×1.1 · over 20 min ×1.2 |
| Estimate range (pace band, after effort and fatigue) | fast = pace ×0.85, slow = pace ×1.2 |
| Transition between exercises (in a round or chipper) | 5 s |
| Rest between sets when the coach gives none | strength 120 s, other blocks 60 s |

## Worked WODs with these paces (calc spec §7)

Estimates shown as middle (low–high). "Initial estimate" is the first rough guess in §7, not coach-validated.

| Worked WOD | Initial estimate | Engine |
|---|---|---|
| WOD 1 C — AMRAP 8 rounds (Pace Hard) | ~10 | ~7.7 (6.7–8.7) |
| WOD 2 — chipper finish, min (Pace Hard, 25 min cap) | ~22 | ~20.4 (17.4–24.4) |
| WOD 2 — planned load, AU | ~198 | ~163 (139–195) |
| WOD 3 — row m, 4 × 90 s (Pace Hard) | ~1,500 | ~1,348 (1,124–1,586) |
| WOD 3 — air bike cal, 4 × 90 s | ~80 | ~72 (60–85) |
| WOD 3 — lunges, 4 × 90 s | ~72 | ~120 (100–141) |
| Week planned load, AU | 643 | ~593 (569–625) |

## Paces by exercise

### Squat

| Exercise | Pace at Hard |
|---|---|
| Back squat | 3 s/rep (20 reps/min) |
| Front squat | 3 s/rep (20 reps/min) |
| Overhead squat | 4 s/rep (15 reps/min) |
| Air squat | 2 s/rep (30 reps/min) |
| Goblet squat | 3 s/rep (20 reps/min) |
| Dumbbell front squat | 3 s/rep (20 reps/min) |
| Wall ball | 3.5 s/rep (17.1 reps/min) |
| Thruster | 3.5 s/rep (17.1 reps/min) |
| Dumbbell thruster | 3.5 s/rep (17.1 reps/min) |
| Wall sit | — (timed hold) |

### Lunge & single leg

| Exercise | Pace at Hard |
|---|---|
| Walking lunge | 3 s/rep (20 reps/min) |
| Reverse lunge | 3 s/rep (20 reps/min) |
| Overhead walking lunge | 3.5 s/rep (17.1 reps/min) |
| Bulgarian split squat | 3.5 s/rep (17.1 reps/min) |
| Step-up | 3 s/rep (20 reps/min) |
| Box step-over | 3.5 s/rep (17.1 reps/min) |
| Pistol | 5 s/rep (12 reps/min) |
| Lateral lunge | 3.5 s/rep (17.1 reps/min) |
| Cossack squat | 4 s/rep (15 reps/min) |

### Hinge

| Exercise | Pace at Hard |
|---|---|
| Deadlift | 3 s/rep (20 reps/min) |
| Trap bar deadlift | 3 s/rep (20 reps/min) |
| Sumo deadlift | 3 s/rep (20 reps/min) |
| Romanian deadlift | 3 s/rep (20 reps/min) |
| Dumbbell Romanian deadlift | 3 s/rep (20 reps/min) |
| Dumbbell deadlift | 3 s/rep (20 reps/min) |
| Single-leg Romanian deadlift | 4 s/rep (15 reps/min) |
| Kettlebell swing | 2.5 s/rep (24 reps/min) |
| Kettlebell deadlift | 2.5 s/rep (24 reps/min) |
| Good morning | 3 s/rep (20 reps/min) |
| Hip thrust | 3 s/rep (20 reps/min) |
| Glute bridge | 2.5 s/rep (24 reps/min) |
| Back extension | 3 s/rep (20 reps/min) |
| Nordic hamstring curl | 6 s/rep (10 reps/min) |

### Olympic lifts & ballistics

| Exercise | Pace at Hard |
|---|---|
| Power clean | 5 s/rep (12 reps/min) |
| Squat clean | 6 s/rep (10 reps/min) |
| Hang power clean | 4 s/rep (15 reps/min) |
| Hang squat clean | 5 s/rep (12 reps/min) |
| Clean and jerk | 8 s/rep (7.5 reps/min) |
| Power snatch | 5 s/rep (12 reps/min) |
| Squat snatch | 6 s/rep (10 reps/min) |
| Hang power snatch | 4 s/rep (15 reps/min) |
| Push press | 3.5 s/rep (17.1 reps/min) |
| Push jerk | 4 s/rep (15 reps/min) |
| Split jerk | 4.5 s/rep (13.3 reps/min) |
| Shoulder-to-overhead | 4 s/rep (15 reps/min) |
| Ground-to-overhead | 6 s/rep (10 reps/min) |
| Dumbbell snatch | 3 s/rep (20 reps/min) |
| Dumbbell clean | 3.5 s/rep (17.1 reps/min) |
| Dumbbell clean and jerk | 5 s/rep (12 reps/min) |
| Kettlebell snatch | 3 s/rep (20 reps/min) |
| Kettlebell clean | 3 s/rep (20 reps/min) |
| Sandbag clean | 6 s/rep (10 reps/min) |
| Devil press | 7 s/rep (8.6 reps/min) |
| Turkish get-up | 25 s/rep (2.4 reps/min) |

### Vertical push

| Exercise | Pace at Hard |
|---|---|
| Strict press | 3 s/rep (20 reps/min) |
| Dumbbell shoulder press | 3 s/rep (20 reps/min) |
| Dumbbell push press | 3 s/rep (20 reps/min) |
| Handstand push-up | 5 s/rep (12 reps/min) |
| Pike push-up | 3.5 s/rep (17.1 reps/min) |
| Wall walk | 20 s/rep (3 reps/min) |
| Handstand walk | 5 s/m (12 m/min) |
| Ring dip | 4 s/rep (15 reps/min) |
| Bar dip | 3.5 s/rep (17.1 reps/min) |

### Horizontal push & burpees

| Exercise | Pace at Hard |
|---|---|
| Bench press | 3 s/rep (20 reps/min) |
| Dumbbell bench press | 3 s/rep (20 reps/min) |
| Push-up | 3 s/rep (20 reps/min) |
| Burpee | 5 s/rep (12 reps/min) |
| Burpee box jump-over | 7 s/rep (8.6 reps/min) |
| Burpee pull-up | 8 s/rep (7.5 reps/min) |

### Vertical pull

| Exercise | Pace at Hard |
|---|---|
| Pull-up | 3.5 s/rep (17.1 reps/min) |
| Chest-to-bar pull-up | 4.5 s/rep (13.3 reps/min) |
| Chin-up | 4 s/rep (15 reps/min) |
| Lat pulldown | 3 s/rep (20 reps/min) |
| Bar muscle-up | 10 s/rep (6 reps/min) |
| Ring muscle-up | 12 s/rep (5 reps/min) |
| Rope climb | 40 s/rep (1.5 reps/min) |

### Horizontal pull

| Exercise | Pace at Hard |
|---|---|
| Ring row | 3 s/rep (20 reps/min) |
| Bent-over row | 3 s/rep (20 reps/min) |
| Single-arm dumbbell row | 3 s/rep (20 reps/min) |
| Renegade row | 5 s/rep (12 reps/min) |
| Band pull-apart | 2 s/rep (30 reps/min) |
| Face pull | 2.5 s/rep (24 reps/min) |

### Core & rotation

| Exercise | Pace at Hard |
|---|---|
| Toes-to-bar | 4.5 s/rep (13.3 reps/min) |
| Knees-to-elbows | 3.5 s/rep (17.1 reps/min) |
| Hanging knee raise | 3 s/rep (20 reps/min) |
| Sit-up | 2.5 s/rep (24 reps/min) |
| GHD sit-up | 3.5 s/rep (17.1 reps/min) |
| V-up | 3 s/rep (20 reps/min) |
| Hollow hold | — (timed hold) |
| Hollow rock | 1.5 s/rep (40 reps/min) |
| Plank | — (timed hold) |
| Side plank | — (timed hold) |
| Copenhagen plank | — (timed hold) |
| Dead bug | 3 s/rep (20 reps/min) |
| L-sit | — (timed hold) |
| Mountain climber | 1 s/rep (60 reps/min) |
| Bear crawl | 2.5 s/m (24 m/min) |
| Ball slam | 3 s/rep (20 reps/min) |
| Russian twist | 1.5 s/rep (40 reps/min) |
| Woodchop | 3 s/rep (20 reps/min) |
| Rotational med ball throw | 3.5 s/rep (17.1 reps/min) |
| Landmine rotation | 3.5 s/rep (17.1 reps/min) |
| Pallof press | 3 s/rep (20 reps/min) |

### Jump & plyometrics

| Exercise | Pace at Hard |
|---|---|
| Box jump | 4 s/rep (15 reps/min) |
| Box jump-over | 4.5 s/rep (13.3 reps/min) |
| Broad jump | 4 s/rep (15 reps/min) |
| Jump squat | 2.5 s/rep (24 reps/min) |
| Jumping lunge | 2.5 s/rep (24 reps/min) |
| Tuck jump | 3 s/rep (20 reps/min) |
| Skater jump | 2 s/rep (30 reps/min) |
| Jumping jack | 1.2 s/rep (50 reps/min) |

### Carry & sled

| Exercise | Pace at Hard |
|---|---|
| Farmer carry | 1.2 s/m (50 m/min) |
| Front rack carry | 1.4 s/m (43 m/min) |
| Overhead carry | 1.6 s/m (38 m/min) |
| Suitcase carry | 1.4 s/m (43 m/min) |
| Sandbag carry | 1.6 s/m (38 m/min) |
| Sled push | 2 s/m (30 m/min) |
| Sled drag | 1.8 s/m (33 m/min) |
| Sled pull | 3 s/m (20 m/min) |

### Isolation (no pattern)

| Exercise | Pace at Hard |
|---|---|
| Calf raise | 2 s/rep (30 reps/min) |

### Monostructural

| Exercise | Pace at Hard |
|---|---|
| Run | 6:00 /km |
| Row | 2:14 /500 m · 4.5 s/cal (13.3 cal/min) |
| Air bike | 5 s/cal (12 cal/min) |
| Bike erg | 2:10 /1,000 m · 3.5 s/cal (17.1 cal/min) |
| Ski erg | 2:30 /500 m · 5 s/cal (12 cal/min) |
| Double-under | 1 s/rep (60 reps/min) |
| Single-under | 0.5 s/rep (120 reps/min) |
| Swim | 2:30 /100 m |
