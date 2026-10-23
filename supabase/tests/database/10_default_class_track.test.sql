-- A new gym starts with one program (table tracks), "Class" (Daniel,
-- 2026-10-21), which its owners and head coaches can rename or archive like
-- any other program, as long as the gym keeps one active.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(7);

select tests.login_as('outsider');
select lives_ok($$ select public.create_organization('New Gym', 'new-gym', 'IS') $$, 'A signed-in user creates a gym');

select results_eq(
  $$ select t.name, t.color, t.position, t.archived_at is null
     from public.tracks t join public.organizations o on o.id = t.org_id
     where o.slug = 'new-gym' $$,
  $$ values ('Class', '#5B5FD6', 0, true) $$,
  'The new gym has exactly one active track, Class');

select isnt_empty(
  $$ update public.tracks set name = 'Group class'
     where org_id = (select id from public.organizations where slug = 'new-gym') returning 1 $$,
  'Its owner can rename it');
select throws_ok(
  $$ update public.tracks set archived_at = now()
     where org_id = (select id from public.organizations where slug = 'new-gym') $$,
  '23514', null, 'As the gym''s only program it cannot be archived (a gym keeps one active program)');
insert into public.tracks (org_id, name, position)
select id, 'Strength club', 1 from public.organizations where slug = 'new-gym';
select isnt_empty(
  $$ update public.tracks set archived_at = now()
     where org_id = (select id from public.organizations where slug = 'new-gym') and name = 'Group class' returning 1 $$,
  'With another program, its owner can archive it');

-- Each gym gets its own track, invisible to other gyms.
select tests.login_as('owner_a');
select is_empty(
  $$ select 1 from public.tracks t join public.organizations o on o.id = t.org_id where o.slug = 'new-gym' $$,
  'Another gym cannot see it');
select results_eq(
  $$ select count(*)::int from public.tracks where org_id = tests.id('gym_a') $$,
  $$ values (1) $$,
  'Existing gyms keep their own tracks');

select * from finish();
rollback;
