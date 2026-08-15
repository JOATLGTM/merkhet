# Slice 11 — Planned hours per phase

Client request (2026-08-14): budget hours per project *per status* (SD, DD, CD, …).

Pulls the **planned** half of `WORKFLOW-2.md` §8 "Hours tracking" forward from Phase 2.
Confirmed with the client as *budgeted* hours, not logged time. Time entry, rates, and
invoicing remain Phase 2 and are still on the **Do not build** list.

## SQL

Apply `supabase/migrations/20260814100000_phase_planned_hours.sql` (hosted Supabase → SQL
editor, same as prior slices).

```sql
alter table public.project_phases
  add column if not exists planned_hours numeric(6, 1);
-- + planned_hours_non_negative check
```

Additive and idempotent. No backfill — existing rows land at `null`, which renders as an
empty input.

## Behavior

- Hours are set per phase in the project detail sheet, in the Phases grid alongside
  assignee and the planned dates (now a 4-column row).
- **Review takes no hours.** It is a pure gate — no delegate, no duration, no schedule time
  (`WORKFLOW-2.md` §3). The cell renders an em dash. The rule is `DELEGATED_PHASES` in the
  UI, deliberately *not* a DB constraint, so it can move without a migration.
- Changes are written to `activity_log` as `phase.hours_changed` — planned hours are a
  budget commitment, so "who changed 40 to 80" has to be answerable. (Contrast
  `updatePhaseDates`, which is not logged.)
- The section header totals planned hours across phases. It distinguishes **no hours
  planned** (nothing set anywhere) from **0 h planned** (explicitly zeroed).
- Negative values are rejected in the UI, the server action, and a DB check constraint.

## Retired in the same change

`projects.hours_per_week` is **removed from the detail sheet UI**. It predates this feature,
means something different (a weekly rate, not a phase budget), and reading both on one
screen gives two competing answers to "how many hours is this project". The column and the
`updateProjectFieldAction` case stay for the legacy values — nothing is dropped.

## Verify

1. Open any project → **Phases**. Each delegated row has an hours input; **Review** shows —.
2. Enter `40` on SD → blur → header reads `40 h planned`.
3. Add `24` on DD → header reads `64 h planned`.
4. Enter `-5` → rejected with a toast, input reverts.
5. Clear a value → header total drops; clearing all reads `No hours planned`.
6. **Activity** section shows `… planned 40h for Schematic design`.
7. Reload → values persist.

## Follow-on

Planned hours are per-phase delegation data, and so is `assignee_id` — both are what the
staff-grouped daily calendar (Slice 10) reads from. Slice 4 (Delegation) is still skipped,
so this data is entered by hand per project. How much of it actually exists is worth
checking before building a calendar view that depends on it.

---

**Status (2026-08-14):** Applied to hosted Supabase and verified. `planned_hours` present and
readable; `planned_hours_non_negative` rejects negatives at the DB. Typecheck + build clean.

## Delegation coverage at time of apply (2026-08-14)

Measured across 18 live (non-archived) projects, 108 phase rows:

| Phase | Assigned | Fully dated |
| --- | --- | --- |
| SD | 10/18 | 11/18 |
| DD | 6/18 | 8/18 |
| Review | 4/18 | 5/18 |
| CD | 3/18 | 4/18 |
| Final Review | 0/18 | 0/18 |
| Permitting | 1/18 | 3/18 |
| **Total** | **24/108 (22%)** | **31/108 (29%)** |

**8 of 18 live projects have no assigned phase at all.** This is the direct consequence of
Slice 4 (Delegation) being skipped — there is no step that forces assignee + duration to be
filled, so the data only exists where someone entered it by hand. Read this before building
Slice 10's staff-grouped mode: see `NEXT.md`.
