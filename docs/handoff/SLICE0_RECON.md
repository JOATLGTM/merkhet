# Slice 0 — Recon report

Existing MVP read against [`../WORKFLOW.md`](../WORKFLOW.md), per [`../CHANGES.md`](../CHANGES.md) Slice 0.
No code changed.

Date: 2026-08-12. Working tree at `58b306f` + the uncommitted background-paths fix.

---

## Decisions taken (2026-08-12)

**Persistence: keep the demo store for now.** Model the new schema in
`lib/db/demo-store.ts` + `lib/types.ts`, and keep `supabase/migrations/` updated in
parallel as the spec of record. Consequences accepted:

- Every schema change lands twice. The SQL is written but never executed, so it is
  unverified until the eventual cutover — treat drift as likely, not possible.
- **Slice 2's document gate has no real file storage.** The upload will be a stub
  (filename + a flag on the project, no bytes retained). The *gate logic* is real and
  testable; the *upload* is not. Do not let the stub imply the feature is done.
- Nothing persists across a process restart. Any demo of the approval loop must be done
  in one session.

**Board columns.** Projects are created into **Pending**. Uploading the contract/LOI moves
them to a new **Active** column. From Active, a user moves the project to **SD** manually
when ready. So:

```
Pending → Active → SD → DD → Review → CD → Final Review → Permitting → (Complete, archived)
```

Eight live columns, same count as today — but **Backlog and Completed leave the board**
and **Active and Final Review join it**. Complete is an archive state, not a column.

Two readings this fixes:

- **Backlog is dropped.** It is not in the flow; creation lands in Pending.
- **Project Delegation is not a column.** WORKFLOW §3 calls it "a single event, not an
  ongoing activity," and the move Active → SD is manual and user-driven. Delegation is a
  form raised on entry to Active; completing it is what makes the move to SD legal.

**Still unanswered: the on-hold flag.** WORKFLOW.md does not mention it. It is shipped
behavior with seed coverage (`MK-0411`, `MK-0415`) and dropping it is destructive, so the
working assumption is **on-hold survives unchanged** — a flag available on any column,
orthogonal to the sequence. Flag it to Austin/Ryan; do not remove it on silence.

---

## 0. Precondition that reorders everything

**There is no database.** `supabase/migrations/20260807100000_init.sql` has never been
applied — no Supabase project, no Docker, no local Postgres (`DECISIONS.md` → "No Docker
locally"). Every read and write in the product goes:

```
app/actions/*  →  lib/db/repo.ts  →  lib/db/demo-store.ts   (process-global, in memory)
```

CHANGES.md Slice 1 says "one migration." There is nothing to migrate against.

**Resolved:** keep the demo store (see Decisions above). Slice 1 therefore means *model
the schema in `demo-store.ts` and `types.ts`, and mirror it into the migration file*, not
*run a migration*. Slice 2's file upload is stubbed, because Supabase Storage is the thing
that would have carried it and it is not wired.

Wiring Supabase remains the standing blocker under all of this (`NEXT.md` item 1) — this
decision defers it, it does not remove it. The longer the demo store carries new schema,
the larger the eventual cutover.

---

## 1. Current schema

From the unapplied migration; `lib/types.ts` mirrors it exactly.

**`users`** — `id` (FK `auth.users`), `name`, `email` unique, `role` (`admin|staff`),
`is_active`, `created_at`.

**`customers`** — `id`, `name`, `contact_name`, `contact_email`, `contact_phone`,
`notes`, `created_at`, `updated_at`.

**`projects`** — `id`, `customer_id`, `project_number` (`MK-nnnn`, sequence-assigned),
`name`, `description`, `status` (`backlog|pending|active|completed`), `current_phase`,
`on_hold`, `on_hold_since`, `on_hold_reason`, `start_date`, `target_completion`,
`hours_per_week`, timestamps. Two check constraints: `phase_matches_status`,
`hold_timestamp_matches_flag`.

**`project_phases`** — `id`, `project_id`, `phase`, `assignee_id`, `status`
(`not_started|in_progress|completed|skipped`), `planned_start`, `planned_end`,
`entered_at`, `completed_at`, `sort_order`, **`unique (project_id, phase)`**, plus a
partial unique index `one_active_phase_per_project` where `status = 'in_progress'`.
Five rows seeded per project by an `after insert` trigger.

**`activity_log`** — `id`, `project_id`, `actor_id`, `event_type`, `payload` jsonb,
`created_at`.

**`phase_subscribers`** — `(phase, user_id)` primary key.

**`notifications`** — **does not exist.** Designed in PRD §5.3, never built.

RLS: every table is `authenticated_full_access` — a placeholder, not the §5.4 design.

---

## 2. How phase transitions are triggered today

One path, no gates:

```
board drag (or command palette)
  → moveProjectAction(projectId, toColumn)        app/actions/projects.ts:22
  → repo.moveProject                              lib/db/repo.ts
  → applyPhaseMove(store, projectId, toColumn)    lib/db/demo-store.ts:828
```

`onDragEnd` (`components/board/board-view.tsx:318`) resolves the drop target to a column
and calls the action. **It validates nothing** — any column to any column, in either
direction. `applyPhaseMove` then:

- sets the target phase row `in_progress`, stamps `entered_at`
- marks the outgoing `in_progress` row `completed`
- marks intermediate `not_started` rows **`skipped`** — deliberate, per PRD §4.3
- writes an `activity_log` row, `event_type: "phase.changed"`

Optimistic UI via `useOptimistic`, rollback on throw. No transaction (there is no DB).

## 3. Where email sending lives

**Nowhere.** Zero matches for `resend`, `nodemailer`, `sendMail`, `notif` across `app`,
`lib`, `components`. No provider, no outbox, no cron route, no templates, no
`notifications` table.

`phase_subscribers` is **display-only**: it renders a popover on each board column
(`components/board/subscriber-popover.tsx`) and a Settings tab. Nothing reads it at
transition time, because nothing sends anything.

---

## 4. Matches

Specified behavior that already exists and behaves correctly.

- **Internal-staff-only auth model.** No client login, no external principals. WORKFLOW §1
  and PRD §11 agree, and the build follows it.
- **Board / detail sheet / customers / activity log.** All present and working.
- **Per-project, per-phase assignee** — `project_phases.assignee_id`. This *is* the
  delegate, structurally; it is missing only the duration.
- **Phase rows seeded at creation** (trigger + demo store). Exactly the shape delegation
  needs — five rows waiting for person + duration.
- **`planned_start` / `planned_end` columns exist** on `project_phases`. The derived
  calendar can write into them without a schema change.
- **Activity log with `actor_id` + `event_type`** — the audit substrate approvals need for
  `recorded_by`.
- **SD, DD, CD, Permitting** exist as phases with the right names.
- **Consultants: clean slate.** Nothing built, nothing to unbuild.
- **Client-email approval step: nothing to reverse.** It was never built, so "off but
  reversible" costs nothing to honor.

---

## 5. Conflicts

Exists, but contradicts WORKFLOW.md.

### 5.1 Phase sequence is wrong — one Review, in the wrong place

Current `design_phase` enum and `DESIGN_PHASES` order:

```
SD → DD → CD → Review → Permitting
```

WORKFLOW §2:

```
SD → DD → Review(gate) → CD → Final Review(gate) → Permitting
```

Review must move from post-CD to post-DD, and a **new** Final Review must be inserted
post-CD. Blast radius: the SQL enum, `lib/types.ts` (`DESIGN_PHASES`, `BOARD_COLUMNS`,
`COLUMN_LABELS`), the seeding trigger's `sort_order` values, board column order, calendar
row order, and `components/projects/phase-rule.tsx` — which hardcodes a **5-segment**
rule and now has to express 5 work phases plus 2 gates.

### 5.2 `unique (project_id, phase)` blocks rework loops

CHANGES.md Slice 1 flagged this; confirmed at `migrations/…_init.sql:82`.

It is deeper than dropping a constraint. **`project_phases` is a state table, not a
history table** — one row per phase, mutated in place. Re-entering DD has nowhere to
record the second entry, and `entered_at` is a single scalar that the second pass
overwrites.

Recommended shape (preserves everything already built): keep `project_phases` as the
one-row-per-phase **delegation and state** record (assignee, duration, derived dates), and
add an **append-only `phase_transitions`** table for history. Dropping the unique
constraint and inserting duplicate rows instead would break `applyPhaseMove`, the calendar,
and every `(project_id, phase)` lookup in `repo.ts`.

### 5.3 Pending is not a gate, and Active is not a state

`status` is `backlog|pending|active|completed`, and `boardColumnOf()` derives the board
column as `status === 'active' ? current_phase : status`. So **"Active" has no
representation of its own** — an active project is always displayed as one of the five
phases.

WORKFLOW needs `Pending → Active (holding) → Project Delegation → SD`. Two new states that
the current model cannot express. Worse, the `phase_matches_status` check constraint
*forbids* exactly the row the Active holding state requires:

```sql
(status = 'active' and current_phase is not null) or
(status <> 'active' and current_phase is null)
```

That constraint has to change. Today a project can be dragged Pending → Permitting in one
gesture, with no document, no delegation, and no approvals.

### 5.4 Notification routing model is superseded

`phase_subscribers` is global and per-phase, managed in Settings and surfaced per column on
the board. WORKFLOW §4 resolves recipients from **per-project delegates**. §4 permits the
subscriber table to survive as a standing baseline underneath, so this is a demotion, not a
deletion — but the Settings tab and the column popover currently present it as *the*
routing model, and that framing is now wrong.

### 5.5 Calendar dates are hand-entered

`updatePhaseDatesAction` plus two `type="date"` inputs per phase in
`project-detail-sheet.tsx` let staff set `planned_start` / `planned_end` directly.
WORKFLOW §3: durations are the source, dates are derived, "do not allow manual date entry."
Those inputs become derived/read-only.

### 5.6 Drag is unconstrained, and skipping is a designed feature

PRD §4.3: "Phases are skippable. Do not enforce linear progression." `applyPhaseMove` has
explicit logic to mark intermediate phases `skipped`, and `phase_status` carries a
`'skipped'` value for it.

WORKFLOW replaces that with hard gates. CHANGES.md Slice 2 — "a project with no contract
cannot be advanced by any path, including drag on the board" — is a direct reversal of
shipped, intentional behavior. The skip logic is now wrong on any gated transition.

### 5.7 "Client contact" already means something else

`customers.contact_name / contact_email / contact_phone` currently hold the **external
client's** details. WORKFLOW §1 defines *client contact* as the **internal staff member**
who owns the relationship — the exact conflation §1 opens by warning against, already
baked into the schema and into `new-project-dialog.tsx`.

Needs `projects.client_contact_id → users(id)`, and the customer's own fields renamed or
clearly relabeled in the UI so the two never read as the same thing.

### 5.8 Document authority order is now contradictory

`docs/handoff/DECISIONS.md` states "**`docs/PRD.md` wins** on product behavior, data model,
columns, phases," quoting an explicit user correction. WORKFLOW.md states it supersedes the
PRD. Both are checked in. The next session will follow whichever it reads first.

Also: WORKFLOW.md says "**Merkat**" throughout and cites `merkat-prd.md`. The product was
renamed **Merkhet** on Aug 11 and the PRD is `docs/PRD.md`.

---

## 6. Missing

Specified in WORKFLOW.md, no implementation whatsoever.

| Area | Notes |
|---|---|
| **File upload** | No storage bucket, no file input, no contract/LOI column. Slice 2's gate has zero substrate. |
| **Approvals** | No table, no sign-off UI, no reject action, no `recorded_by`. |
| **Backward transitions** | Never performed. `applyPhaseMove` assumes forward movement. |
| **Delegation** | No screen, no duration field anywhere in schema or UI. |
| **Derived scheduling** | No duration→date generation, no downstream shift on rework. |
| **Consultants** | No table, no join, no directory, no dropdown. |
| **Archive** | `completed` exists but remains a live board column. Nothing archives. |
| **Notifications** | Entire subsystem — provider, outbox, worker, templates, recipients. |
| **New project fields** | desired completion date, project budget, design budget, `client_contact_id`, `archived`. |
| **New client fields** | spouse name; general comments (existing `notes` may serve). |
| **Staff nav tab** | Not built. WORKFLOW §7 says confirm before building. |
| **Tasks** | Blocked — WORKFLOW §7 calls this blocking for schema design. |

---

## 7. Orphans

Built against assumptions WORKFLOW.md supersedes.

- **`phase_subscribers`, end to end** — table, seed, `listSubscribers`/`setSubscribers` in
  `repo.ts`, the Settings tab, and `subscriber-popover.tsx` on every board column.
  *Demote to baseline, do not delete* (§4).
- **Skip logic** in `applyPhaseMove` + the `'skipped'` phase status. Illegal on gated
  transitions.
- **Manual phase-date inputs** in the detail sheet (§5.5).
- **`phase_matches_status`** check constraint (§5.3).
- **`projects.hours_per_week`** — a project-level number where the new model wants
  per-phase durations. May be replaced outright depending on the task-granularity answer.
- **PRD §8 notification design** — approval queue, `/client-updates`, staleness job,
  `notification_status.awaiting_approval`. Nothing was built, so this is an orphan on
  paper, but §8.2 now specifies behavior that is explicitly off.
- **`phase-rule.tsx`** — hardcoded 5 segments.
- **Backlog column** — WORKFLOW's sequence starts at Pending and never mentions Backlog.
  Unresolved whether it survives.
- **On-hold flag** — substantial shipped behavior (PRD §4.3; seed cases `MK-0411`,
  `MK-0415`) that WORKFLOW.md does not mention at all. Unresolved.

---

## 8. Slice assessment

| Slice | Verdict |
|---|---|
| 0 Recon | Done — this document. |
| 1 Schema | Needed in full. **Blocked twice:** task granularity (§7), and no database exists (§0). |
| 2 Pending gate | Needed. **Undeclared dependency on file storage** — cannot start before §0 is decided. |
| 3 Intake | Needed. Cheapest slice; pure form work once Slice 1 lands. |
| 4 Delegation | Needed, greenfield. Also owns the duration→calendar generation. |
| 5 Gates + rework | Needed, greenfield, and the highest-risk slice — first backward transition, depends on the §5.2 history reshape. |
| 6 Notifications | Needed, greenfield. Nothing to reuse; `phase_subscribers` is demoted, not repurposed. |
| 7 Consultants | Needed, greenfield, fully independent — good candidate to parallelize. |
| 8 Permitting exit + archive | Needed. Small, but touches the board's column model. |
| 9 Staff view | Confirm need first (§7). |
| 10 Calendar | Blocked on Austin. Note §5.5 already conflicts with the current calendar. |

---

## 9. Open questions, in priority order

1. **Task granularity** — phase, or a new sub-entity beneath phases? WORKFLOW §7 marks it
   blocking for schema design, and it also decides whether `projects.hours_per_week`
   survives or is replaced by per-phase durations. **Still blocking Slice 1.**
2. **Does the on-hold flag survive?** Unmentioned in WORKFLOW.md. Working assumption is
   yes, unchanged (see Decisions). Needs confirming rather than inheriting.
3. **Which document wins?** `DECISIONS.md` currently says the PRD does, quoting an explicit
   user correction. WORKFLOW.md claims supersession. Both are checked in; the next session
   follows whichever it reads first. Resolve in the same commit as the first Slice 1 change.
4. **Review entry notification** — WORKFLOW §7 leaves it undefined. Not blocking until
   Slice 6.

**Resolved:** persistence approach (demo store), board column model, Backlog (dropped),
Project Delegation (form, not column). See Decisions at the top.
