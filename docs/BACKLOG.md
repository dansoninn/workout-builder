# Backlog

Single list of everything that is decided, parked or open but not being built right now.
Anyone (Daniel, Claude chat, Claude Code) adds items here instead of losing them in a conversation.
Claude Code reads this file at the start of every step and moves items to "Done" when finished.

Format: `- [ ] Item — context (added YYYY-MM-DD, by)`. Tag the step it belongs to when known.

## Open questions (need Daniel)
- [ ] Calc spec §9.4: the remaining default efforts (strength = Load Hard / Pace Easy; AMRAP & intervals = Pace Moderate; chipper = Pace Hard) are still provisional. Validate against real data. (tabata/EMOM/skill/mobility approved 2026-10-21.) (2026-10-20, chat)

## Next steps (planned order)
- [ ] Step 4 — Workout builder (structured entry first, free-text parser after).
  - [ ] Save engine results to `workout_metrics` on every workout save (with `calc_version` and `taxonomy_version`); show estimates as ranges and warnings next to the lines they concern. (2026-10-21, Claude Code)
  - [ ] Line preview shows the implement count as "2 × load" (e.g. "2 × 22.5 kg") and lets the coach override it per line. (2026-10-21, Daniel)
  - [ ] `block_results`: build the table (data model §6), RLS, audit trigger and pgTAP tests, plus the after-class logging screen (rounds low–high for AMRAP, finish low–high for For Time, note). (2026-10-21, Daniel)
  - [ ] Parser: look up exercises with `normalizeAlias` (src/lib/normalize-alias.ts) and strip plurals ("kb swings" → "kb swing"); core aliases list singular forms only. Lookup order: gym alias → core alias → ambiguous term → unmatched. (2026-10-21, Claude Code)
  - [ ] Ambiguous terms: when a line matches `ambiguous_exercise_terms` ("squat", "clean", "bike", …), ask the coach once which exercise the gym means and save it as a gym alias. **Decided:** any coach may save the answer; owner/head coach edit or delete gym aliases; add an audit trigger on `exercise_aliases` so the log records who. Needs an RLS change (coach insert limited to ambiguous terms). (2026-10-21, Daniel)
  - [ ] Parser: read "2 × 22.5 kg" / "single DB" into the line's `implement_count` override. (2026-10-21, Claude Code)
- [ ] Step 5 — Calendar, templates, analytics.
  - [ ] Weekly/period analytics over `workout_metrics` (the engine's `weekSummary` already computes total, monotony, strain, week-on-week change). (2026-10-21, Claude Code)
- [ ] Later — Plyometric foot contacts metric (jumps, DU/SU, landings) — Lens candidate. (2026-10-21, Daniel)
- [ ] Later — Per-gym pace calibration from logged `block_results`: suggest pace adjustments only once a gym has ≥ 5 comparable results; never silently override a pace the coach set. (2026-10-21, Daniel)

## Infrastructure / ops
- [ ] Connect Vercel to the GitHub repo (after a deployable home page exists). (2026-10-20)
- [ ] Upgrade Supabase to Pro (daily backups + PITR) BEFORE any real gym data goes in. (2026-10-20)
- [ ] Rename Supabase project display name from "warm-project-pool…" to "workout-builder" (Dashboard → Settings → General). (2026-10-20)
- [ ] Core library changes after go-live: the seed migration is frozen. Step 3 used the pattern of one generated follow-up migration per change (implement counts, paces); a general "diff the library into a migration" tool is still open. (2026-10-21, Claude Code)

## Product ideas (parked — not in MVP)
- [ ] Historical import: upload existing programming spreadsheets, preview interpretation, map unknown exercises, backfill analytics. (from Lovable handover)
- [ ] Export analytics to CSV / PDF report. (from Lovable handover)
- [ ] Analytics filters by pattern / plane / region; "warnings only" toggle. (from Lovable handover)
- [ ] Athlete / client-facing delivery of workouts. (later phase)
- [ ] Subscriptions & billing per gym. (before selling)
- [ ] Icelandic UI translation — bonus, only if ever needed. (2026-10-21, Daniel)

## Housekeeping
- [ ] Old Lovable demo account (coach@wodbuilder.app) — password is written in a handover doc; change it or disable the account. (2026-10-20)
- [ ] `npm audit` reports 5 high-severity issues in ESLint's dev-only dependency chain (braces/micromatch via eslint-config-next). Not shipped to users; the suggested fix downgrades Next's lint config. Re-check when eslint-config-next updates. (2026-10-21, Claude Code)

## Done
- [x] Step 3 — Calculation engine (src/lib/engine): four lenses, weekly load, estimate ranges, pace model (effort scaling, fatigue, pace band), worked WODs as acceptance tests; pace table seeded (122 exercises); implement counts. 88 Vitest + 328 pgTAP passing; pushed to the remote project. (2026-10-21)
- [x] Step 3 review answers (2026-10-21, Daniel): pace table approved as the starting point; effort scaling, fatigue factor and estimate ranges approved; WOD 3 Pace Hard, WOD 1 A Load Moderate, WOD 2 Pace Hard; no accessory intent; implement counts approved; tabata/EMOM/skill/mobility default efforts approved; §7 numbers relabelled as initial estimates; `block_results` specified.
- [x] CI: lint, typecheck, Vitest and pgTAP on every push and pull request (GitHub Actions); first run green. (2026-10-21)
- [x] Step 2 review answers (2026-10-21, Daniel): calf raise has no pattern ✅; Nordic hamstring curl = hinge 1.0 ✅; pace defaults calibrated to an intermediate adult class member, gym-overridable (calc §9.5) ✅; first-listed Rx, all stored (calc §9.6) ✅; volume load = load per implement × implement count (calc §9.8) ✅; `profiles.locale` kept, unused ✅.
- [x] Step 2 — Exercise library: 128 core exercises, 26 equipment items, 366 core aliases, 13 ambiguous terms, `hip_flexors` muscle. Approved with changes and pushed to the remote project; 315 pgTAP + 28 Vitest passing. Reference: docs/core-library.md. (2026-10-21)
- [x] Taxonomy versioning before launch: the Step 2 equipment list goes into taxonomy v2, no v3. (2026-10-21, Daniel)
- [x] Language decision: English only, everywhere. Remove Icelandic labels (`label_is`) from the taxonomy and delete docs/review-icelandic-labels.md. Done in migration 20261021000900. (2026-10-21, Daniel)
- [x] Step 1 — Foundation: scaffold, 8 migrations, RLS on 21 tables, 284 pgTAP tests passing, pushed to remote Frankfurt project. (2026-10-21)
- [x] Data model spec v0.2 approved, incl. tracks managed by owner + head_coach, monostructural exercises cannot have patterns, sled removed from modalities, equipment becomes locked reference data. (2026-10-21)
