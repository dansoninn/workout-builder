-- Program import (item 5 of Daniel's list, 2026-10-23): an import is a
-- coach's draft until committed in one transaction; it makes workouts in its
-- own program only, with their text; it can be undone, bringing back what it
-- replaced. Never across gyms; viewers do not import.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(30);

insert into tests.ids (name) select unnest(array['batch', 'batch_b', 'new_1', 'new_2', 'blk_1', 'itm_1', 'blk_2', 'itm_2', 'squat']);
insert into public.day_focuses (id, org_id, name) values (tests.id('squat'), tests.id('gym_a'), 'Squat');

create function tests.imported(p_id text, p_date text, p_block text, p_item text, p_publish boolean default false)
returns jsonb
language sql
as $$
  select jsonb_build_object('id', tests.id(p_id), 'track_id', tests.id('track_a'), 'kind', 'scheduled', 'date', p_date, 'title', 'Imported',
    'raw_text', 'AMRAP 12' || chr(10) || '10 squats', 'parser_version', 3, 'publish', p_publish,
    'blocks', jsonb_build_array(jsonb_build_object('id', tests.id(p_block), 'label', 'A', 'intent', 'conditioning', 'format', 'amrap',
      'params', '{"time_s": 720}'::jsonb, 'pace_effort', 'hard',
      'items', jsonb_build_array(jsonb_build_object('id', tests.id(p_item), 'exercise_id', tests.id('core_squat'), 'raw_line', '10 squats',
        'quantity', '{"type": "reps", "value": 10}'::jsonb)))))
$$;

select has_table('public', 'import_batches', 'Imports are kept while a coach works on them');

-- A coach starts one; a viewer and another gym cannot see it.
select tests.login_as('coach_a');
select lives_ok($$ insert into public.import_batches (id, org_id, track_id, source_name, source_kind, document, answers)
  values (tests.id('batch'), tests.id('gym_a'), tests.id('track_a'), 'plan-2026.xlsx', 'xlsx', '{"kind": "grid", "sheets": []}', '{"words": {}}') $$,
  'A coach starts an import');
select lives_ok($$ update public.import_batches set answers = '{"words": {"squat": "x"}}' where id = tests.id('batch') $$, 'and saves answers to resume later');
select throws_ok($$ insert into public.import_batches (org_id, track_id, source_name, source_kind, document, status)
  values (tests.id('gym_a'), tests.id('track_a'), 'x', 'text', '{}', 'committed') $$, '42501', null, 'An import starts as a draft');
select throws_ok($$ insert into public.import_batches (org_id, track_id, source_name, source_kind, document)
  values (tests.id('gym_a'), tests.id('track_b'), 'x', 'text', '{}') $$, '23503', null, 'into one of its own gym''s programs');
select tests.login_as('viewer_a');
select is_empty($$ select 1 from public.import_batches $$, 'A viewer does not see imports');
select throws_ok($$ insert into public.import_batches (org_id, track_id, source_name, source_kind, document)
  values (tests.id('gym_a'), tests.id('track_a'), 'x', 'text', '{}') $$, '42501', null, 'nor starts one');
select tests.login_as('owner_b');
select is_empty($$ select 1 from public.import_batches $$, 'Another gym sees none');
select throws_ok($$ select public.commit_import(tests.id('gym_a'), tests.id('batch'), '[]'::jsonb) $$, '42501', null, 'nor commits it');

-- Committing: a coach, in one transaction.
select tests.login_as('coach_a');
select throws_ok(
  $$ select public.commit_import(tests.id('gym_a'), tests.id('batch'), jsonb_build_array(tests.imported('new_1', '2026-11-02', 'blk_1', 'itm_1')),
     p_focuses => array['Engine']) $$,
  '42501', null, 'A coach''s import does not add to the gym''s list of focuses');
select is_empty($$ select 1 from public.workouts where id = tests.id('new_1') $$, 'and nothing of it is made (one transaction)');
select throws_ok(
  $$ select public.commit_import(tests.id('gym_a'), tests.id('batch'),
     jsonb_build_array(tests.imported('new_1', '2026-11-02', 'blk_1', 'itm_1') || jsonb_build_object('track_id', tests.id('track_b')))) $$,
  '22023', 'An import makes workouts in its own program', 'Only in the import''s program');
select throws_ok(
  $$ select public.commit_import(tests.id('gym_a'), tests.id('batch'), jsonb_build_array(tests.imported('workout_a', '2026-11-02', 'blk_1', 'itm_1'))) $$,
  '22023', 'An import makes new workouts', 'Never over a workout that exists');
select is(
  public.commit_import(tests.id('gym_a'), tests.id('batch'),
    jsonb_build_array(tests.imported('new_1', '2026-10-20', 'blk_1', 'itm_1', true), tests.imported('new_2', '2026-10-21', 'blk_2', 'itm_2')),
    p_replace => array[tests.id('workout_a'), tests.id('workout_b')],
    p_days => '[{"date": "2026-10-20", "focus": "squat"}]'::jsonb,
    p_summary => '{"days": 2}'::jsonb),
  '{"workouts": 2, "replaced": 1}'::jsonb,
  'The coach commits it: two workouts made, the program''s workout that day replaced');
select results_eq(
  $$ select status::text, raw_text, parser_version, import_batch_id = tests.id('batch') from public.workouts where id in (tests.id('new_1'), tests.id('new_2')) order by date $$,
  $$ values ('published'::text, 'AMRAP 12' || chr(10) || '10 squats', 3, true), ('draft', 'AMRAP 12' || chr(10) || '10 squats', 3, true) $$,
  'Each keeps its text and the parser version; published when asked, else a draft');
select isnt((select deleted_at from public.workouts where id = tests.id('workout_a')), null, 'The replaced workout is deleted (kept, as any delete)');
select tests.logout();
select is((select deleted_at from public.workouts where id = tests.id('workout_b')), null, 'Another gym''s workout is never replaced');
select tests.login_as('coach_a');
select is((select f.name from public.program_days d join public.day_focuses f on f.id = d.focus_id where d.date = '2026-10-20' and d.track_id = tests.id('track_a')), 'Squat',
  'The day''s focus is set, by name');
select results_eq($$ select status::text, (summary ->> 'days')::int from public.import_batches where id = tests.id('batch') $$,
  $$ values ('committed'::text, 2) $$, 'The import is done, with its summary');
select throws_ok($$ select public.commit_import(tests.id('gym_a'), tests.id('batch'), '[]'::jsonb) $$, '22023', 'This import is already done', 'and cannot be committed twice');
select is_empty($$ delete from public.import_batches where id = tests.id('batch') returning 1 $$, 'and a done import is never thrown away');

-- Owners and head coaches: the gym's focuses and closed days come with it.
select tests.login_as('head_a');
insert into public.import_batches (id, org_id, track_id, source_name, source_kind, document) values (tests.id('batch_b'), tests.id('gym_a'), tests.id('track_a'), 'b.csv', 'csv', '{}');
select lives_ok($$ select public.commit_import(tests.id('gym_a'), tests.id('batch_b'), '[]'::jsonb, p_focuses => array['Engine'],
  p_days => '[{"date": "2026-10-22", "focus": "Engine"}]'::jsonb, p_closed => '[{"date": "2026-12-25", "name": "Jóladagur"}]'::jsonb,
  p_aliases => jsonb_build_array(jsonb_build_object('term', 'deep squat', 'exercise_id', tests.id('core_squat')))) $$,
  'A head coach''s import adds a day focus, a closed day and a name for a word');
select is((select exercise_id from public.exercise_aliases where org_id = tests.id('gym_a') and alias_normalized = 'deep squat'), tests.id('core_squat'), 'The word is the gym''s name now');
select is((select count(*)::int from public.calendar_days where import_batch_id = tests.id('batch_b')), 1, 'The closed day is the import''s');

-- Undo: the import's workouts go, what it replaced comes back, its days are cleared.
select tests.login_as('coach_a');
select is(public.undo_import(tests.id('gym_a'), tests.id('batch')), '{"removed": 2, "restored": 1}'::jsonb, 'A coach undoes the import');
select is((select count(*)::int from public.workouts where import_batch_id = tests.id('batch') and deleted_at is null), 0, 'Its workouts are gone');
select is((select deleted_at from public.workouts where id = tests.id('workout_a')), null, 'and the replaced workout is back');
select is_empty($$ select 1 from public.program_days where import_batch_id = tests.id('batch') $$, 'Its day focuses are cleared');
select throws_ok($$ select public.undo_import(tests.id('gym_a'), tests.id('batch')) $$, '22023', null, 'An import is undone once');
select tests.logout();
select is((select count(*)::int from public.audit_log where table_name = 'import_batches' and row_id = tests.id('batch')), 2, 'The commit and the undo are in the audit log');

select * from finish();
rollback;
