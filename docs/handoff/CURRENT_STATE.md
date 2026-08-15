# Current state

**Last updated: 2026-08-14**

> **Resuming?** Start with [`NEXT.md`](./NEXT.md). Slices 11, 4, 10 and 5 were built on
> 2026-08-14 and committed as **`f8d0526`** (local only, not pushed). All three migrations
> from that day are applied and verified, and the calendar and approvals UI have both had a
> visual pass. Nothing from that day is outstanding.

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
- **Planned hours per phase** in the detail sheet Phases grid (Review excluded — it's a gate); section header totals them. Legacy project-level `hours_per_week` retired from the UI
- **Plan schedule** (delegation): assignee + duration for the 5 delegated phases in one form; dates derived from durations in working days; planned hours optional. Raised on entry to Active, and available at any phase for backfill. Active → SD is gated on it in `move_project`
- **Approval gates**: sign-offs recorded in the detail sheet at Review (client contact, Austin, client) and Final review (client contact, Austin). The client's sign-off is recorded by staff on their behalf. A forward move that *crosses* a gate is blocked until it is satisfied — which also blocks skipping one (DD → CD, CD → Permitting). **Reject** returns the project a phase for rework via `reject_gate`, clearing that gate's sign-offs and re-planning the remaining dates from today
- Phase date fields are **read-only** — durations are the source (WORKFLOW-2 §3)
- New project: inline **+ New customer**

### Other surfaces
- Calendar: days/weeks/months zoom · by-project or by-staff rows · bounded window with paging (`SLICE_10_APPLY.md`, visually verified)
- Customers list + detail
- Consultants directory + detail; attach from project sheet
- Completed projects list (`/completed`)
- Staff (`/staff`, admin): Team + Phase subscribers

### Backend / migrations applied (hosted)
- `20260807100000_init.sql`
- `20260812120000_move_project.sql`
- `20260812130000_workflow_1b_enum.sql` + `20260812130100_workflow_1b.sql`
- `20260812140000_contracts_storage.sql` + `20260812140100_pending_contract_gate.sql`
- `20260814100000_phase_planned_hours.sql`
- `20260814120000_delegation_gate.sql`
- `20260814160000_approval_gates.sql` — also fixes a pre-existing `move_project` bug, see `SLICE_5_APPLY.md` §3a

See apply notes: `SLICE_1A_APPLY.md`, `SLICE_1B_APPLY.md`, `SLICE_2_APPLY.md`,
`SLICE_4_APPLY.md`, `SLICE_5_APPLY.md`, `SLICE_8_APPLY.md`, `SLICE_10_APPLY.md`,
`SLICE_11_APPLY.md`.
Slice 4 is spec'd separately in `SLICE_4_SCOPE.md`.

## Checks

```bash
npm run check         # check:schedule (28 assertions) + check:calendar (45)
npm run check:gates   # 50 assertions against hosted Supabase — writes, then cleans up
```

No test runner. `npm run check` covers the two pieces of real arithmetic — `deriveSchedule`
(`lib/dates.ts`) and calendar geometry (`lib/calendar.ts`) — and touches no database.
`check:gates` exercises the workflow gates and the rework loop against the **live** database
on one throwaway project it creates and deletes; it is kept out of `check` for that reason.
Neither covers rendering.

## Slice status (2026-08-14)

| Slice | State |
|---|---|
| 0 Recon | Done |
| 1A Supabase + Auth | Done |
| 1B Workflow schema | Done |
| 2 Pending→Active + contract | Done |
| 3 Intake expansion | **Reverted — on hold** |
| 4 Delegation | Done — applied + verified |
| 5 Approval gates | Done — applied + verified |
| 6 Notifications | Open (stubs only) |
| 7 Consultants | Done |
| 8 Permitting exit + archive | Done |
| 9 Staff workload view | Confirm need (nav Staff ≠ this) |
| 10 Calendar redesign | Done — visual check passed |
| 11 Planned hours per phase | Done — applied + verified |

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
