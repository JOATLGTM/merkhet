# Developer role — admin access, no presence, cannot be removed

Decided 2026-09-01. One account — Chris Vo, `christopher.vo.h@gmail.com` — becomes
`developer`: everything an admin can do, invisible everywhere the firm looks, and impossible
to delete, deactivate or demote from the app.

## What it means

| | admin | developer |
|---|---|---|
| Signs in, sees every route incl. `/staff` | yes | yes |
| Runs admin-only actions (invite, role, active, delete) | yes | yes |
| Appears on the board (assignee filter, card avatars) | yes | **no** |
| Appears in the calendar's staff view | yes | **no** |
| Listed on `/staff` | yes | **no** |
| Offered as a delegate or in a notify list | yes | **no** |
| Copied as leadership on Active / Permitting / gates / completion | yes | **no** |
| Can be deleted, deactivated or demoted | yes | **no — trigger** |
| Can be handed out from `/staff` | yes | **no — migration only** |

## SQL — NOT YET APPLIED

Two files, **in order, each on its own** (enum values cannot be used in the transaction
that adds them — same split as `gate_parties` and `workflow_1b`):

1. `supabase/migrations/20260901110000_developer_role_enum.sql` — adds `'developer'` to
   `user_role`.
2. `supabase/migrations/20260901110100_developer_role.sql` — creates `protect_developer()`
   and the `users_protect_developer` trigger (`before update or delete`), then sets the role
   on the row whose email matches and forces `is_active = true`.

Both idempotent.

**Order against `20260901100000_phase_recipients.sql`:** independent. Either can go first.

### Verify

```sql
select name, email, role, is_active from public.users order by role, name;
-- expect exactly one 'developer' row, active

-- both must fail with "The developer account cannot be…"
update public.users set role = 'staff' where role = 'developer';
delete from public.users where role = 'developer';
```

Then sign in as the developer: `/staff` loads, and the Team table does **not** list you. The
board's assignee filter and the calendar's staff view do not name you either.

## How the app does it

| Concern | Where |
|---|---|
| Type + helpers | `UserRole`, `ASSIGNABLE_ROLES`, `isAdmin()` in `lib/types.ts` |
| Access | `requireAdmin` (`lib/auth/session.ts`), `/staff` page gate, nav rail `adminOnly` — all through `isAdmin` |
| Invisibility | `listUsers` in `lib/db/repo.ts` adds `.neq("role", "developer")`. Every roster in the app — board, calendar, `/staff`, completed, customer detail, and through them the delegation dialog, the sheet's assignee select and the notify picker — comes from it. The session lookup (`getUserById`) does not filter |
| Not leadership | `resolveAudiences` already selects `role = 'admin'` only |
| Cannot be changed from the app | `updateRoleAction`, `setActiveAction`, `deleteUserAction` refuse a developer target with a sentence; `updateRoleAction` and `inviteUserAction` refuse `developer` as an input |
| Cannot be changed from SQL either | `users_protect_developer` trigger. Blocks the `auth.users` cascade too, so the login cannot be deleted through the Supabase dashboard's Users page without dropping the trigger first |

## Consequences worth knowing

- **Anything the developer does reads as "Someone".** Activity lines, approval "recorded by"
  and the board card's creator fallback all resolve names through the roster from
  `listUsers`. A project the developer files shows `—` in Pending/Active, and
  `npm run check:creator` will flag it as "on the board and still renders —". That is the
  role working as specified, not a bug; if it grates, the fix is a separate name-lookup map
  that includes hidden accounts (the same split NEXT.md already wants for deactivated users).
- **Client-mail redirect still reaches the developer** when they own the project
  (`projects.created_by`). `resolveAudiences` reads the owner by id, not from the roster.
- **The nav rail prints the role** under the name, so it will say `developer`.
- **Self-service is also locked.** The developer cannot demote themselves either. Removing the
  account means dropping the trigger in SQL, then deleting — deliberate.
- **`scripts/reset-data.ts`** promotes the surviving account to `admin`. If that is ever run
  against the developer's row the trigger refuses it and the script fails at that step.

## Not verified in a browser

Typechecks and builds clean. The migration has not been run, so nobody has signed in as a
`developer` yet — the verify steps above are the first test.
