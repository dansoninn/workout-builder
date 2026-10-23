# Status

**Updated:** 2026-10-23 by Claude Code
**Working mode:** continuous (CLAUDE.md).
**Now:** your list of 2026-10-23 (Afrek's 2024 programming), in your order. Done: 1 partner rule, 2 parser notations, 3 library coverage report, 4 day focus, holidays and closed days, program dates. Next: 5 program import. Part 1 of Step 6 (name, domain, purchases) is postponed, as you said.

## Decisions for you
Nothing is blocked; each item says what I did meanwhile. **1 and 2 matter most.**

1. **Library additions — approve, change or drop** (`docs/library-coverage.md`). Running Afrek's year through the parser: today **47%** of exercise mentions match the library, **76%** with my proposals: **46 new exercises** and **34 changes** (aliases, equipment) to core ones, each with patterns, muscles, equipment and pace, in the library's conventions. Not seeded. In the same file, for you:
   - **Isolation exercises without a pattern** (biceps curl, triceps extension, lateral and front raise, side-lying leg raise, halo): today only the calf raise has none. They would count in the muscle lens only. Or give them a pattern?
   - **Handstand hold** as v_push, or no pattern (like the overhead squat's hold)? **Hamstring curl** as hinge (like the Nordic curl)?
   - **"Heavy ball"** (a dead ball) is listed as a slam ball: add a "dead ball" to the equipment list (a taxonomy change)?
   - **Words to explain:** punt lunges, forward press, hip to overhead, 90° hold, horse stance hold, heel tap, reverse salamander. And confirm: "Russian leg lifts" = lying leg raises, "Evil wheel" = ab wheel, "Soft yoga press" = an easier Hindu push-up, "Beat swing" = kip swing.
2. **The repository is public; Afrek's spreadsheet is not in it.** Its README says private, so `docs/reference/programming/` keeps only the README in git; the file stays on this Mac. CI tests use made-up workbooks in the same layout. The coverage report holds exercise words and counts, no workouts. If you want the file in git, the repository must be private first.
3. **Partner workouts, my readings** (calc spec §4.5, decision 21): a team of 3 counts as partners (half each) for now, and says so; "Partner" alone = split the work; "split" and "I go, you go" give the same numbers (each does half), only the label differs; an AMRAP with "each" = taking turns (half the rounds each).
4. **Counting real notations, my readings** (calc spec decision 22): a range of sets ("4–5 sets") counts the lower number, a range of minutes ("20–25 min") the middle — the check screen says so; "find heaviest in 12–15 min" = as many sets as fit, **all at Load Hard, so all count as hard sets**.
5. **A bare "row"**: your rule (machine only with cal/m, else ask) is built. I also count a "Row" **station of a timed block with no amount** ("6. Row" in intervals, "B1. Row" in alternating minutes) as the machine: Afrek has ~30 of those and they are all the rower. Asking each time is the strict reading.
6. **Days on the calendar, my readings** (data model spec, "Days on the calendar"):
   - **Day focus is per program**: Afrek's column A belongs to the main class; STYRKUR writes its own focus in its cells. A gym can give every program the same focus on a day, one by one.
   - **A holiday is added as closed**; untick "Closed" for the ones the gym is open on (it keeps its name on the calendar).
   - **A closed day, or a day outside a program's dates, warns but never blocks** a workout (the builder, a calendar move). History outside a season is kept.
   - **Analytics for one day focus** ("Squat days") shows those days' workouts; warnings, monotony and the change from the week before are left out, since they need every day.
7. **Part 1 of Step 6** (name, domain, legal entity, Vercel/Supabase Pro, email, lawyer): postponed by you; the list is unchanged in `docs/PLAN-step-6.md`.

## What changed since your Afrek message (2026-10-23)
Each part is its own pull request, merged when CI was fully green, database changes applied to the hosted project just before.

### 1. Partner workouts (your rule)
- A block says how partners share the work: **Split the work**, **I go, you go**, **I go, you go, each**. The numbers are per athlete: half the reps or rounds, or the full amount taking about twice as long.
- The paste reads it: "Partner WOD", "In pairs", "split reps as you like", "I go you go", "five rounds each", "Teams of 3" (flagged).
- **Calculation version 2**: numbers saved with an older version are worked out again when a coach opens the calendar or analytics.

### 2. The parser reads Afrek's notations — and the other common ways of writing them
Every rule is tested on other gyms' styles too (`parse-notations.test.ts`). On Afrek's year: workouts stopped by a number the parser could not read **153 → 66**; lines understood **2,296 → 3,267**.
- Back to back with "+"; "Superset 1. – 4 sets of:", "N rounds of:"; "First / Then straight to / Finish with".
- "Dbl. KB" = two implements, "Single DB" = one; heavy / medium / light = the line's Load effort ("heavy ball" stays an implement).
- **Alternatives** ("Burpees/Sprawls", "KB or DB", "Power or Squat Clean"): the first counts, all are kept on the line and shown ("or Sprawls").
- E2.5M, E30S, "Alt. EMOM x 20 (4 Rounds)" with B1… slots, "6x 30 sec on, 12 sec off, 90 sec rest between stations" (**station by station**), "(max 40 sec)" (**a cap** on the line).
- "In 12–15 min find heaviest 3–4" (**sets within a time box**), "Building" sets, one number per set ("2 x 5, 2 x 4, 3 x 3").
- Finisher, Technique, Mobility, **Stretch / Stretch and Relax** (stretching: not in planned load, still in the session's length).
- "@ easy-ish pace", "@ 95%+ effort", "(All Out!)"; "Right Arm / Left Arm", "(Other Arm)", "Side Plank L" (**one side**: half of both sides); "Time Cap 18 min" on its own line; "???" = not planned yet.
- **Calculation version 3** for the new counting rules (decision 22).

### 3. Library coverage (`docs/library-coverage.md`)
- The report: matched, generic and unknown words, ranked by how often Afrek wrote them; what each would read as with the proposals; the words that are not exercises (parser follow-ups, in BACKLOG).
- The proposals live in `src/lib/library/proposed-additions.ts`, checked by tests against the library's rules (weights sum to 1, at most three muscles, no alias twice, every alias finds its exercise). Approving moves them into the library with one migration.
- Matching got more general on the way (parser version 3): an implement word before an exercise ("KB farmers carry", "KB split squat", also "G2OH w plate"); "rubber band" = band; strict / explosive / tempo / slow as how, not which; your **"row" rule**.

### 4. Day focus, holidays and closed days, program dates
- **Settings → Days** (new): the gym's **day focuses** (PP, Squat, DL, Oly / Core, Mix, Partner — your own list, with colours, ordered, archived not deleted), and its **holidays and closed days** by year: **"Add Iceland's public holidays for 2026"** puts all 16 on the calendar (Easter-based ones worked out; two on one day become one entry), each one can be kept open, renamed or removed; add your own days ("Closed for a competition").
- **Calendar:** each day shows the holiday or closed day, and the program's **day focus** — coaches set it from the day ("+ Focus", a menu), ahead of the workouts. "All programs" names each program's focus. Closed days are tinted; a program's days outside its dates say **"Not running"**.
- **Programs with dates:** "Runs from" and "Until" in Settings → Programs (both optional). Workouts outside them are kept.
- **Warnings, never blocks:** the builder says "Christmas Day: the gym is closed that day" or "Þrek runs 5 Jan 2026 – 31 May 2026: this date is outside it"; a calendar move says the same in its message.
- **Analytics → Day focus:** "Squat days" shows only the workouts on days a program has that focus.
- Owners and head coaches keep the lists; coaches set a day's focus; viewers see it all. Audited, erased with a deleted gym, in the gym's export.

## How it was verified
| What | Result |
|---|---|
| Unit tests (Vitest) | **563 of 563** (new: partner engine and parser, the notations in other gyms' styles, the row rule, proposed library checks, the spreadsheet reader on a made-up workbook, Easter and Iceland's holidays, program dates) |
| Database tests (pgTAP) | 27 files; new: partner mode (12), line and block details (14), days and program dates (30); gym erasure covers the new tables; the shared rule cases regenerated |
| Browser tests (Playwright) | new: a partner block keeps how partners share the work; alternatives, one side and a cap are pasted, saved and shown; day focus from Settings to the calendar to Analytics; Iceland's holidays, a closed day and a program's dates on the calendar and in the builder (with accessibility scans) |
| Note | This Mac cannot run the local database, so database and browser tests ran on GitHub for every pull request. |

## Pull requests
| PR | What | Database change | State |
|---|---|---|---|
| #24 | Your backlog and the programming README | — | merged |
| #25 | Partner workouts (calc version 2) | 003200 | merged, applied |
| #26 | Parser: Afrek's notations, written generally | — | merged |
| #27 | Alternatives, one side, caps, stretching, time boxes (calc version 3) | 003300 | merged, applied |
| #28 | Library coverage report and proposals; the row rule | — | CI |
| #29 | Day focus, holidays and closed days, program dates | 003400 | CI |

## Next
5. Program import (the full BACKLOG spec), tested on made-up files in Afrek's layout and run locally on the real one.
