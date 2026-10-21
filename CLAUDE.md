# Workout Builder — Project Brief for Claude Code

## What this is
A **coach-facing SaaS** for programming workouts in functional fitness gyms. Coaches program daily workouts; the system tracks training load, movement patterns, muscle groups and balance over days, weeks and blocks. Built to be sold to gyms (subscription) — not a prototype.

Owner: Daniel — 25+ years coaching (athletes, teams, individuals, older adults). He is the domain expert. Ground every domain decision in real workouts and established sports science.

## Source of truth (read before any work)
- `docs/SPEC-calculation-model.md` — what is measured and how. Approved decisions are marked ✅.
- `docs/SPEC-data-model.md` — database schema, tenancy, security.
If code and spec disagree, the spec wins. If the spec is silent or ambiguous, **stop and ask** — never guess a domain rule.

## History (context only — do not port code)
Earlier versions exist (Python/Streamlit prototype, a Lovable React app). They only served to explore the idea. **This product does not follow them in any way** — not design, not UX, not data model, not logic. The Lovable screenshots in `docs/reference/lovable/` are a feature checklist, nothing more. No data or code is migrated.

## Quality bar
Quality is priority 1, 2 and 3. This is a professional tool coaches pay for, built to be several levels above anything in its category in quality, speed, correctness and coaching depth. When speed of delivery and quality conflict, choose quality and say so in STATUS.md.

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

**Approval:** Steps 1–3 and 4a–4b were approved one by one. From 2026-10-21 the continuous working mode below applies (see "Working agreement").

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
- **English only** — code, comments, commits, docs, UI and taxonomy labels. No Icelandic anywhere for now (decided 2026-10-21). A translation layer can be added later if ever needed.
- Daniel reads summaries in plain language — explain decisions briefly, no jargon walls.

## Working agreement (how the two Claudes and Daniel work together)
- **Claude chat (planning)** decides *what* and *why* with Daniel: domain rules, specs, priorities. Output lands in `docs/` as files.
- **Claude Code (this agent)** decides *how*: implementation, tests, git.
- **Files are the contract, not conversations.** Any decision made in either place is written to a spec or `docs/BACKLOG.md` before work continues.
- At the **start** of every step: read `docs/BACKLOG.md` and both specs.
- Anything discovered but out of scope for the current step → add to `docs/BACKLOG.md`, do not build it.
- At the **end** of every step: overwrite `docs/STATUS.md` with: what was built, test results, decisions made or interpreted, open questions for Daniel, and the recommended next step.

### Continuous working mode (Daniel, 2026-10-21)
- Continue through the build order **without waiting for approval between sub-steps**, as long as CI is fully green. Each sub-step: its own branch and pull request; **merge when green**; production deploys automatically from `main`.
- **Stop only for domain or coaching decisions** (calculation rules, what a coach sees, taxonomy). Collect them in `docs/STATUS.md` under **"Questions for Daniel"** and continue with work that does not depend on them.
- Daniel reviews **in batches on production**. Keep `docs/STATUS.md` current with **what changed since his last review**.
