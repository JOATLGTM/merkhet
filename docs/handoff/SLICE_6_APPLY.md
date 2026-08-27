# Slice 6 — notifications, wired

**Built and verified 2026-08-21.** The template half landed 2026-08-18
([`SLICE_6_TEMPLATES.md`](./SLICE_6_TEMPLATES.md)); this is the other half — recipient
resolution, an outbox, a provider, and the call sites. Internal and customer mail both
deliver from `noreply@merkhetdrafting.com`.

## Migrations

```
20260821140000_email_outbox.sql        -- outbox table + email_status enum
20260821150000_email_status_held.sql   -- adds 'held' to that enum
```

**Both applied and verified** on hosted Supabase, 2026-08-21. The second is separate for the
same reason as the gate-parties pair: Postgres will not let a transaction use an enum value it
just added.

Verification was an insert/delete round-trip, not a `select … head`. A `head: true` count
query **returns no error for a table that does not exist**, which during this work reported the
outbox as present a full step before it had been created. Round-trip, or check against a
control table you know is absent.

## Shape

```
state change  →  lib/notifications.ts  →  plan.ts   →  send.ts   →  Resend HTTP API
                 resolves recipients      what/whom    outbox row
```

`plan.ts` was already pure and stays pure. Everything added is either side of it.

### Recipient resolution — `resolveAudiences` in `lib/db/repo.ts`

| Audience | Source |
|---|---|
| `delegate` | `project_phases.assignee_id` for the entered phase |
| `clientContact` | `projects.client_contact_id` → `users` |
| `customerContact` | `resolveContactField` — project overrides customer, per `lib/contact.ts` |
| `subscribers` | `phase_subscribers` for the phase |
| `leadership` | **active admins** — see the caveat below |

Inactive users are dropped. Anyone without an address is dropped by `plan.ts`, not guessed at.

### The outbox — `public.email_outbox`

Rendered `html` and `text_body` are **stored**, so a retry sends the message that was
*planned* rather than whatever the templates produce today.

| Status | Meaning |
|---|---|
| `pending` | Queued, provider not reached (usually a missing `RESEND_API_KEY`) |
| `sent` | Accepted; `provider_id` holds the provider's id |
| `failed` | Rejected; `error` says why. `npm run email:retry` re-attempts |
| `held` | Deliberately withheld — customer mail with the switch off. Never swept by retry |

### Provider — Resend HTTP API

Not SMTP. The app runs serverless, where holding an SMTP connection open is slow and liable to
time out mid-handshake. `RESEND_API_KEY` + `EMAIL_FROM`.

Supabase auth mail (invites, password resets) goes over Resend **SMTP** — same account, same
verified domain, different transport, because Supabase only speaks SMTP. Two places to
configure, two places a credential can go stale.

### Call sites — all in `lib/notifications.ts`

| Trigger | Function | Fired from |
|---|---|---|
| Any column move | `notifyPhaseEntry` | `moveProject` |
| Contract upload → Active | `notifyProjectEnteredActive` | `uploadContractAndActivate` |
| Gate rejected | `notifyGateRejected` | `rejectGateAction` |
| Marked complete | `notifyProjectComplete` | `markProjectComplete` |

None of them throw. A notification is a side effect of a state change already committed — a
provider outage must not surface as a failed drag.

## Customer mail is off by default

> **Superseded 2026-08-23 for the withheld case.** Client mail is still not delivered to
> clients unless `EMAIL_CUSTOMER_ENABLED=true` — but instead of sitting `held` and unread, it
> is now delivered verbatim to the project owner (`projects.created_by`). `held` remains only
> when there is no reachable owner. [EMAIL_REDIRECT_APPLY.md](./EMAIL_REDIRECT_APPLY.md)


`EMAIL_CUSTOMER_ENABLED=true` is required, in the environment, or customer messages are
recorded as `held` and not delivered. Existing held rows are **history, not a queue** —
enabling the switch does not send them, only new events.

Read a held row's `text_body` before enabling. That is what the status exists for.

> **This was broken on first implementation.** Customer jobs were filtered out *before* the
> outbox insert, so they were discarded rather than held, and there was nothing to review.
> Fixed the same day; the `held` status is the fix.

## Client-facing copy: no dates, no durations

The client asked for this directly:

> "I would rather they just let client/owner know that project has moved to next phase, and not
> the detail of '20 days' or finish dates. The schedule flexes too much for us to be locked
> into exact dates."

Removed from `phase-entry-customer.ts`: a two-row meta grid carrying "*{stage}* expected to
finish" and "Estimated completion". Removed from `copy.ts`: the permitting line's "typically
two to four weeks, though it varies".

`expectedEnd` was deleted from `PhaseEntryCustomerInput` **and** from `planPhaseEntry` — a
field that does not exist cannot be filled in later by a caller who means well. Recorded as
rule 4 in the template's header comment, alongside the three it already enforced.

Internal mail is unchanged and still carries planned dates, duration and hours. Verified by
rendering all 16 messages and grepping every customer file for date and duration patterns.

## Caveat — "leadership" is not Austin and Ryan

`GATE_PARTIES` (`lib/types.ts`) defines `austin` / `ryan` / `chosen` as **approval slots**:
string identifiers with no link to a `users` row. Email leadership resolves to
`role = 'admin'`. Nothing connects the two.

Consequence once real staff exist:

- Austin as a **staff** account → approves as the `austin` party, receives **no** gate email.
- Any **admin** → receives gate email whether or not they are a gate party.

Cheapest fix is to make Austin and Ryan admins. The durable fix is a settings table mapping
party → `user_id`, which costs a migration and a small UI. Not done; decide before onboarding
staff.

Routing itself is correct — `plan.ts` copies leadership at both gates (`isGate`), on top of
the `active` / `permitting` columns in `LEADERSHIP_COLUMNS`.

## Known rough edge — every move mails the customer

Including backwards ones. Dragging DD → SD queues a "schematic design has begun" message,
which a client would read as a problem. That is what the routing table specifies, so it was
left alone.

`phase_transitions.direction` already records forward vs backward, so a forward-only guard is
available whenever it is wanted. Worth doing before real projects start moving around.

## Verified

- Both migrations applied; enum accepts `held`; `audience` check constraint rejects junk.
- Resend credentials and sender accepted — probed against `delivered@resend.dev`, Resend's
  sink address, so no human inbox was involved.
- Live moves on `merkhetdrafting.com`: 6 × `internal/sent`, 1 × `customer/sent`,
  2 × `customer/held`, **0 failed**.
- All 16 rendered messages grepped; no date or duration in any customer message.
- `tsc --noEmit` clean, build clean, lint at the pre-existing 5-error baseline.

## Not verified

- **No real mail client has rendered these.** No Litmus, no Email on Acid, no Outlook. The
  templates now reach actual inboxes, which makes this more pressing, not less.
- **RLS on `email_outbox`.** Every check used the service-role key, which bypasses RLS. The
  policy matches every other table (`authenticated_full_access`); it is exercised for real on
  each phase move.

## Still open

- `FIRM` in `lib/email/tokens.ts` is **placeholder data** — Austin address, `(512) 555-0142`,
  `studio@merkhet.studio`, a domain the firm does not own. It appears on every client email.
  Deferred by the user 2026-08-21.
- `NEXT_PUBLIC_APP_URL` unset → internal mail deep-links to `localhost`.
- `client_contact_id` is null on live projects, so client mail arrives unsigned.
- `phase_subscribers` is empty.
- Resend **SPF and bounce-MX records never landed** — only DKIM verified. Mail authenticates,
  but hard bounces are invisible, so a typo'd address fails silently.
