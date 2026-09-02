# WORKFLOW-2.md

Canonical description of the Merkhet project workflow. Source of truth for phase order,
transition rules, approvals, and notifications.

Supersedes `WORKFLOW.md` (2026-08-11), which used the pre-rename "Merkat" naming, claimed
blanket authority over the PRD, and omitted the on-hold flag.

## Document authority

This document wins on: **phase sequence, board columns, transition rules, gates,
approvals, delegation, and notification routing.**

`docs/PRD.md` remains authoritative on everything else — screens, components, auth,
activity log, on-hold behavior, and any area this document does not address.

Where the PRD describes workflow behavior that contradicts §9 below, this document wins.
Update `docs/handoff/DECISIONS.md` to reflect this scoping in the same commit as the first
schema change.

Where this document is silent, ask rather than infer. See §8.

---

## 1. Vocabulary

Two distinct kinds of "client-side" person, easy to conflate, must not be:

| Term               | Meaning                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Client**         | The customer. External. Has no login and never will.                                                               |
| **Client contact** | The internal Merkhet staff member who owns the relationship for a given project (Ryan, Austin, Bill). Has a login. |
| **Delegate**       | The internal staff member assigned to a specific phase of a specific project. Has a login.                         |
| **Consultant**     | An external specialist attached to a project (soil engineer, septic designer). No login. Reference data only.      |

**All users of this system are internal staff.** No client portal, no external
authentication, no magic-link approval. Anything a client "approves" is recorded in the
system by a staff member on the client's behalf.

Note the existing conflict: `customers.contact_name / contact_email / contact_phone`
currently hold the **external client's** details, which reads as "client contact" but is
not. Projects need their own `client_contact_id → users(id)`, and the customer fields must
be relabeled in the UI so the two never read as the same thing.

---

## 2. Phase sequence

```
Intake (form)
  → Pending
  → Active          ← delegation form raised here
  → SD
  → DD
  → Review          ── reject ──► back to DD
  → CD
  → Final Review    ── reject ──► back to CD
  → Permitting
  → Complete (archived, off-board)
```

**Board columns (8):** Pending, Active, SD, DD, Review, CD, Final Review, Permitting.

- **Backlog is dropped.** Project creation lands in Pending.
- **Complete is not a column.** It is an archive state; archived projects leave the board.
- **Project Delegation is not a column.** It is a form raised on entry to Active.
  Completing it is what makes the manual move Active → SD legal.

Forward movement is the norm. **Two transitions move backward** (Review→DD,
Final Review→CD). A project may enter the same phase more than once; see §6.

**On-hold survives unchanged.** It is a flag available on any column, orthogonal to this
sequence — not a phase, not a column. Existing behavior and seed coverage (`MK-0411`,
`MK-0415`) stand.

---

## 3. Phase definitions

### Intake

Not a board state. Two forms captured before a project appears on the board.

**Client fields:** name, spouse name, address, phone, email, general comments.

**Project fields:** date received, estimated completion date, _client's desired completion
date_ (distinct from the estimate), project address, client contact (internal staff
member), budget for project, budget for design.

### Pending

**Entry:** on project creation.
**Exit:** an LOI or signed contract is uploaded.

A hard gate, not a status someone sets by hand. No document, no advancement — including
by drag on the board.

Document scope is deliberately narrow: **LOI and contract only.** Photos, drawings, and
general project files stay on the firm's existing server. Do not build document
management.

### Active

**Entry:** contract/LOI uploaded.
**Notifies:** Ryan, Austin.
**Exit:** manual move to SD, permitted only once delegation is complete.

A holding state. The delegation form is raised here.

Note: the existing `phase_matches_status` check constraint forbids exactly this row
(`status = 'active'` with a null phase). It must be rewritten.

### Project Delegation

A single event, not an ongoing activity. Assigns **a person and a duration** to each of
five phases at once:

| #   | Phase        | Duration notes                                                            |
| --- | ------------ | ------------------------------------------------------------------------- |
| 1   | SD           |                                                                           |
| 2   | DD           |                                                                           |
| 3   | CD           |                                                                           |
| 4   | Final Review |                                                                           |
| 5   | Permitting   | Jurisdiction-dependent, typically 2–4 weeks. No default; require a value. |

**Review is not delegated** — it is a pure gate (see below).

Completing delegation generates the project's calendar entries. Durations are the source
of the schedule; dates are derived, never hand-entered. **Superseded 2026-09-02: dates are
typed in per phase and durations are derived from them — `PHASE_DATES_APPLY.md`.**
`project_phases.planned_start` and
`planned_end` already exist and can carry them.

### SD

**Notifies on entry:** SD delegate.
**Exit:** delegate advances. No approval gate.

### DD

**Notifies on entry:** DD delegate.
**Exit:** delegate advances to Review.

### Review

An approval gate following DD. **No delegate, no duration, consumes no schedule time.**

Three sign-offs required, **all recorded by staff**:

- Client contact — approves
- Austin — approves
- Client — approves (recorded by staff after handling the client directly, by phone or in
  person)

All three must be recorded before the project advances to CD.

Each sign-off stores who recorded it and when. This matters most for the client sign-off,
where a staff member is attesting on someone else's behalf.

**Reject → returns to DD.** Notifies the DD delegate. Clears this gate's sign-offs so the
gate can be re-approved on the next pass. Downstream dates shift.

### CD

**Notifies on entry:** CD delegate.
**Exit:** delegate advances to Final Review.

### Final Review

Both a delegated phase **and** an approval gate. It has a delegate and a duration, unlike
Review.

**Notifies on entry:** Final Review delegate, Austin.

Two sign-offs, both recorded by staff:

- Client contact — approves
- Austin — approves

The client is **not** an approver at this gate.

**Reject → returns to CD.** Notifies the CD delegate. Clears this gate's sign-offs.

### Permitting

**Notifies on entry:** Austin, Ryan.
**Delegate:** set at delegation. In practice Austin or Ryan.
**Duration:** set at delegation. Typically 2–4 weeks, jurisdiction-dependent.
**Exit:** Austin or Ryan manually marks the project complete, once notified externally
that permits are approved. No approval gate.

### Complete

Archived. Leaves the active board. Remains readable and searchable.

---

## 4. Notification rules

Fire **on phase entry**, addressed to the incoming phase's delegate plus any additional
recipients below.

| Transition            | Recipients                    | Status                 |
| --------------------- | ----------------------------- | ---------------------- |
| → Active              | Ryan, Austin                  | Build                  |
| → SD                  | SD delegate                   | Build                  |
| → DD                  | DD delegate                   | Build                  |
| → CD                  | CD delegate                   | Build                  |
| → Final Review        | Final Review delegate, Austin | Build                  |
| → Permitting          | Austin, Ryan                  | Build                  |
| Review rejected       | DD delegate                   | Build                  |
| Final Review rejected | CD delegate                   | Build                  |
| → DD, CD, Permitting  | **Client**                    | **Deferred — Phase 2** |

**Client-facing email is deferred.** Austin asked for automatic client notification on DD,
CD, and Permitting entry so the client can see the project advancing. It is deliberately
out of scope for this version — it is the only outbound-to-client surface in the build.

The rows stay in this table on purpose. Build the recipient resolver with a place for the
client to slot in, so Phase 2 is wiring rather than rediscovery. Keep the send path
structured so a review-before-send step can be added with a single change.

> **2026-09-01:** `phase_subscribers` was dropped. The "standing baseline" below is now a
> per-project, per-phase notify list chosen in Plan schedule — `PHASE_RECIPIENTS_APPLY.md`.

**Recipient resolution follows per-project delegates**, not a global per-column subscriber
list. The existing `phase_subscribers` table is demoted to a standing baseline underneath
delegate resolution — not deleted, but no longer _the_ routing model. The Settings tab and
board column popover currently present it as the routing model; that framing is now wrong
and should be reworded.

---

## 5. Consultants

External specialists stored as reusable contact records and attached to projects via a
dropdown. Not a free-text notes field.

Many-to-many: a consultant serves many projects, a project has many consultants.

---

## 6. Phase history

`project_phases` stays as it is — **one row per phase**, holding delegation (assignee,
duration) and current state (status, derived dates). Its `unique (project_id, phase)`
constraint is correct for that purpose and stays.

Re-entry history goes in a **new append-only `phase_transitions` table**: one row per
transition, recording from-phase, to-phase, actor, timestamp, and direction.

Do not drop the unique constraint and insert duplicate `project_phases` rows. That would
break `applyPhaseMove`, the calendar, and every `(project_id, phase)` lookup in `repo.ts`.

---

## 7. Navigation

- **Board** — the kanban view. Existing tab, keep the name.
- **Customers** — client directory.
- **Calendar** — schedule view.
- **Staff** — per-person workload view. Confirm before building; see §8.

---

## 8. Not Yet Specified

Do not build these. Do not infer them.

**Task granularity.** **Resolved (2026-08-12):** _task_ means **phase**. No `tasks`
table. Planned hours live on phase delegation durations; `projects.hours_per_week` can
remain as display/legacy until Phase 2 timesheets. Unblocks Slice 1B.

**Calendar detail.** **Resolved (2026-08-14):** the client confirmed the shape the earlier
signal pointed at — a **day-resolution gantt with a staff-grouped mode**, both halves, not
day zoom alone. Austin wanted the daily granularity; Ryan wanted grouping by staff member
to see individual workload. Unblocks Slice 10. Note that manual phase-date entry still
conflicts with §3, and Slice 4 (Delegation) is skipped, so the `assignee_id` the staff
grouping reads from is hand-entered.

**Hours tracking.** **Partly resolved (2026-08-14):** the client asked for hours per project
per status, and confirmed this means **planned/budgeted** hours, not logged time. Now a
first-class field: `project_phases.planned_hours`, set per delegated phase (Review excluded
— a gate consumes no hours). This closes the gap noted below: planned hours are a budget
number in their own right, no longer inferred from schedule durations.

_Still Phase 2:_ time entry, timesheets, rates, invoicing. Nothing logs hours *against* the
plan; there is no actual-vs-planned variance. That remains deferred, not solved.

**Phase skipping.** The PRD deliberately allows skipping (§4.3, "do not enforce linear
progression"), and `applyPhaseMove` implements it. Gates now forbid it on gated
transitions. Whether non-gated skips (e.g. SD→CD on a small project) remain legal is
Austin's call, not an implementation detail. Until answered: **enforce gates, leave
non-gated skips alone.**

**Staff tab.** Ryan requested it before the staff-grouped gantt was discussed. May be
redundant, or may still be wanted as a per-person detail page. Unconfirmed.

**Review entry notification.** No notification defined for a project _entering_ Review.
Approvers may be expected to check the board. Unconfirmed; not blocking until Slice 6.

---

## 9. Superseded assumptions

Flagged so they are not reintroduced.

**From `docs/PRD.md`:**

- Phase order `SD → DD → CD → Review → Permitting` — Review moves to post-DD, Final Review
  inserted post-CD (§2).
- Board columns including Backlog and Completed (§2).
- Unrestricted phase skipping on gated transitions (§8).
- `phase_subscribers` as the notification routing model (§4).
- Manual entry of `planned_start` / `planned_end` (§3).
- PRD §8 notification design — approval queue, `/client-updates`, staleness job. Never
  built; superseded by §4.

**From `WORKFLOW.md` (v1):**

- Blanket supersession of the PRD — now scoped (see Document authority).
- Four delegated phases — now five, Permitting included (§3).
- Permitting as a terminal state — now a full phase with delegate, duration, manual exit.
- Review with an implied delegate — now explicitly a pure gate with no duration (§3).
- Automatic client emails as in-scope — now deferred (§4).
- Dropping `unique (project_id, phase)` — replaced by the `phase_transitions` model (§6).
- Silence on the on-hold flag — now explicitly preserved (§2).
- "Merkat" naming and `merkat-prd.md` reference — the product is **Merkhet**; the PRD is
  `docs/PRD.md`.
