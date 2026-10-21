# Status

**Updated:** 2026-10-21 by Claude Code
**Current step:** **4a is built and ready for your review** (branch `step-4a`, pull request #1). It needs your Vercel and Supabase steps below before the preview link works. Your 4a answers (below) are built in. 4b has not started.

## Your 4a answers, built in (2026-10-21)
1. **A new gym starts with a "Class" track** (indigo), which owners and head coaches can rename or archive. Gyms created before this change that had no track got one too, so a gym you create on the preview right now is covered.
2. **Members page read-only for coaches and viewers:** approved, no change needed.
3. **4b decisions, ready for the builder:**
   - **Alternating EMOM** is an option of `every`: the lines take turns, one per interval. EMOM 12 with three lines → each line 4 times. EMOM 10 → 4, 3, 3 (the first lines get the extra minute, exactly like tabata). The duration doesn't change. If there are fewer minutes than lines, the app warns that some lines are never reached.
   - **Rest between blocks** is stored on each block ("rest after this block"). The engine now gives a **session length** (blocks + rest between them, for the calendar) next to planned load, which still uses block time only. Rest after the last block isn't counted.
   - Both are in the database, the calculation engine and the specs (calc spec §4.3 and Lens 4, decisions 13–14; data model spec §6). The builder screens for them come in 4b.
4. **BACKLOG:** splitting `core` into anti-extension / anti-rotation / anti-lateral-flexion / flexion, and gait/locomotion as its own pattern, both to decide after 4b with real data.

New question that came up (in BACKLOG): can one minute of an alternating EMOM hold two movements ("min 1: 10 cal row + 5 burpees")? Today each line is one minute of the rotation.

Tests after these changes: **pgTAP 409/409, Vitest 185/185, Playwright 24/24** (production build). Both migrations are applied to the hosted database. One browser test failed once and then passed in more than 100 runs since. I couldn't reproduce it; CI retries a failed test once and reports it as flaky, and Auto-fix will flag it if it comes back.

## What was built in 4a

### Design system (before any screen)
- `docs/DESIGN.md` and a live `/design` page (local and preview only, hidden in production): type scale on Geist at 13 px, colour tokens for light and dark, semantic colours for the 11 movement patterns, 4 intents and 4 effort levels, spacing, components, honest numbers ("~20 min 17–24"), and the keyboard map.
- Contrast is tested on every push: body text ≥ 7:1, secondary text ≥ 4.5:1, controls ≥ 3:1, in both themes.
- Every shadcn component we use is restyled to these tokens: no default shadcn look.

### Accounts and gyms
- **Sign up, sign in, forgot password, set a new password.** Email + password. Clear messages in plain words ("Email or password is incorrect.").
- **Create your gym:** name, address (made from the name, e.g. `/afrek-functional-fitness`), country. You become the owner.
- **Join by invitation link.** An owner invites an email with a role and gets a link to send by message, email or WhatsApp. A new coach opens it, creates an account on the same page and is in the gym in one step. The link works once, for 14 days, only for that email.

### The app shell
- Sidebar with your gym (switch between gyms), Builder, Calendar, Analytics, Exercises, Settings, and your account menu. On phones it opens from a menu button.
- **⌘K (Ctrl K)** opens a command palette: every page and action (go to, invite a member, new track, switch gym, theme, sign out).
- **G then a letter** jumps: G B Builder, G C Calendar, G A Analytics, G E Exercises, G S Settings, G P your profile. **?** lists all shortcuts.
- Builder, Calendar, Analytics and Exercises say what is coming and in which step.
- Light, dark or follow the device, remembered.

### Settings
- **Gym** (owner edits; everyone else sees it).
- **Members:** everyone sees the team; owners also see emails, invite, change roles, remove people, and see pending invitations (send a fresh link, cancel). The last owner can't step down or leave.
- **Tracks:** owners and head coaches create, rename, recolour, archive and restore.
- **Profile:** your name, password and theme.

### Under the hood
- New database table `invitations` (migration `20261021001400`), applied to the hosted database. Only a fingerprint (SHA-256) of each link is stored, never the link itself. Data model spec updated (§3).
- Every page and action checks who you are and your role on the server; the database's row-level security enforces the same rules underneath. No secret service key anywhere in the app.
- Vercel config: functions in Frankfurt next to the database, Node 24, security headers on every page.

## How it was verified
| What | Result |
|---|---|
| Database tests (pgTAP) | **409 of 409 pass** (64 for invitations, 17 for your answers: only owners invite, see or cancel; gym isolation; wrong email, expired, cancelled or reused links rejected; exactly the invited role; emails only for owners; reserved addresses) |
| Unit tests (Vitest) | **185 of 185 pass** (new: addresses, safe redirects, reserved names match the database, dates, alternating EMOM, session length) |
| Browser tests (Playwright, production build) | **24 of 24 pass**: sign up → create gym; sign out/in returns to your gym; invite a coach → they join with coach rights only; link works once and only for its email; viewer can't change anything; role change and removal; gym B is "not found" for gym A; ⌘K and G shortcuts without the mouse; phone navigation; tracks; rename gym |
| Accessibility (axe, WCAG 2.2 AA) | Every screen and dialog, **light and dark: no problems**. Two real issues it found were fixed (button names that didn't match their visible text; two pieces of text below 4.5:1). |
| Looked at by eye | Every screen in light, dark and phone width (screenshots); fixed footer alignment, phone table overflow, backdrop blur. |
| Hosted database | Migration applied; app checked against it (sign-in page, invitation page, protected pages redirect). |

CI on GitHub now runs four jobs on every push: lint + types + unit tests, database tests, and the browser + accessibility tests against a local copy of the database.

## Decisions made or interpreted (please check)
1. **Members page for everyone, read-only** (approved): coaches and viewers see who is on the team (names and roles, no emails); only owners can change anything.
2. **Invitations are not in the gym's audit log.** Every member can read the audit log, and an invitee's email is for owners only. Joining *is* logged (it creates a membership).
3. **Anyone holding an invitation link sees what it is for** (gym, role, the invited email), even before signing in. That is what lets a new coach sign up and join on one page.
4. **Accepting needs a confirmed email.** When "Confirm email" is off (testing), Supabase counts every address as confirmed, so this only matters once it is on.
5. **Passwords: at least 8 characters.**
6. **The gym address can't be changed yet** (it is in every link). Added to BACKLOG.
7. **Track names are unique among a gym's active tracks.** A new gym starts with "Class" (your answer 1).
8. **Quality over speed, noted as asked:** a Next.js 16.4 development bug (a route at `/` made pages reload endlessly) took time to track down. `/` is now routed in the proxy, which is also one redirect faster. The browser tests run against a production build, not the dev server, to test what you will use.

## Open questions for Daniel
1. Alternating EMOM: can one minute hold two movements (e.g. "min 1: 10 cal row + 5 burpees, min 2: 12 wall balls")? Settle before the 4b builder.

## Your steps (about 10 minutes)

### 1. Vercel: connect the repository
1. Go to vercel.com → **Add New… → Project** → import **dansoninn/workout-builder** (allow the Vercel GitHub app access to this repository only, if asked).
2. Framework is detected as **Next.js**; leave build settings as they are.
3. Under **Environment Variables**, add two, for **Production and Preview**:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://skanujecpjmhskqqwoqj.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the **anon public** key (Supabase → Project Settings → API Keys; the same value as in your `.env.local`).
   Do **not** add the service role key; the app does not use it.
4. **Deploy.** This first deploy is from `main` (it only has the plan). Then open the `step-4a` pull request on GitHub: Vercel adds a **preview link** to it. If no preview appears within a few minutes, tell me and I will push a commit to trigger it.
5. Check, in the Vercel project: **Settings → Functions → Function Region** shows **Frankfurt (fra1)**, and **Settings → Build and Deployment → Node.js Version** shows **24.x**. Both come from the repository.

### 2. Supabase: allow the Vercel addresses
Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL:** your production address from Vercel (Project → Domains), e.g. `https://workout-builder.vercel.app`.
- **Redirect URLs**, add three:
  - `https://<your production domain>/**`
  - `https://*-<your-vercel-team>.vercel.app/**` (all preview links; the team part is the end of any preview address, e.g. `…-danson.vercel.app`)
  - `http://localhost:3001/**` (local development)

### 3. Supabase: email while testing
Supabase's built-in email only reaches people in your Supabase team, so sign-up confirmations to coaches would never arrive. For testing:
- **Authentication → Sign In / Providers → Email → turn "Confirm email" off.** Already in BACKLOG to turn back on, with our own email sender, before the first real gym.
- Optional: on the same screen set **Minimum password length to 8** (the app already requires 8).

### 4. Try it on the preview link
Create an account and your gym, invite a second email of yours as Coach, open the link in a private window and join. Preview links are protected by Vercel login by default, which is fine for you; to let a coach try a preview, use the production link or turn off **Settings → Deployment Protection** for previews.

## Recommended next step
Review the preview. If 4a is approved, merge the pull request (production deploys from `main`) and answer the alternating-EMOM question; then 4b, the structured builder with the live load panel.
