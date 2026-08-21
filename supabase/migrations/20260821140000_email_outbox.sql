-- Slice 6: outbox for transactional mail.
--
-- Every message is written here before the provider is called, so a failed
-- send is visible and retryable rather than lost to a log line. The rendered
-- html/text are stored rather than re-rendered on retry: a retry should send
-- the message that was planned, not whatever the templates produce today.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'email_status') then
    create type public.email_status as enum ('pending', 'sent', 'failed');
  end if;
end
$$;

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  -- Nulled rather than cascaded: a deleted project should not erase the
  -- record that we mailed someone about it.
  project_id uuid references public.projects (id) on delete set null,
  template text not null,
  audience text not null check (audience in ('internal', 'customer')),
  to_addresses text[] not null,
  subject text not null,
  html text not null,
  text_body text not null,
  status public.email_status not null default 'pending',
  /** Provider's id for the accepted message, for tracing a delivery. */
  provider_id text,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_outbox_status_created_idx
  on public.email_outbox (status, created_at desc);

create index if not exists email_outbox_project_idx
  on public.email_outbox (project_id, created_at desc);

alter table public.email_outbox enable row level security;

drop policy if exists "authenticated_full_access" on public.email_outbox;
create policy "authenticated_full_access" on public.email_outbox
  for all to authenticated using (true) with check (true);
