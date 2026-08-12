-- Slice 1B part 2: workflow schema (after final_review enum value exists).
-- Source: docs/handoff/WORKFLOW-2.md + CHANGES-2.md Slice 1B.
-- Do not edit 20260807100000_init.sql.

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists spouse_name text;

-- ---------------------------------------------------------------------------
-- Projects — intake fields, archive, contract stub, Active holding state
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists client_desired_completion date,
  add column if not exists project_budget numeric(12, 2),
  add column if not exists design_budget numeric(12, 2),
  add column if not exists client_contact_id uuid references public.users (id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists contract_path text,
  add column if not exists contract_filename text,
  add column if not exists contract_uploaded_at timestamptz;

-- Active may have null current_phase (holding state before SD).
alter table public.projects drop constraint if exists phase_matches_status;

alter table public.projects
  add constraint phase_matches_status check (
    (
      status = 'active'
      and archived_at is null
    )
    or (
      status in ('pending', 'backlog')
      and current_phase is null
      and archived_at is null
    )
    or (
      status = 'completed'
      and current_phase is null
    )
  );

-- ---------------------------------------------------------------------------
-- project_phases — delegation duration (assignee_id already exists)
-- ---------------------------------------------------------------------------
alter table public.project_phases
  add column if not exists duration_days integer;

-- ---------------------------------------------------------------------------
-- Approvals (gates)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.approval_party as enum (
    'client_contact',
    'austin',
    'client'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.approval_status as enum ('pending', 'approved');
exception when duplicate_object then null;
end $$;

create table if not exists public.project_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase public.design_phase not null,
  party public.approval_party not null,
  status public.approval_status not null default 'pending',
  approved_at timestamptz,
  recorded_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, phase, party),
  constraint approval_phase_is_gate check (
    phase in ('review', 'final_review')
  ),
  constraint approval_recorded_when_approved check (
    (status = 'pending' and approved_at is null)
    or (status = 'approved' and approved_at is not null and recorded_by is not null)
  )
);

create index if not exists project_approvals_project_idx
  on public.project_approvals (project_id);

-- ---------------------------------------------------------------------------
-- Phase transition history (append-only)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.transition_direction as enum ('forward', 'backward');
exception when duplicate_object then null;
end $$;

create table if not exists public.phase_transitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  from_column text,
  to_column text not null,
  direction public.transition_direction not null default 'forward',
  actor_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists phase_transitions_project_created_idx
  on public.phase_transitions (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Consultants (schema only — UI is Slice 7)
-- ---------------------------------------------------------------------------
create table if not exists public.consultants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  discipline text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_consultants (
  project_id uuid not null references public.projects (id) on delete cascade,
  consultant_id uuid not null references public.consultants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, consultant_id)
);

-- ---------------------------------------------------------------------------
-- Seed trigger: six phases, new sort order
-- SD(1) → DD(2) → Review(3) → CD(4) → Final Review(5) → Permitting(6)
-- ---------------------------------------------------------------------------
create or replace function public.seed_project_phases()
returns trigger
language plpgsql
as $$
begin
  insert into public.project_phases (project_id, phase, status, sort_order)
  values
    (new.id, 'schematic_design', 'not_started', 1),
    (new.id, 'design_development', 'not_started', 2),
    (new.id, 'review', 'not_started', 3),
    (new.id, 'construction_documents', 'not_started', 4),
    (new.id, 'final_review', 'not_started', 5),
    (new.id, 'permitting', 'not_started', 6);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Data migrate existing rows
-- ---------------------------------------------------------------------------
update public.projects
set status = 'pending'
where status = 'backlog';

-- Insert missing final_review rows
insert into public.project_phases (project_id, phase, status, sort_order)
select p.id, 'final_review', 'not_started', 5
from public.projects p
where not exists (
  select 1 from public.project_phases pp
  where pp.project_id = p.id and pp.phase = 'final_review'
);

-- Reorder sort_order for new sequence
update public.project_phases set sort_order = 1 where phase = 'schematic_design';
update public.project_phases set sort_order = 2 where phase = 'design_development';
update public.project_phases set sort_order = 3 where phase = 'review';
update public.project_phases set sort_order = 4 where phase = 'construction_documents';
update public.project_phases set sort_order = 5 where phase = 'final_review';
update public.project_phases set sort_order = 6 where phase = 'permitting';

-- ---------------------------------------------------------------------------
-- RLS placeholders (match init style)
-- ---------------------------------------------------------------------------
alter table public.project_approvals enable row level security;
alter table public.phase_transitions enable row level security;
alter table public.consultants enable row level security;
alter table public.project_consultants enable row level security;

drop policy if exists "authenticated_full_access" on public.project_approvals;
create policy "authenticated_full_access" on public.project_approvals
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on public.phase_transitions;
create policy "authenticated_full_access" on public.phase_transitions
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on public.consultants;
create policy "authenticated_full_access" on public.consultants
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on public.project_consultants;
create policy "authenticated_full_access" on public.project_consultants
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- move_project — supports Active holding + six phases; logs phase_transitions
-- ---------------------------------------------------------------------------
create or replace function public.move_project(
  p_project_id uuid,
  p_to_column text,
  p_actor_id uuid
)
returns public.projects
language plpgsql
security invoker
as $$
declare
  proj public.projects%rowtype;
  from_column text;
  from_status project_status;
  from_phase design_phase;
  to_phase design_phase;
  is_phase boolean;
  phase_order text[] := array[
    'schematic_design',
    'design_development',
    'review',
    'construction_documents',
    'final_review',
    'permitting'
  ];
  from_order int;
  to_order int;
  ph record;
  direction transition_direction := 'forward';
begin
  select * into proj from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if proj.archived_at is not null then
    raise exception 'Cannot move an archived project';
  end if;

  from_status := proj.status;
  from_phase := proj.current_phase;
  if from_status = 'active' and from_phase is null then
    from_column := 'active';
  elsif from_status = 'active' and from_phase is not null then
    from_column := from_phase::text;
  else
    from_column := from_status::text;
  end if;

  is_phase := p_to_column = any (phase_order);

  if p_to_column = 'active' then
    -- Holding state: status active, no phase
    for ph in
      select * from public.project_phases where project_id = p_project_id
    loop
      if ph.status = 'in_progress' then
        update public.project_phases
        set status = 'not_started',
            entered_at = null,
            completed_at = null
        where id = ph.id;
      end if;
    end loop;

    update public.projects
    set status = 'active',
        current_phase = null,
        updated_at = now()
    where id = p_project_id
    returning * into proj;

  elsif is_phase then
    to_phase := p_to_column::design_phase;
    to_order := array_position(phase_order, p_to_column);
    from_order := case
      when from_phase is null then -1
      else array_position(phase_order, from_phase::text)
    end;

    if from_order >= 0 and to_order < from_order then
      direction := 'backward';
    end if;

    for ph in
      select * from public.project_phases where project_id = p_project_id
    loop
      if ph.phase = to_phase then
        update public.project_phases
        set status = 'in_progress',
            entered_at = now(),
            completed_at = null
        where id = ph.id;
      elsif ph.status = 'in_progress' then
        update public.project_phases
        set status = 'completed',
            completed_at = now()
        where id = ph.id;
      elsif direction = 'forward'
        and from_order >= 0
        and array_position(phase_order, ph.phase::text) > from_order
        and array_position(phase_order, ph.phase::text) < to_order
        and ph.status = 'not_started'
      then
        update public.project_phases
        set status = 'skipped'
        where id = ph.id;
      end if;
    end loop;

    update public.projects
    set status = 'active',
        current_phase = to_phase,
        updated_at = now()
    where id = p_project_id
    returning * into proj;

  elsif p_to_column in ('pending', 'backlog') then
    for ph in
      select * from public.project_phases where project_id = p_project_id
    loop
      if ph.status = 'in_progress' then
        update public.project_phases
        set status = 'not_started',
            entered_at = null,
            completed_at = null
        where id = ph.id;
      end if;
    end loop;

    update public.projects
    set status = 'pending',
        current_phase = null,
        updated_at = now()
    where id = p_project_id
    returning * into proj;

  elsif p_to_column = 'completed' then
    for ph in
      select * from public.project_phases where project_id = p_project_id
    loop
      if ph.status <> 'skipped' then
        update public.project_phases
        set status = 'completed',
            completed_at = coalesce(ph.completed_at, now())
        where id = ph.id;
      end if;
    end loop;

    update public.projects
    set status = 'completed',
        current_phase = null,
        archived_at = coalesce(proj.archived_at, now()),
        updated_at = now()
    where id = p_project_id
    returning * into proj;

  else
    raise exception 'Invalid column: %', p_to_column;
  end if;

  insert into public.activity_log (project_id, actor_id, event_type, payload)
  values (
    p_project_id,
    p_actor_id,
    'phase.changed',
    jsonb_build_object(
      'from', from_column,
      'to', p_to_column,
      'from_status', from_status::text,
      'to_status', proj.status::text
    )
  );

  insert into public.phase_transitions (
    project_id, from_column, to_column, direction, actor_id
  ) values (
    p_project_id, from_column, p_to_column, direction, p_actor_id
  );

  return proj;
end;
$$;

revoke all on function public.move_project(uuid, text, uuid) from public;
grant execute on function public.move_project(uuid, text, uuid) to authenticated;
