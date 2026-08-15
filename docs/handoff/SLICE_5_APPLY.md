# Slice 5 — Approval gates + rework loops (apply notes)

**Built 2026-08-14. Migration applied and verified against hosted Supabase.**
All 50 assertions in `npm run check:gates` pass.

Sign-offs at Review and Final review, and a Reject path that sends the project back a phase
for rework. Authority: `WORKFLOW-2.md` §3 (who signs off) and §4 (who gets told). Design
decisions live in `DECISIONS.md`; the ones specific to this slice are restated at the bottom.

## 1. Apply the migration

`supabase/migrations/20260814160000_approval_gates.sql` → Supabase SQL editor, run whole file.

It replaces `move_project` wholesale (house pattern) and adds `reject_gate`. The replacement
carries forward the Slice 2 Pending-contract gate and the Slice 4 delegation gate unchanged —
**both need re-verifying after it lands**, since they now live in a rewritten function.

No new tables: `project_approvals` already exists from `20260812130100_workflow_1b.sql`, with
the `unique (project_id, phase, party)` the upsert depends on.

## 2. Verify

```bash
npm run check:gates
```

`scripts/check-gates.ts` automates everything below against the **hosted** database. It signs
in as `chris@merkhet.studio` with the anon key — not the service role, because `move_project`
and `reject_gate` are `security invoker` and granted to `authenticated`, which `service_role`
is not a member of. It creates **one throwaway project**, drives it through every scenario, and
deletes it (cascade) in a `finally`. It touches no existing project, but it does write to
production and it burns a `project_number_seq` value per run — which is why it is deliberately
**not** part of `npm run check`.

The manual equivalents follow, for when you want to see it on the board.

### Gate crossing is blocked

Crossing test is `from <= gate < to` with 1-based phase positions (Review = 3, Final review = 5).
That blocks *skipping* a gate as well as leaving one.

| Move | Expected |
|---|---|
| Review → CD, no sign-offs | blocked — "Review needs all three sign-offs…" |
| Review → CD, 3 sign-offs | allowed |
| **DD → CD** (skips Review) | blocked |
| Active → CD | blocked (Review not signed) |
| Active → SD | allowed (no gate crossed) |
| Final review → Permitting, no sign-offs | blocked — "Final review needs both sign-offs…" |
| **CD → Permitting** (skips Final review) | blocked |
| CD → Final review | allowed |
| any backward move | allowed — gates only guard forward moves |

Carried-forward gates to re-check: Pending → Active without a contract PDF (blocked), and
Active → SD on an undelegated project (blocked, "Plan the schedule first…").

### The rework loop, run twice on the same project

Run it **twice**, not once — phase history and date recalculation both have to survive a repeat.

1. Get a project to Review with all three sign-offs recorded, confirm it moves to CD.
2. Drag it back to Review. Sign-offs from pass 1 are gone (rejection deletes them; so does
   re-entering the gate cleanly — the rows only ever describe the current pass).
3. Reject. Expect: project at **Design development**, DD `in_progress`, Review `not_started`
   (*not* `completed` — that is why rejection is its own SQL function), sign-offs cleared,
   an `activity_log` `gate.rejected` row and a backward `phase_transitions` row.
4. Dates: completed phases keep theirs. DD is re-dated **from today** and everything after it
   chains off that. Nothing lands in the past.
5. Repeat 1–4. Second pass must behave identically, with the anchor being the new today.

### Sign-off UI

Detail sheet, above Details, visible only when the board column is Review or Final review:
3 parties at Review (client contact, Austin, client), 2 at Final review (client contact,
Austin). Each row records or clears; the copy states that the client's sign-off is recorded by
staff on the client's behalf. Reject sits at the bottom behind a confirm modal.

### Scripts

```bash
npm run check:schedule   # 28 assertions (15 pre-existing + 13 for the floor / rework)
npm run check            # + calendar — pure arithmetic, no database
npm run check:gates      # 50 assertions against hosted Supabase (writes, then cleans up)
```

## 3. Decisions specific to this slice

- **Approval rows exist only when approved.** Absence *is* pending; clearing is a `DELETE`.
  No pending rows are ever seeded. `ProjectWithRelations.approvals` therefore only ever holds
  approved rows.
- **Rejection is `reject_gate`, not `move_project`.** `move_project` marks the phase being left
  as `completed`, which is exactly wrong for a rejection — a rejected gate returns to
  `not_started` because it will be entered again.
- **`reject_gate` is atomic in SQL; dates are recomputed in TypeScript afterwards**, because
  `deriveSchedule` lives there. If the date step fails the project is still correctly rejected
  with stale dates, which "Re-plan schedule" fixes.
- **`anchor` in `deriveSchedule` is a floor, not a fallback** — a computed start earlier than
  the anchor is pulled forward to it, so rework is never scheduled into the past.
- **Re-dating locks `completed` and `skipped`, not `in_progress`.** The phase being returned to
  is in progress precisely because it is being reworked, so it must re-date from today. A
  skipped phase is locked because it will never be worked — re-dating it would give it a fresh
  future window and push the rework out behind it.

## 3a. Bug found by the live check: `move_project` could trip the phase index

**Pre-existing, not introduced by Slice 5** — but fixed in this migration, since it now owns
`move_project`, and it was blocking verification.

The phase-transition block was a single `for ph in select * from public.project_phases where
project_id = ...` loop with **no `ORDER BY`**. Inside it, the branch for the target phase sets
`status = 'in_progress'` and a later branch sets the outgoing phase to `'completed'`. When the
sequential scan handed back the target row *first*, two rows were `in_progress` at the same
instant and the partial unique index `one_active_phase_per_project` raised:

```
duplicate key value violates unique constraint "one_active_phase_per_project"
```

Physical row order changes as tuples are rewritten by updates, which is why this stayed hidden:
the first few moves on a fresh project happen to scan in a favourable order, and it only starts
firing once the phase rows have been updated a few times. In the live run it appeared on the
4th forward move and every move after it. On the board it would read as a drag that bounces back
with a raw Postgres error in the toast, intermittently, on longer-lived projects.

`reject_gate` never had the bug — it releases in-progress rows in a separate statement first,
and its comment says why. `move_project` was simply never given the same treatment.

The loop is now three ordered set-based statements: release the outgoing phase → mark skipped
phases → claim the target. Behaviour is otherwise identical.

## 4. Two fixes made while finishing the slice

Both were latent gaps rather than changes of direction, and both are covered by new assertions
in `scripts/check-schedule.ts`:

- `lib/dates.ts` — the zero-width Review milestone did not respect the floor. With every phase
  before it locked and stale, it landed in the past. Now floored like every other phase.
- `lib/db/repo.ts` `rejectGate` — `skipped` phases were not locked, so a rework behind a skipped
  phase was pushed out by that phase's full duration.

## 5. Not done here

`lib/notifications.ts` gained `notifyGateRejected`, still a console stub like its neighbour.
Recipient is the delegate of the phase being returned to (WORKFLOW-2 §4); the action resolves
that id and passes it. Real sending is Slice 6, blocked on DNS.
