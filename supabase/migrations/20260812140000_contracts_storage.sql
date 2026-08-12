-- Slice 2: private contracts bucket + RLS on storage.objects
-- Run in Supabase SQL Editor (Storage SQL is not always applied by CLI migrations).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contracts',
  'contracts',
  false,
  20971520, -- 20 MB
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "contracts_select_authenticated" on storage.objects;
create policy "contracts_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'contracts');

drop policy if exists "contracts_insert_authenticated" on storage.objects;
create policy "contracts_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'contracts');

drop policy if exists "contracts_update_authenticated" on storage.objects;
create policy "contracts_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'contracts')
  with check (bucket_id = 'contracts');
