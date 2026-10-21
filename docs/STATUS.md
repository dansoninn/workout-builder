# Status

**Updated:** 2026-10-21 by Claude Code
**Current step:** **4b is built and ready for your review** (branch `step-4b`, pull request #2, Vercel preview linked there). 4a is approved and merged.

## Before you look: production
`main` has 4a merged, but **production (https://workout-builder-cyan.vercel.app) still shows the old build**. GitHub never told Vercel (or our CI) about the merge, so nothing was built. I was not allowed to push a trigger commit to `main` (a production deploy), so this one is yours: in Vercel, **Deployments → the latest `main` deployment → ⋯ → Redeploy** (or "Create Deployment" from `main`). After that, the production address shows the app with the font fix. Merging 4b later deploys production again normally.

## What was built in 4b

### The builder (Builder in the sidebar; a workout opens at its own address)
- **Blocks A, B, C…**: intent, format, and only the fields that format needs (EMOM: every 3:00 × 5; AMRAP: time and target rounds; intervals: rounds, stations, work, rest, rest between rounds; …), **Pace and Load in words** (the default for the block is shown as an outlined choice until you pick), partner, notes, and **rest after the block**.
- **Lines**: pick the exercise by typing (your gym's names first; a generic word like "squat" lists what it could mean and **never picks for you**), then the amount and load the way you write them: `5`, `8-10`, `21-15-9`, `8/8`, `800 m`, `8-12 cal`, `0:30`, `max cal`; `75-80%`, `22.5/15`, `2x22.5`, `bw`. Beside each line the app says what it understood ("8–10 reps · 2 × 22.5 kg"). Per line: own pace or load effort, one or two implements, minute (alternating EMOM), note.
- **Alternating EMOM** as you decided: tick "Alternating minutes", lines are grouped by minute (several lines per minute allowed), and **rounds count rotations**. EMOM with "min 1: 10 cal row + 5 burpees, min 2: 12 wall balls" × 6 is 12 minutes; every line done 6 times.
- **Keyboard-first**: Enter new line, ⌘Enter new block, ⌥↑/↓ move a line, ⌘⌫ delete it, ⌘S save; Save, Publish, Add block and template actions are also in ⌘K. **WOD 1 can be built without touching the mouse** (tested).
- **The live load panel** (right side), recomputed on every keystroke in your browser: session length and planned load as honest ranges, each block's minutes and load (AMRAP rounds too), and three tabs (hard sets by pattern and muscle, volume load, intensity; reps by pattern with push:pull, knee:hip, upper:lower; conditioning by modality). **Warnings name their line ("C2") and jump to it.**
- **Save** stores the workout in one database transaction and recomputes it on the server into `workout_metrics` (calc and taxonomy version). **Publish** checks that every line has an exercise and, if not, lists those lines with links. **Unsaved work is kept in your browser** and offered back after a reload or crash. Viewers see everything read-only.

### Calendar, templates
- **Calendar**: one week, a column per track, each day's workouts with status, session length and planned load (from the stored metrics), the week's planned load per track, and "Add" on any day and track, which opens the builder for that day.
- **Templates**: "Save as template" from any workout; templates are listed under the calendar; a template's "Use on a date" puts a copy on the calendar. The template stays unchanged.

### Exercises and paces
- **Exercises**: the 128 core exercises and your gym's own, searchable by name or alias, filtered by pattern; a detail panel (patterns with weights, muscles, equipment, unit, pace, the names that find it). Owners and head coaches **add gym exercises** (pattern weights must add up to 1.00, live total shown), edit and archive them, and **add your gym's own names** ("bs" → Back squat) that the builder finds first.
- **Settings → Paces**: every exercise's default pace in coaching terms (2:14 /500 m, 6:00 /km, 3 s/rep) and your gym's own. Owners and head coaches set them; coaches and viewers read them. The builder and the stored metrics use your gym's pace.

### Under the hood
- Database (migrations `001700`, `001800`, applied to the hosted project): line slots for alternating EMOM (checked at commit, 1…k without gaps), `exercise_pace_overrides` (owner and head coach, audited), `save_workout` (one transaction; unchanged rows are not touched, so the audit log shows only real edits), `save_gym_exercise`.
- One list of cases checks both the builder's instant validation and the database's rules, so they cannot drift apart.
- Specs updated: calc spec §4.3 and decision 13 (slots), data model §3, §5, §6 (slots, pace overrides, save_workout, templates, gym exercises).

## How it was verified
| What | Result |
|---|---|
| Database tests (pgTAP) | **509 of 509** (new: save_workout 27, pace overrides 13, gym exercises 12, the shared rule cases 48) |
| Unit tests (Vitest) | **305 of 305** (new: field shorthand, draft → engine and → save, **WOD 1 typed into the builder = 202 AU and ~7.7 rounds**, alternating slots, weeks, paces, gym exercise rules) |
| Browser tests (Playwright, production build) | **35 of 35**: WOD 1 by keyboard only → 202 AU, ~7.7 rounds → saved → reloaded → same → the calendar reads 202 AU from the stored metrics; publish blocked by a line without an exercise, with a link to it; browser backup restored; viewer read-only; generic word never picks; template used on a date; gym exercise with pattern weights; gym name found first; gym pace saved, coach read-only; all 4a tests |
| Accessibility (axe, WCAG 2.2 AA, light and dark) | Builder (with a line, a problem, line options, publish check), calendar, exercises (detail and form), paces, plus all 4a screens: **no problems**. Found and fixed: numbers were silent for screen readers (the spoken label sat where screen readers ignore it); calendar "Add" links' names. |
| Looked at by eye | Builder, calendar, exercises, paces in light and dark, desktop and tablet. Fixed from that review: "squat" + Enter picked Back squat (now waits for your pick); volume load showed decimals; a two-dumbbell line showed its count twice after a reload; the week total lost its "~". |

## Decisions made or interpreted (please check)
1. **Alternating EMOM minutes must be whole rotations** (your "rounds = slot rotations"). An "EMOM 10" with three minutes can be written as 9 or 12, not 10. Question 1 below.
2. **Bare numbers in time fields**: "8" in an AMRAP, EMOM or cap field means 8 minutes; in rest and work fields, seconds. Always shown back as m:ss.
3. **A line without an exercise can be saved** (as a draft) but not published; the panel counts it as "not counted".
4. **Default efforts** are shown as an outlined choice ("Easy" for strength pace) and make that block's load an estimate (~), as the calc spec says.
5. **"Today"** (calendar, new workout) is UTC, right for Iceland; a gym time zone is in BACKLOG.
6. **Templates are copies**: using a template on a date makes an independent workout.
7. **Quality over speed, as asked**: browser tests run against production builds. Two real bugs were found only that way: the Exercises actions failed outright, and screen readers heard nothing for numbers.

## Open questions for Daniel
1. Alternating EMOM: allow a shorter last rotation (EMOM 10 with three minutes), or are whole rotations right?
2. Default efforts for strength (Load Hard / Pace Easy), AMRAP and intervals (Pace Moderate) and chipper (Pace Hard) are still marked provisional in the calc spec (§9.4). The builder now shows them; confirm or change.

## Your steps
1. **Redeploy production** from `main` in Vercel (see "Before you look" above).
2. Open the **preview link** on pull request #2 (Vercel login, as before), sign in, and try: build a workout in the builder (try only the keyboard: Enter, ⌘Enter, ⌘S), look at the panel, save, open the calendar, make a template and use it on another day, add a gym exercise and a gym name, set a pace.
3. The hosted database already has 4b's migrations; nothing to do in Supabase.

## Recommended next step
Review 4b. If approved, merge pull request #2, answer the two questions, and send the 20–50 real workouts as text for **4c (paste a workout)**.
