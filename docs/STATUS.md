# Status

**Updated:** 2026-10-22 by Claude Code
**Working mode:** continuous (CLAUDE.md, "Continuous working mode"): each sub-step on its own branch and pull request, merged when CI is green, production deploys by itself. I stop only for coaching decisions; those collect below under "Questions for Daniel".
**Now:** 4b and **4d (block results)** are on production. Next: **4c (paste a workout)**, then Step 5.

## Questions for Daniel
1. **AMRAP partial rounds, "7 + 12".** Coaches write an AMRAP score as rounds plus reps into the next round. Today the results screen takes decimals ("7.5"). Should it accept "7 + 12"? If yes, how should "+12" become part of a round: the share of the round's reps (12 of 30 reps → 7.4), or the share of the round's estimated time (better when a round mixes reps, calories and metres)? Nothing waits on this; decimals work meanwhile.

## Your steps
1. **Let the production check redeploy by itself** (5 minutes, once): in Vercel, **Project → Settings → Git → Deploy Hooks**, create a hook named `production-check` for branch `main`, copy its address; in GitHub, **dansoninn/workout-builder → Settings → Secrets and variables → Actions → New repository secret**, name `VERCEL_DEPLOY_HOOK`, paste the address. Without it the check still catches a missed deploy, but only tells you (by GitHub email) instead of fixing it.

## What changed since your 4b review

### 4d: what each class did (Results, G then R)
Try it on your phone at https://workout-builder-cyan.vercel.app.
- **Results** in the sidebar lists the last two weeks' workouts that have an AMRAP or For time block ("Earlier" goes back further), with how many results are logged. The builder has a **Log results** link on such workouts, and ⌘K "Log results".
- A workout's results page shows each AMRAP and For time block: its lines, **the plan** (AMRAP "~5.3 rounds 4.5–6.1"; For time "~6:50 5:50–8:10", the same numbers as the builder) and **what each class did**.
- **Log a result** (built for a phone: big fields, number pads): AMRAP **fewest and most rounds** (decimals for part of a round; "7,5" works too); For time **fastest and slowest finish** (12:15, or 1215 on a number pad; "Some were capped" fills in the cap). One number if the whole class did the same. Class ("06:00") and a note are optional. **Correct** or **remove** a result (with Undo). Viewers see results but cannot log.
- **Rules** (database and screen agree, tested on one list of cases): rounds only on AMRAP blocks, finish times only on For time blocks; lowest ≤ highest; no finish over the time cap; results only on workouts in the calendar, not on templates. Every change is in the audit log with who made it.
- **A block keeps its results**: while a block has results, the builder will not delete it or change its format, and says why ("Block A has results logged for it. Remove those results first, or keep the block."). Other changes (e.g. AMRAP 8 → 10) are allowed.
- Results are stored only. Comparing plan with results and calibrating your gym's paces come later (BACKLOG), and a result never changes a pace by itself.

### Your 4b answers, built
- **Alternating EMOM: the minutes set the length.** The field is now "Intervals" (total minutes for EMOM), and the last rotation may be partial: EMOM 10 with three minutes is 3 rotations + minute 1 once more, so minute 1's lines are done 4 times and the others 3. Under the field the builder says how it falls ("3 rotations + minute 1"). Calc spec §4.3 and decision 13 updated.
- **Default efforts approved**: calc spec §9.4 marked ✅.
- **Working mode** added to CLAUDE.md as you wrote it.

### Why the 4a merge neither ran CI nor deployed, and the fix
- **Cause:** GitHub had an incident on 2026-10-21, 14:52–19:22 UTC, "Delays for Pull Requests and Webhook deliveries". The 4a merge (15:12 UTC) fell inside it: GitHub never told our CI or Vercel that `main` had changed. Nothing in our setup was wrong, but nothing noticed either.
- **Fix: a production check** that runs after every CI run on `main` and every 30 minutes: if `main`'s latest commit has no CI run, it starts one; once CI has passed, it asks production which commit it runs (public address `/api/version`, shows only the commit) and waits for the deploy; if production stays behind, it triggers a Vercel deploy (your step 1), and if that fails too, the check fails and GitHub emails you.
- **Proof** with the 4b merge (merge commit `ab35f96`): CI ran on `main` by itself and passed; production answered `{"commit":"ab35f964…"}` within minutes; the production check ran by itself and passed ("Production runs ab35f96; main is ab35f96"). Every merge since went the same way.

### Found and fixed on the way (all three would bite a fast coach)
- **Keys typed right after picking an exercise were lost** (they went into the closing search list). Now they go into the amount.
- **The first key after Enter or ⌘Enter landed in the line just left** ("15a"), because the cursor moved to the new line a moment later. Now the new line gets the cursor in the same keystroke.
- **iPhones zoomed in when a field was tapped** (text smaller than 16 px). Fields now use 16 px text on phones; nothing changes on larger screens.
Each has a browser test that slows the page down the way a busy phone or laptop would, and fails without the fix.

## Decisions made or interpreted (please check)
1. **Results is its own section** in the sidebar (G then R), since it is what a coach opens on a phone after class; the builder and ⌘K link to it too. The calendar will show results in Step 5.
2. **Results only for AMRAP and For time blocks**, as the spec says; other formats (EMOM, intervals) have nothing to log.
3. **A class is free text** ("06:00"); a list of the gym's class times is in BACKLOG.
4. **Removing a result** is immediate with an Undo, not a confirm dialog: it is a soft delete and stays in the audit log.

## How it was verified
| What | Result |
|---|---|
| Unit tests (Vitest) | **330 of 330** (new: result rules on the shared cases, rounds and times as typed, clock format for finish times, alternating EMOM partial rotation) |
| Database tests (pgTAP) | **560 of 560** (new: block results 32 — roles, gym isolation, rules against the block, templates, soft delete, pinning, audit, a block keeping its results, cascades; result rules 19 on the shared cases) |
| Browser tests (Playwright, production build) | **37 of 37** (new: the whole after-class flow on a phone — log, number-pad time, cap, correct, remove and undo, viewer read-only, builder refusing to drop a block with results; keys typed fast never lost or misplaced) |
| Accessibility (axe, WCAG 2.2 AA) | Results list, results page with the form, read-only results, on a phone: **no problems** (found and fixed: "(optional)" in too light a grey) |
| Looked at by eye | Results list and results page on a phone (light and dark) and desktop |
| Production | CI on `main`, deploy and production check after each merge |

## Next
**4c: paste a workout** from the whiteboard: built from common whiteboard formats and the three §7 workouts (your real workouts become test cases later); a check-and-confirm screen; the raw text kept; a generic word asked once and saved as your gym's name for it. Then **Step 5**: month calendar with drag and drop, a template on several dates, Analytics over 7/14/30 days or a custom range with the four lenses, warnings.
