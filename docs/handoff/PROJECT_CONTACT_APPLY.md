# Project address and contact

User request (2026-08-21): a project's address, contact and phone are often not the
customer's own — a second home, a site manager, a builder, a spouse. Give the create form a
way to say "same as the customer", and somewhere to enter the difference when it is not.

Both halves were already specified and neither existed. `WORKFLOW-2.md` §3 "Intake" lists
**address** among the client fields and **project address** among the project fields; the
schema had neither. This closes that gap and extends it by three: the contact block diverges
as a whole in practice, not the street alone.

**This is not Slice 3.** Slice 3 (intake form expansion) is still on hold pending the
client's field/label list. This is a narrower, directly requested change that happens to land
two of the fields Slice 3 will eventually surface. When Slice 3 resumes, these four columns
already exist.

## SQL — APPLIED 2026-08-21 (verified against hosted Supabase)

Apply `supabase/migrations/20260821100000_project_address_contact.sql` (hosted Supabase → SQL
editor, same as prior slices).

```sql
alter table public.customers
  add column if not exists address text;

alter table public.projects
  add column if not exists project_address text,
  add column if not exists project_contact_name text,
  add column if not exists project_contact_email text,
  add column if not exists project_contact_phone text;
-- + four column comments
```

Additive and idempotent. No backfill — existing rows land at `null`, which is exactly "same
as the customer", so every project that exists today reads correctly the moment it lands.

All five columns were confirmed present on hosted Supabase by probing them directly. Nothing
outstanding here.

## The model

**Null means "same as the customer", per field.** There is no `uses_customer_contact`
boolean, and adding one later would be a regression:

- A stored flag can disagree with the rows it describes. Derived, it cannot — the same call
  `SLICE_4_SCOPE.md` decision 4 makes for delegation completeness.
- The fallback is genuinely **per field**. A project can carry its own address and site
  manager while the email still routes to the customer. An all-or-nothing flag cannot say
  that, and the seed has a case of exactly it (`MK-0410`).
- Clearing all four *is* the "same as customer" write. One state, one representation.

**A blank string is an empty form field, not an override.** `lib/contact.ts` trims and
treats empty as absent, so tabbing through the form without typing does not silently pin a
project to nothing.

**`projects.client_contact_id` is unrelated.** That is the *internal* staff member who owns
the relationship (`WORKFLOW-2.md` §3). It is still unsurfaced. Do not conflate the two —
"client contact" is a colleague, "project contact" is someone to phone about a building.

## Behavior

**New project dialog.** A ticked "Project address and contact are the same as the customer"
box, with the customer's actual address and contact name echoed underneath so ticking it is
an informed choice rather than a default nobody read. Unticking reveals four fields; blanks
still fall back. The inline **+ New customer** form gains an Address field, so a customer
created here can be the thing a project inherits from.

**Detail sheet → Details → Address & contact.** The resolved values, with the same tick box.
While overriding, each field is an input whose *placeholder* is the customer's value and
which says "Using <customer>'s" underneath when it is still inheriting — so the screen
distinguishes "we entered this" from "this came from the customer" without a legend.

**Re-ticking the box asks first.** It is a delete of four columns, so it prompts inline
("Discard this project's own 2 details?") rather than dropping typed values on a checkbox
click. With nothing stored it just folds the form away — no write.

**One write, one log entry.** `clearProjectContactAction` nulls all four in a single
`updateProject`, so returning a project to the customer's details is one `project.updated`
row rather than four.

**Customer address is surfaced in three places**: the customer detail form, the project
sheet's Customer section, and the create dialog's inline customer form.

## Checks

```bash
npm run check:contact   # 23 assertions — fallback, partial override, blanks, clearing
```

Folded into `npm run check`. Covers `lib/contact.ts`, which is React-free for that reason.
Nothing here checks rendering.

## Verify after applying

1. Open any seeded project → Details → Address & contact reads the customer's, box ticked.
2. `MK-0400` (Ortega garage studio) has its own **address only** — the box is unticked, the
   address is its own, and contact/email/phone all read "Using Ortega Residence's".
3. `MK-0410` (Cardinal & Vine West Loop) overrides address, contact and phone but **not**
   email — the partial case the design exists for.
4. Untick on a fresh project, type an address, blur → saves. Re-tick → prompts, then clears.
5. Create a project with the box ticked → all four columns null.
6. Create one with it unticked and only a phone filled in → phone stored, other three null.

Items 2 and 3 need `npm run seed`; the seed now carries both cases.
