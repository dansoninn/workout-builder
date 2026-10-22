# Status

**Updated:** 2026-10-22 by Claude Code
**Working mode:** continuous (CLAUDE.md, "Continuous working mode"): each sub-step on its own branch and pull request, merged when CI is green, production deploys by itself. I stop only for coaching decisions; those collect below under "Questions for Daniel".
**Now:** 4b, 4d (block results), 4c (paste a workout) and **5a (month calendar)** are on production. Building **5b** (a template on several dates), then **5c** (analytics and warnings). Plan: `docs/PLAN-step-5.md`.

## Questions for Daniel
1. **AMRAP partial rounds, "7 + 12".** Coaches write an AMRAP score as rounds plus reps into the next round. Today the results screen takes decimals ("7.5"). Should it accept "7 + 12"? If yes, how should "+12" become part of a round: the share of the round's reps (12 of 30 reps → 7.4), or the share of the round's estimated time (better when a round mixes reps, calories and metres)? Nothing waits on this; decimals work meanwhile.
2. **Effort words in pasted text.** Whiteboards say "heavy", "light", "sprint", "RPE 8", "@ 7/10". Which Pace or Load level should each mean? Today the parser reads only the app's own words ("Pace Hard", "Load Moderate") and leaves other words at the block's default effort (the builder shows it as the outlined default, so the coach sees it). A word list from you is all it needs.
3. **Men/women amounts** ("15/12 cal bike", "400/300 m run"). Store them as a range for the class (12–15 cal), or use the first (men's) number the way loads use the first Rx? Today the parser asks the coach to rewrite the line.

## Your steps
1. **Let the production check redeploy by itself** (5 minutes, once): in Vercel, **Project → Settings → Git → Deploy Hooks**, create a hook named `production-check` for branch `main`, copy its address; in GitHub, **dansoninn/workout-builder → Settings → Secrets and variables → Actions → New repository secret**, name `VERCEL_DEPLOY_HOOK`, paste the address. Without it the check still catches a missed deploy, but only tells you (by GitHub email) instead of fixing it.

## What changed since your 4b review

### 5a: month calendar, moving workouts
- The calendar opens on the **month** (Monday first; on a phone, a list of days), with **Week** (tracks as columns, the week's planned load per track) one click away. Each workout shows its track colour, Draft, session length, planned load and **logged results** ("2 results").
- **Move a workout** by dragging it to another day (in the week view, also another track), or with its move button (keyboard and touch: pick a date and track). It moves at once; the message has **Undo**; if the server refuses, it goes back and says why. Results and history stay with the workout.

### 4c: paste a workout (Builder → "Paste text", or ⌘K "Paste a workout as text")
Try it at https://workout-builder-cyan.vercel.app with one of your whiteboard workouts.
- **Paste or type the workout as you write it**: block letters (A., B.), section words (Strength, Metcon, Skill, Mobility, Warm-up), formats (AMRAP 12 · 12 min AMRAP · EMOM 10 · E3M x 5 · E90S x 8 · Every 2:00 x 6 · Every 2 min for 10 min · For time · 3 RFT · 5 rounds for time, 20 min cap · Chipper · 21-15-9 · Tabata · 4 rounds 90/30 · 40 s on / 20 s off x 8 · 4 sets), alternating minutes (Min 1: … + …, Odd/Even), lines after a colon ("AMRAP 8: 5 KB swing, 10 air squat"), supersets (A1., A2.), "Back squat" with "5 x 5 @ 80%" on the next line, rest lines, partner, notes.
- Amounts and loads are read **by the same rules as the builder's fields** (8-10, 8/8, 21-15-9, 800 m, 1 km, 15 cal, :45, max cal; @75-80%, (22.5/15 kg), 2 x 22.5 kg, bw), so anything you can type in the builder can be pasted. Plurals and small words are fine ("burpees over the rower" → Burpee).
- **Line by line, as you type**, the right side says what the app understood: ✓ understood, ? for you, – kept as a note. The line number jumps to that line in your text.
- **Nothing is guessed.** A generic word asks "Which “squat” does your gym mean?" **once**: the answer becomes your gym's name for it and is used in every later paste (and in the builder's search). An unknown exercise is picked from suggestions or the library (owners and head coaches can tick "Remember … as your gym's name"); left unpicked, it waits in the builder like any unmatched line. A missing number ("AMRAP" without a time, a line without an amount) stops the workout from being made and says which line. Lines the app cannot place ("Scale: …", "Score: …") become the block's notes.
- **Make workout** saves it as a draft (the text as pasted and each line as written are stored with it) and opens it in the builder to check, change and publish.
- **Your three §7 workouts, pasted, give the approved numbers**: WOD 1 202 AU and ~7.7 rounds (in the spec's one-line style and written down a whiteboard), WOD 2 ~163 AU, WOD 3 228 AU after answering "bike" and "lunge".

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
**4c (paste):**
1. **Intent from the format** when no section word says it: sets → strength; an EMOM of weighted lifts (a load written, or a barbell, dumbbell or kettlebell exercise) → strength; other EMOMs, AMRAP, For time, intervals, tabata → conditioning. The check screen says "(from the format)", and you change it in the builder.
2. **"3 rounds" without "for time"** is read as 3 sets of a circuit (conditioning), with a note on the line: write "for time" if it is.
3. **Lines without an amount** take the 21-15-9 of their block; in intervals and tabata they mean "max" in each work window (WOD 3: "Max row").
4. **Warm-up and cool-down sections** become mobility blocks like any other (counted at their default effort, Pace Easy). Delete the block in the builder if a warm-up should not count.
5. **A pasted workout is a new draft**, opened in the builder; pasting into an existing workout is in BACKLOG.

**4d (results):**
1. **Results is its own section** in the sidebar (G then R), since it is what a coach opens on a phone after class; the builder and ⌘K link to it too. The calendar will show results in Step 5.
2. **Results only for AMRAP and For time blocks**, as the spec says; other formats (EMOM, intervals) have nothing to log.
3. **A class is free text** ("06:00"); a list of the gym's class times is in BACKLOG.
4. **Removing a result** is immediate with an Undo, not a confirm dialog: it is a soft delete and stays in the audit log.

## How it was verified
| What | Result |
|---|---|
| Unit tests (Vitest) | **368 of 368** (new in 4c: 38 parser tests — the three §7 workouts with their approved numbers, 17 heading formats, 21-15-9, alternating minutes, strength lines, supersets, sections, amounts and loads, generic words and plurals, unknown exercises, missing numbers, notes; in 4d: result rules on the shared cases, rounds and times as typed, clock format) |
| Database tests (pgTAP) | **579 of 579** (new in 4c: paste 19 — workout, text and answers in one transaction, a coach may only answer generic words, head coaches name any word, viewers and other gyms nothing, the builder keeps the pasted text, audit; in 4d: block results 32, result rules 19) |
| Browser tests (Playwright, production build) | **39 of 39** (new in 4c: paste with a missing number, a generic word answered once and remembered, an unknown exercise picked and remembered, into the builder, the gym's names used next time; viewers cannot paste; in 4d: the whole after-class flow on a phone) |
| Accessibility (axe, WCAG 2.2 AA) | Paste screen with questions; Results list, results page with the form, read-only results on a phone: **no problems** |
| Looked at by eye | Paste screen (light, dark, tablet); Results on a phone (light and dark) and desktop |
| Production | CI on `main`, deploy and production check after each merge |

## Next
**Step 5**: month calendar with drag and drop, a template on several dates, Analytics over 7/14/30 days or a custom range with the four lenses, warnings.
