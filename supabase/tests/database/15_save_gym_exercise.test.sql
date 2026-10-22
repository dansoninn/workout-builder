-- save_gym_exercise (Step 4b): owners and head coaches add and edit the gym's
-- own exercises with patterns (adding up to 1.00), muscles and equipment.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(12);

insert into tests.ids (name) values ('sandbag');

create function tests.sandbag(p_patterns jsonb default '{"squat": 0.6, "carry": 0.4}')
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', tests.id('sandbag'), 'name', 'Sandbag bear-hug carry', 'slug', 'sandbag-bear-hug-carry',
    'kind', 'movement', 'plane', 'sagittal', 'default_unit', 'distance_m', 'implement_count', 1,
    'pace_default', '{"sec_per_m": 0.6}'::jsonb, 'patterns', p_patterns,
    'primary_muscles', '["quads", "upper_back"]'::jsonb, 'secondary_muscles', '["abs"]'::jsonb,
    'equipment', '["sandbag"]'::jsonb)
$$;

select tests.login_as('head_a');
select is(public.save_gym_exercise(tests.id('gym_a'), tests.sandbag()), tests.id('sandbag'), 'A head coach adds a gym exercise');
select results_eq(
  $$ select pattern_key, weight from public.exercise_patterns where exercise_id = tests.id('sandbag') order by pattern_key $$,
  $$ values ('carry', 0.40::numeric(3,2)), ('squat', 0.60::numeric(3,2)) $$,
  'with its pattern weights');
select results_eq(
  $$ select muscle_key, role::text from public.exercise_muscles where exercise_id = tests.id('sandbag') order by role, muscle_key $$,
  $$ values ('quads', 'primary'), ('upper_back', 'primary'), ('abs', 'secondary') $$,
  'its muscles');
select isnt_empty($$ select 1 from public.exercise_equipment where exercise_id = tests.id('sandbag') and equipment_key = 'sandbag' $$,
  'and its equipment');

select lives_ok($$ select public.save_gym_exercise(tests.id('gym_a'), tests.sandbag('{"carry": 1}')) $$, 'Editing replaces the patterns');
select results_eq($$ select pattern_key from public.exercise_patterns where exercise_id = tests.id('sandbag') $$,
  $$ values ('carry') $$, 'Only the new pattern remains');

-- The rules hold: weights add up to 1.00 (checked at commit; checked per statement here).
set constraints all immediate;
select throws_ok($$ select public.save_gym_exercise(tests.id('gym_a'), tests.sandbag('{"squat": 0.6, "carry": 0.3}')) $$,
  '23514', null, 'Pattern weights must add up to 1.00');
select throws_ok($$
  select public.save_gym_exercise(tests.id('gym_a'),
    tests.sandbag() || '{"id": null, "slug": "sandbag-bear-hug-carry"}'::jsonb)
$$, '23505', null, 'Two gym exercises cannot share an address (slug)');

select tests.login_as('coach_a');
select throws_ok($$ select public.save_gym_exercise(tests.id('gym_a'), tests.sandbag()) $$,
  '42501', 'Only owners and head coaches can edit the gym''s exercises', 'A coach cannot edit the exercise bank');
select tests.login_as('owner_b');
select throws_ok($$ select public.save_gym_exercise(tests.id('gym_a'), tests.sandbag()) $$,
  '42501', null, 'Another gym cannot edit it');
select is_empty($$ select 1 from public.exercises where id = tests.id('sandbag') $$, 'Another gym cannot see it');

select tests.logout();
select isnt_empty($$ select 1 from public.audit_log where table_name = 'exercises' and row_id = tests.id('sandbag') $$,
  'Gym exercise changes are in the audit log');

select * from finish();
rollback;
