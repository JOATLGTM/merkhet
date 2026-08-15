-- Planned hours per phase.
--
-- Client request (2026-08-14): pull the *planned* half of WORKFLOW-2 §8
-- "Hours tracking" forward from Phase 2. This is a budget number set at
-- delegation alongside assignee + duration_days. Still no time entry, no
-- rates, no invoicing — logged hours remain Phase 2.
--
-- Review is a pure gate (WORKFLOW-2 §3): no delegate, no duration, consumes
-- no schedule time, so it takes no planned hours either. That is enforced in
-- the UI against DELEGATED_PHASES rather than here, so the rule can move
-- without a migration.

alter table public.project_phases
  add column if not exists planned_hours numeric(6, 1);

alter table public.project_phases
  drop constraint if exists planned_hours_non_negative;

alter table public.project_phases
  add constraint planned_hours_non_negative
  check (planned_hours is null or planned_hours >= 0);
