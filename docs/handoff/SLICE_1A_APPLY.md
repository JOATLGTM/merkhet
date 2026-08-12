 # Slice 1A — apply migrations (manual)

Your `.env` URL/anon key work. The hosted project still has **no app tables**.

## 1. SQL Editor (required)

Supabase Dashboard → **SQL** → New query.

Paste and run, in order:

1. Full contents of `supabase/migrations/20260807100000_init.sql`
2. Full contents of `supabase/migrations/20260812120000_move_project.sql`

Confirm tables exist: `users`, `customers`, `projects`, `project_phases`, `activity_log`, `phase_subscribers`.

## 2. Service role / secret key (required for seed)

Dashboard → **Project Settings → API** → copy the **service_role** key (JWT) or the new **secret** key (`sb_secret_…`).

Add to `.env` (do not commit):

```bash
SUPABASE_SERVICE_ROLE_KEY=<paste>
```

## 3. Seed

```bash
npm run seed
```

Then in SQL Editor:

```sql
select setval('public.project_number_seq', 419);
```

## 4. Verify

```bash
npm run dev
```

Sign in as `chris@merkhet.studio` / `password`. Restart the server and confirm board data is still there.

---

**Status (2026-08-12):** Migrations applied by user; seed script succeeded (20 projects, 5 staff). Still need the `setval` SQL above, then checklist verification in the app.
