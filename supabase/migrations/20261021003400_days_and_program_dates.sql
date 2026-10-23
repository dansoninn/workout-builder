-- Days on the calendar (Daniel's list of 2026-10-23, item 4; BACKLOG
-- "Programs & calendar"):
--   1. Programs with start and end dates: seasonal programs (Afrek's Þrek and
--      Liðleiki ran January to May). History is kept: a workout outside its
--      program's dates stays, and the app says so.
--   2. Day focus: the gym's own list of focuses (PP, Squat, DL, Oly / Core,
--      Mix, Partner), and each program's focus for a day. Set ahead of the
--      workouts, so it lives on the day, not on a workout.
--   3. Calendar days: public holidays (a country's preset, added by the gym)
--      and the gym's own closed days, each editable.

-- ---------------------------------------------------------------------------
-- 1. Program dates
-- ---------------------------------------------------------------------------

alter table public.tracks
  add column starts_on date,
  add column ends_on date,
  add constraint tracks_dates_in_order check (starts_on is null or ends_on is null or ends_on >= starts_on);

comment on column public.tracks.starts_on is 'First day the program runs (NULL: from the start).';
comment on column public.tracks.ends_on is 'Last day the program runs (NULL: no end). Workouts outside the dates are kept.';

-- ---------------------------------------------------------------------------
-- 2. Day focus
-- ---------------------------------------------------------------------------

create table public.day_focuses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 40),
  color text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

comment on table public.day_focuses is 'A gym''s day focuses (PP, Squat, Mix …): its own list, ordered, archived not deleted.';

create unique index day_focuses_active_name_key on public.day_focuses (org_id, lower(btrim(name))) where archived_at is null;
create index day_focuses_org_id_idx on public.day_focuses (org_id);

create trigger day_focuses_pin_keys
  before update on public.day_focuses
  for each row execute function private.forbid_column_change('org_id');

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  track_id uuid not null,
  date date not null,
  focus_id uuid not null,
  unique (track_id, date),
  foreign key (track_id, org_id) references public.tracks (id, org_id) on delete cascade,
  foreign key (focus_id, org_id) references public.day_focuses (id, org_id)
);

comment on table public.program_days is 'A program''s focus for a day. One per program and day.';

create index program_days_org_date_idx on public.program_days (org_id, date);
create index program_days_focus_id_idx on public.program_days (focus_id);

create trigger program_days_pin_keys
  before update on public.program_days
  for each row execute function private.forbid_column_change('org_id', 'track_id', 'date');

/** An archived focus is kept on the days that have it, but not given to a day again. */
create function private.forbid_archived_focus()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.focus_id is distinct from old.focus_id)
     and exists (select 1 from public.day_focuses f where f.id = new.focus_id and f.archived_at is not null) then
    raise exception 'This day focus is archived' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger program_days_focus_not_archived
  before insert or update on public.program_days
  for each row execute function private.forbid_archived_focus();

-- ---------------------------------------------------------------------------
-- 3. Calendar days: holidays and closed days
-- ---------------------------------------------------------------------------

create table public.calendar_days (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  date date not null,
  name text not null check (btrim(name) <> '' and char_length(name) <= 80),
  -- A holiday the gym is open on stays on the calendar with its name.
  closed boolean not null default true,
  -- The country preset a holiday came from ('IS'); NULL for the gym's own days.
  holiday_of text check (holiday_of ~ '^[A-Z]{2}$'),
  unique (org_id, date)
);

comment on table public.calendar_days is 'Holidays and closed days on a gym''s calendar. One per gym and day.';

create trigger calendar_days_pin_keys
  before update on public.calendar_days
  for each row execute function private.forbid_column_change('org_id');

-- ---------------------------------------------------------------------------
-- Access: every member reads; owners and head coaches keep the gym's lists
-- (focuses, closed days, like programs); coaches set a program's day focus,
-- as they program.
-- ---------------------------------------------------------------------------

alter table public.day_focuses enable row level security;
alter table public.program_days enable row level security;
alter table public.calendar_days enable row level security;

create policy "Members read the gym's day focuses"
  on public.day_focuses for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));
create policy "Owners and head coaches add day focuses"
  on public.day_focuses for insert to authenticated
  with check (org_id in (select private.orgs_where_can_manage_tracks()));
create policy "Owners and head coaches edit day focuses"
  on public.day_focuses for update to authenticated
  using (org_id in (select private.orgs_where_can_manage_tracks()))
  with check (org_id in (select private.orgs_where_can_manage_tracks()));

create policy "Members read the programs' day focus"
  on public.program_days for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));
create policy "Coaches set a day's focus"
  on public.program_days for insert to authenticated
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches change a day's focus"
  on public.program_days for update to authenticated
  using (org_id in (select private.orgs_where_can_program()))
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches clear a day's focus"
  on public.program_days for delete to authenticated
  using (org_id in (select private.orgs_where_can_program()));

create policy "Members read the gym's calendar days"
  on public.calendar_days for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));
create policy "Owners and head coaches add calendar days"
  on public.calendar_days for insert to authenticated
  with check (org_id in (select private.orgs_where_can_manage_tracks()));
create policy "Owners and head coaches edit calendar days"
  on public.calendar_days for update to authenticated
  using (org_id in (select private.orgs_where_can_manage_tracks()))
  with check (org_id in (select private.orgs_where_can_manage_tracks()));
create policy "Owners and head coaches remove calendar days"
  on public.calendar_days for delete to authenticated
  using (org_id in (select private.orgs_where_can_manage_tracks()));

revoke all on table public.day_focuses, public.program_days, public.calendar_days from anon, authenticated;
grant select, insert, update on table public.day_focuses to authenticated;
grant select, insert, update, delete on table public.program_days, public.calendar_days to authenticated;
grant all on table public.day_focuses, public.program_days, public.calendar_days to service_role;

-- Programming tables keep an audit log.
create trigger day_focuses_audit
  after insert or update or delete on public.day_focuses
  for each row execute function private.write_audit_log();
create trigger program_days_audit
  after insert or update or delete on public.program_days
  for each row execute function private.write_audit_log();
create trigger calendar_days_audit
  after insert or update or delete on public.calendar_days
  for each row execute function private.write_audit_log();
