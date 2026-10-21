-- Implement count (calc spec §9.8, approved by Daniel 2026-10-21).
--
-- Volume load = load per implement × implement count × reps. Each exercise
-- has a default implement count (DB thruster 2, DB snatch 1); the coach can
-- override it on a workout line (e.g. a single-DB thruster). Core values are
-- set in the following generated migration.

alter table public.exercises
  add column implement_count smallint not null default 1
    constraint exercises_implement_count_range check (implement_count between 1 and 4);

comment on column public.exercises.implement_count is
  'Implements used when loaded (DB thruster 2, DB snatch 1). Volume load = kg per implement × count × reps.';

alter table public.block_items
  add column implement_count smallint
    constraint block_items_implement_count_range check (implement_count between 1 and 4);

comment on column public.block_items.implement_count is
  'Overrides the exercise''s implement count for this line. NULL = use the exercise default.';
