-- Tenancy and access (SPEC-data-model §3).
--
-- The customer is a gym (organization). Users belong to gyms through
-- memberships with a role. Every tenant table carries org_id and is isolated
-- by RLS using the access helpers defined here.

create type public.org_role as enum ('owner', 'head_coach', 'coach', 'viewer');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  country text check (country ~ '^[A-Z]{2}$'),
  settings jsonb not null default '{}' check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now()
);

comment on column public.organizations.country is 'ISO 3166-1 alpha-2 code, e.g. IS.';
comment on column public.organizations.settings is 'Gym settings: pace defaults, warning thresholds, units.';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'en' check (locale in ('is', 'en')),
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

-- Parallel programming streams within a gym (Class, Strength club, ...).
create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create index tracks_org_id_idx on public.tracks (org_id);

-- ---------------------------------------------------------------------------
-- Access helpers: the role matrix in one place.
--
--                               owner  head_coach  coach  viewer
--   Manage members & settings     ✓
--   Edit gym exercise bank        ✓        ✓
--   Create / edit workouts        ✓        ✓         ✓
--   Read everything in the gym    ✓        ✓         ✓       ✓
--
-- Each returns the organizations where the signed-in user has that right.
-- Policies use them as `org_id in (select private.<fn>())`, which Postgres
-- evaluates once per query. SECURITY DEFINER lets them read memberships
-- without recursing into memberships' own RLS.
-- ---------------------------------------------------------------------------

create function private.orgs_where_can_read()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = auth.uid()
$$;

create function private.orgs_where_can_program()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = auth.uid() and m.role in ('owner', 'head_coach', 'coach')
$$;

create function private.orgs_where_can_edit_bank()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = auth.uid() and m.role in ('owner', 'head_coach')
$$;

create function private.orgs_where_can_manage()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = auth.uid() and m.role = 'owner'
$$;

-- Users who share at least one gym with the signed-in user (incl. themselves).
create function private.colleague_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select distinct theirs.user_id
  from public.memberships mine
  join public.memberships theirs on theirs.org_id = mine.org_id
  where mine.user_id = auth.uid()
$$;

grant execute on function
  private.orgs_where_can_read(),
  private.orgs_where_can_program(),
  private.orgs_where_can_edit_bank(),
  private.orgs_where_can_manage(),
  private.colleague_ids()
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profiles are created automatically when a user signs up.
-- Optional sign-up metadata: display_name (or full_name), locale ('is'/'en').
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    nullif(btrim(coalesce(meta ->> 'display_name', meta ->> 'full_name', '')), ''),
    case when meta ->> 'locale' in ('is', 'en') then meta ->> 'locale' else 'en' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- A gym must always keep at least one owner. Skipped when the organization
-- itself is being deleted (memberships then go with it).
-- ---------------------------------------------------------------------------

create function private.keep_last_owner()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.organizations o where o.id = old.org_id)
     and not exists (
       select 1 from public.memberships m
       where m.org_id = old.org_id and m.role = 'owner' and m.user_id <> old.user_id
     )
  then
    raise exception 'A gym must keep at least one owner'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_keep_last_owner
  before update or delete on public.memberships
  for each row execute function private.keep_last_owner();

create trigger memberships_pin_keys
  before update on public.memberships
  for each row execute function private.forbid_column_change('org_id', 'user_id');

create trigger tracks_pin_org
  before update on public.tracks
  for each row execute function private.forbid_column_change('org_id');

-- ---------------------------------------------------------------------------
-- Creating a gym: the signed-in user becomes its first owner, atomically.
-- Organizations cannot be inserted directly through the API.
-- ---------------------------------------------------------------------------

create function public.create_organization(p_name text, p_slug text, p_country text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
begin
  if v_user is null then
    raise exception 'Must be signed in to create a gym'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.organizations (name, slug, country)
  values (p_name, p_slug, p_country)
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org, v_user, 'owner');

  return v_org;
end;
$$;

revoke execute on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.tracks enable row level security;

-- organizations
create policy "Members can read their gyms"
  on public.organizations for select to authenticated
  using (id in (select private.orgs_where_can_read()));

create policy "Owners can update gym settings"
  on public.organizations for update to authenticated
  using (id in (select private.orgs_where_can_manage()))
  with check (id in (select private.orgs_where_can_manage()));

-- profiles
create policy "Users can read their own and colleagues' profiles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select private.colleague_ids()));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- memberships
create policy "Members can read their gym's memberships"
  on public.memberships for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));

create policy "Owners can add members"
  on public.memberships for insert to authenticated
  with check (org_id in (select private.orgs_where_can_manage()));

create policy "Owners can change member roles"
  on public.memberships for update to authenticated
  using (org_id in (select private.orgs_where_can_manage()))
  with check (org_id in (select private.orgs_where_can_manage()));

create policy "Owners can remove members"
  on public.memberships for delete to authenticated
  using (org_id in (select private.orgs_where_can_manage()));

-- tracks: gym-level setup, managed by owners; archived, never deleted.
create policy "Members can read their gym's tracks"
  on public.tracks for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));

create policy "Owners can create tracks"
  on public.tracks for insert to authenticated
  with check (org_id in (select private.orgs_where_can_manage()));

create policy "Owners can edit tracks"
  on public.tracks for update to authenticated
  using (org_id in (select private.orgs_where_can_manage()))
  with check (org_id in (select private.orgs_where_can_manage()));

-- Table privileges (defence in depth on top of RLS). anon gets nothing.
revoke all on table public.organizations, public.profiles, public.memberships, public.tracks
  from anon, authenticated;
grant select, update on table public.organizations to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.memberships to authenticated;
grant select, insert, update on table public.tracks to authenticated;
grant all on table public.organizations, public.profiles, public.memberships, public.tracks
  to service_role;
