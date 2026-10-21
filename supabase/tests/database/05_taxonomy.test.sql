-- The locked taxonomy: seeded as specified, invalid values rejected wherever
-- they are used, and not writable by any tenant role.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(32);

-- ---------------------------------------------------------------------------
-- Seed matches the calc spec (§2, §4.4); version 2 removed sled (2026-10-21)
-- ---------------------------------------------------------------------------
select results_eq($$ select version from public.taxonomy_versions order by version $$, array[1, 2],
  'Taxonomy versions 1 and 2 are published');
select results_eq($$ select key from public.movement_patterns order by position $$,
  array['squat', 'lunge', 'hinge', 'h_push', 'v_push', 'h_pull', 'v_pull', 'carry', 'core', 'rotation', 'jump'],
  'Movement patterns (§2.1)');
select results_eq($$ select key from public.planes order by position $$,
  array['sagittal', 'frontal', 'transverse', 'multiplanar'], 'Planes (§2.2)');
select results_eq($$ select key || ' ' || default_unit from public.modalities order by position $$,
  array['run distance_m', 'row distance_m', 'bike calories', 'ski distance_m', 'jump_rope reps', 'swim distance_m'],
  'Monostructural modalities and default units (§2.3; no sled)');
select results_eq($$ select key from public.muscles order by position $$,
  array['quads', 'hamstrings', 'glutes', 'adductors', 'calves', 'chest', 'lats', 'upper_back',
        'shoulders', 'biceps', 'triceps', 'forearms_grip', 'abs', 'obliques', 'lower_back'],
  'Muscle groups (§2.4)');
select results_eq($$
  select format('%s: RPE %s-%s (calc %s), RIR %s', key, rpe_min, rpe_max, rpe_calc,
    case when rir_max is null then rir_min || '+'
         when rir_min = rir_max then rir_min::text
         else rir_min || '-' || rir_max end)
  from public.effort_levels order by position
$$, array[
  'easy: RPE 3.0-4.0 (calc 4.0), RIR 4+',
  'moderate: RPE 5.0-6.0 (calc 6.0), RIR 2-3',
  'hard: RPE 7.0-8.0 (calc 8.0), RIR 0-1',
  'max: RPE 9.0-10.0 (calc 9.5), RIR 0'
], 'Effort levels carry the approved RPE/RIR mapping (§4.4)');

-- ---------------------------------------------------------------------------
-- Invalid values are rejected where they are used
-- ---------------------------------------------------------------------------
select tests.login_as('head_a');

select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, plane, default_unit)
  values (tests.id('gym_a'), 'X', 'x', 'movement', 'diagonal', 'reps')
$$, '23503', null, 'Unknown plane is rejected');
select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, modality, default_unit)
  values (tests.id('gym_a'), 'X', 'x', 'monostructural', 'kayak', 'distance_m')
$$, '23503', null, 'Unknown modality is rejected');
select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, modality, default_unit)
  values (tests.id('gym_a'), 'Sled push', 'sled-push', 'monostructural', 'sled', 'distance_m')
$$, '23503', null, 'Sled is no longer a modality (sled work is a movement)');
select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, default_unit)
  values (tests.id('gym_a'), 'X', 'x', 'monostructural', 'distance_m')
$$, '23514', null, 'Monostructural exercise without a modality is rejected');
select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, default_unit)
  values (tests.id('gym_a'), 'X', 'x', 'cardio', 'reps')
$$, '22P02', null, 'Unknown exercise kind is rejected');
select throws_ok($$
  insert into public.exercises (org_id, name, slug, kind, default_unit)
  values (tests.id('gym_a'), 'X', 'x', 'movement', 'miles')
$$, '22P02', null, 'Unknown unit is rejected');
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('ex_a'), 'push', 1.00)
$$, '23503', null, 'Unknown movement pattern is rejected');
select throws_ok($$
  insert into public.exercise_muscles (exercise_id, muscle_key, role) values (tests.id('ex_a'), 'traps', 'primary')
$$, '23503', null, 'Unknown muscle is rejected');
select throws_ok($$
  insert into public.exercise_muscles (exercise_id, muscle_key, role) values (tests.id('ex_a'), 'quads', 'tertiary')
$$, '22P02', null, 'Unknown muscle role is rejected');
select throws_ok($$
  insert into public.exercise_equipment (exercise_id, equipment_key) values (tests.id('ex_a'), 'hula_hoop')
$$, '23503', null, 'Unknown equipment is rejected');

select tests.login_as('coach_a');

select throws_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params, pace_effort)
  values (tests.id('workout_a'), tests.id('gym_a'), 1, 'B', 'conditioning', 'amrap', '{"time_s": 480}', 'brutal')
$$, '23503', null, 'Unknown pace effort is rejected');
select throws_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params, load_effort)
  values (tests.id('workout_a'), tests.id('gym_a'), 1, 'B', 'strength', 'sets', '{"sets": 3}', 'max')
$$, '23514', null, 'Load effort "max" is rejected on a block (pace-only level)');
select throws_ok($$
  insert into public.block_items (block_id, org_id, position, raw_line, quantity, load_effort)
  values (tests.id('block_a'), tests.id('gym_a'), 5, 'x', '{"type": "reps", "value": 1}', 'extreme')
$$, '23503', null, 'Unknown load effort is rejected on an item');
select throws_ok($$
  insert into public.block_items (block_id, org_id, position, raw_line, quantity, load_effort)
  values (tests.id('block_a'), tests.id('gym_a'), 5, 'x', '{"type": "reps", "value": 1}', 'max')
$$, '23514', null, 'Load effort "max" is rejected on an item');
select throws_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_a'), tests.id('gym_a'), 1, 'B', 'hypertrophy', 'sets', '{"sets": 3}')
$$, '22P02', null, 'Unknown block intent is rejected');
select throws_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_a'), tests.id('gym_a'), 1, 'B', 'conditioning', 'emom', '{"time_s": 600}')
$$, '22P02', null, 'Unknown block format is rejected');
select lives_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params, pace_effort, load_effort)
  values (tests.id('workout_a'), tests.id('gym_a'), 1, 'B', 'conditioning', 'amrap', '{"time_s": 480}', 'max', 'moderate')
$$, 'control: pace "max" with load "moderate" is accepted');

select tests.login_as('owner_a');

select throws_ok($$
  insert into public.memberships (org_id, user_id, role) values (tests.id('gym_a'), tests.id('outsider'), 'admin')
$$, '22P02', null, 'Unknown member role is rejected');

-- ---------------------------------------------------------------------------
-- The taxonomy itself is locked for every tenant role (owner shown)
-- ---------------------------------------------------------------------------
select throws_ok($$ insert into public.movement_patterns (key, region, label_en, label_is, position) values ('push', 'upper', 'Push', 'Ýta', 99) $$,
  '42501', null, 'Owner cannot add a movement pattern');
select throws_ok($$ insert into public.planes (key, label_en, label_is, position) values ('diagonal', 'Diagonal', 'Á ská', 99) $$,
  '42501', null, 'Owner cannot add a plane');
select throws_ok($$ insert into public.modalities (key, default_unit, label_en, label_is, position) values ('kayak', 'distance_m', 'Kayak', 'Kajak', 99) $$,
  '42501', null, 'Owner cannot add a modality');
select throws_ok($$ insert into public.muscles (key, region, label_en, label_is, position) values ('traps', 'upper', 'Traps', 'Sjalvöðvi', 99) $$,
  '42501', null, 'Owner cannot add a muscle');
select throws_ok($$ insert into public.equipment (key, label_en, label_is, position) values ('hula_hoop', 'Hula hoop', 'Húllahringur', 99) $$,
  '42501', null, 'Owner cannot add equipment');
select throws_ok($$ update public.effort_levels set rpe_calc = 5 where key = 'moderate' $$,
  '42501', null, 'Owner cannot change the effort mapping');
select throws_ok($$ delete from public.planes where key = 'frontal' $$,
  '42501', null, 'Owner cannot delete a plane');
select throws_ok($$ insert into public.taxonomy_versions (version, published_at) values (2, now()) $$,
  '42501', null, 'Owner cannot publish a taxonomy version');

select * from finish();
rollback;
