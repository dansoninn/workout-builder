-- Programming (SPEC-data-model §6): workouts → blocks → block_items.
--
-- Raw text is stored next to the parsed structure (workouts.raw_text,
-- block_items.raw_line). Structured JSON fields (block params, item quantity
-- and load) are validated here with CHECK constraints; the app mirrors the
-- same shapes in a shared Zod schema.

create type public.workout_kind as enum ('scheduled', 'template');
create type public.workout_status as enum ('draft', 'published');
create type public.block_intent as enum ('strength', 'conditioning', 'skill', 'mobility');
create type public.block_format as enum ('sets', 'every', 'amrap', 'for_time', 'intervals', 'tabata');

-- ---------------------------------------------------------------------------
-- JSON shape validators (immutable, used in CHECK constraints)
-- ---------------------------------------------------------------------------

-- True when p is a JSON number that is a whole number >= p_min.
create function private.jsonb_is_whole(p jsonb, p_min numeric)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p) is distinct from 'number' then
    return false;
  end if;
  return p::numeric = trunc(p::numeric) and p::numeric >= p_min;
end;
$$;

-- True when p is a JSON number > 0 (decimals allowed).
create function private.jsonb_is_positive(p jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p) is distinct from 'number' then
    return false;
  end if;
  return p::numeric > 0;
end;
$$;

-- True when p is an object containing all of p_required and nothing outside
-- p_required + p_optional.
create function private.jsonb_has_keys(p jsonb, p_required text[], p_optional text[] default '{}')
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p) is distinct from 'object' then
    return false;
  end if;
  return p ?& p_required and (p - p_required - p_optional) = '{}'::jsonb;
end;
$$;

-- Block params per format (SPEC-data-model §6, calc spec §4.3). Durations in
-- whole seconds. Rest and caps that coaches often leave out are optional.
create function private.block_params_valid(p_format public.block_format, p jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  case p_format
    when 'sets' then
      return private.jsonb_has_keys(p, '{sets}', '{rest_s}')
        and private.jsonb_is_whole(p -> 'sets', 1)
        and (not p ? 'rest_s' or private.jsonb_is_whole(p -> 'rest_s', 0));
    when 'every' then
      return private.jsonb_has_keys(p, '{interval_s,rounds}')
        and private.jsonb_is_whole(p -> 'interval_s', 1)
        and private.jsonb_is_whole(p -> 'rounds', 1);
    when 'amrap' then
      return private.jsonb_has_keys(p, '{time_s}')
        and private.jsonb_is_whole(p -> 'time_s', 1);
    when 'for_time' then
      return private.jsonb_has_keys(p, '{rounds}', '{time_cap_s}')
        and private.jsonb_is_whole(p -> 'rounds', 1)
        and (not p ? 'time_cap_s' or private.jsonb_is_whole(p -> 'time_cap_s', 1));
    when 'intervals' then
      return private.jsonb_has_keys(p, '{rounds,work_s,rest_s,stations}', '{rest_between_rounds_s}')
        and private.jsonb_is_whole(p -> 'rounds', 1)
        and private.jsonb_is_whole(p -> 'work_s', 1)
        and private.jsonb_is_whole(p -> 'rest_s', 0)
        and private.jsonb_is_whole(p -> 'stations', 1)
        and (not p ? 'rest_between_rounds_s' or private.jsonb_is_whole(p -> 'rest_between_rounds_s', 0));
    when 'tabata' then
      return private.jsonb_has_keys(p, '{rounds,work_s,rest_s}')
        and private.jsonb_is_whole(p -> 'rounds', 1)
        and p -> 'work_s' = '20'::jsonb
        and p -> 'rest_s' = '10'::jsonb;
  end case;
  return false;
end;
$$;

-- Item quantity: exactly one type (SPEC-data-model §6, calc spec §4.1).
create function private.item_quantity_valid(q jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(q) is distinct from 'object' then
    return false;
  end if;

  case q ->> 'type'
    when 'reps', 'reps_per_side' then
      return private.jsonb_has_keys(q, '{type,value}')
        and private.jsonb_is_whole(q -> 'value', 1);
    when 'reps_range' then
      if not (private.jsonb_has_keys(q, '{type,min,max}')
              and private.jsonb_is_whole(q -> 'min', 1)
              and private.jsonb_is_whole(q -> 'max', 1)) then
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
      return private.jsonb_has_keys(q, '{type,value}')
        and private.jsonb_is_positive(q -> 'value');
    when 'calories' then
      -- A single value ("15 cal") is stored as min = max.
      if not (private.jsonb_has_keys(q, '{type,min,max}')
              and private.jsonb_is_whole(q -> 'min', 1)
              and private.jsonb_is_whole(q -> 'max', 1)) then
        return false;
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

-- Item load: optional, exactly one type (SPEC-data-model §6).
create function private.item_load_valid(l jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(l) is distinct from 'object' then
    return false;
  end if;

  case l ->> 'type'
    when 'percent_1rm' then
      if not (private.jsonb_has_keys(l, '{type,min,max}')
              and private.jsonb_is_positive(l -> 'min')
              and private.jsonb_is_positive(l -> 'max')) then
        return false;
      end if;
      return (l ->> 'min')::numeric <= (l ->> 'max')::numeric
        and (l ->> 'max')::numeric <= 100;
    when 'absolute_kg' then
      -- Rx variants, first listed is used for calculations (calc spec §5).
      if not (private.jsonb_has_keys(l, '{type,rx}')
              and jsonb_typeof(l -> 'rx') = 'array'
              and jsonb_array_length(l -> 'rx') >= 1) then
        return false;
      end if;
      return not exists (
        select 1 from jsonb_array_elements(l -> 'rx') as e(v)
        where not private.jsonb_is_positive(e.v)
      );
    when 'bodyweight' then
      return private.jsonb_has_keys(l, '{type}');
    else
      return false;
  end case;
end;
$$;

-- CHECK constraints run as the inserting user, so they need EXECUTE.
grant execute on function
  private.jsonb_is_whole(jsonb, numeric),
  private.jsonb_is_positive(jsonb),
  private.jsonb_has_keys(jsonb, text[], text[]),
  private.block_params_valid(public.block_format, jsonb),
  private.item_quantity_valid(jsonb),
  private.item_load_valid(jsonb)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  track_id uuid,
  kind public.workout_kind not null,
  date date,
  title text,
  focus text,
  status public.workout_status not null default 'draft',
  raw_text text,
  parser_version int check (parser_version > 0),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workouts_date_matches_kind
    check ((kind = 'scheduled') = (date is not null)),
  constraint workouts_track_same_gym
    foreign key (track_id, org_id) references public.tracks (id, org_id),
  unique (id, org_id)
);

comment on column public.workouts.date is 'Required for scheduled workouts, NULL for templates.';
comment on column public.workouts.raw_text is 'Original free text as typed or pasted. Source of truth.';

create index workouts_org_date_idx on public.workouts (org_id, date);
create index workouts_track_id_idx on public.workouts (track_id);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  position int not null check (position >= 0),
  label text not null,
  title text,
  intent public.block_intent not null,
  format public.block_format not null,
  params jsonb not null,
  pace_effort text references public.effort_levels (key),
  load_effort text references public.effort_levels (key),
  partner boolean not null default false,
  target_rounds numeric check (target_rounds > 0),
  notes text not null default '',
  constraint blocks_workout_same_gym
    foreign key (workout_id, org_id) references public.workouts (id, org_id) on delete cascade,
  constraint blocks_params_match_format
    check (private.block_params_valid(format, params)),
  -- The load axis has no "max" level (calc spec §4.4).
  constraint blocks_load_effort_not_max
    check (load_effort <> 'max'),
  unique (id, org_id)
);

comment on column public.blocks.org_id is 'Denormalised from the workout for RLS speed.';
comment on column public.blocks.target_rounds is 'Coach''s AMRAP estimate; overrides the pace estimate.';

create index blocks_workout_id_idx on public.blocks (workout_id);
create index blocks_org_id_idx on public.blocks (org_id);

create table public.block_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  position int not null check (position >= 0),
  station_label text,
  exercise_id uuid references public.exercises (id),
  raw_line text not null,
  quantity jsonb not null check (private.item_quantity_valid(quantity)),
  load jsonb check (load is null or private.item_load_valid(load)),
  pace_effort text references public.effort_levels (key),
  load_effort text references public.effort_levels (key),
  notes text not null default '',
  constraint block_items_block_same_gym
    foreign key (block_id, org_id) references public.blocks (id, org_id) on delete cascade,
  constraint block_items_load_effort_not_max
    check (load_effort <> 'max')
);

comment on column public.block_items.exercise_id is 'NULL = unresolved; must be matched before the workout is published.';
comment on column public.block_items.raw_line is 'The line as the coach wrote it, e.g. "8/8 x Single Arm DB Row".';

create index block_items_block_id_idx on public.block_items (block_id);
create index block_items_org_id_idx on public.block_items (org_id);
create index block_items_exercise_id_idx on public.block_items (exercise_id);

-- ---------------------------------------------------------------------------
-- Publish rule: a workout can only be published when every item is matched
-- to an exercise, and a published workout cannot gain unmatched items.
-- ---------------------------------------------------------------------------

create function private.check_workout_publishable()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_unmatched int;
begin
  if new.status = 'published' then
    select count(*) into v_unmatched
    from public.block_items i
    join public.blocks b on b.id = i.block_id
    where b.workout_id = new.id and i.exercise_id is null;

    if v_unmatched > 0 then
      raise exception 'Workout cannot be published: % item(s) not matched to an exercise', v_unmatched
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger workouts_publish_requires_matched_items
  before insert or update of status on public.workouts
  for each row execute function private.check_workout_publishable();

create function private.check_item_keeps_workout_publishable()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status public.workout_status;
begin
  if new.exercise_id is null then
    -- Lock the workout row so a concurrent publish cannot slip past.
    select w.status into v_status
    from public.blocks b
    join public.workouts w on w.id = b.workout_id
    where b.id = new.block_id
    for share of w;

    if v_status = 'published' then
      raise exception 'A published workout cannot have items without an exercise'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger block_items_keep_workout_publishable
  before insert or update of exercise_id on public.block_items
  for each row execute function private.check_item_keeps_workout_publishable();

create trigger block_items_exercise_in_scope
  before insert or update of exercise_id, org_id on public.block_items
  for each row execute function private.check_exercise_in_scope();

-- ---------------------------------------------------------------------------
-- Bookkeeping and pinning
-- ---------------------------------------------------------------------------

create function private.set_workout_updated()
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

create trigger workouts_set_updated
  before update on public.workouts
  for each row execute function private.set_workout_updated();

create trigger workouts_pin_org
  before update on public.workouts
  for each row execute function private.forbid_column_change('org_id');

create trigger blocks_pin_parent
  before update on public.blocks
  for each row execute function private.forbid_column_change('org_id', 'workout_id');

create trigger block_items_pin_parent
  before update on public.block_items
  for each row execute function private.forbid_column_change('org_id', 'block_id');

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone in the gym reads; owner, head coach and coach
-- write. Workouts are soft-deleted (deleted_at), never hard-deleted by users.
-- ---------------------------------------------------------------------------

alter table public.workouts enable row level security;
alter table public.blocks enable row level security;
alter table public.block_items enable row level security;

create policy "Members can read their gym's workouts"
  on public.workouts for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));
create policy "Coaches can create workouts"
  on public.workouts for insert to authenticated
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches can edit workouts"
  on public.workouts for update to authenticated
  using (org_id in (select private.orgs_where_can_program()))
  with check (org_id in (select private.orgs_where_can_program()));

create policy "Members can read their gym's blocks"
  on public.blocks for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));
create policy "Coaches can add blocks"
  on public.blocks for insert to authenticated
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches can edit blocks"
  on public.blocks for update to authenticated
  using (org_id in (select private.orgs_where_can_program()))
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches can remove blocks"
  on public.blocks for delete to authenticated
  using (org_id in (select private.orgs_where_can_program()));

create policy "Members can read their gym's block items"
  on public.block_items for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));
create policy "Coaches can add block items"
  on public.block_items for insert to authenticated
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches can edit block items"
  on public.block_items for update to authenticated
  using (org_id in (select private.orgs_where_can_program()))
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches can remove block items"
  on public.block_items for delete to authenticated
  using (org_id in (select private.orgs_where_can_program()));

revoke all on table public.workouts, public.blocks, public.block_items from anon, authenticated;
grant select, insert, update on table public.workouts to authenticated;
grant select, insert, update, delete on table public.blocks, public.block_items to authenticated;
grant all on table public.workouts, public.blocks, public.block_items to service_role;
