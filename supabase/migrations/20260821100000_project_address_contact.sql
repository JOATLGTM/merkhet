-- Project address and project-level contact, overriding the customer's.
--
-- WORKFLOW-2 §3 "Intake" already lists both halves of this and neither
-- existed: the client fields call for an **address**, and the project fields
-- call for a **project address**. Requested directly by the user (2026-08-21):
-- a project's address and the person to call about it are often not the
-- customer's own — a second home, a site contact, a builder, a spouse.
--
-- Four project columns rather than one address, because in practice it is the
-- whole contact block that diverges, not the street alone.
--
-- **Null means "same as the customer", per field.** There is deliberately no
-- `uses_customer_contact` boolean: a stored flag can disagree with the rows it
-- describes, and the fallback is per field anyway — a project can carry its
-- own address while the phone still rings through to the customer. Same
-- reasoning as delegation completeness (`SLICE_4_SCOPE.md` decision 4), which
-- is derived rather than stored for exactly this reason.
--
-- `projects.client_contact_id` is unrelated and stays as it is: that is the
-- *internal* staff member who owns the relationship (WORKFLOW-2 §3), not
-- somebody to phone about the building.

-- ---------------------------------------------------------------------------
-- Customer address — the missing WORKFLOW-2 §3 client field
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists address text;

-- ---------------------------------------------------------------------------
-- Project overrides — null inherits from the customer
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists project_address text,
  add column if not exists project_contact_name text,
  add column if not exists project_contact_email text,
  add column if not exists project_contact_phone text;

comment on column public.projects.project_address is
  'Site address. Null inherits customers.address.';
comment on column public.projects.project_contact_name is
  'Who to contact about this project. Null inherits customers.contact_name.';
comment on column public.projects.project_contact_email is
  'Null inherits customers.contact_email.';
comment on column public.projects.project_contact_phone is
  'Null inherits customers.contact_phone.';
