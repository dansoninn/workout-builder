-- Step 4a answers for 4b (Daniel, 2026-10-21):
--   * Alternating EMOM ("minute 1: X, minute 2: Y …") is an option of the
--     `every` format, not stations: params { interval_s, rounds, alternating }.
--     The lines take turns, one per interval.
--   * Rest between blocks is stored per block (the rest after it), shown in
--     the session length on the calendar, and never counted in planned load.

-- Same rules as before, plus the optional `alternating` flag on `every`.
create or replace function private.block_params_valid(p_format public.block_format, p jsonb)
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

alter table public.blocks
  add column rest_after_s integer check (rest_after_s >= 0);

comment on column public.blocks.rest_after_s is
  'Rest after this block, before the next, in seconds. Part of the session length; never part of planned load.';
