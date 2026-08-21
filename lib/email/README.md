# Email templates

Transactional email for phase changes. **Rendering only** — nothing in this
directory opens a connection, and there is no provider, outbox or queue yet.
Slice 6 (`docs/handoff/CHANGES-2.md`) adds those behind `lib/notifications.ts`,
which is still the stub it always was.

```
npm run email:preview                      # render every template to out/emails/
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
| `templates/*.ts` | Four templates, each returning `{ subject, preview, html, text }` |
| `plan.ts` | Pure routing — event in, rendered messages with recipients out |

## Routing

Internal mail fires on every column. Customer mail fires only on phases
flagged `customerVisible` in `lib/phases.ts`.

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

## Wiring it up later

`plan.ts` takes resolved recipients rather than looking them up, so routing
can be exercised without a database. A send path needs:

1. Recipient resolution in `lib/db/repo.ts` — delegate from `project_phases`,
   client contact from `projects.client_contact_id`, customer from
   `customers.contact_email`, baseline from `phase_subscribers`.
2. An outbox table, so a failed send is retryable and a review-before-send
   step has somewhere to hold messages.
3. A provider, blocked on DNS/CNAME for the sending domain.

Call sites already exist and stay put: `notifyProjectEnteredActive` and
`notifyGateRejected` in `lib/notifications.ts`.

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
