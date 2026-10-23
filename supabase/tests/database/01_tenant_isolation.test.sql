-- A user in gym A can never read or write gym B (and vice versa).
-- Tested with gym A's owner, the strongest role, so weaker roles are covered.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(59);

-- ---------------------------------------------------------------------------
-- Reads: nothing of gym B is visible
-- ---------------------------------------------------------------------------
select tests.login_as('owner_a');

select results_eq($$ select id from public.organizations $$,
  array[tests.id('gym_a')], 'A owner sees only gym A');
select is_empty($$ select 1 from public.memberships where org_id = tests.id('gym_b') $$,
  'A owner cannot see gym B memberships');
select is_empty($$ select 1 from public.profiles where id in (tests.id('owner_b'), tests.id('coach_b'), tests.id('outsider')) $$,
  'A owner cannot see profiles of people outside gym A');
select is_empty($$ select 1 from public.tracks where org_id = tests.id('gym_b') $$,
  'A owner cannot see gym B tracks');
select is_empty($$ select 1 from public.exercises where id = tests.id('ex_b') $$,
  'A owner cannot see gym B exercises');
select is_empty($$ select 1 from public.exercise_patterns where exercise_id = tests.id('ex_b') $$,
  'A owner cannot see gym B exercise patterns');
select is_empty($$ select 1 from public.exercise_muscles where exercise_id = tests.id('ex_b') $$,
  'A owner cannot see gym B exercise muscles');
select is_empty($$ select 1 from public.exercise_equipment where exercise_id = tests.id('ex_b') $$,
  'A owner cannot see gym B exercise equipment');
select is_empty($$ select 1 from public.exercise_aliases where id = tests.id('alias_b') $$,
  'A owner cannot see gym B aliases');
select is_empty($$ select 1 from public.workouts where org_id = tests.id('gym_b') $$,
  'A owner cannot see gym B workouts');
select is_empty($$ select 1 from public.blocks where org_id = tests.id('gym_b') $$,
  'A owner cannot see gym B blocks');
select is_empty($$ select 1 from public.block_items where org_id = tests.id('gym_b') $$,
  'A owner cannot see gym B block items');
select is_empty($$ select 1 from public.workout_metrics where org_id = tests.id('gym_b') $$,
  'A owner cannot see gym B metrics');
select is_empty($$ select 1 from public.audit_log where org_id = tests.id('gym_b') $$,
  'A owner cannot see gym B audit log');

select isnt_empty($$ select 1 from public.workouts where org_id = tests.id('gym_a') $$,
  'control: A owner does see gym A workouts');
select isnt_empty($$ select 1 from public.audit_log where org_id = tests.id('gym_a') $$,
  'control: A owner does see gym A audit log');

-- ---------------------------------------------------------------------------
-- Inserts into gym B are rejected
-- ---------------------------------------------------------------------------
select throws_ok($$
  insert into public.workouts (org_id, track_id, kind, date) values (tests.id('gym_b'), tests.id('track_b'), 'scheduled', '2026-10-21')
$$, '42501', null, 'A owner cannot create a workout in gym B');

select throws_ok($$
  insert into public.tracks (org_id, name) values (tests.id('gym_b'), 'Sneaky')
$$, '42501', null, 'A owner cannot create a track in gym B');

select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, default_unit)
  values (tests.id('gym_b'), 'Sneaky', 'sneaky', 'movement', 'reps')
$$, '42501', null, 'A owner cannot add an exercise to gym B');

select throws_ok($$
  insert into public.exercise_aliases (org_id, alias_normalized, exercise_id)
  values (tests.id('gym_b'), 'sneaky', tests.id('core_squat'))
$$, '42501', null, 'A owner cannot add an alias to gym B');

select throws_ok($$
  insert into public.memberships (org_id, user_id, role) values (tests.id('gym_b'), tests.id('owner_a'), 'owner')
$$, '42501', null, 'A owner cannot make themselves a member of gym B');

select throws_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_b'), tests.id('gym_b'), 1, 'B', 'skill', 'amrap', '{"time_s": 300}')
$$, '42501', null, 'A owner cannot add a block to a gym B workout');

select throws_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_b'), tests.id('gym_a'), 1, 'B', 'skill', 'amrap', '{"time_s": 300}')
$$, '23503', null, 'A owner cannot attach a block to a gym B workout by labelling it gym A');

select throws_ok($$
  insert into public.block_items (block_id, org_id, position, raw_line, quantity)
  values (tests.id('block_b'), tests.id('gym_a'), 1, 'x', '{"type": "reps", "value": 1}')
$$, '23503', null, 'A owner cannot attach an item to a gym B block by labelling it gym A');

select throws_ok($$
  insert into public.block_items (block_id, org_id, position, exercise_id, raw_line, quantity)
  values (tests.id('block_a'), tests.id('gym_a'), 2, tests.id('ex_b'), 'x', '{"type": "reps", "value": 1}')
$$, '23514', null, 'A owner cannot use a gym B exercise in a gym A workout');

select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('ex_b'), 'core', 0.50)
$$, '42501', null, 'A owner cannot change pattern weights of a gym B exercise');

select throws_ok($$
  insert into public.exercise_equipment (exercise_id, equipment_key) values (tests.id('ex_b'), 'kettlebell')
$$, '42501', null, 'A owner cannot change equipment of a gym B exercise');

select throws_ok($$
  insert into public.workout_metrics (workout_id, org_id, calc_version, taxonomy_version, metrics)
  values (tests.id('workout_b'), tests.id('gym_b'), 2, 1, '{}')
$$, '42501', null, 'A owner cannot write gym B metrics');

-- ---------------------------------------------------------------------------
-- Updates and deletes of gym B rows touch nothing
-- ---------------------------------------------------------------------------
select is_empty($$ update public.workouts set title = 'hacked' where id = tests.id('workout_b') returning 1 $$,
  'A owner cannot edit a gym B workout');
select is_empty($$ update public.organizations set name = 'hacked' where id = tests.id('gym_b') returning 1 $$,
  'A owner cannot edit gym B settings');
select is_empty($$ update public.memberships set role = 'viewer' where org_id = tests.id('gym_b') returning 1 $$,
  'A owner cannot change gym B roles');
select is_empty($$ update public.exercises set name = 'hacked' where id = tests.id('ex_b') returning 1 $$,
  'A owner cannot edit a gym B exercise');
select is_empty($$ update public.block_items set raw_line = 'hacked' where org_id = tests.id('gym_b') returning 1 $$,
  'A owner cannot edit gym B block items');
select is_empty($$ update public.profiles set display_name = 'hacked' where id = tests.id('owner_b') returning 1 $$,
  'A owner cannot edit a gym B user''s profile');
select is_empty($$ delete from public.blocks where org_id = tests.id('gym_b') returning 1 $$,
  'A owner cannot delete gym B blocks');
select is_empty($$ delete from public.block_items where org_id = tests.id('gym_b') returning 1 $$,
  'A owner cannot delete gym B block items');
select is_empty($$ delete from public.memberships where org_id = tests.id('gym_b') returning 1 $$,
  'A owner cannot remove gym B members');
select is_empty($$ delete from public.exercise_aliases where id = tests.id('alias_b') returning 1 $$,
  'A owner cannot delete gym B aliases');
select is_empty($$ delete from public.workout_metrics where org_id = tests.id('gym_b') returning 1 $$,
  'A owner cannot delete gym B metrics');

-- Rows cannot be moved between gyms
select throws_ok($$ update public.workouts set org_id = tests.id('gym_b') where id = tests.id('workout_a') $$,
  '23514', null, 'A workout cannot be moved to another gym');
select throws_ok($$ update public.block_items set exercise_id = tests.id('ex_b') where id = tests.id('item_a_matched') $$,
  '23514', null, 'A gym A item cannot be re-pointed at a gym B exercise');

-- ---------------------------------------------------------------------------
-- The other direction: gym B's coach sees and writes nothing of gym A
-- ---------------------------------------------------------------------------
select tests.login_as('coach_b');

select is_empty($$ select 1 from public.workouts where org_id = tests.id('gym_a') $$,
  'B coach cannot see gym A workouts');
select throws_ok($$
  insert into public.workouts (org_id, track_id, kind, date) values (tests.id('gym_a'), tests.id('track_a'), 'scheduled', '2026-10-21')
$$, '42501', null, 'B coach cannot create a workout in gym A');

-- ---------------------------------------------------------------------------
-- A signed-in user with no gym sees only shared reference data
-- ---------------------------------------------------------------------------
select tests.login_as('outsider');

select is_empty($$ select 1 from public.organizations $$, 'Outsider sees no gyms');
select is_empty($$ select 1 from public.workouts $$, 'Outsider sees no workouts');
select is_empty($$ select 1 from public.exercises where org_id is not null $$, 'Outsider sees no gym exercises');
select isnt_empty($$ select 1 from public.exercises where id = tests.id('core_squat') $$, 'Outsider can read the core library');
select isnt_empty($$ select 1 from public.movement_patterns $$, 'Outsider can read the taxonomy');

select lives_ok($$ select public.create_organization('Outsider Gym', 'outsider-gym', 'IS') $$,
  'A signed-in user can create a gym');
select results_eq($$ select m.role::text from public.memberships m join public.organizations o on o.id = m.org_id
                     where o.slug = 'outsider-gym' $$,
  array['owner'], '... and becomes its owner');

-- ---------------------------------------------------------------------------
-- Visitors who are not signed in get nothing at all
-- ---------------------------------------------------------------------------
select tests.login_anon();

select throws_ok($$ select 1 from public.movement_patterns $$, '42501', null, 'Anonymous cannot read the taxonomy');
select throws_ok($$ select 1 from public.equipment $$, '42501', null, 'Anonymous cannot read the equipment list');
select throws_ok($$ select 1 from public.exercises $$, '42501', null, 'Anonymous cannot read exercises');
select throws_ok($$ select 1 from public.organizations $$, '42501', null, 'Anonymous cannot read gyms');
select throws_ok($$ select public.create_organization('Anon Gym', 'anon-gym') $$, '42501', null, 'Anonymous cannot create a gym');

-- ---------------------------------------------------------------------------
-- Gym B's data is exactly as before
-- ---------------------------------------------------------------------------
select tests.logout();

select results_eq($$ select title from public.workouts where id = tests.id('workout_b') $$,
  array['B day'], 'Gym B workout title unchanged');
select results_eq($$ select name from public.organizations where id = tests.id('gym_b') $$,
  array['Gym B'], 'Gym B name unchanged');
select results_eq($$
  select (select count(*) from public.memberships where org_id = tests.id('gym_b'))
       + (select count(*) from public.blocks where org_id = tests.id('gym_b'))
       + (select count(*) from public.block_items where org_id = tests.id('gym_b'))
       + (select count(*) from public.exercise_aliases where org_id = tests.id('gym_b'))
       + (select count(*) from public.workout_metrics where org_id = tests.id('gym_b'))
$$, array[6::bigint], 'Gym B rows all still there (2 members, 1 block, 1 item, 1 alias, 1 metrics row)');

-- Guard for the future: every table in the API schema must have RLS on.
select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
$$, 'Every table in the public schema has Row Level Security enabled');

select * from finish();
rollback;
