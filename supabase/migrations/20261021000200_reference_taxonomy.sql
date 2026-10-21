-- Reference taxonomy (SPEC-data-model §4, SPEC-calculation-model §2 and §4.4).
--
-- Global, locked reference data owned by us. Signed-in users can read it;
-- nobody but the service role can write it. Every taxonomy column elsewhere
-- is a foreign key into these tables, so invalid values are impossible.
-- Changes require a new row in taxonomy_versions (calc spec §8).

create type public.body_region as enum ('lower', 'upper', 'core', 'systemic');
create type public.measure_unit as enum ('reps', 'distance_m', 'calories', 'time_s');

create table public.taxonomy_versions (
  version int primary key check (version > 0),
  published_at timestamptz not null,
  notes text not null default ''
);

create table public.movement_patterns (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  region public.body_region not null,
  label_en text not null,
  label_is text not null,
  position smallint not null unique
);

create table public.planes (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  label_en text not null,
  label_is text not null,
  position smallint not null unique
);

create table public.modalities (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  default_unit public.measure_unit not null,
  label_en text not null,
  label_is text not null,
  position smallint not null unique
);

create table public.muscles (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  region public.body_region not null,
  label_en text not null,
  label_is text not null,
  position smallint not null unique
);

-- Internal effort mapping (calc spec §4.4). Coaches pick a word; the
-- calculation engine uses rpe_calc and the RIR band. rir_max NULL means
-- open-ended ("4+").
create table public.effort_levels (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  label_en text not null,
  label_is text not null,
  position smallint not null unique,
  rpe_min numeric(3,1) not null,
  rpe_max numeric(3,1) not null,
  rpe_calc numeric(3,1) not null,
  rir_min smallint not null check (rir_min >= 0),
  rir_max smallint,
  constraint effort_levels_rpe_order check (rpe_min <= rpe_calc and rpe_calc <= rpe_max and rpe_max <= 10),
  constraint effort_levels_rir_order check (rir_max is null or rir_max >= rir_min)
);

comment on table public.effort_levels is
  'Effort words for the pace and load axes (calc spec §4.4). "max" is pace-only: the load axis has no max level.';

-- Access: read for signed-in users, no writes through the API.
alter table public.taxonomy_versions enable row level security;
alter table public.movement_patterns enable row level security;
alter table public.planes enable row level security;
alter table public.modalities enable row level security;
alter table public.muscles enable row level security;
alter table public.effort_levels enable row level security;

create policy "Signed-in users can read taxonomy versions"
  on public.taxonomy_versions for select to authenticated using (true);
create policy "Signed-in users can read movement patterns"
  on public.movement_patterns for select to authenticated using (true);
create policy "Signed-in users can read planes"
  on public.planes for select to authenticated using (true);
create policy "Signed-in users can read modalities"
  on public.modalities for select to authenticated using (true);
create policy "Signed-in users can read muscles"
  on public.muscles for select to authenticated using (true);
create policy "Signed-in users can read effort levels"
  on public.effort_levels for select to authenticated using (true);

revoke all on table
  public.taxonomy_versions, public.movement_patterns, public.planes,
  public.modalities, public.muscles, public.effort_levels
  from anon, authenticated;
grant select on table
  public.taxonomy_versions, public.movement_patterns, public.planes,
  public.modalities, public.muscles, public.effort_levels
  to authenticated;
grant all on table
  public.taxonomy_versions, public.movement_patterns, public.planes,
  public.modalities, public.muscles, public.effort_levels
  to service_role;
