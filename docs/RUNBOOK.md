# Runbook — when something goes wrong

**Status:** first draft, 2026-10-23 (PLAN-step-6 6e). Parts marked **[after 6a]** apply once production has its own Supabase project with Point-in-Time Recovery (Part 1, decisions 3–4). Until then there is one Supabase project (today's, which becomes staging) on the free plan, with no PITR. The restore drill has not been run yet; its timings go here when it has.

Keep this short and true. Every step here must have been done at least once, in the drill or for real; a step that has not is marked *untried*.

---

## 0. First minutes, whatever happened

1. **Write down the time** you noticed, and what you saw. Everything after this refers to it.
2. **Is member data at risk** (seen by the wrong gym, changed, lost, or leaked)? If yes, also follow §5.
3. **Stop the bleeding before fixing:** roll back the deploy (§2) if the last deploy caused it; that is fast and safe. Restore data (§1) only when data is wrong or gone.
4. Say what is going on to whoever is affected (§5), even before it is fixed.

## 1. Restore the database to a point in time **[after 6a]**

When: data was deleted or damaged (a bad migration, a bug that wrote wrong data), and you know roughly when.

1. Find the **last good minute**: the deploy or migration time (GitHub → Actions, Vercel → Deployments), or the first wrong row in the audit log (`audit_log.at`).
2. Supabase dashboard → the **production** project → Database → Backups → **Point in time**. Choose the last good minute (UTC; Iceland is UTC). *Untried.*
3. The restore replaces the **whole** database and the project is **unavailable while it runs** (minutes for a small database). Everything written after that minute is gone, also good changes; if some must be kept, export them first (Table editor, or `select … from audit_log where at > …`).
4. After the restore: open the app, sign in, open a calendar and a workout; check the audit log ends at the chosen minute.
5. If a migration caused it: the database is now before the migration, but `supabase_migrations.schema_migrations` may still list it. Fix the migration in a new PR; do not re-run the bad one.

**Restore a daily backup into a new project** (to look at old data without touching production, and for the quarterly drill): Database → Backups → Scheduled backups → restore to a new project if the dashboard offers it; otherwise download the backup and load it with `psql` into a new, empty project. *Untried.*

## 2. Roll back a deploy

When: the app is broken right after a deploy (production runs `main`; every merge deploys).

1. Vercel → the project → Deployments → the previous good **production** deployment → **Instant Rollback**. Takes seconds; nothing is rebuilt.
2. While rolled back, new merges to `main` are **not** put live automatically. The production check (GitHub → Actions → "Production check") will fail and email the owner every 30 minutes; that is expected.
3. Fix forward: a PR that reverts or fixes the change (`git revert <merge commit>`), CI green, merge. Then in Vercel, promote the new deployment (or "Undo Rollback") so production follows `main` again, and check `/api/version` shows the new commit.
4. If the bad deploy included a migration, rolling back the app does **not** roll back the database. Our migrations keep the previous app working (e.g. 002800 kept the old `period_metrics` until the new app was live); if one did not, fix forward.

## 3. Rotate a leaked key

What exists: the Supabase **URL** and **anon key** (public by design, but used only by our server; protected by RLS), the **database password** (used only by the Supabase CLI for `db push`), the **Vercel deploy hook** (GitHub secret `VERCEL_DEPLOY_HOOK`). The app has **no service-role key** and never needs one. Keys live only in `.env.local` (git-ignored), Vercel environment variables and GitHub secrets — never in the code (CI checks that none is in what the browser downloads).

- **Database password:** Supabase → Project Settings → Database → Reset database password. Update it wherever the CLI uses it (your machine). The app is not affected.
- **Anon key:** Supabase → Project Settings → API Keys. With the newer publishable/secret keys, create a new one and disable the old; with the legacy JWT keys, rotating means a new JWT secret, which **signs everyone out**. Then update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (Production and Preview) and redeploy. *Untried.*
- **Deploy hook:** Vercel → Project → Settings → Git → Deploy Hooks: delete it, create a new one, update the GitHub secret `VERCEL_DEPLOY_HOOK`.
- **A GitHub or Vercel account:** change the password, check 2FA, revoke sessions and tokens, look at the audit logs of both for anything you did not do.

After any rotation: check the app signs in and the production check passes.

## 4. The app is down or slow

1. `https://<production>/api/version` answers? If not, Vercel status (vercel-status.com) and Supabase status (status.supabase.com).
2. Vercel → Deployments → the live one → Logs (function errors). **[after 6d]** Sentry shows the errors with their stack, without personal data.
3. Supabase → Reports (database CPU, connections). The free plan pauses a project after a week without use; production on Pro does not.

## 5. Who to tell

We are the gyms' **processor**; each gym is the **controller** of its coaches' and members' data (PLAN-step-6 6c).

- **A personal-data breach** (data seen by someone who should not, changed, lost or leaked): tell each affected gym's owner **without undue delay**, in writing: what happened, when, what data, what we did, what they should do. The gym decides whether to tell Persónuvernd (Iceland's data protection authority), which the law expects **within 72 hours** of the gym knowing. Keep a written record of every breach, also small ones (what, when, effect, what was done).
- **An outage or bug without data at risk:** tell the gyms using the app what does not work and when it is expected back, if it lasts more than a few minutes during their programming time.
- **Always:** write a short note afterwards in `docs/BACKLOG.md` (what happened, why, what changes so it does not happen again).

## 6. The drill (every quarter) **[after 6a]**

On **staging**, never production (a restore stops the project while it runs):

1. Note the time. Make known changes: create a workout "Drill", delete another, rename a program.
2. Point-in-time restore to the minute before step 1 (§1).
3. Check: "Drill" is gone, the deleted workout is back, the program has its old name; the app works (sign in, calendar, builder, analytics).
4. Write here: the date, how long the restore took, and anything in §1 that was wrong.
5. Then restore production's latest **daily backup into a new project** (§1, last part), check it opens, and delete that project.

| Date | Restore took | Notes |
|---|---|---|
| — | — | Not run yet (needs 6a). |
