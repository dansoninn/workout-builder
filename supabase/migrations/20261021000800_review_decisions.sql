-- Step 1 review decisions, approved by Daniel on 2026-10-21:
--   1. Tracks are managed by owners and head coaches. Coaches cannot.
--   2. Monostructural = cyclical cardio only, and monostructural exercises have
--      no movement patterns (enforced). "sled" is removed from modalities:
--      sled push/pull/drag are movements with patterns (e.g. h_push, carry).
--   3. Equipment is a locked reference table like the rest of the taxonomy.
--      The list itself is proposed in Step 2; until then the table is empty.
-- Taxonomy version 2 records the taxonomy changes (calc spec §8).

-- ---------------------------------------------------------------------------
-- 1. Tracks: owner and head coach
--
--                               owner  head_coach  coach  viewer
--   Manage tracks                 ✓        ✓
-- ---------------------------------------------------------------------------

create function private.orgs_where_can_manage_tracks()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = auth.uid() and m.role in ('owner', 'head_coach')
$$;

grant execute on function private.orgs_where_can_manage_tracks() to authenticated, service_role;

drop policy "Owners can create tracks" on public.tracks;
drop policy "Owners can edit tracks" on public.tracks;

create policy "Owners and head coaches can create tracks"
  on public.tracks for insert to authenticated
  with check (org_id in (select private.orgs_where_can_manage_tracks()));

create policy "Owners and head coaches can edit tracks"
  on public.tracks for update to authenticated
  using (org_id in (select private.orgs_where_can_manage_tracks()))
  with check (org_id in (select private.orgs_where_can_manage_tracks()));

-- ---------------------------------------------------------------------------
-- 2. Monostructural exercises: cyclical cardio only, no movement patterns
-- ---------------------------------------------------------------------------

delete from public.modalities where key = 'sled';

-- Patterns cannot be attached to a monostructural exercise.
create function private.forbid_patterns_on_monostructural()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_kind public.exercise_kind;
begin
  -- Lock the exercise row so a concurrent change of kind cannot slip past.
  select e.kind into v_kind
  from public.exercises e
  where e.id = new.exercise_id
  for share;

  if v_kind = 'monostructural' then
    raise exception 'Monostructural exercises have no movement patterns (tracked by modality instead)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger exercise_patterns_not_on_monostructural
  before insert or update of exercise_id on public.exercise_patterns
  for each row execute function private.forbid_patterns_on_monostructural();

-- An exercise with patterns cannot be turned into a monostructural one.
create function private.forbid_monostructural_with_patterns()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.kind = 'monostructural'
     and exists (select 1 from public.exercise_patterns p where p.exercise_id = new.id)
  then
    raise exception 'Remove the movement patterns before making an exercise monostructural'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger exercises_monostructural_without_patterns
  before update of kind on public.exercises
  for each row execute function private.forbid_monostructural_with_patterns();

-- ---------------------------------------------------------------------------
-- 3. Equipment: locked reference list, linked to exercises through a join
--    table (replaces the free-text exercises.equipment array)
-- ---------------------------------------------------------------------------

create table public.equipment (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  label_en text not null,
  label_is text not null,
  position smallint not null unique
);

comment on table public.equipment is 'Locked equipment list. Values are approved in Step 2.';

create table public.exercise_equipment (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  equipment_key text not null references public.equipment (key),
  primary key (exercise_id, equipment_key)
);

create index exercise_equipment_equipment_key_idx on public.exercise_equipment (equipment_key);

alter table public.exercises drop column equipment;

alter table public.equipment enable row level security;
alter table public.exercise_equipment enable row level security;

create policy "Signed-in users can read equipment"
  on public.equipment for select to authenticated using (true);

-- exercise_equipment follows its exercise, like exercise_muscles.
create policy "Readable with their exercise"
  on public.exercise_equipment for select to authenticated
  using (private.can_read_exercise(exercise_id));
create policy "Bank editors can add equipment to gym exercises"
  on public.exercise_equipment for insert to authenticated
  with check (private.can_edit_exercise(exercise_id));
create policy "Bank editors can change equipment of gym exercises"
  on public.exercise_equipment for update to authenticated
  using (private.can_edit_exercise(exercise_id))
  with check (private.can_edit_exercise(exercise_id));
create policy "Bank editors can remove equipment from gym exercises"
  on public.exercise_equipment for delete to authenticated
  using (private.can_edit_exercise(exercise_id));

revoke all on table public.equipment, public.exercise_equipment from anon, authenticated;
grant select on table public.equipment to authenticated;
grant select, insert, update, delete on table public.exercise_equipment to authenticated;
grant all on table public.equipment, public.exercise_equipment to service_role;

-- ---------------------------------------------------------------------------
-- Taxonomy version 2
-- ---------------------------------------------------------------------------

insert into public.taxonomy_versions (version, published_at, notes) values
  (2, '2026-10-21T00:00:00Z',
   'Removed modality "sled" (sled work is a movement with patterns). Monostructural exercises have no patterns. '
   || 'Added the equipment reference table (empty until the Step 2 list is approved).');
