-- The role matrix (SPEC-data-model §3), role by role, inside gym A:
--                               owner  head_coach  coach  viewer
--   Manage members & settings     ✓
--   Edit gym exercise bank        ✓        ✓
--   Create / edit workouts        ✓        ✓         ✓
--   Read everything in the gym    ✓        ✓         ✓       ✓
-- Tracks count as gym setup (owner only). Nobody hard-deletes workouts or
-- exercises; they are soft-deleted.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(56);

-- ---------------------------------------------------------------------------
-- Viewer: reads everything, writes nothing (except their own profile)
-- ---------------------------------------------------------------------------
select tests.login_as('viewer_a');

select isnt_empty($$ select 1 from public.workouts where org_id = tests.id('gym_a') $$, 'Viewer can read workouts');
select isnt_empty($$ select 1 from public.block_items where org_id = tests.id('gym_a') $$, 'Viewer can read block items');
select isnt_empty($$ select 1 from public.profiles where id = tests.id('owner_a') $$, 'Viewer can read colleagues'' profiles');

select throws_ok($$
  insert into public.workouts (org_id, kind, date) values (tests.id('gym_a'), 'scheduled', '2026-10-21')
$$, '42501', null, 'Viewer cannot create a workout');
select is_empty($$ update public.workouts set title = 'x' where id = tests.id('workout_a') returning 1 $$,
  'Viewer cannot edit a workout');
select throws_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_a'), tests.id('gym_a'), 1, 'B', 'skill', 'amrap', '{"time_s": 300}')
$$, '42501', null, 'Viewer cannot add a block');
select is_empty($$ update public.blocks set notes = 'x' where id = tests.id('block_a') returning 1 $$,
  'Viewer cannot edit a block');
select is_empty($$ delete from public.blocks where id = tests.id('block_a') returning 1 $$,
  'Viewer cannot delete a block');
select throws_ok($$
  insert into public.block_items (block_id, org_id, position, raw_line, quantity)
  values (tests.id('block_a'), tests.id('gym_a'), 5, 'x', '{"type": "reps", "value": 1}')
$$, '42501', null, 'Viewer cannot add a block item');
select is_empty($$ delete from public.block_items where id = tests.id('item_a_matched') returning 1 $$,
  'Viewer cannot delete a block item');
select throws_ok($$
  insert into public.workout_metrics (workout_id, org_id, calc_version, taxonomy_version, metrics)
  values (tests.id('workout_a'), tests.id('gym_a'), 2, 1, '{}')
$$, '42501', null, 'Viewer cannot write metrics');
select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, default_unit)
  values (tests.id('gym_a'), 'V', 'v', 'movement', 'reps')
$$, '42501', null, 'Viewer cannot add to the exercise bank');
select throws_ok($$
  insert into public.exercise_aliases (org_id, alias_normalized, exercise_id)
  values (tests.id('gym_a'), 'vee', tests.id('core_squat'))
$$, '42501', null, 'Viewer cannot add an alias');
select throws_ok($$ insert into public.tracks (org_id, name) values (tests.id('gym_a'), 'V') $$,
  '42501', null, 'Viewer cannot create a track');
select is_empty($$ update public.organizations set settings = '{"x": 1}' where id = tests.id('gym_a') returning 1 $$,
  'Viewer cannot change gym settings');
select throws_ok($$
  insert into public.memberships (org_id, user_id, role) values (tests.id('gym_a'), tests.id('outsider'), 'coach')
$$, '42501', null, 'Viewer cannot add members');
select isnt_empty($$ update public.profiles set display_name = 'Vee' where id = tests.id('viewer_a') returning 1 $$,
  'Viewer can edit their own profile');
select is_empty($$ update public.profiles set display_name = 'x' where id = tests.id('owner_a') returning 1 $$,
  'Viewer cannot edit a colleague''s profile');

-- ---------------------------------------------------------------------------
-- Coach: programs workouts, cannot touch the exercise bank, members or setup
-- ---------------------------------------------------------------------------
select tests.login_as('coach_a');

select lives_ok($$
  insert into public.workouts (org_id, kind, title) values (tests.id('gym_a'), 'template', 'Coach template')
$$, 'Coach can create a workout');
select isnt_empty($$ update public.workouts set title = 'Edited' where id = tests.id('workout_a') returning 1 $$,
  'Coach can edit a workout');
select lives_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_a'), tests.id('gym_a'), 1, 'B', 'conditioning', 'amrap', '{"time_s": 480}')
$$, 'Coach can add a block');
select lives_ok($$
  insert into public.block_items (block_id, org_id, position, exercise_id, raw_line, quantity)
  values (tests.id('block_a'), tests.id('gym_a'), 2, tests.id('ex_a'), '5 sandbag clean', '{"type": "reps", "value": 5}')
$$, 'Coach can add a block item using a gym exercise');
select isnt_empty($$ update public.workout_metrics set metrics = '{"x": 1}' where workout_id = tests.id('workout_a') returning 1 $$,
  'Coach can refresh metrics');

select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, default_unit)
  values (tests.id('gym_a'), 'C', 'c', 'movement', 'reps')
$$, '42501', null, 'Coach cannot add to the exercise bank');
select is_empty($$ update public.exercises set name = 'x' where id = tests.id('ex_a') returning 1 $$,
  'Coach cannot edit a gym exercise');
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('ex_a'), 'core', 0.50)
$$, '42501', null, 'Coach cannot add pattern weights');
select is_empty($$ update public.exercise_patterns set weight = 0.50 where exercise_id = tests.id('ex_a') returning 1 $$,
  'Coach cannot change pattern weights');
select is_empty($$ delete from public.exercise_patterns where exercise_id = tests.id('ex_a') returning 1 $$,
  'Coach cannot remove pattern weights');
select throws_ok($$
  insert into public.exercise_muscles (exercise_id, muscle_key, role) values (tests.id('ex_a'), 'hamstrings', 'secondary')
$$, '42501', null, 'Coach cannot add muscles to an exercise');
select throws_ok($$
  insert into public.exercise_aliases (org_id, alias_normalized, exercise_id)
  values (tests.id('gym_a'), 'cee', tests.id('core_squat'))
$$, '42501', null, 'Coach cannot add an alias');
select is_empty($$ delete from public.exercise_aliases where id = tests.id('alias_a') returning 1 $$,
  'Coach cannot delete an alias');
select throws_ok($$ insert into public.tracks (org_id, name) values (tests.id('gym_a'), 'C') $$,
  '42501', null, 'Coach cannot create a track');
select throws_ok($$
  insert into public.memberships (org_id, user_id, role) values (tests.id('gym_a'), tests.id('outsider'), 'coach')
$$, '42501', null, 'Coach cannot add members');
select is_empty($$ update public.memberships set role = 'owner' where user_id = tests.id('coach_a') returning 1 $$,
  'Coach cannot promote themselves');
select is_empty($$ update public.organizations set settings = '{"x": 1}' where id = tests.id('gym_a') returning 1 $$,
  'Coach cannot change gym settings');
select isnt_empty($$ update public.workouts set deleted_at = now() where id = tests.id('workout_a') returning 1 $$,
  'Coach can soft-delete a workout');

-- ---------------------------------------------------------------------------
-- Head coach: also edits the exercise bank; still no members or setup
-- ---------------------------------------------------------------------------
select tests.login_as('head_a');

select lives_ok($$
  insert into public.exercises (org_id, name, slug, kind, default_unit)
  values (tests.id('gym_a'), 'Head coach lunge', 'head-coach-lunge', 'movement', 'reps')
$$, 'Head coach can add a gym exercise');
select lives_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight)
  select id, 'lunge', 1.00 from public.exercises where slug = 'head-coach-lunge'
$$, 'Head coach can set its pattern weights');
select isnt_empty($$ update public.exercises set name = 'Gym A sandbag clean (edited)' where id = tests.id('ex_a') returning 1 $$,
  'Head coach can edit a gym exercise');
select lives_ok($$
  insert into public.exercise_aliases (org_id, alias_normalized, exercise_id)
  values (tests.id('gym_a'), 'sb clean', tests.id('ex_a'))
$$, 'Head coach can add an alias');
select lives_ok($$
  insert into public.workouts (org_id, kind, title) values (tests.id('gym_a'), 'template', 'Head coach template')
$$, 'Head coach can create a workout');
select throws_ok($$ insert into public.tracks (org_id, name) values (tests.id('gym_a'), 'H') $$,
  '42501', null, 'Head coach cannot create a track');
select throws_ok($$
  insert into public.memberships (org_id, user_id, role) values (tests.id('gym_a'), tests.id('outsider'), 'coach')
$$, '42501', null, 'Head coach cannot add members');
select is_empty($$ update public.organizations set settings = '{"x": 1}' where id = tests.id('gym_a') returning 1 $$,
  'Head coach cannot change gym settings');

-- ---------------------------------------------------------------------------
-- Owner: manages members, settings and tracks
-- ---------------------------------------------------------------------------
select tests.login_as('owner_a');

select isnt_empty($$ update public.organizations set settings = '{"units": "metric"}' where id = tests.id('gym_a') returning 1 $$,
  'Owner can change gym settings');
select lives_ok($$
  insert into public.memberships (org_id, user_id, role) values (tests.id('gym_a'), tests.id('outsider'), 'coach')
$$, 'Owner can add a member');
select isnt_empty($$ update public.memberships set role = 'head_coach' where user_id = tests.id('coach_a') and org_id = tests.id('gym_a') returning 1 $$,
  'Owner can change a member''s role');
select isnt_empty($$ delete from public.memberships where user_id = tests.id('viewer_a') and org_id = tests.id('gym_a') returning 1 $$,
  'Owner can remove a member');
select lives_ok($$ insert into public.tracks (org_id, name, color) values (tests.id('gym_a'), 'Strength club', '#DC2626') $$,
  'Owner can create a track');

-- Nobody hard-deletes programming or the library (soft delete only)
select throws_ok($$ delete from public.workouts where id = tests.id('workout_a') $$,
  '42501', null, 'Owner cannot hard-delete a workout');
select throws_ok($$ delete from public.exercises where id = tests.id('ex_a') $$,
  '42501', null, 'Owner cannot hard-delete an exercise');
select throws_ok($$ delete from public.tracks where id = tests.id('track_a') $$,
  '42501', null, 'Owner cannot hard-delete a track (archive instead)');
select throws_ok($$ delete from public.organizations where id = tests.id('gym_a') $$,
  '42501', null, 'Owner cannot delete the gym through the API');

-- A gym always keeps an owner
select throws_ok($$ update public.memberships set role = 'coach' where user_id = tests.id('owner_a') and org_id = tests.id('gym_a') $$,
  '23514', null, 'The only owner cannot step down');
select throws_ok($$ delete from public.memberships where user_id = tests.id('owner_a') and org_id = tests.id('gym_a') $$,
  '23514', null, 'The only owner cannot leave');
select lives_ok($$
  update public.memberships set role = 'owner' where user_id = tests.id('head_a') and org_id = tests.id('gym_a');
  update public.memberships set role = 'head_coach' where user_id = tests.id('owner_a') and org_id = tests.id('gym_a');
$$, 'Once there is a second owner, the first can step down');

select * from finish();
rollback;
