-- Core exercises (org_id NULL) and everything hanging off them are read-only
-- for every tenant role. Tested with the head coach and owner, the roles
-- that can edit their own gym's bank.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(27);

select tests.login_as('head_a');

-- Readable
select isnt_empty($$ select 1 from public.exercises where id = tests.id('core_squat') $$,
  'Head coach can read a core exercise');
select isnt_empty($$ select 1 from public.exercise_patterns where exercise_id = tests.id('core_squat') $$,
  '... its pattern weights');
select isnt_empty($$ select 1 from public.exercise_muscles where exercise_id = tests.id('core_squat') $$,
  '... its muscles');
select isnt_empty($$ select 1 from public.exercise_equipment where exercise_id = tests.id('core_squat') $$,
  '... its equipment');
select isnt_empty($$ select 1 from public.exercise_aliases where id = tests.id('alias_core') $$,
  '... and core aliases');

-- Not writable
select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, default_unit)
  values (null, 'New core', 'new-core', 'movement', 'reps')
$$, '42501', null, 'Head coach cannot add a core exercise');
select is_empty($$ update public.exercises set name = 'hacked' where id = tests.id('core_squat') returning 1 $$,
  'Head coach cannot rename a core exercise');
select is_empty($$ update public.exercises set org_id = tests.id('gym_a') where id = tests.id('core_squat') returning 1 $$,
  'Head coach cannot claim a core exercise for their gym');
select is_empty($$ update public.exercises set deleted_at = now() where id = tests.id('core_squat') returning 1 $$,
  'Head coach cannot soft-delete a core exercise');
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('core_squat'), 'hinge', 0.50)
$$, '42501', null, 'Head coach cannot add a pattern to a core exercise');
select is_empty($$ update public.exercise_patterns set weight = 0.50 where exercise_id = tests.id('core_squat') returning 1 $$,
  'Head coach cannot change core pattern weights');
select is_empty($$ delete from public.exercise_patterns where exercise_id = tests.id('core_squat') returning 1 $$,
  'Head coach cannot remove core pattern weights');
select throws_ok($$
  insert into public.exercise_muscles (exercise_id, muscle_key, role) values (tests.id('core_squat'), 'hamstrings', 'secondary')
$$, '42501', null, 'Head coach cannot add a muscle to a core exercise');
select is_empty($$ delete from public.exercise_muscles where exercise_id = tests.id('core_squat') returning 1 $$,
  'Head coach cannot remove core muscles');
select throws_ok($$
  insert into public.exercise_equipment (exercise_id, equipment_key) values (tests.id('core_wallball'), 'fixture_kb')
$$, '42501', null, 'Head coach cannot tag equipment on a core exercise');
select is_empty($$ delete from public.exercise_equipment where exercise_id = tests.id('core_squat') returning 1 $$,
  'Head coach cannot remove core equipment');
select throws_ok($$
  insert into public.exercise_aliases (org_id, alias_normalized, exercise_id) values (null, 'squatty', tests.id('core_squat'))
$$, '42501', null, 'Head coach cannot add a core alias');
select is_empty($$ update public.exercise_aliases set alias_normalized = 'hacked' where id = tests.id('alias_core') returning 1 $$,
  'Head coach cannot change a core alias');
select is_empty($$ delete from public.exercise_aliases where id = tests.id('alias_core') returning 1 $$,
  'Head coach cannot delete a core alias');

select tests.login_as('owner_a');

select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, default_unit)
  values (null, 'New core', 'new-core', 'movement', 'reps')
$$, '42501', null, 'Owner cannot add a core exercise either');
select is_empty($$ update public.exercises set name = 'hacked' where id = tests.id('core_squat') returning 1 $$,
  'Owner cannot rename a core exercise either');

-- Gyms can build on the core library
select tests.login_as('head_a');
select lives_ok($$
  insert into public.exercise_aliases (org_id, alias_normalized, exercise_id)
  values (tests.id('gym_a'), 'back sq', tests.id('core_squat'))
$$, 'A gym alias may point at a core exercise');

select tests.login_as('coach_a');
select lives_ok($$
  insert into public.block_items (block_id, org_id, position, exercise_id, raw_line, quantity)
  values (tests.id('block_a'), tests.id('gym_a'), 2, tests.id('core_wallball'), '20 wall balls', '{"type": "reps", "value": 20}')
$$, 'A gym workout may use a core exercise');

-- Core library unchanged, and core aliases can only point at core exercises
select tests.logout();

select results_eq($$ select name from public.exercises where id = tests.id('core_squat') $$,
  array['Fixture back squat'], 'Core exercise name unchanged');
select results_eq($$ select pattern_key || ' ' || weight from public.exercise_patterns where exercise_id = tests.id('core_squat') $$,
  array['squat 1.00'], 'Core pattern weights unchanged');
select results_eq($$ select count(*) from public.exercise_aliases where org_id is null $$,
  array[1::bigint], 'No core aliases added');
select throws_ok($$
  insert into public.exercise_aliases (org_id, alias_normalized, exercise_id) values (null, 'gym only', tests.id('ex_a'))
$$, '23514', null, 'A core alias cannot point at a gym exercise');

select * from finish();
rollback;
