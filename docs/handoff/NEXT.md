# Next / open gaps

Not committed as a formal backlog — use as a resume checklist.

## Likely next

1. **Wire real Supabase** — swap `lib/db/repo.ts` from demo store to `lib/supabase/*`; apply migration; Auth instead of cookie demo.
2. **Polish pass vs Lovable** — pixel-diff board cards, detail sheet spacing, settings Active column UX, customer detail page.
3. **PRD gaps still soft** — client-updates Phase 2 (`/client-updates`), email notifications on phase change, RLS verification against live DB.
4. **Git** — work may still be largely uncommitted; check `git status` before assuming history.

## Known quirks

- Demo store resets only when the Node process restarts (or `resetDemoStore()`).
- Calendar zoom key: `merkat.calendar.zoom`; board collapsed columns: `merkat-board-collapsed`.
- Staff login is `dana@merkat.studio` (showcase name); older docs mentioning `sana@` are stale.
- `AGENTS.md` / Next agent rules: prefer reading `node_modules/next/dist/docs/` for this Next version.

## When changing UI

- Prefer matching [Lovable showcase](https://pixel-perfect-showcase-001.lovable.app/) for visuals.
- Prefer PRD if showcase behavior conflicts (e.g. column model, hold semantics, calendar degradation rules).
