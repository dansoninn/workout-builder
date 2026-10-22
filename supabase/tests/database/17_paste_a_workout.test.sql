-- Paste a workout (Step 4c): the workout, its pasted text and the coach's
-- answers for generic words are saved together; a coach may answer a generic
-- word for the gym, nothing else; gym alias changes are audited.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(19);

insert into tests.ids (name) select unnest(array['p1', 'pb1', 'pi1', 'p2', 'pb2', 'pi2', 'p3', 'pb3', 'pi3']);

-- A pasted AMRAP with one line, as the app sends it.
create function tests.pasted(p_workout text, p_block text, p_item text, p_raw text default 'AMRAP 8\n10 squats')
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', tests.id(p_workout), 'track_id', tests.id('track_a'), 'kind', 'scheduled', 'date', '2026-10-22',
    'title', null, 'focus', null, 'raw_text', p_raw, 'parser_version', 1,
    'blocks', jsonb_build_array(jsonb_build_object(
      'id', tests.id(p_block), 'label', 'A', 'intent', 'conditioning', 'format', 'amrap', 'params', '{"time_s": 480}'::jsonb,
      'items', jsonb_build_array(jsonb_build_object(
        'id', tests.id(p_item), 'exercise_id', tests.id('core_squat'), 'raw_line', '10 squats',
        'quantity', '{"type": "reps", "value": 10}'::jsonb)))))
$$;

-- The core exercise a gym means by "squat" (any of the candidates).
create function tests.squat_candidate()
returns jsonb
language sql
as $$
  select jsonb_build_array(jsonb_build_object('term', 'squat', 'exercise_id',
    (select exercise_id from public.ambiguous_exercise_terms where term = 'squat' order by position limit 1)))
$$;

select has_function('public', 'save_pasted_workout', array['uuid', 'jsonb', 'jsonb'], 'save_pasted_workout exists');

-- A coach pastes, answering "squat" for the gym.
select tests.login_as('coach_a');
select is(
  public.save_pasted_workout(tests.id('gym_a'), tests.pasted('p1', 'pb1', 'pi1'), tests.squat_candidate()),
  tests.id('p1'), 'A coach saves a pasted workout');
select results_eq(
  $$ select raw_text, parser_version from public.workouts where id = tests.id('p1') $$,
  $$ values ('AMRAP 8\n10 squats'::text, 1) $$,
  'The text as pasted and the parser version are kept');
select is((select raw_line from public.block_items where id = tests.id('pi1')), '10 squats', 'Each line as it was written');
select is(
  (select exercise_id from public.exercise_aliases where org_id = tests.id('gym_a') and alias_normalized = 'squat'),
  (select exercise_id from public.ambiguous_exercise_terms where term = 'squat' order by position limit 1),
  'The answer for "squat" is the gym''s name for it now');
select is(
  public.save_pasted_workout(tests.id('gym_a'), tests.pasted('p2', 'pb2', 'pi2'), tests.squat_candidate()),
  tests.id('p2'), 'Answering a word the gym already has a name for changes nothing and does not fail');

-- What a coach may not do.
select throws_ok(
  $$ select public.save_pasted_workout(tests.id('gym_a'), tests.pasted('p3', 'pb3', 'pi3'),
       jsonb_build_array(jsonb_build_object('term', 'bs2', 'exercise_id', tests.id('core_squat')))) $$,
  '42501', null, 'A coach cannot name an ordinary word for the gym (owners and head coaches do that)');
select is_empty($$ select 1 from public.workouts where id = tests.id('p3') $$, 'and then nothing of that paste is saved');
select is_empty(
  $$ update public.exercise_aliases set exercise_id = tests.id('core_squat') where org_id = tests.id('gym_a') and alias_normalized = 'squat' returning 1 $$,
  'A coach cannot change the gym''s answer');
select is_empty($$ delete from public.exercise_aliases where org_id = tests.id('gym_a') and alias_normalized = 'squat' returning 1 $$,
  'Nor remove it');
select throws_ok(
  $$ select public.save_pasted_workout(tests.id('gym_a'), tests.pasted('p3', 'pb3', 'pi3', '  '), '[]'::jsonb) $$,
  '22023', 'A pasted workout keeps the text it was pasted from', 'The pasted text is required');

-- Head coaches and owners name any word; viewers and other gyms nothing.
select tests.login_as('head_a');
select lives_ok(
  $$ select public.save_pasted_workout(tests.id('gym_a'), tests.pasted('p3', 'pb3', 'pi3'),
       jsonb_build_array(jsonb_build_object('term', 'bs2', 'exercise_id', tests.id('core_squat')))) $$,
  'A head coach names an ordinary word for the gym while pasting');
select isnt_empty(
  $$ update public.exercise_aliases set exercise_id = tests.id('core_squat') where org_id = tests.id('gym_a') and alias_normalized = 'squat' returning 1 $$,
  'and changes the gym''s answer for "squat"');

select tests.login_as('viewer_a');
select throws_ok(
  $$ select public.save_pasted_workout(tests.id('gym_a'), tests.pasted('p1', 'pb1', 'pi1'), '[]'::jsonb) $$,
  '42501', null, 'A viewer cannot paste a workout');

select tests.login_as('coach_b');
select is_empty($$ select 1 from public.exercise_aliases where org_id = tests.id('gym_a') $$, 'Another gym sees none of the gym''s names');
select throws_ok(
  $$ insert into public.exercise_aliases (org_id, alias_normalized, exercise_id)
     values (tests.id('gym_a'), 'lunge', (select exercise_id from public.ambiguous_exercise_terms where term = 'lunge' limit 1)) $$,
  '42501', null, 'Nor answers a generic word for it');

-- The builder's later saves keep the pasted text.
select tests.login_as('coach_a');
select lives_ok(
  $$ select public.save_workout(tests.id('gym_a'), tests.pasted('p1', 'pb1', 'pi1') - 'raw_text' - 'parser_version' || '{"title": "Edited"}') $$,
  'The coach edits the pasted workout in the builder');
select is((select raw_text from public.workouts where id = tests.id('p1')), 'AMRAP 8\n10 squats', 'and the pasted text stays');

-- Audit.
select tests.logout();
select results_eq(
  $$ select action::text, actor_id from public.audit_log where table_name = 'exercise_aliases' and org_id = tests.id('gym_a') and row_id <> tests.id('alias_a') order by id $$,
  $$ values ('insert', tests.id('coach_a')), ('insert', tests.id('head_a')), ('update', tests.id('head_a')) $$,
  'Every change to the gym''s names is in the audit log, with who made it');

select * from finish();
rollback;
