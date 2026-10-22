-- save_workout (Step 4b): one transaction, the gym's coaches only, only real
-- changes reach the audit log, all-or-nothing. Alternating EMOM slots.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(27);

insert into tests.ids (name)
select unnest(array['w1', 'b1', 'b2', 'i1', 'i2', 'i3', 'i4', 'w2', 'e1', 'e2', 'e3', 'e4']);

-- A workout as the builder sends it: an E3M strength block and an AMRAP.
create function tests.workout_json(p_squat_reps int default 5, p_with_amrap boolean default true)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', tests.id('w1'), 'track_id', tests.id('track_a'), 'kind', 'scheduled', 'date', '2026-10-22',
    'title', 'Thursday', 'focus', null,
    'blocks', jsonb_build_array(
      jsonb_build_object(
        'id', tests.id('b1'), 'label', 'A', 'intent', 'strength', 'format', 'every',
        'params', '{"interval_s": 180, "rounds": 5}'::jsonb, 'load_effort', 'moderate', 'rest_after_s', 120,
        'items', jsonb_build_array(jsonb_build_object(
          'id', tests.id('i1'), 'exercise_id', tests.id('core_squat'), 'raw_line', p_squat_reps || ' back squat @75-80%',
          'quantity', jsonb_build_object('type', 'reps', 'value', p_squat_reps),
          'load', '{"type": "percent_1rm", "min": 75, "max": 80}'::jsonb)))
    ) || case when p_with_amrap then jsonb_build_array(
      jsonb_build_object(
        'id', tests.id('b2'), 'label', 'B', 'intent', 'conditioning', 'format', 'amrap',
        'params', '{"time_s": 480}'::jsonb, 'pace_effort', 'hard',
        'items', jsonb_build_array(
          jsonb_build_object('id', tests.id('i2'), 'exercise_id', tests.id('core_wallball'), 'raw_line', '10 wall balls',
                             'quantity', '{"type": "reps", "value": 10}'::jsonb),
          jsonb_build_object('id', tests.id('i3'), 'exercise_id', tests.id('core_row'), 'raw_line', '200 m row',
                             'quantity', '{"type": "distance_m", "value": 200}'::jsonb))))
    else '[]'::jsonb end)
$$;

-- Alternating EMOM: lines with the given slots (minute 1, 2, …).
create function tests.alternating_json(p_slots int[])
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', tests.id('w2'), 'track_id', tests.id('track_a'), 'kind', 'template', 'date', null,
    'blocks', jsonb_build_array(jsonb_build_object(
      'id', tests.id('b1') , 'label', 'A', 'intent', 'conditioning', 'format', 'every',
      'params', '{"interval_s": 60, "rounds": 6, "alternating": true}'::jsonb,
      'items', (select jsonb_agg(jsonb_build_object(
          'id', tests.id('e' || n), 'exercise_id', tests.id('core_row'), 'raw_line', 'line ' || n,
          'quantity', '{"type": "calories", "min": 10, "max": 10}'::jsonb, 'slot', p_slots[n]) order by n)
        from generate_series(1, cardinality(p_slots)) as n))))
$$;

-- b1 already belongs to w1; give the alternating workout its own block id.
create or replace function tests.alternating_json_own(p_slots int[])
returns jsonb
language sql
as $$ select jsonb_set(tests.alternating_json(p_slots), '{blocks,0,id}', to_jsonb(gen_random_uuid())) $$;

-- ---------------------------------------------------------------------------
-- Who can save
-- ---------------------------------------------------------------------------
select tests.login_as('viewer_a');
select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout_json()) $$,
  '42501', 'You cannot program workouts in this gym', 'A viewer cannot save a workout');
select tests.login_as('coach_b');
select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout_json()) $$,
  '42501', 'You cannot program workouts in this gym', 'Another gym''s coach cannot save into this gym');

select tests.login_as('coach_a');
select is(public.save_workout(tests.id('gym_a'), tests.workout_json()), tests.id('w1'), 'A coach saves a new workout');
select results_eq(
  $$ select b.position, b.label, b.format::text, b.rest_after_s from public.blocks b where b.workout_id = tests.id('w1') order by b.position $$,
  $$ values (0, 'A', 'every', 120), (1, 'B', 'amrap', null::int) $$,
  'Blocks are stored in order, with the rest after them');
select results_eq(
  $$ select i.position, i.raw_line from public.block_items i where i.block_id = tests.id('b2') order by i.position $$,
  $$ values (0, '10 wall balls'), (1, '200 m row') $$,
  'Lines are stored in order, with their raw text');

-- Another gym cannot overwrite it, even knowing its id.
select tests.login_as('owner_b');
select throws_ok($$ select public.save_workout(tests.id('gym_b'), tests.workout_json()) $$,
  '23505', null, 'Another gym cannot take over the workout by its id');

-- ---------------------------------------------------------------------------
-- Only real changes are written
-- ---------------------------------------------------------------------------
select tests.login_as('coach_a');
select tests.logout();
create temp table audit_before as select count(*) as n from public.audit_log;
select tests.login_as('coach_a');
select lives_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout_json()) $$, 'Saving again without changes works');
select tests.logout();
select is((select count(*) from public.audit_log) - (select n from audit_before), 0::bigint,
  'Saving an unchanged workout writes nothing to the audit log');

select tests.login_as('coach_a');
select lives_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout_json(p_squat_reps => 3)) $$, 'One line changes');
select tests.logout();
select results_eq(
  $$ select table_name, action::text, row_id from public.audit_log where id > (select max(id) - 1 from public.audit_log) $$,
  $$ values ('block_items', 'update', tests.id('i1')) $$,
  'Changing one line writes exactly one audit entry, for that line');
select is((select quantity from public.block_items where id = tests.id('i1')), '{"type": "reps", "value": 3}'::jsonb,
  'The new quantity is stored');

-- Removing a block removes its lines.
select tests.login_as('coach_a');
select lives_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout_json(p_with_amrap => false)) $$, 'A block is removed');
select is_empty($$ select 1 from public.blocks where id = tests.id('b2') $$, 'The removed block is gone');
select is_empty($$ select 1 from public.block_items where id in (tests.id('i2'), tests.id('i3')) $$, '…and its lines too');

-- A line moved to another block.
select lives_ok($$
  select public.save_workout(tests.id('gym_a'), jsonb_set(tests.workout_json(),
    '{blocks}', jsonb_build_array(
      tests.workout_json() -> 'blocks' -> 0 || jsonb_build_object('items', '[]'::jsonb),
      tests.workout_json() -> 'blocks' -> 1 || jsonb_build_object('items',
        (tests.workout_json() -> 'blocks' -> 1 -> 'items') || (tests.workout_json() -> 'blocks' -> 0 -> 'items')))))
$$, 'A line moves from block A to block B');
select results_eq(
  $$ select block_id, position from public.block_items where id = tests.id('i1') $$,
  $$ values (tests.id('b2'), 2) $$,
  'It now belongs to block B, last');

-- All or nothing: a bad second block leaves everything as it was.
select throws_ok($$
  select public.save_workout(tests.id('gym_a'), jsonb_set(tests.workout_json(p_squat_reps => 8), '{blocks,1,params}', '{"rounds": 3}'))
$$, '23514', null, 'A block with invalid params is refused');
select is((select quantity ->> 'value' from public.block_items where id = tests.id('i2')), '10',
  '…and nothing from that save was kept');
select is_empty($$ select 1 from public.block_items where id = tests.id('i1') and block_id = tests.id('b1') $$,
  '…including the change to the first block');

-- ---------------------------------------------------------------------------
-- Alternating EMOM slots (minute 1: two lines, minute 2: one line)
-- ---------------------------------------------------------------------------
-- The slot rules run at commit; each save from the app is its own transaction.
-- This test never commits, so check them after every statement instead.
set constraints all immediate;

select tests.login_as('coach_a');
select lives_ok($$ select public.save_workout(tests.id('gym_a'), tests.alternating_json_own(array[1, 1, 2])) $$,
  'Alternating EMOM: two lines in minute 1, one in minute 2');
select results_eq(
  $$ select i.slot::int from public.block_items i join public.blocks b on b.id = i.block_id
     where b.workout_id = tests.id('w2') order by i.position $$,
  $$ values (1), (1), (2) $$,
  'Each line keeps its slot');
select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.alternating_json_own(array[1, 3])) $$,
  '23514', 'Alternating EMOM slots must run 1, 2, 3 ... without gaps', 'Slots cannot skip a minute');
select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.alternating_json_own(array[1, null])) $$,
  '23514', 'Every line of an alternating EMOM needs a slot (minute 1, 2, ...)', 'Every line needs a slot');
select throws_ok($$
  select public.save_workout(tests.id('gym_a'),
    jsonb_set(tests.alternating_json_own(array[1, 2]), '{blocks,0,params}', '{"interval_s": 60, "rounds": 6}'))
$$, '23514', 'Only lines of an alternating EMOM have a slot', 'Lines outside an alternating EMOM have no slot');

-- ---------------------------------------------------------------------------
-- Ids are required, and the rules on workouts still hold
-- ---------------------------------------------------------------------------
select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout_json() - 'id') $$,
  '22023', 'The workout needs an id', 'The workout needs an id');
select throws_ok($$ select public.save_workout(tests.id('gym_a'), jsonb_set(tests.workout_json(), '{date}', 'null')) $$,
  '23514', null, 'A scheduled workout needs a date');
select tests.login_anon();
select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout_json()) $$,
  '42501', null, 'Visitors cannot save');

select * from finish();
rollback;
