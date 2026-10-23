-- Partner blocks (calc spec §4.5, Daniel's decision of 2026-10-23): how
-- partners share the work, not just whether it is a partner block.
--   split      "split the reps at will"
--   alternate  "I go, you go"
--   each       "I go, you go", amounts written for each athlete
-- Blocks marked as partner before become `split`. The old yes/no column stays,
-- worked out from the mode, so an app still running the previous version keeps
-- reading it during a deploy.

create type public.partner_mode as enum ('split', 'alternate', 'each');

alter table public.blocks add column partner_mode public.partner_mode;
update public.blocks set partner_mode = 'split' where partner;
alter table public.blocks drop column partner;
alter table public.blocks add column partner boolean generated always as (partner_mode is not null) stored;

comment on column public.blocks.partner_mode is
  'A partner block and how the partners share the work (calc spec 4.5); NULL = not a partner block.';
comment on column public.blocks.partner is 'Kept for apps of the previous version: partner_mode is not null.';

/** A block's partner mode as the app sends it: partner_mode, or the older yes/no (yes = split). */
create function private.partner_mode_of(p_block jsonb)
returns public.partner_mode
language sql immutable
set search_path = ''
as $$
  select coalesce(
    (p_block ->> 'partner_mode')::public.partner_mode,
    case when (p_block ->> 'partner')::boolean then 'split'::public.partner_mode end)
$$;

grant execute on function private.partner_mode_of(jsonb) to authenticated, service_role;

/**
 * Saves a workout with its blocks and lines, in order, in one transaction.
 * Runs as the signed-in user, so RLS applies. Every block and line carries an
 * id chosen by the app; rows that did not change are not touched (the audit
 * log shows real edits only); removed blocks and lines are deleted; a line
 * moved to another block is deleted and added again. Returns the workout id.
 *
 * p_workout: { id, track_id, kind, date, title, focus,
 *   blocks: [{ id, label, title, intent, format, params, pace_effort,
 *     load_effort, partner_mode, target_rounds, notes, rest_after_s,
 *     items: [{ id, station_label, slot, exercise_id, raw_line, quantity,
 *       load, pace_effort, load_effort, implement_count, notes }] }] }
 */
create or replace function public.save_workout(p_org uuid, p_workout jsonb)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_workout ->> 'id')::uuid;
  v_block jsonb;
  v_item jsonb;
  v_block_id uuid;
  v_block_position int := 0;
  v_item_position int;
  v_block_ids uuid[] := '{}';
  v_item_keys text[] := '{}';
begin
  if not exists (select 1 from private.orgs_where_can_program() o where o = p_org) then
    raise exception 'You cannot program workouts in this gym' using errcode = 'insufficient_privilege';
  end if;
  if v_id is null then
    raise exception 'The workout needs an id' using errcode = 'invalid_parameter_value';
  end if;

  -- The workout itself.
  if exists (select 1 from public.workouts w where w.id = v_id and w.org_id = p_org and w.deleted_at is null) then
    update public.workouts w set
      track_id = (p_workout ->> 'track_id')::uuid,
      kind = (p_workout ->> 'kind')::public.workout_kind,
      date = (p_workout ->> 'date')::date,
      title = nullif(btrim(p_workout ->> 'title'), ''),
      focus = nullif(btrim(p_workout ->> 'focus'), '')
    where w.id = v_id
      and (w.track_id, w.kind, w.date, w.title, w.focus) is distinct from (
        (p_workout ->> 'track_id')::uuid,
        (p_workout ->> 'kind')::public.workout_kind,
        (p_workout ->> 'date')::date,
        nullif(btrim(p_workout ->> 'title'), ''),
        nullif(btrim(p_workout ->> 'focus'), ''));
  else
    insert into public.workouts (id, org_id, track_id, kind, date, title, focus)
    values (
      v_id, p_org,
      (p_workout ->> 'track_id')::uuid,
      (p_workout ->> 'kind')::public.workout_kind,
      (p_workout ->> 'date')::date,
      nullif(btrim(p_workout ->> 'title'), ''),
      nullif(btrim(p_workout ->> 'focus'), ''));
  end if;

  -- Which blocks and lines stay.
  for v_block in select value from jsonb_array_elements(coalesce(p_workout -> 'blocks', '[]'::jsonb)) loop
    if (v_block ->> 'id') is null then
      raise exception 'Every block needs an id' using errcode = 'invalid_parameter_value';
    end if;
    v_block_ids := v_block_ids || (v_block ->> 'id')::uuid;
    for v_item in select value from jsonb_array_elements(coalesce(v_block -> 'items', '[]'::jsonb)) loop
      if (v_item ->> 'id') is null then
        raise exception 'Every line needs an id' using errcode = 'invalid_parameter_value';
      end if;
      v_item_keys := v_item_keys || ((v_item ->> 'id') || ':' || (v_block ->> 'id'));
    end loop;
  end loop;

  delete from public.blocks b where b.workout_id = v_id and b.id <> all (v_block_ids);
  delete from public.block_items i
  using public.blocks b
  where b.id = i.block_id and b.workout_id = v_id
    and (i.id::text || ':' || i.block_id::text) <> all (v_item_keys);

  -- Blocks and lines, in order.
  for v_block in select value from jsonb_array_elements(coalesce(p_workout -> 'blocks', '[]'::jsonb)) loop
    v_block_id := (v_block ->> 'id')::uuid;

    if exists (select 1 from public.blocks b where b.id = v_block_id and b.workout_id = v_id) then
      update public.blocks b set
        position = v_block_position,
        label = v_block ->> 'label',
        title = nullif(btrim(v_block ->> 'title'), ''),
        intent = (v_block ->> 'intent')::public.block_intent,
        format = (v_block ->> 'format')::public.block_format,
        params = v_block -> 'params',
        pace_effort = v_block ->> 'pace_effort',
        load_effort = v_block ->> 'load_effort',
        partner_mode = private.partner_mode_of(v_block),
        target_rounds = (v_block ->> 'target_rounds')::numeric,
        notes = coalesce(v_block ->> 'notes', ''),
        rest_after_s = (v_block ->> 'rest_after_s')::int
      where b.id = v_block_id
        and (b.position, b.label, b.title, b.intent, b.format, b.params, b.pace_effort, b.load_effort,
             b.partner_mode, b.target_rounds, b.notes, b.rest_after_s) is distinct from (
             v_block_position, v_block ->> 'label', nullif(btrim(v_block ->> 'title'), ''),
             (v_block ->> 'intent')::public.block_intent, (v_block ->> 'format')::public.block_format,
             v_block -> 'params', v_block ->> 'pace_effort', v_block ->> 'load_effort',
             private.partner_mode_of(v_block), (v_block ->> 'target_rounds')::numeric,
             coalesce(v_block ->> 'notes', ''), (v_block ->> 'rest_after_s')::int);
    else
      insert into public.blocks (id, workout_id, org_id, position, label, title, intent, format, params,
                                 pace_effort, load_effort, partner_mode, target_rounds, notes, rest_after_s)
      values (v_block_id, v_id, p_org, v_block_position, v_block ->> 'label', nullif(btrim(v_block ->> 'title'), ''),
              (v_block ->> 'intent')::public.block_intent, (v_block ->> 'format')::public.block_format,
              v_block -> 'params', v_block ->> 'pace_effort', v_block ->> 'load_effort',
              private.partner_mode_of(v_block), (v_block ->> 'target_rounds')::numeric,
              coalesce(v_block ->> 'notes', ''), (v_block ->> 'rest_after_s')::int);
    end if;

    v_item_position := 0;
    for v_item in select value from jsonb_array_elements(coalesce(v_block -> 'items', '[]'::jsonb)) loop
      if exists (select 1 from public.block_items i where i.id = (v_item ->> 'id')::uuid and i.block_id = v_block_id) then
        update public.block_items i set
          position = v_item_position,
          station_label = nullif(btrim(v_item ->> 'station_label'), ''),
          slot = (v_item ->> 'slot')::smallint,
          exercise_id = (v_item ->> 'exercise_id')::uuid,
          raw_line = v_item ->> 'raw_line',
          quantity = v_item -> 'quantity',
          load = nullif(v_item -> 'load', 'null'::jsonb),
          pace_effort = v_item ->> 'pace_effort',
          load_effort = v_item ->> 'load_effort',
          implement_count = (v_item ->> 'implement_count')::smallint,
          notes = coalesce(v_item ->> 'notes', '')
        where i.id = (v_item ->> 'id')::uuid
          and (i.position, i.station_label, i.slot, i.exercise_id, i.raw_line, i.quantity, i.load,
               i.pace_effort, i.load_effort, i.implement_count, i.notes) is distinct from (
               v_item_position, nullif(btrim(v_item ->> 'station_label'), ''), (v_item ->> 'slot')::smallint,
               (v_item ->> 'exercise_id')::uuid, v_item ->> 'raw_line', v_item -> 'quantity',
               nullif(v_item -> 'load', 'null'::jsonb), v_item ->> 'pace_effort', v_item ->> 'load_effort',
               (v_item ->> 'implement_count')::smallint, coalesce(v_item ->> 'notes', ''));
      else
        insert into public.block_items (id, block_id, org_id, position, station_label, slot, exercise_id, raw_line,
                                        quantity, load, pace_effort, load_effort, implement_count, notes)
        values ((v_item ->> 'id')::uuid, v_block_id, p_org, v_item_position,
                nullif(btrim(v_item ->> 'station_label'), ''), (v_item ->> 'slot')::smallint,
                (v_item ->> 'exercise_id')::uuid, v_item ->> 'raw_line', v_item -> 'quantity',
                nullif(v_item -> 'load', 'null'::jsonb), v_item ->> 'pace_effort', v_item ->> 'load_effort',
                (v_item ->> 'implement_count')::smallint, coalesce(v_item ->> 'notes', ''));
      end if;
      v_item_position := v_item_position + 1;
    end loop;

    v_block_position := v_block_position + 1;
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.save_workout(uuid, jsonb) from public, anon;
grant execute on function public.save_workout(uuid, jsonb) to authenticated, service_role;

/**
 * p_targets: [{ id, date, track_id }] — the new workouts' ids come from the
 * app, so it can store each copy's metrics right after. Returns how many
 * workouts were made.
 */
create or replace function public.copy_workout(p_org uuid, p_source uuid, p_targets jsonb)
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
                                 load_effort, partner_mode, target_rounds, notes, rest_after_s)
      values (v_workout_id, p_org, v_block.position, v_block.label, v_block.title, v_block.intent, v_block.format,
              v_block.params, v_block.pace_effort, v_block.load_effort, v_block.partner_mode, v_block.target_rounds,
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

-- ---------------------------------------------------------------------------
-- Calculation version 2 (partner blocks): the workouts whose stored numbers
-- are not from the version the app runs, so it can work them out again.
-- ---------------------------------------------------------------------------

/** The gym's workouts (not deleted) without stored metrics for this calculation version. */
create function public.stale_workouts(p_org uuid, p_calc_version int)
returns setof uuid
language sql stable security invoker
set search_path = ''
as $$
  select w.id from public.workouts w
   where w.org_id = p_org and w.deleted_at is null
     and not exists (select 1 from public.workout_metrics m where m.workout_id = w.id and m.calc_version = p_calc_version)
   order by w.date nulls last, w.id
$$;

revoke all on function public.stale_workouts(uuid, int) from public, anon;
grant execute on function public.stale_workouts(uuid, int) to authenticated;
