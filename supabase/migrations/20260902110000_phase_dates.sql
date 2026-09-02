-- Explicit phase dates: the constraints hand-entry needs.
--
-- Until 2026-09-02 `planned_start` / `planned_end` were written only by
-- `deriveSchedule`, chained back to back from `projects.start_date` and the
-- durations, so nothing could put an end before a start or date one half of a
-- phase. Now they are typed in — a phase can sit wherever the person holding
-- it is free — and the database should refuse what the form refuses.
--
-- No data change: every existing pair came out of the chain and satisfies
-- both checks. `duration_days` stays and is kept in step by the app as the
-- working-day count of the span, so the Active → SD gate (`move_project`),
-- `isDelegationComplete` and the workload rate are untouched.

alter table public.project_phases
  drop constraint if exists project_phases_dates_ordered,
  add constraint project_phases_dates_ordered
    check (planned_start is null or planned_end is null or planned_end >= planned_start);

alter table public.project_phases
  drop constraint if exists project_phases_dates_paired,
  add constraint project_phases_dates_paired
    check ((planned_start is null) = (planned_end is null));
