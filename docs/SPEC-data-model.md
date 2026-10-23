# Workout Builder — Data Model Spec

**Status:** v0.2 — approved
**Amended:** 2026-10-21 — Step 1 review decisions ✅: tracks managed by owner + head coach (§3); sled removed from modalities, equipment becomes a locked list (§4, §5); monostructural exercises have no patterns (§5). Taxonomy version 2. English-only labels (§4). Step 2 review ✅: equipment list approved, `hip_flexors` muscle, ambiguous exercise terms (§5). Step 3 review ✅: implement count (§5, §6), pace defaults seeded with a shape check (§5), `block_results` for observed group results (§6). 2026-10-23: programs (the `tracks` table) required on every workout, with their rules (§3, §6); program dates, day focus and holidays / closed days (§3, "Days on the calendar"); program import (§6).
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
               ├─ invitations (link to join, Step 4a)
               ├─ tracks
               ├─ workouts ── blocks ─┬─ block_items ──► exercises
               │                      └─ block_results (what the group did)
               ├─ exercises (org-owned)  ◄── exercise_aliases
               └─ workout_metrics (cache)

exercises (core, org_id NULL) ─┬─ exercise_patterns  ──► movement_patterns
                                ├─ exercise_muscles   ──► muscles
                                ├─ exercise_equipment ──► equipment
                                ├─ exercise_aliases
                                └─ ambiguous_exercise_terms (core candidates per generic word)

reference (global, read-only): movement_patterns, planes, modalities,
muscles, effort_levels, equipment, taxonomy_versions
```

---

## 3. Tenancy & access

### `organizations`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | "Afrek Functional Fitness" |
| slug | text unique | lowercase words with dashes; the first part of every app address (`/afrek/builder`), so the app's own route names (`settings`, `sign-in`, `invite`…) are reserved (Step 4a) |
| country | text | ISO code |
| settings | jsonb | warning thresholds, units (owner-managed). Gym pace overrides live in their own table, `exercise_pace_overrides` (§5), so head coaches can manage them too. |
| created_at | timestamptz | |

### `profiles`
`id` (= `auth.users.id`), `display_name`, `locale` (`is` / `en`), `created_at`. `locale` is kept but unused under English only — decided 2026-10-21 ✅.

**Deleting a gym** (PLAN-step-6 6c; migration `003100`): `delete_gym(org, name)` (owners, confirmed with the gym's name, any case) sets `organizations.deleted_at`/`deleted_by` and cancels open invitations. Every access helper (`orgs_where_can_*`, `colleague_ids`) and the invitation and member-list functions ignore deleted gyms, so the gym is gone for everyone at once. Its owners see it in `my_deleted_gyms()` and can `restore_gym(org)` it, as it was (invitations stay cancelled), until a nightly `pg_cron` job (`erase-deleted-gyms`, 03:17 UTC) erases gyms deleted more than 30 days ago: the organization and, through `ON DELETE CASCADE`, everything in it; then its audit log, whose rows are the only ones that may ever be deleted (rows of a gym that no longer exists), and the cascade itself writes no audit entries. Someone who deletes their account takes with them the deleted gyms they alone own (nobody else could bring them back).

**Deleting an account** (PLAN-step-6 6c; migration `003000`): `delete_my_account()` deletes the signed-in person's sign-in (`auth.users`), and with it their profile, memberships and preferences. What they wrote stays with each gym: the person columns (`created_by`, `updated_by`, `logged_by`, `invited_by`, `accepted_by`) are `ON DELETE SET NULL`, and the app shows "a former member". Taking a deleted person's name off a row is not an edit: it does not change `updated_at`, writes no audit entry, and is the only way a pinned column (who logged a result) may change (`private.only_names_removed`). The audit log keeps their id (no name). Refused while they are a gym's only owner, naming the gyms.

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
| Manage programs (`tracks`) ✅ | ✓ | ✓ | | |
| Create / edit workouts | ✓ | ✓ | ✓ | |
| Save a gym alias by answering an ambiguous term ✅ (Step 4) | ✓ | ✓ | ✓ | |
| Edit / delete gym aliases | ✓ | ✓ | | |
| Read everything in the gym | ✓ | ✓ | ✓ | ✓ |

Gym aliases (approved 2026-10-21): when the parser asks "which squat?", any coach may save the answer as a gym alias; only owners and head coaches can change or delete gym aliases afterwards. Alias changes are written to the audit log (who and when). Built in 4c (migration `002000`): a coach's insert is allowed only when the word is an ambiguous term (RLS policy "Coaches can answer a generic word for the gym"); owners and head coaches add any gym alias (also from the paste screen, "Remember … as your gym's name"); `exercise_aliases` has the audit trigger.

### `invitations` (Step 4a)
An owner invites a person by email with a role and shares the link (automatic emails come with the custom email sender, BACKLOG).

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| email | text | lowercased |
| role | enum | the role the person gets |
| token_hash | text unique | SHA-256 of the link's secret; the secret itself is never stored |
| invited_by | uuid FK | |
| created_at, expires_at | timestamptz | expires 14 days after creation |
| accepted_at, accepted_by | | set once, when used |
| revoked_at | timestamptz | cancelled by an owner, or replaced by a fresh link |

Rules (enforced in the database, tested in pgTAP):
- Only owners create (`create_invitation`), see and cancel invitations of their gym. One open invitation per email and gym; a fresh link cancels the old one. Existing members cannot be invited again. Email, role, gym and secret cannot be changed afterwards.
- Anyone holding the link can see what it is for (`invitation_preview`: gym, role, email, status).
- Only a signed-in user whose **confirmed** email matches can accept (`accept_invitation`), once, before it expires; they get exactly the invited role.
- Not in the audit log: the audit log is readable by every member, and the invitee's email is for owners only. Joining is audited (it creates a membership).
- The member list (`list_gym_members`) is visible to every member, read-only; emails only to owners ✅ (approved 2026-10-21).

### `tracks` — shown as **Programs**
**Naming ✅ (Daniel, 2026-10-23):** in the app, docs and specs these are **programs**; the table keeps its name `tracks` and the column `track_id` (no rename migration). Coaches name each program themselves ("Class", "Þrek", "Styrktartímar": gym data may be in any language; the app's own text stays English).

Gyms program several programs in parallel (e.g. *Class*, *Strength club*, *Endurance*). `id`, `org_id`, `name`, `color`, `position`, `archived_at`. Created and edited by owners and head coaches, not coaches — approved 2026-10-21. Archived, never deleted. **A new gym starts with one program, "Class"**, which can be renamed or archived like any other ✅ (approved 2026-10-21).

Rules (Afrek launch requirement, decisions of 2026-10-23; migration `002600`):
- **Every workout belongs to a program** ✅ (decision 2): `workouts.track_id` is NOT NULL, for scheduled workouts and templates alike. Workouts that had none were moved to the gym's first active program (by `position`, then name); a gym with workouts but no program got "Class".
- **No new workout on an archived program**: a workout cannot be created on, copied to or moved to an archived program (trigger on insert and on a change of `track_id`, so `save_workout`, `copy_workout` and a calendar move are all covered). Workouts already on a program when it is archived stay there and can still be edited.
- **Names are unique among a gym's active programs**, ignoring case and outer spaces (partial unique index on `(org_id, lower(btrim(name)))` where not archived). Archived programs may share a name; restoring one whose name an active program has is refused. Existing duplicates were numbered ("Class (2)").
- **A gym keeps at least one active program** (interpreted from decision 2: with none, nothing could be programmed). Archiving the last active one is refused.
- **Order:** `position` is the order everywhere (calendar columns, pickers). `reorder_programs(org, ids)` sets it in one statement: owners and head coaches only, and `ids` must be every program of the gym (archived ones too), each once.
- **Dates** (Daniel's list of 2026-10-23, item 4; migration `003400`): `starts_on`, `ends_on` (both optional, the end not before the start) for seasonal programs (Afrek's Þrek ran January to May). *Interpreted (for review):* a workout outside its program's dates is **allowed and kept**: the calendar marks those days "Not running", and the builder and a calendar move say so; nothing is blocked (history kept, plans can stretch a season).

### Days on the calendar ✅ (BACKLOG "Programs & calendar", decided 2026-10-23; migration `003400`)
- **`day_focuses`** — the gym's own list of day focuses (PP, Squat, DL, Oly / Core, Mix, Partner): `id`, `org_id`, `name` (≤ 40), `color`, `position`, `archived_at`. Like programs: kept by owners and head coaches, archived never deleted, names unique among active ones. Gym data: the names are the gym's, in any language.
- **`program_days`** — a program's focus for a day: `id`, `org_id`, `track_id`, `date`, `focus_id`; one per program and day; set and cleared by coaches (as they program), ahead of the workouts, so it is on the day, not on a workout. The program and focus must be the gym's (composite foreign keys); an archived focus stays on its days but is not given to another. *Interpreted (for review):* **the focus is per program**: Afrek's column A is the main class's, and STYRKUR writes its own focus in its own column. The import maps column A to a program.
- **`calendar_days`** — holidays and closed days: `id`, `org_id`, `date`, `name` (≤ 80), `closed` (default true), `holiday_of` (the country preset it came from, e.g. `IS`; NULL for the gym's own). One per gym and day; kept by owners and head coaches. A country's public holidays are added for a year in one click (Iceland: computed from Easter, in `src/lib/calendar/holidays.ts`; two on one day become one entry); each can then be kept open (it keeps its name on the calendar), renamed or removed. *Interpreted (for review):* **a holiday is added as closed**; a closed day warns, never blocks.
- All three: every member reads; audited; erased with the gym; in the gym's export.

### `member_preferences` — a person's own choices in a gym
`org_id`, `user_id`, `calendar_program_id` (NULL or one of the gym's programs), `calendar_all_programs` (bool; not both). PK `(org_id, user_id)`, FK to `memberships`, so leaving the gym removes them. Private: only that person reads and writes their row, not even the owner (migration `002700`).
- **The calendar's program** ✅ (decision 3, 2026-10-23): each program is its own space. The calendar shows one program: the one in the address (`?program=<id>` or `?program=all`), else the person's last choice, else the gym's first active program. "All programs", with each program's colour and name, only when chosen. Choosing in the calendar's program menu is remembered; a remembered program archived since falls back to the first active one.

---

## 4. Reference taxonomy (global, read-only)

| table | key examples | extra columns |
|---|---|---|
| `movement_patterns` | squat, lunge, hinge, h_push, v_push, h_pull, v_pull, carry, core, rotation, jump | region, label_en |
| `planes` | sagittal, frontal, transverse, multiplanar | labels |
| `modalities` | run, row, bike, ski, jump_rope, swim (cyclical cardio only; sled removed ✅ 2026-10-21) | default_unit |
| `muscles` | quads, hamstrings, glutes, … | region, labels |
| `effort_levels` | easy, moderate, hard, max | rpe_calc, rir_min, rir_max |
| `equipment` ✅ | 26 items incl. trap_bar, cable_machine — approved 2026-10-21 (`docs/core-library.md`) | labels |
| `taxonomy_versions` | 1, 2, … | published_at, notes |

Labels are English only (`label_en`) — decided 2026-10-21 ✅. A translation layer can be added later if ever needed.

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
| default_unit | enum | reps · distance_m · calories · time_s |
| implement_count | smallint | ✅ default number of implements when loaded (DB thruster 2, DB snatch 1); volume load = kg per implement × implement count × reps. Default 1. Approved 2026-10-21. |
| pace_default | jsonb | working pace of an intermediate adult class member at Pace Hard ✅ (calc spec §5.1, §9.5): one or more of `{ "sec_per_rep": 2, "sec_per_m": 0.25, "sec_per_cal": 4.5 }`, each positive (CHECK). Core values approved and seeded 2026-10-21 (`docs/pace-defaults.md`); timed holds have none. Gyms override in `exercise_pace_overrides`. |
| status | enum | `active` · `needs_review` · `archived` |
| created_by, created_at, updated_at, deleted_at | | |

### `exercise_patterns`
`exercise_id`, `pattern_key` FK, `weight numeric(3,2)`. **Weights per exercise must sum to 1.00** (deferred constraint trigger). **Monostructural exercises have no patterns** (enforced; they are tracked by modality) — approved 2026-10-21.

### `exercise_muscles`
`exercise_id`, `muscle_key` FK, `role` (`primary` · `secondary`).

### `exercise_equipment` ✅
`exercise_id`, `equipment_key` FK → `equipment`. Replaces a free-text equipment array — approved 2026-10-21.

### Gym exercises: `save_gym_exercise` (Step 4b)
Owners and head coaches add and edit the gym's own exercises with `save_gym_exercise(org, exercise)`: the exercise, its patterns, muscles and equipment in one transaction (the pattern weights are checked at commit and must add up to 1.00). Archiving (`status = archived`) keeps the exercise in old workouts but no longer offers it in the builder.

### `exercise_pace_overrides` ✅ (Step 4b)
A gym's own pace for an exercise (calc spec §9.5): `org_id`, `exercise_id` (core or the gym's own), `pace` (same shape as `exercises.pace_default`: one or more of `sec_per_rep`, `sec_per_m`, `sec_per_cal`), `updated_by`, `updated_at`. Primary key (org_id, exercise_id). An override replaces the default for that gym. Every member reads; **owners and head coaches** write (decision 9, 2026-10-21). Audited. Replaces the earlier `organizations.settings.paces` idea, because gym settings are owner-only.

### `exercise_aliases`
| column | notes |
|---|---|
| org_id NULL | core alias or gym-specific shorthand |
| alias_normalized | lower-case, trimmed, punctuation-stripped |
| exercise_id | target |
| unique | (org_id, alias_normalized) |

Aliases never create exercises. "KB swing", "kb swings", "Russian KBS" → one exercise.

### `ambiguous_exercise_terms` ✅ (approved 2026-10-21)
Generic words that could mean several core exercises ("squat", "clean", "snatch", "bike", …) are **not** core aliases. Each such term lists its candidate core exercises: `term` (same normalised form as aliases), `exercise_id` (core only), `position` (most likely first). Read-only reference data, like the taxonomy. A term can never also be a core alias (enforced both ways).

When a coach writes an ambiguous term, the parser (Step 4) asks once which exercise the gym means and saves the answer as a **gym-level alias** (`exercise_aliases` with the gym's `org_id`). Lookup order for a written term: gym alias → core alias → ambiguous term (ask the coach) → unmatched (shown for review before publish). The full list is in `docs/core-library.md`.

---

## 6. Programming

### `workouts`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| track_id | uuid FK | the workout's program; required ✅ (2026-10-23), never an archived program for a new or moved workout (§3) |
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
| partner_mode | enum NULL | partner block, and how partners share the work ✅ (calc spec §4.5, 2026-10-23): `split` (split the reps at will) · `alternate` (I go, you go) · `each` (I go, you go, amounts for each athlete); NULL = not a partner block. Migration `003200`; the older `partner` yes/no is now worked out from it (read-only) until no app of the previous version is left |
| target_rounds | numeric NULL | coach's AMRAP estimate, overrides pace estimate |
| rest_after_s | int NULL | ✅ rest after this block, before the next (s, ≥ 0). Counts in session length on the calendar, never in planned load — approved 2026-10-21 |
| counts_in_load | bool | default true; false for stretching: the block's time is in the session length, nothing in planned load or the lenses (calc spec §5, migration `003300`) |
| notes | text | |

`params` shape per format (validated by a CHECK + shared Zod schema in the app):
- `sets`: `{ sets, rest_s }`
- `every`: `{ interval_s, rounds, alternating? }` — `alternating: true` ✅ = ordered slots, one per interval, each with one or more lines (`block_items.slot`); taking turns for `rounds` intervals, the last rotation possibly partial (calc spec §4.3), approved 2026-10-21
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
| slot | smallint NULL | ✅ alternating `every` blocks only: the interval of the rotation this line belongs to (1, 2, …); several lines can share a slot. Required on every line of an alternating block, NULL elsewhere (checked at commit). Slots are numbered 1…k without gaps (checked by `save_workout`) |
| exercise_id | uuid FK NULL | NULL = unresolved, shown for review before publish |
| raw_line | text | "8/8 x Single Arm DB Row" |
| quantity | jsonb | see below |
| load | jsonb NULL | see below |
| pace_effort | FK NULL | overrides block |
| load_effort | FK NULL | overrides block |
| implement_count | smallint NULL | ✅ overrides the exercise's default implement count for this line (e.g. a single-DB thruster) |
| notes | text | "I go you go", "L/R" |
| alternatives | text[] | ✅ other exercises the coach allows, as written ("Sprawls", "KB"), up to 10; the line counts its own exercise (calc spec §5, migration `003300`) |
| side | text NULL | `left` · `right`: one side only ("Right arm"); counts half in exposure and hard sets (calc spec §5) |
| cap | jsonb NULL | a cap on the line, `{ "type": "time_s" \| "reps" \| "distance_m" \| "calories", "value": 40 }` ("max 40 sec") (calc spec §5) |

`quantity` (exactly one type, per calc spec §4.1):
```json
{ "type": "reps", "value": 5 }
{ "type": "reps_range", "min": 8, "max": 10 }
{ "type": "reps_scheme", "scheme": [21, 15, 9] }
{ "type": "reps_per_side", "value": 8 }
{ "type": "reps_per_side_range", "min": 4, "max": 8 }
{ "type": "distance_m", "value": 800 }
{ "type": "distance_m_range", "min": 800, "max": 1000 }
{ "type": "calories", "min": 8, "max": 12 }
{ "type": "time_s", "value": 30 }
{ "type": "time_s_range", "min": 20, "max": 30 }
{ "type": "max_effort", "unit": "distance_m" }
```
The three `_range` types are from migration `003300` (calc spec version 3). Block params gained, in the same migration: `sets.time_s` (sets within a time box; then `sets` is optional) and `intervals.by_station` / `intervals.rest_between_stations_s`.

`load`:
```json
{ "type": "percent_1rm", "min": 75, "max": 80 }
{ "type": "absolute_kg", "rx": [22.5, 15] }
{ "type": "bodyweight" }
```

`rx` stores every Rx variant; calculations use the first-listed — approved 2026-10-21 ✅ (calc spec §9.6). Load is per implement; the implement count multiplies it for volume load.

A workout can only move to `published` when every item has an `exercise_id`.

### Templates (Step 4b; several dates in 5b)
A template is a workout with `kind = template` and no date. "Save as template" and "Use on dates" both make a **copy** with new ids, so a template and the workouts made from it change independently, each with its own audit history. `copy_workout(org, source, targets)` (5b, migration `002100`) copies a workout to up to 60 dates in one transaction (run as the user, so RLS applies); each copy is a scheduled draft and its metrics are stored right after.

### Saving a pasted workout: `save_pasted_workout` (Step 4c)
`save_pasted_workout(org, workout, aliases)` does `save_workout` and, in the same transaction, stores `workouts.raw_text` (the text as pasted, required) and `parser_version`, and inserts the coach's answers as gym aliases (`[{ term, exercise_id }]`; a word the gym already has a name for is left as it is). Runs as the signed-in user, so RLS decides each part; if any part is refused, nothing is saved. Each line's `raw_line` is the line as pasted until the coach edits that line in the builder; the builder's later saves never touch `raw_text`. The server reads the text again with the gym's library and the answers, so what is stored never depends on what the browser sends.

### Saving a workout: `save_workout` ✅ (Step 4b)
The builder saves through one database function, `save_workout(org, workout)`, in a single transaction: the workout, its blocks and their lines, in order. It runs as the signed-in user, so RLS applies. Rows that did not change are not touched; removed blocks and lines are deleted; a line moved to another block is removed and re-added. So the audit log shows only real edits. It returns the workout's id. Right after, the app recomputes the workout with the engine on the server and stores the result in `workout_metrics` (with `calc_version` and `taxonomy_version`).

### Program import ✅ (BACKLOG "Program import", Daniel's list of 2026-10-23, item 5; migration `003500`)
A whole programming document (weeks, a month, a year) into **one program**, in its own workspace (Import); nothing reaches the calendar until the coach imports.
- **`import_batches`** — `id`, `org_id`, `track_id` (the program), `status` (`draft` → `committed` → `undone`), `source_name`, `source_kind` (xlsx · csv · docx · pdf · text), `document` (jsonb, ≤ 5 MB: the document's **text only**, as cells or lines; never the file; personal data removed unless the coach keeps it), `layout` (how the document is laid out, as confirmed), `program_index` (which of the document's programs), `answers` (words → exercises, day labels → focus / closed day, heading rules, fixed days, days left out), `choices` (conflicts: skip / replace / add; publish the ready ones; templates; names to keep; personal data kept), `summary` (after the commit: counts, the workouts made, the workouts replaced), `created_by`, timestamps. Coaches see, start, work on and commit their gym's imports (RLS `orgs_where_can_program`); a draft can be thrown away, a done import cannot. Audited on commit and undo (a draft's frequent saves are not).
- **`import_batch_id`** on `workouts`, `program_days` and `calendar_days`: what an import made.
- **`commit_import(org, batch, workouts, replace, focuses, days, closed, aliases, summary)`** — one transaction: soft-deletes the program's workouts it replaces (only scheduled ones of its own program), makes each workout with `save_workout` (the builder's rules) plus its raw text, parser version and published/draft status, adds day focuses and closed days (owners and head coaches: RLS), sets the days' focus (a day that has one keeps it), saves the gym's names for words. Refuses a workout in another program, over an existing workout, or twice.
- **`undo_import(org, batch)`** — one transaction: soft-deletes the import's workouts, brings back exactly the workouts it replaced, clears its day focuses and closed days (a coach's undo leaves closed days, which only owners and head coaches remove). Names learnt for words stay.
- Both run as the signed-in member (security invoker): row level security decides as everywhere else.
- *Interpreted (for review):* a coach's import does not add day focuses or closed days (they are the gym's lists, kept by owners and head coaches); they are left out and the coach is told. Days that would not save as written (as in the builder) are not imported until fixed or left out.

### `block_results` ✅ (approved 2026-10-21; built in Step 4)
What the **group** actually did in a block, logged by a coach after class. Not per athlete. Several rows per block are allowed (the same workout runs in several classes).

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | RLS; must match the block's gym (composite FK, like block_items) |
| block_id | uuid FK | |
| session_label | text NULL | which class, e.g. "06:00" |
| rounds_low, rounds_high | numeric NULL | AMRAP blocks: rounds the group reached, low–high (decimals for partial rounds) |
| finish_low_s, finish_high_s | int NULL | For Time blocks: finish times, low–high; anyone capped counts as the cap |
| note | text NULL | free note |
| logged_by, created_at, updated_at, deleted_at | | soft delete |

Rules: rounds only on AMRAP blocks, finish times only on For Time blocks; low ≤ high. RLS: everyone in the gym reads; owner, head coach and coach write. Audited. Results never overwrite a pace by themselves (see BACKLOG: per-gym pace calibration).

As built in 4d (migration `001900`, approved rules above plus these guards):
- A result needs its block's measure (an AMRAP result has rounds, a For Time result has finish times), never both; only blocks of **scheduled** workouts take results (not templates).
- Rounds ≥ 0, below 1000, at most two decimals; finish times whole seconds, 1 s to 24 h, and **never over the block's time cap** (anyone capped counts as the cap). One rule function, `private.block_result_problem`, mirrored in `src/lib/workout/results.ts` and tested on one list of cases.
- `logged_by` is always the signed-in user; a result stays with its block and its gym. No hard delete for users: `deleted_at` (soft delete, undo in the app).
- **A block keeps its results:** while live results point at it, the block cannot be removed or change format (the builder's save says so). Hard deletes that cascade from a workout or a gym still go through.

---

## 7. Computed data, audit, safety

### `workout_metrics` (cache)
`workout_id`, `calc_version`, `taxonomy_version`, `computed_at`, `metrics jsonb`, `confidence jsonb`. PK `(workout_id, calc_version)`. Recomputed on save; rebuilt in bulk on version bump. Weekly/period analytics are SQL functions over this table: `period_metrics(org, from, to, calc_version, programs[])` (5c, migration `002200`; programs required since `002800`) returns the period's scheduled workouts in the programs asked for, with their stored metrics (run as the user, so RLS applies). There is no "all programs" default: analytics shows one program by default and several only when the coach chooses them, always named (decision 4, 2026-10-23); the app sums the lenses with the engine's own TypeScript, so the builder, the calendar and analytics never disagree.

### Gym guidelines (5c)
`organizations.settings.guidelines` (owner-managed, like all gym settings): optional minimum hard sets per pattern per week, ranges for push:pull, knee:hip and upper:lower exposure, a maximum weekly monotony and a maximum week-on-week increase (%). Checked by `private.guidelines_problem` on every settings change (trigger) and mirrored in `src/lib/analytics/guidelines.ts`, tested on the shared rule cases. Set through `set_gym_guidelines(org, guidelines)`. They are the gym's guidelines, not scientific thresholds (calc spec §6); a new gym starts with the default set (calc spec decision 18, migration `002500`).

### Program guidelines ✅ (decision 5, 2026-10-23)
The gym's guidelines are every program's default. A program can have its own set in `tracks.guidelines` (jsonb, the same shape; NULL uses the gym's; `{}` is an own set with no guideline). Set by owners and head coaches, who manage programs (RLS on `tracks`); checked by the same `private.guidelines_problem` (trigger; migration `002900`). *Interpreted (for review):* a program's own set replaces the gym's as a whole (no mixing of single values); "Use the gym's guidelines" goes back to the gym's set. Analytics checks each program against its own guidelines, also when several programs are shown together (calc spec decision 19).

### `audit_log`
`id`, `org_id`, `actor_id`, `table_name`, `row_id`, `action` (insert/update/delete), `diff jsonb`, `at`. Written by triggers on workouts, blocks, block_items, exercises, memberships, and (from Step 4) exercise_aliases and block_results. Append-only.

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

1. ✅ **Customer = gym (organization)** with coaches as members; a solo coach is a gym with one member — approved 2026-10-21.
2. ✅ **Four roles** (owner, head coach, coach, viewer) — approved 2026-10-21.
3. ✅ **Programs** (`tracks`: parallel programs in the same gym) — included from day one, approved 2026-10-21; called programs since 2026-10-23.
4. ✅ **Templates** stored as workouts with `kind = template` (same structure, no date) — approved 2026-10-21.
5. ✅ **Publish rule:** a workout cannot be published while any line is unmatched to an exercise — approved 2026-10-21.
