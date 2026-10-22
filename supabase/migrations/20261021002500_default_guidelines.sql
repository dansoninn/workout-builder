-- Default guidelines for a new gym (calc spec decision 18, approved
-- 2026-10-22): labelled in the app as the gym's guidelines, not science, and
-- the owner changes them in Settings → Guidelines. Existing gyms keep theirs.
-- The app holds the same values (src/lib/analytics/guidelines.ts, DEFAULT_GUIDELINES).

create function private.default_guidelines()
returns jsonb
language sql immutable
set search_path = ''
as $$
  select '{
    "hardSetsPerWeek": {"squat": 4, "hinge": 4, "h_push": 3, "h_pull": 3, "v_push": 2, "v_pull": 3},
    "pushPull": {"min": 0.8, "max": 1.2},
    "kneeHip": {"min": 0.7, "max": 1.5},
    "monotonyMax": 2,
    "weekIncreaseMaxPercent": 15
  }'::jsonb
$$;

create function private.set_default_guidelines()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.settings ? 'guidelines' then
    new.settings := new.settings || jsonb_build_object('guidelines', private.default_guidelines());
  end if;
  return new;
end;
$$;

-- Runs before organizations_guidelines_valid (triggers fire in name order), so the defaults are checked too.
create trigger organizations_default_guidelines
  before insert on public.organizations
  for each row execute function private.set_default_guidelines();
