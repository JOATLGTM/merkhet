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

Customers: Halcyon Development, Northbank Coffee, Waverly School District, Ortega Residence  
Team: Chris Alvarado (admin), Dana Whitfield, Ines Okafor, Marcus Reed, Priya Raman  
~10 projects across backlog → completed
