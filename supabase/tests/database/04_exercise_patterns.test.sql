-- Movement patterns on exercises (SPEC-data-model §5):
--   * weights per exercise must sum to exactly 1.00
--   * monostructural exercises have no patterns (approved 2026-10-21)
-- The sum check is deferred to commit, so weights can be written in several
-- statements. Tests never commit, so after the first test the check is made
-- IMMEDIATE: each statement is then checked as if it were committed alone.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(21);

insert into tests.ids (name) values ('w1'), ('w2'), ('w3'), ('w4'), ('w5');
insert into public.exercises (id, org_id, name, slug, kind, default_unit) values
  (tests.id('w1'), tests.id('gym_a'), 'Weights 1', 'weights-1', 'movement', 'reps'),
  (tests.id('w2'), tests.id('gym_a'), 'Weights 2', 'weights-2', 'movement', 'reps'),
  (tests.id('w3'), tests.id('gym_a'), 'Weights 3', 'weights-3', 'movement', 'reps'),
  (tests.id('w4'), tests.id('gym_a'), 'Weights 4', 'weights-4', 'movement', 'reps');
insert into public.exercises (id, org_id, name, slug, kind, modality, default_unit) values
  (tests.id('w5'), tests.id('gym_a'), 'Gym bike', 'gym-bike', 'monostructural', 'bike', 'calories');

-- Deferred: a valid split written in two statements passes at commit time.
insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('w1'), 'squat', 0.60);
insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('w1'), 'v_push', 0.40);
select lives_ok($$ set constraints public.exercise_patterns_weights_sum_to_one immediate $$,
  'Weights written in two statements (0.60 + 0.40) pass the commit-time check');

-- From here on, every statement is checked immediately.
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight)
  values (tests.id('w2'), 'squat', 0.60), (tests.id('w2'), 'v_push', 0.30)
$$, '23514', null, 'Weights summing to 0.90 are rejected');
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight)
  values (tests.id('w2'), 'squat', 0.60), (tests.id('w2'), 'v_push', 0.50)
$$, '23514', null, 'Weights summing to 1.10 are rejected');
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('w2'), 'squat', 0.99)
$$, '23514', null, 'A single weight of 0.99 is rejected');
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight)
  values (tests.id('w2'), 'squat', 0.33), (tests.id('w2'), 'hinge', 0.33), (tests.id('w2'), 'core', 0.33)
$$, '23514', null, 'Three-way split summing to 0.99 is rejected');
select lives_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight)
  values (tests.id('w2'), 'squat', 0.34), (tests.id('w2'), 'hinge', 0.33), (tests.id('w2'), 'core', 0.33)
$$, 'Three-way split summing to 1.00 is accepted');

select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('w2'), 'jump', 0.10)
$$, '23514', null, 'Adding a pattern to a complete set is rejected');
select throws_ok($$
  update public.exercise_patterns set weight = 0.40 where exercise_id = tests.id('w2') and pattern_key = 'squat'
$$, '23514', null, 'Changing one weight so the sum breaks is rejected');
select throws_ok($$
  delete from public.exercise_patterns where exercise_id = tests.id('w2') and pattern_key = 'core'
$$, '23514', null, 'Removing one pattern so the sum breaks is rejected');
select lives_ok($$
  update public.exercise_patterns
  set weight = case pattern_key when 'squat' then 0.50 else 0.25 end
  where exercise_id = tests.id('w2')
$$, 'Rebalancing all weights in one statement is accepted');
select lives_ok($$ delete from public.exercise_patterns where exercise_id = tests.id('w2') $$,
  'Removing all patterns is accepted (monostructural or not yet curated)');

-- Each weight must be in (0, 1]
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('w3'), 'squat', 0)
$$, '23514', null, 'A weight of 0 is rejected');
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('w3'), 'squat', 1.50)
$$, '23514', null, 'A weight above 1 is rejected');
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight)
  values (tests.id('w3'), 'squat', 1.50), (tests.id('w3'), 'hinge', -0.50)
$$, '23514', null, 'Negative weights are rejected even when the sum is 1.00');

-- The rule holds for the head coach writing through the API as well.
select tests.login_as('head_a');
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight)
  values (tests.id('w4'), 'hinge', 0.70), (tests.id('w4'), 'v_pull', 0.20)
$$, '23514', null, 'Head coach: weights summing to 0.90 are rejected');
select lives_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight)
  values (tests.id('w4'), 'hinge', 0.70), (tests.id('w4'), 'v_pull', 0.30)
$$, 'Head coach: weights summing to 1.00 are accepted');

select tests.logout();
select results_eq($$
  select pattern_key || ' ' || weight from public.exercise_patterns
  where exercise_id = tests.id('w4') order by pattern_key
$$, array['hinge 0.70', 'v_pull 0.30'], 'Only the valid weights were stored');

-- ---------------------------------------------------------------------------
-- Monostructural exercises have no movement patterns
-- ---------------------------------------------------------------------------
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('core_row'), 'h_pull', 1.00)
$$, '23514', null, 'A monostructural core exercise cannot get patterns, not even from the service role');

select tests.login_as('head_a');
select throws_ok($$
  insert into public.exercise_patterns (exercise_id, pattern_key, weight) values (tests.id('w5'), 'squat', 1.00)
$$, '23514', null, 'Head coach: a monostructural gym exercise cannot get patterns');
select throws_ok($$
  update public.exercises set kind = 'monostructural', modality = 'row' where id = tests.id('ex_a')
$$, '23514', null, 'An exercise with patterns cannot be turned monostructural');
select lives_ok($$
  update public.exercises set kind = 'monostructural', modality = 'row', default_unit = 'distance_m' where id = tests.id('w2')
$$, 'An exercise without patterns can be turned monostructural');

select * from finish();
rollback;
