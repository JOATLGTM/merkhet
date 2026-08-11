# Current state

## Product

**Merkat** — internal project tracking for an architecture firm (repo folder: `merkhet`).

MVP slices 1–12 are functionally done in **demo mode** (in-memory store). UI was restyled to match the Lovable showcase (Aug 7, 2026).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

| Email | Password | Role |
|---|---|---|
| `chris@merkat.studio` | `password` | Admin |
| `dana@merkat.studio` | `password` | Staff |

⌘K = command palette.

Demo data is process-memory (`lib/db/demo-store.ts`, global key `__merkatDemoV2`). Restart the Next process to reset seed if hot-reload left stale state.

## What’s built

- Auth via cookie session (`merkat_session`) — not real Supabase Auth yet
- App shell: nav rail (collapse), board / calendar / customers / settings
- Board: 8 columns, dnd-kit drag, filters, on-hold, new project, subscriber popovers
- Project detail sheet (~520px): details, customer, phases, hold, activity
- Calendar: horizontal week grid (vertical hairlines), phase bars, today (redline), weeks/months zoom, completed toggle, “No dates set”
- Customers list + detail
- Settings: Team + Phase subscribers tabs (admin)
- SQL migration ready: `supabase/migrations/20260807100000_init.sql`

## Visual reference (UI only)

- Board: https://pixel-perfect-showcase-001.lovable.app/
- Calendar: https://pixel-perfect-showcase-001.lovable.app/calendar
- Customers: https://pixel-perfect-showcase-001.lovable.app/customers
- Settings: https://pixel-perfect-showcase-001.lovable.app/settings
- Detail panel: screenshot in workspace assets / conversation (Ortega — garage studio)

## Seed sample (showcase-aligned)

Team: Chris Alvarado (admin), Dana Whitfield, Ines Okafor, Marcus Reed, Priya Raman

**8 customers:** Halcyon Development, Northbank Coffee, Waverly School District, Ortega Residence, Cardinal & Vine, Bellweather Housing Trust, Pilsen Arts Collective, Sable & Roe Dental

**20 projects** (`MK-0400`–`MK-0419`), every board column populated:

| Column | Count |
|---|---|
| Backlog | 3 |
| Pending | 2 |
| Schematic design | 3 |
| Design development | 3 |
| Construction documents | 2 |
| Review | 2 |
| Permitting | 2 |
| Completed | 3 |

`MK-0410`–`MK-0419` exist to exercise states the original ten never produced. **Check these before assuming a UI change is safe:**

| Case | Project |
|---|---|
| On hold, stalled ~4 months (§4.3) | `MK-0411` |
| On hold, paused days ago (§4.3) | `MK-0415` |
| Overdue target — redline | `MK-0414` |
| Target inside the 14-day amber window | `MK-0412`, `MK-0417` |
| Active phase with **no assignee** (§8.8) | `MK-0413` |
| Skipped phases — SD → Review (§4.3, §6.2) | `MK-0417` |
| Partial phase dates — calendar degradation (§6.5) | `MK-0418` |
| No dates at all — "No dates set" group | `MK-0401` |
| Long runway, widest calendar bar | `MK-0416` |

Seed dates are anchored to a **2026-08-10 "today"** — the amber/redline cases drift as the real date moves past them.
