-- What a coach writes that the app now keeps (BACKLOG "Learnings from Afrek's
-- 2024 programming", 2026-10-23; calc spec version 3):
--   lines: alternatives ("Burpees/Sprawls"), one side only ("Right arm"), a cap ("max 40 sec");
--   amounts: ranges each side (8-10/8-10), of distance (800-1000 m) and of time (20-30 s);
--   blocks: not counted in planned load (stretching), sets within a time box
--           ("in 12-15 min find a heavy 3"), intervals station by station.

-- ---------------------------------------------------------------------------
-- 1. Amounts: three kinds of range.
-- ---------------------------------------------------------------------------

create or replace function private.item_quantity_valid(q jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(q) is distinct from 'object' then
    return false;
  end if;

  -- Men/women amounts: two to four, each as the type asks, the first one counting.
  if q ? 'rx' then
    if (q ->> 'type') not in ('distance_m', 'calories')
       or jsonb_typeof(q -> 'rx') <> 'array'
       or jsonb_array_length(q -> 'rx') not between 2 and 4 then
      return false;
    end if;
    if exists (
      select 1 from jsonb_array_elements(q -> 'rx') as e(v)
      where not (case when q ->> 'type' = 'calories' then private.jsonb_is_whole(e.v, 1) else private.jsonb_is_positive(e.v) end)
    ) then
      return false;
    end if;
  end if;

  case q ->> 'type'
    when 'reps', 'reps_per_side' then
      return private.jsonb_has_keys(q, '{type,value}')
        and private.jsonb_is_whole(q -> 'value', 1);
    when 'reps_range', 'reps_per_side_range', 'time_s_range' then
      if not (private.jsonb_has_keys(q, '{type,min,max}')
              and private.jsonb_is_whole(q -> 'min', 1)
              and private.jsonb_is_whole(q -> 'max', 1)) then
        return false;
      end if;
      return (q ->> 'min')::numeric < (q ->> 'max')::numeric;
    when 'distance_m_range' then
      if not (private.jsonb_has_keys(q, '{type,min,max}')
              and private.jsonb_is_positive(q -> 'min')
              and private.jsonb_is_positive(q -> 'max')) then
        return false;
      end if;
      return (q ->> 'min')::numeric < (q ->> 'max')::numeric;
    when 'reps_scheme' then
      if not (private.jsonb_has_keys(q, '{type,scheme}')
              and jsonb_typeof(q -> 'scheme') = 'array'
              and jsonb_array_length(q -> 'scheme') >= 1) then
        return false;
      end if;
      return not exists (
        select 1 from jsonb_array_elements(q -> 'scheme') as e(v)
        where not private.jsonb_is_whole(e.v, 1)
      );
    when 'distance_m' then
      return private.jsonb_has_keys(q, '{type,value}', '{rx}')
        and private.jsonb_is_positive(q -> 'value')
        and (not q ? 'rx' or (q -> 'rx' -> 0)::numeric = (q ->> 'value')::numeric);
    when 'calories' then
      -- A single value ("15 cal") is stored as min = max; men/women amounts too, as the first.
      if not (private.jsonb_has_keys(q, '{type,min,max}', '{rx}')
              and private.jsonb_is_whole(q -> 'min', 1)
              and private.jsonb_is_whole(q -> 'max', 1)) then
        return false;
      end if;
      if q ? 'rx' then
        return (q ->> 'min')::numeric = (q ->> 'max')::numeric and (q -> 'rx' -> 0)::numeric = (q ->> 'min')::numeric;
      end if;
      return (q ->> 'min')::numeric <= (q ->> 'max')::numeric;
    when 'time_s' then
      return private.jsonb_has_keys(q, '{type,value}')
        and private.jsonb_is_whole(q -> 'value', 1);
    when 'max_effort' then
      -- Same values as public.measure_unit (listed here to stay IMMUTABLE).
      return private.jsonb_has_keys(q, '{type,unit}')
        and (q ->> 'unit') in ('reps', 'distance_m', 'calories', 'time_s');
    else
      return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Block params: sets within a time box; intervals station by station.
-- ---------------------------------------------------------------------------

create or replace function private.block_params_valid(p_format public.block_format, p jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  case p_format
    when 'sets' then
      return private.jsonb_has_keys(p, '{}', '{sets,rest_s,time_s}')
        and (p ? 'sets' or p ? 'time_s')
        and (not p ? 'sets' or private.jsonb_is_whole(p -> 'sets', 1))
        and (not p ? 'rest_s' or private.jsonb_is_whole(p -> 'rest_s', 0))
        and (not p ? 'time_s' or private.jsonb_is_whole(p -> 'time_s', 1));
    when 'every' then
      return private.jsonb_has_keys(p, '{interval_s,rounds}', '{alternating}')
        and private.jsonb_is_whole(p -> 'interval_s', 1)
        and private.jsonb_is_whole(p -> 'rounds', 1)
        and (not p ? 'alternating' or jsonb_typeof(p -> 'alternating') = 'boolean');
    when 'amrap' then
      return private.jsonb_has_keys(p, '{time_s}')
        and private.jsonb_is_whole(p -> 'time_s', 1);
    when 'for_time' then
      return private.jsonb_has_keys(p, '{rounds}', '{time_cap_s}')
        and private.jsonb_is_whole(p -> 'rounds', 1)
        and (not p ? 'time_cap_s' or private.jsonb_is_whole(p -> 'time_cap_s', 1));
    when 'intervals' then
      return private.jsonb_has_keys(p, '{rounds,work_s,rest_s,stations}', '{rest_between_rounds_s,by_station,rest_between_stations_s}')
        and private.jsonb_is_whole(p -> 'rounds', 1)
        and private.jsonb_is_whole(p -> 'work_s', 1)
        and private.jsonb_is_whole(p -> 'rest_s', 0)
        and private.jsonb_is_whole(p -> 'stations', 1)
        and (not p ? 'rest_between_rounds_s' or private.jsonb_is_whole(p -> 'rest_between_rounds_s', 0))
        and (not p ? 'by_station' or jsonb_typeof(p -> 'by_station') = 'boolean')
        and (not p ? 'rest_between_stations_s' or private.jsonb_is_whole(p -> 'rest_between_stations_s', 0));
    when 'tabata' then
      return private.jsonb_has_keys(p, '{rounds,work_s,rest_s}')
        and private.jsonb_is_whole(p -> 'rounds', 1)
        and p -> 'work_s' = '20'::jsonb
        and p -> 'rest_s' = '10'::jsonb;
  end case;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Lines: alternatives, one side, a cap.
-- ---------------------------------------------------------------------------

/** A cap on a line: { type: a measure unit, value > 0 } — whole, except metres. */
create function private.item_cap_valid(c jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if not private.jsonb_has_keys(c, '{type,value}') or (c ->> 'type') not in ('reps', 'distance_m', 'calories', 'time_s') then
    return false;
  end if;
  return case when c ->> 'type' = 'distance_m' then private.jsonb_is_positive(c -> 'value') else private.jsonb_is_whole(c -> 'value', 1) end;
end;
$$;

/** Alternatives as written: up to ten, each 1–80 characters, trimmed. */
create function private.alternatives_valid(a text[])
returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(cardinality(a), 0) <= 10
     and not exists (select 1 from unnest(a) as e(v) where v is null or v <> btrim(v) or length(v) not between 1 and 80)
$$;

/** A line's alternatives as the app sends them (a JSON array of text), or none. */
create function private.alternatives_of(p_item jsonb)
returns text[]
language sql immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_item -> 'alternatives') = 'array'
              then array(select jsonb_array_elements_text(p_item -> 'alternatives'))
              else '{}'::text[] end
$$;

-- CHECK constraints and the functions that save run as the signed-in user, so they need EXECUTE.
grant execute on function private.item_cap_valid(jsonb), private.alternatives_valid(text[]), private.alternatives_of(jsonb)
  to authenticated, service_role;

alter table public.block_items
  add column alternatives text[] not null default '{}' check (private.alternatives_valid(alternatives)),
  add column side text check (side in ('left', 'right')),
  add column cap jsonb check (cap is null or private.item_cap_valid(cap));

comment on column public.block_items.alternatives is 'Other exercises the coach allows, as written ("Sprawls"); the line counts its own exercise (calc spec 5).';
comment on column public.block_items.side is 'One side only (left or right): counts half in exposure and hard sets, like one side of 8/8 (calc spec 5).';
comment on column public.block_items.cap is 'A cap on the line, "max 40 sec" or "max 10 reps": {type, value} (calc spec 5).';

-- ---------------------------------------------------------------------------
-- 4. Blocks: counted in planned load, or not (stretching).
-- ---------------------------------------------------------------------------

alter table public.blocks add column counts_in_load boolean not null default true;
comment on column public.blocks.counts_in_load is 'False: in the session length only, not in planned load or the lenses (stretching; calc spec 5).';

-- ---------------------------------------------------------------------------
-- 5. Saving and copying carry the new fields.
-- ---------------------------------------------------------------------------

/**
 * Saves a workout with its blocks and lines, in order, in one transaction.
 * Runs as the signed-in user, so RLS applies. Every block and line carries an
 * id chosen by the app; rows that did not change are not touched (the audit
 * log shows real edits only); removed blocks and lines are deleted; a line
 * moved to another block is deleted and added again. Returns the workout id.
 *
 * p_workout: { id, track_id, kind, date, title, focus,
 *   blocks: [{ id, label, title, intent, format, params, pace_effort,
 *     load_effort, partner_mode, target_rounds, notes, rest_after_s, counts_in_load,
 *     items: [{ id, station_label, slot, exercise_id, raw_line, quantity,
 *       load, pace_effort, load_effort, implement_count, notes, alternatives, side, cap }] }] }
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
        rest_after_s = (v_block ->> 'rest_after_s')::int,
        counts_in_load = coalesce((v_block ->> 'counts_in_load')::boolean, true)
      where b.id = v_block_id
        and (b.position, b.label, b.title, b.intent, b.format, b.params, b.pace_effort, b.load_effort,
             b.partner_mode, b.target_rounds, b.notes, b.rest_after_s, b.counts_in_load) is distinct from (
             v_block_position, v_block ->> 'label', nullif(btrim(v_block ->> 'title'), ''),
             (v_block ->> 'intent')::public.block_intent, (v_block ->> 'format')::public.block_format,
             v_block -> 'params', v_block ->> 'pace_effort', v_block ->> 'load_effort',
             private.partner_mode_of(v_block), (v_block ->> 'target_rounds')::numeric,
             coalesce(v_block ->> 'notes', ''), (v_block ->> 'rest_after_s')::int,
             coalesce((v_block ->> 'counts_in_load')::boolean, true));
    else
      insert into public.blocks (id, workout_id, org_id, position, label, title, intent, format, params,
                                 pace_effort, load_effort, partner_mode, target_rounds, notes, rest_after_s, counts_in_load)
      values (v_block_id, v_id, p_org, v_block_position, v_block ->> 'label', nullif(btrim(v_block ->> 'title'), ''),
              (v_block ->> 'intent')::public.block_intent, (v_block ->> 'format')::public.block_format,
              v_block -> 'params', v_block ->> 'pace_effort', v_block ->> 'load_effort',
              private.partner_mode_of(v_block), (v_block ->> 'target_rounds')::numeric,
              coalesce(v_block ->> 'notes', ''), (v_block ->> 'rest_after_s')::int,
              coalesce((v_block ->> 'counts_in_load')::boolean, true));
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
          notes = coalesce(v_item ->> 'notes', ''),
          alternatives = private.alternatives_of(v_item),
          side = v_item ->> 'side',
          cap = nullif(v_item -> 'cap', 'null'::jsonb)
        where i.id = (v_item ->> 'id')::uuid
          and (i.position, i.station_label, i.slot, i.exercise_id, i.raw_line, i.quantity, i.load,
               i.pace_effort, i.load_effort, i.implement_count, i.notes, i.alternatives, i.side, i.cap) is distinct from (
               v_item_position, nullif(btrim(v_item ->> 'station_label'), ''), (v_item ->> 'slot')::smallint,
               (v_item ->> 'exercise_id')::uuid, v_item ->> 'raw_line', v_item -> 'quantity',
               nullif(v_item -> 'load', 'null'::jsonb), v_item ->> 'pace_effort', v_item ->> 'load_effort',
               (v_item ->> 'implement_count')::smallint, coalesce(v_item ->> 'notes', ''),
               private.alternatives_of(v_item), v_item ->> 'side', nullif(v_item -> 'cap', 'null'::jsonb));
      else
        insert into public.block_items (id, block_id, org_id, position, station_label, slot, exercise_id, raw_line,
                                        quantity, load, pace_effort, load_effort, implement_count, notes,
                                        alternatives, side, cap)
        values ((v_item ->> 'id')::uuid, v_block_id, p_org, v_item_position,
                nullif(btrim(v_item ->> 'station_label'), ''), (v_item ->> 'slot')::smallint,
                (v_item ->> 'exercise_id')::uuid, v_item ->> 'raw_line', v_item -> 'quantity',
                nullif(v_item -> 'load', 'null'::jsonb), v_item ->> 'pace_effort', v_item ->> 'load_effort',
                (v_item ->> 'implement_count')::smallint, coalesce(v_item ->> 'notes', ''),
                private.alternatives_of(v_item), v_item ->> 'side', nullif(v_item -> 'cap', 'null'::jsonb));
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
                                 load_effort, partner_mode, target_rounds, notes, rest_after_s, counts_in_load)
      values (v_workout_id, p_org, v_block.position, v_block.label, v_block.title, v_block.intent, v_block.format,
              v_block.params, v_block.pace_effort, v_block.load_effort, v_block.partner_mode, v_block.target_rounds,
              v_block.notes, v_block.rest_after_s, v_block.counts_in_load)
      returning id into v_block_id;

      insert into public.block_items (block_id, org_id, position, station_label, exercise_id, raw_line, quantity, load,
                                      pace_effort, load_effort, implement_count, notes, slot, alternatives, side, cap)
      select v_block_id, p_org, i.position, i.station_label, i.exercise_id, i.raw_line, i.quantity, i.load,
             i.pace_effort, i.load_effort, i.implement_count, i.notes, i.slot, i.alternatives, i.side, i.cap
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
