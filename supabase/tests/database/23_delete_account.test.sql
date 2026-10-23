-- Deleting your own account (PLAN-step-6 6c): the person's sign-in, profile
-- and memberships go; what they wrote stays with the gym with their name taken
-- off, without counting as an edit; nobody is left as a gym's only owner.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(17);

-- Coach A's traces in gym A: a workout they made and edited, a result they
-- logged, an exercise, a name for an exercise, a pace and a preference.
insert into tests.ids (name) select unnest(array['amrap', 'result', 'alias']);
update public.workouts set created_by = tests.id('coach_a'), updated_by = tests.id('coach_a') where id = tests.id('workout_a');
update public.exercises set created_by = tests.id('coach_a') where id = tests.id('ex_a');
insert into public.blocks (id, workout_id, org_id, position, label, intent, format, params, pace_effort) values
  (tests.id('amrap'), tests.id('workout_a'), tests.id('gym_a'), 1, 'B', 'conditioning', 'amrap', '{"time_s": 480}', 'hard');
insert into public.block_results (id, org_id, block_id, rounds_low, rounds_high, logged_by) values
  (tests.id('result'), tests.id('gym_a'), tests.id('amrap'), 6, 8, tests.id('coach_a'));
insert into public.exercise_aliases (id, org_id, alias_normalized, exercise_id, created_by) values
  (tests.id('alias'), tests.id('gym_a'), 'coras squat', tests.id('core_squat'), tests.id('coach_a'));
insert into public.exercise_pace_overrides (org_id, exercise_id, pace, updated_by) values
  (tests.id('gym_a'), tests.id('ex_a'), '{"sec_per_rep": 3}', tests.id('coach_a'));
insert into public.member_preferences (org_id, user_id, calendar_all_programs) values (tests.id('gym_a'), tests.id('coach_a'), true);
create temporary table snapshot as
  select (select updated_at from public.workouts where id = tests.id('workout_a')) as workout_at,
         (select updated_at from public.exercises where id = tests.id('ex_a')) as exercise_at,
         (select updated_at from public.block_results where id = tests.id('result')) as result_at,
         (select max(id) from public.audit_log) as last_audit;

select has_function('public', 'delete_my_account', array[]::text[], 'delete_my_account exists');

-- The only owner of a gym cannot leave it without an owner.
select tests.login_as('owner_a');
select throws_ok($$ select public.delete_my_account() $$, '23514',
  'You are the only owner of Gym A. Make someone else an owner there first, or delete the gym.',
  'The only owner of a gym is told what to do first');

select tests.login_as('coach_a');
select lives_ok($$ select public.delete_my_account() $$, 'A coach deletes their account');

select tests.logout();
select is_empty($$ select 1 from auth.users where id = tests.id('coach_a') $$, 'Their sign-in is gone');
select is_empty($$ select 1 from public.profiles where id = tests.id('coach_a') $$, 'and their profile (name)');
select is_empty($$ select 1 from public.memberships where user_id = tests.id('coach_a') $$, 'and their memberships');
select is_empty($$ select 1 from public.member_preferences where user_id = tests.id('coach_a') $$, 'and their preferences');

select results_eq(
  $$ select created_by, updated_by, updated_at = (select workout_at from snapshot) from public.workouts where id = tests.id('workout_a') $$,
  $$ values (null::uuid, null::uuid, true) $$,
  'Their workout stays, without their name, and is not marked as edited');
select results_eq(
  $$ select logged_by, updated_at = (select result_at from snapshot) from public.block_results where id = tests.id('result') $$,
  $$ values (null::uuid, true) $$,
  'Their logged result stays, logged by a former member');
select results_eq(
  $$ select created_by, updated_at = (select exercise_at from snapshot) from public.exercises where id = tests.id('ex_a') $$,
  $$ values (null::uuid, true) $$,
  'The exercise they made stays');
select is((select created_by from public.exercise_aliases where id = tests.id('alias')), null, 'and the name they gave an exercise');
select is((select updated_by from public.exercise_pace_overrides where exercise_id = tests.id('ex_a')), null, 'and the pace they set');
select results_eq(
  $$ select table_name, action::text from public.audit_log where id > (select last_audit from snapshot) order by id $$,
  $$ values ('memberships'::text, 'delete'::text) $$,
  'The audit log records them leaving the gym, and nothing else (taking a name off is not an edit)');

-- A taken-off name is the only way a pinned column may change.
select tests.login_as('head_a');
select throws_ok(
  $$ update public.block_results set logged_by = tests.id('head_a') where id = tests.id('result') $$,
  '23514', 'block_results.logged_by cannot be changed', 'Who logged a result still cannot be changed by hand');

-- With another owner, an owner may go.
select tests.logout();
update public.memberships set role = 'owner' where org_id = tests.id('gym_a') and user_id = tests.id('head_a');
select tests.login_as('owner_a');
select lives_ok($$ select public.delete_my_account() $$, 'With another owner, an owner deletes their account');
select tests.logout();
select is((select role::text from public.memberships where org_id = tests.id('gym_a') and user_id = tests.id('head_a')), 'owner',
  'and the gym keeps its other owner');

select tests.login_anon();
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'Not without signing in');

select * from finish();
rollback;
