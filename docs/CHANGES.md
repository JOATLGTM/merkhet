# CHANGES.md

> **SUPERSEDED — historical reference only.**
> The current slice plan and status table is [`handoff/CHANGES-2.md`](./handoff/CHANGES-2.md).
> This is the v1 delta against the v1 `WORKFLOW.md`, itself superseded. Its slice numbering is
> **not** the numbering used in CHANGES-2.md — do not cross-reference them.

Delta between the existing MVP and the workflow defined in `WORKFLOW.md`.

Read `WORKFLOW.md` first. It is the source of truth for behavior; this document is the
order of operations for getting there.

Slices are sized for a single working session and ordered by dependency. Do not skip
ahead — later slices assume earlier schema exists.

---

## Slice 0 — Recon (no code)

**Write nothing. Change nothing.** Read the existing codebase against `WORKFLOW.md` and
produce a written report covering:

1. **Matches** — what already exists and behaves as specified.
2. **Conflicts** — what exists but contradicts the spec. Expect at least:
   - phase transition logic that assumes forward-only movement
   - a projects table with no gated Pending state
   - notification recipients resolved from a subscriber list rather than delegates
3. **Missing** — specified behavior with no implementation at all.
4. **Orphans** — code built against superseded PRD assumptions (see `WORKFLOW.md` §8)
   that should be removed or reworked.

Also report: current schema for projects, phases, users, and notifications; how phase
transitions are currently triggered; and where email sending lives.

This report determines which of the slices below are actually needed. Some may already
be partly done.

---

## Slice 1 — Schema

**Blocked on:** the task-granularity question (`WORKFLOW.md` §7). If "task" means a
sub-entity beneath phases, that table belongs in this migration rather than bolted on in
Phase 2. Resolve before writing the migration.

One migration covering:

**Project fields** — add: client's desired completion date, project budget, design budget,
client contact (FK to staff), archived state.

**Client fields** — add: spouse name, general comments. Confirm address/phone/email exist.

**Delegation** — person + duration per phase, per project. Five delegated phases:
SD, DD, CD, Final Review, Permitting. Review is excluded (it is a gate, not a work phase).

**Approvals** — one row per required sign-off, per gate, per project:
`project_id`, `phase`, `party` (client_contact | austin | client), `approved_at`,
`recorded_by` (FK to staff), `status`.

The `recorded_by` field is not optional. Every sign-off is entered by a staff member,
including the client's.

**Contract document** — reference to the uploaded LOI/contract. Single-purpose. Not a
general file table.

**Consultants** — `consultants` table plus a `project_consultants` join. Many-to-many.

**Phase history** — verify it tolerates a project entering the same phase twice. If it
has a unique constraint on `(project_id, phase)`, that constraint is wrong and must go.

---

## Slice 2 — Pending → Active gate

Upload UI for LOI/contract on the project record. Upload success triggers the transition
to Active. No manual override — the document is the gate.

Fires the Active notification (Ryan, Austin). If the notification system does not exist
yet, stub the call site and wire it in Slice 6.

Verify: a project with no contract cannot be advanced by any path, including drag on the
board.

---

## Slice 3 — Intake form expansion

Surface the new client and project fields from Slice 1 in the intake and project-edit
forms. Client contact is a staff picker, not free text.

---

## Slice 4 — Delegation

New screen, reached when a project enters Active. Assigns person + duration to all five
phases in one submission.

On submit: generate calendar entries derived from the durations. Do not allow manual
date entry on the calendar — durations are the source.

Permitting duration has no sensible default. Leave it empty and require a value.

---

## Slice 5 — Approval gates and rework loops

Review gate (post-DD): three sign-offs — client contact, Austin, client. All three
required to advance to CD.

Final Review gate (post-CD): two sign-offs — client contact, Austin.

Each sign-off records `recorded_by` and `approved_at`.

**Rejection** returns the project to the prior phase (Review→DD, Final Review→CD) and
clears that gate's sign-offs so it can be re-approved on the next pass. Downstream
calendar dates shift.

This is the first backward transition in the system. Test the loop twice on the same
project to confirm phase history and date recalculation both survive a repeat.

---

## Slice 6 — Notifications

Implement the recipient table in `WORKFLOW.md` §4. Recipients resolve from per-project
delegates, not a global subscriber list.

Client emails send automatically. Structure the send path so a review-before-send step
can be reintroduced with a single change — the step is off, not absent by design.

Rejection notifications go to the delegate of the phase being returned to.

---

## Slice 7 — Consultants

Consultant directory (CRUD) plus a dropdown on the project detail screen to attach
existing consultants. Attaching should not require leaving the project screen.

---

## Slice 8 — Permitting exit and archive

Manual "mark complete" action on Permitting, restricted to Austin and Ryan. No approval
gate.

Complete moves the project to archive: off the active board, still readable and
searchable.

---

## Slice 9 — Staff view

**Confirm need before building** (`WORKFLOW.md` §7). May be redundant with the
staff-grouped calendar.

If built: per-person view of assigned phases across all projects, derived from delegation.
No new schema.

---

## Slice 10 — Calendar

**Blocked.** Austin is finalizing the spec. Do not build ahead of it.

Current signal: day-level resolution, with grouping by staff member so individual
workload is visible. Treat as direction, not requirements.

---

## Do not build

Left unspecified, these get invented. They are out of scope for this version:

- **Client portal, client login, magic links, external approval flows.** Every user is
  internal staff. Client approval is recorded by staff on the client's behalf.
- **General file/document management.** LOI and contract only. Everything else lives on
  the firm's server.
- **Time entry, timesheets, rates, invoicing.** Phase 2. Planned hours from delegation
  durations only.
- **A calendar implementation ahead of Slice 10.**
- **Multi-tenancy.** Single tenant.
- **An approval step on outgoing client emails.** Reversible by design, currently off.
