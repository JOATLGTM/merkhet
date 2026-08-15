# Merkhet session handoff

**Read this folder first** when starting a new agent session on Merkhet.
Start with [NEXT.md](./NEXT.md) — it opens with the resume state.

| File | Purpose |
|---|---|
| [NEXT.md](./NEXT.md) | **Start here.** Resume state, immediate actions, open questions |
| [CURRENT_STATE.md](./CURRENT_STATE.md) | What works today, how to run, env, slice status |
| [CHANGES-2.md](./CHANGES-2.md) | Workflow slice plan + status |
| [WORKFLOW-2.md](./WORKFLOW-2.md) | Authoritative workflow (phases, gates, notifications) |
| [DECISIONS.md](./DECISIONS.md) | Authority order, design refs, non-negotiables |
| [FILE_MAP.md](./FILE_MAP.md) | Where code lives |
| [SLICE_4_SCOPE.md](./SLICE_4_SCOPE.md) | Delegation spec — six settled decisions, build from this |
| [SLICE_5_APPLY.md](./SLICE_5_APPLY.md) | Approval gates + rework loops — gate table, rework checklist |
| `SLICE_*_APPLY.md` | Manual SQL / verify checklists per slice |

## State as of 2026-08-14

Four slices were built: **11** (planned hours per phase), **4** (delegation), **10** (calendar:
day resolution + staff grouping) and **5** (approval gates + rework loops). All three
migrations are **applied and verified against hosted Supabase**; Slice 10 needed no SQL. The
calendar and the approvals UI have both had a visual pass.

**Committed as `f8d0526`** (local only, not pushed). File list in [NEXT.md](./NEXT.md).

Slice 5 also fixed a **pre-existing `move_project` bug** that had been shipping — an unordered
phase loop could leave two rows `in_progress` at once and trip
`one_active_phase_per_project`, showing up as an intermittent failed drag on longer-lived
projects. [SLICE_5_APPLY.md](./SLICE_5_APPLY.md) §3a.

Nothing built that day is outstanding. Next up is **Slice 6 (notifications)**, half of which is
blocked on DNS for the sending domain.

**Product requirements (authoritative for non-workflow):** [`../PRD.md`](../PRD.md)  
**System design reference:** [`../SYSTEM_DESIGN_REFERENCE.md`](../SYSTEM_DESIGN_REFERENCE.md) — general reference, **not** Merkhet architecture.  
**Prior Cursor chat:** [Merkhet MVP build](4683eef9-6229-44ff-957a-96f80cda6207) (agent transcript id)

## Traps that have already cost time

Each is written up in [DECISIONS.md](./DECISIONS.md). Read them before touching the relevant area:

- `components/ui/*` are **Base UI, not Radix** — `<SelectValue />` renders raw values without `items` on the Root
- tailwind-merge keys on the **full variant prefix**, so `sm:max-w-*` does not override `data-[side=right]:sm:max-w-*`
- `<LazyMotion strict>` at the root — `motion.*` throws, use `m.*`
- Seed / `.env` changes need a **process restart**, not a hot reload
- Hydration and Cache Components errors never appear in a `curl` — the route still returns 200
- Uncached Supabase reads must sit inside `<Suspense>` — and *inside* means in a child that
  suspends. An `await` in the default export resolves before the boundary is reached, so a
  `<Suspense>` further down does nothing. This bit four routes on Aug 14; see NEXT.md
- Phase dates are **derived from durations**, never hand-entered (WORKFLOW-2 §3) — the
  inputs are read-only on purpose; edit via Plan schedule
- Planned hours are **optional** by design; assignee and duration are not
  (`SLICE_4_SCOPE.md`). Do not make hours required, and do not default them from duration
- Approval rows exist **only when approved** — absence is pending, clearing is a `DELETE`.
  Never seed pending rows
- Rejection is `reject_gate`, **not** `move_project` — the latter marks the phase being left
  `completed`, the opposite of what a rejection means
- `npm run check:gates` **writes to hosted Supabase** (one throwaway project, deleted after).
  It is not part of `npm run check` for that reason

Last updated: 2026-08-14
