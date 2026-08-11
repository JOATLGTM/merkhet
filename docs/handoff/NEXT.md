# Next / open gaps

Not committed as a formal backlog — use as a resume checklist.

## Likely next

1. **Wire real Supabase** — swap `lib/db/repo.ts` from demo store to `lib/supabase/*`; apply migration; Auth instead of cookie demo. Still the blocker under everything else: nothing persists today.
   - When the migration runs, confirm the `ph-…` id fix landed — the old seed put every phase row on one id, which the real PK would reject.
2. **Polish pass vs Lovable** — pixel-diff board cards, settings Active column UX. *(detail sheet width and customer-detail padding done Aug 10.)*
3. **PRD gaps still soft** — client-updates Phase 2 (`/client-updates`), email notifications on phase change, RLS verification against live DB.
4. **Git** — work may still be largely uncommitted; check `git status` before assuming history.

## Known gaps against PRD §12.6

- **No `KeyboardSensor` on the board.** `board-view.tsx` registers `PointerSensor` only, so drag is mouse/touch-only — §12.6 requires the board to be usable end to end by keyboard, "including drag via dnd-kit's keyboard sensor". The collision strategy already has the non-pointer fallback in place, so adding the sensor should be self-contained.
- Remaining §12.6 criteria (focus rings, Motion bundle under 20KB gzipped) have not been audited.

## Cache Components / instant navigation

Validation (dev overlay only — routes still return 200) flags any segment reading `cookies()`/`headers()`/`params`/`searchParams` outside `<Suspense>`.

Current state per segment:

| Segment | State | Why |
|---|---|---|
| `(auth)/layout.tsx` | `instant = false` | cookie-authenticated |
| `(app)/layout.tsx` | `instant = false` | `getSessionUser()` in the shell |
| `(app)/settings/page.tsx` | `instant = false` | admin gate reads the session cookie; rarely navigated, blocking is fine |
| `(app)/customers/page.tsx` | validates clean | `?new=1` moved to `useSearchParams()` in `CustomersClient`, behind `<Suspense>` |

**Still open:** `(app)/page.tsx` (board) and `(app)/customers/[id]/page.tsx` both `await getSessionUser()` / `searchParams` in the page body. Per PRD §9.2 the real fix is `"use cache: private"` with `stale >= 5m` so the shell can carry session-dependent content — that belongs with the **real Supabase Auth wiring**, not the demo cookie. Do not blanket-apply `instant = false` to every page; that switches off the feature the PRD chose Next 16 for (§9).

## Known quirks

- Demo store resets only when the Node process restarts (or `resetDemoStore()`). **Editing the seed is not enough — hot reload keeps the old data**, because the store lives on a process global (`__merkhetDemoV2`).
- Seed dates are anchored to a **2026-08-10 "today"**. The amber (within 14 days) and redline (overdue) cases drift as the real date moves past them; re-anchor if those states stop appearing.
- Hydration errors only come from a real browser — `curl` returns 200 on a page that is throwing them. Check `.next/dev/logs/next-development.log` or the dev overlay.
- Cache Components insights behave the same way: the route still returns 200, the insight only shows in the overlay / dev-server log.
- Calendar zoom key: `merkhet.calendar.zoom`; board collapsed columns: `merkhet-board-collapsed`.
- Staff login is `dana@merkhet.studio` (showcase name); older docs mentioning `sana@` are stale.
- `AGENTS.md` / Next agent rules: prefer reading `node_modules/next/dist/docs/` for this Next version.

## When changing UI

- Prefer matching [Lovable showcase](https://pixel-perfect-showcase-001.lovable.app/) for visuals.
- Prefer PRD if showcase behavior conflicts (e.g. column model, hold semantics, calendar degradation rules).
