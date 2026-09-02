-- Undo: drop the timesheet table that was never used.
--
-- `20260901120000_time_entries.sql` created `public.time_entries` for a first
-- cut of the Bill page that logged hours by hand. That reading was wrong and
-- the code was removed before it shipped (BILL_APPLY.md) — the Bill page reads
-- `project_phases.planned_hours` and has no table of its own. The migration
-- file was deleted from the tree, but it had already been run against hosted
-- Supabase on 2026-09-01, so this file exists to take the table back out and
-- to leave a record of why there is a gap in the sequence.
--
-- Nothing reads or writes the table; dropping it loses nothing. Idempotent.

drop table if exists public.time_entries;
