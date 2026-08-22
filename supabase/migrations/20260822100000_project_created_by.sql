-- Who created a project.
--
-- The board card's avatar is the **current-phase assignee** (PRD §6.2), which
-- is null for everything in Pending and for the Active holding column —
-- `create_project` forces `current_phase = null` for anything not already
-- active. So every freshly created project renders a `—` until somebody runs
-- Plan schedule on it. With more than one person filing projects (2026-08-22)
-- that reads as "nobody owns this" rather than "no phase has started".
--
-- The creator was already recorded, but only as an `activity_log` row with
-- `event_type = 'project.created'`. That is an append-only audit stream: it is
-- not indexed for this, it costs a second query and a scan per board render,
-- and nothing guarantees exactly one such row per project. A column on
-- `projects` is the honest home for a fact about the project.
--
-- Nullable, and `on delete set null` to match `project_phases.assignee_id`:
-- deleting a person must not delete their projects, and pre-existing rows with
-- no `project.created` entry keep working. The card falls back to `—` exactly
-- as it does today when this is null.

alter table public.projects
  add column if not exists created_by uuid references public.users(id) on delete set null;

comment on column public.projects.created_by is
  'Staff member who created the project. Null for rows predating this column '
  'or whose creator has been deleted. The board card shows this, muted, when '
  'the current phase has no assignee.';

-- ---------------------------------------------------------------------------
-- Backfill from the activity log
-- ---------------------------------------------------------------------------
-- `distinct on` guards against a project somehow carrying two create events:
-- take the earliest, which is the real one. Only fills rows still null, so
-- this is safe to re-run.
update public.projects p
set created_by = a.actor_id
from (
  select distinct on (project_id) project_id, actor_id
  from public.activity_log
  where event_type = 'project.created'
    and actor_id is not null
  order by project_id, created_at asc
) a
where a.project_id = p.id
  and p.created_by is null;

create index if not exists projects_created_by_idx
  on public.projects (created_by);
