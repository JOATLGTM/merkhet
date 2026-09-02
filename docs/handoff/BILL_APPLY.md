# Bill — the hours on each project, by person

Decided 2026-09-01, revised the same day. The **Bill** page (`/bill`, everyone) shows the
hours already on each project's phases — `project_phases.planned_hours`, the number set in
Plan schedule — regrouped by project and by the person holding the phase.
It reads; it does not write. **No SQL.**

The first cut had a timesheet: a `time_entries` table and a "Log hours" form. It was the
wrong reading and was removed before it was committed. The firm bills from the hours that
are already on the project, and wanted them easier to *see*, not another place to type them.

**Its migration had already been run** against hosted Supabase on 2026-09-01, so
`20260902100000_drop_time_entries.sql` took the empty table back out (applied — the table
is absent as of 2026-09-02). It also explains the gap in the migration sequence.

## What the page shows

- **A project group per project**, most hours first, with the customer name and the total.
- **A row per person inside it** — the phase assignee — with their total and a count of
  phases they hold that have no hours. Expanding the row lists the phases: name, status,
  dates, planned hours.
- **Unassigned** appears as its own row when a phase with hours has nobody on it.
- **Totals across the selection** at the top, plus per-person chips.
- **Filters:** project (the sheet's **Hours** button lands here with one preselected), person
  (including *Unassigned phases*), and an *Include completed* toggle that is on by default —
  billing usually happens after the work left the board.
- No export. A CSV button shipped on 2026-09-01 and was removed the next day at the firm's
  request; the page is for looking, not for handing off.

## The honesty rule, carried over

DECISIONS.md, *What planned hours are for*: **not planned is never `0h`, in any view.** So:

- A phase with no hours renders **Not planned** in redline, never a number.
- Every total counts only the phases that carry a budget and shows how many do not. When any
  are missing, the headline label switches from **Total** to **At least**, and a line under
  it says how many phases have no hours and where to set them.
- Review never appears: it is a gate — no person, no hours (WORKFLOW-2 §3).

## Where it lives

| Concern | File |
|---|---|
| Arithmetic (pure) | `lib/billing.ts` — `phaseRows`, `filterRows`, `rollup`, `hoursByPerson` |
| Check | `scripts/check-billing.ts` (`npm run check:billing`, inside `npm run check`) |
| Route | `app/(app)/bill/page.tsx` → `components/billing/bill-client.tsx` |
| Nav | `Bill` link in `components/shell/nav-rail.tsx`, everyone |
| From a project | **Hours** button in the sheet header → `/bill?project=<id>` |
| The data | `project_phases.planned_hours` / `assignee_id`, already hydrated on `ProjectWithRelations` |

Nothing in `lib/db/repo.ts` changed. The page loads `listProjects()`, `listCompletedProjects()`
and the whole roster (`listUsers(false)`, so a deactivated colleague still holding a phase is
named rather than shown as *Former colleague*).

## Decisions baked in

- **Read-only.** Hours change in Plan schedule or on the sheet's phase row, where they always
  have. A second editor for the same column would be a second place for it to be wrong.
- **Sums round once, to one decimal**, matching `numeric(6,1)`. Ties sort by id so nothing
  reorders between renders.
- **The developer** (`DEVELOPER_ROLE_APPLY`) is not in the roster, so a phase they hold would
  read *Former colleague*. They are not meant to hold phases.

## Not verified in a browser

Typechecks, lints at baseline, builds; `npm run check` passes with the new module. Nobody has
opened `/bill` against real data.
