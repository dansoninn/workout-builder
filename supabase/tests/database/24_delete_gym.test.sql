-- Deleting a gym (PLAN-step-6 6c): only an owner, confirming with its name;
-- hidden from everyone at once; its owners can bring it back for 30 days;
-- then erased for good with everything in it and its audit log, and nothing
-- of any other gym.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(32);

insert into tests.ids (name) select unnest(array['invite', 'amrap', 'result', 'alias', 'own_exercise', 'focus']);
insert into public.invitations (id, org_id, email, role, token_hash) values
  (tests.id('invite'), tests.id('gym_a'), 'new@example.test', 'coach', private.hash_token('t0k3n'));
insert into public.blocks (id, workout_id, org_id, position, label, intent, format, params, pace_effort) values
  (tests.id('amrap'), tests.id('workout_a'), tests.id('gym_a'), 1, 'B', 'conditioning', 'amrap', '{"time_s": 480}', 'hard');
insert into public.block_results (id, org_id, block_id, rounds_low, rounds_high) values (tests.id('result'), tests.id('gym_a'), tests.id('amrap'), 6, 8);
insert into public.exercise_pace_overrides (org_id, exercise_id, pace) values (tests.id('gym_a'), tests.id('ex_a'), '{"sec_per_rep": 3}');
insert into public.member_preferences (org_id, user_id, calendar_all_programs) values (tests.id('gym_a'), tests.id('coach_a'), true);
insert into public.day_focuses (id, org_id, name) values (tests.id('focus'), tests.id('gym_a'), 'Squat');
insert into public.program_days (org_id, track_id, date, focus_id) values (tests.id('gym_a'), tests.id('track_a'), '2026-10-26', tests.id('focus'));
insert into public.calendar_days (org_id, date, name) values (tests.id('gym_a'), '2026-12-25', 'Christmas Day');
insert into public.import_batches (org_id, track_id, source_name, source_kind, document) values (tests.id('gym_a'), tests.id('track_a'), 'plan.xlsx', 'xlsx', '{}');

select has_function('public', 'delete_gym', array['uuid', 'text'], 'delete_gym exists');
select is((select count(*)::int from cron.job where jobname = 'erase-deleted-gyms'), 1, 'The nightly erasure is scheduled');

-- Only an owner, with the gym's name.
select tests.login_as('head_a');
select throws_ok($$ select public.delete_gym(tests.id('gym_a'), 'Gym A') $$, '42501', null, 'A head coach cannot delete the gym');
select tests.login_as('owner_b');
select throws_ok($$ select public.delete_gym(tests.id('gym_a'), 'Gym A') $$, '42501', null, 'Nor another gym''s owner');
select tests.login_as('owner_a');
select throws_ok($$ select public.delete_gym(tests.id('gym_a'), 'Gym B') $$, '22023', 'Type the gym''s name to delete it', 'The owner types its name');
select lives_ok($$ select public.delete_gym(tests.id('gym_a'), ' gym a ') $$, 'The owner deletes it (any case)');

-- Gone for everyone at once.
select is_empty($$ select 1 from public.organizations where id = tests.id('gym_a') $$, 'The owner no longer sees the gym');
select is_empty($$ select 1 from public.workouts where org_id = tests.id('gym_a') $$, 'nor its workouts');
select throws_ok(
  $$ select public.save_workout(tests.id('gym_a'), jsonb_build_object('id', gen_random_uuid(), 'track_id', tests.id('track_a'), 'kind', 'scheduled', 'date', '2026-10-23', 'blocks', '[]'::jsonb)) $$,
  '42501', null, 'nor programs in it');
select throws_ok($$ select public.create_invitation(tests.id('gym_a'), 'x@example.test', 'coach') $$, '42501', null, 'nor invites to it');
select is_empty($$ select 1 from public.list_gym_members(tests.id('gym_a')) $$, 'nor sees its members');
select tests.login_as('coach_a');
select is_empty($$ select 1 from public.memberships where org_id = tests.id('gym_a') $$, 'Its coaches see nothing of it');
select is_empty($$ select 1 from public.tracks where org_id = tests.id('gym_a') $$, 'not even its programs');
select tests.login_anon();
select is_empty($$ select 1 from public.invitation_preview('t0k3n') $$, 'Its invitation links lead nowhere');
select tests.logout();
select isnt((select revoked_at from public.invitations where id = tests.id('invite')), null, 'and its open invitations are cancelled');

-- Its owners see it among their deleted gyms, and can bring it back.
select tests.login_as('owner_a');
select results_eq(
  $$ select name, erased_after = deleted_at + interval '30 days' from public.my_deleted_gyms() $$,
  $$ values ('Gym A'::text, true) $$,
  'The owner sees the deleted gym and when it will be erased');
select tests.login_as('coach_a');
select is_empty($$ select 1 from public.my_deleted_gyms() $$, 'A coach does not');
select throws_ok($$ select public.restore_gym(tests.id('gym_a')) $$, '42501', null, 'nor can bring it back');
select tests.login_as('owner_a');
select is(public.restore_gym(tests.id('gym_a')), 'gym-a', 'The owner brings it back');
select isnt_empty($$ select 1 from public.workouts where org_id = tests.id('gym_a') $$, 'with everything in it');

-- Erased for good 30 days after it was deleted, not before.
select lives_ok($$ select public.delete_gym(tests.id('gym_a'), 'Gym A') $$, 'Deleted again');
select tests.logout();
update public.organizations set deleted_at = now() - interval '29 days' where id = tests.id('gym_a');
select is(private.erase_deleted_gyms(), 0, 'Not erased before 30 days');
update public.organizations set deleted_at = now() - interval '31 days' where id = tests.id('gym_a');
select is(private.erase_deleted_gyms(), 1, 'Erased after 30 days');
select is(
  (select count(*)::int from (
    select id from public.organizations where id = tests.id('gym_a')
    union all select org_id from public.memberships where org_id = tests.id('gym_a')
    union all select org_id from public.tracks where org_id = tests.id('gym_a')
    union all select org_id from public.workouts where org_id = tests.id('gym_a')
    union all select org_id from public.blocks where org_id = tests.id('gym_a')
    union all select org_id from public.block_items where org_id = tests.id('gym_a')
    union all select org_id from public.block_results where org_id = tests.id('gym_a')
    union all select org_id from public.workout_metrics where org_id = tests.id('gym_a')
    union all select org_id from public.exercises where org_id = tests.id('gym_a')
    union all select org_id from public.exercise_aliases where org_id = tests.id('gym_a')
    union all select org_id from public.exercise_pace_overrides where org_id = tests.id('gym_a')
    union all select org_id from public.invitations where org_id = tests.id('gym_a')
    union all select org_id from public.member_preferences where org_id = tests.id('gym_a')
    union all select org_id from public.day_focuses where org_id = tests.id('gym_a')
    union all select org_id from public.program_days where org_id = tests.id('gym_a')
    union all select org_id from public.calendar_days where org_id = tests.id('gym_a')
    union all select org_id from public.import_batches where org_id = tests.id('gym_a')
  ) as everything),
  0, 'Nothing of the gym is left in any table');
select is_empty($$ select 1 from public.audit_log where org_id = tests.id('gym_a') $$, 'not even its audit log');
select isnt_empty($$ select 1 from public.profiles where id = tests.id('coach_a') $$, 'Its members keep their accounts');
select isnt_empty($$ select 1 from public.workouts where org_id = tests.id('gym_b') $$, 'Another gym keeps everything');
select isnt_empty($$ select 1 from public.audit_log where org_id = tests.id('gym_b') $$, 'and its audit log');
select throws_ok($$ delete from public.audit_log where org_id = tests.id('gym_b') $$, '42501', 'audit_log is append-only',
  'Any other gym''s audit log stays append-only');

-- An owner who deletes their account takes the gyms they deleted and alone own with them.
select tests.login_as('owner_b');
select lives_ok($$ select public.delete_gym(tests.id('gym_b'), 'Gym B') $$, 'Gym B''s only owner deletes it');
select lives_ok($$ select public.delete_my_account() $$, 'and then their account');
select tests.logout();
select is_empty($$ select 1 from public.organizations where id = tests.id('gym_b') $$, 'and that gym is erased at once (no one is left to bring it back)');

select * from finish();
rollback;
