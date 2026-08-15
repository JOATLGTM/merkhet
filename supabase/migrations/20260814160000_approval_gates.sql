-- Slice 5: approval gates + rework loops.
--
-- Two changes to move_project:
--   1. A forward move that CROSSES a gate requires that gate's sign-offs.
--      Crossing is `from <= gate < to`, so it also blocks skipping the gate
--      entirely (DD -> CD, or CD -> Permitting).
--   2. Nothing else. Backward moves are unaffected; rejection has its own
--      function below because move_project would mark the rejected gate
--      'completed', which is the opposite of what a rejection means.
--
-- Also adds reject_gate(). Carries forward the Pending-contract gate (Slice 2)
-- and the delegation gate (Slice 4) unchanged.
--
-- Approval rows exist ONLY when approved; absence means pending. Clearing a
-- gate is a delete.
--
-- (previous header follows)
-- Slice 4: gate Active → any phase on delegation being complete.
--
-- Delegation is complete when every delegated phase (all but Review) has both
-- an assignee and a duration. Planned hours are deliberately NOT part of the
-- check — see docs/handoff/SLICE_4_SCOPE.md "Optionality".
--
-- Enforcing here rather than in the UI means board drag and ⌘K both inherit
-- it; each already surfaces a raised exception as a toast.
--
-- Rebuilt wholesale from 20260812140100_pending_contract_gate.sql, matching
-- the house pattern of replacing the function in full.

create or replace function public.move_project(
  p_project_id uuid,
  p_to_column text,
  p_actor_id uuid
)
returns public.projects
language plpgsql
security invoker
as $$
declare
  proj public.projects%rowtype;
  from_column text;
  from_status project_status;
  from_phase design_phase;
  to_phase design_phase;
  is_phase boolean;
  phase_order text[] := array[
    'schematic_design',
    'design_development',
    'review',
    'construction_documents',
    'final_review',
    'permitting'
  ];
  from_order int;
  to_order int;
  ph record;
  direction transition_direction := 'forward';
begin
  select * into proj from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  if proj.archived_at is not null then
    raise exception 'Cannot move an archived project';
  end if;

  from_status := proj.status;
  from_phase := proj.current_phase;
  if from_status = 'active' and from_phase is null then
    from_column := 'active';
  elsif from_status = 'active' and from_phase is not null then
    from_column := from_phase::text;
  else
    from_column := from_status::text;
  end if;

  -- Pending / backlog: only Active is allowed, and only with a contract.
  if from_column in ('pending', 'backlog') and p_to_column is distinct from from_column then
    if p_to_column <> 'active' then
      raise exception 'Upload an LOI or contract to leave Pending';
    end if;
    if proj.contract_path is null then
      raise exception 'Upload an LOI or contract to leave Pending';
    end if;
  end if;

  is_phase := p_to_column = any (phase_order);

  -- Active → work: the project must be delegated first. Review is excluded
  -- (a gate, no delegate, no duration); planned hours are excluded on purpose.
  if from_column = 'active' and is_phase then
    if exists (
      select 1
      from public.project_phases pp
      where pp.project_id = p_project_id
        and pp.phase <> 'review'
        and (pp.assignee_id is null or pp.duration_days is null)
    ) then
      raise exception 'Plan the schedule first — every phase needs a person and a duration';
    end if;
  end if;

  if p_to_column = 'active' then
    for ph in
      select * from public.project_phases where project_id = p_project_id
    loop
      if ph.status = 'in_progress' then
        update public.project_phases
        set status = 'not_started',
            entered_at = null,
            completed_at = null
        where id = ph.id;
      end if;
    end loop;

    update public.projects
    set status = 'active',
        current_phase = null,
        updated_at = now()
    where id = p_project_id
    returning * into proj;

  elsif is_phase then
    to_phase := p_to_column::design_phase;
    to_order := array_position(phase_order, p_to_column);
    from_order := case
      when from_phase is null then -1
      else array_position(phase_order, from_phase::text)
    end;

    if from_order >= 0 and to_order < from_order then
      direction := 'backward';
    end if;

    -- Approval gates: a forward move that crosses a gate needs its sign-offs.
    -- Positions are 1-based (array_position), so Review is 3 and Final review
    -- is 5. `greatest(from_order, 0)` folds the Active holding state (-1) in,
    -- so Active -> CD is caught the same way DD -> CD is.
    if to_order > from_order then
      if greatest(from_order, 0) <= 3 and 3 < to_order then
        if exists (
          select 1
          from unnest(array['client_contact', 'austin', 'client']) as req(party)
          where not exists (
            select 1 from public.project_approvals a
            where a.project_id = p_project_id
              and a.phase = 'review'
              and a.party = req.party::public.approval_party
              and a.status = 'approved'
          )
        ) then
          raise exception 'Review needs all three sign-offs before this project can advance';
        end if;
      end if;

      if greatest(from_order, 0) <= 5 and 5 < to_order then
        if exists (
          select 1
          from unnest(array['client_contact', 'austin']) as req(party)
          where not exists (
            select 1 from public.project_approvals a
            where a.project_id = p_project_id
              and a.phase = 'final_review'
              and a.party = req.party::public.approval_party
              and a.status = 'approved'
          )
        ) then
          raise exception 'Final review needs both sign-offs before this project can advance';
        end if;
      end if;
    end if;

    -- Release the outgoing phase BEFORE claiming the new one. This used to be
    -- a single unordered `for ph in select * from project_phases` loop, which
    -- meant that whenever the seq scan happened to hand back the target row
    -- first, two rows were 'in_progress' at once and the partial unique index
    -- one_active_phase_per_project raised. Physical row order shifts as tuples
    -- are rewritten by updates, so it surfaced only partway through a
    -- project's life. Set-based and explicitly ordered, it cannot recur.
    -- (reject_gate below has always done it in this order.)
    update public.project_phases
    set status = 'completed',
        completed_at = now()
    where project_id = p_project_id
      and status = 'in_progress'
      and phase <> to_phase;

    -- A forward move marks everything jumped over as skipped.
    if direction = 'forward' and from_order >= 0 then
      update public.project_phases
      set status = 'skipped'
      where project_id = p_project_id
        and status = 'not_started'
        and array_position(phase_order, phase::text) > from_order
        and array_position(phase_order, phase::text) < to_order;
    end if;

    update public.project_phases
    set status = 'in_progress',
        entered_at = now(),
        completed_at = null
    where project_id = p_project_id
      and phase = to_phase;

    update public.projects
    set status = 'active',
        current_phase = to_phase,
        updated_at = now()
    where id = p_project_id
    returning * into proj;

  elsif p_to_column in ('pending', 'backlog') then
    for ph in
      select * from public.project_phases where project_id = p_project_id
    loop
      if ph.status = 'in_progress' then
        update public.project_phases
        set status = 'not_started',
            entered_at = null,
            completed_at = null
        where id = ph.id;
      end if;
    end loop;

    update public.projects
    set status = 'pending',
        current_phase = null,
        updated_at = now()
    where id = p_project_id
    returning * into proj;

  elsif p_to_column = 'completed' then
    for ph in
      select * from public.project_phases where project_id = p_project_id
    loop
      if ph.status <> 'skipped' then
        update public.project_phases
        set status = 'completed',
            completed_at = coalesce(ph.completed_at, now())
        where id = ph.id;
      end if;
    end loop;

    update public.projects
    set status = 'completed',
        current_phase = null,
        archived_at = coalesce(proj.archived_at, now()),
        updated_at = now()
    where id = p_project_id
    returning * into proj;

  else
    raise exception 'Invalid column: %', p_to_column;
  end if;

  insert into public.activity_log (project_id, actor_id, event_type, payload)
  values (
    p_project_id,
    p_actor_id,
    'phase.changed',
    jsonb_build_object(
      'from', from_column,
      'to', p_to_column,
      'from_status', from_status::text,
      'to_status', proj.status::text
    )
  );

  insert into public.phase_transitions (
    project_id, from_column, to_column, direction, actor_id
  ) values (
    p_project_id, from_column, p_to_column, direction, p_actor_id
  );

  return proj;
end;
$$;

revoke all on function public.move_project(uuid, text, uuid) from public;
grant execute on function public.move_project(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reject_gate — the rework loop
--
-- Deliberately NOT move_project: that function marks the phase being left as
-- 'completed', which is exactly wrong for a rejection. A rejected gate returns
-- to 'not_started' because it will be entered again on the next pass.
--
-- Clearing the gate's sign-offs is part of the same transaction, so the gate
-- cannot be left half-approved from the previous pass.
--
-- Dates are NOT shifted here — the caller recomputes them, because the
-- schedule derivation lives in TypeScript (lib/dates.ts). A failure there
-- leaves the project correctly rejected with stale dates, which Re-plan
-- schedule fixes. The state transition stays atomic.
-- ---------------------------------------------------------------------------
create or replace function public.reject_gate(
  p_project_id uuid,
  p_phase text,
  p_actor_id uuid
)
returns public.projects
language plpgsql
security invoker
as $$
declare
  proj public.projects%rowtype;
  gate design_phase;
  target design_phase;
begin
  if p_phase not in ('review', 'final_review') then
    raise exception 'Only Review and Final review can be rejected';
  end if;

  gate := p_phase::design_phase;
  target := case p_phase
    when 'review' then 'design_development'::design_phase
    else 'construction_documents'::design_phase
  end;

  select * into proj from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;
  if proj.archived_at is not null then
    raise exception 'Cannot move an archived project';
  end if;
  if proj.current_phase is distinct from gate then
    raise exception 'This project is not at that gate';
  end if;

  -- Clear this gate's sign-offs so it can be re-approved on the next pass.
  delete from public.project_approvals
  where project_id = p_project_id and phase = gate;

  -- Release every in-progress row first, or one_active_phase_per_project
  -- trips when the target is set below.
  update public.project_phases
  set status = 'not_started', entered_at = null, completed_at = null
  where project_id = p_project_id
    and (phase = gate or status = 'in_progress');

  update public.project_phases
  set status = 'in_progress', entered_at = now(), completed_at = null
  where project_id = p_project_id and phase = target;

  update public.projects
  set status = 'active',
      current_phase = target,
      updated_at = now()
  where id = p_project_id
  returning * into proj;

  insert into public.activity_log (project_id, actor_id, event_type, payload)
  values (
    p_project_id,
    p_actor_id,
    'gate.rejected',
    jsonb_build_object('gate', p_phase, 'to', target::text)
  );

  insert into public.phase_transitions (
    project_id, from_column, to_column, direction, actor_id
  ) values (
    p_project_id, p_phase, target::text, 'backward', p_actor_id
  );

  return proj;
end;
$$;

revoke all on function public.reject_gate(uuid, text, uuid) from public;
grant execute on function public.reject_gate(uuid, text, uuid) to authenticated;
