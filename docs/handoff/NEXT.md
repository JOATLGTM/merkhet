# Next / open gaps

Not committed as a formal backlog — use as a resume checklist.

**Last updated: 2026-08-12**

## Likely next (workflow slices)

See [`CHANGES-2.md`](./CHANGES-2.md) status table. Open product slices:

1. **Slice 5 — Approval gates + rework loops** (Review / Final Review sign-offs; reject → prior phase). Highest risk; depended on 4, but 4 was skipped — confirm whether gates can ship without full delegation.
2. **Slice 6 — Notifications** — replace stubs in `lib/notifications.ts`.
3. **Slice 3 — Intake form expansion** — on hold until client clarifies fields/labels.
4. **Slice 9 — Staff workload view** — confirm need; distinct from `/staff` (team + subscribers admin page).
5. **Slice 10 — Calendar** — blocked on Austin (day resolution / staff grouping).

**Skipped / not building now:** Slice 4 Delegation.

## Polish / engineering

- Pixel-diff vs Lovable where still soft; Staff page Active-column UX
- Client-updates Phase 2 (`/client-updates`); client-facing email on phase entry (deferred in WORKFLOW)
- RLS audit against live DB
- **Git** — large uncommitted set; commit when asked
- Board: add dnd-kit `KeyboardSensor` (PRD §12.6)

## Cache Components / instant navigation

Validation (dev overlay) flags `cookies()` / `connection()` / uncached fetches outside `<Suspense>`.

| Segment | State |
|---|---|
| `(auth)/layout.tsx`, `(app)/layout.tsx` | `instant = false` |
| `(app)/staff/page.tsx` | `instant = false` (admin gate) |
| Consultants / Completed | data fetch inside `<Suspense>` |
| Board / customer detail | still denser; prefer Suspense over blanket `instant = false` |

## Known quirks

- After `.env` changes: **restart** `npm run dev`
- Env prefers `*_MERKET_*` names; legacy `NEXT_PUBLIC_SUPABASE_URL` etc. still fall back
- Seed dates anchored ~2026-08-10 — amber/redline urgency drifts
- Hydration / Cache insights: check browser overlay, not `curl` alone
- Calendar zoom: `merkhet.calendar.zoom`; board collapse: `merkhet-board-collapsed`
- Theme preference: `localStorage` via `next-themes` (default **dark**)

## When changing UI

- Prefer [Lovable showcase](https://pixel-perfect-showcase-001.lovable.app/) for visuals
- Prefer PRD / WORKFLOW-2 when behavior conflicts
