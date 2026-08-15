# Merkhet

Internal project tracking for Merkhet Architecture.

## Stack

- Next.js 16.3 (App Router, Cache Components)
- Tailwind CSS v4 + shadcn/ui (KokonutUI registry) — note `components/ui/*` are **Base UI**, not Radix
- Motion + dnd-kit
- **Hosted Supabase** (Auth + Postgres + Storage). `lib/db/demo-store.ts` is the seed source
  for `npm run seed`, not a runtime adapter — the app has no offline mode.

Product requirements: [`docs/PRD.md`](docs/PRD.md).  
Workflow authority: [`docs/handoff/WORKFLOW-2.md`](docs/handoff/WORKFLOW-2.md).  
Session handoff (resume context): [`docs/handoff/`](docs/handoff/) — start at `NEXT.md`.

## Run locally

Requires a Supabase project. Fill `.env` from `.env.example`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_MERKET_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_MERKET_ANON_KEY` | Anon / publishable key |
| `SUPABASE_SERVICE_MERKET_ROLE_KEY` | Service role — seed and admin invite only |

```bash
npm install
npm run seed   # first time / reset demo data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Restart the dev server after any `.env`
change — it is not hot-reloaded.

| Email | Password | Role |
|---|---|---|
| `chris@merkhet.studio` | `password` | Admin |
| `dana@merkhet.studio` | `password` | Staff |

⌘K opens the command palette.

## Migrations

Applied by hand through the Supabase SQL editor, in filename order, from
`supabase/migrations/`. Each `SLICE_*_APPLY.md` in `docs/handoff/` records what its migration
does and how it was verified. Functions are replaced wholesale rather than patched, so the
newest migration touching `move_project` is the one that defines it.

## Scripts

- `npm run dev` / `build` / `start` — Next.js
- `npm run lint` — ESLint
- `npm run seed` — reset demo data in hosted Supabase
- `npm run check` — schedule + calendar arithmetic (73 assertions, no database)
- `npm run check:gates` — workflow gates + rework loop (50 assertions) — **writes to hosted
  Supabase**; creates one throwaway project and deletes it. Deliberately outside `check`.

There is no test runner; these are plain scripts that exit non-zero. **Nothing verifies
rendering.**

## Status

The MVP (board, customers, detail sheet, drag-to-advance, command palette, calendar, settings)
is complete. Workflow build-out is tracked as a separate slice sequence — see
[`docs/handoff/CHANGES-2.md`](docs/handoff/CHANGES-2.md) for the status table and
[`docs/handoff/CURRENT_STATE.md`](docs/handoff/CURRENT_STATE.md) for what works today.

> The old "MVP slices" numbering that used to live here is **not** the workflow slice
> numbering in `CHANGES-2.md`. Two unrelated sequences; do not cross-reference them.
