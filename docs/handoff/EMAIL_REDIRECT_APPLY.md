# Client email — redirected to the project owner instead of held

Requested 2026-08-23: *"we are not ready to send emails to clients yet, but we do want to
see the client emails — have it sent to the owner of the ticket."*

## The problem with `held`

Slice 6 shipped the right instinct and the wrong ergonomics. Client mail was rendered,
written to `email_outbox` with status `held`, and delivered nowhere. Reviewing one meant
opening the Supabase SQL editor and reading `text_body` out of a table.

Nobody does that. A withheld message that nobody opens has not actually been reviewed, so the
switch was protecting the firm from clients and from itself in equal measure. Six months of
`held` rows is not a review process.

The message now goes out. Just not to the client.

## Behavior

| `EMAIL_CUSTOMER_ENABLED` | Owner reachable | Delivered to | Outbox status |
|---|---|---|---|
| `true` | — | the client | `pending` → `sent` |
| `false` | yes | the project owner | `pending` → `redirected` |
| `false` | no | nobody | `held`, with `to_addresses` empty |

Internal mail is untouched — it always sent, and still does.

`held` was kept rather than replaced. A project whose owner is missing or deactivated has
nowhere to redirect to, and dropping the message would be worse than recording it
undelivered. `npm run check:email` fails loudly on any live project in that state.

### Owner is `created_by`, not `client_contact_id`

`projects.client_contact_id` is the field the routing table names for "the internal person
who owns this relationship". **Nothing writes it.** `createProject` never sets it, there is
no UI for it, and `demo-store` hard-codes `null` — so it is null on every real project and
the `clientContact` audience has been resolving to nothing this whole time.

`projects.created_by` is set on every insert and was backfilled from the activity log
([CARD_CREATOR_APPLY.md](./CARD_CREATOR_APPLY.md), 6/6 verified). It is the only owner a
redirect can actually reach today, and it is already the identity the board card shows when
there is no assignee — so "the owner of the ticket" means the same person in the UI and in
the mail.

If `client_contact_id` ever gets a writer, this is one line in `resolveAudiences`.

### The message is unmodified

No subject prefix, no preview banner, no "this would have gone to…" callout. The owner
receives the exact bytes the client would have received, addressed to the client in the copy.
That is the point — an annotated preview is not the thing you are trying to check.

The consequence is that an owner who forwards one has forwarded a real client email, and
nothing in the reader's view would have warned them. That trade was made deliberately.

Provenance is recorded in two places that do not touch the rendered message:

- **`X-Merkhet-Redirected-From`** header on the outbound message — inert to the reader,
  present in *Show original* and in Resend's log. Same convention as `X-Merkhet-Test` in
  `scripts/send-test-email.ts`.
- **`email_outbox.intended_to_addresses`** — the client address the copy speaks to.

### A client address is never in the column the provider reads

`to_addresses` is *only ever* what was actually handed to Resend: the owner on a redirect,
and **empty** on a held row. While `EMAIL_CUSTOMER_ENABLED` is off, a client address does not
appear in that column at all — it lives in `intended_to_addresses`, which nothing sends to.

This matters for the held case specifically. A held row is skipped by a `status === "held"`
check in the delivery loop, and that check is correct — but a row is not safe because one
branch guards it. Storing the client's address where the provider reads from would mean the
only thing between a client and that message is a `continue` nobody is watching. Empty means
a stray send fails at Resend instead of arriving.

Rows held before 2026-08-23 predate this and still carry the client in `to_addresses`. They
are inert — `email:retry` sweeps `failed` only — but read them with
`coalesce(intended_to_addresses, to_addresses)`.

### `redirected` is set on delivery, and survives it

A redirect is **inserted `pending`**, like everything else, and only becomes `redirected`
once Resend has accepted it. The row must not claim a delivery that has not happened — with
no `RESEND_API_KEY` nothing is sent, and a row already marked `redirected` would be neither
retried nor true. What marks a row as a redirect is `intended_to_addresses`, not its status.

After that it is a terminal status, not a queue state. A redirected row that Resend accepts stays
`redirected` rather than becoming `sent`, because `sent` on a client-audience row would claim
the client has been written to when they have not. `select * from email_outbox where status =
'redirected'` is the honest answer to "what have we shown ourselves so far".

## SQL — APPLIED 2026-08-23 (verified by `npm run check:email`)

`supabase/migrations/20260823100000_email_redirected.sql`. Run in the hosted Supabase SQL
editor, same as prior slices.

```sql
alter type public.email_status add value if not exists 'redirected';

alter table public.email_outbox
  add column if not exists intended_to_addresses text[];
```

Additive and idempotent. Both statements are safe to re-run.

**Until this is applied the inserts fail**, and because `enqueueAndSend` swallows its own
errors that surfaces as `[email] could not write outbox: …` in the server log and no mail at
all — not as a failed phase move. Apply it before the next drag.

## Verify

```
npm run check:email
```

Read-only. Confirms the column is queryable and the enum accepts `redirected`, then prints
one row per live project: its column, whether that column is client-visible, who the message
would redirect to, and the outcome. Fails if any live project has no reachable owner. It also
tallies the client mail already on record and, when held rows exist, prints the query to read
them.

## Who actually receives mail today

> **Partly superseded 2026-09-01.** `phase_subscribers` and `client_contact_id` no longer
> exist; the per-project notify list in Plan schedule replaced the former
> (`PHASE_RECIPIENTS_APPLY.md`). The assignee gap and the leadership rows below still hold.
> `npm run check:recipients` prints the current matrix.

Checked against hosted Supabase on 2026-08-23, while verifying the migration. The routing
table is correct; the **data behind it is nearly empty**, and the result is not what the
table implies.

State: three users — Austin Stinemetz (admin), Chris Vo (admin), Ryan Kolb (**staff**).
`phase_subscribers` has **zero rows**. **Zero** phases carry an assignee. `client_contact_id`
is null on every project. All five live projects sit in Pending, filed by Austin.

Which resolves to:

| Move to | Internal reaches | Client copy |
|---|---|---|
| Pending | **nobody** | — |
| Active | Austin, Chris | — |
| Schematic design | **nobody** | Austin |
| Design development | **nobody** | Austin |
| Review | Austin, Chris | — |
| Construction documents | **nobody** | Austin |
| Final review | Austin, Chris | — |
| Permitting | Austin, Chris | Austin |
| Marked complete | Austin, Chris | Austin |

Three consequences:

1. **The three client-visible design phases notify nobody internally.** Delegate is null and
   subscribers are empty, so the internal job has no recipients and is dropped before the
   outbox insert. No row, no error, no mail. The client copy still reaches the owner, so the
   firm sees the client's message and no internal one.
2. **Ryan receives nothing, on any transition.** He is staff, so not leadership; not a
   subscriber; not a delegate. Nothing routes to him.
3. **Admins are not copied "constantly"** — only on Active, Permitting, the two gates and
   completion. It reads as constant because they are currently the *only* recipients of
   anything.

The fix is data, not code: populate `phase_subscribers` and assign delegates. Both have admin
UI already (board column popover, Settings → Phase subscribers, phase assignee).

### Worked example — subscribers do not multiply the mail

Ryan and Austin, both admins, both subscribed to Schematic design. A project enters SD:

| | Ryan | Austin (owner) |
|---|---|---|
| Internal — SD entry | ✉️ | ✉️ |
| Client copy — redirected | — | ✉️ |
| **Inbox total** | **1** | **2** |

**Three arrivals, two outbox rows.** The internal message is one job addressed to both, not
one per person. Their admin role contributes nothing here — SD is not a leadership column —
so the subscription is what delivers it. The client copy goes to the owner alone.

## What this does not do

- **Existing `held` rows are history, not a queue.** They are not resent, not converted, and
  not swept by `npm run email:retry`. Same rule as before.
- **`EMAIL_CUSTOMER_ENABLED` still exists and still means what it meant.** Flipping it to
  `true` is still the single action that starts writing to real clients. Nothing here makes
  that safer or harder; it only makes the interval before it useful.
- **Every move still mails.** Dragging DD → SD still queues "schematic design has begun".
  That rough edge is unchanged and still noted in [SLICE_6_APPLY.md](./SLICE_6_APPLY.md); the
  redirect means it now lands on the owner rather than a client, which lowers the cost of it
  but does not fix it.
- **It does not fan the client copy out to a review list.** One recipient, the owner, as
  specified. If the firm wants every admin to see client mail, that is a fallback on
  `reviewTo` in `plan.ts` — a small change, deliberately not made.

## Files

| File | Change |
|---|---|
| `supabase/migrations/20260823100000_email_redirected.sql` | New — enum value + column |
| `lib/db/repo.ts` | `resolveAudiences` resolves `owner` from `created_by` |
| `lib/email/plan.ts` | `Audiences.owner`, `EmailJob.reviewTo` on both client jobs |
| `lib/email/send.ts` | Redirect decision, `redirected` status, header, retry parity |
| `scripts/check-email-redirect.ts` | New — `npm run check:email` |
| `scripts/retry-emails.ts` | Reports redirects separately from sends |
| `lib/email/README.md`, `.env.example` | Documented |
