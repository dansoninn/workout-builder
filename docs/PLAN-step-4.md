# Step 4 plan — from engine to a working app

**Status:** approved by Daniel on 2026-10-21, with the design-direction correction and answers below. 4a approved and merged (PR #1). 4b built, ready for review (branch step-4b).
**Rule:** four sub-steps, each approval-gated, each on its own branch with a pull request and a Vercel preview link. Each ends with a STATUS update and stops.

| Sub-step | What you will be able to do when it is done |
|---|---|
| **4a** Accounts, gyms, app shell, live on the internet | Sign up, create your gym, invite coaches, give people roles, and open the app at a real web address. |
| **4b** Structured workout builder | Build a workout block by block, see the training load update live while you type, save it, publish it. |
| **4c** Paste a workout as text | Paste a workout from your notes; the app turns it into blocks and lines, asks once about unclear words, and you confirm. |
| **4d** Log what the group did | After class, log rounds or finish times for the group per block, on a phone. |

---

## Design direction (first principles)

The earlier prototypes are **not** a model for anything here (see CLAUDE.md). The Lovable screenshots in `docs/reference/lovable/` are only a checklist of features (below). The design is decided from how coaches actually program:

1. **Keyboard-first.** A coach can program a full week without touching the mouse. **⌘K** (Ctrl K on Windows) opens a command palette for every navigation and action; single-key shortcuts for the common ones (`g` then `b` = Builder, `?` = all shortcuts). Every screen is fully usable by keyboard.
2. **Instant feel.** Optimistic updates, no spinners in the builder, the calculation engine runs on your own device. Saving happens in the background; you never wait to keep typing.
3. **Dense but calm.** A professional tool in the class of Linear, Notion and Figma, not a consumer fitness app: small, readable type; lots of information per screen; quiet colours; colour only where it means something.
4. **Honest numbers.** Every estimate shows "~" and its range ("~20 min (17–24)"); exact numbers are plain. Every warning links to the line that causes it.
5. **Our own design system from day one.** Typography scale, spacing, colour tokens for light and dark, and semantic colours for movement patterns, intents and effort. Not the default shadcn look. Documented in `docs/DESIGN.md` and shown on a `/design` page (local and preview only) **before** any screens are built.

### Feature checklist from the Lovable prototype (what must be covered, not how)

| Feature | Where it lands |
|---|---|
| Sections A/B/C with type and format (rounds, AMRAP, EMOM, every, alternating EMOM, for time, tabata), partner, notes | 4b (alternating EMOM: see 4b question) |
| Reps, schemes (21-15-9), ranges, distance, max reps, per-line notes | 4b |
| Live load panel while programming, coach chooses what to see | 4b (four lenses instead of one index) |
| Draft never lost when navigating away | 4b (explicit Save + browser backup) |
| Exercise bank: search, edit, aliases, equipment; duplicate detection | 4b (core library + gym bank) |
| Exercise import/export (CSV/JSON) | BACKLOG |
| Calendar day / week / month, workout details in cells, colour by type, drag and drop | 4b simple week list; full calendar Step 5 |
| Templates; apply a template to several dates at once | 4b templates; multi-date apply Step 5 |
| Analytics: date range, KPIs, pattern / plane / region charts, daily trend, top exercises, warnings with thresholds | Step 5 (on the four lenses; thresholds are coach guidelines) |
| Dark and light mode, remembered | 4a |
| Historical import, CSV/PDF export, analytics filters | BACKLOG (already listed) |

---

## 4a — Accounts, gyms, app shell, deployment

### Screens
1. **Sign up / Sign in** — email and password (Google sign-in later, BACKLOG); "forgot password"; email confirmation when it is switched on.
2. **Create your gym** — first screen when you belong to no gym: name and country. You become its owner.
3. **Join a gym** — opening an invitation link: "You've been invited to Afrek as Coach — Join".
4. **App shell**
   - Left sidebar: **Builder, Calendar, Analytics, Exercises, Settings**, each with its shortcut. Builder, Calendar, Analytics and Exercises show what is coming and when, until they are built.
   - Gym switcher at the top (a coach can belong to several gyms; the gym is part of the address, e.g. `/afrek/builder`).
   - User menu: profile, theme (light / dark / system), keyboard shortcuts, sign out.
   - **⌘K command palette**: go to any page, switch gym, switch theme, invite someone, sign out.
   - Tablets: collapsible sidebar. Phones: the sidebar opens from a menu button.
5. **Settings**
   - **Gym** (owner): name, country.
   - **Members** (owner): everyone with role, change role, remove, **invite** (email + role), pending invitations (copy a fresh link, cancel).
   - **Tracks** (owner, head coach): create, rename, colour, archive.
   - **Profile** (everyone): display name.

### Invitations — by link for now
Supabase's built-in email only delivers to people in your Supabase team, so it cannot invite real coaches. In 4a an invitation is created for a specific email address and role, and the owner gets a **link to share** (message, email, WhatsApp). Only someone signed in with that email can use it; it expires after 14 days and works once. Automatic invitation emails come with the custom email sender, before the first real gym (BACKLOG). This also means no secret service key is needed on Vercel yet.

### Flows
- **New gym:** sign up → (confirm email) → "Create your gym" → app opens on Builder.
- **Invite a coach:** Settings → Members → Invite → email + role → copy link → send it → the coach opens it → signs up or signs in with that email → "Join" → lands in the gym with their role.
- **Viewer:** sees everything in the gym; edit controls are hidden.

### Under the hood
- New table **`invitations`** (gym, email, role, invited by, expiry, accepted / cancelled). Only a hash of the link's secret is stored. Owner-only, enforced in the database.
- Sessions with Supabase's Next.js library. Next.js 16's Proxy only refreshes the session; every page and action checks the user on the server, and RLS stays the real guard. No service-role key in the app.
- Vercel hosts the app; functions run in **Frankfurt** next to the database (`vercel.json`). Every pull request gets a preview link; merging to `main` deploys production.

### Tested by
- **pgTAP:** invitations — only owners create, see or cancel them; gym isolation; wrong email, expired, cancelled or reused links are rejected; you get exactly the invited role; the member list shows emails only to owners.
- **End-to-end (Playwright)** in a real browser against a local database: sign up → create gym → invite a coach → coach opens the link, signs up, joins → coach rights only. Viewer cannot edit. Gym B's address gives "not found" to gym A. ⌘K works without the mouse. The theme choice sticks.
- **Accessibility scan** (axe) on every screen, light and dark.

---

## 4b — Structured workout builder (with the live load panel)

### Screens
1. **Builder** — two panes on desktop:
   - **Left: the workout.** Date, track, title, focus, scheduled or template. Blocks **A, B, C…**, each with intent, **format** (only the fields that format needs), **Pace** and **Load** as effort words (never RPE numbers), partner, target rounds (AMRAP), notes. Lines: **exercise search** (gym aliases first, then core; generic words like "squat" offer the candidates), **quantity**, **load** (kg with Rx variants "22.5/15", % of 1RM, bodyweight). Two-implement exercises show **"2 × 22.5 kg"** with a per-line override. Optional per-line effort, station, note.
   - **Keyboard:** Enter adds a line, ⌘Enter adds a block, Tab moves between fields, ⌥↑/↓ moves lines, everything reachable from ⌘K.
   - **Right: the live load panel**, updated on every keystroke by the same engine as the tests: session duration and planned load as ranges; four tabs for the four lenses; warnings, each linking to its line.
   - **Save** (⌘S), Save as template, **Publish** (explains which lines block it). Unsaved work is backed up in the browser and offered back if you leave without saving.
2. **Calendar (simple)** — week list per track; click to open, "+" to start. Full calendar in Step 5.
3. **Exercises** — browse and search core and gym exercises; owner and head coach add or edit gym exercises (pattern weights must add up to 1.00) and gym aliases.
4. **Settings → Paces** (owner and head coach) — override any exercise's pace for your gym, with the default shown next to it.

### Under the hood
- The live panel runs the engine in the browser; **saving re-runs it on the server** and stores the result in `workout_metrics` with the calculation and taxonomy versions.
- Saving is one database transaction (`save_workout`) that touches only changed lines, so the audit log shows real edits.
- The database's rules for formats, quantities and loads are mirrored in one shared schema (Zod) for instant feedback; a test keeps both identical.
- **Pace overrides** for owner and head coach: gym settings are owner-only today, so overrides get their own table (or a narrow function) — data model spec updated in 4b.

### 4b questions (to settle before building)
- **Alternating EMOM** ("min 1: X, min 2: Y"): the data model has `every` with all lines in every interval. Add an "alternating" option to `every`, or model it as stations?
- **Rest between blocks:** planned load uses block durations only. Should the gap between blocks count anywhere (e.g. session length on the calendar)?

### Tested by
- **Vitest:** form → engine mapping; shared schema = database rules (one list of cases checked by both Vitest and pgTAP).
- **pgTAP:** `save_workout` (isolation, roles, all-or-nothing, publish rule, audit); pace overrides (owner and head coach only); `workout_metrics` rights.
- **End-to-end:** build WOD 1 by keyboard only → panel shows 202 AU and ~7.7 rounds → save → reload → same numbers from stored metrics; publish blocked while a line is unmatched; viewer read-only; browser backup restores unsaved work; accessibility scan.

---

## 4c — Paste a workout as text

**Needs first:** 20–50 of Daniel's real workouts as plain text (Daniel provides them before 4c starts). They become the parser's test cases.

### Screens
1. **Paste** — a large text box.
2. **Check & confirm** — your text on the left, each line marked ✓ understood · ? needs a choice · ✗ not understood; on the right, what the app understood. Unclear word → "Which 'squat' does your gym mean?" answered once and saved as a gym alias (any coach may answer; owner and head coach can change it; audited). **Confirm** opens it in the builder. The original text and each line's raw text are stored.

### What the parser reads (examples)
Block headings ("A.", "Part C", "Metcon"); formats ("AMRAP 8", "E3M x 5", "EMOM 10", "Every 2:00 x 4", "For time", "3 RFT", "21-15-9", "Tabata", "4 rounds 90/30"); quantities and loads ("8-10", "8/8", "800 m", "8-12 cal", "30 s", "max cal", "@75-80%", "22.5/15 kg", "2 x 22.5 kg", "BW"); effort words. Anything it cannot place is kept as a note, never guessed.

### Tested by
Parser tests on your real workouts (text in → expected structure out); pgTAP for coach-saved aliases and their audit; end-to-end paste → answer once → remembered → confirm → save.

---

## 4d — Log what the group did (`block_results`)

### Screens
- **Log results** (phone-first): each AMRAP and For Time block shows the plan ("Planned ~7.7 rounds, 6.7–8.7") and asks what the **group** did — rounds low–high or finish low–high (mm:ss; capped athletes count as the cap), which class, a note.
- **Results list** per workout: edit or remove (soft delete).

### Under the hood and tests
`block_results` as in data model §6: gym-scoped, RLS, audited, soft delete, rounds only on AMRAP, finish times only on For Time, low ≤ high. Stored only; planned-vs-logged comparison and pace calibration come later (BACKLOG: ≥ 5 comparable results; never overriding a pace you set). pgTAP for all rules; end-to-end on a phone-sized screen.

---

## How everything is tested

| Layer | Tool | What it proves | Runs |
|---|---|---|---|
| Calculation and logic | Vitest | Engine, parser, form-to-engine mapping, shared schema | Every push (CI) |
| Database and security | pgTAP | RLS for every new table and function, gym isolation, roles, audit, rules | Every push (CI) |
| Whole app in a browser | Playwright | The flows above, by keyboard, against a local database | Every pull request (CI) |
| Accessibility | axe in Playwright | Labels, contrast in light and dark, keyboard | Every pull request (CI) |
| Your eyes | Vercel preview link | Looks and feels right | Before each approval |

---

## Your steps (Vercel and Supabase)

The exact list, with the values filled in, is in `docs/STATUS.md` when 4a's preview is ready. In short: import the GitHub repository into Vercel, add two environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), deploy, then add the Vercel addresses to Supabase's allowed redirect URLs.

## Decisions (Daniel, 2026-10-21)

1. Sign-in: **email + password**; Google later (BACKLOG).
2. No domain yet: the app lives on `vercel.app`; Supabase's built-in email for testing; custom email sender before the first real gym (BACKLOG).
3. Builder on desktop and tablet; phones for viewing and logging results.
4. One database for previews and production until the first real gym, then split (BACKLOG).
5. Each sub-step as a pull request with a preview link.
6. Lovable screenshots: `docs/reference/lovable/` — feature checklist only.
7. Real workouts for 4c: Daniel provides them before 4c.
8. Drafts: explicit Save plus a browser backup of unsaved work.
9. Gym pace overrides: owner and head coach.
10. Long EMOMs (and tabata) take max-effort fatigue from the block's total work time, like intervals (calc spec §5.1).
