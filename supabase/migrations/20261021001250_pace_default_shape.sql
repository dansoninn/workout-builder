-- Pace shape (calc spec §9.5, data model §5), checked before the approved
-- core paces are seeded. A pace is an object with one or more of
-- sec_per_rep, sec_per_m, sec_per_cal, each a positive number. The same
-- shape is used for gym overrides in organizations.settings.paces.

create function private.pace_is_valid(p jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
begin
  if p is null then
    return true;
  end if;
  if jsonb_typeof(p) is distinct from 'object' or p = '{}'::jsonb then
    return false;
  end if;
  for v_key, v_value in select key, value from jsonb_each(p) loop
    if v_key not in ('sec_per_rep', 'sec_per_m', 'sec_per_cal') then
      return false;
    end if;
    if jsonb_typeof(v_value) is distinct from 'number' or v_value::numeric <= 0 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- CHECK constraints run as the writing user.
grant execute on function private.pace_is_valid(jsonb) to authenticated, service_role;

alter table public.exercises drop constraint exercises_pace_default_check;
alter table public.exercises
  add constraint exercises_pace_default_shape check (private.pace_is_valid(pace_default));
