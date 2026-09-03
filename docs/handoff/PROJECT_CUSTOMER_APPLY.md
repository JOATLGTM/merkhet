# Changing a project's customer

User request (2026-09-03): a project was filed under the wrong customer at intake and there
was no way to correct it. The New project dialog is the only place a customer was ever
chosen; the detail sheet showed the customer read-only, with a link to the record, and every
other project field was already editable inline.

**No SQL.** `projects.customer_id` has been a plain nullable-false FK since `init.sql`, and
`updateProject`'s patch type already admitted `customer_id` — nothing on the server ever
sent it. This is a UI and action change only; nothing to run on hosted Supabase.

## What changed

| Layer | Change |
|---|---|
| `lib/db/repo.ts` | `changeProjectCustomer(id, customerId, actorId)` — checks the target exists, writes `customer_id`, logs `project.customer_changed` with both names |
| `app/actions/projects.ts` | `changeProjectCustomerAction` — wrapped in `attempt()`, revalidates the board, calendar, customers list, completed, **and** `/customers/[id]` (both the old and the new customer's page change) |
| `lib/activity.ts` | Copy for `project.customer_changed`: "*Actor* moved this project from *A* to *B*" |
| `components/projects/project-detail-sheet.tsx` | The **Customer** section's Name row is a Select of every customer. Picking one saves immediately and toasts "Moved to *B*". New `customers` prop |
| Board, calendar, completed, customer detail | Each page already loaded projects, users and consultants; they now also `listCustomers()` and hand the list to the sheet |

No new event type in SQL — `activity_log.event_type` is free text, as every other event is.

## The model

**A dedicated function, not the generic field path.** `updateProject` diffs the patch and
logs `project.updated` with `{ changed: { customer_id: [uuid, uuid] } }`, which the activity
feed would render as "updated customer_id". The customer is a relation, not a field: the entry
should name the two customers, and the write should confirm the target row exists rather than
let Postgres answer with an FK error. Hence `changeProjectCustomer`, and hence
`customer_id` is *not* added to `updateProjectFieldAction`'s field union.

**The project's own address and contact are left alone.** The four `project_*` columns
describe the site and who to phone about it, not the customer (`PROJECT_CONTACT_APPLY.md`).
Filing under the wrong customer does not make a typed-in site address wrong. Fields that were
null resolve to the *new* customer's on their own — that is what "null means same as the
customer, per field" buys here, with no code. The sheet says so under the picker.

**No confirm.** Reversible by picking again, and nothing is destroyed — phases, sign-offs,
activity, contract all stay with the project. Per DECISIONS.md "Destructive actions",
confirmation is graded by what is at stake, and here nothing is.

**Any status.** Pending, active, on a gate, on hold, completed — a completed project can be
filed wrong too, and Bill groups by project, not customer, so nothing downstream keys on it.

**Nothing else keys on `customer_id`.** Confirmed by grep: `project_number` comes from a
sequence, not the customer; email recipients resolve through the hydrated `project.customer`
at send time, so mail after the change goes to the right client; the customers list derives
its project counts live. The command palette and board search read `project.customer.name`
off the hydrated row.

## Behaviour to expect

- **From a customer's own page**, moving one of their projects away closes the sheet: the
  project leaves that page's list, `selected` becomes null, and the sheet unmounts its body.
  The toast still names where it went. This is correct, not a bug — the project is no longer
  on that page.
- **The current customer is always in the list**, even if the `customers` prop is somehow
  stale and no longer carries it, so the trigger never renders blank.
- **Picking the current customer again is a no-op** on the client; the repo also returns early
  on a same-id write so nothing is logged.

## Verify (browser — not yet clicked)

1. Open any board card → **Customer** section → the Name row is a dropdown showing the
   current customer.
2. Pick another customer. Toast "Moved to *B*", the header link under the title now reads
   *B*, and the Customer section's address/contact rows show *B*'s.
3. **Activity** (bottom of the sheet) has "*You* moved this project from *A* to *B*".
4. `/customers` — *A*'s project count is one lower, *B*'s one higher.
5. Open *A*'s page: the project is gone. Open *B*'s: it is there, and opening it from there
   shows the same dropdown.
6. If the project had "Same address and contact as *A*" ticked, it now reads "Same address
   and contact as *B*" and shows *B*'s details. If it had its own address typed in, that
   address is unchanged.
7. Pick *A* again to put it back — no confirm, one more activity line.

`npm run check` (the pure checks) still passes; nothing here has arithmetic to extract.
