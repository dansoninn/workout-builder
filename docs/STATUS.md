# Status

**Updated:** 2026-10-21 by Claude Code
**Current step:** Step 3 closed (approved, with the fatigue fix below). **Step 4 plan ready for Daniel's review: `docs/PLAN-step-4.md`.** Nothing in Step 4 is built.

## What was done

### Step 3 fix (Daniel, 2026-10-21)
- Max-effort windows inside an **intervals block** now take their fatigue band from the block's **total work time** (rounds × stations × work), not from the single window. Calc spec §5.1 updated.
- **WOD 3 recomputed** (§7): 4 × 3 × 90 s = 18 min of work → ×1.1.

  | | Before the fix | Now |
  |---|---|---|
  | Row | ~1,348 m | ~1,226 m (1,021–1,442) |
  | Bike | ~72 cal | ~65 cal (55–77) |
  | Lunges | ~120 | ~109 (91–128) |
  | Week knee:hip | ~4.2 | ~4.1 |

  WOD 3's planned load (228 AU) and the weekly load (~593 AU, 569–625) are unchanged: duration and RPE are exact.
- A new test proves the rule (8 min of interval work → ×1.0; 12 min → ×1.1, even with 60 s windows).

### Step 4 plan
`docs/PLAN-step-4.md`, written to be read by a coach. It covers:
- **Four approval-gated sub-steps:** 4a accounts, gyms and deployment; 4b structured builder with the live load panel; 4c paste text; 4d after-class results.
- For each sub-step: screens, user flows, what reuses the Lovable structure (Builder / Calendar / Analytics / Exercises, light and dark mode, live load panel), and what is tested and how. That includes RLS for every new table, end-to-end browser tests and accessibility checks.
- **Your steps:** the environment variables and the exact Vercel and Supabase clicks.
- Ten questions for you.

## Test results
- **Vitest:** 89 of 89 pass. **pgTAP:** 328 of 328 pass.
- **CI on GitHub:** green for the fix.
- **Remote database:** no change needed; the fix is engine code only.

## Decisions made or interpreted
- "Total work duration" for intervals = rounds × stations × work seconds; rest is not counted.
- EMOM and tabata max-effort windows still use the single window (question 10 in the plan).

## Open questions for Daniel
The ten questions at the end of `docs/PLAN-step-4.md`:
- Sign-in method.
- Domain for the email sender.
- Phones.
- One database for now.
- Pull requests with preview links.
- Lovable screenshots.
- 20–50 real workouts for the parser.
- Drafts.
- Pace-override rights.
- EMOM and tabata fatigue.

## Recommended next step
Approve the plan (with any changes) and answer the questions; questions 1, 2 and 5 matter first. Then I build **4a**. When 4a is ready you do the Vercel and Supabase steps in the plan, and review it on its preview link before approving.
