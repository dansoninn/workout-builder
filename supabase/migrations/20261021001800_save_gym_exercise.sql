-- Step 4b: saving a gym's own exercise with its patterns, muscles and
-- equipment in one transaction. Pattern weights are checked at commit
-- (they must add up to 1.00), so they cannot be saved one row at a time.

/**
 * Creates or updates a gym exercise (owners and head coaches; RLS applies).
 * p_exercise: { id, name, slug, kind, modality, plane, unilateral,
 *   default_unit, implement_count, pace_default,
 *   patterns: { "<pattern>": weight }, primary_muscles: [..],
 *   secondary_muscles: [..], equipment: [..] }
 * Returns the exercise id.
 */
create function public.save_gym_exercise(p_org uuid, p_exercise jsonb)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce((p_exercise ->> 'id')::uuid, gen_random_uuid());
begin
  if not exists (select 1 from private.orgs_where_can_edit_bank() o where o = p_org) then
    raise exception 'Only owners and head coaches can edit the gym''s exercises' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.exercises e where e.id = v_id and e.org_id = p_org) then
    update public.exercises e set
      name = btrim(p_exercise ->> 'name'),
      slug = p_exercise ->> 'slug',
      kind = (p_exercise ->> 'kind')::public.exercise_kind,
      modality = p_exercise ->> 'modality',
      plane = p_exercise ->> 'plane',
      unilateral = coalesce((p_exercise ->> 'unilateral')::boolean, false),
      default_unit = (p_exercise ->> 'default_unit')::public.measure_unit,
      implement_count = coalesce((p_exercise ->> 'implement_count')::smallint, 1),
      pace_default = nullif(p_exercise -> 'pace_default', 'null'::jsonb)
    where e.id = v_id;
  else
    insert into public.exercises (id, org_id, name, slug, kind, modality, plane, unilateral, default_unit, implement_count, pace_default)
    values (
      v_id, p_org, btrim(p_exercise ->> 'name'), p_exercise ->> 'slug',
      (p_exercise ->> 'kind')::public.exercise_kind, p_exercise ->> 'modality', p_exercise ->> 'plane',
      coalesce((p_exercise ->> 'unilateral')::boolean, false),
      (p_exercise ->> 'default_unit')::public.measure_unit,
      coalesce((p_exercise ->> 'implement_count')::smallint, 1),
      nullif(p_exercise -> 'pace_default', 'null'::jsonb));
  end if;

  delete from public.exercise_patterns p where p.exercise_id = v_id;
  insert into public.exercise_patterns (exercise_id, pattern_key, weight)
  select v_id, key, value::numeric from jsonb_each_text(coalesce(p_exercise -> 'patterns', '{}'::jsonb));

  delete from public.exercise_muscles m where m.exercise_id = v_id;
  insert into public.exercise_muscles (exercise_id, muscle_key, role)
  select v_id, value, 'primary'::public.muscle_role from jsonb_array_elements_text(coalesce(p_exercise -> 'primary_muscles', '[]'::jsonb))
  union
  select v_id, value, 'secondary'::public.muscle_role from jsonb_array_elements_text(coalesce(p_exercise -> 'secondary_muscles', '[]'::jsonb));

  delete from public.exercise_equipment q where q.exercise_id = v_id;
  insert into public.exercise_equipment (exercise_id, equipment_key)
  select v_id, value from jsonb_array_elements_text(coalesce(p_exercise -> 'equipment', '[]'::jsonb));

  return v_id;
end;
$$;

revoke execute on function public.save_gym_exercise(uuid, jsonb) from public, anon;
grant execute on function public.save_gym_exercise(uuid, jsonb) to authenticated, service_role;
