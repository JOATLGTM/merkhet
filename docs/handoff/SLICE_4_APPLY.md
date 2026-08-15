# Slice 4 — Delegation

Built to `SLICE_4_SCOPE.md`. All six decisions in that document were implemented as written;
none were deviated from.

## SQL

Apply `supabase/migrations/20260814120000_delegation_gate.sql` (hosted Supabase → SQL
editor).

Replaces `move_project` in full — same house pattern as
`20260812140100_pending_contract_gate.sql`, which it is derived from. **It carries the
Pending-contract gate forward**, so applying it does not regress Slice 2. The only addition:

```sql
if from_column = 'active' and is_phase then
  if exists (
    select 1 from public.project_phases pp
    where pp.project_id = p_project_id
      and pp.phase <> 'review'
      and (pp.assignee_id is null or pp.duration_days is null)
  ) then
    raise exception 'Plan the schedule first — every phase needs a person and a duration';
  end if;
end if;
```

**No new columns.** `assignee_id`, `duration_days`, `planned_hours` all already exist.

## Behavior

**The dialog.** Five rows — assignee, duration in working days, planned hours — plus a
"Schedule starts" anchor date. Derived dates preview live as you type, so the schedule is
visible before saving. Review appears only as a footnote showing its milestone date.

**Hours are optional.** Save is enabled with every hours field blank; it is disabled only
when a person or duration is missing, and the footer names the phases still short. Total
reads "No hours planned" when nothing is set.

**Raised on entry to Active.** The board opens the project sheet after a successful move to
Active, and the sheet raises the dialog when planning is incomplete. One mechanism covers
drag, ⌘K, and contract-upload → Active. It raises once per project, so dismissing sticks.

**"Plan schedule" button** on the detail sheet at any phase — red when unplanned, and reads
"Re-plan schedule" once complete. This is the backfill path for existing projects.

**Re-planning is safe.** Phases that are not `not_started` keep their dates; only the
remainder is re-dated. The dialog marks those rows `kept`. Assignees and hours are written
for every phase regardless — delegation records who owns the work even where it is done.

**Manual date entry is gone.** The two date inputs in the Phases grid are now read-only
displays (WORKFLOW-2 §3: durations are the source, dates are derived).
`updatePhaseDatesAction` is off the UI path; the action and repo function remain.

## Date arithmetic

`deriveSchedule` in `lib/dates.ts`. Covered by `npm run check:schedule` — 15 assertions,
all passing:

- Durations are **working days**, inclusive: 10 days from Mon 17 Aug ends Fri 28 Aug
- The next phase resumes the following business day
- No phase starts or ends on a weekend; a weekend anchor pushes to Monday
- Review is a zero-width milestone on the preceding phase's end
- CD picks up after DD, not after Review — the gate consumes no time
- Locked phases are not re-dated and the chain resumes after them
- A locked phase with no end date does not derail the chain
- A missing duration emits no dates and the chain continues past it

Worth running after any change to the derivation — it is the only real logic in the slice.

## Partial-write behavior

supabase-js has no client-side transaction, so `saveDelegation` writes sequentially. A
failure mid-write leaves the project *incompletely* delegated, which the gate reads as "not
delegated" and blocks. **It fails closed.** This is a direct benefit of decision 4 — a
derived completeness predicate cannot disagree with the rows.

## Verify

1. Pending project with a contract → drag to Active → sheet opens, dialog raises.
2. Clear one duration → Save disabled, footer names the phase.
3. Leave **all hours blank** → Save enabled. Detail sheet reads "No hours planned".
4. Save → all five phases show derived dates; Review shows a milestone at DD's end.
5. No weekend dates anywhere in the chain.
6. Undelegated project, drag Active → SD → toast, no move. Repeat via ⌘K.
7. Delegate it, retry → moves.
8. Mid-flight project (e.g. in CD) → "Re-plan schedule" → worked phases show `kept` and
   their dates are unchanged; downstream dates shift.
9. Phases grid date fields are read-only.
10. Activity feed shows "planned the schedule across 5 phases".

## Not built

Per scope: hours required, hours defaulted from duration, `delegated_at` column, per-phase
duration units, delegation-completion notification, re-dating worked phases.

**Follow-on:** prompt for hours at phase entry (needs Slice 6). The strongest fix for
"nobody knows the hours in January" — ask the delegate the week the phase starts.

---

**Status (2026-08-14):** Applied and verified. Typecheck, lint, build, and `check:schedule`
clean.

Verified against the hosted DB (both tests expect rejection, so nothing was mutated):

- **Delegation gate live** — `move_project(MK-0420, 'schematic_design')` on an undelegated
  Active-holding project raised "Plan the schedule first".
- **No Slice 2 regression** — `move_project(MK-0400, 'active')` without a contract still
  raised "Upload an LOI or contract". Replacing the function carried the Pending gate
  forward intact.

**0/18 live projects currently satisfy the gate**, which is expected — nothing has been run
through Plan schedule yet. Note this does **not** strand anything: the gate fires only on
`from_column = 'active'`, so projects already in SD/DD/CD/etc. continue to move
phase-to-phase as before. Only the Active → first-phase step is gated.
