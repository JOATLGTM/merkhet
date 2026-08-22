# Next / open gaps

Not committed as a formal backlog — use as a resume checklist.

**Last updated: 2026-08-22**

## ✅ No unapplied migrations

Every migration in `supabase/migrations/` is applied to hosted Supabase and was verified
column-by-column on 2026-08-21, including the gate-parties pair this file previously flagged
as outstanding and the two new email-outbox migrations. `20260822100000_project_created_by.sql`
was added and applied on 2026-08-22, verified by `npm run check:creator`.

> Verify with a round-trip insert, not `select … { head: true }`. A head count **returns no
> error for a table that does not exist** — during this session it reported `email_outbox` as
> present a full step before the table had been created. Check against a control table you
> know is absent.

## What happened on 2026-08-22

Two changes, both committed. No migrations outstanding — the one added this day is applied
and verified.

### Board cards showed `—` instead of a name

Reported from production: five colleagues had created projects and only the reporter's card
showed initials. **Not a data or permissions bug.** The circle is the current-phase assignee
(PRD §6.2), and Pending plus the Active holding column both carry `current_phase = null` by
construction, so there was no phase row to read an assignee from.

`projects.created_by` added and backfilled from the earliest `project.created` activity row
(`20260822100000_project_created_by.sql`, **applied + verified**). Cards now fall back to the
creator, outlined rather than solid so it never reads as an assignee. Verified live: 6/6
projects carry a creator, all matching the activity log. `npm run check:creator` re-runs it,
read-only. Detail in [`CARD_CREATOR_APPLY.md`](./CARD_CREATOR_APPLY.md).

**Still open:** the board builds `usersById` from `listUsers()`, which defaults to
`activeOnly = true`, so a **deactivated** assignee or creator still renders `—`. Nobody is
deactivated today, so `check:creator` passes and will fail loudly when that changes. The fix
separates "directory for name lookups" from "people you can assign" — do **not** just flip
the flag, the same `users` prop feeds the assignee filter and the sheet's assignee selects.

### Delete customer asks first

`Delete customer` on the customer detail page fired immediately on click. Now behind a No/Yes
modal matching Mark Complete. Because `deleteCustomer` refuses server-side when the customer
has projects, the dialog reads the count off the projects already in scope, says they must be
deleted or reassigned first, and disables **Yes** rather than failing into a toast.

**Not verified in a browser** — it compiles and lints clean, but nobody has clicked it.

## What happened on 2026-08-21 (evening session)

Three things landed, all committed and deployed to `merkhetdrafting.com`. **The database was
wiped of demo data** — read that section before trusting anything below dated earlier.

### ⚠️ The database is empty and the seed logins are gone

All demo data deleted; the firm is entering real records. **One account survives**,
`christopher.vo.h@gmail.com`, promoted staff → admin. `chris@merkhet.studio` / `password` and
the other four seed users **no longer exist**.

Knock-on effects on older instructions in this file:

- `npm run check:gates` signs in as `chris@merkhet.studio` — it will **fail** until repointed.
- "Backfill delegation on the 18 live projects" is moot; there are no such projects.
- `project_number_seq` reset to 400, so the first real project is MK-0400.

Script and full account is [`ACCOUNTS_APPLY.md`](./ACCOUNTS_APPLY.md).

### Accounts: invite and password reset

Invites were **silently broken** — `inviteUser` minted a random password and sent no email, so
every account it created was unreachable. Now sends a real invite; `/accept-invite`,
`/reset-password`, `/forgot-password` and `/auth/confirm` added. Custom SMTP (Resend, on
`merkhetdrafting.com`) is configured and sending.

**Blocking:** `NEXT_PUBLIC_SITE_URL` and Supabase **Site URL** still say `localhost:3000`, so
invite and reset links only work on the developer's machine — still reproducing as of the
2026-08-21 invite; see **Immediate** §1 for the exact dashboard fields. No staff member can be
onboarded
until that changes. See [`ACCOUNTS_APPLY.md`](./ACCOUNTS_APPLY.md).

### Slice 6 is done — notifications send

Recipient resolution, an outbox table, a provider and every call site. Internal **and**
customer mail verified delivering in production. Customer mail is gated behind
`EMAIL_CUSTOMER_ENABLED` and currently **on**.

Client-facing copy no longer carries dates or durations, at the client's request. Full write-up
in [`SLICE_6_APPLY.md`](./SLICE_6_APPLY.md), including two things to decide: gate email goes to
admins rather than the `austin`/`ryan` approval parties (nothing links them), and every column
move mails the customer — including backwards ones.

### Project address and contact

A project's address, contact, email and phone now live on `projects`, and **null on a field
means "same as the customer"**, resolved per field — no `uses_customer_contact` flag, because
the fallback is genuinely per field and a stored flag could disagree with the columns. The
create dialog opens with the box ticked and echoes the customer's real values; the detail
sheet's **Details → Address & contact** shows the resolved set, marks what came from the
customer, and asks before discarding an override. `customers.address` was a WORKFLOW-2 §3
field that had never been added.

Covered by `npm run check:contact` (23 assertions, inside `npm run check`).

### Gate sign-offs: Austin, Ryan, and a chosen third

**Both** Review and Final review now take the same three. The third is a slot, picked when the
sign-off is recorded from a dropdown of active staff plus **The client**; on the row,
`approver_user_id` names them and null means the client.

**This supersedes `WORKFLOW-2.md` §3** in three places, including its rule that the client is
not an approver at Final review. WORKFLOW-2 was not edited —
[`GATE_PARTIES_APPLY.md`](./GATE_PARTIES_APPLY.md) is the record, and it lists what to change
to put the client back as mandatory.

Any project already parked at a gate loses sign-off progress: Austin still counts, the old
client-contact row no longer does. The apply doc has a query to see whether that affects
anything before you run it.

`npm run check:gates` is updated for the new parties and exercises the chosen slot both ways
(a staff member, and the client). It writes to the live DB, so it is not part of `npm run
check`.

### Slice 9 — per-staff workload

A **This week** column on the Team
table on `/staff`, inheriting the page's admin gate; clicking a person expands their projects
under their row. No new tab, no new route, no nav change, no migration, no schema: it is
derived entirely from delegation.

Per person it lists every `project_phases` row where they are the assignee and the status is
`in_progress`, and totals a weekly load for the week containing today:
`planned_hours / (duration_days / 5)`, summed across the in-progress phases whose planned
range overlaps that week.

**This answers the open question this file had been carrying** — what the planned-hours number
is *for*. The answer is **capacity planning**. Recorded in
[`DECISIONS.md`](./DECISIONS.md); the question is gone from the section below.

The view reads sparse, and that is the data, not the view: delegation is backfilled on about
22% of phase rows and 29% are dated (`SLICE_11_APPLY.md`), and planned hours are optional by
design. A phase can be assigned, in progress and still yield no hours figure — it renders
"Not planned", never `0h`, and every such gap is counted next to the total it is missing
from. **Backfill (item 2 under Immediate) is what makes this column useful.**

Arithmetic lives in `lib/workload.ts`, React-free, covered by `npm run check:workload`
(65 assertions, now part of `npm run check`).

## What happened on 2026-08-18

> **Superseded 2026-08-21.** Everything below described the state when only templates
> existed. Slice 6 is now wired and sending — [`SLICE_6_APPLY.md`](./SLICE_6_APPLY.md).
> `lib/notifications.ts` is no longer a stub, and the provider is no longer blocked.

The **template half of Slice 6** was built — `lib/email/`, four templates, 11 events, 16
messages, plus two harnesses. No SQL, no migration, and **nothing wired into the app**:
`lib/notifications.ts` is the same stub it has always been.

A Gmail send test delivered successfully and **landed in spam**. Authentication passed
(`mailed-by` / `signed-by` both `gmail.com`); the cause is sender reputation, which no
template change fixes. Full write-up in [`SLICE_6_TEMPLATES.md`](./SLICE_6_TEMPLATES.md).

Copy is deliberately held as-is pending a conversation with the client. It lives in one file
(`lib/email/copy.ts`) so that conversation stays out of the code.

Not committed.

## Read this first if you are resuming

Four slices were built on 2026-08-14 (11, 4, 10, 5) and all of it is **committed as
`f8d0526`** (not pushed). All three migrations from that day are **applied to hosted Supabase
and verified**; Slice 10 needed no SQL. See "What landed in f8d0526" below for the file list.

Slice 5 also fixed a **pre-existing `move_project` bug** that had been shipping: an unordered
phase loop could leave two rows `in_progress` at once and trip
`one_active_phase_per_project`, surfacing as an intermittent failed drag on longer-lived
projects. `SLICE_5_APPLY.md` §3a has the detail. Worth mentioning to the client if anyone
reported a drag bouncing back.

All four slices are verified. The calendar and the Slice 5 approvals UI were checked visually
by the user on 2026-08-14; everything else was checked against the live database or by a
runnable script. Nothing built that day is outstanding.

## Immediate

1. **Point the deployed URLs at `merkhetdrafting.com`.** Still the thing blocking staff
   onboarding, now one field short of done.

   Two invites were sent on 2026-08-21 and each failed differently:

   - The first arrived at `http://localhost:3000/accept-invite#access_token=…` — Site URL was
     still localhost.
   - The second, after Site URL moved, arrived at
     `…/auth/v1/verify?token=…&redirect_to=https://merkhetdrafting.com` — **the bare origin,
     no `/accept-invite`.** That is Supabase replacing the app's `redirectTo` because the
     path is not in the **Redirect URLs** allowlist. It landed on `/`, the proxy bounced it to
     `/login?next=%2F` with the fragment still attached, and the invitee was shown a sign-in
     form asking for a password they had never set.

   A third invite settled it: `redirect_to=http://localhost:3000/accept-invite`, passed
   through **unsubstituted**. Supabase only substitutes what it rejects, so the allowlist was
   never the problem — Site URL and both Redirect URLs were already correct. The app was
   generating a localhost origin because `NEXT_PUBLIC_SITE_URL` was set nowhere at all.

   **Fixed locally 2026-08-21:** `.env` now sets `NEXT_PUBLIC_SITE_URL` and
   `NEXT_PUBLIC_APP_URL` to `https://merkhetdrafting.com` — deliberately production, even
   under `npm run dev`, because a real invite must never mail a localhost link. The trade is
   that the invite flow can no longer be walked end-to-end against a local server.

   **Still outstanding: the same two variables in Vercel, then a redeploy.** `NEXT_PUBLIC_*`
   is inlined at build time, so setting them does not reach a deployment that already exists.

   The app side is now defensive on both counts — `env.siteUrl` falls back to Vercel's
   `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` when `NEXT_PUBLIC_SITE_URL` is unset, a
   production invite that would resolve to `localhost` throws rather than mailing a dead
   single-use link, and `AuthFragmentRelay` (root layout) forwards a misrouted
   `#access_token=…&type=invite` fragment to `/accept-invite` from wherever it lands. **None
   of that fixes the config**, and the relay still routes the tokens through a page that
   should never have seen them.

   Still to do, none of it in this repo:

   - Supabase → Auth → URL Configuration → **Site URL** = `https://merkhetdrafting.com`.
   - **Redirect URLs** += `https://merkhetdrafting.com/accept-invite`,
     `https://merkhetdrafting.com/reset-password` (keep the `localhost:3000` pair for dev; add
     `https://*.vercel.app/**` if previews need to send invites).
   - Vercel env: set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` explicitly, then
     **redeploy** — `NEXT_PUBLIC_*` is inlined at build time, so editing it does not reach a
     deployment that already exists.
   - Any invite already sent is spent. Re-invite from `/staff` after the above.
2. **Replace the placeholder firm details** in `lib/email/tokens.ts` — the Austin address,
   `(512) 555-0142` and `studio@merkhet.studio` (a domain the firm does not own) appear on
   **every client email**, and client mail is now live. Deferred by the user, not resolved.
3. **Add the Resend SPF and bounce-MX records.** Only DKIM verified; mail authenticates but
   hard bounces are invisible, so a typo'd address fails silently. Records are on the Resend
   Domains page; DNS is at **Vercel**, not the registrar. The `send` subdomain — do not touch
   the root MX, which is Google Workspace.
4. **Repoint `npm run check:gates`** at a live account, or it fails on the wiped seed user.
5. **Decide the gate-email question** — see `SLICE_6_APPLY.md`. Making Austin and Ryan admins
   is the zero-work answer.

## Answered 2026-08-21 — what the planned-hours number is for

**Capacity planning.** Hours ÷ duration = weekly load per person. Settled, built as Slice 9,
and recorded in [`DECISIONS.md`](./DECISIONS.md). Not an open question any more.

Two follow-ons it unblocks rather than closes, neither of them started:

- **The calendar's staff rows.** Now that the number has a meaning, By-staff mode could carry
  a density/heatmap treatment — *who is overloaded*, not just *who is assigned* — instead of
  plain bars. Nothing in the calendar forecloses it; the geometry is already in
  `lib/calendar.ts` and per-person totals already surface in the group headers.
- **Hours at phase entry** (below). Capacity planning is only as good as the hours behind it,
  and hours are optional and usually blank at delegation because nobody knows them yet.

## Likely next (workflow slices)

See [`CHANGES-2.md`](./CHANGES-2.md) status table.

1. ~~**Slice 6 — Notifications**~~ — **built and sending 2026-08-21.** Recipient resolution,
   outbox, provider and all four call sites. See [`SLICE_6_APPLY.md`](./SLICE_6_APPLY.md).
   Two pieces of it were *not* done and are still open:
   - **Reword Settings + the board column popover** so `phase_subscribers` reads as a standing
     baseline rather than the routing model (WORKFLOW-2 §4).
   - **A forward-only guard on customer mail.** Every column move mails the customer,
     including backwards ones — dragging DD → SD sends "schematic design has begun".
     `phase_transitions.direction` already has what is needed.
2. **Slice 3 — Intake form expansion** — on hold until the client clarifies fields/labels.
   Note that **project address and the customer address now exist** (2026-08-21) — two of the
   fields Slice 3 will surface are already in the schema and on screen.
3. ~~**Slice 9 — Staff workload view**~~ — **built 2026-08-21.** It is not redundant with the
   calendar's By-staff mode after all: the calendar answers *when*, the workload tab answers
   *how much, right now*. See the top of this file.
4. **Hours at phase entry** — follow-on from Slice 4. Prompt the delegate for planned hours
   when the phase actually starts, rather than only at delegation when nobody knows yet.
   Depends on Slice 6.

## What landed in f8d0526 (2026-08-14)

**New files**

- `lib/calendar.ts` — calendar geometry, kept pure so it can be checked headlessly
- `components/projects/delegation-dialog.tsx` — the Plan schedule form
- `scripts/check-schedule.ts`, `scripts/check-calendar.ts`, `scripts/check-gates.ts`
- `supabase/migrations/20260814100000_phase_planned_hours.sql` **(applied)**
- `supabase/migrations/20260814120000_delegation_gate.sql` **(applied)**
- `supabase/migrations/20260814160000_approval_gates.sql` **(applied)**
- `docs/handoff/SLICE_4_SCOPE.md`, `SLICE_4_APPLY.md`, `SLICE_5_APPLY.md`, `SLICE_10_APPLY.md`,
  `SLICE_11_APPLY.md`

**Modified** — `app/actions/projects.ts`, `lib/notifications.ts`, `components/board/board-view.tsx`,
`components/calendar/calendar-view.tsx`, `components/projects/project-detail-sheet.tsx`,
`lib/activity.ts`, `lib/dates.ts`, `lib/db/repo.ts`, `lib/db/demo-store.ts`, `lib/types.ts`,
`scripts/seed-demo.ts`, `package.json`, and the handoff docs.

## Checks

```bash
npm run check            # all three of the below — pure arithmetic, no database
npm run check:schedule   # deriveSchedule — 28 assertions
npm run check:calendar   # calendar geometry — 45 assertions
npm run check:workload   # week bounds + weekly rate + grouping — 65 assertions
npm run check:contact    # project vs customer address/contact — 23 assertions

npm run check:gates      # workflow gates + rework loop — 50 assertions, HITS THE LIVE DB
npm run check:creator    # board-card avatar resolution — READS the live DB, writes nothing
```

No test runner in the repo; these are plain scripts that exit non-zero on failure. `check`
covers the four pure modules (duration → dates, calendar geometry, weekly load, and the
project/customer contact fallback). **It does not cover rendering** — nothing here checks how
anything looks. Run it after touching `lib/dates.ts`, `lib/calendar.ts`, `lib/workload.ts` or
`lib/contact.ts`.

`check:gates` is separate on purpose: it signs in as `chris@merkhet.studio` and **writes to
hosted Supabase**. ⚠️ **That account was deleted in the 2026-08-21 wipe, so the script fails
until it is repointed at a live one.** It also, creating one throwaway project and deleting it in a `finally`. It touches no
existing project but burns a `project_number_seq` value per run. Run it after touching
`move_project`, `reject_gate`, or the approval functions in `lib/db/repo.ts`.

`check:creator` also hits the live database but is **read-only** — no sign-in, no writes, no
sequence burn. It asserts `projects.created_by` exists, agrees with the activity log, that no
board project still renders `—`, and that no card resolves to a deleted or deactivated user.
Run it after adding projects or deactivating staff.

## Email — open questions and unverified ground

Mail is **live in production** to both audiences. What is still outstanding:

- **`FIRM` in `lib/email/tokens.ts` is placeholder data** — Austin address,
  `(512) 555-0142`, `studio@merkhet.studio`, a domain the firm does not own. It is on **every
  client email**, and client email now sends. Deferred by the user 2026-08-21, not resolved.
- **`NEXT_PUBLIC_APP_URL` is set locally but not in Vercel**, so internal mail sent from the
  deployed app still deep-links to `localhost` — unreachable for recipients and mildly
  spam-flavoured. `appUrlIsLocal` exists to make this visible. Set it alongside
  `NEXT_PUBLIC_SITE_URL` in the Vercel dashboard; see **Immediate** §1.
- **No client except a browser has rendered these.** No Litmus, no Email on Acid, no Outlook —
  the client most likely to break a table layout. More pressing now that real inboxes receive
  them, not less.
- **SPF and bounce-MX never landed at Resend** — only DKIM verified. Hard bounces are
  invisible, so a typo'd recipient fails silently. DNS is at **Vercel**; the records go on the
  `send` subdomain, and the root MX (Google Workspace) must not be touched.
- **`client_contact_id` is null on live projects**, so client mail arrives unsigned, and
  `phase_subscribers` is empty.
- ~~Copy review with the client~~ — **done 2026-08-21.** Client asked for no dates or
  durations in client-facing mail; applied, see `SLICE_6_APPLY.md`.
- **Do not re-test placement with the same two Gmail accounts.** Marking the first message
  "Not spam" trained that filter; placement between them no longer measures anything.

## Polish / engineering

- Pixel-diff vs Lovable where still soft; Staff page Active-column UX
- Client-updates Phase 2 (`/client-updates`); client-facing email on phase entry (deferred in WORKFLOW)
- RLS audit against live DB
- `listUsers()` defaults to active-only and the board calls it bare, so cards whose assignee
  or creator has been deactivated fall back to `—`. Needs a full directory for name lookups
  kept separate from the assignable list — see 2026-08-22 above
- Destructive-action guards are now graded (see `DECISIONS.md` → Destructive actions). The
  customer-delete modal has not been exercised in a browser
- Board: add dnd-kit `KeyboardSensor` (PRD §12.6)
- Two pre-existing `react-hooks/set-state-in-effect` lint errors remain, in
  `project-detail-sheet.tsx` (`InlineText`) and `board-view.tsx` (localStorage read).
  `calendar-view.tsx` had the same one; it was fixed there with `useSyncExternalStore` if you
  want the pattern to copy.
- `rejectGate` re-dates in two steps (SQL transition, then TypeScript dates) by design. The
  window between them is the one place a failure leaves correct state with stale dates;
  "Re-plan schedule" is the recovery. See `SLICE_5_APPLY.md` §3.

## Cache Components / instant navigation

Validation (dev overlay) flags `cookies()` / `connection()` / uncached fetches outside `<Suspense>`.

| Segment | State |
|---|---|
| `(auth)/layout.tsx`, `(app)/layout.tsx` | `instant = false` |
| `(app)/staff/page.tsx` | `instant = false` (admin gate) |
| All other app routes | data fetch inside `<Suspense>` — swept 2026-08-14 |

### The mistake to not repeat

Four routes raised `blocking-prerender-dynamic` in dev. Three of them (`/`, `/customers`,
`/customers/[id]`) **already had a `<Suspense>`** — but the `await` sat in the default export,
*above* the boundary. Data resolved before the boundary was ever reached, so the wrapper did
nothing. `/calendar` had no boundary at all.

**A `<Suspense>` only helps if the data access happens inside a child that suspends.** The
correct shape, which `consultants/[id]` already had and everything now follows:

```tsx
async function ThingLoaded() {   // all awaits live here
  const data = await load();
  return <Client data={data} />;
}

export default function Page() {  // no await in here
  return <Suspense fallback={…}><ThingLoaded /></Suspense>;
}
```

Anything the header renders from data (a count, a customer name) has to move inside the
boundary too, with the fallback holding a static version of the header.

`getSessionUser()` counts as uncached data — it reads the session cookie — so it belongs
inside the boundary as well. That is why `/`'s auth check and `redirect` moved into
`BoardLoaded`.

Build markers are not a useful signal here: `(app)/layout.tsx` sets `instant = false`, which
forces every route under it to `ƒ` regardless. Verify in dev instead (see below).

### Verifying auth-gated routes headlessly

`curl` alone 307s to `/login`, so it cannot exercise these pages. To check dev-time
validation, sign in with `supabase-js` using the seeded credentials, encode the session the
way `@supabase/ssr` 0.12 does (`base64-` + base64url JSON, cookie
`sb-<project-ref>-auth-token`, chunked at 3180 chars), and pass it as a `Cookie` header. Then
read `.next/dev/logs/next-development.log` for `uncached data` / `blocking-prerender`.

All six routes were confirmed clean this way on 2026-08-14.

Unrelated noise in that log: a hydration mismatch on `<body cz-shortcut-listen>` — that is a
browser extension (ColorZilla) injecting an attribute, not an app bug.

## Known quirks

- After `.env` changes: **restart** `npm run dev`
- Env prefers `*_MERKET_*` names; legacy `NEXT_PUBLIC_SUPABASE_URL` etc. still fall back
- Seed dates anchored ~2026-08-10 — amber/redline urgency drifts
- Hydration / Cache insights: check browser overlay, not `curl` alone
- `/calendar` and `/` require auth; an unauthenticated request 307s to `/login`, so curl
  alone cannot verify either screen
- Calendar prefs: `merkhet.calendar.zoom` (`days`|`weeks`|`months`) and
  `merkhet.calendar.mode` (`projects`|`staff`); board collapse: `merkhet-board-collapsed`
- Theme preference: `localStorage` via `next-themes` (default **dark**)
- Node 20 in use; `@supabase/supabase-js` warns and needs a `ws` transport in scripts
  (see `scripts/seed-demo.ts`) — Node 22 would remove both

## When changing UI

- Prefer [Lovable showcase](https://pixel-perfect-showcase-001.lovable.app/) for visuals
- Prefer PRD / WORKFLOW-2 when behavior conflicts
