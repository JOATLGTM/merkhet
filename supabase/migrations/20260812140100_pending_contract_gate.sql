-- Slice 2: enforce Pending exit only to Active with a contract on file.

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

    for ph in
      select * from public.project_phases where project_id = p_project_id
    loop
      if ph.phase = to_phase then
        update public.project_phases
        set status = 'in_progress',
            entered_at = now(),
            completed_at = null
        where id = ph.id;
      elsif ph.status = 'in_progress' then
        update public.project_phases
        set status = 'completed',
            completed_at = now()
        where id = ph.id;
      elsif direction = 'forward'
        and from_order >= 0
        and array_position(phase_order, ph.phase::text) > from_order
        and array_position(phase_order, ph.phase::text) < to_order
        and ph.status = 'not_started'
      then
        update public.project_phases
        set status = 'skipped'
        where id = ph.id;
      end if;
    end loop;

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
