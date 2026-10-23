-- Programs (the `tracks` table; Daniel's decisions of 2026-10-23, Afrek
-- launch requirement): every workout belongs to a program, no new workout
-- lands on an archived program, active program names are unique within a
-- gym, a gym keeps at least one active program, and owners and head coaches
-- set the programs' order.

-- ---------------------------------------------------------------------------
-- 1. Every workout belongs to a program (decision 2). Workouts without one go
--    to the gym's first active program (by order, then name); a gym with no
--    program at all gets "Class", as every new gym does.
-- ---------------------------------------------------------------------------

insert into public.tracks (org_id, name, color, position)
select distinct w.org_id, 'Class', '#5B5FD6', 0
  from public.workouts w
 where w.track_id is null
   and not exists (select 1 from public.tracks t where t.org_id = w.org_id);

update public.workouts w
   set track_id = (
     select t.id from public.tracks t
      where t.org_id = w.org_id
      order by (t.archived_at is not null), t.position, t.name
      limit 1)
 where w.track_id is null;

alter table public.workouts alter column track_id set not null;

comment on column public.workouts.track_id is 'The workout''s program (table tracks). Required since 2026-10-23.';

-- ---------------------------------------------------------------------------
-- 2. No new workout on an archived program: not by saving, copying a
--    template or moving. Workouts already on it stay and can still be edited.
-- ---------------------------------------------------------------------------

create function private.check_workout_program_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.track_id is distinct from old.track_id)
     and exists (select 1 from public.tracks t
                 where t.id = new.track_id and t.org_id = new.org_id and t.archived_at is not null) then
    raise exception 'That program is archived: restore it in Settings, or choose another program'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger workouts_program_active
  before insert or update of track_id on public.workouts
  for each row execute function private.check_workout_program_active();

-- ---------------------------------------------------------------------------
-- 3. Active program names are unique within a gym (any case). Existing
--    duplicates, if any, get a number so the rule can hold.
-- ---------------------------------------------------------------------------

with numbered as (
  select t.id, t.name,
         row_number() over (partition by t.org_id, lower(btrim(t.name)) order by t.position, t.created_at) as n
    from public.tracks t
   where t.archived_at is null
)
update public.tracks t
   set name = numbered.name || ' (' || numbered.n || ')'
  from numbered
 where numbered.id = t.id and numbered.n > 1;

create unique index tracks_org_active_name_key
  on public.tracks (org_id, lower(btrim(name)))
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- 4. A gym keeps at least one active program, so there is always one to
--    program in. (Gyms start with "Class"; programs are never deleted.)
-- ---------------------------------------------------------------------------

create function private.keep_an_active_program()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    -- One archive at a time per gym, so two coaches cannot archive the last two at once.
    perform pg_advisory_xact_lock(hashtextextended('active-programs:' || new.org_id::text, 0));
    if not exists (select 1 from public.tracks t
                    where t.org_id = new.org_id and t.id <> new.id and t.archived_at is null) then
      raise exception 'A gym keeps at least one active program: create or restore another before archiving this one'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger tracks_keep_an_active_program
  before update of archived_at on public.tracks
  for each row execute function private.keep_an_active_program();

-- ---------------------------------------------------------------------------
-- 5. The programs' order (owners and head coaches; RLS on tracks decides).
-- ---------------------------------------------------------------------------

/** Puts the gym's programs in the order given: p_ids is every program of the gym, each once. */
create function public.reorder_programs(p_org uuid, p_ids uuid[])
returns void
language plpgsql security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from private.orgs_where_can_manage_tracks() o where o = p_org) then
    raise exception 'Only owners and head coaches order the programs' using errcode = 'insufficient_privilege';
  end if;
  if (select array_agg(t.id order by t.id) from public.tracks t where t.org_id = p_org)
     is distinct from (select array_agg(distinct id order by id) from unnest(p_ids) as id)
     or array_length(p_ids, 1) <> (select count(distinct id) from unnest(p_ids) as id) then
    raise exception 'Give every program of the gym once' using errcode = 'invalid_parameter_value';
  end if;
  update public.tracks t
     set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where t.id = o.id and t.org_id = p_org and t.position is distinct from o.ord - 1;
end;
$$;

revoke all on function public.reorder_programs(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_programs(uuid, uuid[]) to authenticated;
