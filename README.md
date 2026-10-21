# Workout Builder

Coach-facing SaaS for programming workouts in functional fitness gyms. See
[CLAUDE.md](CLAUDE.md) for the project brief and [docs/](docs/) for the specs
(the specs are the source of truth).

## Requirements

Node 20+, Docker (running), Supabase CLI.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
supabase start               # local Postgres + Auth in Docker
```

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app at http://localhost:3000 |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Database tests (pgTAP) against the local database |
| `npm run typecheck` / `npm run lint` | Type and lint checks |
| `supabase db reset` | Rebuild the local database from `supabase/migrations/` |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` after a migration |

## Database rules

- Schema changes only as migrations in `supabase/migrations/` — never in the dashboard.
- Every tenant table has `org_id` and Row Level Security; `supabase/tests/database/`
  proves gyms are isolated. Add tests with every new table.
