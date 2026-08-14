# Current state

**Last updated: 2026-08-12**

## Product

**Merkhet** — internal project tracking for an architecture firm (repo: `merkhet`).

App runs against **hosted Supabase** (Auth + Postgres + Storage). `lib/db/demo-store.ts` is **seed source only** (`npm run seed`), not the live data plane.

Workflow authority: [`WORKFLOW-2.md`](./WORKFLOW-2.md). Slice plan: [`CHANGES-2.md`](./CHANGES-2.md).

## Run

```bash
npm install
# Fill `.env` from `.env.example` (Merkhet-scoped Supabase keys)
npm run seed   # first time / reset demo data
npm run dev
```

Open http://localhost:3000

| Email | Password | Role |
|---|---|---|
| `chris@merkhet.studio` | `password` | Admin |
| `dana@merkhet.studio` | `password` | Staff |

⌘K = command palette.

**Env vars (required):**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_MERKET_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_MERKET_ANON_KEY` | Anon / publishable key |
| `SUPABASE_SERVICE_MERKET_ROLE_KEY` | Service role / secret (seed, admin invite) |

Legacy names (`NEXT_PUBLIC_SUPABASE_URL`, etc.) still work as fallbacks in `lib/env.ts`. Restart `npm run dev` after changing `.env`.

## What’s built

### Auth & shell
- Supabase Auth (cookie session via `@supabase/ssr`); `proxy.ts` refreshes sessions
- Nav: Board · Calendar · Customers · Consultants · **Completed projects** · Staff (admin)
- Theme: **dark default** + Light/Dark toggle in nav footer (`next-themes`); tokens in `app/globals.css` (`.dark`)
- `/settings` redirects to `/staff`

### Board & projects
- **8 columns:** Pending · Active · SD · DD · Review · CD · Final Review · Permitting
- No Backlog; create → Pending; Complete is archive (off-board)
- Active holding: `status=active`, `current_phase=null`
- Phase order: SD → DD → Review → CD → Final Review → Permitting (6-seg phase rule)
- Drag/⌘K; Pending exit blocked without contract PDF; View PDF via signed URL
- **Mark Complete** (green) on Permitting only → confirm modal → archive
- Detail sheet: hold, contract upload/view, consultants attach (+ new inline), phases, activity
- New project: inline **+ New customer**

### Other surfaces
- Calendar (week grid, phase bars, zoom)
- Customers list + detail
- Consultants directory + detail; attach from project sheet
- Completed projects list (`/completed`)
- Staff (`/staff`, admin): Team + Phase subscribers

### Backend / migrations applied (hosted)
- `20260807100000_init.sql`
- `20260812120000_move_project.sql`
- `20260812130000_workflow_1b_enum.sql` + `20260812130100_workflow_1b.sql`
- `20260812140000_contracts_storage.sql` + `20260812140100_pending_contract_gate.sql`

See apply notes: `SLICE_1A_APPLY.md`, `SLICE_1B_APPLY.md`, `SLICE_2_APPLY.md`, `SLICE_8_APPLY.md`.

## Slice status (2026-08-12)

| Slice | State |
|---|---|
| 0 Recon | Done |
| 1A Supabase + Auth | Done |
| 1B Workflow schema | Done |
| 2 Pending→Active + contract | Done |
| 3 Intake expansion | **Reverted — on hold** |
| 4 Delegation | **Skipped** |
| 5 Approval gates | Open |
| 6 Notifications | Open (stubs only) |
| 7 Consultants | Done |
| 8 Permitting exit + archive | Done |
| 9 Staff workload view | Confirm need (nav Staff ≠ this) |
| 10 Calendar redesign | Blocked: Austin |

## Seed sample

Team: Chris Alvarado (admin), Dana Whitfield, Ines Okafor, Marcus Reed, Priya Raman  
20 projects (`MK-0400`–`MK-0419`), 8 customers. After seed: `setval('public.project_number_seq', 419)`.

Useful cases: `MK-0411` / `MK-0415` on hold; overdue/amber targets; unassigned phase; skipped phases; partial/no dates.

Seed dates anchored to ~**2026-08-10** “today” — amber/redline drift over calendar time.

## Visual reference (UI only)

- Showcase: https://pixel-perfect-showcase-001.lovable.app/
- PRD wins over showcase when behavior conflicts

## Renamed Merkat → Merkhet (Aug 11, 2026)

Product/display/emails use Merkhet. Cookie/localStorage keys use `merkhet_*`. `MK-` project prefix unchanged on purpose.
