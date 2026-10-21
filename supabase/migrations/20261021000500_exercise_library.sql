-- Exercise library (SPEC-data-model §5): two layers.
--   org_id NULL = core library (ours): readable by all signed-in users,
--                 writable only by the service role.
--   org_id set  = gym-owned: readable by the gym, editable by owner/head coach.

create type public.exercise_kind as enum ('movement', 'monostructural');
create type public.exercise_status as enum ('active', 'needs_review', 'archived');
create type public.muscle_role as enum ('primary', 'secondary');

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind public.exercise_kind not null,
  modality text references public.modalities (key),
  plane text references public.planes (key),
  unilateral boolean not null default false,
  equipment text[] not null default '{}',
  default_unit public.measure_unit not null,
  pace_default jsonb check (pace_default is null or jsonb_typeof(pace_default) = 'object'),
  status public.exercise_status not null default 'active',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint exercises_monostructural_needs_modality
    check (kind <> 'monostructural' or modality is not null)
);

comment on column public.exercises.org_id is 'NULL = core library exercise; set = gym-owned.';
comment on column public.exercises.plane is 'NULL = not yet curated. Flagged for review, never defaulted.';
comment on column public.exercises.pace_default is 'e.g. {"sec_per_rep": 2} or {"sec_per_500m": 120}.';

-- Slug is unique per library (core counts as one library); soft-deleted
-- exercises release their slug.
create unique index exercises_org_slug_key
  on public.exercises (org_id, slug) nulls not distinct
  where deleted_at is null;
create index exercises_org_id_idx on public.exercises (org_id);

create table public.exercise_patterns (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  pattern_key text not null references public.movement_patterns (key),
  weight numeric(3,2) not null check (weight > 0 and weight <= 1),
  primary key (exercise_id, pattern_key)
);

create table public.exercise_muscles (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  muscle_key text not null references public.muscles (key),
  role public.muscle_role not null,
  primary key (exercise_id, muscle_key)
);

-- Aliases map what coaches type to one canonical exercise. They never create
-- exercises. alias_normalized: lower-case, trimmed, no punctuation, single
-- spaces.
create table public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  alias_normalized text not null,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint exercise_aliases_is_normalized check (
    alias_normalized <> ''
    and alias_normalized = lower(alias_normalized)
    and alias_normalized = btrim(alias_normalized)
    and alias_normalized !~ '[[:punct:]]'
    and alias_normalized !~ '\s\s'
  ),
  constraint exercise_aliases_org_alias_key unique nulls not distinct (org_id, alias_normalized)
);

comment on column public.exercise_aliases.org_id is 'NULL = core alias; set = gym-specific shorthand.';

create index exercise_aliases_exercise_id_idx on public.exercise_aliases (exercise_id);

-- ---------------------------------------------------------------------------
-- Integrity rules
-- ---------------------------------------------------------------------------

-- Pattern weights per exercise must sum to exactly 1.00. Checked at commit
-- (deferred), so a set of weights can be written in several statements.
-- An exercise with no patterns is allowed (monostructural, or not curated).
create function private.check_pattern_weights()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_exercise_id uuid;
  v_total numeric;
begin
  foreach v_exercise_id in array array_remove(array[
    case when tg_op <> 'INSERT' then old.exercise_id end,
    case when tg_op <> 'DELETE' then new.exercise_id end
  ], null) loop
    select sum(p.weight) into v_total
    from public.exercise_patterns p
    where p.exercise_id = v_exercise_id;

    if v_total is not null and v_total <> 1.00 then
      raise exception 'Pattern weights for exercise % sum to %, must be 1.00', v_exercise_id, v_total
        using errcode = 'check_violation';
    end if;
  end loop;
  return null;
end;
$$;

create constraint trigger exercise_patterns_weights_sum_to_one
  after insert or update or delete on public.exercise_patterns
  deferrable initially deferred
  for each row execute function private.check_pattern_weights();

-- A row's exercise must be a core exercise or belong to the row's own gym.
-- Shared by exercise_aliases and block_items (both have org_id, exercise_id).
create function private.check_exercise_in_scope()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_exercise_org uuid;
begin
  if new.exercise_id is null then
    return new;
  end if;

  select e.org_id into v_exercise_org
  from public.exercises e
  where e.id = new.exercise_id;

  if found and v_exercise_org is not null and v_exercise_org is distinct from new.org_id then
    raise exception '% must reference a core exercise or one owned by the same gym', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger exercise_aliases_exercise_in_scope
  before insert or update of exercise_id, org_id on public.exercise_aliases
  for each row execute function private.check_exercise_in_scope();

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function private.set_updated_at();

create trigger exercises_pin_org
  before update on public.exercises
  for each row execute function private.forbid_column_change('org_id');

create trigger exercise_aliases_pin_org
  before update on public.exercise_aliases
  for each row execute function private.forbid_column_change('org_id');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

create function private.can_read_exercise(p_exercise_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercises e
    where e.id = p_exercise_id
      and (e.org_id is null or e.org_id in (select private.orgs_where_can_read()))
  )
$$;

create function private.can_edit_exercise(p_exercise_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exercises e
    where e.id = p_exercise_id
      and e.org_id in (select private.orgs_where_can_edit_bank())
  )
$$;

grant execute on function
  private.can_read_exercise(uuid),
  private.can_edit_exercise(uuid)
  to authenticated, service_role;

alter table public.exercises enable row level security;
alter table public.exercise_patterns enable row level security;
alter table public.exercise_muscles enable row level security;
alter table public.exercise_aliases enable row level security;

-- exercises: core rows have org_id NULL, which never matches `in (...)`,
-- so they are read-only for every tenant role. No delete: soft delete only.
create policy "Members can read core and own-gym exercises"
  on public.exercises for select to authenticated
  using (org_id is null or org_id in (select private.orgs_where_can_read()));

create policy "Bank editors can add gym exercises"
  on public.exercises for insert to authenticated
  with check (org_id in (select private.orgs_where_can_edit_bank()));

create policy "Bank editors can edit gym exercises"
  on public.exercises for update to authenticated
  using (org_id in (select private.orgs_where_can_edit_bank()))
  with check (org_id in (select private.orgs_where_can_edit_bank()));

-- exercise_patterns / exercise_muscles follow their exercise.
create policy "Readable with their exercise"
  on public.exercise_patterns for select to authenticated
  using (private.can_read_exercise(exercise_id));
create policy "Bank editors can add patterns to gym exercises"
  on public.exercise_patterns for insert to authenticated
  with check (private.can_edit_exercise(exercise_id));
create policy "Bank editors can change patterns of gym exercises"
  on public.exercise_patterns for update to authenticated
  using (private.can_edit_exercise(exercise_id))
  with check (private.can_edit_exercise(exercise_id));
create policy "Bank editors can remove patterns from gym exercises"
  on public.exercise_patterns for delete to authenticated
  using (private.can_edit_exercise(exercise_id));

create policy "Readable with their exercise"
  on public.exercise_muscles for select to authenticated
  using (private.can_read_exercise(exercise_id));
create policy "Bank editors can add muscles to gym exercises"
  on public.exercise_muscles for insert to authenticated
  with check (private.can_edit_exercise(exercise_id));
create policy "Bank editors can change muscles of gym exercises"
  on public.exercise_muscles for update to authenticated
  using (private.can_edit_exercise(exercise_id))
  with check (private.can_edit_exercise(exercise_id));
create policy "Bank editors can remove muscles from gym exercises"
  on public.exercise_muscles for delete to authenticated
  using (private.can_edit_exercise(exercise_id));

-- exercise_aliases: core aliases read-only; gym aliases are part of the bank.
create policy "Members can read core and own-gym aliases"
  on public.exercise_aliases for select to authenticated
  using (org_id is null or org_id in (select private.orgs_where_can_read()));
create policy "Bank editors can add gym aliases"
  on public.exercise_aliases for insert to authenticated
  with check (org_id in (select private.orgs_where_can_edit_bank()));
create policy "Bank editors can change gym aliases"
  on public.exercise_aliases for update to authenticated
  using (org_id in (select private.orgs_where_can_edit_bank()))
  with check (org_id in (select private.orgs_where_can_edit_bank()));
create policy "Bank editors can remove gym aliases"
  on public.exercise_aliases for delete to authenticated
  using (org_id in (select private.orgs_where_can_edit_bank()));

revoke all on table public.exercises, public.exercise_patterns, public.exercise_muscles, public.exercise_aliases
  from anon, authenticated;
grant select, insert, update on table public.exercises to authenticated;
grant select, insert, update, delete on table public.exercise_patterns, public.exercise_muscles, public.exercise_aliases
  to authenticated;
grant all on table public.exercises, public.exercise_patterns, public.exercise_muscles, public.exercise_aliases
  to service_role;
