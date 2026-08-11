# Merkhet

Internal project tracking for Merkhet Architecture.

## Stack

- Next.js 16.3 (App Router, Cache Components)
- Tailwind CSS v4 + shadcn/ui (KokonutUI registry)
- Motion + dnd-kit
- Supabase-ready schema (`supabase/migrations`) with a local **demo store** so the app runs without Docker

Product requirements: [`docs/PRD.md`](docs/PRD.md).  
Session handoff (resume context): [`docs/handoff/`](docs/handoff/).

## Run locally (demo mode)

No Supabase or Docker required. Data lives in memory for the Node process.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Email | Password | Role |
|---|---|---|
| `chris@merkhet.studio` | `password` | Admin |
| `dana@merkhet.studio` | `password` | Staff |

⌘K opens the command palette.

## Supabase (when ready)

1. Create a project, copy URL + anon key into `.env.local` (see `.env.example`).
2. Apply `supabase/migrations/20260807100000_init.sql`.
3. Swap `lib/db/repo.ts` to call Supabase clients in `lib/supabase/` (demo store is the current adapter).

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint

## MVP slices

| Slice | Status |
|---|---|
| 1 Scaffold | Done |
| 2 Schema + seed | Done (SQL + demo store) |
| 3 Auth + shell | Done |
| 4 Customers | Done |
| 5 Board read-only | Done |
| 6 Project detail | Done |
| 7 Drag to advance | Done |
| 8 Board toolbar | Done |
| 8.5 Command palette | Done |
| 9 Customer → project | Done |
| 10 Calendar | Done |
| 11 Settings | Done |
| 12 Polish | Baseline (loading shell, empty states, mobile nav collapse) |
