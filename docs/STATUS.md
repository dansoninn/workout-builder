# Status

**Updated:** 2026-10-21 by Claude Code
**Current step:** Step 2 — Exercise library. **Proposal ready, waiting for Daniel's approval.**

## What was built

### Before Step 2 (Daniel's instructions of 2026-10-21)
- **English only:** migration `20261021000900` drops the Icelandic label columns (`label_is`) from all six taxonomy tables. `docs/review-icelandic-labels.md` deleted; data model spec updated.
- `CLAUDE.md` (working agreement) and `docs/BACKLOG.md` committed.
- Migration 9 pushed to the remote project. Remote and local match: 9 of 9 migrations, no `label_is` left, and the only differences are the Supabase platform defaults already reported (an auto-RLS helper and stricter default privileges on the hosted project).

### Step 2 — core library proposal
- **Source of truth:** `src/lib/library/core-exercises.ts` (120 exercises) and `src/lib/library/equipment.ts` (24 items). Taxonomy keys are typed (`src/lib/taxonomy.ts`), so a typo fails the type check.
- **Generated from it** (`npm run library:generate`):
  - `supabase/migrations/20261021001000_core_exercise_library.sql`: equipment list, 120 core exercises, pattern weights, muscles, equipment links, 352 core aliases. Applied to the **local** database only.
  - `docs/review-core-library.md`: the table for Daniel to review.
- **Alias normaliser** `src/lib/normalize-alias.ts`: the same rules as the database check; the Step 4 parser will use it.
- Exercise ids are UUID v5 of the slug, so they are identical in every database.

## Test results
- **pgTAP:** 301 of 301 pass (8 files). New file `08_core_library_seed.test.sql` (16 checks): library complete and curated, weights sum to 1.00, no monostructural patterns or muscles, every equipment item used, spec examples unchanged, worked-WOD aliases resolve, readable by all signed-in users, writable by none.
- **Vitest:** 24 of 24 pass. Library rules, the 7 spec pattern examples, every exercise in the 3 worked WODs matched by alias, RFC UUID v5 reference vector, and generated files up to date with the source.
- `supabase db lint`, typecheck, ESLint: clean.

## Decisions made or interpreted (easy to change)
1. **Pattern weights:** steps of 0.1, at most three patterns, dominant phase 0.6–0.7. The 7 spec examples are used unchanged; similar movements follow them (thruster = wall ball, cleans/snatches = DB snatch, squat versions add squat 0.3).
2. **Holds are not presses:** overhead squat, overhead lunge, carries and the Turkish get-up have no v_push.
3. **One exercise per implement for the main lifts** (barbell / dumbbell / kettlebell versions are separate). Bodyweight movements that can be loaded (lunges, step-ups) stay one exercise; the load goes on the workout line.
4. **The canonical name is always an alias**, so the parser looks in one table.
5. **Pace defaults left empty** until calc spec §9.5 is decided (backlog, Step 3).
6. **Taxonomy v2 notes** updated to record the equipment list; no v3 (as decided).

## Open questions for Daniel
1. **Approve the library table**: `docs/review-core-library.md` (exercises, pattern weights, muscles, equipment, aliases). Mark any changes.
2. **Muscle list** (calc spec §2.4 says "finalise in Step 2"): keep the 15 groups as they are, or add `hip_flexors`? Sit-ups, toes-to-bar, GHD sit-ups, L-sits and knee raises are hip-flexor heavy and currently all count only as abs. *Recommendation: add `hip_flexors`.*
3. **Sled push:** proposed carry 0.6 / h_push 0.4 (legs drive it), based on your "h_push / carry" example. Sled drag = carry 1.0, sled pull (hand over hand) = h_pull 1.0. Confirm?
4. **Monostructural exercises have no muscles** (like patterns), so a 2 km row never shows up in muscle hard-set counts. Confirm?
5. **Generic words** in aliases: "squat" → Air squat, "lunge" → Walking lunge, "clean" → Squat clean, "snatch" → Squat snatch, "jerk" → Push jerk, "press" → Strict press, "bench" → Bench press, "dip" → Bar dip, "muscle up" → Ring muscle-up, "bike" → Air bike. Confirm?
6. **Dips** counted as vertical push. Confirm?
7. **Equipment list** (24 items, no "bodyweight" item: an exercise with no equipment is bodyweight). Approve?

Still open from before (in BACKLOG): `profiles.locale` under English only.

## Recommended next step
Daniel reviews `docs/review-core-library.md` and answers the questions above. Claude Code then updates the source, regenerates, re-runs all tests, pushes migration `20261021001000` to the remote project, updates calc spec §2.4 / §3 / §9.7 with ✅, and closes Step 2. Then Step 3 (calculation engine).

**Note:** the seed migration is committed to git but **not** on the remote database. Do not run `supabase db push` until Step 2 is approved.
