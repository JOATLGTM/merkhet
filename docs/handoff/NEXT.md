# Next / open gaps

Not committed as a formal backlog — use as a resume checklist.

**Last updated: 2026-08-18**

## What happened on 2026-08-18

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

1. **Push `f8d0526`** if the remote should have it — it is committed locally only.
2. **Backfill delegation on the 18 live projects** — open each, "Plan schedule". Coverage is
   22% of phase rows assigned / 29% dated until this is done, and the staff calendar reads
   `assignee_id`, so By-staff mode looks mostly empty until then. Measured table in
   `SLICE_11_APPLY.md`.

## Open question for the client (blocks a design decision)

**What is the planned-hours number *for*?**

- *Fee validation* — a rough guess up front is fine; nothing more to build.
- *Retrospective benchmarking* — needs logged hours, which is Phase 2 and not built.
- *Capacity planning* — then hours ÷ duration = weekly load per person, which is what turns
  the calendar's staff rows from *who is assigned* into *who is overloaded*. That points at a
  density/heatmap treatment on staff rows rather than plain bars.

The calendar was built without waiting on this, at the user's direction. Nothing in it
forecloses the capacity answer — planned hours already surface as per-person group totals and
in bar tooltips — but the load treatment is a follow-on if that is the answer.

## Likely next (workflow slices)

See [`CHANGES-2.md`](./CHANGES-2.md) status table.

1. **Slice 6 — Notifications** — templates are **done** (`lib/email/`, 2026-08-18). What
   remains, in order of what is unblocked:
   - **Recipient resolution** in `lib/db/repo.ts` — delegate from `project_phases`, client
     contact from `projects.client_contact_id`, customer from `customers.contact_email`,
     baseline from `phase_subscribers`. `plan.ts` takes resolved people, so this is additive.
   - **The outbox table**, so a failed send is retryable and review-before-send has somewhere
     to hold messages.
   - **Call sites** — replace the stubs in `lib/notifications.ts`
     (`notifyProjectEnteredActive`, `notifyGateRejected`) and add the phase-entry hook.
   - **Reword Settings + the board column popover** so `phase_subscribers` reads as a standing
     baseline rather than the routing model (WORKFLOW-2 §4). Still not done.
   - **The provider and the DNS records.** Still blocked. Note that deliverability cannot be
     tested before this exists — the Gmail harness proves the pipe and the rendering, nothing
     more.
2. **Slice 3 — Intake form expansion** — on hold until the client clarifies fields/labels.
3. **Slice 9 — Staff workload view** — **probably redundant now.** The calendar's By-staff
   mode is the staff-grouped view Ryan asked for. Confirm before building anything.
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
npm run check            # both of the below — pure arithmetic, no database
npm run check:schedule   # deriveSchedule — 28 assertions
npm run check:calendar   # calendar geometry — 45 assertions

npm run check:gates      # workflow gates + rework loop — 50 assertions, HITS THE LIVE DB
```

No test runner in the repo; these are plain scripts that exit non-zero on failure. `check`
covers the two pieces of real arithmetic (duration → dates, and calendar geometry). **It does
not cover rendering** — nothing here checks how anything looks. Run it after touching
`lib/dates.ts` or `lib/calendar.ts`.

`check:gates` is separate on purpose: it signs in as `chris@merkhet.studio` and **writes to
hosted Supabase**, creating one throwaway project and deleting it in a `finally`. It touches no
existing project but burns a `project_number_seq` value per run. Run it after touching
`move_project`, `reject_gate`, or the approval functions in `lib/db/repo.ts`.

## Email — open questions and unverified ground

- **Copy review with the client.** Held 2026-08-18. `lib/email/copy.ts`, two vocabularies.
- **No client except a browser has rendered these.** No Litmus, no Email on Acid, no Outlook —
  the client most likely to break a table layout. Worth one Litmus pass before a real send.
- **`FIRM` in `lib/email/tokens.ts` is placeholder data** — address, phone, reply address.
- **`NEXT_PUBLIC_APP_URL` defaults to `http://localhost:3000`**, so internal mail deep-links
  are unreachable and mildly spam-flavoured. Set it before any real send;
  `appUrlIsLocal` exists to make this visible and the send harness warns on it.
- **Do not re-test placement with the same two Gmail accounts.** Marking the first message
  "Not spam" trained that filter; placement between them no longer measures anything.

## Polish / engineering

- Pixel-diff vs Lovable where still soft; Staff page Active-column UX
- Client-updates Phase 2 (`/client-updates`); client-facing email on phase entry (deferred in WORKFLOW)
- RLS audit against live DB
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
