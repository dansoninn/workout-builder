# Status

**Updated:** 2026-10-21 by Claude Code
**Working mode:** continuous (CLAUDE.md, "Continuous working mode"): each sub-step on its own branch and pull request, merged when CI is green, production deploys by itself. I stop only for coaching decisions; those collect below under "Questions for Daniel".
**Now:** 4b approved and merged. Next: **4d (block results)**, then 4c (paste a workout), then Step 5.

## Questions for Daniel
None open. Both 4b questions are answered and built (below).

## Your steps
1. **Let the production check redeploy by itself** (5 minutes, once): in Vercel, **Project → Settings → Git → Deploy Hooks**, create a hook named `production-check` for branch `main`, copy its address; in GitHub, **dansoninn/workout-builder → Settings → Secrets and variables → Actions → New repository secret**, name `VERCEL_DEPLOY_HOOK`, paste the address. Without it the check still catches a missed deploy, but only tells you (by GitHub email) instead of fixing it.

## What changed since your 4b review

### Your answers, built
- **Alternating EMOM: the minutes set the length.** The field is now "Intervals" (total minutes for EMOM), and the last rotation may be partial: EMOM 10 with three minutes is 3 rotations + minute 1 once more, so minute 1's lines are done 4 times and the others 3. Under the field the builder says how it falls ("3 rotations + minute 1"). Calc spec §4.3 and decision 13 updated.
- **Default efforts approved**: calc spec §9.4 marked ✅ (strength Load Hard / Pace Easy, AMRAP and intervals Pace Moderate, chipper Pace Hard, plus the earlier ones).
- **Working mode** added to CLAUDE.md as you wrote it.

### Why the 4a merge neither ran CI nor deployed, and the fix
- **Cause:** GitHub had an incident on 2026-10-21, 14:52–19:22 UTC, "Delays for Pull Requests and Webhook deliveries". The 4a merge (15:12 UTC) fell inside it: GitHub never told our CI or Vercel that `main` had changed. Nothing in our setup was wrong, but nothing noticed either.
- **Fix: a production check** that runs after every CI run on `main` and every 30 minutes:
  1. If `main`'s latest commit has no CI run, it starts one.
  2. Once CI has passed, it asks production which commit it runs (new address `/api/version`, public, shows only the commit) and waits up to 5 minutes for the deploy. If production is still behind, it triggers a Vercel deploy (your step 1) and waits again; if that fails too, the check fails and GitHub emails you.
- **Proof** with the 4b merge: see "Pipeline proof" below (filled in after the merge).

### Found and fixed on the way
- **Keys typed right after picking an exercise could be lost.** Picking with Enter and typing the amount at once (fast typist, or a busy page): the first keys landed in the exercise search and vanished, because the cursor can only move once the list has closed. Now those keys are kept and go into the amount. Found when the keyboard-only WOD 1 test failed under load; a new test forces a slow close and fails without the fix.

## How it was verified
| What | Result |
|---|---|
| Unit tests (Vitest) | **306 of 306** (new: alternating EMOM 10 with 3 minutes → 4/3/3 and 10 minutes; 12 intervals with 2 minutes → 12 minutes, 6 each; the rotation hint text) |
| Database tests (pgTAP) | **509 of 509** (no database change) |
| Browser tests (Playwright, production build) | **36 of 36** (new: keys typed right after a pick are the amount) |
| Lint, types | clean |

## Pipeline proof
Filled in after the 4b merge.

## Next
**4d: block results** — after class, a coach logs each block's result for the class (AMRAP rounds, For Time finish times, as a low–high range), phone-first. Then **4c** (paste a workout from the whiteboard, built from common formats and the three §7 workouts), then **Step 5** (month calendar with drag and drop, a template on several dates, Analytics over 7/14/30 days or a custom range with the four lenses, warnings).
