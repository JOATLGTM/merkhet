# Current state

## Product

**Merkhet** — internal project tracking for an architecture firm (repo folder: `merkhet`).

MVP slices 1–12 are functionally done in **demo mode** (in-memory store). UI was restyled to match the Lovable showcase (Aug 7, 2026).

**Still nothing is persisted.** Every change below runs against `lib/db/demo-store.ts` and dies with the Node process. Wiring Supabase remains item 1 in [NEXT.md](./NEXT.md).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

| Email | Password | Role |
|---|---|---|
| `chris@merkhet.studio` | `password` | Admin |
| `dana@merkhet.studio` | `password` | Staff |

⌘K = command palette.

Demo data is process-memory (`lib/db/demo-store.ts`, global key `__merkhetDemoV2`). Restart the Next process to reset seed if hot-reload left stale state.

## What’s built

- Auth via cookie session (`merkhet_session`) — not real Supabase Auth yet
- Login screen carries the KokonutUI background-paths animation (see [DECISIONS.md](./DECISIONS.md))
- App shell: nav rail (collapse), board / calendar / customers / settings
- Board: 8 columns, dnd-kit drag, filters, on-hold, new project, subscriber popovers
  - Drop targeting uses a custom collision strategy; empty **and collapsed** columns are valid targets
  - New Project dialog can create a customer inline (`+ New customer`), which also lands in `/customers`
- Project detail sheet (`--container-xl`): details, customer, phases, hold, activity
- Calendar: horizontal week grid (vertical hairlines), phase bars, today (redline), weeks/months zoom, completed toggle, “No dates set”
  - Bars carry status text; row labels repeat the current column so narrow bars still read
- Customers list + detail
- Settings: Team + Phase subscribers tabs (admin)
- SQL migration ready: `supabase/migrations/20260807100000_init.sql`

## Renamed Merkat → Merkhet (Aug 11, 2026)

Product name is now **Merkhet**, matching the repo folder and `package.json`. The rename covered display strings, the demo email domain, and every namespaced identifier.

**Stored keys changed, so existing state is dropped:**

| Was | Now | Effect |
|---|---|---|
| `merkat_session` | `merkhet_session` | Anyone holding an old cookie is signed out — the route 307s to `/login` |
| `merkat-board-collapsed` | `merkhet-board-collapsed` | Board column collapse state resets |
| `merkat.calendar.zoom` | `merkhet.calendar.zoom` | Calendar zoom resets to `weeks` |
| `__merkatDemoV2` | `__merkhetDemoV2` | Demo store re-seeds |
| `@merkat.studio` | `@merkhet.studio` | **Demo logins changed** — see the Run table above |

Unchanged on purpose:

- **`MK-` project number prefix** — reads fine for either name and is quoted out loud by staff (PRD §5.2); changing it would renumber live projects.
- **`Merkat.dc.html`** in `PRD.md` §preamble and `DECISIONS.md` — the literal filename of the original external Datum mockup. Renaming a historical artifact's filename would make it un-findable.

## Changed Aug 11, 2026

**Bug fixed:** the login card and background flashed on Chrome at full-window width (fine at half width). The background-paths float loop animated `transform` on 32 SVG paths, which Blink cannot composite — every frame repainted the whole document layer. Float moved onto three composited wrapper divs; SVGs are now static. See "Full-page flash at wide viewports" in [DECISIONS.md](./DECISIONS.md).

## Changed Aug 10, 2026

Grouped by why it mattered, not by file. Durable rules live in [DECISIONS.md](./DECISIONS.md); remaining gaps in [NEXT.md](./NEXT.md).

**Bugs found and fixed**

| What | Where | Note |
|---|---|---|
| Every seeded phase row shared the id `ph-0NaN-…` | `lib/db/demo-store.ts` | `projectId.slice(3, 7)` read `"j-00"` → `NaN`. Now `slice(5, 9)`. Was harmless only because every lookup goes by `(project_id, phase)` — it would have failed the real PK |
| `<Select>` triggers showed raw ids (`cust-0001-…`, `admin`) | 4 call sites | Base UI needs `items` on the Root — see DECISIONS |
| Detail sheet rendered at 384px despite asking for 520px | `project-detail-sheet.tsx` | tailwind-merge variant-prefix trap — see DECISIONS |
| Empty columns were nearly undroppable; collapsed columns fully undroppable | `board-view.tsx` | `closestCorners` → layered strategy — see DECISIONS |
| Three hydration mismatches | login, board | See "SSR determinism" in DECISIONS |
| Cache Components validation errors on `/customers`, `/settings` | both pages | See NEXT |

**Features added**

- Inline customer creation in the New Project dialog (`createCustomerAction` now also `revalidatePath("/")`, or the board's own picker misses it)
- Calendar bar status labels, with a contrast rule and a width-fit tier
- Customer detail — Projects section padding now matches the contact block above it
- Seed grown 10 → **20 projects**, 4 → **8 customers**, covering states the original seed never produced

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
