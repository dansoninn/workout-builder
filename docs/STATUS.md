# Status

**Updated:** 2026-10-21 by Claude Code
**Current step:** Step 2 — Exercise library. **Complete and live on the remote project. Waiting for Daniel's approval to start Step 3.**

## What was built

Daniel's Step 2 review decisions (2026-10-21) applied:

1. **Library approved with changes.** Reference: `docs/core-library.md` (generated from `src/lib/library/`).
2. **`hip_flexors` muscle** added to taxonomy v2 (migration `20261021000950`), placed after adductors.
3. **Sled push = lunge 0.6 / carry 0.4.** Arms are a brace, not a press. Sled drag (carry 1.0) and sled pull (h_pull 1.0) as proposed.
4. **Monostructural:** no patterns, no muscles (confirmed, enforced by tests).
5. **Ambiguous terms:** generic words are no longer core aliases. New core table `ambiguous_exercise_terms` (migration `20261021000950`) lists candidates per word. The database blocks a term from also being a core alias, in both directions. A gym saves its choice as a gym alias. Data model spec §5 has the note and lookup order.
6. **Dips = v_push** (confirmed).
7. **Equipment:** approved, plus `trap_bar` and `cable_machine`: 26 items.
8. **8 new exercises:** trap bar deadlift, Nordic hamstring curl, Copenhagen plank (↔, adductors), calf raise, lat pulldown, face pull, box step-over, burpee pull-up. Alias "shuttle run" → Run.
9. **Backlog:** plyometric foot contacts metric added (Step 3+).

**Totals:** 128 core exercises, 26 equipment items, 366 core aliases, 13 ambiguous terms (35 candidate rows), 16 muscle groups. Taxonomy stays at version 2.

### Generic words: my choice per word
| Word | Decision | Candidates / target |
|---|---|---|
| squat | ambiguous | Back squat, Front squat, Air squat, Goblet squat |
| lunge | ambiguous | Walking lunge, Reverse lunge |
| clean | ambiguous | Squat clean, Power clean, Hang power clean, Hang squat clean, Dumbbell clean |
| snatch | ambiguous | Squat snatch, Power snatch, Hang power snatch, Dumbbell snatch, Kettlebell snatch |
| jerk | ambiguous | Push jerk, Split jerk |
| press | ambiguous | Strict press, Push press, Dumbbell shoulder press |
| dip | ambiguous | Ring dip, Bar dip |
| muscle up | ambiguous | Ring muscle-up, Bar muscle-up |
| bike | ambiguous | Air bike, Bike erg (gyms have one or the other) |
| bench | **kept as alias** | Bench press (as you said) |
| row | **kept as alias** | Row (rowing machine). Strength rows are always qualified ("DB row", "ring row"); the parser can also use the unit (m/cal vs reps). |
| ski | **kept as alias** | Ski erg (the only ski exercise) |
| *also made ambiguous* | hang clean, shoulder press, db squat, hollow | Each fits two exercises (e.g. hollow → hold or rock) |

### hip_flexors placement
- **Primary:** toes-to-bar, knees-to-elbows, hanging knee raise (listed first), GHD sit-up, V-up, L-sit, mountain climber.
- **Secondary:** sit-up (AbMat), hollow hold, hollow rock.

### New exercises: my calls
- Trap bar deadlift: hinge 1.0, with quads as a primary muscle.
- Nordic hamstring curl: hinge 1.0. **Provisional, see the questions below.**
- Copenhagen plank: core 1.0, frontal plane, unilateral; primary adductors and obliques; uses a bench.
- Calf raise: **no pattern. Provisional, see the questions below.**
- Lat pulldown: v_pull 1.0 (cable machine). Face pull: h_pull 1.0 (cable machine or band).
- Box step-over: lunge 1.0, unilateral (like the step-up).
- Burpee pull-up: h_push 0.4 / jump 0.3 / v_pull 0.3 (burpee split plus the pull-up).

## Test results
- **pgTAP:** 315 of 315 pass (8 files). `08_core_library_seed` now has 30 checks, covering:
  - 128 exercises, 26 equipment items, 13 terms.
  - Weights sum to 1.00, with calf raise the only pattern-free movement.
  - hip_flexors on exactly the 10 listed movements.
  - Sled push split.
  - Ambiguous-term rules enforced both ways.
  - A gym can save "squat" = back squat as its own alias, and other gyms don't see it.
- **Vitest:** 28 of 28 pass: library rules, review decisions, worked-WOD terms resolve (via alias or ambiguous term), generated files current.
- `supabase db lint`, typecheck, ESLint: clean.
- **Remote:** migrations `20261021000950` and `20261021001000` pushed after all tests passed. Verified:
  - 11 of 11 migrations match.
  - All 13 reference and library tables are identical row for row (fingerprint comparison).
  - The structure differs only by the known Supabase platform defaults.

## Decisions made or interpreted
- `hip_flexors` region = lower (next to glutes and adductors).
- Calc spec §2.4, §3 and §9.7 marked ✅. Data model spec: ambiguous terms (§5), equipment row (§4), amendment line.
- Library document renamed `docs/review-core-library.md` → `docs/core-library.md`; it is now the approved reference, not a proposal.

## Open questions for Daniel
1. **Calf raise has no movement pattern.** Ankle work fits none of the 11 patterns, so it counts in muscle analytics (calves) but not in pattern exposure. OK, or map it to a pattern?
2. **Nordic hamstring curl = hinge 1.0.** It's knee flexion, but hinge is the closest posterior-chain pattern and it balances knee-dominant work in the knee:hip ratio. OK?
3. **Saving gym aliases in Step 4:** today only owners and head coaches can write gym aliases (the exercise bank). Should a coach who answers "which squat?" be allowed to save the gym's answer too? (In BACKLOG, Step 4.)

Still open in BACKLOG: `profiles.locale` under English only; calc spec §9.4–9.6 provisional (Step 3).

## Recommended next step
Approve Step 2, answer the three questions above (1 and 2 can also wait until Step 3), then start **Step 3 — calculation engine**: a pure TypeScript engine tested against the three worked WODs in calc spec §7. Before Step 3 starts, decisions §9.5 (pace defaults: which population) and §9.6 (Rx handling) are needed, since the worked examples depend on them.
