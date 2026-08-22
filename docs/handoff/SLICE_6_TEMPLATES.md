# Slice 6 (part 1) — Email templates

> **Superseded 2026-08-21.** This documents the template half only. The provider, outbox
> and call sites were built and are sending — [`SLICE_6_APPLY.md`](./SLICE_6_APPLY.md).

**Built 2026-08-18. No SQL, no migration, nothing wired into the app.**

Slice 6 splits cleanly in two. This is the half that does not need DNS:

| Part | State |
|---|---|
| Templates, copy, routing | **Done — this document** |
| Provider, outbox, call sites | ~~Open~~ **Done 2026-08-21** — `SLICE_6_APPLY.md` |

`lib/notifications.ts` is still the same stub it always was. Nothing calls the
templates from the app.

## What exists

```
lib/email/
  tokens.ts      literal palette, fonts, firm details, APP_URL, appUrlIsLocal
  layout.ts      table shell + blocks: row, metaGrid, button, callout, checklist
  progress.ts    6-segment phase rule (internal) · 4-step track (customer)
  copy.ts        every user-facing sentence, in two vocabularies
  render.ts      RenderedEmail, input types, formatting, text helpers
  plan.ts        pure routing — event in, messages + recipients out
  templates/     phase-entry-internal · phase-entry-customer · gate-rejected · project-complete
  README.md      routing table, wiring plan, deliverability notes
scripts/
  email-fixtures.ts     one fixture set, shared by both harnesses
  preview-emails.ts     npm run email:preview → out/emails/
  send-test-email.ts    npm run email:send   → Gmail SMTP (harness, not the send path)
```

Four templates, eleven events, sixteen messages. Each template returns
`{ subject, preview, html, text }`. The text alternative is not optional —
HTML-only scores badly with filters and is unreadable in text-mode clients.

Added `nodemailer` + `@types/nodemailer` as **dev** dependencies. They are only
used by the send harness; the real send path will decide its own provider.

## Routing decision (wider than WORKFLOW-2 §4)

WORKFLOW-2 §4 scoped client mail to DD, CD and Permitting and deferred it to
Phase 2. The client asked for it now, and for the full set of stages they can
see. Recorded here because it is a **deliberate widening**, not drift:

| Event | Internal | Client |
|---|---|---|
| → Pending | yes | — |
| → Active | yes | — |
| → SD | yes | **yes** |
| → DD | yes | **yes** |
| → Review | yes | — *(gate)* |
| → CD | yes | **yes** |
| → Final review | yes | — *(gate)* |
| → Permitting | yes | **yes** |
| Gate rejected | yes | — *(never)* |
| Marked complete | yes | **yes** |

**`customerVisible` in `lib/phases.ts` is the switch**, not a second list.
Narrowing back to WORKFLOW-2's original three is an edit to that flag; no
template changes. This is also what keeps both approval gates silent to the
client without anyone having to remember to.

## Three rules enforced in code, not in prose

1. **No client copy exists for the gates.** `CUSTOMER_COPY` has no key for
   `review` or `final_review`, so there is no string to send by accident.
   `assertCustomerVisible` throws if a caller widens the union and tries.
2. **Rejection is internal, permanently.** No customer variant of
   `gate-rejected` exists and none should be added. A client reads "rejected"
   as failure where the firm means an ordinary correction; they hear nothing
   until the project re-enters a visible phase.
3. **Client mail contains no link into the app.** Clients have no login
   (WORKFLOW-2 §1), so a button would dead-end at `/login`. The reply address
   is the only call to action, and the **client contact** signs it — not the
   phase delegate, so the client hears one voice regardless of who is drawing.

A fourth, quieter one: `EmailProject` is a narrow whitelist rather than
`ProjectWithRelations`. Budgets and internal notes are not reachable from a
template, so they cannot reach a client inbox through one.

## Gmail send test (2026-08-18)

Two personal Gmail accounts, App Password over `smtp.gmail.com:465`.

**Result: delivered, landed in spam.** Auth was clean — Gmail's detail panel
showed `mailed-by: gmail.com` and `signed-by: gmail.com` with no
authentication warning, which is SPF and DKIM passing.

The filtered message was the **customer** template, which contains no
`localhost` link — only a `mailto:`. That ruled out the leading hypothesis.
What remains is sender identity, not template content:

- no sending reputation between the two accounts
- display name "Merkhet (test)" over a `gmail.com` address
- a `mailto:` to an unrelated domain
- the hidden preheader (since cut back — see below)

**None of this is fixable from the templates.** It resolves when mail comes
from `merkhet.studio` with SPF, DKIM and DMARC published — the same DNS work
blocking the rest of Slice 6.

Two changes came out of the test:

- The preheader was stacking `display:none` + `opacity:0` + paper-coloured
  text and padding with 60 invisible characters. That is what hidden-text
  heuristics look for. Now one hiding method and a 20-character pad.
- `send-test-email.ts` prints a preflight naming every spam-relevant property
  of the message before sending, so a future spam result is not misread as a
  template problem.

**That account pair is now spent as a test instrument.** Marking the message
"Not spam" trained the filter for that sender/recipient combination; placement
between those two addresses no longer measures anything. Use a fresh pair, and
read the headers *before* touching the spam button.

## What is still unverified

- **Rendering in any client except a browser.** No Litmus, no Email on Acid,
  no Outlook — the client most likely to break a table layout. The markup is
  built the conservative way (tables, inline styles, VML button, light-only
  palette) but that is an argument, not evidence.
- **Deliverability.** Cannot be answered gmail-to-gmail, and never will be.
- **The firm's details.** Address, phone and reply address in `tokens.ts` are
  placeholders. Swap before any real send.
- **Copy.** Held as-is at the user's direction (2026-08-18) pending a
  conversation with the client. It is isolated in `copy.ts` precisely so that
  conversation does not become a code change.

## To finish Slice 6

1. Recipient resolution in `lib/db/repo.ts` — delegate from `project_phases`,
   client contact from `projects.client_contact_id`, customer from
   `customers.contact_email`, baseline from `phase_subscribers`. `plan.ts`
   takes resolved people on purpose, so this is additive.
2. An outbox table, so a failed send is retryable and a review-before-send step
   has somewhere to hold messages.
3. A provider, and the DNS records. Blocked.
4. Reword the Settings tab and board column popover so `phase_subscribers`
   reads as a standing baseline rather than the routing model (WORKFLOW-2 §4).
   Not done.
