# Board card — creator fallback on the assignee avatar

User report (2026-08-22, from production): five colleagues had created projects and every
one of their cards showed a `—` in the bottom-left circle. Only the reporter's own project
showed initials.

## It was not a data problem

The circle is the **current-phase assignee**, exactly as `PRD.md` §6.2 line 414 specifies
("Assignee avatar for the current phase"). Nothing was wrong with the other accounts:

- `createProject` forces `current_phase = null` for anything not already active
  (`lib/db/repo.ts`), so every project starts in Pending with no current phase.
- `boardColumnOf` puts `status = 'active'` with `current_phase = null` in the **Active**
  holding column, also with no current phase (`lib/types.ts`).
- With `current_phase` null, `project.phases.find(...)` returns `undefined`, there is no
  `assignee_id` to look up, and the card renders `—`.

So the whole Pending column and the whole Active column were anonymous until somebody ran
**Plan schedule**. With one person filing projects that read as "not planned yet"; with six
it reads as "nobody owns this".

Ruled out along the way: RLS is a blanket `authenticated_full_access` on `users`
(`20260807100000_init.sql`), so this was never a visibility restriction, and
`hydrateProjectList` was loading every phase row correctly.

**There was no creator to show.** `projects` had no owner column. The creator existed only
as an `activity_log` row with `event_type = 'project.created'` and an `actor_id`.

## SQL — APPLIED 2026-08-22 (verified against hosted Supabase)

`supabase/migrations/20260822100000_project_created_by.sql`, run in the hosted Supabase SQL
editor, same as prior slices.

```sql
alter table public.projects
  add column if not exists created_by uuid references public.users(id) on delete set null;

-- backfill from the earliest project.created activity row per project
update public.projects p
set created_by = a.actor_id
from (
  select distinct on (project_id) project_id, actor_id
  from public.activity_log
  where event_type = 'project.created' and actor_id is not null
  order by project_id, created_at asc
) a
where a.project_id = p.id and p.created_by is null;

create index if not exists projects_created_by_idx on public.projects (created_by);
```

Additive and idempotent — the backfill only fills rows still null, so it is safe to re-run.

**Verified: 6/6 production projects have a creator, and every one matches the earliest
`project.created` row in the activity log.** `npm run check:creator` re-runs the check —
read-only, it confirms the column exists, that `created_by` agrees with the activity log,
that no board project still renders `—`, and that no card resolves to a deleted or
deactivated user. State at verification:

| Project | Column | Avatar source | Renders |
|---|---|---|---|
| MK-0400 | Design development | assignee | Chris Vo |
| MK-0401 – MK-0405 | Pending | creator | Austin Stinemetz |

That is the reported bug: five Pending projects filed by Austin, all of which read `—`
before this change because Pending has no phase to carry an assignee.

`on delete set null` matches `project_phases.assignee_id`: deleting a person must not delete
their projects. A null `created_by` still renders `—`, exactly as today.

## Behavior

The avatar now resolves in two steps, and the two states are visually distinct so they can
never be read as the same fact:

| State | Renders | Style |
|---|---|---|
| Current phase has an assignee | Assignee initials | Solid `bg-phase-5` on `text-paper` |
| No current-phase assignee, project has a creator | Creator initials | Outlined `border-rule-strong`, `text-ink-mid` |
| Neither | `—` | Filled `bg-rule`, `text-ink-soft` |

A `title` on the circle spells out which one it is on hover — "Dana Whitfield — current
phase" vs "Dana Whitfield — created this project".

The assignee still wins whenever there is one, so nothing about Active/SD → Permitting
changes. This only fills in columns that were previously blank by construction.

## Files

- `supabase/migrations/20260822100000_project_created_by.sql` — new
- `lib/types.ts` — `Project.created_by: string | null`
- `lib/db/repo.ts` — `mapProject` reads it; `createProject` writes `input.actor_id`
- `components/projects/project-card.tsx` — the fallback and the muted style
- `lib/db/demo-store.ts` — `makeProject` defaults `created_by` to the seed admin
- `scripts/seed-demo.ts` — maps the seed creator through `userMap`
- `scripts/check-creator.ts` — read-only verification, `npm run check:creator`

## Still open

`listUsers()` defaults to `activeOnly = true` (`lib/db/repo.ts`) and the board page calls it
bare, so `usersById` holds only active staff. **Any card whose assignee — or now creator —
has been deactivated still falls back to `—`.** Not fixed here, because the same `users`
prop also populates the assignee filter and the detail sheet's assignee selects, which
should keep offering active staff only. The fix is to separate "directory for name lookups"
from "people you can assign", not to flip the flag.

`check:creator` fails loudly if this ever bites — it flags any project whose resolved person
is deactivated. Nobody is deactivated today, so it passes.
