# CHANGES-2.md

Delta between the existing MVP and the workflow defined in `WORKFLOW-2.md`.

Read `WORKFLOW-2.md` first. It is the source of truth for behavior; this document is the
order of operations. Supersedes `CHANGES.md` (2026-08-11), which was written before Slice 0
recon and assumed a database existed.

Each slice below is sized for a single working session. Do one, verify it, commit, stop.
Do not chain slices in one pass — later slices depend on earlier ones being verified, not
merely written.

---

## Status

**Slice 0 (recon) is complete.** See `docs/handoff/SLICE0_RECON.md`.

**Slice 1A is complete (2026-08-12).** Hosted Supabase + Auth + seeded data; demo store no longer serves reads/writes. Verified: auth, board, create, drag persist, detail, hold, restart survival.

**Slice 1B is complete (2026-08-12).** Workflow schema applied; re-seeded. Board columns:
Pending / Active / SD / DD / Review / CD / Final Review / Permitting. No backlog.
Verified: 20 projects × 6 phases, 5 pending, 0 backlog, `final_review` present.

**Slice 2 is complete (2026-08-12).** Private `contracts` bucket; Pending exit only via PDF
upload → Active; View PDF via signed URL; drag/⌘K blocked without contract; Active notify stub.

**Slice 3 intake expansion was reverted (2026-08-12)** — does not match client direction yet.
Hold until requirements are clarified.

**Slice 4 (Delegation) skipped (2026-08-12)** — not needed for current client direction.
Leftover Slice 4 files removed.

**Slice 7 (Consultants) is complete (2026-08-12).** Directory + attach/create from project
detail; no new SQL (1B schema).

**Slice 8 (Permitting exit + archive) is complete (2026-08-12).** Mark Complete on Permitting
(confirm modal) → `status=completed` + `archived_at`; off board; `/completed` list. No new SQL.

**Also (2026-08-12):** dark theme default + nav Light/Dark toggle; Settings nav renamed to
**Staff** (`/staff`); env keys `*_MERKET_*`.

**Next:** Slice 5 (approvals) if needed without full delegation, or Slice 6 notifications,
or confirm Slice 3 / 9 / 10 with the client.

### Execution order

| Order | Slice                                      | State                         |
| ----- | ------------------------------------------ | ----------------------------- |
| 1     | 1A — Supabase connection + baseline schema | **Done**                      |
| 2     | 1B — Workflow schema migration             | **Done**                      |
| 3     | 2 — Pending→Active gate + contract upload  | **Done**                      |
| 4     | 3 — Intake form expansion                  | **Reverted — on hold**        |
| 5     | 4 — Delegation                             | **Skipped**                   |
| —     | 7 — Consultants                            | **Done**                      |
| 8     | 8 — Permitting exit + archive              | **Done**                      |
| 6     | 5 — Approval gates + rework loops          | Open                          |
| 7     | 6 — Notifications                          | Open                          |
| 9     | 9 — Staff view                             | Confirm need first            |
| 10    | 10 — Calendar                              | Blocked: Austin               |

---

# Slice 1A — Supabase connection and baseline schema

**Unblocked. Do this first.** No workflow changes in this slice — the goal is to get the
_existing_ app running against a real database with identical behavior. Any behavior change
here is a bug.

## 1A.1 — Config

Create `.env.local` in the project root. Values come from the Supabase dashboard under
**Project Settings → API**.

```bash
# .env.local  — do not commit
NEXT_PUBLIC_SUPABASE_URL=<PASTE: Project URL, e.g. https://xxxxxxxxxxxx.supabase.co>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<PASTE: anon / public key>

# Server-only. Never prefix with NEXT_PUBLIC_. Only needed if a slice requires
# bypassing RLS (seeding, admin scripts). Leave unset until something needs it.
SUPABASE_SERVICE_ROLE_KEY=<PASTE: service_role key — optional>
```

Add `.env.local` to `.gitignore` if it is not already there. Commit a
`.env.local.example` with the same keys and empty values.

## 1A.2 — Packages

```bash
npm install @supabase/supabase-js @supabase/ssr
```

`@supabase/ssr` is required for Next.js App Router — cookie-based sessions work across
server components, server actions, and route handlers. Do not use the deprecated
`auth-helpers-nextjs`.

## 1A.3 — Clients

Two clients, two files. Server actions use the server client; anything in a client
component uses the browser client.

**`lib/supabase/client.ts`** — browser:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
	return createBrowserClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
	);
}
```

**`lib/supabase/server.ts`** — server components, actions, route handlers:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
	const cookieStore = await cookies();

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll: () => cookieStore.getAll(),
				setAll: (cookiesToSet) => {
					try {
						cookiesToSet.forEach(({ name, value, options }) =>
							cookieStore.set(name, value, options),
						);
					} catch {
						// Called from a Server Component — safe to ignore when middleware
						// is refreshing the session.
					}
				},
			},
		},
	);
}
```

`cookies()` is awaited — required in Next.js 15+.

## 1A.4 — Apply the baseline migration

`supabase/migrations/20260807100000_init.sql` has never been run. Apply it **as-is**, before
any workflow changes. This gives a database that matches what the app already expects.

Either path works; no Docker required:

**Dashboard (simplest):** SQL Editor → New query → paste the full contents of
`20260807100000_init.sql` → Run.

**CLI (preferred if you want migration history tracked):**

```bash
npx supabase link --project-ref <PASTE: project ref from the dashboard URL>
npx supabase db push
```

Verify afterward that all six tables exist: `users`, `customers`, `projects`,
`project_phases`, `activity_log`, `phase_subscribers`. Confirm the `after insert` trigger on
`projects` seeds phase rows, and that the `MK-nnnn` sequence assigns project numbers.

## 1A.5 — Swap the repo layer

`lib/db/repo.ts` is the seam. Every read and write already routes through it
(`app/actions/* → repo.ts → demo-store.ts`), so this is the only file whose internals change.

Reimplement each `repo.ts` function against Supabase, keeping **the same signatures and
return shapes**. Callers in `app/actions/*` should not need edits. If a caller needs
changing, the return shape drifted — fix the repo, not the caller.

Keep `demo-store.ts` in the tree until 1A is verified. Delete it in the 1A commit only after
parity is confirmed.

Note `applyPhaseMove` — it currently mutates several rows in sequence with no transaction,
because there was no database. With Postgres available, wrap it so a partial phase move
cannot persist. This is the one place where "identical behavior" means identical _outcomes_,
not identical implementation.

## 1A.6 — Auth

`users.id` is a FK to `auth.users`. Creating an application user requires a matching
Supabase auth user. Confirm how the existing app authenticates before wiring this — if the
MVP has no real login, sign-in may need to land here rather than being assumed.

RLS is currently `authenticated_full_access` on every table — a placeholder, not the PRD §5.4
design. Leave it as-is for now; tightening it is its own slice and does not belong here.

## 1A.7 — Seed

Port the demo seed data so the board is not empty. Preserve the on-hold cases (`MK-0411`,
`MK-0415`) — they are the only coverage for that behavior.

## 1A.8 — Verification checklist

1A is done when all of the following hold against the real database:

- Board renders all columns with seeded projects
- Creating a project assigns an `MK-nnnn` number and seeds its phase rows
- Dragging a project between columns persists across a full page reload
- The detail sheet reads and writes
- The activity log records `phase.changed` with the correct `actor_id`
- On-hold set and clear both persist
- Customers list reads and writes
- **Data survives a dev-server restart** — the single clearest signal the demo store is gone

Do not proceed to 1B until every item passes.

---

# Slice 1B — Workflow schema migration

**Unblocked.** Task = phase; do **not** add a `tasks` table.

One new migration file on top of the baseline. Do not edit `20260807100000_init.sql`.

**Project fields** — add: client's desired completion date, project budget, design budget,
`client_contact_id` (FK `users`), archived state.

**Client fields** — add spouse name. Existing `notes` may serve as general comments; confirm
before adding a second field.

**Relabel** `customers.contact_name / contact_email / contact_phone` in the UI so they cannot
be read as the internal client contact (`WORKFLOW-2.md` §1).

**Phase enum reorder** — `SD → DD → Review → CD → Final Review → Permitting`. Review moves
from post-CD; Final Review is new. Blast radius: the SQL enum, `DESIGN_PHASES`,
`BOARD_COLUMNS`, `COLUMN_LABELS`, the seeding trigger's `sort_order`, board column order,
calendar row order, and `components/projects/phase-rule.tsx` (hardcoded to 5 segments; now 5
work phases + 2 gates).

**Board columns** — Pending, Active, SD, DD, Review, CD, Final Review, Permitting. Drop
Backlog; creation lands in Pending. Complete becomes an archive state, not a column.

**Delegation** — person + duration per phase on `project_phases`. Five delegated phases: SD,
DD, CD, Final Review, Permitting. Review is excluded — a gate with no delegate and no
duration.

**Approvals** — one row per required sign-off, per gate, per project: `project_id`, `phase`,
`party` (client_contact | austin | client), `status`, `approved_at`, `recorded_by` (FK
`users`). `recorded_by` is not optional — every sign-off is entered by a staff member,
including the client's.

**`phase_transitions`** — new append-only history table: from-phase, to-phase, actor,
timestamp, direction. `project_phases` keeps its `unique (project_id, phase)` constraint and
stays a one-row-per-phase state record (`WORKFLOW-2.md` §6).

**`phase_matches_status`** — rewrite. It currently forbids `status = 'active'` with a null
phase, which is exactly the Active holding state.

**Contract document** — reference to the uploaded LOI/contract on the project.
Single-purpose. Not a general file table.

**Consultants** — `consultants` table plus `project_consultants` join (schema only; UI is
Slice 7).

**Preserve on-hold** — flag, timestamp, reason, and `hold_timestamp_matches_flag` all stand
unchanged.

---

# Slice 2 — Pending → Active gate

Create a Supabase Storage bucket for contracts. Private, not public — these are signed
agreements.

Upload UI for LOI/contract on the project record. Upload success triggers the transition to
Active. No manual override.

Verify a project with no contract cannot be advanced by any path, board drag included.
`onDragEnd` (`components/board/board-view.tsx`) currently validates nothing.

Fires the Active notification (Ryan, Austin). Stub the call site if Slice 6 has not landed.

---

# Slice 3 — Intake form expansion

Surface the new client and project fields in the intake and project-edit forms. Client
contact is a staff picker, not free text — `new-project-dialog.tsx` currently conflates this
with the customer's own contact fields.

Cheapest slice once 1B lands.

---

# Slice 4 — Delegation

Form raised on entry to Active. Assigns person + duration to all five delegated phases in one
submission. Permitting duration has no default; require a value.

On submit: generate calendar entries into `project_phases.planned_start / planned_end`,
derived from durations. Review consumes no schedule time.

Gate the manual Active → SD move on delegation being complete.

Make the existing manual date inputs in `project-detail-sheet.tsx` read-only; remove
`updatePhaseDatesAction` from the UI path.

---

# Slice 5 — Approval gates and rework loops

Highest-risk slice. Depends on `phase_transitions` from 1B.

Review gate (post-DD): three sign-offs — client contact, Austin, client. All three required
to advance to CD.

Final Review (post-CD): two sign-offs — client contact, Austin.

Each records `recorded_by` and `approved_at`.

**Rejection** returns the project to the prior phase (Review→DD, Final Review→CD), clears
that gate's sign-offs, and shifts downstream dates.

First backward transition in the system. `applyPhaseMove` assumes forward movement and marks
intermediate phases `skipped`; that skip logic is illegal on gated transitions.

Test the loop **twice on the same project** — phase history and date recalculation both have
to survive a repeat.

---

# Slice 6 — Notifications

Greenfield: no provider, no outbox, no templates, no `notifications` table. Nothing to reuse
— `phase_subscribers` is demoted, not repurposed.

Implement the recipient table in `WORKFLOW-2.md` §4. Recipients resolve from per-project
delegates.

**Internal recipients only.** Client-facing email is deferred to Phase 2. Build the resolver
with a place for client recipients to slot in, and keep the send path structured so a
review-before-send step can be added with one change.

Reword the Settings tab and board column popover so `phase_subscribers` reads as a standing
baseline rather than the routing model.

---

# Slice 7 — Consultants

**Unblocked and fully independent.** Can run at any time, including alongside 1A — though the
table itself lands in 1B if 1B goes first.

Consultant directory (CRUD) plus a dropdown on project detail to attach existing consultants.
Attaching should not require leaving the project screen.

Clean slate — nothing built, nothing to unbuild.

---

# Slice 8 — Permitting exit and archive

**Status: Done (2026-08-12).** Manual Mark Complete on Permitting (confirm modal) →
`status=completed` + `archived_at`; off board; `/completed` list. No new SQL (uses existing
`move_project`). Role restriction to Austin/Ryan not enforced in app yet (any signed-in user
with write access can complete).

---

# Slice 9 — Staff view

**Confirm need before building** (`WORKFLOW-2.md` §8). May be redundant with the
staff-grouped calendar.

**Not the same as nav “Staff”** (`/staff`) — that page is admin Team + Phase subscribers
(former Settings). Slice 9 would be per-person workload of assigned phases across projects.

If built: derived from delegation. No new schema.

---

# Slice 10 — Calendar

**Blocked on Austin.** Do not build ahead of the spec.

Current signal: day-level resolution, groupable by staff member. Direction, not requirements.

---

## Housekeeping (fold into the 1A commit)

- Update `docs/handoff/DECISIONS.md` to scope document authority: `WORKFLOW-2.md` wins on
  workflow, phases, transitions, gates, approvals, and notification routing; `docs/PRD.md` is
  authoritative on everything else. Both files currently claim primacy, and the next session
  follows whichever it reads first.
- Update `docs/handoff/NEXT.md` — item 1 (wire Supabase) closes with 1A.
- Confirm all naming is **Merkhet**, and that references point to `docs/PRD.md`.

---

## Do not build

Left unspecified, these get invented.

- **Client portal, client login, magic links, external approval flows.** Every user is
  internal staff.
- **Client-facing email.** Deferred to Phase 2 (`WORKFLOW-2.md` §4).
- **General file/document management.** LOI and contract only.
- **Time entry, timesheets, rates, invoicing.** Phase 2. Planned hours from delegation
  durations only.
- **A `tasks` table** until the granularity question is answered.
- **A calendar implementation ahead of Slice 10.**
- **RLS policy work.** Placeholder policies stay until their own slice.
- **Multi-tenancy.** Single tenant.
- **Removal of the on-hold flag.** Preserved unchanged.
