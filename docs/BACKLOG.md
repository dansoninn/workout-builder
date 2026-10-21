# Backlog

Single list of everything that is decided, parked or open but not being built right now.
Anyone (Daniel, Claude chat, Claude Code) adds items here instead of losing them in a conversation.
Claude Code reads this file at the start of every step and moves items to "Done" when finished.

Format: `- [ ] Item — context (added YYYY-MM-DD, by)`. Tag the step it belongs to when known.

## Open questions (need Daniel)
- [ ] Calc spec §9.4 (default effort per block when the coach sets none) is still provisional. Validate against real data. (2026-10-20, chat)

## Next steps (planned order)
- [ ] Step 3 — Calculation engine, tested against the 3 worked WODs in the calc spec. **Engine and pace table ready for review (2026-10-21); see docs/STATUS.md for the open questions.**
  - [ ] Pace table: proposed in docs/pace-defaults.md; approve, then seed `pace_default` (generated migration) and test the worked WODs against it. (2026-10-21, Daniel)
  - [ ] Push migrations 20261021001100 / 001200 (implement count) to the remote project once Step 3 is approved. (2026-10-21, Claude Code)
  - [ ] Plyometric foot contacts metric (jumps, DU/SU, landings) — Lens candidate, Step 3+. (2026-10-21, Daniel)
- [ ] Step 4 — Save engine results to `workout_metrics` on every workout save (with `calc_version` and `taxonomy_version`); show warnings next to the lines they concern. (2026-10-21, Claude Code)
- [ ] Step 4 — Workout builder (structured entry first, free-text parser after).
  - [ ] Parser: look up exercises with `normalizeAlias` (src/lib/normalize-alias.ts) and strip plurals ("kb swings" → "kb swing"); core aliases list singular forms only. Lookup order: gym alias → core alias → ambiguous term → unmatched. (2026-10-21, Claude Code)
  - [ ] Ambiguous terms: when a line matches `ambiguous_exercise_terms` ("squat", "clean", "bike", …), ask the coach once which exercise the gym means and save it as a gym alias. **Decided:** any coach may save the answer; owner/head coach edit or delete gym aliases; add an audit trigger on `exercise_aliases` so the log records who. Needs an RLS change (coach insert limited to ambiguous terms). (2026-10-21, Daniel)
  - [ ] Parser: read "2 × 22.5 kg" / "single DB" into the line's `implement_count` override. (2026-10-21, Claude Code)
- [ ] Step 5 — Calendar, templates, analytics.
  - [ ] Weekly/period analytics over `workout_metrics` (the engine's `weekSummary` already computes total, monotony, strain, week-on-week change). (2026-10-21, Claude Code)

## Infrastructure / ops
- [ ] Connect Vercel to the GitHub repo (after a deployable home page exists). (2026-10-20)
- [ ] Upgrade Supabase to Pro (daily backups + PITR) BEFORE any real gym data goes in. (2026-10-20)
- [ ] Rename Supabase project display name from "warm-project-pool…" to "workout-builder" (Dashboard → Settings → General). (2026-10-20)
- [ ] Core library changes after go-live: the seed migration is on the remote database (2026-10-21) and is now frozen. The generator writes only that initial seed, so the next library edit needs tooling that generates a follow-up migration (the "generated files are up to date" test will flag the first source change). (2026-10-21, Claude Code)

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
- [x] CI: lint, typecheck, Vitest and pgTAP on every push and pull request (GitHub Actions); first run green. (2026-10-21)
- [x] Step 2 review answers (2026-10-21, Daniel): calf raise has no pattern ✅; Nordic hamstring curl = hinge 1.0 ✅; pace defaults calibrated to an intermediate adult class member, gym-overridable (calc §9.5) ✅; first-listed Rx, all stored (calc §9.6) ✅; volume load = load per implement × implement count (calc §9.8) ✅; `profiles.locale` kept, unused ✅.
- [x] Step 2 — Exercise library: 128 core exercises, 26 equipment items, 366 core aliases, 13 ambiguous terms, `hip_flexors` muscle. Approved with changes and pushed to the remote project; 315 pgTAP + 28 Vitest passing. Reference: docs/core-library.md. (2026-10-21)
- [x] Taxonomy versioning before launch: the Step 2 equipment list goes into taxonomy v2, no v3. (2026-10-21, Daniel)
- [x] Language decision: English only, everywhere. Remove Icelandic labels (`label_is`) from the taxonomy and delete docs/review-icelandic-labels.md. Done in migration 20261021000900. (2026-10-21, Daniel)
- [x] Step 1 — Foundation: scaffold, 8 migrations, RLS on 21 tables, 284 pgTAP tests passing, pushed to remote Frankfurt project. (2026-10-21)
- [x] Data model spec v0.2 approved, incl. tracks managed by owner + head_coach, monostructural exercises cannot have patterns, sled removed from modalities, equipment becomes locked reference data. (2026-10-21)
