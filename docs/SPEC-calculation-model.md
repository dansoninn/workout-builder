# Workout Builder — Calculation Model & Domain Spec

**Status:** Draft v0.2 — decisions 1–3 and 5–12 approved; 4 partly provisional (§9)
**Date:** 2026-10-20
**Purpose:** The single source of truth for how workouts are described, what is measured, and how every number is calculated. The database schema, parser and UI are all derived from this document. Nothing here is implemented until it is approved.

---

## 1. Principles

1. **Big picture, not lab precision.** The goal is a reliable overview and trends across days, weeks and blocks. Individual numbers are approximations with a known buffer.
2. **Consistency beats precision.** The same method is applied every time, so week-to-week comparisons are valid even when a single number is an estimate. The taxonomy and formulas are versioned and locked (§8).
3. **Estimates are labelled, and given as ranges.** Every computed value carries a confidence flag: `exact` or `estimated`. Every estimated duration, round count or rep count is a range `{low, mid, high}`, not one number (§5.1) ✅. The UI shows estimates with `~` and their range. Coaches trust numbers when they can see where the uncertainty lies.
4. **Established methods only.** Each metric maps to a method used in the sports-science literature (§10). No invented single "load index".
5. **Different stimuli are measured separately.** Heavy strength sets, conditioning reps and monostructural work are not added into one number. That was the core flaw of the earlier prototype (`reps × load factor` makes 100 air squats outweigh 25 heavy back squats).

---

## 2. Taxonomy (locked enums)

Neither the parser nor a user can create new values. Changes require a taxonomy version bump (§8).

### 2.1 Movement patterns
| Key | Description | Region |
|---|---|---|
| `squat` | Bilateral knee-dominant | lower |
| `lunge` | Single-leg / split stance | lower |
| `hinge` | Hip-dominant | lower |
| `h_push` | Horizontal push | upper |
| `v_push` | Vertical push | upper |
| `h_pull` | Horizontal pull | upper |
| `v_pull` | Vertical pull | upper |
| `carry` | Loaded carry | systemic |
| `core` | Trunk flexion / anti-extension / anti-rotation | core |
| `rotation` | Rotational power / transverse | core |
| `jump` | Plyometric / jumping / landing | lower |

Monostructural (cyclical) work is **not** a pattern. It is tracked by **modality** (§2.3).

### 2.2 Planes
`sagittal`, `frontal`, `transverse`, `multiplanar` — set per exercise, curated. No default value: an untagged exercise is flagged for review, not silently set to sagittal.

### 2.3 Monostructural modalities
`run`, `row`, `bike` (incl. assault/echo), `ski`, `jump_rope`, `swim`.

✅ Approved 2026-10-21 (taxonomy v2): monostructural = cyclical cardio only, and monostructural exercises have no movement patterns. Sled push/pull/drag are movements with patterns (e.g. `h_push`, `carry`), not a modality.

### 2.4 Muscle groups
✅ Finalised in Step 2 (approved 2026-10-21, taxonomy v2): quads, hamstrings, glutes, adductors, hip_flexors, calves, chest, lats, upper_back, shoulders, biceps, triceps, forearms_grip, abs, obliques, lower_back. `hip_flexors` was added in Step 2 (toes-to-bar, sit-ups, L-sits etc. no longer count only as abs).

---

## 3. Exercise definition

Each canonical exercise has:
- `name` (canonical) + **aliases in a separate table** (aliases never create new exercises)
- `patterns`: list of `{pattern, weight}`, weights sum to 1.0 (compound movements split)
- `plane`, `primary_muscles[]`, `secondary_muscles[]`, `equipment[]` (from the locked equipment list ✅ approved 2026-10-21)
- `unilateral: boolean`
- `default_unit`: reps | distance_m | calories | time_s
- `implement_count`: implements used when loaded (DB thruster 2, DB snatch 1); the coach can override it per workout line ✅ (§9.8)
- `pace_default` (for estimating max-effort and AMRAP work, §5)
- `owner`: null = core library (curated by us), or `organization_id` = gym-owned

✅ **Pattern-weight table approved 2026-10-21 (Step 2).** The full core library (128 exercises: patterns, muscles, equipment, aliases) is in `docs/core-library.md`, generated from `src/lib/library/`. Rules: weights in steps of 0.1, at most three patterns; holds and braces are not presses (overhead squat, carries, arms on a sled push); a movement that fits no pattern (calf raise) has none; monostructural exercises have no patterns and no muscles.

The examples below are part of the approved table, unchanged:
| Exercise | Patterns |
|---|---|
| Back squat, air squat | squat 1.0 |
| Wall ball | squat 0.6 / v_push 0.4 |
| KB swing | hinge 1.0 |
| Alt. DB snatch | hinge 0.7 / v_pull 0.3 |
| Toes to bar | core 0.7 / v_pull 0.3 |
| Burpee (over rower) | h_push 0.5 / jump 0.5 |
| Box jump over | jump 1.0 |

---

## 4. Prescription model (what a coach writes)

### 4.1 Quantity — every entry has exactly one
| Type | Example | Confidence |
|---|---|---|
| `reps` | 5, 21-15-9 (summed) | exact |
| `reps_range` | 8–10 → midpoint 9 | estimated |
| `reps_per_side` | 8/8 | exact |
| `distance_m` | 800 m | exact |
| `calories` | 15 cal; 8–12 cal → 10 | exact / estimated |
| `time_s` | 30 s plank | exact |
| `max_effort` | max meters / max cal / max reps in a window | estimated via pace (§5) |

### 4.2 Load — optional, one of
- `percent_1rm` (e.g. 75–80%) → stored as intensity zone. **No kg volume**: this is class programming, no athlete 1RM exists.
- `absolute_kg` with Rx variants (e.g. 22.5/15 kg) → volume load computable.
- `bodyweight`
- `rpe` / `rir` target

### 4.3 Block formats
| Format | Parameters | Duration |
|---|---|---|
| `sets` | sets, rest | estimated from sets × (work + rest) |
| `every` (EMOM/E2M/E3M) | interval_s, rounds, alternating (optional) | exact: interval × rounds |
| `amrap` | time_s | exact |
| `for_time` | rounds, time_cap_s | estimated finish, capped |
| `intervals` | rounds, stations, work_s, rest_s, rest_between_rounds_s | exact |
| `tabata` | rounds (default 8), 20/10 | exact |

**Alternating EMOM** ✅ (approved 2026-10-21; slots and partial rotations from Daniel's reviews the same day): an option of `every`, not stations. The block has **ordered slots**, one per interval, and each slot holds one or more lines ("min 1: 10 cal row + 5 burpees, min 2: 12 wall balls"). **`rounds` is the total number of intervals and sets the length**: duration (exact) = interval × rounds. The slots take turns, and **the last rotation may be partial**: EMOM 10 with 3 slots is 3 rotations plus minute 1 once more, so slot 1's lines are done 4 times and slot 2's and 3's lines 3 times. A max-effort line's window is the interval; its fatigue uses the block's total work time (interval × rounds). Without the option, every line is done in every interval.

Each block also has:
- `intent`: `strength` | `conditioning` | `skill` | `mobility` (used for labelling, colour and defaults — **not** for deciding hard sets).
- **Rest after the block** ✅ (approved 2026-10-21), optional: the break before the next block (moving equipment, setting up). It is stored, it counts in the **session length** shown on the calendar, and it is **never** part of planned load (Lens 4).

### 4.4 Effort — two axes, set by the coach in words (APPROVED)
Workouts are not all-out by default. The coach states intended effort on two independent axes, per block (overridable per exercise):

| Axis | Easy | Moderate | Hard | Max (optional) |
|---|---|---|---|---|
| **Pace** — how fast the group should move | Conversational | Steady, challenging | Fast, near limit | All-out |
| **Load** — how hard the lifts should feel | 4+ reps in reserve | ~2–3 reps in reserve | 0–1 reps in reserve | — |

Internal mapping (hidden from the coach, versioned):
| Level | RPE | RIR |
|---|---|---|
| Easy | 3–4 (calc: 4) | 4+ |
| Moderate | 5–6 (calc: 6) | 2–3 |
| Hard | 7–8 (calc: 8) | 0–1 |
| Max | 9–10 (calc: 9.5) | 0 |

Block planned RPE = the higher of pace and load effort for that block. The coach never types a number.

---

## 5. Estimation rules (the buffer)

| Case | Rule | Flag |
|---|---|---|
| Rep range 8–10 | midpoint 9, range 8–10 | estimated |
| AMRAP | rounds = time ÷ estimated round time (sum of exercise paces + transitions); coach can enter target rounds instead. Each completed round is one set | estimated |
| For Time duration | sum of paces + transitions, capped at time cap | estimated |
| Max effort in window | window ÷ pace (pace is seconds per rep, metre or calorie) | estimated |
| Unilateral 8/8 | **8 reps exposure + 1 set** (each side gets the same stimulus as one bilateral set) | exact |
| Rx variants | calculations use the first-listed Rx; all stored ✅ (§9.6) | exact |
| Implements | volume load = kg per implement × implement count (exercise default, line override) ✅ (§9.8) | exact |

### 5.1 Pace model ✅ (approved 2026-10-21)

- **Pace table:** the working pace of an **intermediate adult class member** at Pace **Hard**, including the short breaks such a member takes (`docs/pace-defaults.md`, seeded into `exercises.pace_default`). Approved as the starting point; every gym can override any pace (`exercise_pace_overrides`; owners and head coaches).
- **Effective pace** = table pace × pace-effort factor × fatigue factor.
- **Pace-effort factor** (time per rep): Easy ×1.4 · Moderate ×1.15 · Hard ×1.0 · Max ×0.9.
- **Fatigue factor** for continuous pieces (AMRAP, For Time, max-effort windows), by the piece's estimated duration: under 10 min ×1.0 · 10–20 min ×1.1 · over 20 min ×1.2. The duration is the AMRAP's length; for a max-effort line, its window — except inside an **intervals, EMOM or tabata block, where it is the block's total work time** (intervals: rounds × stations × work; EMOM, alternating or not: rounds × interval; tabata: rounds × work; approved 2026-10-21); for For Time, the finish estimated *before* fatigue (so the band choice is stable). Fixed amounts in sets, EMOMs, intervals and tabata (rest between efforts) get no fatigue factor.
- **Transitions:** 5 s between exercises in a round or chipper. **Rest between sets** when the coach gives none: strength 120 s, other blocks 60 s.
- **Estimate ranges** ✅: every estimated duration, round count and rep count is `{low, mid, high}`. A pace band gives the range: fast = effective pace × 0.85, slow = effective pace × 1.2. Low and high are the smallest and largest results (a fast pace gives more rounds but a shorter finish). Prescribed ranges (8–10 reps, 8–12 cal) carry their own min–max. Ranges add through sums (block → session → week). Exact values have low = mid = high.
- These rules live in `src/lib/engine/config.ts`; changing any of them bumps the calculation version (§8).

---

## 6. Metrics — separate lenses (APPROVED)

Four core lenses below. More metrics can be added at any time without changing stored data, because every rep, load, effort and duration is stored at entry level (§8). The UI shows a small default set; the coach chooses which extra views to open.

### Lens 1 — Strength stimulus: hard sets (APPROVED)
- A **hard set** is any set whose load effort is **Moderate or Hard** (≤3 RIR), in any block. Block type does not decide it: heavy KB swings in an AMRAP can count, a light E2M does not.
- For continuous formats (AMRAP, For Time, intervals) without discrete sets: each completed round counts as one set for the exercises in it, if their load effort qualifies.
- Per pattern: sets × pattern weight.
- Per muscle: primary = 1.0 set, secondary = 0.5 set (fractional set counting).
- Volume load (kg) only when `absolute_kg` is given: sets × reps × kg per implement × implement count (first-listed Rx) ✅.
- Intensity zone recorded (e.g. 75–80% 1RM).

### Lens 2 — Movement exposure: pattern reps
- **All** blocks contribute: reps × pattern weight.
- Feeds balance ratios: push:pull, knee:hip (squat + lunge : hinge), upper:lower, plane distribution.

### Lens 3 — Conditioning: monostructural volume
- Per modality: distance, calories, work time.
- Work:rest structure stored for interval sessions.

### Lens 4 — Session load: planned sRPE
- Per block: planned RPE × block duration (min); session = sum of blocks. Rest between blocks is not counted ✅.
- **Session length** (for the calendar) = block durations + rest between blocks (rest after the last block is ignored) ✅ approved 2026-10-21.
- Weekly: total load, **monotony** (mean ÷ SD of daily load), **strain** (weekly load × monotony).
- Week-on-week change shown as a trend. ACWR may be shown as a trend only, **never** as an injury prediction (see Impellizzeri et al., 2020).
- Note: Foster's original method uses one RPE × total session time; block-sum is our adaptation for *planned* load and is labelled "planned".

Balance warnings are **coach-configurable guidelines**, not scientific thresholds. They are presented as such.

---

## 7. Worked examples (Daniel's real WODs)

**Recomputed 2026-10-21 (Step 3)** with the approved paces and rules (§5.1) and the efforts Daniel set: WOD 1 A Load Moderate, WOD 1 B Load Moderate, WOD 1 C Pace Hard, WOD 2 Pace Hard, WOD 3 Pace Hard. Estimates are shown as middle (low–high). The **initial estimates** in brackets are the first rough guesses written into this section; they were never coach-validated and are kept only for comparison. The engine numbers are what the acceptance tests check (`src/lib/engine/worked-wods.test.ts`).

### WOD 1 — Strength + accessory + AMRAP
| Block | Intent | Effort | Duration | RPE | Result | Load |
|---|---|---|---|---|---|---|
| A. E3M×5: 5 back squat @75–80% | strength | Load Moderate | 15 min | 6 | 5 hard sets squat, 25 reps | 90 AU |
| B. E2M×4: 8–10 DB bench, 8/8 SA DB row | strength | Load Moderate | 8 min | 6 | 4 sets h_push (~36 reps, 32–40), 4 sets h_pull (32 reps) | 48 AU |
| C. AMRAP 8: 5 KB swing, 10 air squat, 15 DU | conditioning | Pace Hard | 8 min | 8 | ~7.7 rounds (6.7–8.7) → ~38 hinge (33–43), ~77 squat (67–87), ~115 DU (100–130) [initial estimate: ~10 rounds, ~50 / ~100 / ~150] | 64 AU |

Session planned sRPE: **202 AU** [initial estimate: 217]

### WOD 2 — Chipper, 25 min cap
800 m run, 50 wall balls (9/6 kg), 30 alt. DB snatches (22.5/15 kg), 20 toes-to-bar, 40 box jump-overs, 10 burpees over the rower, 800 m row (reconstructed from the totals below).
All reps exact. Estimated finish **~20.4 min (17.4–24.4)**: 18.6 min at the table paces, ×1.1 fatigue (10–20 min piece). Pace Hard (RPE 8) → **~163 AU (139–195)** [initial estimate: ~22 min, ~198 AU].
Exposure: squat 30, v_push 20, jump 45, hinge 21, v_pull 15, core 14, h_push 5. Mono: run 800 m, row 800 m. Volume load (first Rx): wall ball 450 kg, DB snatch 675 kg.

### WOD 3 — Intervals 4 × 3 stations, 90/30, 90 s between rounds
Max row, max cal bike, max lunges. Block duration 28.5 min (18 min work), Pace Hard (RPE 8) → **228 AU**.
Estimated (90 s windows; 18 min of total work → fatigue ×1.1): row **~1,226 m (1,021–1,442)**, bike **~65 cal (55–77)**, lunges **~109 reps (91–128)** [initial estimate: ~1,500 m, ~80 cal, ~72 reps].

### If these three were one week
| Metric | Value | What a coach sees |
|---|---|---|
| Hard sets | squat 5, h_push 4, h_pull 4, **hinge 0, vertical 0** | No heavy hinge or vertical work this week |
| Exposure push:pull | 61 : 47 = **1.3** (1.2–1.4) | Fine |
| Exposure knee:hip | ~241 : ~59 = **~4.1** [initial estimate: 227 : 71 = 3.2] | Knee-dominant week |
| Weekly planned sRPE | **~593 AU (569–625)** (202 / ~163 / 228) [initial estimate: 643] | Even distribution, low monotony (0.85) |

This is the case for separate lenses: on exposure alone, hinge looks covered (~59 reps of swings and snatches). On the strength lens it is zero. A single combined index hides exactly that.

---

## 8. Versioning & data integrity

- Raw workout text is stored alongside parsed data and is the source of truth.
- Every computed metric snapshot stores `calc_version` and `taxonomy_version`.
- Changing a formula or taxonomy → new version, history recomputed from raw + parsed data. History is never silently mixed across versions.
- Calculation engine is a pure, deterministic function with unit tests; the three WODs above are the first test fixtures. Built in Step 3 (`src/lib/engine`, `CALC_VERSION = 1`); a change to a formula or to the rules in §5.1 bumps the version.

---

## 9. Decisions needed from Daniel

1. ✅ **Separate lenses** instead of one load index — approved 2026-10-20. More metrics welcome; extensible by design.
2. ✅ **Unilateral rule:** 8/8 = 8 per side → 8 reps exposure + 1 hard set — approved.
3. ✅ **Hard sets decided by load effort, not block type**, via the two effort axes (§4.4) — approved (Daniel's revision).
4. ✅ **Default effort** per block when the coach sets none — all approved 2026-10-21: tabata and EMOM conditioning → Pace Moderate; skill and mobility → Pace Easy; strength → Load Hard / Pace Easy; AMRAP and intervals → Pace Moderate; chipper (For Time) → Pace Hard; **no "accessory" intent** (the coach sets Load Moderate on accessory work).
5. ✅ **Pace defaults** (row 2:00/500 m at max effort in a 90 s window, bike ~20 cal/90 s, etc.) — calibrated to an **intermediate adult class member**; every gym can override them in organization settings. Approved 2026-10-21. The pace table (`docs/pace-defaults.md`) is approved as the starting point and seeded.
6. ✅ **Rx:** calculations use the first-listed Rx; all Rx values are stored — approved 2026-10-21.
7. ✅ **Pattern weights table** for compound movements (§3) — approved 2026-10-21 in Step 2, with changes (hip_flexors added, sled push = lunge 0.6 / carry 0.4). See `docs/core-library.md`.
8. ✅ **Volume load and implements:** volume load = load per implement × implement count. Each exercise has a default implement count (e.g. DB thruster 2, DB snatch 1); the coach can override it on the workout line — approved 2026-10-21.
9. ✅ **Pace-effort scaling:** Easy ×1.4 · Moderate ×1.15 · Hard ×1 · Max ×0.9 (§5.1) — approved 2026-10-21.
10. ✅ **Fatigue factor** for continuous pieces by estimated duration: <10 min ×1.0, 10–20 ×1.1, >20 ×1.2 (§5.1) — approved 2026-10-21.
11. ✅ **Estimate ranges:** every estimated duration, round count and rep count is `{low, mid, high}` from a pace band (fast ×0.85, slow ×1.2) applied after effort and fatigue (§1.3, §5.1) — approved 2026-10-21.
12. ✅ **Observed results:** after class a coach logs what the group did per block (AMRAP rounds low–high, For Time finish low–high, optional note) — `block_results` in the data model spec, built in Step 4. Per-gym pace calibration from logged results comes later (BACKLOG) — approved 2026-10-21.
13. ✅ **Alternating EMOM** is an option of `every` with ordered slots (one per interval, one or more lines each); `rounds` = total intervals and sets the length (duration = interval × rounds); the slots take turns and the last rotation may be partial — EMOM 10 with 3 slots: slot 1 done 4 times, slots 2 and 3 three times (§4.3) — approved 2026-10-21 (slots: Daniel's 4a review; partial rotation: 4b review).
14. ✅ **Rest between blocks** is stored per block, shown in session length, never counted in planned load (§4.3, Lens 4) — approved 2026-10-21.

---

## 10. References

- Foster C. (1998). Monitoring training in athletes with reference to overtraining syndrome. *Med Sci Sports Exerc*, 30(7), 1164–1168. — monotony and strain
- Foster C. et al. (2001). A new approach to monitoring exercise training. *J Strength Cond Res*, 15(1), 109–115. — session-RPE
- Schoenfeld B.J., Ogborn D., Krieger J.W. (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. *J Sports Sci*, 35(11), 1073–1082. — sets as volume metric
- Pelland J.C. et al. (2024). The resistance training dose-response: meta-regressions on weekly volume and frequency. — fractional set counting (indirect sets ≈ 0.5)
- Impellizzeri F.M. et al. (2020). Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. *Int J Sports Physiol Perform*, 15(6), 907–913. — why ACWR is shown only as a trend
- Haff G.G., Triplett N.T. (eds.) *Essentials of Strength Training and Conditioning*, NSCA. — volume load definition

Citations to be verified against the originals before any public or sales material uses them.
