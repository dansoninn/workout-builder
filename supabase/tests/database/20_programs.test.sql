-- Programs (the `tracks` table; Afrek launch requirements, Daniel's decisions
-- of 2026-10-23): every workout has a program of its own gym; no new workout
-- on an archived program; unique active names; the order is set by owners and
-- head coaches only; a gym keeps at least one active program.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(22);

insert into tests.ids (name) select unnest(array['strength', 'old', 'w_new', 'w_copy', 'tpl']);
insert into public.tracks (id, org_id, name, color, position) values
  (tests.id('strength'), tests.id('gym_a'), 'Strength club', '#2F7FD8', 1),
  (tests.id('old'),      tests.id('gym_a'), 'Old program',   '#7A7F8A', 2);
update public.tracks set archived_at = now() where id = tests.id('old');
insert into public.workouts (id, org_id, track_id, kind, title) values (tests.id('tpl'), tests.id('gym_a'), tests.id('track_a'), 'template', 'T');

create function tests.workout(p_track text, p_title text default 'New')
returns jsonb
language sql
as $$
  select jsonb_build_object('id', tests.id('w_new'), 'track_id', tests.id(p_track), 'kind', 'scheduled', 'date', '2026-10-23',
    'title', p_title, 'focus', null, 'blocks', '[]'::jsonb)
$$;

-- Every workout has a program.
select col_not_null('public', 'workouts', 'track_id', 'A workout always has a program');
select tests.login_as('coach_a');
select throws_ok($$ insert into public.workouts (org_id, kind, date, title) values (tests.id('gym_a'), 'scheduled', '2026-10-23', 'x') $$,
  '23502', null, 'A workout without a program is refused');
select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout('track_a') || '{"track_id": null}') $$,
  '23502', null, 'Also through save_workout');

-- Only the gym's own programs.
select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout('track_b')) $$,
  '23503', null, 'Another gym''s program cannot be used through save_workout');
select throws_ok(
  $$ select public.copy_workout(tests.id('gym_a'), tests.id('tpl'), jsonb_build_array(jsonb_build_object('id', tests.id('w_copy'), 'date', '2026-11-02', 'track_id', tests.id('track_b')))) $$,
  '23503', null, 'Nor through copy_workout');
select is_empty($$ update public.tracks set name = 'Mine' where id = tests.id('track_b') returning 1 $$,
  'Nor can another gym''s program be changed');

-- No new workout on an archived program; workouts already there stay editable.
select throws_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout('old')) $$,
  '23514', 'That program is archived: restore it in Settings, or choose another program', 'Not by saving');
select throws_ok(
  $$ select public.copy_workout(tests.id('gym_a'), tests.id('tpl'), jsonb_build_array(jsonb_build_object('id', tests.id('w_copy'), 'date', '2026-11-02', 'track_id', tests.id('old')))) $$,
  '23514', null, 'Not by copying a template');
select throws_ok($$ update public.workouts set track_id = tests.id('old') where id = tests.id('workout_a') $$,
  '23514', null, 'Not by moving');
select lives_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout('strength')) $$, 'On an active program it saves');
select tests.logout();
update public.tracks set archived_at = now() where id = tests.id('strength');
select tests.login_as('coach_a');
select lives_ok($$ select public.save_workout(tests.id('gym_a'), tests.workout('strength', 'Renamed')) $$,
  'A workout already on a program that was archived can still be edited');
select tests.logout();
update public.tracks set archived_at = null where id = tests.id('strength');

-- Unique names among active programs.
select tests.login_as('owner_a');
select throws_ok($$ insert into public.tracks (org_id, name, position) values (tests.id('gym_a'), ' class ', 5) $$,
  '23505', null, 'Two active programs cannot share a name (any case, any spaces)');
select lives_ok($$ insert into public.tracks (org_id, name, position, archived_at) values (tests.id('gym_a'), 'Strength club', 5, now()) $$,
  'An archived program may share an active one''s name');
select tests.login_as('owner_b');
select throws_ok($$ update public.tracks set archived_at = now() where id = tests.id('track_b') $$,
  '23514', 'A gym keeps at least one active program: create or restore another before archiving this one',
  'The last active program cannot be archived');
select lives_ok($$ insert into public.tracks (org_id, name, position) values (tests.id('gym_b'), 'Strength club', 1) $$,
  'Another gym may use the same name');
select lives_ok($$ update public.tracks set archived_at = now() where id = tests.id('track_b') $$,
  'With another active program, it can');
select tests.login_as('owner_a');
select throws_ok(
  $$ update public.tracks set archived_at = null where org_id = tests.id('gym_a') and name = 'Strength club' and archived_at is not null $$,
  '23505', null, 'Restoring a program whose name is taken is refused');

-- The order.
select lives_ok(
  $$ select public.reorder_programs(tests.id('gym_a'), (select array_agg(id order by position desc, name) from public.tracks where org_id = tests.id('gym_a'))) $$,
  'An owner sets the programs'' order');
select is((select array_agg(name order by position) from public.tracks where org_id = tests.id('gym_a')),
  array['Strength club', 'Old program', 'Strength club', 'Class'], 'The order is kept');
select throws_ok($$ select public.reorder_programs(tests.id('gym_a'), array[tests.id('track_a')]) $$,
  '22023', 'Give every program of the gym once', 'Every program, once');
select tests.login_as('coach_a');
select throws_ok(
  $$ select public.reorder_programs(tests.id('gym_a'), (select array_agg(id) from public.tracks where org_id = tests.id('gym_a'))) $$,
  '42501', null, 'A coach cannot reorder');
select tests.login_as('owner_b');
select throws_ok(
  $$ select public.reorder_programs(tests.id('gym_a'), array[tests.id('track_a')]) $$,
  '42501', null, 'Nor another gym''s owner');

select * from finish();
rollback;
