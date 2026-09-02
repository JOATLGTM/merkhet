# Explicit phase dates — typed in, not chained

Decided 2026-09-02. Each delegated phase carries its own start and end, entered by hand, in
Plan schedule and on the sheet's phase row. Until now the dates were derived: a project
start plus per-phase working-day durations, chained back to back, and the inputs were
read-only on purpose (WORKFLOW-2 §3, SLICE_4_SCOPE decisions 1–6). That model assumed the
phases follow each other with no gap. They do not — the person holding Schematic design is on
other projects between it and Design development — so a project starting 9/10 needs to be
able to carry SD on 9/20–9/26, and the chain could not say that.

## What changed, in one paragraph

Dates are the schedule. `duration_days` stays as a derived value — the working-day count of
the span — written on every save, so everything that reads a duration (`move_project`'s
Active → SD gate, `isDelegationComplete`, the workload rate) is untouched. The chain
survives as a **Fill back to back** button in the dialog and as an opt-in reflow on gate
rejection. Review is still not typed in: it is the milestone on the end of Design development
and follows DD wherever DD goes. Rejecting a gate no longer re-dates anything unless asked.

## SQL — UNCONFIRMED (constraints are invisible through PostgREST; run it if in doubt)

`supabase/migrations/20260902110000_phase_dates.sql`. Two check constraints on
`project_phases`, no data change:

- `planned_end >= planned_start` when both are set
- both set or both null

Every existing row came out of the chain and already satisfies both. Idempotent. Independent
of the other pending migrations.

**Deploy order:** either. The app validates the same rules before writing, so old data and
new code, or new data and old code, both behave.

### Verify

Open a project, **Plan schedule**:

1. Set the project start to 9/10 and Schematic design to 9/20–9/26. Days should read 5.
   Save. The sheet's phase row should show 9/20–9/26, not 9/10–9/16.
2. Move Design development's end. The Review row should follow it.
3. Type 10 into Days on an undated phase with a start: the end fills in ten working days on.
4. Press **Fill back to back**: every not-started phase with a Days value chains from the
   project start. Phases already in progress or completed do not move.
5. On the sheet, edit a start date and tab out: it saves; a lone date turns redline and does
   not.
6. Reject a gate with the checkbox off: dates unchanged. With it on: the not-started phases
   re-plan from today, the old behaviour.

`npm run check:schedule` covers `businessDaysBetween`, `endOfSpan`, `phaseDateError` and
`reviewMilestone`, and that chain → count round-trips.

## Where it lives

| Concern | File |
|---|---|
| Helpers | `businessDaysBetween`, `endOfSpan`, `phaseDateError`, `reviewMilestone` in `lib/dates.ts`; `deriveSchedule` stays as the fill/reflow |
| Dialog | `components/projects/delegation-dialog.tsx` — Start / End / Days / Hours per phase, Days ↔ dates kept consistent both ways, **Fill back to back** |
| Sheet cells | `components/projects/phase-dates.tsx` — two date inputs, save on blur, refuse half a pair |
| Save (dialog) | `saveDelegation` in `lib/db/repo.ts` — writes dates as sent, `duration_days` as the count, Review from DD's end |
| Save (sheet) | `updatePhaseDates` — validates, recounts `duration_days`, moves Review when DD moves, logs `phase.dates_changed` |
| Rejection | `rejectGate(…, reflow = false)`; the sheet's reject dialog has the checkbox |
| Constraints | `20260902110000_phase_dates.sql` |
| Checks | `scripts/check-schedule.ts` (pure); `scripts/check-gates.ts` exercises the reflow path against the live DB |

## Decisions baked in

- **Half-dated is refused; undated is fine.** Every consumer treats one date as no dates, so
  saving a lone date would silently discard the other. `phaseDateError` is the one place that
  rule lives; the dialog, the sheet cells, the repo and the SQL all agree with it.
- **Weekends still do not start or end a phase.** A span with no working day is refused, and
  a Saturday start typed into Days is pushed to Monday by `endOfSpan`.
- **Worked phases are editable.** Locking was the chain's way of not moving history. With
  explicit dates, moving an in-progress end is an ordinary correction. The fill still skips
  them, and a Review already reached keeps its date.
- **Rejection defaults to keeping dates.** The reflow is offered, off, because a plan
  somebody typed must not vanish because a reviewer clicked Reject.
- **`projects.start_date` remains** as the project start — the anchor for the fill and the
  calendar's fallback extent. It no longer floors anything a person types.

## Things that are still true

- **`check:gates` writes to the hosted database** and mirrors the reflow path only. It does
  not test the keep-dates default.
- **The calendar draws whatever the dates say.** Gaps between phases now appear as gaps.
  Overlapping phases on one project are allowed and draw overlapping — there is no rule
  against it and nobody asked for one.

## Not verified in a browser

Typechecks, lints at baseline, builds; `npm run check` passes with the new assertions. No
date has been typed into the real app.
