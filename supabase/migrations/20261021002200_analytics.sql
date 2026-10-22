-- Analytics (PLAN-step-5 5c, SPEC-data-model §7): the stored metrics of a
-- period, and the gym's own guidelines (calc spec §6: coach-configurable, not
-- scientific thresholds) in organizations.settings.guidelines, owner-managed.

-- ---------------------------------------------------------------------------
-- 1. Guidelines: their shape, checked whenever settings change. The app
--    mirrors it (src/lib/analytics/guidelines.ts); src/lib/workout/rule-cases.ts
--    holds the cases both are tested on.
-- ---------------------------------------------------------------------------

/** What is wrong with a gym's guidelines; NULL when nothing is. Every guideline is optional. */
create function private.guidelines_problem(p jsonb)
returns text
language plpgsql stable
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
  v_ratio text;
  v_number numeric;
begin
  if jsonb_typeof(p) is distinct from 'object' then
    return 'Guidelines are a set of named values';
  end if;
  if (p - array['hardSetsPerWeek', 'pushPull', 'kneeHip', 'upperLower', 'monotonyMax', 'weekIncreaseMaxPercent']) <> '{}'::jsonb then
    return 'Unknown guideline';
  end if;

  if p ? 'hardSetsPerWeek' then
    if jsonb_typeof(p -> 'hardSetsPerWeek') <> 'object' then
      return 'Hard sets per week are per movement pattern';
    end if;
    for v_key, v_value in select key, value from jsonb_each(p -> 'hardSetsPerWeek') loop
      if not exists (select 1 from public.movement_patterns m where m.key = v_key) then
        return format('Unknown movement pattern "%s"', v_key);
      end if;
      if jsonb_typeof(v_value) <> 'number' or v_value::numeric <= 0 or v_value::numeric > 200 then
        return 'Hard sets per week are a number above 0';
      end if;
    end loop;
  end if;

  foreach v_ratio in array array['pushPull', 'kneeHip', 'upperLower'] loop
    if not p ? v_ratio then continue; end if;
    v_value := p -> v_ratio;
    if jsonb_typeof(v_value) <> 'object' or (v_value - array['min', 'max']) <> '{}'::jsonb then
      return 'A ratio guideline is a lowest and a highest';
    end if;
    for v_key in select key from jsonb_each(v_value) loop
      if jsonb_typeof(v_value -> v_key) <> 'number' or (v_value ->> v_key)::numeric <= 0 or (v_value ->> v_key)::numeric > 100 then
        return 'A ratio is a number above 0';
      end if;
    end loop;
    if v_value ? 'min' and v_value ? 'max' and (v_value ->> 'min')::numeric > (v_value ->> 'max')::numeric then
      return 'The lowest must not be above the highest';
    end if;
  end loop;

  if p ? 'monotonyMax' then
    if jsonb_typeof(p -> 'monotonyMax') <> 'number' then return 'Monotony is a number'; end if;
    v_number := (p ->> 'monotonyMax')::numeric;
    if v_number <= 0 or v_number > 10 then return 'Monotony is above 0 and at most 10'; end if;
  end if;
  if p ? 'weekIncreaseMaxPercent' then
    if jsonb_typeof(p -> 'weekIncreaseMaxPercent') <> 'number' then return 'The increase is a number'; end if;
    v_number := (p ->> 'weekIncreaseMaxPercent')::numeric;
    if v_number <= 0 or v_number > 500 then return 'The increase is above 0 and at most 500 %'; end if;
  end if;
  return null;
end;
$$;

create function private.check_guidelines()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_problem text;
begin
  if new.settings ? 'guidelines' then
    v_problem := private.guidelines_problem(new.settings -> 'guidelines');
    if v_problem is not null then
      raise exception '%', v_problem using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger organizations_guidelines_valid
  before insert or update of settings on public.organizations
  for each row execute function private.check_guidelines();

/**
 * Replaces the gym's guidelines ('{}' removes them). Runs as the signed-in
 * user: only the owner may change gym settings (RLS), anyone else is refused.
 */
create function public.set_gym_guidelines(p_org uuid, p_guidelines jsonb)
returns void
language plpgsql security invoker
set search_path = ''
as $$
begin
  update public.organizations o
     set settings = case when p_guidelines = '{}'::jsonb then o.settings - 'guidelines'
                         else jsonb_set(o.settings, '{guidelines}', p_guidelines) end
   where o.id = p_org;
  if not found then
    raise exception 'Only the owner sets the gym''s guidelines' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function public.set_gym_guidelines(uuid, jsonb) from public, anon;
grant execute on function public.set_gym_guidelines(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. A period's stored metrics
-- ---------------------------------------------------------------------------

/**
 * The scheduled, not deleted workouts from p_from to p_to (one track, or all)
 * with their stored metrics of calc version p_calc_version. Runs as the
 * signed-in user, so a member sees only their own gym. The app sums the
 * lenses with the engine's own code.
 */
create function public.period_metrics(p_org uuid, p_from date, p_to date, p_calc_version int, p_track uuid default null)
returns table (workout_id uuid, date date, track_id uuid, title text, metrics jsonb)
language sql stable security invoker
set search_path = ''
as $$
  select w.id, w.date, w.track_id, w.title, m.metrics
    from public.workouts w
    join public.workout_metrics m on m.workout_id = w.id and m.calc_version = p_calc_version
   where w.org_id = p_org
     and w.kind = 'scheduled'
     and w.deleted_at is null
     and w.date between p_from and p_to
     and (p_track is null or w.track_id = p_track)
   order by w.date, w.created_at
$$;

revoke all on function public.period_metrics(uuid, date, date, int, uuid) from public, anon;
grant execute on function public.period_metrics(uuid, date, date, int, uuid) to authenticated;
