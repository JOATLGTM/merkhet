# Email templates

Transactional email for phase changes. Rendering lives here; `send.ts` is the
only module that talks to a provider, and `lib/notifications.ts` is the call
site layer that ties the two together.

**Internal mail sends. Client mail does not reach clients** unless
`EMAIL_CUSTOMER_ENABLED=true`. Phase changes reach real clients, so that switch
is deliberate rather than default.

Off does not mean silent. A client message is still delivered — **to the
project's owner, verbatim** — so the firm reads the real rendered mail in a
real inbox. Owner is `projects.created_by`, the person who filed the card and
the same person the card avatar falls back to.

> `client_contact_id` is the field the routing table names for this, but
> nothing writes it: `createProject` never sets it and there is no UI for it,
> so it is null on every real project. `created_by` is set on every insert and
> backfilled, which makes it the only owner a redirect can reach today.

The redirected message is **unmodified** — same subject, same body, addressed
to the client in the copy. Nothing marks it as a preview in the reader's view;
the provenance is an `X-Merkhet-Redirected-From` header, and the client's real
address is kept in `email_outbox.intended_to_addresses`. It follows that an
owner who forwards one has forwarded a real client email, which is the trade
made deliberately in exchange for seeing exactly what the client would see.

What happens to a client job, in order:

| Switch | Owner | Result |
|---|---|---|
| on | — | Delivered to the client. `pending` → `sent` |
| off | reachable | Delivered to the owner, verbatim. `pending` → `redirected` |
| off | missing or deactivated | Delivered nowhere. `held` |

Outbox statuses:

| Status | Meaning |
|---|---|
| `pending` | Queued, provider not reached yet (usually a missing `RESEND_API_KEY`) |
| `sent` | Accepted by the provider; `provider_id` holds its id |
| `failed` | Provider rejected it; `error` says why. `npm run email:retry` re-attempts |
| `redirected` | Client mail delivered to the owner instead. Terminal — it stays `redirected` rather than becoming `sent`, because calling it `sent` would claim the client was written to. A redirect is only marked this once it has actually gone out; before that it is an ordinary `pending` row carrying `intended_to_addresses` |
| `held` | Nowhere to redirect to, so delivered nowhere. Never swept by retry |

`to_addresses` is *only ever* the set the provider was actually handed — the
owner on a redirect, **empty** on a held row. While the switch is off, a client
address never appears in it at all; the client is recorded in
`intended_to_addresses`, which nothing sends to. So no replay of that column,
and no missed status check, can put a message in front of a client. Rows held
before 2026-08-23 predate this and still carry the client in `to_addresses`.

`npm run check:email` verifies the migration landed and reports, per live
project, whether a client message would redirect or fall through to `held`.

```
npm run check:email                        # who client mail would redirect to
npm run email:preview                      # render every template to out/emails/
npm run email:supabase                     # compile the two auth templates
npm run email:supabase:push                # dry-run the push into Supabase
npm run email:supabase:push -- --yes       # write them into Supabase
npm run email:send                         # list the cases, send nothing
npm run email:send -- --verify             # test the Gmail login only
npm run email:send -- --case 03            # put both messages for case 03 in an inbox
```

Fixtures for both live in `scripts/email-fixtures.ts` — one set, so the message
you look at and the message you send are the same message.

## What exists

| File | Role |
|---|---|
| `tokens.ts` | Literal palette, fonts, firm details, `APP_URL` |
| `layout.ts` | Table-based shell and blocks — `shell`, `row`, `metaGrid`, `button`, `callout`, `checklist` |
| `progress.ts` | Six-segment phase rule (internal) and four-step track (customer) |
| `copy.ts` | **Every user-facing sentence**, split into internal and customer vocabularies |
| `render.ts` | `RenderedEmail`, input types, formatting and text helpers |
| `templates/*.ts` | Five templates, each returning `{ subject, preview, html, text }` |
| `templates/auth-link.ts` | The two **Supabase** auth mails — see *Auth mail* below |
| `plan.ts` | Pure routing — event in, rendered messages with recipients out |

## Routing

Internal mail fires on every column. Customer mail fires only on phases
flagged `customerVisible` in `lib/phases.ts` — and while
`EMAIL_CUSTOMER_ENABLED` is off, every **yes** in the customer column below
lands in the project owner's inbox rather than the client's.

| Event | Internal | Customer |
|---|---|---|
| → Pending | delegate list + subscribers | — |
| → Active | leadership + subscribers | — |
| → Schematic design | delegate + subscribers | **yes** |
| → Design development | delegate + subscribers | **yes** |
| → Review | client contact + leadership | — *(approval gate)* |
| → Construction documents | delegate + subscribers | **yes** |
| → Final review | delegate + client contact + leadership | — *(approval gate)* |
| → Permitting | delegate + leadership | **yes** |
| Gate rejected | delegate of the phase returned to | — *(never)* |
| Marked complete | client contact + leadership | **yes** |

Three rules the code enforces rather than documents:

1. **Gates are invisible to the client.** `CUSTOMER_COPY` has no key for
   `review` or `final_review`, so there is no string to send by accident, and
   `assertCustomerVisible` throws if a caller tries.
2. **Rejection is internal, permanently.** A client reading "rejected" would
   misread an ordinary internal correction. They hear nothing until the
   project re-enters a customer-visible phase.
3. **Customer mail contains no link into the app.** Clients have no login
   (WORKFLOW-2 §1); the reply address is the only call to action.

This is wider than WORKFLOW-2 §4, which scoped client mail to DD, CD and
Permitting. The `customerVisible` flag is the switch — narrowing back to the
original three is an edit to `lib/phases.ts`, not to any template.

## Auth mail — the two Supabase sends

The invite and the password reset are the only messages this app does **not**
send. Supabase renders them from HTML held in its own dashboard, so they were
stock GoTrue markup — an `<h2>` and two `<p>`s on a white page — while every
other message the firm sends carried the wordmark, the rule and the palette.

`templates/auth-link.ts` renders both through the same `shell()` as everything
else. The output is a build artefact, not a runtime call:

```
npm run email:supabase        # writes out/emails/supabase-{invite,recovery}.html
```

Getting it into Supabase, either way:

- **Push it** — `npm run email:supabase:push` reports what would change,
  `-- --yes` writes it. Needs `SUPABASE_ACCESS_TOKEN` in `.env`: a personal
  access token, **not** the service role key, because email templates are
  project *configuration* and the Management API is account-scoped. The live
  templates are saved to `out/emails/*.backup.html` before anything is
  overwritten.
- **Paste it** — Supabase → **Authentication → Emails**, each file into the
  matching template's **Body**, replacing everything there, plus the
  **Subject** the render script prints.

The template editor is only unlocked once the project has custom SMTP (see
`docs/handoff/ACCOUNTS_APPLY.md`). Either way, **send yourself one invite
afterwards and open it** — a push or a paste is also an opportunity to lose a
placeholder, and the link is single-use.

Dynamic values are Go template placeholders GoTrue substitutes at send time —
`{{ .ConfirmationURL }}` for the one-time link and `{{ .Email }}` for the
recipient. Only those two are used: each one added is another thing to get
wrong in a message whose link burns on first use. They pass through `esc()`
untouched, so the ordinary `layout.ts` blocks work on them as they are.

Three things this template does that the stock one did not:

1. **Prints the link as text** under the button. A gateway that strips or
   rewrites buttons leaves the recipient of a single-use invite with no second
   path, and re-sending mints a new token rather than re-sending the old one.
2. **Names the address** the account belongs to, so an invite that lands in a
   shared or forwarded mailbox says who it is for.
3. **Carries a "if you were not expecting this" line.** Every credential mail
   needs one, and neither stock template had it.

Two constraints of the dashboard worth knowing before editing:

- **There is no plain-text part** — one HTML field per template. The `.txt`
  written beside each file is reference only, so the copy can be read without
  a browser. This is the one place the text-alternative rule above cannot be
  followed.
- **Edits made in the dashboard are lost** on the next push. Copy lives in
  `AUTH_COPY` in `copy.ts`; edit, re-render, re-push. The push reports a
  no-change run as *already current*, so it is safe to re-run.

The link target is deliberately unchanged. `{{ .ConfirmationURL }}` resolves
against the `redirectTo` that `inviteUser` passes (`/accept-invite`), which
returns the session in a URL fragment the client page reads. Now that custom
SMTP has unlocked the editor, the `/auth/confirm?token_hash=…` variant in
`ACCOUNTS_APPLY.md` §*The fragment problem* becomes available — but it is a
change to the auth flow, not to the design, and nothing here depends on it.

## Sending a real one

`scripts/send-test-email.ts` pushes a rendered message through Gmail SMTP so
you can see what Gmail actually does with it. It is a harness, not the send
path — nothing is wired into the app.

Setup, on the **sending** account:

1. `myaccount.google.com` → Security → turn on 2-Step Verification.
   App Passwords cannot be created without it.
2. `myaccount.google.com/apppasswords` → create one, copy the 16 characters.
3. Fill `GMAIL_TEST_USER`, `GMAIL_TEST_APP_PASSWORD` and `GMAIL_TEST_TO` in
   `.env` (see `.env.example`).
4. `npm run email:send -- --verify` to check the login before sending anything.

Every recipient is overridden with `GMAIL_TEST_TO`. The fixture addresses are
never used as real recipients — two of them are on a live domain. Each message
carries an `X-Merkhet-Test: true` header so a test can never be mistaken for a
real notification.

What a Gmail test does and does not prove:

- **Does** prove the HTML survives Gmail's sanitiser, that the layout holds in
  the Gmail web and mobile clients, and that the text alternative is sane.
- **Does not** prove anything about Outlook, which is the client most likely to
  break the layout, or about deliverability — mail from a `gmail.com` address
  is authenticated by Google, which is not the position the firm's own domain
  will be in until its SPF/DKIM/DMARC records exist.

## If the test lands in spam

It probably will, and it is weak evidence about the templates. Three things
stack up in a first send, and the script prints them before it sends so they
are not mistaken for a template problem:

1. **Links to `localhost`.** Internal mail deep-links to `APP_URL`, which
   defaults to `http://localhost:3000`. An unresolvable plain-HTTP host in an
   HTML message is one of the cheaper things a filter can score against. Set
   `NEXT_PUBLIC_APP_URL` to a reachable `https://` address before reading
   anything into a result.
2. **No sending reputation.** A first templated HTML message between two
   accounts with no correspondence history is close to the worst case a filter
   sees. No amount of template work moves this — domain, authentication and
   volume do.
3. **Display name over a mismatched domain.** "Merkhet (test)" above a
   `gmail.com` address is a mild spoofing signal.

To find out which applies, open the message in Gmail → **⋮ → Show original**
and read the SPF / DKIM / DMARC lines:

- **All three pass** → authentication is fine and the placement is content and
  reputation. Fix 1 above, and expect the rest to resolve with a real domain.
- **Any fail** → the transport is misconfigured, which is worth chasing now.

Marking the message "Not spam" trains the filter for that account pair, so
**check the headers before you do it** — afterwards no test between those two
accounts is a clean measurement again.

The honest position: gmail-to-gmail can prove the pipe works and the HTML
renders. It cannot answer the deliverability question, and it never will. That
answer needs the firm's domain with SPF, DKIM and DMARC published — the same
DNS work already blocking Slice 6.

## The send path

```
state change  →  lib/notifications.ts  →  plan.ts   →  send.ts   →  Resend
                 resolves recipients      what/whom    outbox row
```

1. **Recipient resolution** — `resolveAudiences` in `lib/db/repo.ts`. Delegate
   from `project_phases.assignee_id`, client contact from
   `projects.client_contact_id`, customer via `resolveContactField` (project
   overrides customer, per `lib/contact.ts`), baseline from
   `phase_subscribers`. Leadership resolves to active admins — gate parties
   (`austin`/`ryan`/`chosen`) are approval roles, not accounts, so there is no
   column naming them. Owner — the redirect target for client mail — from
   `projects.created_by`. Deactivated users are dropped here, so a departed
   owner resolves to null and the message is held rather than sent to a dead
   address.
2. **Outbox** — `public.email_outbox`, added by
   `supabase/migrations/20260821140000_email_outbox.sql`. The rendered html and
   text are stored, so a retry sends the message that was *planned* rather than
   whatever the templates produce today. Failed rows are retryable with
   `npm run email:retry`.
3. **Provider** — Resend's HTTP API, not SMTP. The app runs serverless, where
   holding an SMTP connection open is slow and liable to time out mid-handshake.
   Needs `RESEND_API_KEY` and `EMAIL_FROM`. Without the key, messages are still
   written to the outbox as `pending` — set the key and retry to flush them.

Call sites, all in `lib/notifications.ts`, none of which throw: a provider
outage must not surface as a failed phase move.

| Trigger | Function | Fired from |
|---|---|---|
| Any column move | `notifyPhaseEntry` | `moveProject` |
| Contract upload → Active | `notifyProjectEnteredActive` | `uploadContractAndActivate` |
| Gate rejected | `notifyGateRejected` | `rejectGateAction` |
| Marked complete | `notifyProjectComplete` | `markProjectComplete` |

Because the first row fires on *every* move, dragging a card back and forth on
the board sends mail each time. That is what the routing table asks for; if it
turns out noisy in practice, the throttle belongs in `notifications.ts`, not in
the templates.

## Client rendering

Light palette only. `prefers-color-scheme` is honoured by Apple Mail, ignored
by Gmail and partly rewritten by Outlook, so a dark block buys inconsistency
rather than a second theme.

Layout is tables with inline styles because Outlook renders through Word — no
flexbox, no grid, no `max-width` on divs. The `<style>` block carries mobile
rules only; a client that strips it still gets a correct 600px layout.

Archivo and JetBrains Mono are webfonts and will not load in most clients.
The fallback stacks (Helvetica/Arial, SF Mono/Menlo) are the real design.

**Not verified against real clients.** Nothing here has been through Litmus,
Email on Acid, or an actual Outlook. Do that before the first send.
