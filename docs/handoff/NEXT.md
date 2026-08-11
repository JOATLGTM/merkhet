# Next / open gaps

Not committed as a formal backlog — use as a resume checklist.

## Likely next

1. **Wire real Supabase** — swap `lib/db/repo.ts` from demo store to `lib/supabase/*`; apply migration; Auth instead of cookie demo.
2. **Polish pass vs Lovable** — pixel-diff board cards, detail sheet spacing, settings Active column UX, customer detail page.
3. **PRD gaps still soft** — client-updates Phase 2 (`/client-updates`), email notifications on phase change, RLS verification against live DB.
4. **Git** — work may still be largely uncommitted; check `git status` before assuming history.

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

- Demo store resets only when the Node process restarts (or `resetDemoStore()`).
- Calendar zoom key: `merkat.calendar.zoom`; board collapsed columns: `merkat-board-collapsed`.
- Staff login is `dana@merkat.studio` (showcase name); older docs mentioning `sana@` are stale.
- `AGENTS.md` / Next agent rules: prefer reading `node_modules/next/dist/docs/` for this Next version.

## When changing UI

- Prefer matching [Lovable showcase](https://pixel-perfect-showcase-001.lovable.app/) for visuals.
- Prefer PRD if showcase behavior conflicts (e.g. column model, hold semantics, calendar degradation rules).
