# Backlog

Single list of everything that is decided, parked or open but not being built right now.
Anyone (Daniel, Claude chat, Claude Code) adds items here instead of losing them in a conversation.
Claude Code reads this file at the start of every step and moves items to "Done" when finished.

Format: `- [ ] Item — context (added YYYY-MM-DD, by)`. Tag the step it belongs to when known.

## Daniel's review feedback (process next, in order)
- [x] Batch review answers 2026-10-22 (Daniel), built 2026-10-22: effort framework (four boxes, calc spec §4.4 and decision 15); "%" as load or effort; effort words, RPE and "@ n/10"; clearer parse hints; AMRAP "7 + 12" by the round's estimated time (decision 16); men/women amounts, first number (decision 17); default guidelines for new gyms (decision 18). Then plan Step 6 (pilot readiness) in docs/PLAN-step-6.md and stop for review. (2026-10-22, Daniel)
- [ ] Later (not MVP): "Athlete / performance mode" for 6–12 week individual programs: precise %1RM, RIR, periodisation, no class buffers. General-public class programming stays the default. (2026-10-22, Daniel)

## Learnings from Afrek's 2024 programming (Excel reference, 504 workouts; Claude chat, 2026-10-23)
File: docs/reference/programming/afrek-2024.xlsx. **One gym's style, not an industry standard (Daniel): support it, never overfit to it.**
Layout: one sheet per month, one row per day; col A = day focus (PP, Squat, DL, Oly / Core, Mix, Partner) and Icelandic holidays; B = day of month; C = weekday; then **one column per program**: KRAFTUR & ÚTHALD (main class), STYRKUR, ÞREK, LIÐLEIKI. Þrek and Liðleiki ran Jan–May only. Each cell = a whole workout. "???" = not yet planned.

Parser / Paste (4c) — frequent notations to support (count in the year):
- [x] "+" pairing of consecutive lines = done back to back (351×); "Superset 1. – 4 sets of:" (222×); "N Sets of:" / "N Rounds of:" with nested lines (600×). — built 2026-10-23 (PRs #26, #27).
- [x] "Dbl." / "Dbl. KB" / "Dbl. DB" = implement count 2 (285×); "Single DB" = 1. — built 2026-10-23 (PRs #26, #27).
- [x] Heavy / Medium / Light inside a line = Load effort for that line, not part of the exercise name (351×). — built 2026-10-23 (PRs #26, #27).
- [x] Alternatives with "or" / "/" ("Dbl. KB or DB", "Burpees/Sprawls", "(T2B/K2E/High Knee Raises)", "(Strict-Kipp-Bfly-C2B-MU)") — 216×: calculate on the first option, store all as alternatives on the line. — built 2026-10-23 (PRs #26, #27).
- [x] Interval forms: E2.5M, E5M, E30S, E40S; "Alt. EMOM x 20 (4 Rounds)" with B1…B5 slots; "Alt. E2M x 15 (5 Rounds)" with numbered slots of several lines; "6x 30 sec on, 12 sec off, 90 sec rest between stations" (station by station — needs rest between stations); "(max 40 sec)" cap on a line. — built 2026-10-23 (PRs #26, #27).
- [x] "Building" sets and "In 12–15 min find heaviest 3–4 rep" (76×) = ramp / max-out: reps known, load unknown, Load effort Hard→Max. — built 2026-10-23 (PRs #26, #27).
- [x] Sequential parts without letters: "First: … Then straight to: … finish with:". — built 2026-10-23 (PRs #26, #27).
- [x] Section words: Finisher (70×), Stretch / Stretch and Relax (107×), Technique, Mobility → intents; stretch blocks not counted in load. — built 2026-10-23 (PRs #26, #27).
- [x] "@ easy-ish pace", "@ 95%+ Effort" (effort framework); "Right Arm / Left Arm" unilateral split; "Burpee's"; "Time Cap 18 min" on its own line; "???" = empty day. — built 2026-10-23 (PRs #26, #27).

Calculation (needs Daniel):
- [x] **Partner workouts — DECIDED (Daniel, 2026-10-23), built 2026-10-23 (PR #25, calc spec §4.5, decision 21):** per-athlete volume, always as a class buffer:
  - "Split reps at will" → each athlete does **50%** of the reps.
  - "I go, you go" → partners alternate; each athlete works ~half the time (1:1 work:rest). Time-bound pieces (AMRAP, time cap): estimate the team's rounds and each athlete gets **50%** of them. Fixed amounts written "each" (e.g. "five rounds each"): each athlete does the full amount and the block takes ~2× as long.
  - sRPE per athlete uses the block duration with the effort of the work; hard sets and exposure use the per-athlete volume. Update calc spec and tests.

Programs & calendar:
- [ ] **Day focus per day** (PP, Squat, DL, Oly / Core, Mix, Partner) shown on the calendar, read by import (col A), filterable in analytics ("all Squat days this quarter"). The focus runs as a rotation across weekdays, not fixed weekdays → optional "focus rotation" helper when planning.
- [ ] **Holidays / closed days** on the calendar (Icelandic public holidays preset, gym can edit); import reads them from col A.
- [ ] Programs can be seasonal (Þrek, Liðleiki Jan–May): program start/end dates, history kept.

Exercise library:
- [x] 794 distinct exercise names in one year. Before Afrek go-live: run this file through the parser, produce a coverage report (matched / ambiguous / unknown, ranked by frequency) and propose library additions for Daniel's approval (e.g. heavy ball floor press, ball over shoulder, beat swing, windmill, russian leg lifts, straight leg toe touches, dynamic side plank, side/forward raises, bent over shoulder fly, rubber band lat pull down / hamstring curl, half-kneeling KB chop, halo, Hindu push-up, flutter kicks, KB SLRDL, dips in rack). — Report and proposals built 2026-10-23: docs/library-coverage.md, src/lib/library/proposed-additions.ts (46 new, 34 changes; 47% → 76% of mentions matched). **Waiting for Daniel's approval** before seeding.
- [x] "row" means both rowing machine ("10-15 cal row") and strength rows ("KB row", "bent over row"): "row" → machine only when the amount is cal/m; otherwise ask. — built 2026-10-23 (PR #28); a "Row" station of a timed block with no amount is read as the machine (STATUS, for review).

## Programs — Afrek launch requirement (audit 2026-10-23, Claude chat; Afrek runs 3–4 programs in parallel)
"Tracks" are called **programs** since Daniel's decision 1 of 2026-10-23 (the table is still `tracks`). Decisions 2–5 of the same day settle the open points below.
- [x] [Afrek launch requirement] Every workout must have a program (NOT NULL, nulls moved to the gym's first active program; required in builder, paste, templates, copy and move; no "No program"). Decision 2. Built 2026-10-23, PR #15. Also: a gym keeps at least one active program.
- [x] [Afrek launch requirement] Reorder programs (owner/head coach, up/down in Settings → Programs, `position`). PR #15.
- [x] [Afrek launch requirement] Calendar: one program by default, remembered per person (`member_preferences`), "All programs" with colours. Decision 3. PR #16.
- [x] [Afrek launch requirement] Analytics: one program by default; several only when chosen, labelled; `period_metrics` takes uuid[]; each workout and warning names its program; warnings, monotony and change per program (calc spec decision 19). Decision 4. PR #17.
- [x] [Afrek launch requirement] Guidelines per program: gym defaults, a program's own set (owner/head coach), each program checked against its own (calc spec decision 20). Decision 5. PR #18.
- [x] [Afrek launch requirement] Database blocks new, copied and moved workouts on archived programs. PR #15.
- [x] [Afrek launch requirement] Program names unique among a gym's active programs, also on restore. PR #15.
- [x] [Afrek launch requirement] Tests: another gym's program through save_workout/copy_workout, null and archived programs, reorder rights (pgTAP 20); calendar and analytics program filters (e2e). PRs #15–#18.
- [ ] (not launch) Results page filter by program; builder load panel shows the week's load for the same program. — small / medium

## Open questions (need Daniel)

## Next steps (planned order)
- [ ] Step 4 — App (plan approved 2026-10-21: docs/PLAN-step-4.md). Four approval-gated sub-steps, each a pull request with a Vercel preview:
  - [ ] Change a gym's address (slug) safely: old links redirect to the new one. Read-only for now. (2026-10-21, Claude Code)
  - [ ] Let coaches and viewers leave a gym themselves (today only an owner can remove someone). (2026-10-21, Claude Code)
  - [ ] Google sign-in (after email + password). (2026-10-21, Daniel)
  - [x] **4b** Approved and merged 2026-10-21 (pull request #2): the builder with the live load panel, calendar week list, templates, Exercises page, gym paces. (2026-10-21, Daniel)
    - [ ] Undo / redo in the builder. (2026-10-21, Claude Code)
    - [ ] Drag and drop for blocks and lines (keyboard and menus today). (2026-10-21, Claude Code)
    - [ ] Restore an archived gym exercise (archive only today). (2026-10-21, Claude Code)
    - [ ] Gym time zone: "today" on the calendar and a new workout's default date use UTC (right for Iceland). Needed before gyms elsewhere. (2026-10-21, Claude Code)
  - [x] **4c** Paste text → parser → check-and-confirm screen; raw text stored — built 2026-10-22 from common whiteboard formats and the three §7 workouts (Daniel's real workouts become test cases when he sends them; they no longer block). (2026-10-21, Daniel)
    - [x] Look up exercises with `normalizeAlias` and strip plurals ("kb swings" → "kb swing"); lookup order gym alias → core alias → ambiguous term → unmatched. (2026-10-21, Claude Code)
    - [x] Ambiguous terms asked once and saved as a gym alias: any coach may save the answer; owner/head coach edit or delete; audit trigger on `exercise_aliases`; RLS change (coach insert limited to ambiguous terms). (2026-10-21, Daniel)
    - [x] Read "2 × 22.5 kg" into the line's implement count (through the load, as the builder does). (2026-10-21, Claude Code)
    - [ ] Read "single DB" / "1 KB" into the implement count of a two-implement exercise (careful: "single-arm" is a different exercise). (2026-10-22, Claude Code)
    - [ ] Add Daniel's real workouts as parser test cases when he sends them; extend the grammar where they need it. (2026-10-22, Daniel)
    - [ ] Paste into an existing workout (add blocks to it) — today a paste makes a new workout. (2026-10-22, Claude Code)
  - [x] **4d** `block_results`: table (data model §6), RLS, audit, pgTAP, and the phone-friendly after-class logging screen — built 2026-10-22 (Results, G then R). (2026-10-21, Daniel)
    - [x] Show logged results on the calendar (cards say "2 results") — built in 5a. (2026-10-22, Claude Code)
    - [ ] A gym's class times as a list to pick from when logging (today the class is free text, e.g. "06:00"). (2026-10-22, Claude Code)
- [ ] **Step 6 — Pilot readiness** (first real gym: Afrek): plan in docs/PLAN-step-6.md. Built without Part 1 (2026-10-23): 6f security pass (CSP, no keys in the browser bundle, dependency audit), 6e runbook draft, 6c export a gym's data, delete your account, delete a gym (30 days to bring back, then erased), cookie check. **Waiting for Daniel's Part 1 decisions** (STATUS.md) for 6a–6f's remaining parts. (2026-10-22, Daniel)
  - [ ] 6c: privacy policy, terms, sub-processor list and DPA pages (needs the legal entity and the lawyer). (2026-10-23, Claude Code)
  - [ ] 6d: alert if the nightly gym erasure (pg_cron `erase-deleted-gyms`) fails. (2026-10-23, Claude Code)
  - [ ] Bringing back a deleted gym leaves its cancelled invitations cancelled: offer to send them again. (2026-10-23, Claude Code)
- [x] Step 5 — Calendar (month and week, drag and drop), templates on several dates, analytics over 7/14/30 days or a range with the four lenses, warnings against the gym's guidelines — built 2026-10-22 (5a, 5b, 5c). (2026-10-21, Daniel)
  - [x] Weekly/period analytics over `workout_metrics` (total, monotony, strain, week-on-week change). (2026-10-21, Claude Code)
  - [ ] A day view in the calendar (month and week today). (2026-10-22, Claude Code)
  - [ ] Analytics comparing two periods side by side; ACWR as a trend only (calc spec Lens 4). (2026-10-22, Claude Code)
- [ ] Later — Plyometric foot contacts metric (jumps, DU/SU, landings) — Lens candidate. (2026-10-21, Daniel)
- [ ] Decide after 4b, with real data: split the `core` pattern into anti-extension / anti-rotation / anti-lateral-flexion / flexion. A taxonomy change (new taxonomy version, pattern weights reviewed). (2026-10-21, Daniel)
- [ ] Decide after 4b, with real data: gait / locomotion as its own pattern (crawls, sprints, shuttles). A taxonomy change (new taxonomy version, pattern weights reviewed). (2026-10-21, Daniel)
- [ ] Later — Per-gym pace calibration from logged `block_results`: suggest pace adjustments only once a gym has ≥ 5 comparable results; never silently override a pace the coach set. (2026-10-21, Daniel)

## Infrastructure / ops
- [ ] Security before first real gym: re-enable Vercel Authentication on previews (disabled 2026-10-21 for testing), separate production database, add CAPTCHA / bot protection on sign-up (Supabase Auth). (2026-10-21, chat)
- [ ] Before the first real gym: buy/choose a domain, set up a custom email sender (e.g. Resend) in Supabase Auth, send invitation emails automatically (4a shares links), and make sure "Confirm email" is on (turned off for testing in 4a). Supabase's built-in email only reaches members of the Supabase team. Point the email templates at `/auth/confirm?token_hash=…` (already built) so links work in any browser. (2026-10-21, Daniel)
- [x] Before the first real gym: a Content-Security-Policy header — built 2026-10-23 (PR #19), without a nonce: prerendered pages cannot carry a per-request one, so inline scripts and styles are allowed; everything else is our own origin only. (2026-10-21, Claude Code)
- [ ] Next.js 16.4 dev-server bug: a route handler at `/` makes pages reload endlessly in development. `/` is routed in the proxy instead. Re-check on the next Next.js upgrade (and report upstream if still present). (2026-10-21, Claude Code)
- [ ] Upgrade Supabase to Pro (daily backups + PITR) BEFORE any real gym data goes in. (2026-10-20)
- [ ] Separate production Supabase project before the first real gym (previews and production share the dev project until then — agreed). (2026-10-21, Daniel)
- [ ] Rename Supabase project display name from "warm-project-pool…" to "workout-builder" (Dashboard → Settings → General). (2026-10-20)
- [ ] Core library changes after go-live: the seed migration is frozen. Step 3 used the pattern of one generated follow-up migration per change (implement counts, paces); a general "diff the library into a migration" tool is still open. (2026-10-21, Claude Code)

## Product ideas (parked — not in MVP)
- [ ] **Program import (after Afrek go-live)** — import whole programming documents (weeks, months, a year) into a program's calendar and analytics. Daniel, 2026-10-23. Requirements:
  - **Its own workspace** ("Import"), separate from the builder: the whole process happens there, nothing touches the calendar until the coach confirms.
  - **Input:** Excel/Google Sheets export (.xlsx, .csv), Word (.docx), PDF, or pasted text. One import = one target program.
  - **Structure step:** the app proposes how the document is laid out (which column/heading is the date, the day, the block, the lines) and the coach corrects it once; the mapping can be saved per gym for the next import.
  - **Reads each day with the same parser as "Paste a workout"** (4c), so the rules never differ.
  - **"Needs you" queue:** everything not understood or unclear is collected in one list (unknown exercise, generic word, missing number, unknown date, effort word) and answered once; answers become gym names/aliases and apply across the whole import.
  - **Preview before import:** a calendar of the import period showing what each day becomes (✓ / ? / not counted), plus an analytics preview of the period (the four lenses) so the coach sees the effect before committing.
  - **Calendar conflicts:** days that already have workouts in that program → per import choose skip / replace / add alongside.
  - **Commit:** all workouts created as drafts or published (coach chooses) in one transaction, tagged with an import batch; raw text of each day stored; **undo the whole import** in one action.
  - Tests: Daniel's real programming documents become test fixtures.
  - **Higher-level additions (Claude chat, 2026-10-23, Daniel invited):**
    - **Impact-sorted queue:** "Needs you" sorted by how many lines each answer fixes ("squat" → 47 lines first); a progress bar of how much is understood.
    - **Rule answers, not only word answers:** "every heading 'Metcon' = conditioning", "'Week 1 Day 1' starts on 2026-01-05" — one answer fixes a whole pattern.
    - **Source side by side:** clicking a day or line in the preview highlights it in the original document, so the coach can check the reading at a glance.
    - **Named benchmark workouts:** recognise "Fran", "Murph", "Cindy", "DT" etc. from a core benchmark library (also used by Paste and the builder); gyms add their own named WODs.
    - **Repeated workouts → templates:** detect workouts that appear several times and offer to save them as templates.
    - **Save and resume:** a large import (a year) can be paused and finished later; nothing is lost.
    - **Personal data guard (GDPR):** detect athlete names, phone numbers or emails in documents and offer to strip them before import.
    - **"Your programming, analysed" report after import:** the period in the four lenses with the main findings in plain words (e.g. "12 weeks: knee:hip 3.8, no heavy hinge in 5 of 12 weeks, wall balls in 40% of sessions"), exportable as PDF. **This is the strongest onboarding and sales moment: a new gym uploads its last 3 months and sees its programming analysed in 10 minutes.**
- [ ] Export analytics to CSV / PDF report. (from Lovable handover)
- [ ] Exercise bank import/export (CSV/JSON) with duplicate detection. (from Lovable handover)
- [ ] Analytics filters by pattern / plane / region; "warnings only" toggle. (from Lovable handover)
- [ ] Athlete / client-facing delivery of workouts. (later phase)
- [ ] Subscriptions & billing per gym. (before selling)
- [ ] Icelandic UI translation — bonus, only if ever needed. (2026-10-21, Daniel)

## Parser follow-ups (from the Afrek coverage run, 2026-10-23, Claude Code)
- [ ] "X vs Y" / "X vs. Y": two stations sharing a slot ("Ski vs. Assault", "Wall sit vs handstand hold"). (2026-10-23, Claude Code)
- [ ] Instruction lines inside a block read as stations: "each", "for", "a", "stations", "rest" alone; "Repeat 4 times through"; "After each round run …". (2026-10-23, Claude Code)
- [ ] "laps" as an amount ("2 laps KB farmers carry"): needs a gym's lap length (a gym setting). (2026-10-23, Claude Code)
- [ ] Time each side ("20/20 sec Pallof hold"). (2026-10-23, Claude Code)
- [ ] Amount after the exercise in reverse order ("Row 500 m" works; "Farmers carry 2 laps" does not). (2026-10-23, Claude Code)
- [ ] Ladders and chippers written as a list of rounds ("1-2-3-…-10"). (2026-10-23, Claude Code)
- [ ] Benchmarks by name (Fran, Murph, …): part of program import. (2026-10-23, Claude Code)
- [ ] Drop the generated `blocks.partner` column once no code reads it (kept for zero-downtime deploys since 003200). (2026-10-23, Claude Code)

## Housekeeping
- [ ] Old Lovable demo account (coach@wodbuilder.app) — password is written in a handover doc; change it or disable the account. (2026-10-20)
- [ ] `npm audit` reports high-severity issues only in dev tools (braces/micromatch via eslint-config-next and the shadcn CLI). Not shipped to users (`npm audit --omit=dev`: 0, since shadcn moved to devDependencies on 2026-10-23); the suggested fixes downgrade those tools. Re-check when they update. (2026-10-21, Claude Code)

## Done
- [x] 4b approved (2026-10-21, Daniel). Alternating EMOM: total intervals set the length and the last rotation may be partial; default efforts (calc spec §9.4) all approved. The 4a merge missed CI and the production deploy because of a GitHub incident (push events delayed or lost); a production check now catches that and re-runs CI and the deploy.
- [x] Step 4b built (2026-10-21): structured builder with the live load panel (keyboard-first, WOD 1 by keyboard gives 202 AU and ~7.7 rounds), save_workout + server-side metrics, publish rule explained, browser backup, templates (save as / use on a date), calendar week list, Exercises page (gym exercises, gym names), gym paces (owner and head coach), alternating EMOM slots, rest after blocks. (2026-10-21, Claude Code)
- [x] Step 4a approved and merged (PR #1, 2026-10-21). Font fix: production rendered serif because shadcn's `--font-sans` pointed at itself; fixed, with a browser test that fails if Geist is not in use. Vercel connected (production https://workout-builder-cyan.vercel.app). (2026-10-21, Daniel)
- [x] Alternating EMOM with several movements per minute: ordered slots, each with one or more lines; rounds were rotations at first, total intervals since the 4b review (calc spec §4.3; built in 4b). (2026-10-21, Daniel)
- [x] 4a answers (2026-10-21, Daniel): a new gym starts with a "Class" program (then called a track; built); Members page read-only for coaches and viewers (approved); alternating EMOM = option of `every`, lines take turns one per interval (database + engine built, calc spec §4.3); rest between blocks stored per block, in session length, never in planned load (database + engine built, calc spec Lens 4).
- [x] Step 4 plan approved with the design-direction correction and answers to all ten questions (see docs/PLAN-step-4.md, Decisions). Long EMOMs and tabata take max-effort fatigue from total work time (calc spec §5.1). (2026-10-21, Daniel)
- [x] Step 3 approved, with the fix: max-effort windows in an intervals block take fatigue from the block's total work time (calc spec §5.1); §7 recomputed. (2026-10-21, Daniel)
- [x] Step 3 — Calculation engine (src/lib/engine): four lenses, weekly load, estimate ranges, pace model (effort scaling, fatigue, pace band), worked WODs as acceptance tests; pace table seeded (122 exercises); implement counts. 88 Vitest + 328 pgTAP passing; pushed to the remote project. (2026-10-21)
- [x] Step 3 review answers (2026-10-21, Daniel): pace table approved as the starting point; effort scaling, fatigue factor and estimate ranges approved; WOD 3 Pace Hard, WOD 1 A Load Moderate, WOD 2 Pace Hard; no accessory intent; implement counts approved; tabata/EMOM/skill/mobility default efforts approved; §7 numbers relabelled as initial estimates; `block_results` specified.
- [x] CI: lint, typecheck, Vitest and pgTAP on every push and pull request (GitHub Actions); first run green. (2026-10-21)
- [x] Step 2 review answers (2026-10-21, Daniel): calf raise has no pattern ✅; Nordic hamstring curl = hinge 1.0 ✅; pace defaults calibrated to an intermediate adult class member, gym-overridable (calc §9.5) ✅; first-listed Rx, all stored (calc §9.6) ✅; volume load = load per implement × implement count (calc §9.8) ✅; `profiles.locale` kept, unused ✅.
- [x] Step 2 — Exercise library: 128 core exercises, 26 equipment items, 366 core aliases, 13 ambiguous terms, `hip_flexors` muscle. Approved with changes and pushed to the remote project; 315 pgTAP + 28 Vitest passing. Reference: docs/core-library.md. (2026-10-21)
- [x] Taxonomy versioning before launch: the Step 2 equipment list goes into taxonomy v2, no v3. (2026-10-21, Daniel)
- [x] Language decision: English only, everywhere. Remove Icelandic labels (`label_is`) from the taxonomy and delete docs/review-icelandic-labels.md. Done in migration 20261021000900. (2026-10-21, Daniel)
- [x] Step 1 — Foundation: scaffold, 8 migrations, RLS on 21 tables, 284 pgTAP tests passing, pushed to remote Frankfurt project. (2026-10-21)
- [x] Data model spec v0.2 approved, incl. tracks managed by owner + head_coach, monostructural exercises cannot have patterns, sled removed from modalities, equipment becomes locked reference data. (2026-10-21)
