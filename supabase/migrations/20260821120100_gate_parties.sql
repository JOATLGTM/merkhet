-- Gate sign-off parties: Austin, Ryan, and a chosen third — at BOTH gates.
--
-- User decision (2026-08-21). **This supersedes `WORKFLOW-2.md` §3**, which
-- specified Review as client contact + Austin + client, and Final review as
-- client contact + Austin with the client deliberately excluded. Both gates
-- now take the same three:
--
--   austin  — fixed
--   ryan    — fixed
--   chosen  — whoever Austin or Ryan picks for this project
--
-- The client is not gone: they are one of the things "chosen" can resolve to,
-- so a client sign-off is now discretionary rather than mandatory at Review
-- and newly possible at Final review. The distinction WORKFLOW-2 drew between
-- the two gates disappears on purpose — the firm wanted one rule.
--
-- **`approver_user_id` identifies the chosen third.** On a 'chosen' row a
-- non-null value is the staff member who signed off; NULL means the client,
-- recorded by staff on their behalf exactly as before. That null is not
-- "unset": rows here exist only when approved (Slice 5's core invariant), so
-- a 'chosen' row always represents a decision that has been made.
--
-- One row shape for the slot, so the gate check stays a plain "does a 'chosen'
-- row exist", clearing stays one delete, and `unique (project_id, phase,
-- party)` still guarantees the slot cannot be double-filled.
--
-- `client_contact` and `client` stay in the enum: historical rows reference
-- them and dropping an enum value would rewrite them. Neither is required by
-- any gate any more.
--
-- Requires 20260821120000_gate_parties_enum.sql to have been run first.
--
-- `reject_gate` is unchanged — it deletes a gate's approvals by phase and has
-- never cared which parties they were.

-- ---------------------------------------------------------------------------
-- Who the chosen third actually is
-- ---------------------------------------------------------------------------
alter table public.project_approvals
  add column if not exists approver_user_id uuid
    references public.users (id) on delete set null;

comment on column public.project_approvals.approver_user_id is
  'Chosen third approver. Set only on party = ''chosen''; null there means the client.';

alter table public.project_approvals
  drop constraint if exists approver_only_on_chosen;

-- Only the chosen slot names a person. Austin and Ryan are the party.
alter table public.project_approvals
  add constraint approver_only_on_chosen check (
    party = 'chosen' or approver_user_id is null
  );

-- ---------------------------------------------------------------------------
-- move_project — rebuilt in full, matching the house pattern. Only the two
-- gate-requirement blocks differ from 20260814160000_approval_gates.sql.
-- ---------------------------------------------------------------------------
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
    -- Both gates now take the same three: Austin, Ryan, and whoever they chose
    -- (party 'chosen'). Identical rules, so the two blocks differ only in the
    -- phase and the position.
    -- Positions are 1-based (array_position), so Review is 3 and Final review
    -- is 5. `greatest(from_order, 0)` folds the Active holding state (-1) in,
    -- so Active -> CD is caught the same way DD -> CD is.
    if to_order > from_order then
      if greatest(from_order, 0) <= 3 and 3 < to_order then
        if exists (
          select 1
          from unnest(array['austin', 'ryan', 'chosen']) as req(party)
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
          from unnest(array['austin', 'ryan', 'chosen']) as req(party)
          where not exists (
            select 1 from public.project_approvals a
            where a.project_id = p_project_id
              and a.phase = 'final_review'
              and a.party = req.party::public.approval_party
              and a.status = 'approved'
          )
        ) then
          raise exception 'Final review needs all three sign-offs before this project can advance';
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
