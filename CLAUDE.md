# Workout Builder — Project Brief for Claude Code

## What this is
A **coach-facing SaaS** for programming workouts in functional fitness gyms. Coaches program daily workouts; the system tracks training load, movement patterns, muscle groups and balance over days, weeks and blocks. Built to be sold to gyms (subscription) — not a prototype.

Owner: Daniel — 25+ years coaching (athletes, teams, individuals, older adults). He is the domain expert. Ground every domain decision in real workouts and established sports science.

## Source of truth (read before any work)
- `docs/SPEC-calculation-model.md` — what is measured and how. Approved decisions are marked ✅.
- `docs/SPEC-data-model.md` — database schema, tenancy, security.
If code and spec disagree, the spec wins. If the spec is silent or ambiguous, **stop and ask** — never guess a domain rule.

## History (context only — do not port code)
Earlier versions exist (Python/Streamlit prototype, a Lovable React app). This is a clean rebuild on a solid foundation. The Lovable app is a reference for features and UX only. No data or code is migrated from them.

## Stack
- Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui
- Supabase (Postgres, Auth, RLS) — project ref `skanujecpjmhskqqwoqj`, region eu-central-1 (Frankfurt)
- Vercel for hosting
- Supabase CLI migrations in `supabase/migrations/` — **no schema changes in the dashboard, ever**
- Tests: Vitest (TypeScript, incl. calculation engine), pgTAP (database + RLS)

## Build order (strict, approval-gated)
1. **Foundation** — repo scaffold, schema migrations, RLS, reference taxonomy seed, RLS tests
2. Exercise library — clean core library + aliases + pattern weights (Daniel approves the table)
3. Calculation engine — pure TypeScript, tested against the worked examples in the calc spec
4. Workout builder (structured entry first, free-text parser after)
5. Calendar, templates, analytics

**Stop after each step, summarise what was built and how it was verified, and wait for Daniel's explicit approval.**

## Non-negotiables
- Every tenant table has `org_id` and RLS. Gym A can never read or write gym B — proven by tests.
- Taxonomy (patterns, planes, modalities, muscles, effort levels) is locked reference data. No free-text values.
- Raw text stored next to parsed data.
- Soft delete for user-facing data; audit log on programming tables.
- Secrets only in `.env.local` (git-ignored) and Vercel env vars. Never commit keys. Never print keys in output.
- Commit before any large change. Small, descriptive commits.

## Out of scope for now
Social features, notifications, athlete/client-facing app, AI recommendations, billing. The data model leaves room for them; do not build them.

## Conventions
- English for code, comments, commits, docs. UI copy supports Icelandic + English (i18n from the start).
- Daniel reads summaries in plain language — explain decisions briefly, no jargon walls.
