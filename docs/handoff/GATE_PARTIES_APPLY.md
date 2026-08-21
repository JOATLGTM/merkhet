# Gate sign-offs — Austin, Ryan, and a chosen third

User decision (2026-08-21). Both gates now take the same three sign-offs:

| | Before | After |
|---|---|---|
| **Review** (post-DD) | Client contact · Austin · Client | **Austin · Ryan · chosen** |
| **Final review** (post-CD) | Client contact · Austin | **Austin · Ryan · chosen** |

The third is a *slot*, not a fixed party — whoever Austin or Ryan picked for that project. The
picker offers every active staff member plus **The client**.

## This supersedes WORKFLOW-2 §3

`WORKFLOW-2.md` is authoritative on gates and approvals, and this contradicts it in three
places. The document has not been edited; this note is the record.

1. Review required **client contact + Austin + client**. It now requires Austin + Ryan +
   chosen.
2. Final review required **client contact + Austin** — two sign-offs. It now requires three.
3. WORKFLOW-2 says "The client is **not** an approver at this gate" of Final review. That
   distinction is gone: the client can be the chosen third at either gate.

**The client did not lose their sign-off — it became discretionary.** Mandatory at Review and
forbidden at Final review, they are now available at both and required at neither. If the firm
wants the client's approval mandatory again, that is a change to `GATE_PARTIES` in
`lib/types.ts` *and* to the two `unnest(array[…])` lists in `move_project`, not a UI tweak.

## SQL — NOT YET APPLIED. Two files, in order.

```
supabase/migrations/20260821120000_gate_parties_enum.sql   -- run FIRST, alone
supabase/migrations/20260821120100_gate_parties.sql
```

**They must be run as two separate statements/batches.** Postgres will not let a transaction
*use* an enum value it added in that same transaction, and the second file's check constraint
and `move_project` body both name `'chosen'`. This is the same reason
`20260812130000_workflow_1b_enum.sql` is split from `20260812130100_workflow_1b.sql`.

File 1 adds `'ryan'` and `'chosen'` to `approval_party`. File 2 adds
`project_approvals.approver_user_id`, a constraint keeping it to the chosen slot, and rebuilds
`move_project` in full — only the two gate-requirement blocks differ from
`20260814160000_approval_gates.sql`. Both are idempotent.

`reject_gate` is untouched: it deletes a gate's approvals by phase and has never cared which
parties they were.

⚠️ **`20260821100000_project_address_contact.sql` is also still unapplied** — see
[`PROJECT_CONTACT_APPLY.md`](./PROJECT_CONTACT_APPLY.md). The two are independent; either
order works.

## Existing approval rows

`client_contact` and `client` stay in the enum. Dropping an enum value would mean rewriting
every historical row, and the activity log references them by name.

**But any project currently parked at a gate loses progress.** A project with Review's old
client-contact and Austin sign-offs recorded now shows 1/3 — Austin still counts, Ryan and the
chosen third do not exist yet. Nothing breaks and nothing is deleted; the gate simply is not
satisfied until the new three are recorded. Worth a look before applying:

```sql
select p.project_number, a.phase, a.party
from public.project_approvals a
join public.projects p on p.id = a.project_id
order by p.project_number, a.phase;
```

If that returns nothing, there is no migration cost at all.

## The model

**`approver_user_id` identifies the chosen third.** On a `chosen` row a non-null value is the
staff member who signed off; **null means the client**, recorded by staff on their behalf
exactly as before.

That null is not "unset". Approval rows exist only once approved — Slice 5's core invariant,
unchanged — so a `chosen` row always represents a decision someone made. A check constraint
keeps `approver_user_id` off the fixed parties, whose identity *is* the party.

**One row shape for the slot.** The alternative was `party = 'chosen'` for staff and
`party = 'client'` for the client, which `unique (project_id, phase, party)` would happily let
you fill *both* of. One party value means the gate check stays "does a `chosen` row exist",
clearing stays a single delete, and the slot cannot be double-filled.

**The third is picked when the sign-off is recorded**, not at delegation. Who reviews a set of
drawings is not knowable when the project is planned, which is the whole reason it is a
dropdown rather than a column.

## Behavior

- Detail sheet, at either gate: three rows. Austin and Ryan record with one button. The third
  row shows a person picker (active staff, then **The client**) and its Record button stays
  disabled until something is picked.
- Once recorded, the third row is titled with **the person**, not "Third sign-off" — the slot
  label only appears while it is pending.
- `activity_log` payload for `approval.recorded` now carries `approver_user_id`. The chosen
  slot means nothing in the log without the person in it.
- Gate enforcement is unchanged in shape: still `from <= gate < to` in `move_project`, so board
  drag and ⌘K inherit it, and skipping a gate is still blocked.
- Error message for Final review changed — "needs **all three** sign-offs", was "both".

## Verify after applying

```bash
npm run check:gates   # 50-ish assertions, WRITES to hosted Supabase
```

Updated for the new parties: Review is crossed with austin + ryan + chosen(staff), Final review
with austin + ryan + chosen(**null** = the client), so both branches of the slot are exercised.

By hand, on any project at a gate:

1. Three rows: Austin, Ryan, Third sign-off. Counter reads `0/3`.
2. Record approval on the third row is **disabled** until a person is picked.
3. Pick a staff member → record → the row is titled with their name.
4. Clear it, pick **The client** → record → the row reads "The client".
5. With 2 of 3, dragging the project forward is refused with "needs all three sign-offs".
6. Reject → all three clear.
