-- Gate sign-off parties: add Ryan and the chosen third slot.
--
-- Split from 20260821120100_gate_parties.sql for the same reason
-- 20260812130000_workflow_1b_enum.sql is split from its own body: Postgres
-- will not let a transaction *use* an enum value it added, and the constraint
-- and function that follow both name these literals. Run this file first, on
-- its own.
--
-- `if not exists` makes it idempotent, so re-running is harmless.

alter type public.approval_party add value if not exists 'ryan';
alter type public.approval_party add value if not exists 'chosen';
