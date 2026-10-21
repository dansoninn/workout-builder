# Workout Builder — Data Model Spec

**Status:** Draft v0.1 — awaiting Daniel's approval (decisions in §8)
**Date:** 2026-10-20
**Depends on:** `SPEC-calculation-model.md` v0.2
**Stack:** Supabase (Postgres 15+), EU region (Frankfurt). Schema lives in git as Supabase migrations.

---

## 1. Design rules

1. **Multi-tenant from day one.** The customer is a gym (`organization`), not a single user. Every tenant row carries `org_id`; Row Level Security isolates gyms from each other at the database level, not just in app code.
2. **Raw + parsed.** Workout raw text and each item's raw line are stored next to the parsed structure. Raw is the source of truth.
3. **Entry-level storage.** Every rep, load, effort, distance and duration is stored per item. Any new metric can be computed later from stored data (calc spec §8).
4. **Locked taxonomy.** Patterns, planes, modalities, muscles, effort levels are reference tables owned by us. Tenants read them, never write them. Foreign keys make invalid values impossible.
5. **Nothing is hard-deleted by users.** Soft delete (`deleted_at`) on workouts and exercises; audit log on all programming tables.
6. **Computed data is disposable.** Metrics are cached snapshots tagged with `calc_version`; they can always be rebuilt.

---

## 2. Entity overview

```
organizations ─┬─ memberships ── profiles (auth.users)
               ├─ tracks
               ├─ workouts ── blocks ── block_items ──► exercises
               ├─ exercises (org-owned)  ◄── exercise_aliases
               └─ workout_metrics (cache)

exercises (core, org_id NULL) ─┬─ exercise_patterns ──► movement_patterns
                                ├─ exercise_muscles  ──► muscles
                                └─ exercise_aliases

reference (global, read-only): movement_patterns, planes, modalities,
muscles, effort_levels, taxonomy_versions
```

---

## 3. Tenancy & access

### `organizations`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | "Afrek Functional Fitness" |
| slug | text unique | |
| country | text | ISO code |
| settings | jsonb | pace defaults, warning thresholds, units |
| created_at | timestamptz | |

### `profiles`
`id` (= `auth.users.id`), `display_name`, `locale` (`is` / `en`), `created_at`.

### `memberships`
| column | type | notes |
|---|---|---|
| org_id | uuid FK | |
| user_id | uuid FK | |
| role | enum | `owner` · `head_coach` · `coach` · `viewer` |
| PK | (org_id, user_id) | a coach can belong to several gyms |

Role rights (enforced in RLS):
| | owner | head_coach | coach | viewer |
|---|---|---|---|---|
| Manage members & settings | ✓ | | | |
| Edit gym exercise bank | ✓ | ✓ | | |
| Create / edit workouts | ✓ | ✓ | ✓ | |
| Read everything in the gym | ✓ | ✓ | ✓ | ✓ |

### `tracks`
Gyms program several streams in parallel (e.g. *Class*, *Strength club*, *Endurance*). `id`, `org_id`, `name`, `color`, `position`, `archived_at`.

---

## 4. Reference taxonomy (global, read-only)

| table | key examples | extra columns |
|---|---|---|
| `movement_patterns` | squat, lunge, hinge, h_push, v_push, h_pull, v_pull, carry, core, rotation, jump | region, label_en, label_is |
| `planes` | sagittal, frontal, transverse, multiplanar | labels |
| `modalities` | run, row, bike, ski, jump_rope, swim, sled | default_unit |
| `muscles` | quads, hamstrings, glutes, … | region, labels |
| `effort_levels` | easy, moderate, hard, max | rpe_calc, rir_min, rir_max |
| `taxonomy_versions` | 1, 2, … | published_at, notes |

Bilingual labels (IS/EN) from the start: the product is sold internationally but used in Icelandic gyms.

---

## 5. Exercise library (two layers)

### `exercises`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid NULL | **NULL = core library** (ours); set = gym-owned |
| name | text | canonical display name |
| slug | text | normalised; unique per (org_id, slug) |
| kind | enum | `movement` · `monostructural` |
| modality | FK NULL | required when kind = monostructural |
| plane | FK NULL | NULL = not yet curated (flagged, never defaulted) |
| unilateral | bool | |
| equipment | text[] | KB, DB, BB, BW, … |
| default_unit | enum | reps · distance_m · calories · time_s |
| pace_default | jsonb | e.g. `{ "sec_per_rep": 2 }` or `{ "sec_per_500m": 120 }` |
| status | enum | `active` · `needs_review` · `archived` |
| created_by, created_at, updated_at, deleted_at | | |

### `exercise_patterns`
`exercise_id`, `pattern_key` FK, `weight numeric(3,2)`. **Weights per exercise must sum to 1.00** (deferred constraint trigger).

### `exercise_muscles`
`exercise_id`, `muscle_key` FK, `role` (`primary` · `secondary`).

### `exercise_aliases`
| column | notes |
|---|---|
| org_id NULL | core alias or gym-specific shorthand |
| alias_normalized | lower-case, trimmed, punctuation-stripped |
| exercise_id | target |
| unique | (org_id, alias_normalized) |

Aliases never create exercises. "KB swing", "kb swings", "Russian KBS" → one exercise.

---

## 6. Programming

### `workouts`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| track_id | uuid FK NULL | |
| kind | enum | `scheduled` · `template` |
| date | date NULL | required for scheduled, NULL for templates |
| title | text NULL | |
| focus | text NULL | Strength, Metcon, … (label/colour) |
| status | enum | `draft` · `published` |
| raw_text | text NULL | original free text as typed/pasted |
| parser_version | int NULL | |
| created_by, updated_by, created_at, updated_at, deleted_at | | |

### `blocks`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| workout_id | uuid FK | |
| org_id | uuid | denormalised for RLS speed |
| position | int | |
| label | text | "A", "B", "C" |
| title | text NULL | "Accessory Strength" |
| intent | enum | strength · conditioning · skill · mobility |
| format | enum | sets · every · amrap · for_time · intervals · tabata |
| params | jsonb | validated per format (see below) |
| pace_effort | FK effort_levels NULL | |
| load_effort | FK effort_levels NULL | |
| partner | bool | |
| target_rounds | numeric NULL | coach's AMRAP estimate, overrides pace estimate |
| notes | text | |

`params` shape per format (validated by a CHECK + shared Zod schema in the app):
- `sets`: `{ sets, rest_s }`
- `every`: `{ interval_s, rounds }`
- `amrap`: `{ time_s }`
- `for_time`: `{ rounds, time_cap_s }`
- `intervals`: `{ rounds, work_s, rest_s, rest_between_rounds_s, stations }`
- `tabata`: `{ rounds, work_s: 20, rest_s: 10 }`

### `block_items`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| block_id | uuid FK | |
| org_id | uuid | |
| position | int | |
| station_label | text NULL | "Station 1" |
| exercise_id | uuid FK NULL | NULL = unresolved, shown for review before publish |
| raw_line | text | "8/8 x Single Arm DB Row" |
| quantity | jsonb | see below |
| load | jsonb NULL | see below |
| pace_effort | FK NULL | overrides block |
| load_effort | FK NULL | overrides block |
| notes | text | "I go you go", "L/R" |

`quantity` (exactly one type, per calc spec §4.1):
```json
{ "type": "reps", "value": 5 }
{ "type": "reps_range", "min": 8, "max": 10 }
{ "type": "reps_scheme", "scheme": [21, 15, 9] }
{ "type": "reps_per_side", "value": 8 }
{ "type": "distance_m", "value": 800 }
{ "type": "calories", "min": 8, "max": 12 }
{ "type": "time_s", "value": 30 }
{ "type": "max_effort", "unit": "distance_m" }
```

`load`:
```json
{ "type": "percent_1rm", "min": 75, "max": 80 }
{ "type": "absolute_kg", "rx": [22.5, 15] }
{ "type": "bodyweight" }
```

A workout can only move to `published` when every item has an `exercise_id`.

---

## 7. Computed data, audit, safety

### `workout_metrics` (cache)
`workout_id`, `calc_version`, `taxonomy_version`, `computed_at`, `metrics jsonb`, `confidence jsonb`. PK `(workout_id, calc_version)`. Recomputed on save; rebuilt in bulk on version bump. Weekly/period analytics are SQL functions over this table.

### `audit_log`
`id`, `org_id`, `actor_id`, `table_name`, `row_id`, `action` (insert/update/delete), `diff jsonb`, `at`. Written by triggers on workouts, blocks, block_items, exercises, memberships. Append-only.

### Safety baseline
- RLS on every table. Policy pattern: `org_id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid())`, write rights by role. Core exercises (`org_id IS NULL`) readable by all signed-in users, writable only by service role.
- RLS covered by automated tests (pgTAP): user in gym A can never read or write gym B.
- Supabase paid plan with daily backups; point-in-time recovery before first paying customer.
- Migrations only through git + CI; no schema changes in the dashboard.
- Secrets in environment variables only; nothing in the repo.

### Not built now (but the model leaves room)
- `subscriptions` (org_id, provider ids, plan, status) — when selling.
- Athletes / scores / client delivery — later phase; attaches to `workouts` without changing it.
- AI historical import — writes into the same tables as drafts with `raw_text`.

---

## 8. Decisions needed from Daniel

1. **Customer = gym (organization)** with coaches as members; a solo coach is a gym with one member — approve?
2. **Four roles** (owner, head coach, coach, viewer) — enough, or fewer to start?
3. **Tracks** (parallel programs in the same gym) — include from day one?
4. **Templates** stored as workouts with `kind = template` (same structure, no date) — approve?
5. **Publish rule:** a workout cannot be published while any line is unmatched to an exercise — approve?
