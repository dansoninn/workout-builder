# Plan — Step 6: Pilot readiness (first real gym: Afrek)

**Written:** 2026-10-22 by Claude Code, from Daniel's batch review ("separate production database, Supabase Pro + PITR, custom email sender, sign-up bot protection, re-enable preview protection, privacy policy + GDPR basics, error monitoring, backup/restore drill").
**Status:** for Daniel's review. **Nothing in Step 6 is built until this plan is approved.** Prices are from the vendors' own pricing pages on 2026-10-22 and change; check them when buying.

## The goal
Afrek's coaches program real classes in the app, with their members' data safe, private and recoverable, and with us knowing about any error before they tell us. Test data stays out of production.

---

## Part 1 — What you must decide or buy

| # | Decision / purchase | What I recommend | Cost (month) | Needed for |
|---|---|---|---|---|
| 1 | **Product name and domain** | Choose the name first; then a `.com` (and the `.is` if you want Icelandic presence). The app lives at `app.<domain>`, email comes from `<domain>`. | ~$1–3 (domain, paid yearly) | Email sender, app address, privacy policy |
| 2 | **Legal entity** that sells the service | Your company (name, kennitala, address, contact email). It is the "processor" of the gyms' data and signs their data processing agreement. | — | Privacy policy, terms, DPA, Vercel/Supabase accounts |
| 3 | **Vercel Pro** | Required: Vercel's free Hobby plan is for personal, non-commercial use only. One developer seat. | $20 per seat | Selling the app; custom domain; choosing the server region |
| 4 | **Supabase Pro**, a new **production project** in Frankfurt | Pro plan with Small compute and **Point-in-Time Recovery, 7 days**. PITR requires at least Small compute. The current project becomes **staging** (previews and tests). | Pro $25 (incl. $10 compute credit) + Small ~$15 + PITR 7 days ~$100 + staging Micro ~$10 ≈ **$140** | Separate production data; recovery to any minute of the last 7 days |
| 5 | **Email sender** | **Resend** (free up to 3,000 emails/month, 100/day; Pro $20 for 50,000). It needs DNS records on your domain (SPF, DKIM, DMARC). Resend does not state EU data residency on its pricing page; if that matters to you, **Brevo** or **Mailjet** (both French, EU-hosted) are the alternatives. Your call. | $0 to start ($20 later) | Sign-up confirmation, password reset, **automatic invitation emails** |
| 6 | **Sign-up bot protection** | **Cloudflare Turnstile** (free; usually no puzzle for people). Supabase Auth supports it directly; hCaptcha is the other option. | $0 | Sign-up, sign-in, password reset |
| 7 | **Error monitoring** | **Sentry**, free Developer plan (1 user, 5,000 errors/month), with data stored in the EU. Team plan ($26–29) only if we outgrow it. | $0 | Knowing about errors first |
| 8 | **Privacy policy, terms and a DPA** | I draft them from what the app actually stores and who processes it; **a lawyer should review them** before Afrek signs. Do you have one, or should I list Icelandic firms that do GDPR reviews? | Lawyer's fee | Afrek's go-live |
| 9 | **Who gets the error and backup alerts** | You (email), at least at first. | — | 6d, 6e |
| 10 | **Afrek's start date** | Sets the order below; 6a–6c must be done before their first real member data. | — | Planning |

**Total running cost at the start: about $160–185 a month** (Vercel Pro $20, Supabase ≈ $140, everything else free until we grow), plus the domain and a one-off legal review.

---

## Part 2 — What I build, once Part 1 is decided
Each sub-step on its own branch and pull request, merged when CI is green (continuous mode). Coaching questions, if any, go to STATUS.

### 6a — Separate production
- A **new Supabase project for production** (Frankfurt, Pro, Small compute, PITR 7 days); today's project becomes **staging**. All migrations applied to both from `supabase/migrations/`; CI applies them to staging on every merge, and to production only after staging is green. No test data in production; Afrek starts fresh.
- **Vercel**: production uses the production project, previews use staging (separate environment variables). **The server functions run in Frankfurt** (Vercel's default region is in the US; member data should not travel there).
- **Re-enable Vercel Authentication on previews** (free on all plans; BACKLOG item from 2026-10-21).
- The custom domain on Vercel (`app.<domain>`), HTTPS, and the auth redirect addresses in Supabase.
- Tested by: the production check (CI ran, production runs `main`) against the new project; a script that confirms production and staging have the same migrations.

### 6b — Sign-in and email
- **Custom email sender** in Supabase Auth (decision 5), with our own templates in English: confirm your email, reset your password, and **invitations sent automatically** (today the owner copies a link).
- **"Confirm email" turned on** (off since 4a for testing).
- **Turnstile** on sign-up, sign-in and password reset (decision 6).
- **Leaked-password check** (Supabase checks passwords against known breaches) and a minimum length.
- Tested by: browser tests with Turnstile's test keys on local and staging; email templates checked in the local mail catcher.

### 6c — Privacy and GDPR basics
The gym is the **controller** of its coaches' and members' data; we are the **processor**. What the app stores today: coaches' names and emails, the gym's workouts, results per class (never per member), and an audit log of who changed what.
- **Privacy policy** and **terms** pages (public, linked from sign-up and the app), drafted from the above; plus a **sub-processor list** (Supabase, Frankfurt; Vercel, Frankfurt functions; the email sender; Sentry, EU) and a **data processing agreement** template for gyms.
- **Export a gym's data** (owner): everything the gym owns, as JSON and CSV, in one download.
- **Delete a gym** (owner): it disappears at once, and is erased for good after 30 days, which leaves time to undo. Its audit log goes with it.
- **Delete your account**: a person removes themselves; what they wrote stays with the gym, attributed to "a former member".
- **Cookies**: the app sets only the sign-in session cookie, which is strictly necessary, so no consent banner is needed. I will check that this stays true.
- Tested by: pgTAP (only an owner exports or deletes; one gym's export holds nothing of another's; the erasure after 30 days), browser tests (export, delete with undo).

### 6d — Error monitoring
- **Sentry** in the Next.js app (browser and server), EU data, with source maps. **No personal data in events**: no emails, names or workout text, only ids and the error. An email to you on new errors.
- An **uptime check** of the production address (Sentry's free uptime monitor), in addition to the production check that already runs after every merge.
- Tested by: a test error from staging that arrives in Sentry without personal data.

### 6e — Backup and restore drill
- Written **runbook** (`docs/RUNBOOK.md`): restore the database to a point in time, roll back a deploy, rotate a leaked key, who to tell.
- **The drill, on staging** (a restore stops the project while it runs): make known changes, restore to the minute before them, and check that the data is back and the app works. Time it, and note it in the runbook. Then a **restore of production's daily backup into a new project** (not over production), to prove production backups work too.
- Repeat every quarter (BACKLOG).

### 6f — Before Afrek's first day
- A security pass: Content-Security-Policy header (BACKLOG), dependency audit, check that no key is in the code or the browser bundle, and that RLS tests cover every table (they do today).
- Afrek's setup with you: create the gym, invite their coaches, their tracks; the guidelines start at the defaults (decision 18).
- A way for Afrek's coaches to reach us (an email address on your domain), and a simple feedback log in BACKLOG.

---

## Tracks — required before Afrek go-live

Afrek runs 3–4 programs in parallel, so tracks must work end to end before the first real day. Audit 2026-10-23 (read-only, evidence in BACKLOG "Tracks — Afrek launch requirement").

**What already works:** create, rename, recolour, archive and restore tracks (owner and head coach); a new gym starts with "Class"; the calendar shows all tracks with colours (month: dot + name; week: one column per track) and a workout can be moved between tracks; analytics can show one track or all; gym isolation is enforced by the database (a workout can never point to another gym's track) and tested.

| Gap | Size | Decision needed |
|---|---|---|
| Every workout must have a track (today it can be empty) | medium | Yes — spec change |
| Reorder tracks | small | No |
| Calendar: filter to one track | small | No |
| Analytics: choose several tracks together; never mix tracks silently by default | medium | Yes — what the default view is |
| Guidelines and warnings per track, not one gym-wide target | medium–large | Yes — per-track guidelines |
| Database blocks workouts on archived tracks | small | No |
| Track names unique in the database, also on restore | small | No |
| Missing tests (cross-gym via functions, null/archived, reorder, filters) | small | No |

Not required for go-live: track filter on Results; the builder's load panel showing the week for the same track.

## Order and what waits on what
1. **You decide 1–10.** Domain and Vercel Pro first: they unblock everything else.
2. 6a (production and staging) → 6b (email needs the domain) → 6c (policy needs the entity) → 6d → 6e → 6f.
3. Afrek starts once 6a–6c are live and 6e's drill has passed.

## Out of scope for Step 6 (BACKLOG)
Billing and subscriptions, Icelandic UI, an athlete app, gym time zones (Iceland is UTC), Google sign-in.
