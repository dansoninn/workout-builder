-- Analytics per program (Daniel's decision 4, 2026-10-23): one program by
-- default; several only when the coach selects them, always named; never
-- mixed silently. period_metrics now takes the programs asked for, and no
-- longer has an "everything" default: the app always says which programs.

drop function public.period_metrics(uuid, date, date, int, uuid);

/**
 * A period's scheduled workouts in the given programs, with their stored
 * metrics for one calc version, in date order. Runs as the signed-in user, so
 * a member sees only their own gym. The app sums the lenses with the
 * engine's own code.
 */
create function public.period_metrics(p_org uuid, p_from date, p_to date, p_calc_version int, p_tracks uuid[])
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
     and w.track_id = any (p_tracks)
   order by w.date, w.created_at
$$;

revoke all on function public.period_metrics(uuid, date, date, int, uuid[]) from public, anon;
grant execute on function public.period_metrics(uuid, date, date, int, uuid[]) to authenticated;
