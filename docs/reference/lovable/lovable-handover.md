# WOD Builder — Complete Project Handover

**Prepared:** October 20, 2026
**Purpose:** Full transfer document for the Workout Builder platform — concept, features, technical details, and sales pitch.

---

## 1. The Idea

A **workout programming platform for coaches running functional fitness gyms** (CrossFit-style / functional training boxes). Coaches program daily workouts (WODs), and the system automatically tracks training load, movement patterns, muscle groups, and balance — turning programming from guesswork into data-driven coaching.

**The core problem it solves:** Coaches write workouts on whiteboards, spreadsheets, or generic tools. Nobody tracks *cumulative load* — how much squatting vs. hinging, pushing vs. pulling, upper vs. lower body a program actually delivers over weeks and months. This leads to imbalances, overuse injuries, and stale programming. WOD Builder makes every rep count.

---

## 2. Core Features

### 2.1 Workout Builder (main page)
- Program workouts with **multiple sections per day** (A, B, C, D…), each with its own name/type: Strength, Conditioning, Metcon, Gymnastics, Endurance, Recovery, Explosive, etc.
- **Section formats:** Rounds, AMRAP, EMOM, Every (e.g. "Every 2 min for X rounds"), Alternating EMOM, For Time, Tabata — with work/rest intervals, rest between rounds, time caps, and partner/team formats.
- **Exercise entries** support:
  - Fixed reps, rep schemes (e.g. 21-15-9), rep ranges (e.g. 4-6)
  - "For Distance" and "Max Reps" prescriptions
  - Load type per exercise: BW / Low / Med / High
  - Per-exercise notes (e.g. "I Go You Go", "Left/Right")
- **Workout type/focus field:** Strength, Conditioning, Metcon, Gymnastics, Endurance, Recovery.
- **Live Load Analysis sidebar** while programming:
  - Total load index, dynamically recalculated as you build
  - Volume by movement pattern (hinge, squat, push, pull, etc.)
  - Primary muscle groups and movement planes
  - Total reps per exercise
  - Coach can choose which graphs to view
- **Draft persistence:** work-in-progress is auto-saved locally — navigating away and back never loses your programming.

### 2.2 Exercise Bank
- Searchable, editable exercise catalog (imported from a full library + curated from real programming sheets).
- Each exercise carries: **movement pattern, movement plane, regions, muscle groups, equipment, default load type, aliases**.
- Standardized equipment abbreviations: **KB, DB, Dbl. KB, BB, BW** (etc.).
- Full CRUD: add, edit, delete exercises; duplicate detection.
- **Import/Export:** CSV/JSON import from local drive with merge and diff summary.

### 2.3 Calendar
- **Day / Week / Month views** with navigation — program a week at a time and see progression.
- Full workout details visible directly in the calendar cells (title, focus, sections, exercises, sets/reps) — no clicking required.
- **Color coding by workout type** (Strength, Conditioning, Metcon, Olympic, Squat, Pull, etc.) across calendar and builder.
- **Drag & drop** workouts between dates for easy rescheduling.
- Click any day to view/edit/create workouts.

### 2.4 Workout Templates
- Save any workout as a **reusable template** (e.g. a bank of metcons).
- Load templates into the builder, edit freely, save as new workouts.
- **Apply a template to multiple calendar dates at once** (duplicate across days).

### 2.5 Analytics Dashboard ("Workout Analyzer")
- **Date range selector** (7 days, 14 days, month, custom) with refresh.
- **KPI cards:** Total Load Index, Training Days, Average Load/Day, Push:Pull ratio (with imbalance warning above 1.75×).
- **Charts:**
  - Bar chart — volume by movement pattern (knee dominant, hip hinge, horizontal/vertical push & pull, rotation, core, plyometric, locomotion)
  - Donut chart — movement plane balance (Sagittal, Frontal, Transverse, Mixed)
  - Region totals — upper / lower / core / systemic
  - Daily load trend line
- **Top 10 exercises by reps** for the selected period.
- **Automatic warnings & suggestions:**
  - "High lower-body load this week (3,200 > 2,500 threshold)"
  - "Push >> Pull (2.0×). Add more pulling work."
  - "Predominantly sagittal plane — consider frontal or rotational work."
  - "This exercise has been used too often this month."
- Configurable thresholds: lower = 2500, upper = 2200, core = 1500, systemic = 3000.

### 2.6 Design & UX
- **Dark and light mode** with a toggle, persisted per user.
- Gray-toned, clean card layout with soft shadows (moved away from heavy blue).
- Color-coded workout types throughout.

---

## 3. Calculation Logic

- **Load Index = reps × load factor** — BW = 1.0, Low = 1.6, Med = 2.5, High = 4.0
- Rep ranges (4-6) calculated on their average; rep schemes (21-15-9) summed.
- Every rep of every exercise is stored and aggregated by pattern, plane, region, and muscle group.
- All sections (A, B, C…) of a workout count toward totals.

---

## 4. Technical Details (for transfer to another account)

- **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS v3, shadcn/ui, next-themes (dark/light), @dnd-kit (drag & drop), Recharts (charts), TanStack Query.
- **Backend:** Lovable Cloud (managed Supabase) — auth, database, Row Level Security.
- **Database tables:** `exercises`, `workouts`, `workout_sections`, `workout_entries`, `workout_templates` (+ `profiles`), all with user-scoped RLS policies.
- **Auth:** Email/password sign-in (Google / Sign in with Lovable can be added).
- **Key structure:**
  - `workouts` → date, title, focus/type, user
  - `workout_sections` → label (A/B/C), type, format (rounds/AMRAP/EMOM/every/tabata…), rounds, intervals, time caps, partner flag, notes
  - `workout_entries` → exercise ref, reps/rep_scheme, sets, load_type, distance/max-reps flags, notes
  - `exercises` → name, pattern, plane, regions, muscles, equipment, default load, aliases
- **Exercise library** seeded from CSV (`public/data/exercises.csv`).
- Builder drafts persist in localStorage; cleared on save.

---

## 5. Roadmap / Discussed Future Features

- **AI-assisted historical import:** upload existing programming spreadsheets (Excel/CSV — weeks, months, a year of workouts); the system parses them, shows a preview of how it interpreted each day/section, flags exercises missing from the bank, and lets the coach create/map/skip them before importing — instantly backfilling analytics.
- Export analytics to CSV / PDF report.
- Filters by pattern/plane/region; "show warnings only" toggle.
- Expandable per-day detail tables in analytics.

---

## 6. Sales Pitch

### WOD Builder — Program smarter. Coach better.

**Every rep counts. Now every rep is counted.**

Coaches at functional fitness gyms write hundreds of workouts a year — on whiteboards, in spreadsheets, in their heads. But no coach can hold twelve weeks of squat volume, pull-to-push ratios, and movement-plane balance in memory. The result: imbalanced programming, overuse injuries, plateaus, and members who drift away.

**WOD Builder changes that.** It's the first programming tool built specifically for functional fitness coaches that tracks *training load as you write the workout*:

- **Build fast.** Sections A/B/C, AMRAPs, EMOMs, Tabata, partner workouts, rep schemes like 21-15-9 — the builder speaks your language, not a generic fitness app's.
- **See the load live.** As you program, watch total load, movement patterns, muscle groups, and plane balance update in real time. Catch the imbalance *before* your members feel it.
- **Prove your programming.** The analytics dashboard turns a week, a month, or a year of workouts into clear charts: push:pull ratios, region totals, overload warnings, and automatic suggestions. Show members — and yourself — that the program is balanced by design.
- **Never start from scratch.** A full exercise bank, reusable templates, a metcon library, drag-and-drop scheduling, and one-click duplication across days.
- **Bring your history.** Import your existing spreadsheets and instantly see what your programming has really been delivering.

**Who it's for:** owners and head coaches of CrossFit boxes and functional fitness gyms who program for classes — and want retention, results, and proof of quality.

**Why it wins:** generic workout apps track athletes. WOD Builder arms the *coach* — the person whose programming quality is the gym's product. Balanced programming means fewer injuries, better results, and members who stay.

**The pitch in one line:** *It's the difference between writing workouts and engineering them.*

---

## 7. Demo Access

- Sign-in: (demo credentials removed)
- Main areas: Builder (program workouts), Calendar (day/week/month), Analytics (load dashboard), Exercises (the bank).
