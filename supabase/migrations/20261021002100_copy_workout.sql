-- A workout on several dates (PLAN-step-5 5b): copies a template (or any of
-- the gym's workouts) to each date asked for, in one transaction. Each copy
-- is its own scheduled draft with new ids and its own history; the source is
-- left as it is. Runs as the signed-in user, so RLS applies: only the gym's
-- owners, head coaches and coaches copy, and only their own gym's workouts.

/**
 * p_targets: [{ id, date, track_id }] — the new workouts' ids come from the
 * app, so it can store each copy's metrics right after. Returns how many
 * workouts were made.
 */
create function public.copy_workout(p_org uuid, p_source uuid, p_targets jsonb)
returns integer
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_source public.workouts;
  v_target jsonb;
  v_workout_id uuid;
  v_block record;
  v_block_id uuid;
  v_count integer := 0;
begin
  if not exists (select 1 from private.orgs_where_can_program() o where o = p_org) then
    raise exception 'You cannot program workouts in this gym' using errcode = 'insufficient_privilege';
  end if;
  select * into v_source from public.workouts w where w.id = p_source and w.org_id = p_org and w.deleted_at is null;
  if not found then
    raise exception 'The workout to copy does not exist' using errcode = 'no_data_found';
  end if;
  if jsonb_typeof(p_targets) is distinct from 'array' or jsonb_array_length(p_targets) not between 1 and 60 then
    raise exception 'Copy to between 1 and 60 dates' using errcode = 'invalid_parameter_value';
  end if;

  for v_target in select value from jsonb_array_elements(p_targets) loop
    v_workout_id := (v_target ->> 'id')::uuid;
    insert into public.workouts (id, org_id, track_id, kind, date, title, focus, status)
    values (
      v_workout_id, p_org, (v_target ->> 'track_id')::uuid, 'scheduled', (v_target ->> 'date')::date,
      nullif(regexp_replace(coalesce(v_source.title, ''), ' \(template\)$', ''), ''), v_source.focus, 'draft');

    for v_block in select * from public.blocks b where b.workout_id = v_source.id order by b.position loop
      insert into public.blocks (workout_id, org_id, position, label, title, intent, format, params, pace_effort,
                                 load_effort, partner, target_rounds, notes, rest_after_s)
      values (v_workout_id, p_org, v_block.position, v_block.label, v_block.title, v_block.intent, v_block.format,
              v_block.params, v_block.pace_effort, v_block.load_effort, v_block.partner, v_block.target_rounds,
              v_block.notes, v_block.rest_after_s)
      returning id into v_block_id;

      insert into public.block_items (block_id, org_id, position, station_label, exercise_id, raw_line, quantity, load,
                                      pace_effort, load_effort, implement_count, notes, slot)
      select v_block_id, p_org, i.position, i.station_label, i.exercise_id, i.raw_line, i.quantity, i.load,
             i.pace_effort, i.load_effort, i.implement_count, i.notes, i.slot
        from public.block_items i
       where i.block_id = v_block.id
       order by i.position;
    end loop;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.copy_workout(uuid, uuid, jsonb) from public, anon;
grant execute on function public.copy_workout(uuid, uuid, jsonb) to authenticated;
