-- Invitations (Step 4a): only owners invite, see or cancel; a link works once,
-- for the invited confirmed email, within 14 days, and gives exactly the
-- invited role. The member list shows emails to owners only. Gym addresses
-- cannot take the app's own route names.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(64);

-- Invitees: new users with no gym. Fixture users get confirmed emails.
insert into tests.ids (name) values ('invitee'), ('invitee2'), ('unconfirmed');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select tests.id(n), n || '@example.test', case when n <> 'unconfirmed' then now() end,
  jsonb_build_object('display_name', n)
from unnest(array['invitee', 'invitee2', 'unconfirmed']) as n;
update auth.users set email_confirmed_at = now() where email_confirmed_at is null and id <> tests.id('unconfirmed');

-- ---------------------------------------------------------------------------
-- Shape and protection
-- ---------------------------------------------------------------------------
select has_table('public', 'invitations', 'invitations table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.invitations'::regclass), 'RLS is on for invitations');
select ok(not has_table_privilege('anon', 'public.invitations', 'select'), 'Visitors cannot read invitations');
select ok(not has_table_privilege('authenticated', 'public.invitations', 'insert'), 'Invitations cannot be inserted directly');
select ok(not has_table_privilege('authenticated', 'public.invitations', 'delete'), 'Invitations cannot be deleted');
select ok(not has_function_privilege('anon', 'public.create_invitation(uuid, text, public.org_role)', 'execute'),
  'Visitors cannot create invitations');
select ok(not has_function_privilege('anon', 'public.accept_invitation(text)', 'execute'),
  'Visitors cannot accept invitations');
select ok(not has_function_privilege('anon', 'public.list_gym_members(uuid)', 'execute'),
  'Visitors cannot list members');

-- ---------------------------------------------------------------------------
-- Creating: owners only, in their own gym
-- ---------------------------------------------------------------------------
select tests.login_as('owner_a');

select is(length(set_config('tests.tok_coach', public.create_invitation(tests.id('gym_a'), '  Invitee@Example.TEST ', 'coach'), true)), 64,
  'Owner can invite; the link secret is 64 characters');
select matches(current_setting('tests.tok_coach'), '^[0-9a-f]{64}$', 'The link secret is hex');
select results_eq(
  $$ select email, role::text, invited_by from public.invitations where org_id = tests.id('gym_a') $$,
  $$ values ('invitee@example.test', 'coach', tests.id('owner_a')) $$,
  'The invitation stores the normalised email, the role and who invited');
select is((select count(*)::int from public.invitations where token_hash = current_setting('tests.tok_coach')), 0,
  'The link secret itself is not stored');
select is((select expires_at - created_at from public.invitations where org_id = tests.id('gym_a')), interval '14 days',
  'Invitations expire after 14 days');
select throws_ok($$ select public.create_invitation(tests.id('gym_a'), 'coach_a@example.test', 'viewer') $$,
  '23505', 'coach_a@example.test is already a member of this gym', 'Existing members cannot be invited again');
select throws_ok($$ select public.create_invitation(tests.id('gym_a'), 'not-an-email', 'coach') $$,
  '23514', null, 'An invalid email is rejected');
select throws_ok($$ insert into public.invitations (org_id, email, role, token_hash) values (tests.id('gym_a'), 'x@example.test', 'owner', repeat('a', 64)) $$,
  '42501', null, 'Owners cannot insert invitations directly (only through create_invitation)');
select throws_ok($$ select public.create_invitation(tests.id('gym_b'), 'x@example.test', 'owner') $$,
  '42501', 'Only the gym''s owners can invite members', 'Owner of gym A cannot invite into gym B');

select tests.login_as('head_a');
select throws_ok($$ select public.create_invitation(tests.id('gym_a'), 'x@example.test', 'coach') $$,
  '42501', 'Only the gym''s owners can invite members', 'Head coach cannot invite');
select tests.login_as('coach_a');
select throws_ok($$ select public.create_invitation(tests.id('gym_a'), 'x@example.test', 'coach') $$,
  '42501', 'Only the gym''s owners can invite members', 'Coach cannot invite');
select tests.login_as('viewer_a');
select throws_ok($$ select public.create_invitation(tests.id('gym_a'), 'x@example.test', 'coach') $$,
  '42501', 'Only the gym''s owners can invite members', 'Viewer cannot invite');
select tests.login_as('outsider');
select throws_ok($$ select public.create_invitation(tests.id('gym_a'), 'x@example.test', 'coach') $$,
  '42501', 'Only the gym''s owners can invite members', 'A user outside the gym cannot invite');

-- ---------------------------------------------------------------------------
-- Seeing and cancelling: owners of that gym only
-- ---------------------------------------------------------------------------
select tests.login_as('head_a');
select is_empty($$ select 1 from public.invitations $$, 'Head coach cannot see invitations');
select is_empty($$ update public.invitations set revoked_at = now() returning 1 $$, 'Head coach cannot cancel invitations');
select tests.login_as('coach_a');
select is_empty($$ select 1 from public.invitations $$, 'Coach cannot see invitations');
select tests.login_as('viewer_a');
select is_empty($$ select 1 from public.invitations $$, 'Viewer cannot see invitations');
select tests.login_as('owner_b');
select is_empty($$ select 1 from public.invitations $$, 'Gym B''s owner cannot see gym A''s invitations');
select is_empty($$ update public.invitations set revoked_at = now() returning 1 $$, 'Gym B''s owner cannot cancel gym A''s invitations');

select tests.login_as('owner_a');
select throws_ok($$ update public.invitations set role = 'owner' $$,
  '42501', null, 'An invitation''s role cannot be changed after it is created');
select throws_ok($$ update public.invitations set expires_at = now() + interval '1 year' $$,
  '42501', null, 'An invitation''s expiry cannot be extended');

-- A new invitation for the same email replaces the open one.
select is(length(set_config('tests.tok_renewed', public.create_invitation(tests.id('gym_a'), 'invitee@example.test', 'coach'), true)), 64,
  'Owner can renew an invitation (copy a fresh link)');
select results_eq(
  $$ select count(*)::int, count(*) filter (where revoked_at is null)::int from public.invitations where email = 'invitee@example.test' $$,
  $$ values (2, 1) $$,
  'Renewing cancels the earlier link, leaving one open invitation');

-- ---------------------------------------------------------------------------
-- Preview: anyone with the link sees what it is for
-- ---------------------------------------------------------------------------
select tests.login_anon();
select results_eq(
  $$ select gym_name, gym_slug, role::text, email, status, email_matches from public.invitation_preview(current_setting('tests.tok_renewed')) $$,
  $$ values ('Gym A', 'gym-a', 'coach', 'invitee@example.test', 'open', false) $$,
  'A visitor with the link sees the gym, role, email and status');
select is((select status from public.invitation_preview(current_setting('tests.tok_coach'))), 'cancelled',
  'The replaced link shows as cancelled');
select is_empty($$ select 1 from public.invitation_preview(repeat('0', 64)) $$, 'An unknown link shows nothing');
select is_empty($$ select 1 from public.invitation_preview('') $$, 'An empty link shows nothing');

select tests.login_as('invitee');
select is((select email_matches from public.invitation_preview(current_setting('tests.tok_renewed'))), true,
  'The invited user sees that the link is for them');
select tests.login_as('outsider');
select is((select email_matches from public.invitation_preview(current_setting('tests.tok_renewed'))), false,
  'Someone else sees that the link is not for them');

-- ---------------------------------------------------------------------------
-- Accepting: right user, open link, once
-- ---------------------------------------------------------------------------
select tests.login_as('outsider');
select throws_ok($$ select public.accept_invitation(current_setting('tests.tok_renewed')) $$,
  '42501', 'This invitation is for another email address', 'Another user cannot use the link');
select throws_ok($$ select public.accept_invitation(repeat('0', 64)) $$,
  '22023', 'This invitation link is not valid', 'An unknown link is rejected');

select tests.login_as('invitee');
select throws_ok($$ select public.accept_invitation(current_setting('tests.tok_coach')) $$,
  '22023', 'This invitation was cancelled', 'A cancelled link is rejected');
select is(public.accept_invitation(current_setting('tests.tok_renewed')), 'gym-a',
  'The invited user joins and is sent to the gym');
select results_eq(
  $$ select role::text from public.memberships where org_id = tests.id('gym_a') and user_id = tests.id('invitee') $$,
  $$ values ('coach') $$,
  'They get exactly the invited role');
select isnt_empty($$ select 1 from public.workouts where org_id = tests.id('gym_a') $$, 'They can now read the gym''s workouts');
select is_empty($$ select 1 from public.workouts where org_id = tests.id('gym_b') $$, 'They still cannot read another gym');
select is_empty($$ select 1 from public.invitations $$, 'A coach who joined cannot see invitations');
select throws_ok($$ select public.accept_invitation(current_setting('tests.tok_renewed')) $$,
  '22023', 'This invitation has already been used', 'A link works only once');

select tests.logout();
select results_eq(
  $$ select accepted_by, revoked_at is null from public.invitations where token_hash = encode(extensions.digest(current_setting('tests.tok_renewed'), 'sha256'), 'hex') $$,
  $$ values (tests.id('invitee'), true) $$,
  'The invitation records who accepted it');
select results_eq(
  $$ select actor_id, action::text from public.audit_log where table_name = 'memberships' and row_id = tests.id('invitee') $$,
  $$ values (tests.id('invitee'), 'insert') $$,
  'Joining is in the gym''s audit log');
select is_empty($$ select 1 from public.audit_log where table_name = 'invitations' $$,
  'Invitations (with emails only owners may see) are not in the members-wide audit log');
select throws_ok($$ update public.invitations set email = 'someone-else@example.test' where email = 'invitee@example.test' $$,
  '23514', 'invitations.email cannot be changed', 'An invitation''s email is pinned, even for the service role');

-- Expired links, unconfirmed emails, and other roles.
select tests.login_as('owner_a');
select is(length(set_config('tests.tok_expired', public.create_invitation(tests.id('gym_a'), 'invitee2@example.test', 'head_coach'), true)), 64,
  'Owner invites a head coach');
select tests.logout();
update public.invitations set expires_at = now() - interval '1 second' where email = 'invitee2@example.test';
select tests.login_anon();
select is((select status from public.invitation_preview(current_setting('tests.tok_expired'))), 'expired',
  'An expired link shows as expired');
select tests.login_as('invitee2');
select throws_ok($$ select public.accept_invitation(current_setting('tests.tok_expired')) $$,
  '22023', 'This invitation has expired', 'An expired link is rejected');

select tests.login_as('owner_a');
select is(length(set_config('tests.tok_viewer', public.create_invitation(tests.id('gym_a'), 'invitee2@example.test', 'viewer'), true)), 64,
  'Owner sends a fresh link after it expired');
select is(length(set_config('tests.tok_unconfirmed', public.create_invitation(tests.id('gym_a'), 'unconfirmed@example.test', 'coach'), true)), 64,
  'Owner invites someone who has not confirmed their email');
select tests.login_as('invitee2');
select is(public.accept_invitation(current_setting('tests.tok_viewer')), 'gym-a', 'The fresh link works');
select results_eq(
  $$ select role::text from public.memberships where org_id = tests.id('gym_a') and user_id = tests.id('invitee2') $$,
  $$ values ('viewer') $$,
  'A viewer invitation gives the viewer role');
select tests.login_as('unconfirmed');
select throws_ok($$ select public.accept_invitation(current_setting('tests.tok_unconfirmed')) $$,
  '42501', 'This invitation is for another email address', 'A user whose email is not confirmed cannot accept');

-- ---------------------------------------------------------------------------
-- Member list: members only; emails for owners only
-- ---------------------------------------------------------------------------
select tests.login_as('owner_a');
select results_eq(
  $$ select role::text, email from public.list_gym_members(tests.id('gym_a')) $$,
  $$ values ('owner', 'owner_a@example.test'), ('head_coach', 'head_a@example.test'), ('coach', 'coach_a@example.test'),
            ('coach', 'invitee@example.test'), ('viewer', 'invitee2@example.test'), ('viewer', 'viewer_a@example.test') $$,
  'Owners see every member with email, owners first');
select tests.login_as('coach_a');
select results_eq(
  $$ select count(*)::int, count(email)::int from public.list_gym_members(tests.id('gym_a')) $$,
  $$ values (6, 0) $$,
  'Coaches see the members without emails');
select tests.login_as('owner_b');
select is_empty($$ select 1 from public.list_gym_members(tests.id('gym_a')) $$, 'Gym B''s owner cannot list gym A''s members');
select tests.login_as('outsider');
select is_empty($$ select 1 from public.list_gym_members(tests.id('gym_a')) $$, 'A user outside the gym cannot list its members');

-- ---------------------------------------------------------------------------
-- Gym addresses cannot use the app's own route names
-- ---------------------------------------------------------------------------
select tests.login_as('outsider');
select throws_ok($$ select public.create_organization('Settings gym', 'settings', 'IS') $$,
  '23514', null, 'A gym cannot take a reserved address');
select lives_ok($$ select public.create_organization('Settings gym', 'settings-gym', 'IS') $$,
  'A reserved word inside a longer address is fine');

select * from finish();
rollback;
