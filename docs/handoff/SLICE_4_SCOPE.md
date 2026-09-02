# Slice 4 — Delegation (scoped 2026-08-14)

Un-skips the slice dropped on 2026-08-12 as "not needed for current client direction."
The direction changed: Slice 10 (staff-grouped daily calendar) and Slice 11 (planned hours)
both read per-phase delegation data, and only 22% of it exists.

Supersedes the two-paragraph sketch in `CHANGES-2.md` (Slice 4 section, now bannered).
Authority was `WORKFLOW-2.md` §3 until 2026-09-02; dates are now typed in per phase —
`PHASE_DATES_APPLY.md`.

## What it is

One form. Assigns **person + duration** to the five delegated phases (SD, DD, CD, Final
Review, Permitting) in a single submission, and derives `planned_start` / `planned_end` from
the durations. Review is excluded — a pure gate, no delegate, no duration.

**Planned hours are on the form but optional.** See "Optionality" below.

Completing delegation is what makes the manual Active → SD move legal.

## Optionality — the rule

| Field | Required | Why |
| --- | --- | --- |
| Assignee | **Yes** | Staff-grouped calendar has nothing to group by without it |
| Duration | **Yes** | No duration → no derived dates → no calendar row. Structural |
| Planned hours | **No** | An annotation. Missing hours degrade gracefully |

Durations are required because the schedule cannot exist without them. Hours are a budget
annotation on top: absent, the calendar still draws and the project total reports "No hours
planned" — a state Slice 11 already renders distinctly from "0 h planned".

Forcing a number nobody has produces a guess that reads as authoritative six months later.
A null is more truthful. **Do not** default hours from `duration_days` — a phase can span
three weeks at four hours a week, and conflating the two re-creates the exact gap
`WORKFLOW-2.md` §8 flagged and the client just asked to close.

## Decisions

Settled here so they are not re-litigated mid-build. Each has a recommendation; flag before
deviating.

**1. Schedule anchor.** The form carries a "Schedule starts" date, defaulting to
`projects.start_date` if set, else today. Submitting writes it back to `start_date`. The
chain runs from there.

**2. Durations are working days.** `addBusinessDays` (date-fns 4.4, already a dependency).
A 10-day SD phase means two working weeks to an architect; calendar-day arithmetic lands it
on a Saturday. Uniform across all five phases — Permitting's "2–4 weeks" is entered as
10–20 working days rather than introducing a per-phase unit toggle.

**3. Review gets a zero-duration milestone.** `planned_start = planned_end =` DD's end date.
The calendar's `Math.max(width, 6)` already renders that as a 6px tick, which makes the gate
visible on the gantt rather than leaving a silent gap between DD and CD. The alternative
(null dates) is also defensible — pick one and note it.

**4. "Delegation complete" is derived, not stored.** All five delegated phases have both
`assignee_id` and `duration_days`. Hours are excluded from the check — that is the
optionality. No `delegated_at` column: a derived predicate cannot drift from the data it
describes.

**5. The form is a dialog, not a route.** `CHANGES.md` said "new screen," but a dialog
matches `new-project-dialog.tsx` and the Mark Complete modal, avoids a route, and — the
deciding factor — can be reopened from the detail sheet at any phase, which the backfill
path needs.

**6. Re-planning recomputes only `not_started` phases.** Changing a duration must never
re-date a phase that has already been worked. Completed and in-progress phases keep their
dates; the chain re-anchors at today for the current phase. Slice 5's rejection loops need
exactly this recalculation, so it is shared groundwork, not throwaway.

## Schema

**No new columns.** `assignee_id`, `duration_days`, `planned_hours` all exist;
completeness is derived per decision 4.

One migration, replacing `move_project` to add the Active → SD gate — same shape as
`20260812140100_pending_contract_gate.sql`, which is the precedent for gating inside the
function:

```sql
-- Active → any phase requires delegation on all five delegated phases.
if from_column = 'active' and is_phase then
  if exists (
    select 1 from public.project_phases
    where project_id = p_project_id
      and phase <> 'review'
      and (assignee_id is null or duration_days is null)
  ) then
    raise exception 'Assign a person and duration to every phase before starting work';
  end if;
end if;
```

Enforcing in the function means **drag and ⌘K both inherit it** — `board-view.tsx:339` and
`command-palette.tsx:130` already surface a thrown error as a toast. No client-side
duplication.

## Work

| # | Item | Files |
| --- | --- | --- |
| 1 | Date derivation helper — durations → dates, business days, skip Review, recompute `not_started` only | `lib/dates.ts` (new fn) |
| 2 | `saveDelegation(projectId, entries, anchorDate, actorId)` — one transaction, writes 5 phase rows + `start_date`, logs `project.delegated` | `lib/db/repo.ts` |
| 3 | Server action | `app/actions/projects.ts` |
| 4 | Delegation dialog — 5 rows × (assignee, duration, hours), anchor date, live preview of derived dates | `components/projects/delegation-dialog.tsx` (new) |
| 5 | Auto-raise on entry to Active; **"Plan schedule"** button on the detail sheet at any phase | `components/projects/project-detail-sheet.tsx` |
| 6 | Migration: `move_project` + Active→SD gate | `supabase/migrations/2026…_delegation_gate.sql` |
| 7 | Activity copy for `project.delegated` | `lib/activity.ts` |
| 8 | Lock the manual date inputs — **last**, see sequencing | `project-detail-sheet.tsx:756+` |

**Sequencing matters on 8.** Locking manual date entry before the backfill path (item 5)
exists would strand the 18 live projects with no way to set dates at all. Form and backfill
first, lock last.

## Backfill — the 18 existing projects

The form is raised on entry to Active. **Every live project is already past that point**, so
as originally specified this slice fixes only new projects and leaves coverage at 22%
forever. This is the part the original sketch missed and the reason the calendar work needs
it.

The "Plan schedule" button (item 5) is the fix: reachable from the detail sheet in any
phase. Applied to a mid-flight project it assigns all five phases but only re-dates the
`not_started` ones, per decision 6.

Coverage at time of writing — see `SLICE_11_APPLY.md` for the full table:

- 24/108 phase rows assigned (22%), 31/108 fully dated (29%)
- 8/18 live projects have no assigned phase at all
- Final Review: 0 assigned, 0 dated, anywhere

## Verify

1. Project in Pending with a contract → drag to Active → delegation dialog raises.
2. Submit with a missing duration → rejected inline.
3. Submit with **all hours blank** → accepted. Detail sheet reads "No hours planned".
4. Derived dates appear on all five phases; Review shows a zero-width milestone at DD's end.
5. No weekend start or end dates anywhere in the chain.
6. Drag Active → SD on an undelegated project → toast, no move. Same via ⌘K.
7. Delegate it, retry → moves.
8. Existing mid-flight project (e.g. one in CD) → "Plan schedule" → completed phase dates
   unchanged, downstream dates recomputed.
9. Change one duration → re-plan → only downstream `not_started` phases shift.
10. Activity feed shows `project.delegated`.

## Do not build

- **Hours as a required field.** The point of this scoping.
- **Hours defaulted from duration.** See Optionality.
- **Rates, fee calculation, or hours → cost.** Still Phase 2 (`WORKFLOW-2.md` §8).
- **A `delegated_at` column or any stored completeness flag.** Decision 4.
- **Per-phase duration units.** Decision 2.
- **Notification on delegation completion.** Not in `WORKFLOW-2.md` §4. Entry to SD already
  notifies; that is Slice 6's job.
- **Re-dating completed or in-progress phases.** Decision 6.

## Follow-on, not this slice

**Prompt for hours at phase entry.** The strongest fix for "nobody knows the hours in
January": ask the delegate when the phase actually starts, in the same moment they are
notified. Small, and it depends on Slice 6. Worth doing once notifications exist — it turns
optional-and-often-blank into optional-and-usually-filled.

## Estimate

~2–3 days. The date derivation (item 1) is the only real thinking; the rest is form plumbing
against schema that already exists.

---

**Status (2026-08-14):** Scoped, not started. Blocking question for the client is not in this
slice — see `NEXT.md` on what the hours number is *for*, which changes Slice 10's design.
