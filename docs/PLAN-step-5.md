# Plan — Step 5: calendar, templates, analytics

> **Naming (2026-10-23):** what this plan calls "tracks" are called **programs** in the app since Daniel's decision of 2026-10-23 (the database table is still `tracks`).

**Written:** 2026-10-22 by Claude Code, from Daniel's order of 2026-10-21 ("month calendar with drag & drop, template applied to several dates, Analytics over 7/14/30 days and custom range using the four lenses, warnings") and BACKLOG.
**Working mode:** continuous — each sub-step on its own branch and pull request, merged when CI is green. Coaching questions go to STATUS ("Questions for Daniel"); work that does not depend on them continues.

## 5a — Month calendar, moving workouts
- **Month view** (the default) next to the existing week view: Monday-first grid, each day's workouts with track colour, status, session length and planned load, and logged results ("2 results"); "Add" on any day. On a phone the month is a list of days.
- **Move a workout** by dragging it to another day (and, in the week view, another track). Keyboard and touch: a "Move to…" action on each workout (date and track). One update, audited; the card moves at once and comes back with a message if the server refuses.
- Week view keeps its tracks as columns and the week's planned load per track.

## 5b — A template on several dates
- **Apply template** on the calendar (and "Use on dates" in the builder for a template): pick the template, the track and any number of dates in a small month picker. Each date gets its own copy (new ids, its own history), made in one database transaction; metrics stored for each.

## 5c — Analytics
- **Period**: 7, 14 or 30 days ending today, or any range; all tracks or one.
- **The four lenses** over the period, from the stored metrics (`workout_metrics`, current calc version; estimates stay ranges):
  - Lens 4, session load: planned load per day (chart), per week total, monotony and strain, week-on-week change (a trend, never an injury prediction).
  - Lens 1, strength: hard sets by pattern and by muscle, volume load.
  - Lens 2, exposure: reps by pattern and plane; push:pull, knee:hip, upper:lower.
  - Lens 3, conditioning: distance, calories and time by modality.
- **Warnings** against the gym's own guidelines (owner sets them in Settings; stored in `organizations.settings`), presented as guidelines, not science (calc spec §6). Each warning names the workouts behind it, with links. **Default values are Daniel's call** (STATUS, Questions for Daniel): until he decides, a gym sets its own and nothing warns before it does.
- Data: one SQL function returns the period's stored metrics (RLS applies); the engine's own TypeScript sums them, so the builder's panel, the calendar and analytics can never disagree.

## Tested by
Vitest (period sums, weeks, ratios, warnings), pgTAP (moving and copying workouts: roles, gym isolation, audit; the analytics function's isolation; guideline settings owner-only), Playwright (drag and drop and the keyboard move, template on three dates, analytics numbers for the three §7 workouts placed on one week, warnings with links, accessibility in light and dark).
