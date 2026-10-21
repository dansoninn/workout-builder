# Workout Builder — Calculation Model & Domain Spec

**Status:** Draft v0.2 — decisions 1–3 approved; 4–7 provisional (§9)
**Date:** 2026-10-20
**Purpose:** The single source of truth for how workouts are described, what is measured, and how every number is calculated. The database schema, parser and UI are all derived from this document. Nothing here is implemented until it is approved.

---

## 1. Principles

1. **Big picture, not lab precision.** The goal is a reliable overview and trends across days, weeks and blocks. Individual numbers are approximations with a known buffer.
2. **Consistency beats precision.** The same method is applied every time, so week-to-week comparisons are valid even when a single number is an estimate. The taxonomy and formulas are versioned and locked (§8).
3. **Estimates are labelled.** Every computed value carries a confidence flag: `exact` or `estimated`. The UI shows estimates with `~`. Coaches trust numbers when they can see where the uncertainty lies.
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
Fixed list (to be finalised in Step 2): quads, hamstrings, glutes, adductors, calves, chest, lats, upper_back, shoulders, biceps, triceps, forearms_grip, abs, obliques, lower_back.

---

## 3. Exercise definition

Each canonical exercise has:
- `name` (canonical) + **aliases in a separate table** (aliases never create new exercises)
- `patterns`: list of `{pattern, weight}`, weights sum to 1.0 (compound movements split)
- `plane`, `primary_muscles[]`, `secondary_muscles[]`, `equipment[]` (from a locked equipment list, approved in Step 2)
- `unilateral: boolean`
- `default_unit`: reps | distance_m | calories | time_s
- `pace_default` (for estimating max-effort and AMRAP work, §5)
- `owner`: null = core library (curated by us), or `organization_id` = gym-owned

Example pattern weights (to be approved as a table in Step 2):
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
| `every` (EMOM/E2M/E3M) | interval_s, rounds | exact: interval × rounds |
| `amrap` | time_s | exact |
| `for_time` | rounds, time_cap_s | estimated finish, capped |
| `intervals` | rounds, stations, work_s, rest_s, rest_between_rounds_s | exact |
| `tabata` | rounds (default 8), 20/10 | exact |

Each block also has:
- `intent`: `strength` | `conditioning` | `skill` | `mobility` (used for labelling, colour and defaults — **not** for deciding hard sets).

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
| Rep range 8–10 | midpoint | estimated |
| AMRAP | rounds = time ÷ estimated round time (sum of exercise paces + transitions); coach can enter target rounds instead | estimated |
| For Time duration | sum of paces, capped at time cap | estimated |
| Max effort in window | window × pace_default | estimated |
| Unilateral 8/8 | **8 reps exposure + 1 set** (each side gets the same stimulus as one bilateral set) | exact |
| Rx variants | calculations use the first-listed Rx; both stored | exact |

Pace defaults are configurable per gym, so a gym calibrates to its own members.

---

## 6. Metrics — separate lenses (APPROVED)

Four core lenses below. More metrics can be added at any time without changing stored data, because every rep, load, effort and duration is stored at entry level (§8). The UI shows a small default set; the coach chooses which extra views to open.

### Lens 1 — Strength stimulus: hard sets (APPROVED)
- A **hard set** is any set whose load effort is **Moderate or Hard** (≤3 RIR), in any block. Block type does not decide it: heavy KB swings in an AMRAP can count, a light E2M does not.
- For continuous formats (AMRAP, For Time, intervals) without discrete sets: each completed round counts as one set for the exercises in it, if their load effort qualifies.
- Per pattern: sets × pattern weight.
- Per muscle: primary = 1.0 set, secondary = 0.5 set (fractional set counting).
- Volume load (kg) only when `absolute_kg` is given: sets × reps × kg.
- Intensity zone recorded (e.g. 75–80% 1RM).

### Lens 2 — Movement exposure: pattern reps
- **All** blocks contribute: reps × pattern weight.
- Feeds balance ratios: push:pull, knee:hip (squat + lunge : hinge), upper:lower, plane distribution.

### Lens 3 — Conditioning: monostructural volume
- Per modality: distance, calories, work time.
- Work:rest structure stored for interval sessions.

### Lens 4 — Session load: planned sRPE
- Per block: planned RPE × block duration (min); session = sum of blocks.
- Weekly: total load, **monotony** (mean ÷ SD of daily load), **strain** (weekly load × monotony).
- Week-on-week change shown as a trend. ACWR may be shown as a trend only, **never** as an injury prediction (see Impellizzeri et al., 2020).
- Note: Foster's original method uses one RPE × total session time; block-sum is our adaptation for *planned* load and is labelled "planned".

Balance warnings are **coach-configurable guidelines**, not scientific thresholds. They are presented as such.

---

## 7. Worked examples (Daniel's real WODs)

Assumed planned RPE and paces are the defaults to be approved in §9.

### WOD 1 — Strength + accessory + AMRAP
| Block | Intent | Duration | RPE | Result |
|---|---|---|---|---|
| A. E3M×5: 5 back squat @75–80% | strength | 15 min | 7 | 5 hard sets squat, 25 reps |
| B. E2M×4: 8–10 DB bench, 8/8 SA DB row | strength | 8 min | 6 | 4 sets h_push (~36 reps), 4 sets h_pull (32 reps) |
| C. AMRAP 8: 5 KB swing, 10 air squat, 15 DU | conditioning | 8 min | 8 | ~10 rounds → ~50 hinge, ~100 squat, ~150 DU |

Session planned sRPE: **217 AU**

### WOD 2 — Chipper, 25 min cap
All reps exact. Estimated finish ~22 min, RPE 9 → **~198 AU**.
Exposure: squat 30, v_push 20, jump 45, hinge 21, v_pull 15, core 14, h_push 5. Mono: run 800 m, row 800 m. Volume load (first Rx): wall ball 450 kg, DB snatch 675 kg.

### WOD 3 — Intervals 4 × 3 stations, 90/30, 90 s between rounds
Block duration 28.5 min (18 min work), RPE 8 → **228 AU**.
All values estimated: row ~1,500 m, bike ~80 cal, lunges ~72 reps.

### If these three were one week
| Metric | Value | What a coach sees |
|---|---|---|
| Hard sets | squat 5, h_push 4, h_pull 4, **hinge 0, vertical 0** | No heavy hinge or vertical work this week |
| Exposure push:pull | 61 : 47 = **1.3** | Fine |
| Exposure knee:hip | 227 : 71 = **3.2** | Knee-dominant heavy week |
| Weekly planned sRPE | **643 AU** (217 / 198 / 228) | Even distribution, low monotony |

This is the case for separate lenses: on exposure alone, hinge looks covered (71 reps of swings and snatches). On the strength lens it is zero. A single combined index hides exactly that.

---

## 8. Versioning & data integrity

- Raw workout text is stored alongside parsed data and is the source of truth.
- Every computed metric snapshot stores `calc_version` and `taxonomy_version`.
- Changing a formula or taxonomy → new version, history recomputed from raw + parsed data. History is never silently mixed across versions.
- Calculation engine is a pure, deterministic function with unit tests; the three WODs above are the first test fixtures.

---

## 9. Decisions needed from Daniel

1. ✅ **Separate lenses** instead of one load index — approved 2026-10-20. More metrics welcome; extensible by design.
2. ✅ **Unilateral rule:** 8/8 = 8 per side → 8 reps exposure + 1 hard set — approved.
3. ✅ **Hard sets decided by load effort, not block type**, via the two effort axes (§4.4) — approved (Daniel's revision).
4. ⏳ **Default effort** per block when the coach sets none — provisional: strength = Load Hard / Pace Easy; accessory = Load Moderate; AMRAP & intervals = Pace Moderate; chipper = Pace Hard.
5. **Pace defaults** (row 2:00/500 m at max effort in a 90 s window, bike ~20 cal/90 s, etc.) — which population do we calibrate to? Your average class member?
6. **Rx:** calculate on first-listed Rx, or show both?
7. **Pattern weights table** for compound movements (§3) — you approve the final table in Step 2.

---

## 10. References

- Foster C. (1998). Monitoring training in athletes with reference to overtraining syndrome. *Med Sci Sports Exerc*, 30(7), 1164–1168. — monotony and strain
- Foster C. et al. (2001). A new approach to monitoring exercise training. *J Strength Cond Res*, 15(1), 109–115. — session-RPE
- Schoenfeld B.J., Ogborn D., Krieger J.W. (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. *J Sports Sci*, 35(11), 1073–1082. — sets as volume metric
- Pelland J.C. et al. (2024). The resistance training dose-response: meta-regressions on weekly volume and frequency. — fractional set counting (indirect sets ≈ 0.5)
- Impellizzeri F.M. et al. (2020). Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. *Int J Sports Physiol Perform*, 15(6), 907–913. — why ACWR is shown only as a trend
- Haff G.G., Triplett N.T. (eds.) *Essentials of Strength Training and Conditioning*, NSCA. — volume load definition

Citations to be verified against the originals before any public or sales material uses them.
