-- Step 4a answer (Daniel, 2026-10-21): a new gym starts with one track,
-- "Class". Owners and head coaches can rename or archive it like any track.

create or replace function public.create_organization(p_name text, p_slug text, p_country text default null)
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

  -- Indigo, the first of the app's track colours (src/lib/tracks.ts).
  insert into public.tracks (org_id, name, color, position)
  values (v_org, 'Class', '#5B5FD6', 0);

  return v_org;
end;
$$;

-- Gyms created before this change that have no track at all get one too.
insert into public.tracks (org_id, name, color, position)
select o.id, 'Class', '#5B5FD6', 0
from public.organizations o
where not exists (select 1 from public.tracks t where t.org_id = o.id);
