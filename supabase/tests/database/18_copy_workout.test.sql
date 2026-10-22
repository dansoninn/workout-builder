-- A workout on several dates (Step 5b): copy_workout makes one scheduled
-- draft per date, with its own ids and history; the source stays as it is;
-- the gym's coaches only; all or nothing.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(14);

insert into tests.ids (name) select unnest(array['tpl', 'c1', 'c2', 'c3', 'c4', 'c5']);

-- A template made from workout_a's content.
insert into public.workouts (id, org_id, kind, title) values (tests.id('tpl'), tests.id('gym_a'), 'template', 'Squat day (template)');
insert into public.blocks (workout_id, org_id, position, label, intent, format, params, load_effort, rest_after_s)
select tests.id('tpl'), org_id, position, label, intent, format, params, load_effort, 90 from public.blocks where id = tests.id('block_a');
insert into public.block_items (block_id, org_id, position, exercise_id, raw_line, quantity, load, implement_count)
select (select id from public.blocks where workout_id = tests.id('tpl')), org_id, position, exercise_id, raw_line, quantity, load, 2
  from public.block_items where block_id = tests.id('block_a') and exercise_id is not null;

create function tests.targets(variadic p_names text[])
returns jsonb
language sql
as $$
  select jsonb_agg(jsonb_build_object('id', tests.id(n), 'date', '2026-11-0' || ord, 'track_id', tests.id('track_a')) order by ord)
    from unnest(p_names) with ordinality as t(n, ord)
$$;

select has_function('public', 'copy_workout', array['uuid', 'uuid', 'jsonb'], 'copy_workout exists');

select tests.login_as('coach_a');
select is(public.copy_workout(tests.id('gym_a'), tests.id('tpl'), tests.targets('c1', 'c2', 'c3')), 3, 'A coach puts a template on three dates');
select results_eq(
  $$ select date::text, kind::text, status::text, title from public.workouts where id in (tests.id('c1'), tests.id('c2'), tests.id('c3')) order by date $$,
  $$ values ('2026-11-01', 'scheduled', 'draft', 'Squat day'), ('2026-11-02', 'scheduled', 'draft', 'Squat day'), ('2026-11-03', 'scheduled', 'draft', 'Squat day') $$,
  'Each date gets a scheduled draft, without "(template)"');
select results_eq(
  $$ select b.label, b.format::text, b.params, b.rest_after_s, i.raw_line, i.quantity, i.implement_count
       from public.blocks b join public.block_items i on i.block_id = b.id where b.workout_id = tests.id('c2') $$,
  $$ select b.label, b.format::text, b.params, b.rest_after_s, i.raw_line, i.quantity, i.implement_count
       from public.blocks b join public.block_items i on i.block_id = b.id where b.workout_id = tests.id('tpl') $$,
  'A copy has the same blocks and lines');
select isnt(
  (select id from public.blocks where workout_id = tests.id('c1')),
  (select id from public.blocks where workout_id = tests.id('tpl')),
  'with its own ids');
select is((select created_by from public.workouts where id = tests.id('c1')), tests.id('coach_a'), 'made by the coach');

-- The copies are independent of the template and of each other.
select lives_ok($$ update public.blocks set params = '{"sets": 3}' where workout_id = tests.id('c1') $$, 'A copy is changed');
select is((select params from public.blocks where workout_id = tests.id('tpl')), '{"sets": 5, "rest_s": 120}'::jsonb, 'and the template stays as it was');

-- All or nothing.
select throws_ok(
  $$ select public.copy_workout(tests.id('gym_a'), tests.id('tpl'), tests.targets('c4', 'c1')) $$,
  '23505', null, 'A copy that cannot be made stops the whole copy');
select is_empty($$ select 1 from public.workouts where id = tests.id('c4') $$, 'and nothing of it is saved');
select throws_ok(
  $$ select public.copy_workout(tests.id('gym_a'), tests.id('tpl'), '[]'::jsonb) $$,
  '22023', 'Copy to between 1 and 60 dates', 'At least one date');

-- Who may copy what.
select tests.login_as('viewer_a');
select throws_ok($$ select public.copy_workout(tests.id('gym_a'), tests.id('tpl'), tests.targets('c4')) $$, '42501', null, 'A viewer cannot copy');
select tests.login_as('owner_b');
select throws_ok($$ select public.copy_workout(tests.id('gym_b'), tests.id('tpl'), tests.targets('c5')) $$, 'P0002', 'The workout to copy does not exist',
  'Another gym cannot copy this gym''s template into its own');

-- Audit.
select tests.logout();
select is((select count(*)::int from public.audit_log where table_name = 'workouts' and action = 'insert' and row_id in (tests.id('c1'), tests.id('c2'), tests.id('c3'))), 3,
  'Every copy is in the audit log');

select * from finish();
rollback;
