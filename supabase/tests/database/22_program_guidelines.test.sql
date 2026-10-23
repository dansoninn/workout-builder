-- Guidelines per program (decision 5, 2026-10-23): a program uses the gym's
-- guidelines unless it has its own; owners and head coaches set them, always
-- well-formed; nobody else, and no other gym.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(10);

select has_column('public', 'tracks', 'guidelines', 'A program can have its own guidelines');
select is((select guidelines from public.tracks where id = tests.id('track_a')), null, 'By default it uses the gym''s');

select tests.login_as('head_a');
select isnt_empty($$ update public.tracks set guidelines = '{"monotonyMax": 2.5, "hardSetsPerWeek": {"hinge": 6}}' where id = tests.id('track_a') returning 1 $$,
  'A head coach gives a program its own');
select is((select guidelines -> 'hardSetsPerWeek' ->> 'hinge' from public.tracks where id = tests.id('track_a')), '6', 'They are kept on the program');
select throws_ok($$ update public.tracks set guidelines = '{"hardSetsPerWeek": {"deadlift": 4}}' where id = tests.id('track_a') $$,
  '23514', 'Unknown movement pattern "deadlift"', 'Checked like the gym''s');
select lives_ok($$ update public.tracks set guidelines = '{}' where id = tests.id('track_a') $$, 'An own set may have no guideline (no warnings)');

select tests.login_as('coach_a');
select is_empty($$ update public.tracks set guidelines = null where id = tests.id('track_a') returning 1 $$, 'A coach cannot change them');
select tests.login_as('owner_b');
select is_empty($$ update public.tracks set guidelines = null where id = tests.id('track_a') returning 1 $$, 'Nor another gym');

select tests.login_as('owner_a');
select isnt_empty($$ update public.tracks set guidelines = null where id = tests.id('track_a') returning 1 $$,
  'The owner puts the program back on the gym''s');
select is((select guidelines from public.tracks where id = tests.id('track_a')), null, 'and it uses the gym''s again');

select * from finish();
rollback;
