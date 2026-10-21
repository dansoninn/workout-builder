-- Step 4a: invitations, the member list, and reserved gym addresses.
--
-- An owner invites someone by email with a role and shares the resulting
-- link (automatic emails come with a custom email sender, see BACKLOG). Only a
-- signed-in user with that confirmed email can accept it, once, within 14
-- days. Only a SHA-256 hash of the link's secret is stored, so the database
-- never holds a usable link.
--
-- Not audited: the audit log is readable by every member, and invitations
-- hold the invitee's email, which only owners may see. Accepting creates a
-- membership, and memberships are audited.

-- ---------------------------------------------------------------------------
-- Gym addresses: the gym slug is the first part of every app URL
-- (/afrek/builder), so it must not collide with the app's own routes.
-- ---------------------------------------------------------------------------

alter table public.organizations
  add constraint organizations_slug_not_reserved check (slug not in (
    'about', 'account', 'admin', 'api', 'app', 'assets', 'auth', 'billing', 'blog',
    'dashboard', 'design', 'docs', 'forgot-password', 'gyms', 'help', 'invite', 'join',
    'login', 'logout', 'new', 'onboarding', 'pricing', 'privacy', 'public', 'reset-password',
    'settings', 'sign-in', 'sign-out', 'sign-up', 'signin', 'signup', 'static', 'status',
    'support', 'terms', 'www'
  ));

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.org_role not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  constraint invitations_one_outcome check (accepted_at is null or revoked_at is null)
);

comment on table public.invitations is 'Invitations to join a gym. Only the SHA-256 hash of the link secret is stored.';

-- At most one open invitation per email and gym; a new one replaces it.
create unique index invitations_one_open_per_email
  on public.invitations (org_id, email)
  where accepted_at is null and revoked_at is null;
create index invitations_org_id_idx on public.invitations (org_id);

create function private.hash_token(p_token text)
returns text
language sql immutable
set search_path = ''
as $$ select encode(extensions.digest(p_token, 'sha256'), 'hex') $$;

/**
 * Owner creates (or renews) an invitation and receives the link secret once.
 * Any open invitation for the same email in this gym is cancelled.
 */
create function public.create_invitation(p_org uuid, p_email text, p_role public.org_role)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text;
begin
  if not exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role = 'owner'
  ) then
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

/**
 * What the join page shows for a link: the gym, the role, the invited email
 * and whether it is still open. Anyone holding the link may see this (it is
 * the link's secret that grants it), signed in or not.
 */
create function public.invitation_preview(p_token text)
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
  join public.organizations o on o.id = i.org_id
  where i.token_hash = private.hash_token(p_token)
$$;

/** The signed-in user joins the gym with the invited role. Returns the gym's slug. */
create function public.accept_invitation(p_token text)
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

  select * into v_invitation from public.invitations
  where token_hash = private.hash_token(p_token)
  for update;

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

/** Members of a gym the caller belongs to. Emails are shown to owners only. */
create function public.list_gym_members(p_org uuid)
returns table (user_id uuid, display_name text, email text, role public.org_role, joined_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select m.user_id, p.display_name,
    case when exists (
      select 1 from public.memberships me
      where me.org_id = p_org and me.user_id = auth.uid() and me.role = 'owner'
    ) then u.email::text end,
    m.role, m.created_at
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org
    and exists (select 1 from public.memberships me where me.org_id = p_org and me.user_id = auth.uid())
  order by array_position(array['owner', 'head_coach', 'coach', 'viewer']::public.org_role[], m.role),
    lower(coalesce(p.display_name, u.email::text))
$$;

revoke execute on function
  public.create_invitation(uuid, text, public.org_role),
  public.invitation_preview(text),
  public.accept_invitation(text),
  public.list_gym_members(uuid)
  from public, anon;
grant execute on function
  public.create_invitation(uuid, text, public.org_role),
  public.invitation_preview(text),
  public.accept_invitation(text),
  public.list_gym_members(uuid)
  to authenticated, service_role;
grant execute on function public.invitation_preview(text) to anon;

create trigger invitations_pin_org
  before update on public.invitations
  for each row execute function private.forbid_column_change('org_id', 'email', 'role', 'token_hash');

-- RLS: owners see and cancel their gym's invitations; creating and accepting
-- go through the functions above.
alter table public.invitations enable row level security;

create policy "Owners can read their gym's invitations"
  on public.invitations for select to authenticated
  using (org_id in (select private.orgs_where_can_manage()));

create policy "Owners can cancel invitations"
  on public.invitations for update to authenticated
  using (org_id in (select private.orgs_where_can_manage()))
  with check (org_id in (select private.orgs_where_can_manage()));

revoke all on table public.invitations from anon, authenticated;
grant select on table public.invitations to authenticated;
grant update (revoked_at) on table public.invitations to authenticated;
grant all on table public.invitations to service_role;
