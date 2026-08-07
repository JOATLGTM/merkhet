-- Merkat MVP schema (§5)

create type project_status as enum ('backlog', 'pending', 'active', 'completed');
create type design_phase as enum (
  'schematic_design',
  'design_development',
  'construction_documents',
  'review',
  'permitting'
);
create type phase_status as enum ('not_started', 'in_progress', 'completed', 'skipped');
create type user_role as enum ('admin', 'staff');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.project_number_seq start 400;

create or replace function public.next_project_number()
returns text
language sql
as $$
  select 'MK-' || lpad(nextval('public.project_number_seq')::text, 4, '0');
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  project_number text not null unique default public.next_project_number(),
  name text not null,
  description text,
  status project_status not null default 'backlog',
  current_phase design_phase,
  on_hold boolean not null default false,
  on_hold_since timestamptz,
  on_hold_reason text,
  start_date date,
  target_completion date,
  hours_per_week numeric(5,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint phase_matches_status check (
    (status = 'active' and current_phase is not null) or
    (status <> 'active' and current_phase is null)
  ),

  constraint hold_timestamp_matches_flag check (
    (on_hold and on_hold_since is not null) or
    (not on_hold and on_hold_since is null)
  )
);

create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase design_phase not null,
  assignee_id uuid references public.users(id) on delete set null,
  status phase_status not null default 'not_started',
  planned_start date,
  planned_end date,
  entered_at timestamptz,
  completed_at timestamptz,
  sort_order smallint not null,
  unique (project_id, phase)
);

create unique index one_active_phase_per_project
  on public.project_phases (project_id)
  where status = 'in_progress';

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_project_created
  on public.activity_log (project_id, created_at desc);

create table public.phase_subscribers (
  phase design_phase not null,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (phase, user_id)
);

-- Seed all five phase rows whenever a project is created
create or replace function public.seed_project_phases()
returns trigger
language plpgsql
as $$
begin
  insert into public.project_phases (project_id, phase, status, sort_order)
  values
    (new.id, 'schematic_design', 'not_started', 1),
    (new.id, 'design_development', 'not_started', 2),
    (new.id, 'construction_documents', 'not_started', 3),
    (new.id, 'review', 'not_started', 4),
    (new.id, 'permitting', 'not_started', 5);
  return new;
end;
$$;

create trigger trg_seed_project_phases
  after insert on public.projects
  for each row execute function public.seed_project_phases();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Auto-create public.users row from auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'staff')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS (§5.4)
alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.project_phases enable row level security;
alter table public.activity_log enable row level security;
alter table public.phase_subscribers enable row level security;

create policy "authenticated_full_access" on public.users
  for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on public.customers
  for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on public.projects
  for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on public.project_phases
  for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on public.activity_log
  for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on public.phase_subscribers
  for all to authenticated using (true) with check (true);
