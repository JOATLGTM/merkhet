# WORKFLOW.md

Canonical description of the Merkat project workflow. This document is the source of
truth for phase order, transition rules, approvals, and notifications.

Where this document and `merkat-prd.md` disagree, **this document wins.** The PRD was
written before the client workflow diagram (2026-08-11) and the Austin/Ryan feedback
thread; several of its assumptions were superseded.

Where this document is silent, ask rather than infer. See "Not Yet Specified" at the end.

---

## 1. Vocabulary

Two distinct kinds of "client-side" person, easy to conflate, must not be:

| Term | Meaning |
|---|---|
| **Client** | The customer. External. Has no login and never will. |
| **Client contact** | The internal Merkat staff member who owns the relationship for a given project (Ryan, Austin, Bill, etc.). Has a login. |
| **Delegate** | The internal staff member assigned to a specific phase of a specific project. Has a login. |
| **Consultant** | An external specialist attached to a project (soil engineer, septic designer, etc.). No login. Reference data only. |

**All users of this system are internal staff.** There is no client portal, no external
authentication, and no magic-link approval flow. Anything a client "approves" is recorded
in the system by a staff member on the client's behalf.

---

## 2. Phase sequence

```
Intake (form)
  → Pending
  → Active
  → Project Delegation
  → SD
  → DD
  → Review          ── reject ──► back to DD
  → CD
  → Final Review    ── reject ──► back to CD
  → Permitting
  → Complete (archived)
```

Forward movement is the norm. **Two transitions move backward** (Review→DD,
Final Review→CD). Phase history must tolerate a project entering the same phase more
than once.

---

## 3. Phase definitions

### Intake
Not a board state. Two forms captured before a project appears on the board.

**Client fields:** name, spouse name, address, phone, email, general comments.

**Project fields:** date received, estimated completion date, *client's desired completion
date* (distinct from the estimate), project address, client contact (internal staff),
budget for project, budget for design.

### Pending
**Entry:** on project creation.
**Exit:** an LOI or signed contract is uploaded.

This is a hard gate, not a status someone sets by hand. No document, no advancement.
The document upload *is* the transition trigger.

Document scope is deliberately narrow: **LOI and contract only.** Photos, drawings, and
general project files stay on the firm's existing server. Do not build a general document
management system.

### Active
**Entry:** contract/LOI uploaded.
**Notifies:** Ryan and Austin.
**Exit:** delegation completed.

A brief holding state between the document gate and delegation.

### Project Delegation
A single event, not an ongoing activity. Assigns **a person and a duration** to each of
five phases at once:

1. SD
2. DD
3. CD
4. Final Review
5. Permitting

Permitting durations are jurisdiction-dependent — typically 2–4 weeks, but entered per
project rather than defaulted.

**Review is not delegated.** It is an approval gate, not a work phase.

Completing delegation generates the project's calendar entries. Durations are the source
of the schedule; calendar dates are derived, not hand-entered. When a rework loop returns
a project to an earlier phase, downstream dates shift.

### SD
**Notifies on entry:** SD delegate.
**Exit:** delegate advances the project. No approval gate.

### DD
**Notifies on entry:** DD delegate, client.
**Exit:** delegate advances to Review.

### Review
An approval gate following DD. Three sign-offs required, **all recorded by staff**:

- Client contact — approves
- Austin — approves
- Client — approves (recorded by staff after handling the client directly, by phone or
  in person)

All three must be recorded before the project advances to CD.

Each sign-off stores who recorded it and when. This matters most for the client sign-off,
since a staff member is attesting on someone else's behalf.

**Reject → project returns to DD.** Notifies the DD delegate.

### CD
**Notifies on entry:** CD delegate, client.
**Exit:** delegate advances to Final Review.

### Final Review
Both a delegated phase and an approval gate.

**Notifies on entry:** Final Review delegate, Austin.

Two sign-offs required, both recorded by staff:

- Client contact — approves
- Austin — approves

The client is *not* an approver at this gate.

**Reject → project returns to CD.** Notifies the CD delegate.

### Permitting
**Notifies on entry:** Austin, Ryan, client.
**Delegate:** set at delegation. In practice Austin or Ryan.
**Duration:** set at delegation. Typically 2–4 weeks, jurisdiction-dependent.
**Exit:** Austin or Ryan manually marks the project complete, once notified externally
that permits are approved.

No approval gate. Manual exit only.

### Complete
Project is archived. Remains readable; leaves the active board.

---

## 4. Notification rules

Notifications fire **on phase entry**, addressed to the incoming phase's delegate plus
any additional recipients listed below.

| Transition | Recipients |
|---|---|
| → Active | Ryan, Austin |
| → SD | SD delegate |
| → DD | DD delegate, client |
| → CD | CD delegate, client |
| → Final Review | Final Review delegate, Austin |
| → Permitting | Austin, Ryan, client |
| Review rejected | DD delegate |
| Final Review rejected | CD delegate |

**Client emails send automatically.** Austin confirmed he wants these to go out without
an intermediate approval step — the point is to show the client the project has moved
forward.

Keep the send path structured so a review-before-send step can be reintroduced with a
single change. The earlier PRD design specified this as a thin UI with a one-line
reversal; preserve that reversibility even though the step is currently off.

Recipient resolution follows **per-project delegates**, not a global per-column subscriber
list. If the `phase_subscribers` model survives, it is a standing baseline layered
underneath delegate resolution — it does not replace it.

---

## 5. Consultants

Outside specialists (soil engineer, septic tank designer, etc.) are stored as reusable
contact records and attached to projects via a dropdown. Not a free-text notes field.

A consultant can be attached to many projects; a project can have many consultants.

---

## 6. Navigation

- **Board** — the kanban view. Existing tab, keep the name.
- **Customers** — client directory.
- **Calendar** — schedule view.
- **Staff** — per-person workload view. See "Not Yet Specified."

---

## 7. Not Yet Specified

Do not build these. Do not infer them. They are open questions with named owners.

**Calendar detail.** Austin finds the current view too broad and wants daily granularity.
Ryan wants the gantt sortable/groupable by staff member to see individual workload.
The likely shape is a day-resolution gantt with a staff-grouped mode, but Austin is
still thinking it through and will follow up. Build nothing here until he does.

**Hours tracking.** Deferred to Phase 2 by both Austin and Ryan. Phase 1 captures
*planned* hours via delegation durations and displays them in project detail. No time
entry, no rates, no invoicing.

Note the known gap: planned hours indicate whether a project is on schedule. They say
nothing about whether it is over budget, which is what invoicing needs. This is deferred,
not solved.

**Task granularity.** Ryan asked for "more detail in regards to hours per task in the
project detail." Unresolved whether *task* means *phase* (already captured by delegation)
or a new sub-entity beneath phases. This determines whether a `tasks` table exists and
where Phase 2 timesheet entries eventually attach. **Blocking for schema design.**

**Staff tab.** Ryan requested it before the staff-grouped gantt was discussed. May now be
redundant, or may still be wanted as a per-person detail page. Unconfirmed.

**Review entry notification.** No notification is defined for a project *entering* Review.
Approvers may be expected to check the board. Unconfirmed.

---

## 8. Superseded PRD assumptions

Flagged so they are not reintroduced:

- Approval-before-send on customer emails — **now off** (§4), but keep it reversible.
- Global `phase_subscribers` as the notification driver — **now delegate-driven** (§4).
- Four delegated phases — **now five**, Permitting included (§3).
- Permitting as a terminal state — **now a full phase** with delegate, duration, and
  manual exit (§3).
