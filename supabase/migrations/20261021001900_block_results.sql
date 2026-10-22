-- Block results (SPEC-data-model §6, PLAN-step-4 4d): what the GROUP did in
-- an AMRAP or For Time block, logged by a coach after class. Not per athlete.
-- Several rows per block are allowed: the same workout runs in several
-- classes. Stored only; comparing planned with logged and calibrating paces
-- come later (BACKLOG), and a result never changes a pace by itself.

-- ---------------------------------------------------------------------------
-- 1. The rule, in one place (the app mirrors it in src/lib/workout/results.ts;
--    src/lib/workout/rule-cases.ts holds the cases both sides are tested on).
-- ---------------------------------------------------------------------------

/**
 * What is wrong with a result for a block of this format and params, in words
 * for a coach; NULL when nothing is. AMRAP results are rounds (decimals for a
 * partial round), For Time results are finish times in whole seconds; both
 * are a range for the group, lowest first. Anyone capped counts as the cap.
 */
create function private.block_result_problem(
  p_format public.block_format,
  p_params jsonb,
  p_rounds_low numeric,
  p_rounds_high numeric,
  p_finish_low_s int,
  p_finish_high_s int
)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_cap int := (p_params ->> 'time_cap_s')::int;
begin
  if p_format not in ('amrap', 'for_time') then
    return 'Results are logged for AMRAP and For time blocks';
  end if;
  if (p_rounds_low is null) <> (p_rounds_high is null) or (p_finish_low_s is null) <> (p_finish_high_s is null) then
    return 'Give the lowest and the highest, or the same number twice';
  end if;

  if p_format = 'amrap' then
    if p_rounds_low is null or p_finish_low_s is not null then
      return 'An AMRAP result is the rounds the group reached';
    end if;
    if p_rounds_low < 0 or p_rounds_high >= 1000 then
      return 'Check the rounds';
    end if;
    if p_rounds_low <> round(p_rounds_low, 2) or p_rounds_high <> round(p_rounds_high, 2) then
      return 'Use at most two decimals, e.g. 7.5';
    end if;
    if p_rounds_low > p_rounds_high then
      return 'Fewest rounds must not be more than most rounds';
    end if;
    return null;
  end if;

  if p_finish_low_s is null or p_rounds_low is not null then
    return 'A For time result is the finish times';
  end if;
  if p_finish_low_s < 1 or p_finish_high_s > 86400 then
    return 'Check the finish time';
  end if;
  if p_finish_low_s > p_finish_high_s then
    return 'The fastest finish must not be slower than the slowest';
  end if;
  if v_cap is not null and p_finish_high_s > v_cap then
    return 'No finish can be over the time cap; anyone capped counts as the cap';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. The table
-- ---------------------------------------------------------------------------

create table public.block_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  block_id uuid not null,
  session_label text check (session_label = btrim(session_label) and length(session_label) between 1 and 40),
  rounds_low numeric,
  rounds_high numeric,
  finish_low_s int,
  finish_high_s int,
  note text check (note = btrim(note) and length(note) between 1 and 2000),
  logged_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint block_results_block_same_gym
    foreign key (block_id, org_id) references public.blocks (id, org_id) on delete cascade,
  -- The shape, whatever the block (the full rule is checked by the trigger below).
  constraint block_results_one_measure
    check ((rounds_low is null and rounds_high is null) <> (finish_low_s is null and finish_high_s is null)),
  constraint block_results_rounds_order check (rounds_low <= rounds_high),
  constraint block_results_finish_order check (finish_low_s <= finish_high_s)
);

comment on table public.block_results is
  'What the group did in an AMRAP or For Time block, per class (SPEC-data-model 6). Soft delete.';
comment on column public.block_results.session_label is 'Which class, e.g. "06:00". Optional.';
comment on column public.block_results.rounds_low is 'AMRAP: rounds the group reached, low-high; decimals for a partial round.';
comment on column public.block_results.finish_low_s is 'For Time: finish times, low-high, in seconds; anyone capped counts as the cap.';

create index block_results_block_id_idx on public.block_results (block_id);
create index block_results_org_id_idx on public.block_results (org_id);

/** Checks a result against its block (and that it is on a scheduled workout); keeps the bookkeeping. */
create function private.check_block_result()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_format public.block_format;
  v_params jsonb;
  v_kind public.workout_kind;
  v_problem text;
begin
  select b.format, b.params, w.kind
    into v_format, v_params, v_kind
    from public.blocks b
    join public.workouts w on w.id = b.workout_id
   where b.id = new.block_id and b.org_id = new.org_id;
  if not found then
    raise exception 'The block does not exist' using errcode = 'foreign_key_violation';
  end if;
  if v_kind <> 'scheduled' then
    raise exception 'Results are logged on workouts in the calendar, not on templates' using errcode = 'check_violation';
  end if;

  v_problem := private.block_result_problem(
    v_format, v_params, new.rounds_low, new.rounds_high, new.finish_low_s, new.finish_high_s);
  if v_problem is not null then
    raise exception '%', v_problem using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    new.logged_by := coalesce(auth.uid(), new.logged_by);
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger block_results_check
  before insert or update on public.block_results
  for each row execute function private.check_block_result();

create trigger block_results_pin
  before update on public.block_results
  for each row execute function private.forbid_column_change('org_id', 'block_id', 'logged_by', 'created_at');

create trigger block_results_audit
  after insert or update or delete on public.block_results
  for each row execute function private.write_audit_log();

-- ---------------------------------------------------------------------------
-- 3. A block with results keeps them: it cannot be removed or change format
--    while live (not deleted) results point at it. Removing a whole workout is
--    a soft delete, so its results stay; hard deletes that cascade from a
--    workout or a gym (pg_trigger_depth() > 1) go through.
-- ---------------------------------------------------------------------------

create function private.keep_block_results()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 or (tg_op = 'UPDATE' and new.format = old.format) then
    return coalesce(new, old);
  end if;
  if exists (select 1 from public.block_results r where r.block_id = old.id and r.deleted_at is null) then
    if tg_op = 'DELETE' then
      raise exception 'Block % has results logged for it. Remove those results first, or keep the block.', old.label
        using errcode = 'check_violation';
    end if;
    raise exception 'Block % has results logged for it, so its format must stay %. Remove those results first.',
      old.label, case old.format when 'amrap' then 'AMRAP' else 'For time' end
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger blocks_keep_results
  before update of format or delete on public.blocks
  for each row execute function private.keep_block_results();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security: everyone in the gym reads; owner, head coach and
--    coach log and edit. Results are soft-deleted (deleted_at), never removed.
-- ---------------------------------------------------------------------------

alter table public.block_results enable row level security;

create policy "Members can read their gym's results"
  on public.block_results for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));
create policy "Coaches can log results"
  on public.block_results for insert to authenticated
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches can edit results"
  on public.block_results for update to authenticated
  using (org_id in (select private.orgs_where_can_program()))
  with check (org_id in (select private.orgs_where_can_program()));

revoke all on table public.block_results from anon, authenticated;
grant select, insert, update on table public.block_results to authenticated;
grant all on table public.block_results to service_role;
