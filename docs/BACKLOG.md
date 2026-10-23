# Backlog

Single list of everything that is decided, parked or open but not being built right now.
Anyone (Daniel, Claude chat, Claude Code) adds items here instead of losing them in a conversation.
Claude Code reads this file at the start of every step and moves items to "Done" when finished.

Format: `- [ ] Item — context (added YYYY-MM-DD, by)`. Tag the step it belongs to when known.

## Daniel's review feedback (process next, in order)
- [x] Batch review answers 2026-10-22 (Daniel), built 2026-10-22: effort framework (four boxes, calc spec §4.4 and decision 15); "%" as load or effort; effort words, RPE and "@ n/10"; clearer parse hints; AMRAP "7 + 12" by the round's estimated time (decision 16); men/women amounts, first number (decision 17); default guidelines for new gyms (decision 18). Then plan Step 6 (pilot readiness) in docs/PLAN-step-6.md and stop for review. (2026-10-22, Daniel)
- [ ] Later (not MVP): "Athlete / performance mode" for 6–12 week individual programs: precise %1RM, RIR, periodisation, no class buffers. General-public class programming stays the default. (2026-10-22, Daniel)

## Programs — Afrek launch requirement (audit 2026-10-23, Claude chat; Afrek runs 3–4 programs in parallel)
"Tracks" are called **programs** since Daniel's decision 1 of 2026-10-23 (the table is still `tracks`). Decisions 2–5 of the same day settle the open points below.
- [ ] [Afrek launch requirement] Every workout must have a program: workouts.track_id NOT NULL (data model §6; existing null rows go to the gym's first active program), required in builder, paste, templates and copy_workout; no "No program" in pickers or the calendar. **Decided: decision 2.** — medium
- [ ] [Afrek launch requirement] Reorder programs (owner/head coach): up/down in Settings → Programs, persisted in `position`, used everywhere programs are listed. — small
- [ ] [Afrek launch requirement] Calendar: each program its own space, filtered to one program by default (the last choice remembered per user), with "All programs" as an explicit option showing program colours. **Decided: decision 3.** — small
- [ ] [Afrek launch requirement] Analytics: one program by default; combinations only when the coach selects several programs, always labelled with their names; `period_metrics` takes uuid[]; the workout list shows each workout's program. Never mix silently. **Decided: decision 4.** — medium
- [ ] [Afrek launch requirement] Guidelines per program: gym-level defaults, each program can override (owner/head coach); a combined view checks each program against its own guidelines. **Decided: decision 5.** — medium–large
- [ ] [Afrek launch requirement] Block workouts on archived programs in the database (save_workout, copy_workout, move), not only in the UI. — small
- [ ] [Afrek launch requirement] Program names unique among a gym's active programs in the database (partial unique index) and checked on restore. — small
- [ ] [Afrek launch requirement] Tests: update of another gym's program; other gym's program sent through save_workout/copy_workout; null and archived programs; reorder; calendar/analytics program filters (e2e). — small
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
- [ ] **Step 6 — Pilot readiness** (first real gym: Afrek): plan in docs/PLAN-step-6.md, waiting for Daniel's review and his decisions (domain, Vercel Pro, Supabase Pro + PITR, email sender, legal entity, lawyer). (2026-10-22, Daniel)
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
- [ ] Before the first real gym: a Content-Security-Policy header (nonce-based). 4a sends the other security headers. (2026-10-21, Claude Code)
- [ ] Next.js 16.4 dev-server bug: a route handler at `/` makes pages reload endlessly in development. `/` is routed in the proxy instead. Re-check on the next Next.js upgrade (and report upstream if still present). (2026-10-21, Claude Code)
- [ ] Upgrade Supabase to Pro (daily backups + PITR) BEFORE any real gym data goes in. (2026-10-20)
- [ ] Separate production Supabase project before the first real gym (previews and production share the dev project until then — agreed). (2026-10-21, Daniel)
- [ ] Rename Supabase project display name from "warm-project-pool…" to "workout-builder" (Dashboard → Settings → General). (2026-10-20)
- [ ] Core library changes after go-live: the seed migration is frozen. Step 3 used the pattern of one generated follow-up migration per change (implement counts, paces); a general "diff the library into a migration" tool is still open. (2026-10-21, Claude Code)

## Product ideas (parked — not in MVP)
- [ ] Historical import: upload existing programming spreadsheets, preview interpretation, map unknown exercises, backfill analytics. (from Lovable handover)
- [ ] Export analytics to CSV / PDF report. (from Lovable handover)
- [ ] Exercise bank import/export (CSV/JSON) with duplicate detection. (from Lovable handover)
- [ ] Analytics filters by pattern / plane / region; "warnings only" toggle. (from Lovable handover)
- [ ] Athlete / client-facing delivery of workouts. (later phase)
- [ ] Subscriptions & billing per gym. (before selling)
- [ ] Icelandic UI translation — bonus, only if ever needed. (2026-10-21, Daniel)

## Housekeeping
- [ ] Old Lovable demo account (coach@wodbuilder.app) — password is written in a handover doc; change it or disable the account. (2026-10-20)
- [ ] `npm audit` reports 5 high-severity issues in ESLint's dev-only dependency chain (braces/micromatch via eslint-config-next). Not shipped to users; the suggested fix downgrades Next's lint config. Re-check when eslint-config-next updates. (2026-10-21, Claude Code)

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
