# Step 4 plan — from engine to a working app

**Status:** plan for Daniel's approval (2026-10-21). Nothing in this plan is built yet.
**Rule:** four sub-steps, each approval-gated like the main steps. Each ends with a STATUS update and stops.

| Sub-step | What you will be able to do when it is done |
|---|---|
| **4a** Accounts, gyms, app shell, live on the internet | Sign up, create your gym, invite a coach by email, give people roles, and open the app at a real web address. |
| **4b** Structured workout builder | Build a workout block by block, see the training load update live while you type, save it, publish it. |
| **4c** Paste a workout as text | Paste a workout from your notes; the app turns it into blocks and lines, asks once about unclear words, and you confirm. |
| **4d** Log what the group did | After class, log rounds or finish times for the group per block, on a phone. |

The Lovable app is used for **structure and feel only** (no code is copied): the same four main areas (**Builder, Calendar, Analytics, Exercises**), dark and light mode, and a **live load panel** beside the builder. I have not seen the Lovable app myself; this plan follows your description. Screenshots of the screens you liked would help me match it in 4a/4b.

---

## 4a — Accounts, gyms, app shell, deployment

### Screens
1. **Sign up / Sign in** — email and password (see question 1), "forgot password", email confirmation.
2. **Create your gym** — first screen after sign-up when you belong to no gym: gym name, country. You become its owner.
3. **Join a gym** — when you open an invitation link: "Coach Anna invited you to Afrek as Coach — Join".
4. **App shell** — the frame every page sits in:
   - Left sidebar: **Builder, Calendar, Analytics, Exercises, Settings**. Calendar and Analytics show "coming soon" until they are built (4b / Step 5).
   - Top bar: **gym switcher** (a coach can belong to several gyms), user menu with profile, **light / dark / system** theme, sign out.
   - Collapses to a slim bar on tablets; a simple bottom bar on phones.
5. **Settings**
   - **Gym** (owner): name, country.
   - **Members** (owner): list with roles, change role, remove, **invite by email** with a role, pending invitations (resend, cancel).
   - **Tracks** (owner, head coach): create, rename, colour, archive.
   - **Profile** (everyone): display name.

### Flows
- **New gym:** sign up → confirm email → "Create your gym" → app opens on Builder (empty).
- **Invite a coach:** Settings → Members → Invite → email + role → coach gets an email → clicks the link → signs up (or signs in if they already have an account) → "Join Afrek" → lands in the gym with their role.
- **Viewer:** sees everything in the gym, every edit button is hidden or disabled.

### Under the hood
- New table **`invitations`** (gym, email, role, invited by, expiry, accepted/cancelled) with a single-use link. Accepting checks that the signed-in email matches the invitation and that it has not expired, then creates the membership. Only owners create or see invitations.
- Login sessions with Supabase's Next.js library. Every page and action checks the session on the server; the database's RLS stays the real guard. The service-role key is used in exactly one server-only place: sending the invitation email.
- **Vercel** hosts the app, functions run in **Frankfurt** next to the database (set in `vercel.json`). Every push to `main` deploys to production; every pull request gets its own preview link.
- Real invitation emails need a proper email sender (see "Your steps", step 11). Supabase's built-in email is for testing only and is heavily limited.

### Tested by
- **pgTAP:** invitations — only owners invite; gym B never sees gym A's invitations; wrong email, expired or reused links are rejected; you get exactly the invited role.
- **End-to-end (Playwright)**, in a real browser against a local database: sign up → create gym → invite a coach → open the email (caught by the local test mailbox) → accept → coach sees the gym with coach rights. A viewer cannot edit. A user in gym A who opens a gym B address gets "not found". Theme switch sticks.
- **Accessibility scan** (axe) on every screen: labels, contrast, keyboard use.

---

## 4b — Structured workout builder (with the live load panel)

### Screens
1. **Builder** — the main working screen, two panes on desktop:
   - **Left: the workout.** Date, track, title, focus (Strength / Metcon / …), scheduled or template. Then blocks **A, B, C…**, each a card:
     - Block: title, intent (strength / conditioning / skill / mobility), **format** (sets / every / AMRAP / for time / intervals / tabata) with only the fields that format needs (e.g. AMRAP → minutes; intervals → rounds, stations, work, rest, rest between rounds), **Pace** and **Load** as effort words (Easy · Moderate · Hard · Max — never RPE numbers), partner, target rounds (AMRAP), notes.
     - Lines: **exercise search** (gym exercises and aliases first, then the core library; generic words like "squat" show the candidates to pick from), **quantity** (reps, 8–10, 21-15-9, 8/8, metres, calories, seconds, max), **load** (kg with Rx variants "22.5/15", % of 1RM, bodyweight). For two-implement exercises the line shows **"2 × 22.5 kg"** with a small control to change the count for that line. Optional per-line effort, station (intervals), note.
     - Keyboard first: Enter adds a line, Tab moves between fields, blocks can be dragged to reorder.
   - **Right: the live load panel**, updated on every keystroke by the same engine as the tests:
     - Session: duration and planned load as ranges, e.g. "~20 min (17–24)", "~163 AU (139–195)".
     - Four tabs = the four lenses: **Strength** (hard sets by pattern and muscle, volume load, intensity), **Exposure** (pattern reps, push:pull, knee:hip, upper:lower), **Conditioning** (metres, calories, work time per modality), **Load** (per block).
     - **Warnings**, each pointing at its line: "No pace for Sled pull", "Line 3 not matched".
   - Bottom bar: **Save**, **Save as template**, **Publish** (explains which lines block it), Draft/Published badge, unsaved-changes marker.
2. **Calendar (simple)** — a week list per track: each day shows its workout; click to open, "+" to start one. The full month calendar comes in Step 5.
3. **Exercises** — browse and search the core library and your gym's exercises (patterns, muscles, equipment, pace, implement count, aliases), filter by pattern, equipment or category. Owner and head coach add or edit gym exercises (the form will not save until pattern weights add up to 1.00) and gym aliases.
4. **Settings → Paces** (owner) — override any exercise's pace for your gym; shows the default next to your value.

### Flows
- **Build WOD 1 from scratch:** Builder → date → add block A "every 3:00 × 5", line "5 back squat @75–80%", Load Moderate → block B … → block C "AMRAP 8" … The panel shows ~7.7 rounds (6.7–8.7) and 202 AU before you save → Save → Publish.
- **From a template:** Builder → "Start from template" → pick → adjust → save on a date.

### Under the hood
- The live panel runs the engine in the browser (instant). **Saving re-runs it on the server** and stores the result in `workout_metrics` with the calculation and taxonomy versions; the browser's numbers are never trusted.
- Saving is **one database transaction** (a `save_workout` function): only changed lines are touched, so the audit log shows real edits, not "everything deleted and re-added". If any line is invalid, nothing is saved.
- The same rules the database enforces (block formats, quantity and load shapes) are written once more as a **shared schema (Zod)** for instant form feedback; a test makes sure both always agree.
- Exercise data and your gym's pace overrides are loaded once per visit, so search is instant.

### Tested by
- **Vitest:** form → engine input mapping; the shared schema accepts and rejects exactly what the database does (one list of cases checked by both Vitest and pgTAP).
- **pgTAP:** `save_workout` — gym isolation, role rights (viewer cannot save), a bad line rolls back the whole save, the publish rule still holds, audit entries per real change; `workout_metrics` written only by coaches of that gym.
- **End-to-end:** build WOD 1 in the browser → panel shows 202 AU and ~7.7 rounds → save → reload → the same numbers come from the stored metrics. Publish is blocked while a line is unmatched. A viewer sees a read-only builder. Tablet-size screen check. Accessibility scan.

---

## 4c — Paste a workout as text

### Screens
1. **Paste** — a large text box ("Paste your workout"), e.g. straight from notes, WhatsApp or a Google Doc.
2. **Check & confirm** — two columns:
   - Left: **your text**, each line coloured: ✓ understood · ? needs a choice · ✗ not understood · headings in grey.
   - Right: **what the app understood**: blocks with format and parameters, lines with exercise, quantity, load, effort.
   - Not understood → pick the exercise from search, or leave it unmatched (the workout then stays a draft).
   - Unclear word → **"Which 'squat' does your gym mean?"** with the candidates (back, front, air, goblet). Answer once; ticking "remember for our gym" saves it as a gym alias, so the question never comes again. Any coach may answer; owner and head coach can change or delete it later; the audit log records who.
   - **Confirm** → opens in the structured builder (4b) to finish and save.

### What the parser reads (examples)
- Block headings: "A.", "B)", "Part C", "Strength", "Metcon".
- Formats: "AMRAP 8", "8 min AMRAP", "E3M x 5", "EMOM 10", "Every 2:00 x 4", "For time", "3 RFT", "21-15-9", "Tabata", "4 rounds 90/30".
- Quantities and loads: "8-10", "8/8", "800 m", "15 cal", "8-12 cal", "30 s", "max cal", "@75-80%", "22.5/15 kg", "2 x 22.5 kg", "BW".
- Effort words: "easy", "moderate", "hard", "max".
- Anything it cannot place is kept as a note, never guessed. The original text is stored with the workout and each line keeps its own raw text.

### Tested by
- **Parser tests on your real workouts:** I need 20–50 of your actual workouts as plain text (question 7). Each becomes a test case: text in → expected blocks and lines out, which you can check.
- **pgTAP:** a coach can add a gym alias only as the answer to an ambiguous term; only owner and head coach can change or delete it; every alias change is audited; gym isolation.
- **End-to-end:** paste WOD 2 → "bike" asks once → answer is remembered → paste again, no question → confirm → save → metrics stored.

---

## 4d — Log what the group did (`block_results`)

### Screens
1. **Log results** — opened from a workout (Calendar or Builder), designed for a **phone** after class:
   - Each AMRAP and For Time block shows the plan ("Planned ~7.7 rounds, 6.7–8.7") and asks for what the **group** did: rounds low–high (AMRAP) or finish time low–high (For Time, mm:ss; capped athletes count as the cap), which class (e.g. 06:00), and a note.
   - Other blocks: note only.
2. **Results list** per workout: each class's entry, edit or remove (soft delete).

### Under the hood
- New table **`block_results`** exactly as in the data model spec §6: gym-scoped, RLS (everyone reads, coaches write), audited, soft delete. Rounds only on AMRAP blocks, finish times only on For Time blocks, low ≤ high.
- Results are stored only. Comparing planned against logged, and suggesting pace changes, comes later (BACKLOG: only after ≥ 5 comparable results; never overriding a pace you set).

### Tested by
- **pgTAP:** isolation, roles, the format rules, low ≤ high, audit, soft delete.
- **End-to-end on a phone-sized screen:** open WOD 1 → log C as 7–9 rounds for the 06:00 class → appears in the list.

---

## Design approach (all sub-steps)

- **Components:** shadcn/ui (already installed) on Tailwind, with one shared set of colour tokens, so light and dark mode always match. Theme follows the device by default; the choice is remembered.
- **Plain coach language:** effort words instead of RPE, "~" and a range for every estimate, exact numbers shown plainly. English only.
- **Screen sizes:** builder for desktop and tablet; on a phone you can view workouts and log results (question 3).
- **Accessible:** everything usable by keyboard, labelled for screen readers, readable contrast in both themes.
- **Speed:** pages render on the server; the builder and live panel run in the browser; library data is loaded once.
- **Safety:** every read and write goes through your session and the database's RLS. The service-role key never reaches the browser (a "server-only" guard makes that a build error).
- **Working style:** each sub-step on its own branch with a pull request. Vercel gives each pull request a **preview link**, so you can click through the sub-step before approving; merging puts it live (question 5).

## How everything is tested

| Layer | Tool | What it proves | Runs |
|---|---|---|---|
| Calculation and logic | Vitest | Engine, parser, form-to-engine mapping, shared schema | Every push (CI) |
| Database and security | pgTAP | RLS for every new table and function, gym isolation, roles, audit, rules | Every push (CI) |
| Whole app in a browser | Playwright | The flows above, click by click, against a local database and test mailbox | Every pull request (CI) |
| Accessibility | axe in Playwright | Labels, contrast, keyboard | Every pull request (CI) |
| Your eyes | Vercel preview link | Looks and feels right | Before each approval |

New tables and functions in Step 4: `invitations` (4a), `save_workout` (4b), coach gym aliases + alias audit (4c), `block_results` (4d). Each ships with its pgTAP tests in the same pull request.

---

## Your steps (do these when 4a is ready to go live)

### Environment variables

| Name | Value | Vercel environments | Secret? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://skanujecpjmhskqqwoqj.supabase.co` | Production, Preview, Development | No (public by design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **anon** (the same value as in `.env.local`) | Production, Preview, Development | No (public by design; RLS protects the data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **service_role** → Reveal | Production, Preview | **Yes — tick "Sensitive". Never add `NEXT_PUBLIC_` to this name.** |
| `NEXT_PUBLIC_SITE_URL` | Your production address, e.g. `https://workout-builder.vercel.app` (known after step 5) | Production | No |

Preview deployments work out their own address automatically. Nothing else is needed: the email sender is configured in Supabase, not in Vercel.

### Vercel

1. Go to **vercel.com** and sign in with **GitHub** (account `dansoninn`).
2. **Add New… → Project**. Find **workout-builder** under "Import Git Repository". If it is not listed: **Adjust GitHub App Permissions** → give Vercel access to `dansoninn/workout-builder` → back → **Import**.
3. On "Configure Project": Framework Preset **Next.js** (detected), Root Directory **`./`**, leave Build, Output and Install as they are.
4. Open **Environment Variables** and add the four variables above (pick the environments shown in the table).
5. Click **Deploy** and wait for "Congratulations". Copy the production address (e.g. `https://workout-builder.vercel.app`) and send it to me.
6. **Settings → Build and Deployment → Node.js Version: 24.x.**
7. **Settings → Functions:** check that the region shows **Frankfurt (fra1)**. The repo sets this; just confirm.
8. **Settings → Git:** Production Branch **`main`** (the default).
9. Optional: **Settings → Domains → Add** your own domain and add the DNS records it shows.

### Supabase (dashboard of project `skanujecpjmhskqqwoqj`)

10. **Authentication → URL Configuration**
    - Site URL: your production address from step 5.
    - Redirect URLs, add: `https://<production address>/**`, the preview pattern I will send you once the project exists (it looks like `https://workout-builder-*-<your-vercel-team>.vercel.app/**`), and `http://localhost:3000/**`.
11. **Email sender (needed before inviting real coaches).** Create a free **Resend** account (resend.com) → add and verify your domain (DNS records) → create an API key. Then in Supabase: **Authentication → Emails → SMTP Settings** → enable custom SMTP: host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key, sender e.g. `noreply@yourdomain`.
12. **Authentication → Sign In / Providers → Email:** keep "Confirm email" **on**.

Already in BACKLOG and due before the first real gym: upgrade Supabase to Pro (daily backups, point-in-time recovery).

---

## Questions for Daniel

1. **Sign-in:** email + password (recommended: fastest at the gym), or email links only (no passwords)? Google sign-in later?
2. **Domain:** do you have a domain for the app and for sending emails? The email sender (step 11) needs one; the app itself can live on `vercel.app` until you decide.
3. **Phones:** builder on desktop and tablet only; on phones viewing and logging results. OK?
4. **One database for now:** previews and production share the current dev project until the first real gym, then we split into a separate production project. OK?
5. **Pull requests with preview links** for each sub-step (instead of committing straight to `main`). OK?
6. **Lovable screenshots** of Builder, Calendar, Analytics and Exercises, if you have them.
7. **Real workouts for 4c:** 20–50 of your workouts as plain text, the way you normally write them. They become the parser's tests.
8. **Drafts:** explicit Save plus a local backup of unsaved changes in the browser (recommended), or automatic saving every few seconds?
9. **Gym pace overrides:** owner only (it lives in gym settings), or head coaches too?
10. **EMOM and tabata max-effort windows** still take fatigue from the single window. Should they follow the intervals rule (total work time) too? Tabata rarely reaches 10 min, but a long EMOM can.
