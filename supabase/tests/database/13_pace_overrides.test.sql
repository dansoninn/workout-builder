-- Gym pace overrides (Step 4b): owners and head coaches set them for core or
-- their own exercises; everyone in the gym reads them; other gyms see nothing.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(13);

select has_table('public', 'exercise_pace_overrides', 'exercise_pace_overrides exists');

select tests.login_as('owner_a');
select lives_ok($$
  insert into public.exercise_pace_overrides (org_id, exercise_id, pace)
  values (tests.id('gym_a'), tests.id('core_squat'), '{"sec_per_rep": 2.5}')
$$, 'An owner sets the gym''s pace for a core exercise');

select tests.login_as('head_a');
select isnt_empty($$
  update public.exercise_pace_overrides set pace = '{"sec_per_rep": 2.2}'
  where org_id = tests.id('gym_a') and exercise_id = tests.id('core_squat') returning 1
$$, 'A head coach changes it');
select lives_ok($$
  insert into public.exercise_pace_overrides (org_id, exercise_id, pace)
  values (tests.id('gym_a'), tests.id('ex_a'), '{"sec_per_rep": 3}')
$$, 'A head coach sets a pace for the gym''s own exercise');
select throws_ok($$
  insert into public.exercise_pace_overrides (org_id, exercise_id, pace)
  values (tests.id('gym_a'), tests.id('ex_b'), '{"sec_per_rep": 3}')
$$, '23514', null, 'No pace for another gym''s exercise');
select throws_ok($$
  insert into public.exercise_pace_overrides (org_id, exercise_id, pace)
  values (tests.id('gym_a'), tests.id('core_row'), '{"sec_per_500m": 120}')
$$, '23514', null, 'The pace must have the known shape');

select tests.login_as('coach_a');
select isnt_empty($$ select 1 from public.exercise_pace_overrides where org_id = tests.id('gym_a') $$,
  'A coach reads the gym''s paces');
select throws_ok($$
  insert into public.exercise_pace_overrides (org_id, exercise_id, pace)
  values (tests.id('gym_a'), tests.id('core_row'), '{"sec_per_m": 0.3}')
$$, '42501', null, 'A coach cannot set paces');
select is_empty($$ delete from public.exercise_pace_overrides where org_id = tests.id('gym_a') returning 1 $$,
  'A coach cannot remove paces');

select tests.login_as('viewer_a');
select is_empty($$
  update public.exercise_pace_overrides set pace = '{"sec_per_rep": 9}' where org_id = tests.id('gym_a') returning 1
$$, 'A viewer cannot change paces');

select tests.login_as('owner_b');
select is_empty($$ select 1 from public.exercise_pace_overrides where org_id = tests.id('gym_a') $$,
  'Another gym sees none of them');

select tests.login_as('owner_a');
select isnt_empty($$
  delete from public.exercise_pace_overrides where org_id = tests.id('gym_a') and exercise_id = tests.id('ex_a') returning 1
$$, 'An owner removes one (back to the default)');

select tests.logout();
select results_eq(
  $$ select action::text from public.audit_log
     where table_name = 'exercise_pace_overrides' and row_id = tests.id('core_squat') order by id $$,
  $$ values ('insert'), ('update') $$,
  'Pace changes are in the gym''s audit log');

select * from finish();
rollback;
