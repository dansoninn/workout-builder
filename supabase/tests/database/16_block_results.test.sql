-- Block results (Step 4d): coaches log what the group did in AMRAP and For
-- Time blocks; everyone in the gym reads them; other gyms see nothing. Results
-- are soft-deleted and audited, and a block keeps its results.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(34);

-- An AMRAP 8 and a For Time block with a 15-minute cap in gym A, and a template.
insert into tests.ids (name) values ('amrap_a'), ('for_time_a'), ('template_a'), ('template_block_a'), ('result_1'), ('result_2');
insert into public.blocks (id, workout_id, org_id, position, label, intent, format, params, pace_effort) values
  (tests.id('amrap_a'),    tests.id('workout_a'), tests.id('gym_a'), 1, 'B', 'conditioning', 'amrap',    '{"time_s": 480}', 'hard'),
  (tests.id('for_time_a'), tests.id('workout_a'), tests.id('gym_a'), 2, 'C', 'conditioning', 'for_time', '{"rounds": 3, "time_cap_s": 900}', 'hard');
insert into public.workouts (id, org_id, track_id, kind, title) values (tests.id('template_a'), tests.id('gym_a'), tests.id('track_a'), 'template', 'T');
insert into public.blocks (id, workout_id, org_id, position, label, intent, format, params) values
  (tests.id('template_block_a'), tests.id('template_a'), tests.id('gym_a'), 0, 'A', 'conditioning', 'amrap', '{"time_s": 600}');

select has_table('public', 'block_results', 'block_results exists');

-- Logging, by role.
select tests.login_as('coach_a');
select lives_ok($$
  insert into public.block_results (id, org_id, block_id, session_label, rounds_low, rounds_high, note, logged_by)
  values (tests.id('result_1'), tests.id('gym_a'), tests.id('amrap_a'), '06:00', 6.5, 8.25, 'Scaled DU to singles', tests.id('owner_a'))
$$, 'A coach logs the rounds the group reached');
select is((select logged_by from public.block_results where id = tests.id('result_1')), tests.id('coach_a'),
  'The result is logged as the coach who did it, whatever the app sends');
select lives_ok($$
  insert into public.block_results (id, org_id, block_id, finish_low_s, finish_high_s)
  values (tests.id('result_2'), tests.id('gym_a'), tests.id('for_time_a'), 570, 900)
$$, 'A coach logs finish times, the capped counting as the cap');
select lives_ok($$
  insert into public.block_results (org_id, block_id, session_label, rounds_low, rounds_high)
  values (tests.id('gym_a'), tests.id('amrap_a'), '17:30', 7, 9)
$$, 'Another class, another result for the same block');

select tests.login_as('head_a');
select lives_ok($$
  insert into public.block_results (org_id, block_id, rounds_low, rounds_high) values (tests.id('gym_a'), tests.id('amrap_a'), 7, 7)
$$, 'A head coach logs results');

select tests.login_as('viewer_a');
select is((select count(*)::int from public.block_results where block_id = tests.id('amrap_a')), 3, 'A viewer reads the gym''s results');
select throws_ok($$
  insert into public.block_results (org_id, block_id, rounds_low, rounds_high) values (tests.id('gym_a'), tests.id('amrap_a'), 7, 8)
$$, '42501', null, 'A viewer cannot log results');
select is_empty($$ update public.block_results set note = 'x' where org_id = tests.id('gym_a') returning 1 $$,
  'A viewer cannot change results');

-- Gym isolation.
select tests.login_as('owner_b');
select is_empty($$ select 1 from public.block_results where org_id = tests.id('gym_a') $$, 'Another gym sees none of them');
select throws_ok($$
  insert into public.block_results (org_id, block_id, rounds_low, rounds_high) values (tests.id('gym_a'), tests.id('amrap_a'), 1, 1)
$$, '23503', 'The block does not exist', 'Another gym cannot log results in this gym (it cannot even see the block)');
select throws_ok($$
  insert into public.block_results (org_id, block_id, rounds_low, rounds_high) values (tests.id('gym_b'), tests.id('amrap_a'), 1, 1)
$$, '23503', null, 'Nor attach its own result to this gym''s block');
select is_empty($$ update public.block_results set note = 'x' where org_id = tests.id('gym_a') returning 1 $$,
  'Nor change this gym''s results');

-- The rules, against the block (the full list of cases is in 14_rule_cases).
select tests.login_as('coach_a');
select throws_ok($$
  insert into public.block_results (org_id, block_id, finish_low_s, finish_high_s) values (tests.id('gym_a'), tests.id('amrap_a'), 500, 600)
$$, '23514', 'An AMRAP result is the rounds the group reached', 'An AMRAP result is rounds, not finish times');
select throws_ok($$
  insert into public.block_results (org_id, block_id, finish_low_s, finish_high_s) values (tests.id('gym_a'), tests.id('for_time_a'), 600, 960)
$$, '23514', 'No finish can be over the time cap; anyone capped counts as the cap', 'No finish over the time cap');
select throws_ok($$
  insert into public.block_results (org_id, block_id, rounds_low, rounds_high) values (tests.id('gym_a'), tests.id('amrap_a'), 9, 7)
$$, '23514', 'Fewest rounds must not be more than most rounds', 'Fewest rounds at most the most');
select throws_ok($$
  insert into public.block_results (org_id, block_id, rounds_low, rounds_high) values (tests.id('gym_a'), tests.id('block_a'), 5, 5)
$$, '23514', 'Results are logged for AMRAP and For time blocks', 'No results for a strength block');
select throws_ok($$
  insert into public.block_results (org_id, block_id, rounds_low, rounds_high) values (tests.id('gym_a'), tests.id('template_block_a'), 5, 5)
$$, '23514', 'Results are logged on workouts in the calendar, not on templates', 'No results on a template');
select throws_ok($$
  insert into public.block_results (org_id, block_id, rounds_low, rounds_high, session_label) values (tests.id('gym_a'), tests.id('amrap_a'), 5, 5, ' 06:00 ')
$$, '23514', null, 'The class label is stored trimmed');

-- AMRAP rounds as written ("7 + 12"), stored next to the rounds they came to.
select lives_ok($$
  insert into public.block_results (org_id, block_id, rounds_low, rounds_high, raw_text) values (tests.id('gym_a'), tests.id('amrap_a'), 7.58, 7.58, '7 + 12')
$$, 'A result keeps the rounds as written');
select throws_ok($$
  insert into public.block_results (org_id, block_id, rounds_low, rounds_high, raw_text) values (tests.id('gym_a'), tests.id('amrap_a'), 7, 7, ' 7 ')
$$, '23514', null, 'Written text is stored trimmed');

-- Editing, pinning, soft delete.
select isnt_empty($$
  update public.block_results set rounds_high = 8.5 where id = tests.id('result_1') returning 1
$$, 'A coach corrects a result');
select throws_ok($$ update public.block_results set block_id = tests.id('for_time_a') where id = tests.id('result_1') $$,
  '23514', null, 'A result stays with its block');
select throws_ok($$ update public.block_results set logged_by = tests.id('head_a') where id = tests.id('result_1') $$,
  '23514', null, 'Who logged it stays');
select throws_ok($$ delete from public.block_results where id = tests.id('result_1') $$,
  '42501', null, 'Results are never removed, only marked deleted');

-- A block keeps its results.
select throws_ok($$ delete from public.blocks where id = tests.id('amrap_a') $$,
  '23514', 'Block B has results logged for it. Remove those results first, or keep the block.',
  'A block with results cannot be removed');
select throws_ok($$ update public.blocks set format = 'for_time', params = '{"rounds": 1}' where id = tests.id('amrap_a') $$,
  '23514', 'Block B has results logged for it, so its format must stay AMRAP. Remove those results first.',
  'Nor change its format');
select isnt_empty($$ update public.blocks set params = '{"time_s": 600}' where id = tests.id('amrap_a') returning 1 $$,
  'Its other settings can change');
select isnt_empty($$
  update public.block_results set deleted_at = now() where block_id = tests.id('amrap_a') returning 1
$$, 'A coach removes the results (soft delete)');
select lives_ok($$ delete from public.blocks where id = tests.id('amrap_a') $$,
  'Then the block can go, and its removed results with it');

-- Audit, and hard deletes that cascade from a workout.
select tests.logout();
select results_eq(
  $$ select action::text from public.audit_log where table_name = 'block_results' and row_id = tests.id('result_1') order by id $$,
  $$ values ('insert'), ('update'), ('update'), ('delete') $$,
  'Every change to a result is in the audit log');
select is(
  (select actor_id from public.audit_log where table_name = 'block_results' and row_id = tests.id('result_1') order by id limit 1),
  tests.id('coach_a'), 'With who made it');
select lives_ok($$ delete from public.workouts where id = tests.id('workout_a') $$,
  'Deleting a whole workout for good (not possible in the app) takes its results along');
select is((select count(*)::int from public.block_results where org_id = tests.id('gym_a')), 0, 'Nothing is left behind');

select * from finish();
rollback;
