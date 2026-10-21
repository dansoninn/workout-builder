# Status

**Updated:** 2026-10-21 by Claude Code
**Current step:** Step 3 — Calculation engine. **Closed: complete, tested and live on the remote project. Waiting for Daniel's approval to start Step 4.**

## What was built (Step 3 review decisions applied)

1. **Pace table approved and seeded.** 122 core exercises have a `pace_default` (migration `20261021001300`, generated from `src/lib/library/pace-defaults.ts`); the 6 timed holds need none. A new database check (`20261021001250`) accepts only `sec_per_rep` / `sec_per_m` / `sec_per_cal` with positive values. Reference: `docs/pace-defaults.md`.
2. **Pace model** (calc spec §5.1), in `src/lib/engine/config.ts`:
   - Pace-effort scaling: Easy ×1.4, Moderate ×1.15, Hard ×1, Max ×0.9.
   - Fatigue factor for continuous pieces: under 10 min ×1.0, 10–20 min ×1.1, over 20 min ×1.2.
   - Pace band: fast ×0.85, slow ×1.2.
3. **Estimate ranges:** every estimated duration, round count and rep count is now `{low, mid, high}`. Exact values have low = mid = high. Ranges add up from block to session to week.
4. **§7 recomputed** with the approved paces and your efforts (WOD 1 A Load Moderate, WOD 2 Pace Hard). The old numbers are kept in brackets as "initial estimates" (not coach-validated).
5. **Implement counts approved:** migrations `20261021001100` and `20261021001200` are now on the remote.
6. **`block_results`** (observed group results per block) added to the data model spec, to be built in Step 4.
7. **Both specs ✅:** calc spec §1.3, §5/§5.1, §7, §8 and §9.4–§9.12; data model §5, §6 and §7.

## Test results
- **Vitest:** 88 of 88 pass:
  - Engine: 35 rule tests, plus 17 acceptance tests on the three §7 WODs, run with the approved paces.
  - Library: 19. Pace table: 6. Alias normaliser: 10. Smoke test: 1.
- **Mutation check:** I broke three of the new rules on purpose; each broke tests:
  - Long-piece fatigue switched off.
  - Range direction flipped.
  - Pace-effort scaling dropped.
- **pgTAP:** 328 of 328 pass. New checks: 122 seeded paces, timed holds without a pace, stored pace format, and invalid paces rejected.
- **Remote:** the four Step 3 migrations were pushed after all tests passed. Verified:
  - 15 of 15 migrations match.
  - All 13 reference and library tables are identical row for row, including implement counts and paces.
  - The structure differs only by the known Supabase platform defaults.
- **CI:** green on GitHub (see the latest run on `main`).

## §7: what changed and why

| | Initial estimate | Now (engine) | Why |
|---|---|---|---|
| WOD 1 A | RPE 7 → 105 AU | Load Moderate (6) → 90 AU | Your decision |
| WOD 1 C | ~10 rounds | ~7.7 (6.7–8.7) | Approved paces: 47.5 s of work + 15 s transitions per round |
| WOD 1 session | 217 AU | 202 AU | A |
| WOD 2 finish | ~22 min | ~20.4 min (17.4–24.4) | 18.6 min at table paces, ×1.1 fatigue |
| WOD 2 load | ~198 AU | ~163 AU (139–195) | Pace Hard (RPE 8) |
| WOD 3 row / bike / lunges | ~1,500 m / ~80 cal / ~72 | ~1,348 / ~72 / ~120 (with ranges) | Pace Hard in 90 s windows, no fatigue |
| Knee:hip | 3.2 | ~4.2 | Fewer AMRAP swings, more lunges |
| Week | 643 AU | ~593 AU (569–625) | All of the above |

Unchanged: WOD 3 at 228 AU, all exact reps and exposure, volume loads (450 kg and 675 kg), hard sets, push:pull 1.3.

## Decisions made or interpreted
- **Fatigue band:**
  - For Time uses the finish estimated *before* fatigue, so the choice can't flip back and forth at a boundary.
  - AMRAP uses its length; a max-effort line uses its window. WOD 3's 90 s stations therefore get no fatigue.
  - Fixed amounts in sets, EMOMs, intervals and tabata get none.
- **Ranges:**
  - Prescribed ranges keep their own min–max (8–10 reps stays 8–10), as well as the pace band, which covers pace-based estimates.
  - Transitions are not widened by the band.
  - A coach's target rounds stay a single number.
- **Weekly:** monotony and strain use the middle estimate; the weekly total carries the range.
- **Ratios of ranges:** lowest = lowest top ÷ highest bottom.
- **Calculation version:** `CALC_VERSION` stays 1, since nothing has been stored with an earlier version.

## Open questions for Daniel
None blocking. Still open in BACKLOG:
- The remaining provisional defaults in calc spec §9.4: strength = Load Hard / Pace Easy; AMRAP and intervals = Pace Moderate; chipper = Pace Hard. Validate them with real data.

## Recommended next step
Approve Step 3, then start **Step 4 — workout builder** (structured entry first, free-text parser after). Its BACKLOG items:
- Store engine results in `workout_metrics` on every save.
- Line preview showing "2 × load", with a per-line implement override.
- Coaches saving gym aliases when they answer an ambiguous term (audited).
- `block_results` logging.
