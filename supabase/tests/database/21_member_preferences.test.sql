-- A member's own preferences (decision 3, 2026-10-23: the calendar remembers
-- each person's last program): private to that member, only in their own
-- gyms, only with their gym's programs.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(13);

select has_table('public', 'member_preferences', 'member_preferences exists');

select tests.login_as('coach_a');
select lives_ok($$ insert into public.member_preferences (org_id, calendar_program_id) values (tests.id('gym_a'), tests.id('track_a')) $$,
  'A coach keeps the calendar''s program');
select is((select user_id from public.member_preferences where org_id = tests.id('gym_a')), tests.id('coach_a'), 'as their own');
select lives_ok(
  $$ insert into public.member_preferences (org_id, calendar_all_programs) values (tests.id('gym_a'), true)
     on conflict (org_id, user_id) do update set calendar_program_id = null, calendar_all_programs = true $$,
  'and changes it to all programs');
select throws_ok(
  $$ update public.member_preferences set calendar_program_id = tests.id('track_a') where org_id = tests.id('gym_a') $$,
  '23514', null, 'One program or all, not both');
select throws_ok(
  $$ update public.member_preferences set calendar_all_programs = false, calendar_program_id = tests.id('track_b') where org_id = tests.id('gym_a') $$,
  '23503', null, 'Only the gym''s own programs');
select throws_ok($$ insert into public.member_preferences (org_id, user_id) values (tests.id('gym_a'), tests.id('viewer_a')) $$,
  '42501', null, 'Not for someone else');
select throws_ok($$ insert into public.member_preferences (org_id) values (tests.id('gym_b')) $$,
  '42501', null, 'Not in a gym they do not belong to');
select throws_ok($$ update public.member_preferences set org_id = tests.id('gym_b') where org_id = tests.id('gym_a') $$,
  '23514', null, 'Nor moved to another gym');

-- Private: nobody else sees or changes them, not even the gym's owner.
select tests.login_as('owner_a');
select is_empty($$ select 1 from public.member_preferences where user_id = tests.id('coach_a') $$, 'The owner does not see a coach''s preferences');
select is_empty($$ update public.member_preferences set calendar_all_programs = false where user_id = tests.id('coach_a') returning 1 $$,
  'nor change them');
select tests.login_as('owner_b');
select is_empty($$ select 1 from public.member_preferences $$, 'Another gym sees nothing');

-- They go with the membership.
select tests.logout();
delete from public.memberships where org_id = tests.id('gym_a') and user_id = tests.id('coach_a');
select is_empty($$ select 1 from public.member_preferences where user_id = tests.id('coach_a') $$, 'Leaving the gym removes them');

select * from finish();
rollback;
