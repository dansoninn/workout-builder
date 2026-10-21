-- Profiles on signup, the append-only audit log (SPEC-data-model §7), and
-- what happens when a gym or a user is deleted.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(22);

-- ---------------------------------------------------------------------------
-- Profiles are created on signup
-- ---------------------------------------------------------------------------
insert into tests.ids (name) values ('new_plain'), ('new_is'), ('new_de'), ('audit_workout');
insert into auth.users (id, email, raw_user_meta_data) values
  (tests.id('new_plain'), 'plain@example.test', null),
  (tests.id('new_is'),    'is@example.test',    '{"full_name": "Jón Jónsson", "locale": "is"}'),
  (tests.id('new_de'),    'de@example.test',    '{"locale": "de"}');

select results_eq($$ select display_name from public.profiles where id = tests.id('owner_a') $$,
  array['owner_a'], 'Signup creates a profile with the display name from sign-up data');
select results_eq($$ select coalesce(display_name, '(none)') || ' / ' || locale from public.profiles where id = tests.id('new_plain') $$,
  array['(none) / en'], 'Without sign-up data: no name, English');
select results_eq($$ select display_name || ' / ' || locale from public.profiles where id = tests.id('new_is') $$,
  array['Jón Jónsson / is'], 'full_name and Icelandic locale are picked up');
select results_eq($$ select locale from public.profiles where id = tests.id('new_de') $$,
  array['en'], 'An unsupported locale falls back to English');

-- ---------------------------------------------------------------------------
-- Audit log records who changed what
-- ---------------------------------------------------------------------------
select tests.login_as('coach_a');
insert into public.workouts (id, org_id, kind, title) values (tests.id('audit_workout'), tests.id('gym_a'), 'template', 'Before');
update public.workouts set title = 'After' where id = tests.id('audit_workout');
update public.workouts set title = 'After' where id = tests.id('audit_workout');
delete from public.blocks where id = tests.id('block_a');

select tests.login_as('owner_a');
update public.memberships set role = 'head_coach' where user_id = tests.id('coach_a') and org_id = tests.id('gym_a');

select tests.logout();

select results_eq($$
  select action::text || ' by ' || (actor_id = tests.id('coach_a')) || ' in ' || (org_id = tests.id('gym_a'))
  from public.audit_log where table_name = 'workouts' and row_id = tests.id('audit_workout') order by id
$$, array['insert by true in true', 'update by true in true'],
  'Creating and editing a workout is logged with actor and gym (no-op edit not logged)');
select results_eq($$
  select diff from public.audit_log
  where table_name = 'workouts' and row_id = tests.id('audit_workout') and action = 'update'
$$, array['{"old": {"title": "Before"}, "new": {"title": "After"}}'::jsonb],
  'An update logs only the changed columns, old and new');
select results_eq($$
  select (diff -> 'old' ->> 'label') from public.audit_log
  where table_name = 'blocks' and row_id = tests.id('block_a') and action = 'delete'
$$, array['A'], 'Deleting a block keeps a full copy of it in the log');
select results_eq($$
  select count(*) from public.audit_log
  where table_name = 'block_items' and action = 'delete'
    and row_id in (tests.id('item_a_matched'), tests.id('item_a_unmatched'))
$$, array[2::bigint], '... and of the items that went with it');
select results_eq($$
  select diff from public.audit_log
  where table_name = 'memberships' and row_id = tests.id('coach_a') and action = 'update'
$$, array['{"old": {"role": "coach"}, "new": {"role": "head_coach"}}'::jsonb],
  'A role change is logged against the member');

select tests.login_as('viewer_a');
select isnt_empty($$ select 1 from public.audit_log where org_id = tests.id('gym_a') $$,
  'Viewers can read their gym''s audit log');

-- Append-only, for gym users and for the database owner alike
select tests.login_as('owner_a');
select throws_ok($$ update public.audit_log set diff = '{}' $$, '42501', null, 'Owner cannot edit the audit log');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'Owner cannot delete from the audit log');

select tests.logout();
select throws_ok($$ update public.audit_log set diff = '{}' $$, '42501', null, 'Not even the database owner can edit the audit log');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'Not even the database owner can delete from it');
select throws_ok($$ truncate public.audit_log $$, '42501', null, 'Not even the database owner can truncate it');

-- ---------------------------------------------------------------------------
-- Deleting a gym (service operation) removes its data; history survives
-- ---------------------------------------------------------------------------
select lives_ok($$ delete from public.organizations where id = tests.id('gym_b') $$,
  'A gym can be deleted by the service role');
select results_eq($$
  select (select count(*) from public.memberships where org_id = tests.id('gym_b'))
       + (select count(*) from public.tracks where org_id = tests.id('gym_b'))
       + (select count(*) from public.exercises where org_id = tests.id('gym_b'))
       + (select count(*) from public.exercise_aliases where org_id = tests.id('gym_b'))
       + (select count(*) from public.workouts where org_id = tests.id('gym_b'))
       + (select count(*) from public.blocks where org_id = tests.id('gym_b'))
       + (select count(*) from public.block_items where org_id = tests.id('gym_b'))
       + (select count(*) from public.workout_metrics where org_id = tests.id('gym_b'))
$$, array[0::bigint], '... and all of its data goes with it');
select isnt_empty($$ select 1 from public.audit_log where org_id = tests.id('gym_b') $$,
  '... while its audit history is kept');
select isnt_empty($$ select 1 from public.profiles where id = tests.id('owner_b') $$,
  '... and its users keep their accounts');

-- ---------------------------------------------------------------------------
-- Deleting a user
-- ---------------------------------------------------------------------------
select lives_ok($$ delete from auth.users where id = tests.id('coach_a') $$,
  'A coach''s account can be deleted');
select results_eq($$ select title || ' / author ' || coalesce(created_by::text, 'cleared') from public.workouts where id = tests.id('audit_workout') $$,
  array['After / author cleared'], '... their workouts stay, with the author cleared');
select throws_ok($$ delete from auth.users where id = tests.id('owner_a') $$,
  '23514', null, 'A gym''s only owner cannot be deleted until ownership is handed over');

select * from finish();
rollback;
