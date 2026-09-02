-- Developer role: add the enum value.
--
-- Split from 20260901110100_developer_role.sql for the same reason the
-- gate-parties and workflow_1b migrations are split: Postgres will not let a
-- transaction *use* an enum value it added, and the file that follows both
-- assigns the role and names it in a trigger. Run this file first, on its own.
--
-- `if not exists` makes it idempotent, so re-running is harmless.

alter type public.user_role add value if not exists 'developer';
