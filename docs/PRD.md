# Merkhet Project Management Platform — PRD

**Version:** 1.1 (MVP)
**Status:** Draft for client review
**Last updated:** 2026-08-07

> **This document is authoritative.** The _Datum_ mockup
> (`Merkat.dc.html`) is a **non-binding visual reference** — it exists to show roughly what the
> product will feel like, not to specify it. Where the two disagree, the PRD wins. Do not import the
> mockup's palette, typefaces, board grouping, or motion timings; §12 below is the spec.
>
> **Changes from 1.0** are deliberately narrow and none are mockup-driven:
>
> 1. **§9.2** — three factual corrections about Next.js 16.3, verified against the bundled docs. v1.0
>    described two APIs in ways that would fail during slice 1.
> 2. **§5.2** — `projects.project_number` and `projects.on_hold_since` added, resolving part of
>    §10 Q5.
> 3. **§8.2.1** — renumbered; v1.0 had two sections labelled §8.2.

---

## 1. Overview

### 1.1 Problem

Merkhet is an architecture firm managing multiple concurrent projects, each moving through a defined sequence of design phases. Today there is no single place to answer three questions:

1. Where is every project right now?
2. Who is responsible for the current phase of each project?
3. What is due, and when?

Project status lives in people's heads, email threads, and spreadsheets. Handoffs between phases are informal, so work sits idle because the next person doesn't know it's their turn.

### 1.2 Solution

A single-tenant, internal-only web application with three primary views:

- **Board** — a kanban of all projects, one column per lifecycle stage, drag to advance
- **Calendar** — a timeline showing where projects sit in time
- **Customers** — a directory of clients and the projects belonging to each

MVP is read/write project tracking. Phase 2 adds automated email handoff notifications.

### 1.3 Success criteria

The MVP is successful if:

- Every active Merkhet project exists in the system with an owner per phase
- Staff can determine any project's status without asking anyone
- A phase handoff is a single drag action, logged with who and when
- The team stops maintaining the current spreadsheet

---

## 2. Users and roles

Internal Merkhet staff only. **Customers never log in.** Customers are data records, not authentication principals.

| Role  | Capabilities                                            |
| ----- | ------------------------------------------------------- |
| Admin | Everything, plus manage users and default phase routing |
| Staff | Full read/write on projects and customers               |

Role distinction is minimal in MVP. Do not build granular permissions; a two-value enum on `users.role` is sufficient, with admin gating only the settings screen.

**Non-goal:** external/client portal, guest access, per-project permissions.

---

## 3. Scope

### 3.1 In scope (MVP)

- Email/password authentication for internal staff
- Customer CRUD
- Project CRUD
- Kanban board with drag-to-advance
- Project detail slide-over panel
- Per-project, per-phase assignee
- Timeline calendar view
- Activity log per project
- Basic search and filter on the board

### 3.2 In scope (Phase 2)

- Internal email notification on phase handoff
- Customer-facing progress email on phase handoff
- Notification preferences per user and per customer
- Comments on projects

### 3.3 Explicitly out of scope

The following are recognizable features of Monograph and monday.com. They are **not** being built and should not be scaffolded speculatively:

- Time tracking / timesheets
- Invoicing, payments, or any billing
- Budgets, fee tracking, or profitability reporting
- Resource capacity planning and workload balancing
- Client-facing portal
- File storage and document management
- Project templates
- Reporting dashboards and analytics
- Mobile applications
- Multi-tenancy / multi-org
- Third-party integrations (QuickBooks, Google Drive, Slack)

Any of these may be proposed as future phases. None are assumed.

> The mockup shows an "SSO" label on its sign-in screen and a dashboard of aggregate figures. Neither
> is in scope. §3.1 says email/password, and this product has no dashboard.

---

## 4. Domain model

### 4.1 The two-dimension problem

A project has both a **lifecycle status** and, when active, a **design phase**. These are orthogonal concepts, but for the board they are flattened into a single column position.

**Lifecycle status** (`projects.status`):

- `backlog` — won, not yet started
- `pending` — awaiting kickoff (deposit, survey, site selection, client input) — _definition pending client confirmation, see §10_
- `active` — currently in a design phase
- `completed` — delivered

**Design phase** (`projects.current_phase`, non-null only when `status = 'active'`):

1. `schematic_design`
2. `design_development`
3. `construction_documents`
4. `review`
5. `permitting`

### 4.2 Board columns

The board renders **eight** columns, derived from the pair above:

```
Backlog | Pending | Schematic design | Design development |
Construction documents | Review | Permitting | Completed
```

Derivation rule:

```
board_column = status === 'active' ? current_phase : status
```

Rationale: the board's purpose is answering "where is everything." Collapsing five phases into one Active column defeats that. Phases are sequential and mutually exclusive, which is precisely the shape a kanban column wants.

### 4.3 Rules and constraints

- **No parallel phases.** A project is in exactly one phase at a time. At most one `project_phases` row per project may have `status = 'in_progress'`, enforced by a partial unique index.
- **Phases are skippable.** Do not enforce linear progression. A user may drag from Schematic design directly to Permitting. Log it; do not block it.
- **On hold is a flag, not a column.** `projects.on_hold` is a boolean. An on-hold project stays in its current column, renders dimmed with an indicator, and sorts to the top. This preserves the information about _where_ it stalled. `projects.on_hold_since` records when, so a project that has quietly stalled for four months is distinguishable from one paused yesterday.
- **Phase rows are seeded at creation.** When a project is created, insert one `project_phases` row for each of the five phases with `status = 'not_started'`. The board and calendar read these rows. This is what makes per-project-type phase templates a purely additive change later (see §10).

---

## 5. Data model

### 5.1 Enums

```sql
create type project_status as enum ('backlog', 'pending', 'active', 'completed');
create type design_phase as enum (
  'schematic_design',
  'design_development',
  'construction_documents',
  'review',
  'permitting'
);
create type phase_status as enum ('not_started', 'in_progress', 'completed', 'skipped');
create type user_role as enum ('admin', 'staff');
```

### 5.2 Tables

```sql
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seeded to continue Merkhet's existing numbering; confirm the starting value
-- before running the migration (see §10.5).
create sequence project_number_seq start 1;

create table projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,

  project_number text not null unique
    default 'MK-' || lpad(nextval('project_number_seq')::text, 4, '0'),

  name text not null,
  description text,
  status project_status not null default 'backlog',
  current_phase design_phase,
  on_hold boolean not null default false,
  on_hold_since timestamptz,
  on_hold_reason text,
  start_date date,
  target_completion date,
  hours_per_week numeric(5,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint phase_matches_status check (
    (status = 'active' and current_phase is not null) or
    (status <> 'active' and current_phase is null)
  ),

  constraint hold_timestamp_matches_flag check (
    (on_hold and on_hold_since is not null) or
    (not on_hold and on_hold_since is null)
  )
);

create table project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase design_phase not null,
  assignee_id uuid references users(id) on delete set null,
  status phase_status not null default 'not_started',
  planned_start date,
  planned_end date,
  entered_at timestamptz,
  completed_at timestamptz,
  sort_order smallint not null,

  unique (project_id, phase)
);

create unique index one_active_phase_per_project
  on project_phases (project_id)
  where status = 'in_progress';

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_project_created
  on activity_log (project_id, created_at desc);

create table phase_subscribers (
  phase design_phase not null,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (phase, user_id)
);
```

**On `project_number` (new in 1.1).** §10 Q5 asked whether a project number was needed. It is: staff will say it out loud, put it in email subject lines, and name files with it. Store the ASCII hyphen (`MK-0418`) — if anything renders an en dash, that is a display concern, not a stored value, because an en dash breaks search and cannot be typed. The sequence default means the database assigns the number, so two staff creating projects simultaneously cannot collide, and the value is not editable. It is an identifier, not a field.

**On `on_hold_since` (new in 1.1).** Set when the flag goes true, nulled when false, enforced by the check constraint. Supports the §4.3 rule and the "how long has this been stuck" question that §1.1 identifies as the core problem.

`phase_subscribers` is the standing routing table: anyone subscribed to a phase is notified whenever a project enters it, on every project. A phase may have zero, one, or several subscribers.

This is distinct from `project_phases.assignee_id`, which records who owns that phase _on that specific project_. See §8.3 for how the two combine.

### 5.3 Phase 2 additions

```sql
create type notification_status as enum (
  'awaiting_approval', 'pending', 'sent', 'cancelled', 'expired', 'failed'
);
create type notification_audience as enum ('staff', 'customer');

create table notifications (
  id uuid primary key default gen_random_uuid(),
  project_phase_id uuid not null references project_phases(id) on delete cascade,
  audience notification_audience not null,

  -- Exactly one of these is set, per the check constraint below
  recipient_user_id uuid references users(id) on delete cascade,
  recipient_customer_id uuid references customers(id) on delete cascade,

  -- Snapshotted at enqueue time so a later contact edit cannot redirect a queued send
  recipient_email text not null,

  idempotency_key text not null unique,
  status notification_status not null default 'pending',
  send_after timestamptz not null,
  approved_by uuid references users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),

  constraint one_recipient check (
    (audience = 'staff'    and recipient_user_id is not null and recipient_customer_id is null) or
    (audience = 'customer' and recipient_customer_id is not null and recipient_user_id is null)
  )
);

create index notifications_pending
  on notifications (send_after)
  where status = 'pending';
```

Customer notification opt-out, defaulting to on:

```sql
alter table customers
  add column notify_on_phase_change boolean not null default true;

alter table projects
  add column notify_customer boolean not null default true;
```

A customer email is sent only when **both** flags are true. Customer-level is the standing preference; project-level is the per-job override (useful for internal projects, or a sensitive job the client wants handled by phone).

Phase presentation metadata — a static lookup in application code, not a table:

```ts
const PHASE_PRESENTATION = {
	schematic_design: {
		customerLabel: "Schematic Design",
		customerVisible: true,
	},
	design_development: {
		customerLabel: "Design Development",
		customerVisible: true,
	},
	construction_documents: {
		customerLabel: "Construction Documents",
		customerVisible: true,
	},
	review: { customerLabel: "Internal Review", customerVisible: false },
	permitting: { customerLabel: "Permitting", customerVisible: true },
} as const;
```

`customerVisible` controls whether entering that phase generates a customer email. `review` is provisionally excluded pending the §10 question about what it actually is — if it turns out to be client-facing design review rather than internal QA, flip it.

### 5.4 Row-level security

Single org, internal only. Policies are minimal:

```sql
alter table customers enable row level security;
alter table projects enable row level security;
alter table project_phases enable row level security;
alter table activity_log enable row level security;

-- Any authenticated, active user has full access
create policy "authenticated_full_access" on customers
  for all to authenticated using (true) with check (true);
```

Repeat for each table. Do **not** build tenant scoping, per-project ACLs, or ownership checks.

### 5.5 Activity log event types

| `event_type`             | `payload` shape                        |
| ------------------------ | -------------------------------------- |
| `project.created`        | `{}`                                   |
| `project.updated`        | `{ changed: { field: [old, new] } }`   |
| `phase.changed`          | `{ from, to, from_status, to_status }` |
| `phase.assignee_changed` | `{ phase, from_user_id, to_user_id }`  |
| `project.hold_toggled`   | `{ on_hold, reason }`                  |

---

## 6. Screens and functional requirements

### 6.1 Layout shell

Persistent left navigation rail, main content area on the right.

Nav items: **Board**, **Calendar**, **Customers**, and — for admins — **Settings**. Current user shown at the bottom with sign-out.

Rail is collapsible to icons only. On viewports under 1024px it collapses by default.

### 6.2 Board (`/`)

The primary view. Eight columns, horizontally scrollable.

**Column header** shows the column name and a count of cards. Columns are individually collapsible; collapsed state persists in localStorage. "Completed" is collapsed by default.

For the five phase columns, the header also carries a **subscriber control**: a small stacked avatar group showing who is notified when a project enters this column, with a `+` affordance when empty. Clicking opens a popover listing active users with checkboxes, writing to `phase_subscribers`. Admin-only for edits; visible read-only to staff.

Putting this on the column rather than in Settings is deliberate — it is discoverable exactly where the question arises ("who gets told when I drop something here?"), and it makes the routing legible at a glance rather than buried two screens away. The Settings screen shows the same data in table form for bulk editing.

Backlog, Pending, and Completed have no subscriber control in MVP.

**Card** displays, in this order:

- Project number
- Project name
- Customer name (secondary text)
- Assignee avatar for the current phase — falling back to the project's creator, muted, when no phase is running (Pending and the Active holding column always have `current_phase = null`; added 2026-08-22, see `handoff/CARD_CREATOR_APPLY.md`)
- Target completion date, color-coded: neutral if more than 14 days out, amber within 14 days, red if past
- Hours/week, if set
- On-hold indicator if applicable

**Drag behavior:**

- Dragging a card to a new column changes its board position
- Dropping into a phase column sets `status = 'active'` and `current_phase` to that phase
- Dropping into backlog / pending / completed sets `status` accordingly and nulls `current_phase`
- Non-adjacent moves are permitted
- Optimistic UI update, rollback with a toast on server error

**Toolbar:** text search across project number, project name, and customer name; filter by assignee; toggle to show/hide on-hold projects; "New project" button.

#### Acceptance criteria

- [ ] Board renders all projects in the correct column per §4.2 derivation rule
- [ ] Dragging a card between columns persists and survives a page refresh
- [ ] Dragging writes a `phase.changed` row to `activity_log` with the acting user
- [ ] Dropping into a phase column closes the previously `in_progress` phase row (`status = 'completed'`, `completed_at = now()`) and opens the new one (`status = 'in_progress'`, `entered_at = now()`)
- [ ] Skipped phases between the old and new position are marked `skipped`
- [ ] The one-active-phase index is never violated under concurrent drags
- [ ] On-hold cards render dimmed and sort first within their column
- [ ] Search filters cards live with no page reload
- [ ] Empty columns render a visible drop target
- [ ] Phase column headers show current subscribers as an avatar stack
- [ ] Admins can add and remove subscribers from the column header popover; staff see it read-only
- [ ] A phase with zero subscribers renders a visible warning affordance in the header

### 6.3 Project detail (slide-over panel)

Opens as a right-side slide-over, **not** a route change — the board stays visible behind it. Deep-linkable via `?project={id}` so URLs are shareable.

**Sections:**

1. **Header** — project number, project name (inline editable), customer name (links to customer detail), current phase badge, on-hold toggle
2. **Details** — description, start date, target completion, hours/week. All inline editable.
3. **Customer** — read-only summary of name, contact name, email, phone. Link to full customer record.
4. **Phases** — a list of all five phases in order. Each row shows phase name, status, assignee (editable dropdown of active users), planned start and end dates (editable). The current phase is visually emphasized.
5. **Activity** — reverse-chronological log, human-readable ("Chris moved this from Design development to Construction documents · 2 days ago")

#### Acceptance criteria

- [ ] Panel opens without losing board scroll position
- [ ] `?project={id}` on a fresh page load opens the panel for that project
- [ ] Every editable field saves on blur and shows a save indicator
- [ ] Changing a phase assignee writes `phase.assignee_changed` to the activity log
- [ ] Toggling on-hold prompts for an optional reason, sets or clears `on_hold_since`, and logs the change
- [ ] Escape key and backdrop click close the panel

### 6.4 Customers (`/customers`)

**List view:** table of customers with columns for name, contact name, contact email, total project count, and active project count. Sortable by name and by active count. Search by name. "New customer" button.

**Detail view (`/customers/[id]`):** customer contact information at the top (editable), followed by a list of their projects. Each project row shows project number, name, current phase badge, target completion, and current-phase assignee. Clicking a project opens the same slide-over panel from §6.3.

#### Acceptance criteria

- [ ] Customer list shows accurate project counts
- [ ] Clicking a project on the customer detail page opens the project slide-over
- [ ] The slide-over is the identical component used on the board — no duplicate implementation
- [ ] Deleting a customer with projects is blocked with a clear error (FK is `on delete restrict`)
- [ ] Contact fields are editable inline and save on blur

### 6.5 Calendar (`/calendar`)

A **horizontal timeline**, not a month grid.

- Rows are projects; columns are weeks
- Each project renders as a segmented bar, one segment per phase, positioned by `planned_start` and `planned_end` from `project_phases`
- Segment color indicates phase; completed phases render at reduced opacity
- Today is marked with a vertical line
- A project with no phase dates set renders a single muted bar spanning `start_date` to `target_completion`
- Horizontal scroll and a zoom control for weeks / months
- Clicking a bar opens the project slide-over

Phase dates are **not** required. The calendar must degrade gracefully when they're absent — this is the common case at launch.

#### Acceptance criteria

- [ ] Timeline renders all non-completed projects by default
- [ ] Projects with no dates at all are listed in a "No dates set" group below the timeline
- [ ] Clicking a bar opens the project slide-over
- [ ] Zoom persists across navigation

### 6.6 Settings (`/settings`, admin only)

- **Team** — list of users, invite by email, deactivate, change role
- **Phase subscribers** — a table of the five phases, each with its subscriber list. Same data as the board column popovers, in bulk-edit form. This is a convenience view, not the primary interface.

#### Acceptance criteria

- [ ] Non-admin users get a 403 on `/settings`
- [ ] Editing subscribers here and in the column popover produce identical results
- [ ] Deactivating a user removes them from all phase subscriptions
- [ ] Subscriber changes take effect immediately for future transitions and do not alter already-queued notifications

### 6.7 Client updates (`/client-updates`, Phase 2)

The approval queue for customer emails. Kept deliberately minimal so it can be deleted cheaply if Merkhet later switches to auto-send.

**List:** drafts in `awaiting_approval`, newest first. Each row shows project name, customer name, phase, recipient email, and age. A count badge appears on the nav item when drafts exist.

**Detail:** the rendered email exactly as the customer will receive it, with **Send now** and **Discard** actions. No editing of the body — if the copy is wrong, the template is wrong, and that is a settings-level fix rather than a per-email one.

**History:** a secondary tab listing `sent`, `cancelled`, and `expired` rows with who approved each and when. This is the record of what clients were told.

#### Acceptance criteria

- [ ] Only rows in `awaiting_approval` appear in the pending list
- [ ] Send now sets `pending`, `send_after = now()`, and records `approved_by` and `approved_at`
- [ ] The preview renders with the same template code the worker uses — no separate preview implementation
- [ ] Drafts older than 7 days are marked `expired` by the daily job and move to History
- [ ] A draft whose project has since left that phase is auto-cancelled and shows a reason in History

---

## 7. Implementation slices

Each slice is independently shippable and sized for roughly one Cursor session. Build in order.

| #   | Slice                   | Deliverable                                                                                                                                  |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Project scaffold        | Next 16.3 App Router, Tailwind v4, shadcn/ui init with the KokonutUI registry, Motion, Supabase client, design tokens from §12.1, env config |
| 2   | Schema and RLS          | All migrations from §5, seed script with 2 users, 3 customers, 8 projects across varied columns                                              |
| 3   | Auth and shell          | Sign in / sign out, protected routes, left nav rail, empty page stubs                                                                        |
| 4   | Customers               | List, detail, create, edit. No project list yet.                                                                                             |
| 5   | Projects read-only      | Board rendering all eight columns with cards. No drag.                                                                                       |
| 6   | Project detail panel    | Slide-over with all sections, inline editing, deep link                                                                                      |
| 7   | Drag to advance         | dnd-kit wiring, phase transition transaction, activity log, optimistic update                                                                |
| 8   | Board toolbar           | Search, assignee filter, on-hold toggle, new project modal                                                                                   |
| 8.5 | Command palette         | ⌘K overlay, project and customer search, phase-move and create actions, keyboard-only operation (see §12.7)                                  |
| 9   | Customer → project link | Project list on customer detail, wired to the shared slide-over                                                                              |
| 10  | Calendar                | Timeline view with phase segments and zoom                                                                                                   |
| 11  | Settings                | Team management, phase subscribers table                                                                                                     |
| 12  | Polish                  | Empty states, loading skeletons, error boundaries, mobile behavior for the nav rail                                                          |

**Phase 2 slices:**

| #   | Slice                               | Deliverable                                                                                          |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 13  | Notifications schema + outbox write | `notifications` table, opt-out columns, subscriber-union recipient resolution, forward-only guard    |
| 14  | Worker and internal email           | Cron route, debounce re-check, Resend integration, internal template                                 |
| 15  | Customer email template             | Customer template, phase description copy, reply-to and BCC config, SPF/DKIM/DMARC setup             |
| 16  | Approval queue                      | `/client-updates` list, preview, send/discard, nav badge, staleness job                              |
| 17  | Preferences and unsubscribe         | Per-user opt-out, per-customer and per-project toggles, unsubscribe handling, failed-send visibility |

---

## 8. Phase 2 — notification design

### 8.1 Requirement

When a project enters a new phase, send **two** emails with different audiences and different content:

|               | Internal                                     | Customer                                        |
| ------------- | -------------------------------------------- | ----------------------------------------------- |
| Recipient     | Phase subscribers ∪ project-phase assignee   | Customer's contact email                        |
| Purpose       | "It's your turn to work on this"             | "Here's where your project is"                  |
| Content       | Full project context, deep link into the app | Project name and current phase only             |
| Fires on      | Every phase entry                            | Forward moves into customer-visible phases only |
| Send behavior | Auto-send after a 5-minute debounce          | Drafted, requires staff approval                |
| Opt-out       | Per user                                     | Per customer, with per-project override         |

The customer email is deliberately thin: **project name, the phase it has entered, and a short friendly description of what that phase means.** No dates, no assignees, no internal notes, no deep link. There is no customer login, so there is nowhere for a link to go.

### 8.1.1 Why customer email changes the design

An internal notification firing on a mis-drag costs someone thirty seconds of confusion. A customer notification firing on a mis-drag means Merkhet has told a client their project reached permitting when it hasn't. That asymmetry drives four rules:

1. **Forward-only.** Never email a customer when a project moves _backward_ in the sequence. Compare `sort_order` of the outgoing and incoming phase; if the new one is lower, enqueue nothing. Backward moves are corrections, and telling a client "your project has returned to schematic design" is never the intent.
2. **Skips do not fan out.** Dragging from Schematic design to Permitting sends one email about Permitting, not four about every phase crossed. The internal side marks the intermediate rows `skipped`; the customer side ignores them entirely.
3. **Nothing leaves the building unreviewed.** Customer emails are drafted, not sent. See §8.2.
4. **Every send is attributable.** `approved_by` and `approved_at` record who released each client email, so "did we tell them?" has an answer.

### 8.2 Customer emails require approval

Customer emails do not auto-send. Entering a customer-visible phase creates a **drafted** notification in `awaiting_approval`, which a staff member must review and release.

**Flow:**

1. Drag triggers the draft. Toast confirms: _"Moved to Construction Documents. A client update to jane@example.com is ready to review."_ with a **Review** action.
2. The draft appears in a pending-approval list and as an indicator on the project detail panel.
3. A staff member opens it, sees the exact rendered email, and either **Send now** (sets `pending`, `send_after = now()`, records `approved_by` and `approved_at`) or **Discard** (sets `cancelled`).
4. The worker only picks up rows in `pending`. Rows in `awaiting_approval` are invisible to it.

**Staleness.** Approval creates a failure mode auto-send does not have: drafts nobody actions. A daily job marks drafts older than 7 days as `expired`, and the pending list carries a count badge so it stays visible. An expired draft is not resurrected — if the client should have been told, someone can send manually.

**Reversibility.** Switching to auto-send later is a one-line change: enqueue with `status = 'pending'` and `send_after = now() + interval '30 minutes'` instead of `awaiting_approval`. Every other piece — the outbox, the worker, the idempotency key, the opt-out flags, the templates, the audit trail — is identical. The only thing discarded is the approval UI, and the toast's **Review** action becomes an **Undo** against the same `cancelled` status. Build the approval screen small for exactly this reason (see §6.7).

Internal emails do not require approval. They carry no external risk, and adding friction to a work-queue notification defeats its purpose.

### 8.2.1 Architecture — transactional outbox

Do **not** send email inline in the drag request handler. That couples user-facing latency to an external service and loses the send if the request fails partway.

**Step 1 — enqueue (synchronous, inside the phase change transaction):**

**Internal recipients** are the union of:

- every user in `phase_subscribers` for the incoming phase, and
- `project_phases.assignee_id` for that project and phase, if set

deduplicated by user id. One `notifications` row per resulting recipient:

- `audience` = `staff`
- `recipient_user_id`, `recipient_email` snapshotted
- `idempotency_key` = `staff:{project_id}:{phase}:{entered_at}:{user_id}`
- `status` = `pending`
- `send_after` = `now() + interval '5 minutes'`

If the union is empty, write a warning to the activity log rather than failing silently — a phase nobody is subscribed to is a configuration mistake worth surfacing.

**Customer recipient** — one row, only when **all** of the following hold:

- The move is forward (`sort_order` increases, or the project entered `completed`)
- `PHASE_PRESENTATION[phase].customerVisible` is true
- `customers.notify_on_phase_change` is true
- `projects.notify_customer` is true
- `customers.contact_email` is non-null and parses as an email

Then:

- `audience` = `customer`
- `recipient_customer_id`, `recipient_email` snapshotted
- `idempotency_key` = `customer:{project_id}:{phase}:{entered_at}`
- `status` = **`awaiting_approval`** (see §8.2)
- `send_after` = `now()`

Snapshotting `recipient_email` matters: if someone edits the customer's contact address while a notification is queued, it must go to the address that was correct when the decision was made, not silently redirect.

**Step 2 — deliver (asynchronous worker):**

A cron job runs every minute and:

1. Selects `pending` notifications where `send_after <= now()`, limit 50, `for update skip locked`
2. **Re-checks that the project is still in that phase.** If not, mark `cancelled` and move on.
3. Re-checks the opt-out flags for customer rows — a customer may have been switched off during the window
4. Renders the template for the row's `audience` and sends
5. Marks `sent` with `sent_at`, or `failed` with `error` on exception

Failures on customer rows should surface somewhere a human sees them. A bounced client email that fails silently is worse than no email at all, because staff believe the client was informed.

### 8.3 Why the five-minute delay

People drag cards to the wrong column and drag back. Without a debounce window, the assignee receives "you're up on construction documents" immediately followed by "never mind." The re-check in step 2 is what makes the delay meaningful — it silently cancels the notification rather than sending a correction.

Five minutes is a starting value. Make it an environment variable.

### 8.4 Idempotency

The unique constraint on `idempotency_key` guarantees that a worker crash mid-run, a retry, or a double-fired transaction cannot produce duplicate emails. The key includes `entered_at`, so a legitimate re-entry into the same phase later does produce a new notification.

### 8.5 Email content — internal

- **Subject:** `[Merkhet] {project name} is ready for {phase name}`
- **Body:** project name, customer name, phase entered, who moved it, target completion date, any phase planned dates, and a deep link to `/?project={id}`
- **From:** `Merkhet Projects <projects@{domain}>`
- **Footer:** link to notification preferences

Plain and functional. This is a work queue notification, not marketing.

### 8.6 Email content — customer

Warm, brief, and free of internal detail. The customer should finish reading in under fifteen seconds and know exactly one thing: what stage their project is in.

- **Subject:** `Your project has moved to {customer phase label}`
- **From:** `Merkhet <hello@{domain}>`
- **Reply-To:** a monitored human mailbox at Merkhet — **never** `noreply@`. Clients will reply to this email, and those replies must reach someone.

**Body structure:**

1. Greeting by contact first name, falling back to a neutral greeting when unknown
2. One line: _{Project name} has moved into {phase label}._
3. A short, plain-English description of what that phase means (see the copy below)
4. One line inviting them to reply with questions
5. Sign-off from Merkhet
6. Footer with the firm's name, and an unsubscribe link

**Phase descriptions — draft copy for client approval:**

| Phase                  | Customer-facing description                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Schematic Design       | We're developing the initial concepts and overall layout for your project — the big-picture ideas that everything else builds on. |
| Design Development     | We're refining the design and working through materials, systems, and detail. The concept is becoming a concrete plan.            |
| Construction Documents | We're preparing the detailed drawings and specifications your builder will work from.                                             |
| Permitting             | Your drawings have been submitted for permit review. Timing here depends on the local building department.                        |
| Completed              | Your project is complete. It's been a pleasure working with you.                                                                  |

Merkhet should review and rewrite this copy in their own voice — it is a starting point, not a specification. The structure and length are what matter.

**Explicitly not in the customer email:** target completion dates, assignee names, hours allocated, internal notes, project numbers, other projects, any link into the application, and any information about phases the project has skipped.

Withholding dates is deliberate. A date in a client's inbox becomes a commitment they will hold the firm to, and the whole point of the internal target date is that it moves. If Merkhet wants to communicate timing, that should be a considered decision per project, not an automatic consequence of a drag.

### 8.7 Compliance and deliverability

Customer email is transactional — it concerns an existing business relationship and carries no promotional content — so CAN-SPAM's commercial-message rules apply only lightly. Regardless, include a working unsubscribe that sets `customers.notify_on_phase_change = false`, and include Merkhet's physical business address in the footer. Both are cheap now and awkward to retrofit.

Sending to client domains means deliverability matters in a way internal mail does not. Before launch: configure SPF, DKIM, and DMARC on the sending domain, and send from a subdomain (`mail.{domain}`) so a deliverability problem cannot damage the reputation of Merkhet's primary domain.

### 8.8 Open decisions for Phase 2

These are deliberately unresolved and should be confirmed with Merkhet before slice 13:

**Internal:**

- Does the **outgoing** assignee get a "your phase is complete" confirmation?
- Do project leads want a **daily digest** instead of per-event email?
- What happens when the incoming phase has **no assignee**? (Recommendation: notify all admins.)

**Customer:**

- Should a customer email fire when a project reaches **Completed**? (Recommendation: yes, with distinct closing copy.)
- Should moving a project **on hold** notify the customer? (Recommendation: no — that is a conversation, not an automated email.)
- Should a copy of every customer email be **BCC'd to a Merkhet mailbox** so there is a record outside the app? (Recommendation: yes, though §6.7 History covers the in-app case.)
- **Resolved:** customer emails require approval rather than auto-sending. See §8.2.
- **Resolved:** one contact per customer. Customer email goes to `customers.contact_email` only.

---

## 9. Technical decisions

| Concern           | Choice                      | Rationale                                                                                                                                                   |
| ----------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework         | Next.js 16.3.0, App Router  | Instant Navigations and per-route shell prefetching suit a sidebar app where every click is a lateral move; Turbopack is the stable default                 |
| React             | 19.2                        | Ships with Next 16.3. View Transitions and `<Activity>` are directly useful here                                                                            |
| Runtime           | Node 20.9+, TypeScript 5.1+ | Hard requirements of Next 16                                                                                                                                |
| Hosting           | Vercel                      | Zero-config for Next.js; cron routes cover the Phase 2 worker without a separate service                                                                    |
| Database + auth   | Supabase                    | Postgres with RLS, auth included, no separate auth service to run                                                                                           |
| Styling           | Tailwind CSS v4             | Required by KokonutUI; CSS-variable-native theming                                                                                                          |
| Component base    | shadcn/ui                   | Source lives in the repo, no runtime dependency, fully restyleable                                                                                          |
| Component accents | KokonutUI, selective        | Installs through the same shadcn registry; its animations are already built on Motion, so it composes rather than conflicts. Cherry-picked only — see §12.5 |
| Animation         | Motion (`motion/react`)     | Declarative and tied to React state; layout animations are the core of the board experience. See §12                                                        |
| Drag and drop     | dnd-kit                     | Accessible by default, keyboard support, composes cleanly with Motion's `layout` prop                                                                       |
| Icons             | Lucide                      | KokonutUI's dependency; uniform line weight suits the design direction                                                                                      |
| Email (Phase 2)   | Resend + React Email        | Simple API, templates authored in the same component model                                                                                                  |
| Worker (Phase 2)  | Vercel Cron                 | Single-org volume does not justify a separate service                                                                                                       |

**Not used: Anime.js.** Evaluated and rejected — see §12.4.

**State management:** none. Server components plus server actions plus `useOptimistic` for the board. Do not introduce Redux, Zustand, or React Query unless a specific need emerges.

**Realtime:** out of scope for MVP. Merkhet's team is small enough that stale board state is not a practical problem. Supabase Realtime can be added later without schema change.

### 9.1 Next.js 16.3 specifics

Verified against the bundled documentation in `node_modules/next/dist/docs/`. Re-check if the Next version moves.

**Async `params` and `searchParams`.** Both are Promises in Next 16 and must be awaited. This affects `/customers/[id]` and the `?project={id}` deep link on the board.

**Edge runtime is deprecated as of the 16.3 line.** Do not add `export const runtime = 'edge'` anywhere.

**Node 18 is no longer supported.** The floor is Node 20.9.0 LTS.

### 9.2 Corrections to v1.0 (verified)

Three claims in v1.0 §9 were wrong in ways that would surface during slice 1.

**Instant Navigations require Cache Components.** v1.0 said to wrap route content in `<Suspense>` and "use the `instant()` test helper to verify each route," implying both are available by default. Neither is. The validation apparatus is gated on `cacheComponents: true` in `next.config.ts`, and `instant()` ships in the separate `@next/playwright` package alongside `@playwright/test` — it is an end-to-end test helper, not a unit-test utility.

```ts filename="next.config.ts"
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	cacheComponents: true,
};

export default nextConfig;
```

With Cache Components on, validation runs on every Page and Default segment in development and surfaces anything that would block a navigation. `export const instant = false` opts a page or layout out.

**The auth cookie is the real constraint here.** Anything reading `cookies()` or `headers()` cannot be part of the static shell, and this app is cookie-authenticated on every route. The tool is the `"use cache: private"` directive, which caches in the browser only and, given a `stale` time of at least five minutes, lets the App Shell carry session-dependent content ahead of the click. Worth planning into the board rather than discovering in slice 5. Cache Components also requires the Node.js runtime, which reinforces the edge-runtime point above.

**React Compiler is stable but not enabled by default.** v1.0 listed it as a reason to choose Next 16, saying it "auto-memoizes the board's card list." It will not do so for free: it requires installing `babel-plugin-react-compiler` and setting `reactCompiler: true`, and it measurably increases dev and build times because it runs through Babel. Treat it as a slice 12 optimization to be measured, not a slice 1 assumption. Under 1,000 projects (§11), the board is unlikely to need it.

---

## 10. Open questions

Blocking questions to resolve with Merkhet before or during the relevant slice.

### High priority

1. **Does the phase list match reality?** The proposed sequence (schematic design → design development → construction documents → review → permitting) is close to but not identical to AIA standard, which runs schematic design → design development → construction documents → bidding/negotiation → construction administration.
    - **What is "review"?** Internal QA/QC before documents go out, or client review of the design set? If it is internal QA that recurs after _every_ phase, it belongs as a checklist item on each phase, not as a standalone column.
    - **Where is construction administration?** If Merkhet's involvement continues through construction, `completed` is currently hiding months of billable work with real deadlines.
    - **Where does pre-design / programming live?** This may be what `backlog` is actually holding.

2. **What does "pending" mean?** Currently undefined, which means it will become a junk-drawer column used inconsistently. Working assumption: signed but not yet started, awaiting a prerequisite (deposit, survey, site selection). If confirmed, rename the column to something concrete such as **"Awaiting kickoff."** If it actually means "stalled mid-project," it is a flag rather than a column and the model changes.

3. **Do all projects run the same five phases?** Assumption for MVP is yes, with skipping allowed. If different project types (new build, tenant improvement, feasibility study, permit-only) run different phase sets, that is a Phase 3 addition: a `project_types` table and a `phase_templates` table, changing only _which_ `project_phases` rows are seeded at creation. Seeding phase rows in the MVP is what keeps this additive rather than a migration.

### Lower priority

4. Should completed projects be archived out of the board after some period, or accumulate indefinitely?

5. Are there project attributes not yet captured — address, square footage, permit jurisdiction? These are cheap to add now and awkward to retrofit into forms later. **Project number is resolved** and now in the schema (§5.2); see Q5a.

5a. **What is Merkhet's existing project numbering?** Three things need confirming before the slice 2 migration runs: whether the `MK-` prefix is right, how many digits, and what value `project_number_seq` should start at so new projects continue the existing series rather than colliding with it. If the current numbering encodes anything — year, project type, office — say so now, because a smart key is a different design than a counter.

6. **Does Merkhet need more than one contact per customer?** Resolved for notification purposes — customer updates go to a single `contact_email`. Still worth asking whether they need to _record_ additional contacts (owner, client-side PM, GC) for reference, even if only one receives email. If yes, that is a `customer_contacts` table with a `is_primary` flag, and it is cheaper to add in slice 4 than later.

7. **Is `review` internal or client-facing?** Now consequential in three places: whether it is a board column at all (Q1), whether entering it generates a customer email, and whether it needs phase subscribers. Currently set to `customerVisible: false` on the assumption it is internal QA.

8. **Who approves client updates?** Anyone on staff, or admins only? The PRD currently allows any staff member. If Merkhet wants principal-only approval, that is a role check on the send action.

---

## 11. Assumptions of record

Documented so they can be challenged rather than silently inherited.

- Single organization. No tenancy model, no `org_id`.
- Internal staff only. Customers never authenticate.
- A project is in exactly one phase at a time.
- Fewer than 50 concurrent users and fewer than 1,000 projects. No pagination or virtualization required in MVP.
- No data migration from an existing system; projects are entered manually at launch.
- English only, single timezone (America/Chicago). The mockup's UK content is placeholder and carries no requirement.

---

## 12. Design direction and motion

### 12.1 Aesthetic thesis

Merkhet is an architecture firm. Their people spend all day inside drawing sets — hairline linework, title blocks, sheet indexes, dimension strings, red pen on check prints. That vocabulary is the source material, and it earns its place here for a functional reason as well as a visual one: this is a dense information tool, and drafting conventions are what precision-under-density looks like when it's done right.

The direction is **drafting-precise, not blueprint-kitsch.** No cyan grids, no faux paper texture, no drop shadows pretending to be depth. Hairline rules, a disciplined grid, tabular numerals, and one color used like a red pen.

**Palette** — two colors and a neutral ramp. Nothing else.

```css
--paper: #fbfbfa; /* page */
--surface: #ffffff; /* cards */
--rule: #e4e4e1; /* hairlines, 1px, everywhere */
--rule-strong: #c9cac5;
--ink: #16181a; /* primary text */
--ink-mid: #5f6469; /* secondary text */
--ink-soft: #8e9298; /* hints, disabled */

/* Phase ramp — ONE hue, five values. Progression reads as progression. */
--phase-1: #d7e4e2; /* schematic design */
--phase-2: #a8c6c2; /* design development */
--phase-3: #6fa29c; /* construction documents */
--phase-4: #3d7a74; /* review */
--phase-5: #1b5450; /* permitting */

--redline: #c8382a; /* overdue, on hold, destructive — the red pen */
--focus: #1b5450; /* focus rings, primary actions */
```

The phase ramp is the one decision to defend hardest. Five arbitrary hues is what every kanban tool does, and it's wrong here: phases are a **sequence**, and a rainbow encodes no order. A single hue darkening left to right means someone can read progress off the board's color alone, from across the room, without learning a legend. Backlog and Pending sit outside the ramp in neutral gray; Completed sits outside it in `--ink-soft`.

**Type** — two families.

- **Archivo** (variable, width axis) for UI and display. Grotesk with a technical spine; the expanded width at small sizes and wide tracking makes column headers read like title-block lettering.
- **JetBrains Mono** for all numerics — dates, hours, project numbers, counts. Functional first: monospace numerals align in columns and stop dates from jittering as they update. It also happens to look like a dimension string.

Scale: 11px mono labels / 13px body / 15px card titles / 20px page titles. Column headers 11px Archivo Expanded, uppercase, 0.08em tracking. That is the only uppercase in the product.

**Signature element — the phase rule.** Every project card carries a five-segment hairline bar beneath its title, one segment per phase, filled through the current phase in the ramp colors. It is a drawing-set index in miniature: at a glance you know not just where a project is but how far through the sequence it sits, even on the customer detail page where there is no board to give it context. It is also the element that animates on a phase change — segments fill in sequence as the card lands in its new column.

Everything else stays quiet. One accent, one signature, hairlines and whitespace doing the rest.

### 12.2 Motion principles

Motion here is functional, not decorative. Every animation answers a question the user would otherwise have to work out: what just moved, where did it come from, what is loading, what did I just cause.

1. **Motion tracks causality.** If the user caused it, animate it. If the server caused it, animate it more slowly so it reads as arriving rather than responding.
2. **Springs for anything spatial, tweens for anything visual.** Motion does this by default. Do not override it.
3. **Nothing over 300ms** except the deliberate phase-rule fill on a successful move, which is allowed 500ms because it is a small reward.
4. **`prefers-reduced-motion` is respected globally** via `<MotionConfig reducedMotion="user">` at the root. This is not optional.
5. **No ambient animation.** No floating shapes, no gradient drift, no looping backgrounds. Staff look at this screen for eight hours; anything that moves without being asked becomes an irritant by week two.

### 12.3 Motion features and where each applies

| Feature                              | Where                                                         | Why                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `layout` prop                        | Board cards                                                   | When a card leaves a column, the cards below close the gap smoothly instead of snapping. This is the single highest-value animation in the product — it makes the board feel like objects rather than a re-rendered list |
| `layoutId`                           | Card → detail panel                                           | The card's title and phase rule morph into the panel header, so the panel is visibly _that project_ opening rather than a generic drawer appearing                                                                       |
| `AnimatePresence`                    | Slide-over, toasts, modals, drafts leaving the approval queue | Exit animations. Without it, dismissing anything is a hard cut                                                                                                                                                           |
| `whileHover` / `whileTap`            | Cards, buttons, column subscriber avatars                     | A 1.01 lift on hover and a 0.98 press on tap. Small enough to feel like physics, not decoration                                                                                                                          |
| `useOptimistic` + `layout`           | Drag to advance                                               | The card lands in the new column instantly and the phase rule fills; rollback on server error animates it back, which reads as a genuine failure rather than a glitch                                                    |
| `AnimatePresence` `mode="popLayout"` | Column card counts                                            | Counts increment without layout jump                                                                                                                                                                                     |
| `useReducedMotion`                   | Phase rule, drag feedback                                     | Swap the fill animation for an instant state change                                                                                                                                                                      |
| `MotionConfig`                       | Root layout                                                   | Global reduced-motion and default transition config in one place                                                                                                                                                         |
| `LazyMotion` + `domAnimation`        | Root                                                          | Cuts the Motion bundle to roughly a third by loading only DOM features                                                                                                                                                   |
| Stagger via `delay`                  | Board first paint, calendar bars                              | Cards enter in a 20ms cascade per column. Enough to feel composed, short enough not to delay work                                                                                                                        |

**Deliberately not used:** `useScroll` and scroll-linked parallax (no scroll narrative in an app), `Reorder` (dnd-kit owns dragging), SVG path drawing, and every Motion+ paid component. `AnimateNumber`, `Ticker`, `Typewriter`, and `ScrambleText` are all behind Motion+ and none is worth a license for an internal tool.

### 12.4 Anime.js — evaluated and rejected

Anime.js v4 is excellent, and it is the wrong second dependency here.

The overlap is near-total for this application's needs. Anime.js ships `Layout` (competing with Motion's `layout`), `Draggable` (competing with dnd-kit), springs, staggers, and timelines. Shipping both means two animation runtimes, two easing vocabularies, two mental models for the same problems, and roughly double the animation bundle — in exchange for capabilities this app does not need.

Anime.js wins decisively in three areas: SVG path drawing (`createDrawable`), shape morphing (`morphTo`), and long imperative timeline orchestration. None of those appear in this product. The calendar is HTML bars, not SVG. There is no hero sequence to orchestrate. `splitText` and `scrambleText` are genuinely lovely and belong on a marketing site, not on a screen someone stares at all day.

**Revisit this decision if** Merkhet later wants a public marketing page for the tool, or the calendar moves to a true SVG Gantt with drawn dependency arrows. Both are real cases for Anime.js. Neither is in scope.

Choosing one animation library and using it well is what makes an interface feel coherent. Two libraries is how it starts feeling assembled.

### 12.5 KokonutUI — what to take and what to skip

KokonutUI installs through the shadcn registry as source into the repo, so every component is editable and there is no runtime dependency. Its animations are built on Motion, so it composes with §12.3 rather than fighting it.

The caveat that matters: **most of the library is designed for marketing sites.** Animated gradients, particle bursts, and shimmering text are built to impress a visitor in four seconds. This product is used for eight hours. Cherry-pick, restyle to the §12.1 tokens, and delete the rest.

**Take:**

| Category   | Use                                   | Why                                                                                           |
| ---------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Navigation | Left rail, collapsible behavior       | Solves the collapse/expand animation and the icon-only state well                             |
| Cards      | Base for the project card             | Structure and hover states; restyle entirely to the palette                                   |
| Inputs     | Command palette (⌘K), search, selects | The command palette is the highest-leverage single component in the whole product — see below |
| Buttons    | Primary actions                       | Take the press interaction; drop the particle variants                                        |

**Skip:** every Backgrounds component (animated gradients on a data-dense tool are noise), the AI category (not applicable), and Texts (animated headline effects belong on a landing page).

**The command palette deserves special mention.** For an internal tool used daily, ⌘K is the difference between software people tolerate and software people like. Typing a project name and hitting enter to open its panel — from any screen, without touching the mouse — is what makes power users feel fast. Scope it to: jump to project, jump to customer, move project to phase, create project, toggle on hold. This is worth adding as its own MVP slice.

### 12.6 Design acceptance criteria

- [ ] Every color in the app resolves to a token from §12.1; no ad-hoc hex values
- [ ] Phase colors form a single-hue value ramp, not a set of distinct hues
- [ ] All numerics render in the mono face with tabular figures
- [ ] `<MotionConfig reducedMotion="user">` wraps the root layout, and the board is fully usable with motion disabled
- [ ] No animation loops without user input anywhere in the product
- [ ] Focus rings are visible on every interactive element and use `--focus`
- [ ] The board is usable end to end by keyboard, including drag via dnd-kit's keyboard sensor
- [ ] Contrast meets WCAG AA on every text-on-color combination, including the two darkest phase segments
- [ ] `LazyMotion` is in place and the Motion bundle is verified below 20KB gzipped

### 12.7 Additional MVP slice

| #   | Slice           | Deliverable                                                                                     |
| --- | --------------- | ----------------------------------------------------------------------------------------------- |
| 8.5 | Command palette | ⌘K overlay, project and customer search, phase-move and create actions, keyboard-only operation |

Insert after slice 8. It depends on the board and detail panel existing, and everything after it benefits from having it.
