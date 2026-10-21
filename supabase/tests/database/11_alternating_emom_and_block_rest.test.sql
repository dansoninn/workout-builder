-- Answers for 4b (Daniel, 2026-10-21): alternating EMOM is an option of the
-- `every` format; rest between blocks is stored per block (rest after it).

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(11);

-- ---------------------------------------------------------------------------
-- Alternating EMOM
-- ---------------------------------------------------------------------------
select tests.login_as('coach_a');

select lives_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_a'), tests.id('gym_a'), 10, 'B', 'conditioning', 'every',
          '{"interval_s": 60, "rounds": 12, "alternating": true}')
$$, 'every: alternating EMOM (minute 1: X, minute 2: Y …)');
select lives_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_a'), tests.id('gym_a'), 11, 'C', 'conditioning', 'every',
          '{"interval_s": 60, "rounds": 12, "alternating": false}')
$$, 'every: alternating can be stated as false');
select throws_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_a'), tests.id('gym_a'), 12, 'D', 'conditioning', 'every',
          '{"interval_s": 60, "rounds": 12, "alternating": "yes"}')
$$, '23514', null, 'every: alternating must be true or false');
select throws_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params)
  values (tests.id('workout_a'), tests.id('gym_a'), 12, 'D', 'conditioning', 'amrap',
          '{"time_s": 600, "alternating": true}')
$$, '23514', null, 'alternating belongs to every only');

-- ---------------------------------------------------------------------------
-- Rest between blocks
-- ---------------------------------------------------------------------------
select has_column('public', 'blocks', 'rest_after_s', 'blocks.rest_after_s exists');

select lives_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params, rest_after_s)
  values (tests.id('workout_a'), tests.id('gym_a'), 13, 'E', 'mobility', 'sets', '{"sets": 2}', 300)
$$, 'A block can carry the rest after it');
select throws_ok($$
  insert into public.blocks (workout_id, org_id, position, label, intent, format, params, rest_after_s)
  values (tests.id('workout_a'), tests.id('gym_a'), 14, 'F', 'mobility', 'sets', '{"sets": 2}', -60)
$$, '23514', null, 'Rest cannot be negative');
select isnt_empty($$ update public.blocks set rest_after_s = 180 where id = tests.id('block_a') returning 1 $$,
  'A coach sets the rest after a block');

select tests.login_as('viewer_a');
select is_empty($$ update public.blocks set rest_after_s = 0 where id = tests.id('block_a') returning 1 $$,
  'A viewer cannot change it');
select tests.login_as('coach_b');
select is_empty($$ update public.blocks set rest_after_s = 0 where id = tests.id('block_a') returning 1 $$,
  'Another gym cannot change it');

select tests.logout();
select results_eq(
  $$ select diff -> 'new' -> 'rest_after_s' from public.audit_log
     where table_name = 'blocks' and row_id = tests.id('block_a') and action = 'update' $$,
  $$ values ('180'::jsonb) $$,
  'The change is in the audit log');

select * from finish();
rollback;
