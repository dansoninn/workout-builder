-- A member's own choices in a gym, kept across devices (Daniel's decision 3,
-- 2026-10-23): the program the calendar shows, or all of them. Only the
-- member reads and writes their own row; nobody else, not even the owner.

create table public.member_preferences (
  org_id uuid not null,
  user_id uuid not null default auth.uid(),
  -- The calendar shows one program, or all programs; neither set means the gym's first program.
  calendar_program_id uuid,
  calendar_all_programs boolean not null default false,
  primary key (org_id, user_id),
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade,
  foreign key (calendar_program_id, org_id) references public.tracks (id, org_id),
  check (not (calendar_all_programs and calendar_program_id is not null))
);

comment on table public.member_preferences is 'A member''s own choices in a gym (the calendar''s program). Private to that member.';

create trigger member_preferences_pin_keys
  before update on public.member_preferences
  for each row execute function private.forbid_column_change('org_id', 'user_id');

alter table public.member_preferences enable row level security;

create policy "Members read their own preferences"
  on public.member_preferences for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members keep their own preferences"
  on public.member_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and org_id in (select private.orgs_where_can_read()));

create policy "Members change their own preferences"
  on public.member_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and org_id in (select private.orgs_where_can_read()));

revoke all on table public.member_preferences from anon, authenticated;
grant select, insert, update on table public.member_preferences to authenticated;
grant all on table public.member_preferences to service_role;
