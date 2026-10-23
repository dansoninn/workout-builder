-- Partner blocks (calc spec §4.5, decided 2026-10-23): the block stores how
-- partners share the work; an app of the previous version still works during
-- a deploy. And the list of workouts to work out again after a calculation
-- version bump.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(12);

insert into tests.ids (name) select unnest(array['w1', 'b1', 'b2', 'i1', 'copy']);

create function tests.partner_workout(p_block jsonb)
returns jsonb
language sql
as $$
  select jsonb_build_object('id', tests.id('w1'), 'track_id', tests.id('track_a'), 'kind', 'template', 'date', null, 'title', 'Partner day',
    'blocks', jsonb_build_array(jsonb_build_object('id', tests.id('b1'), 'label', 'A', 'intent', 'conditioning', 'format', 'amrap',
      'params', '{"time_s": 720}'::jsonb, 'pace_effort', 'hard',
      'items', jsonb_build_array(jsonb_build_object('id', tests.id('i1'), 'exercise_id', tests.id('core_squat'), 'raw_line', '10 squats',
        'quantity', '{"type": "reps", "value": 10}'::jsonb))) || p_block))
$$;

select has_column('public', 'blocks', 'partner_mode', 'A block says how partners share the work');
select col_type_is('public', 'blocks', 'partner_mode', 'partner_mode', 'one of split, alternate, each');

select tests.login_as('coach_a');
select lives_ok($$ select public.save_workout(tests.id('gym_a'), tests.partner_workout('{"partner_mode": "alternate"}')) $$,
  'A coach saves an I go, you go block');
select results_eq($$ select partner_mode::text, partner from public.blocks where id = tests.id('b1') $$,
  $$ values ('alternate'::text, true) $$, 'It is kept, and the older yes/no follows it');
select lives_ok($$ select public.save_workout(tests.id('gym_a'), tests.partner_workout('{"partner_mode": null, "partner": true}')) $$,
  'An app of the previous version sends partner: true');
select is((select partner_mode::text from public.blocks where id = tests.id('b1')), 'split', 'which is read as splitting the work');
select lives_ok($$ select public.save_workout(tests.id('gym_a'), tests.partner_workout('{"partner_mode": "each"}')) $$, 'each');
select is(
  public.copy_workout(tests.id('gym_a'), tests.id('w1'), jsonb_build_array(jsonb_build_object('id', tests.id('copy'), 'date', '2026-11-02', 'track_id', tests.id('track_a')))),
  1, 'A copy is made');
select is((select b.partner_mode::text from public.blocks b where b.workout_id = tests.id('copy')), 'each', 'and keeps the partner mode');
select throws_ok($$ update public.blocks set partner = false where id = tests.id('b1') $$, '428C9', null,
  'The older yes/no cannot be written, only read');

-- After a calculation version bump: the workouts without numbers for that version.
select tests.logout();
insert into public.workout_metrics (workout_id, org_id, calc_version, taxonomy_version, metrics) values
  (tests.id('w1'), tests.id('gym_a'), 2, 1, '{}');
select tests.login_as('coach_a');
select set_eq($$ select * from public.stale_workouts(tests.id('gym_a'), 2) $$,
  $$ values (tests.id('workout_a')), (tests.id('copy')) $$,
  'The gym''s workouts without numbers for version 2 (workout_a has only version 1''s)');
select tests.login_as('owner_b');
select is_empty($$ select * from public.stale_workouts(tests.id('gym_a'), 2) $$, 'Another gym sees none of them');

select * from finish();
rollback;
