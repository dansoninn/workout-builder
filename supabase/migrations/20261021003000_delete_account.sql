-- Deleting your own account (PLAN-step-6 6c). What a person wrote stays with
-- the gym; their name comes off it (the foreign keys to profiles are ON DELETE
-- SET NULL) and the app shows "a former member". Taking a name off is not an
-- edit: it leaves "last edited" times alone, writes no audit entry, and is the
-- one way a pinned column (who logged a result) may become empty.

-- ---------------------------------------------------------------------------
-- 1. Recognising "a deleted account's name came off this row".
-- ---------------------------------------------------------------------------

/**
 * True when the only change from old to new is people's names coming off the
 * row because their accounts were deleted: person columns set to NULL whose
 * profile no longer exists (updated_at aside). SECURITY DEFINER so it sees
 * every profile, not only the signed-in user's colleagues.
 */
create function private.only_names_removed(p_old jsonb, p_new jsonb)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  with changed as (
    select o.key, o.value
      from jsonb_each(p_old) as o
     where o.value is distinct from p_new -> o.key
       and o.key <> 'updated_at'
  )
  select exists (select 1 from changed)
     and not exists (
       select 1 from changed c
        where not (
          c.key in ('created_by', 'updated_by', 'logged_by', 'invited_by', 'accepted_by')
          and p_new -> c.key = 'null'::jsonb
          and jsonb_typeof(c.value) = 'string'
          and not exists (select 1 from public.profiles p where p.id = (c.value #>> '{}')::uuid)))
$$;

-- ---------------------------------------------------------------------------
-- 2. The triggers that stamp, pin or log changes let that through untouched.
-- ---------------------------------------------------------------------------

create or replace function private.forbid_column_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text;
begin
  -- A deleted account's name coming off the row is the one change allowed.
  if private.only_names_removed(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
  foreach col in array tg_argv loop
    if (to_jsonb(old) -> col) is distinct from (to_jsonb(new) -> col) then
      raise exception '%.% cannot be changed', tg_table_name, col
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.only_names_removed(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.set_workout_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.only_names_removed(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create or replace function private.set_pace_override_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.only_names_removed(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create or replace function private.check_block_result()
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
  if tg_op = 'UPDATE' and private.only_names_removed(to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;

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

create or replace function private.write_audit_log()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_id_column text := coalesce(tg_argv[0], 'id');
  v_diff jsonb;
begin
  if tg_op = 'INSERT' then
    v_diff := jsonb_build_object('new', v_new);
  elsif tg_op = 'DELETE' then
    v_diff := jsonb_build_object('old', v_old);
  else
    -- A deleted account's name coming off the row is not an edit.
    if private.only_names_removed(v_old, v_new) then
      return null;
    end if;
    select jsonb_build_object(
             'old', coalesce(jsonb_object_agg(o.key, o.value), '{}'::jsonb),
             'new', coalesce(jsonb_object_agg(o.key, v_new -> o.key), '{}'::jsonb))
      into v_diff
      from jsonb_each(v_old) as o
     where o.value is distinct from v_new -> o.key
       and o.key not in ('updated_at', 'updated_by');

    -- Nothing but bookkeeping changed: not worth a log entry.
    if v_diff -> 'old' = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.audit_log (org_id, actor_id, table_name, row_id, action, diff)
  values (
    (v_row ->> 'org_id')::uuid,
    auth.uid(),
    tg_table_name,
    (v_row ->> v_id_column)::uuid,
    lower(tg_op)::public.audit_action,
    v_diff
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Deleting your own account.
-- ---------------------------------------------------------------------------

/**
 * Deletes the signed-in person's account: sign-in, profile and memberships.
 * Their workouts, results and names stay with each gym, attributed to no one.
 * Refused while they are the only owner of a gym (someone else must be made
 * owner first, or the gym deleted), so no gym is ever left without an owner.
 */
create function public.delete_my_account()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_gyms text;
begin
  if v_user is null then
    raise exception 'Sign in to delete your account' using errcode = 'insufficient_privilege';
  end if;
  select string_agg(o.name, ', ' order by o.name) into v_gyms
    from public.memberships m
    join public.organizations o on o.id = m.org_id
   where m.user_id = v_user and m.role = 'owner'
     and not exists (select 1 from public.memberships x where x.org_id = m.org_id and x.role = 'owner' and x.user_id <> v_user);
  if v_gyms is not null then
    raise exception 'You are the only owner of %. Make someone else an owner there first, or delete the gym.', v_gyms
      using errcode = 'check_violation';
  end if;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
