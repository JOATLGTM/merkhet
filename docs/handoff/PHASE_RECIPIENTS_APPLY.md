# Phase recipients — per project, chosen where the phase is delegated

Decided 2026-09-01. Replaces the firm-wide **phase subscribers** list with a per-project,
per-phase **notify list** set in the same place the phase is delegated: Plan schedule on the
project sheet, and the phase row on the sheet itself.

## What changed, in one paragraph

`phase_subscribers` was one list per phase for the whole firm — subscribing to Design
development meant every project entering DD, for every customer. It had zero rows in
production and no obvious owner. The people who should hear about a phase starting are chosen
per project, next to the assignee, so the table is now `project_phase_recipients
(project_id, phase, user_id)`, edited from the delegation dialog and the sheet. The Staff
page lost its **Phase subscribers** tab and the board column headers lost the popover and the
⚠️. Nothing about *when* mail fires changed; only who is on the copy list.

Also settled on the same decision:

- **Pending and Active notify nobody per project.** They have no phase row to hang a list on,
  so `resolveAudiences` resolves an empty list for both. Active still copies leadership.
- **Admins stay auto-copied** on Active, Permitting, both gates and completion. Unchanged.
- **`projects.client_contact_id` is gone.** It sat in the Review, Final review and Marked
  complete recipient lists and nothing ever wrote it, so those rows resolved to one person
  fewer than the table implied. Dropped from routing, from the templates (it signed the client
  mail — the firm's reply address does now, as it already did whenever the field was null), and
  from the table.

## SQL — NOT YET APPLIED

`supabase/migrations/20260901100000_phase_recipients.sql`. Run in the hosted Supabase SQL
editor, same as prior slices. In order:

1. Creates `project_phase_recipients` with RLS (`authenticated_full_access`, matching every
   other table) and an index on `user_id`.
2. **Drops `phase_subscribers`.** No backfill: it was empty in production and its shape was
   the thing being retired.
3. **Drops `projects.client_contact_id`.**

Idempotent — `if not exists` / `if exists` throughout — so it is safe to re-run.

**Deploy order matters.** The app now selects from `project_phase_recipients` on every
project load, so code deployed before the SQL fails every board render with
"Failed to load phase recipients". Apply the SQL first, then deploy. The reverse gap is
harmless: old code with the new schema only loses the subscriber popover's data source, which
was empty.

## Verify

```bash
npm run check:recipients
```

Read-only. Confirms the new table is queryable, that `phase_subscribers` and
`client_contact_id` are gone (round-trip selects, not head counts — see NEXT.md 2026-08-21),
then prints, per live project and phase, the assignee, the notify list, and who the internal
mail would actually reach once the project enters that phase. It calls out any design phase
with no assignee and no recipients, because that mail is still dropped silently before the
outbox insert (`lib/email/send.ts`).

Also worth a look after applying: `npm run email:preview` still renders all 16 fixture
messages, and `npm run check` (the four pure modules) still passes. Both were green on
2026-09-01 before the SQL was run.

## Routing after this change

| Move to | Internal reaches | Client copy |
|---|---|---|
| Pending | nobody | — |
| Active | leadership | — |
| Schematic design | assignee + notify list | yes |
| Design development | assignee + notify list | yes |
| Review | leadership | — |
| Construction documents | assignee + notify list | yes |
| Final review | assignee + leadership + notify list | — |
| Permitting | assignee + leadership + notify list | yes |
| Gate rejected | assignee + notify list, of the phase returned to | — |
| Marked complete | leadership + notify list of the current phase | yes |

The routing table in `lib/email/README.md` is the maintained copy of this.

## Where it lives

| Concern | File |
|---|---|
| Table | `supabase/migrations/20260901100000_phase_recipients.sql` |
| Type | `ProjectPhase.notify_ids` in `lib/types.ts` — hydrated onto every phase row |
| Hydration | `groupRecipients` + `mapPhase` in `lib/db/repo.ts`, both `hydrateProject*` paths |
| Write, with the schedule | `saveDelegation` — `DelegationEntry.notify_ids`, written per phase after the dates |
| Write, on its own | `setPhaseRecipients` → `setPhaseRecipientsAction` — logs `phase.recipients_changed` |
| Resolution | `resolveAudiences` reads `notify_ids` off the hydrated project — no extra query |
| Routing | `Audiences.phaseRecipients` in `lib/email/plan.ts` (was `subscribers`) |
| UI | `components/projects/phase-recipients-picker.tsx` — inline expand, not a popover, on purpose (see the comment there) |
| In the dialog | `components/projects/delegation-dialog.tsx` — one picker per delegated phase, saved with the form; the assignee is stripped from the list on submit |
| On the sheet | `components/projects/project-detail-sheet.tsx` — under each delegated phase row, saves in place |
| Check | `scripts/check-recipients.ts` (`npm run check:recipients`) |

Removed: `components/board/subscriber-popover.tsx`, `setSubscribersAction`,
`listPhaseSubscribers`, `setPhaseSubscribers`, the `PhaseSubscriber` type, the Settings tab,
the `subscribers` demo seed and its insert in `scripts/seed-demo.ts`. `scripts/reset-data.ts`
and `scripts/delete-user.ts` now name the new table.

## Things that are still true

- **A design phase with no assignee and no notify list still mails nobody internally**, and
  nothing tells you. The drop rule in `send.ts` is unchanged. `check:recipients` is the way to
  see it.
- **Deactivating someone does not remove them from notify lists.** Deactivation is reversible;
  `resolveAudiences` drops inactive people at send time. Deleting them cascades the rows.
- **The picker hides the assignee.** They are notified as the delegate; a second tick would
  only be deduped downstream. If the assignee changes later, the previous one is not
  automatically added to the list.

## Not verified in a browser

Compiles, lints at baseline (the five pre-existing `set-state-in-effect` and `prefer-const`
errors, nothing new), typechecks clean, `npm run check` and `npm run email:preview` pass.
Nobody has clicked the picker: there are no demo logins (ACCOUNTS_APPLY), so the first
Plan schedule save on a real project is the browser test.
