-- Deleting a gym (PLAN-step-6 6c). An owner deletes it: it disappears for
-- everyone at once. For 30 days its owners can bring it back; after that a
-- nightly job erases it for good, with everything in it and its audit log.

alter table public.organizations
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;

comment on column public.organizations.deleted_at is
  'When an owner deleted the gym. Hidden from everyone at once; erased for good 30 days later (private.erase_deleted_gyms).';

-- ---------------------------------------------------------------------------
-- 1. A deleted gym gives no one any right: every policy goes through these.
-- ---------------------------------------------------------------------------

create or replace function private.orgs_where_can_read()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  join public.organizations o on o.id = m.org_id and o.deleted_at is null
  where m.user_id = auth.uid()
$$;

create or replace function private.orgs_where_can_program()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  join public.organizations o on o.id = m.org_id and o.deleted_at is null
  where m.user_id = auth.uid() and m.role in ('owner', 'head_coach', 'coach')
$$;

create or replace function private.orgs_where_can_edit_bank()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  join public.organizations o on o.id = m.org_id and o.deleted_at is null
  where m.user_id = auth.uid() and m.role in ('owner', 'head_coach')
$$;

create or replace function private.orgs_where_can_manage()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  join public.organizations o on o.id = m.org_id and o.deleted_at is null
  where m.user_id = auth.uid() and m.role = 'owner'
$$;

create or replace function private.orgs_where_can_manage_tracks()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  join public.organizations o on o.id = m.org_id and o.deleted_at is null
  where m.user_id = auth.uid() and m.role in ('owner', 'head_coach')
$$;

create or replace function private.colleague_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select distinct theirs.user_id
  from public.memberships mine
  join public.organizations o on o.id = mine.org_id and o.deleted_at is null
  join public.memberships theirs on theirs.org_id = mine.org_id
  where mine.user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- 2. Invitations and the member list, which check memberships themselves.
-- ---------------------------------------------------------------------------

create or replace function public.create_invitation(p_org uuid, p_email text, p_role public.org_role)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text;
begin
  if not exists (select 1 from private.orgs_where_can_manage() o where o = p_org) then
    raise exception 'Only the gym''s owners can invite members' using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.org_id = p_org and lower(u.email) = v_email
  ) then
    raise exception '% is already a member of this gym', v_email using errcode = 'unique_violation';
  end if;

  update public.invitations
  set revoked_at = now()
  where org_id = p_org and email = v_email and accepted_at is null and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invitations (org_id, email, role, token_hash)
  values (p_org, v_email, p_role, private.hash_token(v_token));
  return v_token;
end;
$$;

create or replace function public.invitation_preview(p_token text)
returns table (gym_name text, gym_slug text, role public.org_role, email text, status text, email_matches boolean)
language sql stable security definer
set search_path = ''
as $$
  select o.name, o.slug, i.role, i.email,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'cancelled'
      when i.expires_at <= now() then 'expired'
      else 'open'
    end,
    coalesce(i.email = (select lower(u.email) from auth.users u where u.id = auth.uid()), false)
  from public.invitations i
  join public.organizations o on o.id = i.org_id and o.deleted_at is null
  where i.token_hash = private.hash_token(p_token)
$$;

create or replace function public.accept_invitation(p_token text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_invitation public.invitations;
  v_slug text;
begin
  if v_user is null then
    raise exception 'Sign in to accept an invitation' using errcode = 'insufficient_privilege';
  end if;

  select i.* into v_invitation from public.invitations i
  join public.organizations o on o.id = i.org_id and o.deleted_at is null
  where i.token_hash = private.hash_token(p_token)
  for update of i;

  if not found then
    raise exception 'This invitation link is not valid' using errcode = 'invalid_parameter_value';
  end if;
  if v_invitation.accepted_at is not null then
    raise exception 'This invitation has already been used' using errcode = 'invalid_parameter_value';
  end if;
  if v_invitation.revoked_at is not null then
    raise exception 'This invitation was cancelled' using errcode = 'invalid_parameter_value';
  end if;
  if v_invitation.expires_at <= now() then
    raise exception 'This invitation has expired' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = v_user and lower(u.email) = v_invitation.email and u.email_confirmed_at is not null
  ) then
    raise exception 'This invitation is for another email address' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.memberships m where m.org_id = v_invitation.org_id and m.user_id = v_user) then
    raise exception 'You are already a member of this gym' using errcode = 'unique_violation';
  end if;

  insert into public.memberships (org_id, user_id, role) values (v_invitation.org_id, v_user, v_invitation.role);
  update public.invitations set accepted_at = now(), accepted_by = v_user where id = v_invitation.id;

  select o.slug into v_slug from public.organizations o where o.id = v_invitation.org_id;
  return v_slug;
end;
$$;

create or replace function public.list_gym_members(p_org uuid)
returns table (user_id uuid, display_name text, email text, role public.org_role, joined_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select m.user_id, p.display_name,
    case when exists (select 1 from private.orgs_where_can_manage() o where o = p_org) then u.email::text end,
    m.role, m.created_at
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org
    and exists (select 1 from private.orgs_where_can_read() o where o = p_org)
  order by array_position(array['owner', 'head_coach', 'coach', 'viewer']::public.org_role[], m.role),
    lower(coalesce(p.display_name, u.email::text))
$$;

-- ---------------------------------------------------------------------------
-- 3. Deleting, listing and bringing back a gym (its owners).
-- ---------------------------------------------------------------------------

/**
 * An owner deletes the gym, confirming with its name (any case). It is hidden
 * from everyone at once and its open invitations are cancelled; its owners can
 * bring it back for 30 days.
 */
create function public.delete_gym(p_org uuid, p_name text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from private.orgs_where_can_manage() o where o = p_org) then
    raise exception 'Only the gym''s owners can delete it' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_org and lower(o.name) = lower(btrim(p_name))) then
    raise exception 'Type the gym''s name to delete it' using errcode = 'invalid_parameter_value';
  end if;
  update public.organizations set deleted_at = now(), deleted_by = auth.uid() where id = p_org;
  update public.invitations set revoked_at = now()
   where org_id = p_org and accepted_at is null and revoked_at is null;
end;
$$;

/** The deleted gyms the signed-in person owns, and when each is erased for good. */
create function public.my_deleted_gyms()
returns table (id uuid, name text, slug text, deleted_at timestamptz, erased_after timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select o.id, o.name, o.slug, o.deleted_at, o.deleted_at + interval '30 days'
    from public.memberships m
    join public.organizations o on o.id = m.org_id
   where m.user_id = auth.uid() and m.role = 'owner' and o.deleted_at is not null
   order by o.deleted_at desc
$$;

/** An owner brings a deleted gym back, as it was (invitations stay cancelled). Returns its address. */
create function public.restore_gym(p_org uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  if not exists (select 1 from public.my_deleted_gyms() g where g.id = p_org) then
    raise exception 'Only an owner of a deleted gym can bring it back' using errcode = 'insufficient_privilege';
  end if;
  update public.organizations set deleted_at = null, deleted_by = null where id = p_org returning slug into v_slug;
  return v_slug;
end;
$$;

revoke all on function public.delete_gym(uuid, text), public.my_deleted_gyms(), public.restore_gym(uuid) from public, anon;
grant execute on function public.delete_gym(uuid, text), public.my_deleted_gyms(), public.restore_gym(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Erasing for good: the gym, everything in it, and its audit log.
-- ---------------------------------------------------------------------------

-- An erased gym's audit log goes with it: rows of a gym that no longer exists
-- are the only ones that may ever be deleted.
create or replace function private.forbid_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.org_id is not null and not exists (select 1 from public.organizations o where o.id = old.org_id) then
      return old;
    end if;
  end if;
  raise exception 'audit_log is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

-- Rows deleted along with an erased gym leave no audit entries behind.
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
  if (v_row ->> 'org_id') is not null
     and not exists (select 1 from public.organizations o where o.id = (v_row ->> 'org_id')::uuid) then
    return null;
  end if;
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

/** Erases one gym for good: the organization and, through its foreign keys, everything in it; then its audit log. */
create function private.erase_gym(p_org uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.organizations where id = p_org;
  delete from public.audit_log where org_id = p_org;
end;
$$;

/** The nightly job: erases every gym deleted more than 30 days ago. Returns how many. */
create function private.erase_deleted_gyms()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_count integer := 0;
begin
  for v_org in select o.id from public.organizations o where o.deleted_at < now() - interval '30 days' loop
    perform private.erase_gym(v_org);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function private.erase_gym(uuid), private.erase_deleted_gyms() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('erase-deleted-gyms', '17 3 * * *', 'select private.erase_deleted_gyms()');

-- ---------------------------------------------------------------------------
-- 5. Deleting your account: gyms you deleted and own alone go with you, since
--    no one else could bring them back.
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_gyms text;
  v_org uuid;
begin
  if v_user is null then
    raise exception 'Sign in to delete your account' using errcode = 'insufficient_privilege';
  end if;
  select string_agg(o.name, ', ' order by o.name) into v_gyms
    from public.memberships m
    join public.organizations o on o.id = m.org_id and o.deleted_at is null
   where m.user_id = v_user and m.role = 'owner'
     and not exists (select 1 from public.memberships x where x.org_id = m.org_id and x.role = 'owner' and x.user_id <> v_user);
  if v_gyms is not null then
    raise exception 'You are the only owner of %. Make someone else an owner there first, or delete the gym.', v_gyms
      using errcode = 'check_violation';
  end if;
  for v_org in
    select m.org_id from public.memberships m
      join public.organizations o on o.id = m.org_id and o.deleted_at is not null
     where m.user_id = v_user and m.role = 'owner'
       and not exists (select 1 from public.memberships x where x.org_id = m.org_id and x.role = 'owner' and x.user_id <> v_user)
  loop
    perform private.erase_gym(v_org);
  end loop;
  delete from auth.users where id = v_user;
end;
$$;
