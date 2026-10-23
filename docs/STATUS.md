# Status

**Updated:** 2026-10-23 by Claude Code
**Working mode:** continuous (CLAUDE.md).
**Now:** your Programs decisions (1–5) are built, and everything in Step 6 that needs none of your Part 1 decisions. **Stopped: the rest of Step 6 needs your Part 1 decisions below.**

## Part 1 — what you must decide or buy (from `docs/PLAN-step-6.md`)
Everything else in Step 6 waits on these. **1 and 3 unblock the most.**

| # | Decision | My recommendation | Unblocks |
|---|---|---|---|
| 1 | **Product name and domain** | Choose the name, then the `.com` (and `.is` if you like). App at `app.<domain>`, email from `<domain>`. | Email (6b), app address (6a), privacy policy (6c) |
| 2 | **Legal entity** that sells the service | Your company: name, kennitala, address, contact email. It is the gyms' data processor. | Privacy policy, terms, data processing agreement (6c) |
| 3 | **Vercel Pro** ($20 a month per seat) | Needed: the free plan is for non-commercial use only. | Selling the app, custom domain (6a) |
| 4 | **Supabase Pro**, a new production project in Frankfurt with Small compute and Point-in-Time Recovery 7 days (~$140 a month incl. staging) | Today's project becomes staging. | Separate production (6a), the restore drill (6e) |
| 5 | **Email sender** | Resend (free to start). Brevo or Mailjet if you want EU-hosted. | Confirm email, password reset, automatic invitation emails (6b) |
| 6 | **Bot protection** | Cloudflare Turnstile (free). | Sign-up, sign-in, reset (6b) |
| 7 | **Error monitoring** | Sentry free plan, EU data. | 6d |
| 8 | **Privacy policy, terms, DPA** | I draft them; a lawyer reviews. Do you have one? | Afrek go-live (6c) |
| 9 | **Who gets alerts** | You, by email. | 6d, 6e |
| 10 | **Afrek's start date** | Sets the order. | Planning |

## What changed since your Programs message (2026-10-23)
Each part is its own pull request, merged when CI was fully green, with its database change applied to the hosted project just before. **All are on production** (table at the end).

### Programs (your decisions 1–5)
- **"Tracks" are "Programs"** everywhere you see or read (the database table is still `tracks`). Old links to Settings → Tracks still work.
- **Every workout belongs to a program** (decision 2). The builder, paste, templates and the calendar's move all require one; "No program" is gone. Workouts without one were moved to the gym's first active program. The database refuses a new, copied or moved workout on an **archived** program (ones already there stay editable), program names are **unique** within a gym (also when restoring one), and a gym **keeps at least one active program**.
- **Reorder programs** in Settings → Programs with up/down arrows (owners and head coaches; the keyboard stays on the program you move). Their order there is their order everywhere.
- **Calendar: one program at a time** (decision 3). It shows the gym's first program, or the one you chose last (remembered for you on any device). **All programs** is in the program menu and shows each program's colour and name. Templates follow the program shown.
- **Analytics: one program by default** (decision 4): yours from the calendar, else the gym's first. Tick several programs to see them together: the page says "Class + Strength club, together", each workout and warning names its program, and the week table shows each program's load and the total. "Only Strength club" goes back to one in one click.
- **Guidelines per program** (decision 5): Settings → Guidelines has "Gym defaults" and a tab per program, each marked "gym's" or "own". A program uses the gym's guidelines unless an owner or head coach gives it its own. Analytics checks each program against the guidelines that apply to it and says which ("Strength club uses its own guidelines").

### Step 6, the parts that need no Part 1 decision
- **Security (6f):** a Content-Security-Policy on every page (the browser only ever talks to the app; the database is reached from the server). A CI check fails if any database key is in what the browser downloads. Production dependencies have no known vulnerabilities. (`vercel.json` has asked for Frankfurt functions since 4a; I confirm it in 6a on Vercel Pro.)
- **Export the gym's data (6c):** Settings → Gym → "Export the gym's data" (owners): one zip with everything the gym has stored, as JSON and as spreadsheets (Icelandic letters work in Excel), with a README.
- **Delete your account (6c):** Settings → Profile. Your sign-in, name and memberships go; what you wrote stays with each gym, shown as "a former member". Not while you are a gym's only owner (it says which gym).
- **Delete a gym (6c):** Settings → Gym (owners, type its name). Gone for everyone at once; its owners can **bring it back for 30 days** ("Gyms you deleted"); then a nightly job erases it for good, with everything in it and its history.
- **Cookies (6c):** checked by a test: only the sign-in cookies (the session, and short-lived codes Supabase sets while an account is created or an email link is used) and one that remembers the last gym you opened (Question 6).
- **Runbook (6e), first draft:** `docs/RUNBOOK.md`: restore the database, roll back a deploy, rotate a leaked key, who to tell after a data breach. The drill needs the separate production project.

### Found and fixed on the way
- **Paste could bring back the previous workout's text.** The text is saved in the browser shortly after typing; if "Make workout" finished first, the waiting save put the old text back, and the next paste started with it (a test caught a "WOD 1" holding WOD 1 and WOD 2). Fixed, with a test.
- **Deleting a coach's account would have failed** once they had logged a result (who logged a result may never change), and would have marked their workouts as edited by them. Taking a deleted person's name off a row is now not an edit.
- **The new Content-Security-Policy caught zod** (the validation library) probing for `eval` in the browser on some pages. Harmless (it falls back), but reported as a violation; zod is now told not to probe.

## Questions for Daniel
Interpretations I made to keep going. Each is easy to change.
1. **Programs together in Analytics:** the totals are the programs added up, but **warnings, monotony, strain and week-on-week change stay per program** (a sum describes nobody's week). Calc spec decision 19. Right?
2. **A program's own guidelines replace the gym's as a whole**, not value by value (calc spec decision 20). Value by value is possible if you prefer.
3. **A gym always keeps one active program** (archiving the last is refused), since every workout needs one.
4. **Analytics opens on your calendar program** (else the gym's first).
5. **The calendar's templates list shows the program's templates**; "All programs" shows all.
6. **The last-gym cookie** (remembers which gym `/` opens; 1 year; no tracking). I read it as a strictly necessary preference that needs no consent banner; the lawyer should confirm, or I make it last only for the session.
7. **Deleting a gym:** 30 days to bring it back (from the plan). Invitations cancelled at deletion stay cancelled. Someone who deletes their account takes with them the deleted gyms only they own.

## Your steps
1. **Part 1 above.**
2. If not done yet: the deploy hook for the production check (Vercel → Project → Settings → Git → Deploy Hooks, a hook `production-check` for `main`; GitHub → Settings → Secrets → Actions, `VERCEL_DEPLOY_HOOK`).

## How it was verified
| What | Result |
|---|---|
| Unit tests (Vitest) | **443 of 443** (new: program choice for calendar and analytics, per-program warnings, CSV) |
| Database tests (pgTAP) | **723** across 24 files (new: programs 22, member preferences 13, program guidelines 10, account deletion 17, gym deletion 32; older files updated so every workout has a program) |
| Browser tests (Playwright, production build) | **51 of 51** (new: programs order/archive/restore, calendar per program, analytics per program with a program's own guidelines, security headers and CSP, export, account deletion, gym deletion, cookies, paste starting empty) |
| Accessibility (axe, WCAG 2.2 AA) | Calendar with all programs, Analytics with two programs, a program's guidelines, profile with account deletion, the create-your-gym page with a deleted gym |
| Keys in the browser | "No keys in 372 files the browser can download" (CI) |
| Note | This Mac cannot run the local database (Docker is off under memory pressure), so database and browser tests ran on GitHub for every pull request. |

## Pull requests
| PR | What | Database change | State |
|---|---|---|---|
| #14 | Tracks → Programs | — | merged |
| #15 | Every workout has a program; reorder | 002600 | merged, applied |
| #16 | Calendar per program | 002700 | merged, applied |
| #17 | Analytics per program (+ the paste fix) | 002800 | merged, applied |
| #18 | Guidelines per program | 002900 | merged, applied |
| #19 | Security: CSP, keys, audit; runbook | — | merged |
| #20 | Export the gym's data | — | merged |
| #21 | Delete your account | 003000 | merged, applied |
| #22 | Delete a gym (30 days to undo); cookie check | 003100 | merged, applied (nightly erasure scheduled with pg_cron) |
| #23 | This STATUS, BACKLOG | — | this one |

## Next
Your Part 1 decisions. Then, in the plan's order: 6a separate production → 6b email and bot protection → 6c privacy policy, terms and DPA pages → 6d error monitoring → 6e the restore drill → 6f Afrek's setup.
