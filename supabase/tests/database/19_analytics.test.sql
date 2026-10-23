-- Analytics (Step 5c): a period's stored metrics, for the gym's own members
-- only; the gym's guidelines, set by the owner only and always well-formed.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(15);

insert into tests.ids (name) select unnest(array['later', 'deleted', 'tpl', 'other_track']);
insert into public.tracks (id, org_id, name, color) values (tests.id('other_track'), tests.id('gym_a'), 'Barbell club', '#DC2626');
insert into public.workouts (id, org_id, track_id, kind, date, title) values
  (tests.id('later'),   tests.id('gym_a'), tests.id('other_track'), 'scheduled', '2026-10-24', 'Saturday'),
  (tests.id('deleted'), tests.id('gym_a'), tests.id('track_a'),     'scheduled', '2026-10-22', 'Gone');
insert into public.workouts (id, org_id, track_id, kind, title) values (tests.id('tpl'), tests.id('gym_a'), tests.id('track_a'), 'template', 'T');
update public.workouts set deleted_at = now() where id = tests.id('deleted');
insert into public.workout_metrics (workout_id, org_id, calc_version, taxonomy_version, metrics) values
  (tests.id('later'),   tests.id('gym_a'), 1, 1, '{"sRpe": {"low": 10, "mid": 10, "high": 10, "confidence": "exact"}}'),
  (tests.id('deleted'), tests.id('gym_a'), 1, 1, '{}'),
  (tests.id('tpl'),     tests.id('gym_a'), 1, 1, '{}');

-- The period's metrics.
select tests.login_as('viewer_a');
select results_eq(
  $$ select title from public.period_metrics(tests.id('gym_a'), '2026-10-19', '2026-10-25', 1) $$,
  $$ values ('A day'::text), ('Saturday') $$,
  'Everyone in the gym reads the period''s workouts, in date order; deleted workouts and templates are not in it');
select results_eq(
  $$ select title from public.period_metrics(tests.id('gym_a'), '2026-10-19', '2026-10-25', 1, tests.id('other_track')) $$,
  $$ values ('Saturday'::text) $$,
  'One track');
select is(
  (select metrics -> 'sRpe' ->> 'mid' from public.period_metrics(tests.id('gym_a'), '2026-10-24', '2026-10-24', 1)),
  '10', 'with their stored metrics');
select is_empty($$ select 1 from public.period_metrics(tests.id('gym_a'), '2026-10-19', '2026-10-25', 2) $$,
  'Only the asked calc version');
select tests.login_as('owner_b');
select is_empty($$ select 1 from public.period_metrics(tests.id('gym_a'), '2026-10-19', '2026-10-25', 1) $$,
  'Another gym sees nothing of it');

-- Guidelines: a new gym starts with the defaults (decision 18).
select tests.logout();
select is((select settings -> 'guidelines' from public.organizations where id = tests.id('gym_a')), private.default_guidelines(),
  'A new gym starts with the default guidelines');
select is(
  private.default_guidelines(),
  '{"hardSetsPerWeek": {"squat": 4, "hinge": 4, "h_push": 3, "h_pull": 3, "v_push": 2, "v_pull": 3}, "pushPull": {"min": 0.8, "max": 1.2}, "kneeHip": {"min": 0.7, "max": 1.5}, "monotonyMax": 2, "weekIncreaseMaxPercent": 15}'::jsonb,
  'The defaults are the approved ones (the same as the app''s DEFAULT_GUIDELINES)');

select tests.login_as('owner_a');
select lives_ok($$ select public.set_gym_guidelines(tests.id('gym_a'), '{"hardSetsPerWeek": {"hinge": 4}, "kneeHip": {"max": 2}}') $$,
  'The owner sets the gym''s guidelines');
select is((select settings -> 'guidelines' -> 'kneeHip' ->> 'max' from public.organizations where id = tests.id('gym_a')), '2',
  'They are kept in the gym''s settings');
select throws_ok($$ select public.set_gym_guidelines(tests.id('gym_a'), '{"hardSetsPerWeek": {"deadlift": 4}}') $$,
  '23514', 'Unknown movement pattern "deadlift"', 'Only known patterns');
select throws_ok($$ update public.organizations set settings = settings || '{"guidelines": {"monotonyMax": -1}}' where id = tests.id('gym_a') $$,
  '23514', 'Monotony is above 0 and at most 10', 'Checked however the settings change');
select lives_ok($$ select public.set_gym_guidelines(tests.id('gym_a'), '{}') $$, 'The owner removes them');
select ok((select not (settings ? 'guidelines') from public.organizations where id = tests.id('gym_a')), 'and they are gone');

select tests.login_as('head_a');
select throws_ok($$ select public.set_gym_guidelines(tests.id('gym_a'), '{"monotonyMax": 2}') $$,
  '42501', 'Only the owner sets the gym''s guidelines', 'A head coach cannot set them');
select tests.login_as('owner_b');
select throws_ok($$ select public.set_gym_guidelines(tests.id('gym_a'), '{"monotonyMax": 2}') $$,
  '42501', null, 'Nor another gym''s owner');

select * from finish();
rollback;
