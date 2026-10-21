-- The seeded core library and equipment list (Step 2), checked in the
-- database itself: complete, curated, consistent with the specs, readable by
-- every signed-in user and writable by none.

begin;
create extension if not exists pgtap with schema extensions;
\ir _fixtures.psql

select plan(16);

-- Only the seeded library, not the fixture's core rows.
create view tests.seeded as
  select * from public.exercises where org_id is null and slug not like 'fixture-%';
grant select on tests.seeded to authenticated;

-- ---------------------------------------------------------------------------
-- Complete and curated
-- ---------------------------------------------------------------------------
select results_eq($$ select count(*) from tests.seeded $$, array[120::bigint], '120 core exercises');
select results_eq($$ select count(*) from public.equipment $$, array[24::bigint], '24 equipment items');
select is_empty($$ select name from tests.seeded where plane is null or status <> 'active' $$,
  'Every core exercise is curated (plane set) and active');
select is_empty($$
  select e.name from tests.seeded e
  where e.kind = 'movement'
    and (select sum(p.weight) from public.exercise_patterns p where p.exercise_id = e.id) is distinct from 1.00
$$, 'Every core movement has pattern weights summing to 1.00');
select is_empty($$
  select e.name from tests.seeded e
  where e.kind = 'monostructural'
    and (exists (select 1 from public.exercise_patterns p where p.exercise_id = e.id)
         or exists (select 1 from public.exercise_muscles m where m.exercise_id = e.id))
$$, 'No core monostructural exercise has patterns or muscles');
select is_empty($$
  select e.name from tests.seeded e
  where e.kind = 'movement'
    and not exists (select 1 from public.exercise_muscles m where m.exercise_id = e.id and m.role = 'primary')
$$, 'Every core movement has at least one primary muscle');
select is_empty($$
  select q.key from public.equipment q
  where not exists (select 1 from public.exercise_equipment x where x.equipment_key = q.key)
$$, 'Every equipment item is used by at least one exercise');
select results_eq($$ select version from public.taxonomy_versions order by version $$, array[1, 2],
  'Equipment went into taxonomy version 2 (no version 3)');

-- ---------------------------------------------------------------------------
-- Consistent with the specs
-- ---------------------------------------------------------------------------
select results_eq($$
  select e.slug || ': ' || string_agg(p.pattern_key || ' ' || p.weight, ' / ' order by p.weight desc, p.pattern_key)
  from tests.seeded e join public.exercise_patterns p on p.exercise_id = e.id
  where e.slug in ('back-squat', 'air-squat', 'wall-ball', 'kettlebell-swing', 'dumbbell-snatch',
                   'toes-to-bar', 'burpee', 'box-jump-over')
  group by e.slug order by e.slug
$$, array[
  'air-squat: squat 1.00',
  'back-squat: squat 1.00',
  'box-jump-over: jump 1.00',
  'burpee: h_push 0.50 / jump 0.50',
  'dumbbell-snatch: hinge 0.70 / v_pull 0.30',
  'kettlebell-swing: hinge 1.00',
  'toes-to-bar: core 0.70 / v_pull 0.30',
  'wall-ball: squat 0.60 / v_push 0.40'
], 'The seven pattern-weight examples from calc spec §3 are seeded unchanged');
select results_eq($$
  select a.alias_normalized || ' → ' || e.slug
  from public.exercise_aliases a join tests.seeded e on e.id = a.exercise_id
  where a.org_id is null
    and a.alias_normalized in ('kb swing', 'russian kbs', 'db bench', 'sa db row', 'du', 'alt db snatch',
                               't2b', 'burpee over rower', 'bjo', 'bike')
  order by a.alias_normalized
$$, array[
  'alt db snatch → dumbbell-snatch',
  'bike → air-bike',
  'bjo → box-jump-over',
  'burpee over rower → burpee',
  'db bench → dumbbell-bench-press',
  'du → double-under',
  'kb swing → kettlebell-swing',
  'russian kbs → kettlebell-swing',
  'sa db row → single-arm-dumbbell-row',
  't2b → toes-to-bar'
], 'What coaches write in the worked WODs resolves through core aliases');
select results_eq($$ select id::text from tests.seeded where slug = 'back-squat' $$,
  array['9aa1a1e3-1f42-5db0-a46c-a1c0e8455331'], 'Core exercise ids are deterministic (UUID v5 of the slug)');
select is_empty($$ select modality from tests.seeded where modality = 'sled' $$,
  'No exercise uses the removed sled modality');

-- ---------------------------------------------------------------------------
-- Readable by every signed-in user, writable by none
-- ---------------------------------------------------------------------------
select tests.login_as('outsider');
select results_eq($$ select count(*) from tests.seeded $$, array[120::bigint],
  'A signed-in user with no gym sees the whole core library');
select results_eq($$ select count(*) from public.equipment $$, array[24::bigint],
  '... and the whole equipment list');

select tests.login_as('head_a');
select is_empty($$ update public.exercises set name = 'Hacked squat' where slug = 'back-squat' and org_id is null returning 1 $$,
  'A head coach cannot edit a seeded core exercise');
select is_empty($$
  delete from public.exercise_aliases where org_id is null and alias_normalized = 'kb swing' returning 1
$$, 'A head coach cannot delete a seeded core alias');

select * from finish();
rollback;
