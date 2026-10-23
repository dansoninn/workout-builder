-- Days on the calendar (item 4 of Daniel's list, 2026-10-23): program dates,
-- the gym's day focuses and each program's focus for a day, holidays and
-- closed days. Who may change what, and never across gyms.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(30);

insert into tests.ids (name) select unnest(array['squat_a', 'mix_a', 'squat_b', 'day_a', 'track_a2']);
insert into public.day_focuses (id, org_id, name, position) values
  (tests.id('squat_a'), tests.id('gym_a'), 'Squat', 1),
  (tests.id('mix_a'), tests.id('gym_a'), 'Mix', 2),
  (tests.id('squat_b'), tests.id('gym_b'), 'Squat', 1);
insert into public.tracks (id, org_id, name, position) values (tests.id('track_a2'), tests.id('gym_a'), 'Strength', 2);

-- 1. Program dates
select tests.login_as('head_a');
select lives_ok($$ update public.tracks set starts_on = '2026-01-05', ends_on = '2026-05-31' where id = tests.id('track_a2') $$,
  'A head coach gives a program its dates');
select throws_ok($$ update public.tracks set ends_on = '2026-01-01' where id = tests.id('track_a2') $$,
  '23514', null, 'The end is not before the start');
select tests.login_as('coach_a');
update public.tracks set ends_on = null where id = tests.id('track_a2');
select is((select ends_on from public.tracks where id = tests.id('track_a2')), '2026-05-31'::date, 'A coach cannot change them');

-- 2. Day focuses: the gym's own list
select tests.login_as('viewer_a');
select is((select count(*)::int from public.day_focuses), 2, 'Every member reads the gym''s day focuses, and only its own');
select tests.login_as('coach_a');
select throws_ok($$ insert into public.day_focuses (org_id, name) values (tests.id('gym_a'), 'Oly / Core') $$,
  '42501', null, 'A coach does not add to the list');
select tests.login_as('head_a');
select lives_ok($$ insert into public.day_focuses (org_id, name, position) values (tests.id('gym_a'), 'Oly / Core', 3) $$, 'A head coach does');
select throws_ok($$ insert into public.day_focuses (org_id, name) values (tests.id('gym_a'), ' squat ') $$,
  '23505', null, 'Names are unique among the gym''s active focuses');
select throws_ok($$ insert into public.day_focuses (org_id, name) values (tests.id('gym_b'), 'Partner') $$,
  '42501', null, 'Not in another gym');
select throws_ok($$ delete from public.day_focuses where id = tests.id('mix_a') $$, '42501', null, 'Focuses are archived, never deleted');

-- 3. A program's focus for a day
select tests.login_as('coach_a');
select lives_ok($$ insert into public.program_days (id, org_id, track_id, date, focus_id) values
  (tests.id('day_a'), tests.id('gym_a'), tests.id('track_a'), '2026-10-26', tests.id('squat_a')) $$, 'A coach sets a day''s focus');
select throws_ok($$ insert into public.program_days (org_id, track_id, date, focus_id) values
  (tests.id('gym_a'), tests.id('track_a'), '2026-10-26', tests.id('mix_a')) $$, '23505', null, 'One focus per program and day');
select lives_ok($$ insert into public.program_days (org_id, track_id, date, focus_id) values
  (tests.id('gym_a'), tests.id('track_a2'), '2026-10-26', tests.id('mix_a')) $$, 'Another program has its own focus that day');
select lives_ok($$ update public.program_days set focus_id = tests.id('mix_a') where id = tests.id('day_a') $$, 'and changes it');
select throws_ok($$ update public.program_days set date = '2026-10-27' where id = tests.id('day_a') $$,
  '23514', 'program_days.date cannot be changed', 'The day and program of a focus stay (clear it and set another)');
select throws_ok($$ insert into public.program_days (org_id, track_id, date, focus_id) values
  (tests.id('gym_a'), tests.id('track_a'), '2026-10-28', tests.id('squat_b')) $$, '23503', null, 'Never another gym''s focus');
select throws_ok($$ insert into public.program_days (org_id, track_id, date, focus_id) values
  (tests.id('gym_a'), tests.id('track_b'), '2026-10-28', tests.id('squat_a')) $$, '23503', null, 'nor another gym''s program');
select throws_ok($$ insert into public.program_days (org_id, track_id, date, focus_id) values
  (tests.id('gym_b'), tests.id('track_b'), '2026-10-28', tests.id('squat_b')) $$, '42501', null, 'nor in another gym at all');
select tests.login_as('viewer_a');
select throws_ok($$ insert into public.program_days (org_id, track_id, date, focus_id) values
  (tests.id('gym_a'), tests.id('track_a'), '2026-10-29', tests.id('squat_a')) $$, '42501', null, 'A viewer does not set a focus');
select tests.login_as('head_a');
update public.day_focuses set archived_at = now() where id = tests.id('squat_a');
select throws_ok($$ insert into public.program_days (org_id, track_id, date, focus_id) values
  (tests.id('gym_a'), tests.id('track_a'), '2026-10-30', tests.id('squat_a')) $$, '23514', 'This day focus is archived', 'An archived focus is not given to a day');
select lives_ok($$ insert into public.day_focuses (org_id, name) values (tests.id('gym_a'), 'Squat') $$, 'and its name is free again');
select tests.login_as('coach_a');
select lives_ok($$ delete from public.program_days where id = tests.id('day_a') $$, 'A coach clears a day''s focus');

-- 4. Holidays and closed days
select tests.login_as('owner_a');
select lives_ok($$ insert into public.calendar_days (org_id, date, name, holiday_of) values
  (tests.id('gym_a'), '2026-12-25', 'Christmas Day', 'IS'), (tests.id('gym_a'), '2026-06-17', 'National Day', 'IS') $$,
  'An owner adds the country''s holidays');
select lives_ok($$ update public.calendar_days set closed = false where date = '2026-06-17' $$, 'and keeps one open');
select throws_ok($$ insert into public.calendar_days (org_id, date, name) values (tests.id('gym_a'), '2026-12-25', 'Closed') $$,
  '23505', null, 'One entry per day');
select tests.login_as('coach_a');
select is((select count(*)::int from public.calendar_days), 2, 'Every member sees them');
select throws_ok($$ insert into public.calendar_days (org_id, date, name) values (tests.id('gym_a'), '2026-08-01', 'Team day') $$,
  '42501', null, 'A coach does not add closed days');
select is_empty($$ delete from public.calendar_days returning 1 $$, 'nor removes them');
select tests.login_as('owner_b');
select is((select count(*)::int from public.calendar_days), 0, 'Another gym sees none of them');
select is_empty($$ update public.calendar_days set closed = false returning 1 $$, 'nor changes them');

-- Every change is in the audit log.
select tests.logout();
select is(
  (select array_agg(distinct table_name order by table_name) from public.audit_log where org_id = tests.id('gym_a') and table_name in ('day_focuses', 'program_days', 'calendar_days')),
  array['calendar_days', 'day_focuses', 'program_days']::text[],
  'Focuses, days and closed days are audited');

select * from finish();
rollback;
