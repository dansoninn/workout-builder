# Status

**Updated:** 2026-10-21 by Claude Code
**Current step:** Step 3 — Calculation engine. **Engine and pace table ready for Daniel's review.** Step 3 is not closed: the pace table needs approval first.

## What was built

1. **Your decisions recorded** (both specs ✅, BACKLOG). Pace defaults calibrated to an intermediate adult class member and gym-overridable (§9.5); first-listed Rx (§9.6); volume load per implement × implement count (§9.8, new); coaches may save gym aliases for ambiguous terms (Step 4); `profiles.locale` kept.
2. **CI** (`.github/workflows/ci.yml`): every push and pull request runs lint, typecheck, Vitest, and the full pgTAP suite on a fresh Postgres built from the migrations. No secrets involved. First run green.
3. **Implement count**: migration `20261021001100` adds `exercises.implement_count` (default 1) and a per-line override `block_items.implement_count` (1–4). Generated migration `20261021001200` sets 16 core exercises to 2 (list below). **Local only, not on the remote project yet.**
4. **Calculation engine** (`src/lib/engine/`): pure TypeScript, no database, same input → same output, `CALC_VERSION = 1`.
   - **Lens 1:** hard sets by pattern and muscle (primary 1.0, secondary 0.5), volume load, intensity zones.
   - **Lens 2:** exposure by pattern and plane, plus push:pull, knee:hip and upper:lower ratios.
   - **Lens 3:** monostructural distance, calories, reps and work time per modality.
   - **Lens 4:** duration, planned RPE and sRPE per block and session; weekly total, monotony, strain and week-on-week change.
   - Every number is tagged exact or estimated. Gaps (unmatched line, missing pace) give a warning instead of a guessed number.
5. **Pace table proposal**: `docs/pace-defaults.md`, generated from `src/lib/library/pace-defaults.ts`. It covers the 128 core exercises (timed holds need none) plus three rules. It also shows what your worked WODs come out as with these paces.

## Test results
- **Vitest:** 81 of 81 pass:
  - Engine: 28 rule tests, plus 17 acceptance tests on the three §7 WODs.
  - Library: 19. Pace table: 6. Alias normaliser: 10. Smoke test: 1.
- **Mutation check:** I broke four formulas on purpose and each broke at least one test:
  - Secondary muscle at full weight.
  - Rep range using the minimum instead of the midpoint.
  - 8/8 counted as 16 reps of exposure.
  - Rest between interval rounds dropped.
- **pgTAP:** 321 of 321 pass locally (implement-count checks added).
- **CI:** both jobs green on GitHub.
- **Engine tests and the pace table:** the engine tests use **test-only paces taken from §7/§9.5**, as you asked, not the proposed table. Only the table's own completeness and anchor checks use it.

## Changes to calc spec §7, and why
The approved effort words give RPE 4, 6, 8 or 9.5 only. §7 used RPE 7 and 9, so those blocks now take the nearest word:

| | Was | Now | Why |
|---|---|---|---|
| WOD 1 A (5 back squat @75–80%) | RPE 7 → 105 AU | Load Hard (8) → 120 AU | 7 is a tie between Moderate (6) and Hard (8); the strength default (Hard) decides |
| WOD 1 session | 217 AU | 232 AU | A above |
| WOD 2 chipper | RPE 9 → ~198 AU | Pace Max (9.5) → ~209 AU | 9 is nearest to Max |
| Week | 643 AU | ~669 AU | Both changes above |

Nothing else in §7 changed: implement counts and first Rx give the same volume loads (wall ball 450 kg, DB snatch 675 kg). Pace-dependent numbers stay as written until the pace table is approved. WOD 2's movements weren't listed in §7, so I reconstructed them from its totals and added them to §7.

## Decisions made or interpreted
- **Default efforts beyond §9.4:** tabata, EMOM conditioning and conditioning sets → Pace Moderate; skill and mobility → Pace Easy. "Accessory = Load Moderate" can't be applied automatically because blocks have no accessory intent, so the coach sets it (as in WOD 1 B).
- A block's planned load is marked **estimated** when its effort came from a default rather than from the coach.
- **AMRAP:** exposure uses the estimated rounds including the partial one (9.8); hard sets count completed rounds only (9).
- **Volume load** counts every rep lifted: 8/8 is 16 reps lifted, while exposure stays 8 (the approved unilateral rule).
- **Carries and holds** count exposure in metres and seconds, separately from reps. The balance ratios use reps.
- **Tabata** with several exercises alternates rounds (A, B, A, B, …).
- **For time:** when the estimate passes the cap, the duration is the cap; reps still count in full.
- **Intervals duration** includes the rest after the final station, which matches §7's 28.5 min.
- **Monotony** uses the spread of all 7 daily loads, with rest days as 0.
- **Implement count = 2 (proposed):** DB front squat, DB thruster, walking lunge, reverse lunge, Bulgarian split squat, step-up, DB RDL, DB deadlift, DB clean, devil press, DB shoulder press, DB push press, DB bench press, renegade row, farmer carry, front rack carry. Everything else is 1 (e.g. DB snatch, DB clean & jerk, goblet squat, box step-over).

## Open questions for Daniel
1. **Pace table** (`docs/pace-defaults.md`): approve or adjust. With the proposed paces, your worked WODs come out as:

   | | Your estimate | Proposed paces |
   |---|---|---|
   | WOD 1 C AMRAP | ~10 rounds | ~7.7 |
   | WOD 2 chipper | ~22 min | ~16.8 min |
   | WOD 3 row (90 s × 4) | ~1,500 m | ~1,350 m |
   | WOD 3 lunges | ~72 reps | ~120 reps |

2. **Pace effort scaling:** should the pace slow down or speed up with the effort word (Easy ×1.4, Moderate ×1.15, Hard ×1.0, Max ×0.9)? The spec doesn't say; without scaling, "Easy" and "Max" give the same estimate.
3. **Long pieces:** your AMRAP estimate needs faster paces than mine, but your chipper estimate needs slower ones. Should pace slow down as a piece gets longer (fatigue), or should one of the estimates move?
4. **WOD 3 effort:** your row and bike numbers match the max-effort anchors, but the block is "Hard". Should WOD 3 be Pace Max (RPE 9.5 → ~271 AU)?
5. **§7 effort choices:** is WOD 1 A Load Hard (120 AU), or Moderate (5 reps at 75–80% is about 3–5 in reserve, → 90 AU)? Is WOD 2 Max (~209 AU) or Hard, the chipper default (~176 AU)?
6. **Accessory:** should blocks get an "accessory" intent, so §9.4's "accessory = Load Moderate" default can apply? That's a schema and spec change.
7. **Implement counts:** approve the 16 above. The debatable ones are DB walking lunge, step-up and Bulgarian split squat at 2; single-DB lines can be overridden per line.
8. **Default efforts** for tabata, EMOM, skill and mobility (my extension of §9.4, listed above).

## Recommended next step
Answer 1–8. Then Claude Code finalises the pace table and seeds `pace_default` (generated migration), re-runs the worked WODs against the approved table and updates §7 to match, pushes the Step 3 migrations to the remote project, and closes Step 3. Then Step 4 (workout builder).
