-- Per-project phase recipients replace firm-wide phase subscribers.
--
-- `phase_subscribers` was one list per phase for the whole firm: anyone on it
-- was copied on every project's entry into that phase. Decided 2026-09-01 that
-- the people to notify are chosen per project, in the same place the phase is
-- delegated — Plan schedule on the project sheet — so the list lives next to
-- the assignee it complements.
--
-- Shape mirrors the table it replaces: a join row per (project, phase, user),
-- cascading away with the project or the user. Nothing in SQL reads it; like
-- its predecessor it is resolved app-side by `resolveAudiences`.
--
-- Also dropped: `projects.client_contact_id`. The routing table named it as a
-- recipient on Review, Final review and completion, but nothing has ever
-- written it — no create path, no UI — so it resolved to nobody on every real
-- project. Removed from routing on the same decision; the column goes with it.

create table if not exists public.project_phase_recipients (
  project_id uuid not null references public.projects(id) on delete cascade,
  phase design_phase not null,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, phase, user_id)
);

comment on table public.project_phase_recipients is
  'Staff copied on internal mail when this project enters this phase, in '
  'addition to the phase assignee. Chosen per project in Plan schedule.';

create index if not exists project_phase_recipients_user_idx
  on public.project_phase_recipients (user_id);

alter table public.project_phase_recipients enable row level security;

drop policy if exists "authenticated_full_access" on public.project_phase_recipients;
create policy "authenticated_full_access" on public.project_phase_recipients
  for all to authenticated using (true) with check (true);

-- No backfill: the old list was firm-wide and had zero rows in production
-- (EMAIL_REDIRECT_APPLY, 2026-08-23), and a per-phase default copied onto
-- every project is exactly the model being retired.
drop table if exists public.phase_subscribers;

alter table public.projects
  drop column if exists client_contact_id;
