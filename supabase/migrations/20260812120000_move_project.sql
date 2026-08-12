-- Slice 1A: transactional project column move.
-- Applied after 20260807100000_init.sql. Does not change workflow schema.

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
  from_status project_status;
  from_phase design_phase;
  to_phase design_phase;
  is_phase boolean;
  phase_order text[] := array[
    'schematic_design',
    'design_development',
    'construction_documents',
    'review',
    'permitting'
  ];
  from_order int;
  to_order int;
  ph record;
begin
  select * into proj from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'Project not found';
  end if;

  from_status := proj.status;
  from_phase := proj.current_phase;
  is_phase := p_to_column = any (phase_order);

  if is_phase then
    to_phase := p_to_column::design_phase;
    to_order := array_position(phase_order, p_to_column);
    from_order := case
      when from_phase is null then -1
      else array_position(phase_order, from_phase::text)
    end;

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
      elsif from_order >= 0
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
  else
    if p_to_column not in ('backlog', 'pending', 'completed') then
      raise exception 'Invalid column: %', p_to_column;
    end if;

    for ph in
      select * from public.project_phases where project_id = p_project_id
    loop
      if p_to_column = 'completed' then
        if ph.status <> 'skipped' then
          update public.project_phases
          set status = 'completed',
              completed_at = coalesce(ph.completed_at, now())
          where id = ph.id;
        end if;
      elsif ph.status = 'in_progress' then
        update public.project_phases
        set status = 'not_started',
            entered_at = null,
            completed_at = null
        where id = ph.id;
      end if;
    end loop;

    update public.projects
    set status = p_to_column::project_status,
        current_phase = null,
        updated_at = now()
    where id = p_project_id
    returning * into proj;
  end if;

  insert into public.activity_log (project_id, actor_id, event_type, payload)
  values (
    p_project_id,
    p_actor_id,
    'phase.changed',
    jsonb_build_object(
      'from', coalesce(from_phase::text, from_status::text),
      'to', p_to_column,
      'from_status', from_status::text,
      'to_status', proj.status::text
    )
  );

  return proj;
end;
$$;

revoke all on function public.move_project(uuid, text, uuid) from public;
grant execute on function public.move_project(uuid, text, uuid) to authenticated;
