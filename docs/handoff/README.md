# Merkhet session handoff

**Read this folder first** when starting a new agent session on Merkhet.
Start with [NEXT.md](./NEXT.md) — it opens with the resume state.

| File | Purpose |
|---|---|
| [NEXT.md](./NEXT.md) | **Start here.** Resume state, immediate actions, open questions |
| [CURRENT_STATE.md](./CURRENT_STATE.md) | What works today, how to run, env, slice status |
| [CHANGES-2.md](./CHANGES-2.md) | Workflow slice plan + status |
| [WORKFLOW-2.md](./WORKFLOW-2.md) | Authoritative workflow (phases, gates, notifications) |
| [DECISIONS.md](./DECISIONS.md) | Authority order, design refs, non-negotiables |
| [FILE_MAP.md](./FILE_MAP.md) | Where code lives |
| [SLICE_4_SCOPE.md](./SLICE_4_SCOPE.md) | Delegation spec — six settled decisions, build from this |
| [ACCOUNTS_APPLY.md](./ACCOUNTS_APPLY.md) | **Invite-only accounts, password reset, and the data wipe** |
| [SLICE_6_APPLY.md](./SLICE_6_APPLY.md) | **Notifications, wired** — outbox, provider, call sites, client copy |
| [PROJECT_CONTACT_APPLY.md](./PROJECT_CONTACT_APPLY.md) | Project vs customer address/contact |
| [GATE_PARTIES_APPLY.md](./GATE_PARTIES_APPLY.md) | Gate sign-offs = Austin · Ryan · chosen |
| [SLICE_5_APPLY.md](./SLICE_5_APPLY.md) | Approval gates + rework loops — gate table, rework checklist |
| [SLICE_6_TEMPLATES.md](./SLICE_6_TEMPLATES.md) | Email templates — routing decision, the three enforced rules, Gmail test result |
| [CARD_CREATOR_APPLY.md](./CARD_CREATOR_APPLY.md) | Board card avatar — assignee, falling back to `projects.created_by` |
| `SLICE_*_APPLY.md` | Manual SQL / verify checklists per slice |

## State as of 2026-08-22

**Board cards no longer read `—`.** The avatar is the current-phase assignee, which Pending
and the Active holding column cannot have — so every freshly filed project was anonymous.
`projects.created_by` was added and backfilled from the activity log; cards fall back to the
creator, outlined rather than solid. Applied and verified live (`npm run check:creator`).
[CARD_CREATOR_APPLY.md](./CARD_CREATOR_APPLY.md)

**Delete customer asks first** — a No/Yes modal, with **Yes** disabled when the customer has
projects, because the server refuses that anyway. Not yet clicked in a browser.

## State as of 2026-08-21 (evening)

⚠️ **The hosted database was wiped of demo data.** The firm is entering real records. One
account survives — `christopher.vo.h@gmail.com`, promoted staff → admin. The
`chris@merkhet.studio` / `password` seed logins **no longer exist**, which breaks
`npm run check:gates` until it is repointed. [ACCOUNTS_APPLY.md](./ACCOUNTS_APPLY.md)

**Accounts are invite-only, and invites now work.** The old `inviteUser` minted a random
password and sent no email, so every account it created was unreachable. `/accept-invite`,
`/forgot-password`, `/reset-password` and `/auth/confirm` were added, with custom SMTP on
`merkhetdrafting.com`. **Still blocked:** `NEXT_PUBLIC_SITE_URL` and Supabase Site URL point
at `localhost`, so the links only work on the developer's machine — no staff member can be
onboarded until that changes.

**Slice 6 sends.** Recipient resolution, an `email_outbox` table, the Resend HTTP API and all
four call sites. Internal and customer mail both verified delivering in production. Client
mail carries **no dates or durations**, at the client's request.
[SLICE_6_APPLY.md](./SLICE_6_APPLY.md)

✅ **Every migration in the tree is applied and verified.** Nothing is waiting on SQL.

## State as of 2026-08-21 (earlier)

**Gate sign-offs changed shape.** Both Review and Final review now take **Austin, Ryan, and a
chosen third** — whoever Austin or Ryan picked, staff or the client. This **supersedes
WORKFLOW-2 §3**, including its rule that the client is not an approver at Final review.
[GATE_PARTIES_APPLY.md](./GATE_PARTIES_APPLY.md)

Both gate-parties migrations (`20260821120000_gate_parties_enum.sql`, then
`20260821120100_gate_parties.sql`) are **applied and verified** — as is
`20260821100000_project_address_contact.sql`.

**Project address and contact** was added the same day. A project's address, contact, email
and phone now live on `projects`, and **null on a field means "same as the customer"** —
resolved per field, with no `uses_customer_contact` flag. `WORKFLOW-2.md` §3 had listed both
the client address and the project address since the start; neither column existed.

`20260821100000_project_address_contact.sql` is **applied and verified** (2026-08-21).
[PROJECT_CONTACT_APPLY.md](./PROJECT_CONTACT_APPLY.md)

**Slice 9 — the per-staff workload view — was built.** A **This week** column on the Team
table on `/staff`, inheriting the page's admin gate; clicking a person expands their projects
under their row. Per person: their `in_progress`
phases, plus a weekly total for the week containing today
(`planned_hours / (duration_days / 5)`, summed over the phases overlapping that week).
**Derived from delegation — no migration, no schema change.**

It also settles what the planned-hours number is *for*: **capacity planning**. That had been
`NEXT.md`'s standing open question; the reasoning is in [DECISIONS.md](./DECISIONS.md).

The column reads sparse because the data is — delegation is backfilled on ~22% of phase rows
— and it says so rather than papering over it. An assigned, in-progress phase with no budget
reads **"Not planned", never `0h`**.

Arithmetic in `lib/workload.ts`, React-free, covered by `npm run check:workload` (65
assertions, now inside `npm run check`).

## State as of 2026-08-18

> **Superseded.** Slice 6 is wired and sending as of 2026-08-21 —
> [SLICE_6_APPLY.md](./SLICE_6_APPLY.md).

The **template half of Slice 6** was built on 2026-08-18: `lib/email/`, four templates,
11 events, 16 messages, two harnesses. **No SQL and nothing wired into the app** —
`lib/notifications.ts` is still a stub. A Gmail send test delivered and landed in spam;
authentication passed, so the cause is sender reputation, not the templates.
See [SLICE_6_TEMPLATES.md](./SLICE_6_TEMPLATES.md). Not committed.

## State as of 2026-08-14

Four slices were built: **11** (planned hours per phase), **4** (delegation), **10** (calendar:
day resolution + staff grouping) and **5** (approval gates + rework loops). All three
migrations are **applied and verified against hosted Supabase**; Slice 10 needed no SQL. The
calendar and the approvals UI have both had a visual pass.

**Committed as `f8d0526`** (local only, not pushed). File list in [NEXT.md](./NEXT.md).

Slice 5 also fixed a **pre-existing `move_project` bug** that had been shipping — an unordered
phase loop could leave two rows `in_progress` at once and trip
`one_active_phase_per_project`, showing up as an intermittent failed drag on longer-lived
projects. [SLICE_5_APPLY.md](./SLICE_5_APPLY.md) §3a.

Nothing built that day is outstanding. **Slice 6 (notifications)** followed on 2026-08-18 —
templates only; the provider, outbox and call sites followed on 2026-08-21.

**Product requirements (authoritative for non-workflow):** [`../PRD.md`](../PRD.md)  
**System design reference:** [`../SYSTEM_DESIGN_REFERENCE.md`](../SYSTEM_DESIGN_REFERENCE.md) — general reference, **not** Merkhet architecture.  
**Prior Cursor chat:** [Merkhet MVP build](4683eef9-6229-44ff-957a-96f80cda6207) (agent transcript id)

## Traps that have already cost time

Each is written up in [DECISIONS.md](./DECISIONS.md). Read them before touching the relevant area:

- `components/ui/*` are **Base UI, not Radix** — `<SelectValue />` renders raw values without `items` on the Root
- tailwind-merge keys on the **full variant prefix**, so `sm:max-w-*` does not override `data-[side=right]:sm:max-w-*`
- `<LazyMotion strict>` at the root — `motion.*` throws, use `m.*`
- Seed / `.env` changes need a **process restart**, not a hot reload
- Hydration and Cache Components errors never appear in a `curl` — the route still returns 200
- Uncached Supabase reads must sit inside `<Suspense>` — and *inside* means in a child that
  suspends. An `await` in the default export resolves before the boundary is reached, so a
  `<Suspense>` further down does nothing. This bit four routes on Aug 14; see NEXT.md
- Phase dates are **derived from durations**, never hand-entered (WORKFLOW-2 §3) — the
  inputs are read-only on purpose; edit via Plan schedule
- **Null means "same as the customer"** on the four `project_*` contact columns — there is
  deliberately no `uses_customer_contact` boolean, and the fallback is per field
  (`PROJECT_CONTACT_APPLY.md`). `projects.client_contact_id` is a different thing entirely:
  the *internal* staff member, not someone to phone
- Planned hours are **optional** by design; assignee and duration are not
  (`SLICE_4_SCOPE.md`). Do not make hours required, and do not default them from duration.
  Capacity planning being the answer to "what are they for" is an argument for filling the
  number in, not for fabricating it — **"not planned" is never `0h`**, in any view
- Approval rows exist **only when approved** — absence is pending, clearing is a `DELETE`.
  Never seed pending rows
- Gate parties are **Austin · Ryan · chosen** at both gates (2026-08-21), which contradicts
  WORKFLOW-2 §3 — the doc was not edited, `GATE_PARTIES_APPLY.md` is the record. On a
  `chosen` row, a null `approver_user_id` means **the client**
- Rejection is `reject_gate`, **not** `move_project` — the latter marks the phase being left
  `completed`, the opposite of what a rejection means
- `npm run check:gates` **writes to hosted Supabase** (one throwaway project, deleted after).
  It is not part of `npm run check` for that reason
- Client email routes off **`customerVisible` in `lib/phases.ts`**, not a list. There is no
  client copy for the approval gates and no customer variant of the rejection mail — those
  absences are the safeguard, not an oversight (`SLICE_6_TEMPLATES.md`)
- `npm run email:send` talks to **real Gmail**. Every recipient is overridden with
  `GMAIL_TEST_TO`, because two fixture addresses are on a live domain

Last updated: 2026-08-21
