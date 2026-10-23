-- What a coach writes that the app now keeps (calc spec version 3): a line's
-- alternatives, one side, a cap; a block not counted in load; sets within a
-- time box; intervals station by station. Saved, copied and checked.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(14);

insert into tests.ids (name) select unnest(array['w1', 'b1', 'b2', 'i1', 'i2', 'copy']);

create function tests.detailed(p_item jsonb default '{}', p_block jsonb default '{}')
returns jsonb
language sql
as $$
  select jsonb_build_object('id', tests.id('w1'), 'track_id', tests.id('track_a'), 'kind', 'template', 'date', null, 'title', 'Details',
    'blocks', jsonb_build_array(
      jsonb_build_object('id', tests.id('b1'), 'label', 'A', 'intent', 'strength', 'format', 'sets', 'params', '{"time_s": 810}'::jsonb,
        'load_effort', 'hard',
        'items', jsonb_build_array(jsonb_build_object('id', tests.id('i1'), 'exercise_id', tests.id('core_squat'), 'raw_line', '3-4 back squat',
          'quantity', '{"type": "reps_range", "min": 3, "max": 4}'::jsonb,
          'alternatives', '["Front squat", "Goblet squat"]'::jsonb, 'side', null, 'cap', null) || p_item)),
      jsonb_build_object('id', tests.id('b2'), 'label', 'B', 'intent', 'mobility', 'format', 'sets', 'params', '{"sets": 1}'::jsonb,
        'counts_in_load', false, 'items', '[]'::jsonb) || p_block))
$$;

select has_column('public', 'block_items', 'alternatives', 'A line keeps its alternatives');
select has_column('public', 'blocks', 'counts_in_load', 'A block says whether it counts in planned load');

select tests.login_as('coach_a');
select lives_ok($$ select public.save_workout(tests.id('gym_a'), tests.detailed()) $$, 'A coach saves sets in a time box, alternatives and a stretch');
select results_eq(
  $$ select alternatives, side, cap from public.block_items where id = tests.id('i1') $$,
  $$ values (array['Front squat', 'Goblet squat']::text[], null::text, null::jsonb) $$,
  'The alternatives are kept as written');
select is((select counts_in_load from public.blocks where id = tests.id('b2')), false, 'The stretch is not counted in load');
select is((select params from public.blocks where id = tests.id('b1')), '{"time_s": 810}'::jsonb, 'Sets within a time box, without a count');

select lives_ok(
  $$ select public.save_workout(tests.id('gym_a'), tests.detailed('{"side": "right", "cap": {"type": "time_s", "value": 40}, "alternatives": []}')) $$,
  'One side and a cap');
select results_eq($$ select side, cap from public.block_items where id = tests.id('i1') $$,
  $$ values ('right'::text, '{"type": "time_s", "value": 40}'::jsonb) $$, 'are kept');

select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.detailed('{"side": "middle"}')) $$, '23514', null, 'A side is left or right');
select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.detailed('{"cap": {"type": "kg", "value": 40}}')) $$, '23514', null, 'A cap is a time or an amount');
select throws_ok(
  $$ select public.save_workout(tests.id('gym_a'), tests.detailed('{"alternatives": ["a","b","c","d","e","f","g","h","i","j","k"]}')) $$,
  '23514', null, 'Ten alternatives at most');
select throws_ok(
  $$ select public.save_workout(tests.id('gym_a'), tests.detailed('{}', '{"format": "sets", "params": {}}')) $$,
  '23514', null, 'Sets need a count or a time box');

select is(
  public.copy_workout(tests.id('gym_a'), tests.id('w1'), jsonb_build_array(jsonb_build_object('id', tests.id('copy'), 'date', '2026-11-02', 'track_id', tests.id('track_a')))),
  1, 'A copy is made');
select results_eq(
  $$ select b.counts_in_load, i.side, i.cap from public.blocks b left join public.block_items i on i.block_id = b.id
      where b.workout_id = tests.id('copy') order by b.position $$,
  $$ values (true, 'right'::text, '{"type": "time_s", "value": 40}'::jsonb), (false, null, null) $$,
  'and keeps every detail');

select * from finish();
rollback;
