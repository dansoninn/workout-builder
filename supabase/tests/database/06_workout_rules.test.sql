-- Workout structure rules (SPEC-data-model §6), exercised as a coach through
-- the same path the app will use:
--   * a workout cannot be published while any item is unmatched
--   * block params are validated per format
--   * item quantity and load have exactly one valid shape
--   * scheduled vs template dates, and rows stay attached to their parent
-- Plus alias normalisation (§5).

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(63);

-- Scratch workout and block in gym A for the shape tests.
insert into tests.ids (name) values ('workout_c'), ('block_c');
insert into public.workouts (id, org_id, kind, title) values (tests.id('workout_c'), tests.id('gym_a'), 'template', 'Scratch');
insert into public.blocks (id, workout_id, org_id, position, label, intent, format, params)
values (tests.id('block_c'), tests.id('workout_c'), tests.id('gym_a'), 0, 'A', 'conditioning', 'amrap', '{"time_s": 600}');

create function tests.add_block(p_format text, p_params jsonb)
returns void
language sql
as $$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_c'), tests.id('gym_a'), 1, 'B', 'conditioning', p_format::public.block_format, p_params)
$$;

create function tests.add_item(p_quantity jsonb, p_load jsonb default null)
returns void
language sql
as $$
  insert into public.block_items (block_id, org_id, position, exercise_id, raw_line, quantity, load)
  values (tests.id('block_c'), tests.id('gym_a'), 0, tests.id('core_squat'), 'test line', p_quantity, p_load)
$$;

create function tests.add_alias(p_alias text)
returns void
language sql
as $$
  insert into public.exercise_aliases (org_id, alias_normalized, exercise_id)
  values (tests.id('gym_a'), p_alias, tests.id('core_squat'))
$$;

select tests.login_as('coach_a');

-- ---------------------------------------------------------------------------
-- Publish rule
-- ---------------------------------------------------------------------------
select throws_ok($$ update public.workouts set status = 'published' where id = tests.id('workout_a') $$,
  '23514', null, 'A workout with an unmatched item cannot be published');
select results_eq($$ select status::text from public.workouts where id = tests.id('workout_a') $$,
  array['draft'], '... and stays a draft');
select lives_ok($$ update public.block_items set exercise_id = tests.id('core_wallball') where id = tests.id('item_a_unmatched') $$,
  'Coach matches the unmatched item');
select lives_ok($$ update public.workouts set status = 'published' where id = tests.id('workout_a') $$,
  'With every item matched, the workout can be published');
select throws_ok($$
  insert into public.block_items (block_id, org_id, position, raw_line, quantity)
  values (tests.id('block_a'), tests.id('gym_a'), 2, 'mystery move', '{"type": "reps", "value": 10}')
$$, '23514', null, 'A published workout cannot gain an unmatched item');
select throws_ok($$ update public.block_items set exercise_id = null where id = tests.id('item_a_matched') $$,
  '23514', null, 'An item of a published workout cannot be unmatched');
select lives_ok($$
  insert into public.block_items (block_id, org_id, position, exercise_id, raw_line, quantity)
  values (tests.id('block_a'), tests.id('gym_a'), 2, tests.id('ex_a'), '10 sandbag clean', '{"type": "reps", "value": 10}')
$$, 'A published workout can gain a matched item');
select lives_ok($$
  update public.workouts set status = 'draft' where id = tests.id('workout_a');
  insert into public.block_items (block_id, org_id, position, raw_line, quantity)
  values (tests.id('block_a'), tests.id('gym_a'), 3, 'mystery move', '{"type": "reps", "value": 10}');
$$, 'A draft can hold unmatched items');
select throws_ok($$ update public.workouts set status = 'published' where id = tests.id('workout_a') $$,
  '23514', null, '... and cannot be published again until they are matched');

-- ---------------------------------------------------------------------------
-- Scheduled vs template, track in the same gym, rows stay with their parent
-- ---------------------------------------------------------------------------
select throws_ok($$ insert into public.workouts (org_id, kind) values (tests.id('gym_a'), 'scheduled') $$,
  '23514', null, 'A scheduled workout needs a date');
select throws_ok($$ insert into public.workouts (org_id, kind, date) values (tests.id('gym_a'), 'template', '2026-10-21') $$,
  '23514', null, 'A template has no date');
select throws_ok($$
  insert into public.workouts (org_id, track_id, kind, date) values (tests.id('gym_a'), tests.id('track_b'), 'scheduled', '2026-10-21')
$$, '23503', null, 'A workout cannot use another gym''s track');
select throws_ok($$ update public.blocks set workout_id = tests.id('workout_c') where id = tests.id('block_a') $$,
  '23514', null, 'A block cannot be moved to another workout');
select throws_ok($$ update public.block_items set block_id = tests.id('block_c') where id = tests.id('item_a_matched') $$,
  '23514', null, 'An item cannot be moved to another block');

-- ---------------------------------------------------------------------------
-- Block params per format
-- ---------------------------------------------------------------------------
select lives_ok($$ select tests.add_block('sets', '{"sets": 5, "rest_s": 120}') $$, 'sets: sets + rest');
select lives_ok($$ select tests.add_block('sets', '{"sets": 5}') $$, 'sets: rest is optional');
select lives_ok($$ select tests.add_block('every', '{"interval_s": 180, "rounds": 5}') $$, 'every: E3M x 5');
select lives_ok($$ select tests.add_block('amrap', '{"time_s": 480}') $$, 'amrap: 8 min');
select lives_ok($$ select tests.add_block('for_time', '{"rounds": 1, "time_cap_s": 1500}') $$, 'for_time: with cap');
select lives_ok($$ select tests.add_block('for_time', '{"rounds": 3}') $$, 'for_time: cap is optional');
select lives_ok($$ select tests.add_block('intervals', '{"rounds": 4, "work_s": 90, "rest_s": 30, "rest_between_rounds_s": 90, "stations": 3}') $$,
  'intervals: 4 x 3 stations, 90/30, 90 s between rounds');
select lives_ok($$ select tests.add_block('tabata', '{"rounds": 8, "work_s": 20, "rest_s": 10}') $$, 'tabata: 8 x 20/10');

select throws_ok($$ select tests.add_block('sets', '{"rest_s": 60}') $$, '23514', null, 'sets: number of sets is required');
select throws_ok($$ select tests.add_block('sets', '{"sets": 0}') $$, '23514', null, 'sets: at least one set');
select throws_ok($$ select tests.add_block('sets', '{"sets": 5, "reps": 5}') $$, '23514', null, 'sets: unknown keys are rejected');
select throws_ok($$ select tests.add_block('every', '{"time_s": 600}') $$, '23514', null, 'every: params of another format are rejected');
select throws_ok($$ select tests.add_block('amrap', '{"time_s": "8 min"}') $$, '23514', null, 'amrap: time must be a number');
select throws_ok($$ select tests.add_block('amrap', '{"time_s": 480.5}') $$, '23514', null, 'amrap: time in whole seconds');
select throws_ok($$ select tests.add_block('intervals', '{"rounds": 4, "work_s": 90, "rest_s": 30}') $$, '23514', null, 'intervals: stations are required');
select throws_ok($$ select tests.add_block('tabata', '{"rounds": 8, "work_s": 30, "rest_s": 15}') $$, '23514', null, 'tabata: always 20/10');
select throws_ok($$ select tests.add_block('amrap', '[480]') $$, '23514', null, 'params must be an object');

-- ---------------------------------------------------------------------------
-- Item quantity: exactly one of eight shapes
-- ---------------------------------------------------------------------------
select lives_ok($$ select tests.add_item('{"type": "reps", "value": 5}') $$, 'quantity: reps');
select lives_ok($$ select tests.add_item('{"type": "reps_range", "min": 8, "max": 10}') $$, 'quantity: reps_range');
select lives_ok($$ select tests.add_item('{"type": "reps_scheme", "scheme": [21, 15, 9]}') $$, 'quantity: reps_scheme');
select lives_ok($$ select tests.add_item('{"type": "reps_per_side", "value": 8}') $$, 'quantity: reps_per_side');
select lives_ok($$ select tests.add_item('{"type": "distance_m", "value": 800}') $$, 'quantity: distance_m');
select lives_ok($$ select tests.add_item('{"type": "calories", "min": 8, "max": 12}') $$, 'quantity: calories range');
select lives_ok($$ select tests.add_item('{"type": "calories", "min": 15, "max": 15}') $$, 'quantity: calories single value (min = max)');
select lives_ok($$ select tests.add_item('{"type": "time_s", "value": 30}') $$, 'quantity: time_s');
select lives_ok($$ select tests.add_item('{"type": "max_effort", "unit": "distance_m"}') $$, 'quantity: max_effort');

select throws_ok($$ select tests.add_item('{"value": 5}') $$, '23514', null, 'quantity: type is required');
select throws_ok($$ select tests.add_item('{"type": "sets", "value": 5}') $$, '23514', null, 'quantity: unknown type');
select throws_ok($$ select tests.add_item('{"type": "reps", "value": 5, "min": 3}') $$, '23514', null, 'quantity: no mixing of shapes');
select throws_ok($$ select tests.add_item('{"type": "reps", "value": 0}') $$, '23514', null, 'quantity: reps at least 1');
select throws_ok($$ select tests.add_item('{"type": "reps_range", "min": 10, "max": 8}') $$, '23514', null, 'quantity: range min below max');
select throws_ok($$ select tests.add_item('{"type": "reps_scheme", "scheme": []}') $$, '23514', null, 'quantity: scheme not empty');
select throws_ok($$ select tests.add_item('{"type": "reps_scheme", "scheme": ["21", 15]}') $$, '23514', null, 'quantity: scheme of whole numbers');
select throws_ok($$ select tests.add_item('{"type": "max_effort", "unit": "miles"}') $$, '23514', null, 'quantity: max_effort unit from the unit list');

-- ---------------------------------------------------------------------------
-- Item load: optional, one of three shapes
-- ---------------------------------------------------------------------------
select lives_ok($$ select tests.add_item('{"type": "reps", "value": 5}', '{"type": "percent_1rm", "min": 75, "max": 80}') $$, 'load: percent_1rm');
select lives_ok($$ select tests.add_item('{"type": "reps", "value": 15}', '{"type": "absolute_kg", "rx": [22.5, 15]}') $$, 'load: absolute_kg with Rx variants');
select lives_ok($$ select tests.add_item('{"type": "reps", "value": 10}', '{"type": "bodyweight"}') $$, 'load: bodyweight');
select throws_ok($$ select tests.add_item('{"type": "reps", "value": 5}', '{"type": "rpe", "value": 8}') $$, '23514', null, 'load: rpe is not a load type (use load effort)');
select throws_ok($$ select tests.add_item('{"type": "reps", "value": 5}', '{"type": "percent_1rm", "min": 80, "max": 75}') $$, '23514', null, 'load: percent min not above max');
select throws_ok($$ select tests.add_item('{"type": "reps", "value": 5}', '{"type": "percent_1rm", "min": 90, "max": 105}') $$, '23514', null, 'load: percent at most 100');
select throws_ok($$ select tests.add_item('{"type": "reps", "value": 5}', '{"type": "absolute_kg", "rx": []}') $$, '23514', null, 'load: at least one Rx weight');
select throws_ok($$ select tests.add_item('{"type": "reps", "value": 5}', '{"type": "absolute_kg", "rx": [20, -5]}') $$, '23514', null, 'load: weights positive');

-- ---------------------------------------------------------------------------
-- Alias normalisation: lower-case, trimmed, no punctuation, single spaces
-- ---------------------------------------------------------------------------
select tests.login_as('head_a');

select lives_ok($$ select tests.add_alias('kb swing') $$, 'alias: "kb swing" is normalised');
select lives_ok($$ select tests.add_alias('þrýstipressa') $$, 'alias: Icelandic letters are fine');
select throws_ok($$ select tests.add_alias('KB Swing') $$, '23514', null, 'alias: upper case rejected');
select throws_ok($$ select tests.add_alias('kb-swing') $$, '23514', null, 'alias: punctuation rejected');
select throws_ok($$ select tests.add_alias(' kb swing') $$, '23514', null, 'alias: surrounding spaces rejected');
select throws_ok($$ select tests.add_alias('kb  swing') $$, '23514', null, 'alias: double spaces rejected');
select throws_ok($$ select tests.add_alias('bs') $$, '23505', null, 'alias: unique within the gym');

select * from finish();
rollback;
