-- Men/women amounts (calc spec decision 17, approved 2026-10-22): "15/12 cal"
-- and "400/300 m" keep every amount in `rx`; the first is the one every
-- calculation uses (calories: min = max = rx[0]; distance: value = rx[0]).
-- Same shape in the app (src/lib/workout/rules.ts), tested on the shared cases.

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
