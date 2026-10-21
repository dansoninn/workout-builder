-- Step 4b: what the structured builder needs from the database.
--   1. Slots for alternating EMOM lines (Daniel, 4a review): ordered slots,
--      one per interval, each with one or more lines. Checked at commit.
--   2. Gym pace overrides in their own table, so owners AND head coaches can
--      manage them (decision 9; gym settings are owner-only).
--   3. save_workout: the builder's one way to save a workout, blocks and lines
--      in a single transaction, touching only rows that changed.

-- ---------------------------------------------------------------------------
-- 1. Alternating EMOM slots
-- ---------------------------------------------------------------------------

alter table public.block_items
  add column slot smallint check (slot >= 1);

comment on column public.block_items.slot is
  'Alternating every blocks only: the interval of the rotation this line belongs to (1, 2, ...). NULL elsewhere.';

-- An alternating block: every line has a slot, and slots run 1..k without
-- gaps. Any other block: no line has a slot.
create function private.check_block_slots(p_block uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_alternating boolean;
  v_slots int[];
begin
  select b.format = 'every' and coalesce((b.params ->> 'alternating')::boolean, false)
    into v_alternating
  from public.blocks b where b.id = p_block;
  if not found then
    return; -- the block itself is being deleted
  end if;

  if v_alternating then
    if exists (select 1 from public.block_items i where i.block_id = p_block and i.slot is null) then
      raise exception 'Every line of an alternating EMOM needs a slot (minute 1, 2, ...)'
        using errcode = 'check_violation';
    end if;
    select coalesce(array_agg(distinct i.slot order by i.slot), '{}') into v_slots
    from public.block_items i where i.block_id = p_block;
    if v_slots <> array(select generate_series(1, cardinality(v_slots))) then
      raise exception 'Alternating EMOM slots must run 1, 2, 3 ... without gaps'
        using errcode = 'check_violation';
    end if;
  elsif exists (select 1 from public.block_items i where i.block_id = p_block and i.slot is not null) then
    raise exception 'Only lines of an alternating EMOM have a slot'
      using errcode = 'check_violation';
  end if;
end;
$$;

create function private.check_block_slots_trigger()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'blocks' then
    perform private.check_block_slots(new.id);
  else
    perform private.check_block_slots(coalesce(new.block_id, old.block_id));
  end if;
  return null;
end;
$$;

-- Checked at commit, so a save can change a block and its lines in any order.
create constraint trigger block_items_slots_valid
  after insert or update of slot, block_id or delete on public.block_items
  deferrable initially deferred
  for each row execute function private.check_block_slots_trigger();

create constraint trigger blocks_slots_valid
  after insert or update of format, params on public.blocks
  deferrable initially deferred
  for each row execute function private.check_block_slots_trigger();

-- ---------------------------------------------------------------------------
-- 2. Gym pace overrides
-- ---------------------------------------------------------------------------

create table public.exercise_pace_overrides (
  org_id uuid not null references public.organizations (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  pace jsonb not null check (private.pace_is_valid(pace)),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (org_id, exercise_id)
);

comment on table public.exercise_pace_overrides is
  'A gym''s own working pace for an exercise; replaces exercises.pace_default for that gym (calc spec 9.5).';

create index exercise_pace_overrides_exercise_id_idx on public.exercise_pace_overrides (exercise_id);

create function private.set_pace_override_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger exercise_pace_overrides_set_updated
  before update on public.exercise_pace_overrides
  for each row execute function private.set_pace_override_updated();

create trigger exercise_pace_overrides_pin_keys
  before update on public.exercise_pace_overrides
  for each row execute function private.forbid_column_change('org_id', 'exercise_id');

create trigger exercise_pace_overrides_exercise_in_scope
  before insert on public.exercise_pace_overrides
  for each row execute function private.check_exercise_in_scope();

create trigger exercise_pace_overrides_audit
  after insert or update or delete on public.exercise_pace_overrides
  for each row execute function private.write_audit_log('exercise_id');

alter table public.exercise_pace_overrides enable row level security;

create policy "Members can read their gym's paces"
  on public.exercise_pace_overrides for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));
create policy "Owners and head coaches can set paces"
  on public.exercise_pace_overrides for insert to authenticated
  with check (org_id in (select private.orgs_where_can_edit_bank()));
create policy "Owners and head coaches can change paces"
  on public.exercise_pace_overrides for update to authenticated
  using (org_id in (select private.orgs_where_can_edit_bank()))
  with check (org_id in (select private.orgs_where_can_edit_bank()));
create policy "Owners and head coaches can remove paces"
  on public.exercise_pace_overrides for delete to authenticated
  using (org_id in (select private.orgs_where_can_edit_bank()));

revoke all on table public.exercise_pace_overrides from anon, authenticated;
grant select, insert, update, delete on table public.exercise_pace_overrides to authenticated;
grant all on table public.exercise_pace_overrides to service_role;

-- ---------------------------------------------------------------------------
-- 3. save_workout
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
 *     load_effort, partner, target_rounds, notes, rest_after_s,
 *     items: [{ id, station_label, slot, exercise_id, raw_line, quantity,
 *       load, pace_effort, load_effort, implement_count, notes }] }] }
 */
create function public.save_workout(p_org uuid, p_workout jsonb)
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
        partner = coalesce((v_block ->> 'partner')::boolean, false),
        target_rounds = (v_block ->> 'target_rounds')::numeric,
        notes = coalesce(v_block ->> 'notes', ''),
        rest_after_s = (v_block ->> 'rest_after_s')::int
      where b.id = v_block_id
        and (b.position, b.label, b.title, b.intent, b.format, b.params, b.pace_effort, b.load_effort,
             b.partner, b.target_rounds, b.notes, b.rest_after_s) is distinct from (
             v_block_position, v_block ->> 'label', nullif(btrim(v_block ->> 'title'), ''),
             (v_block ->> 'intent')::public.block_intent, (v_block ->> 'format')::public.block_format,
             v_block -> 'params', v_block ->> 'pace_effort', v_block ->> 'load_effort',
             coalesce((v_block ->> 'partner')::boolean, false), (v_block ->> 'target_rounds')::numeric,
             coalesce(v_block ->> 'notes', ''), (v_block ->> 'rest_after_s')::int);
    else
      insert into public.blocks (id, workout_id, org_id, position, label, title, intent, format, params,
                                 pace_effort, load_effort, partner, target_rounds, notes, rest_after_s)
      values (v_block_id, v_id, p_org, v_block_position, v_block ->> 'label', nullif(btrim(v_block ->> 'title'), ''),
              (v_block ->> 'intent')::public.block_intent, (v_block ->> 'format')::public.block_format,
              v_block -> 'params', v_block ->> 'pace_effort', v_block ->> 'load_effort',
              coalesce((v_block ->> 'partner')::boolean, false), (v_block ->> 'target_rounds')::numeric,
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
