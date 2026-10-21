-- Step 2 review decisions, approved by Daniel on 2026-10-21:
--   1. New muscle group hip_flexors (taxonomy version 2, no version 3).
--   2. Ambiguous exercise terms. Generic words such as "squat", "clean" or
--      "bike" can mean several core exercises, so they are NOT core aliases.
--      Each term lists its candidate core exercises; the Step 4 parser asks
--      the coach once and saves the choice as a gym-level alias.
--      Lookup order for a written term:
--        gym alias → core alias → ambiguous term (ask the coach) → unmatched.
-- The candidate rows themselves are seeded with the core library.

-- ---------------------------------------------------------------------------
-- 1. hip_flexors, placed with the lower-body muscles (after adductors)
-- ---------------------------------------------------------------------------

update public.muscles set position = position + 100 where position >= 5;
insert into public.muscles (key, region, label_en, position) values ('hip_flexors', 'lower', 'Hip flexors', 5);
update public.muscles set position = position - 99 where position >= 100;

-- ---------------------------------------------------------------------------
-- 2. Ambiguous exercise terms (core reference data, read-only for tenants)
-- ---------------------------------------------------------------------------

create table public.ambiguous_exercise_terms (
  term text not null,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position smallint not null check (position > 0),
  primary key (term, exercise_id),
  unique (term, position),
  -- Same normalised form as exercise_aliases.alias_normalized.
  constraint ambiguous_exercise_terms_is_normalized check (
    term <> ''
    and term = lower(term)
    and term = btrim(term)
    and term !~ '[[:punct:]]'
    and term !~ '\s\s'
  )
);

comment on table public.ambiguous_exercise_terms is
  'Generic words with several candidate core exercises. The coach picks once; the choice is saved as a gym alias.';

create index ambiguous_exercise_terms_exercise_id_idx on public.ambiguous_exercise_terms (exercise_id);

-- Candidates are core exercises, and a term is never also a core alias
-- (otherwise it would be matched automatically and never asked).
create function private.check_ambiguous_term()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.exercises e where e.id = new.exercise_id and e.org_id is not null) then
    raise exception 'Ambiguous-term candidates must be core exercises'
      using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.exercise_aliases a where a.org_id is null and a.alias_normalized = new.term) then
    raise exception '"%" is a core alias; an ambiguous term cannot also be a core alias', new.term
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger ambiguous_exercise_terms_check
  before insert or update on public.ambiguous_exercise_terms
  for each row execute function private.check_ambiguous_term();

-- The other direction: a core alias cannot be an ambiguous term. Gym aliases
-- can (that is how a gym's choice is saved).
create function private.check_core_alias_not_ambiguous()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.org_id is null
     and exists (select 1 from public.ambiguous_exercise_terms t where t.term = new.alias_normalized)
  then
    raise exception '"%" is an ambiguous term; it cannot be a core alias', new.alias_normalized
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger exercise_aliases_core_not_ambiguous
  before insert or update of alias_normalized, org_id on public.exercise_aliases
  for each row execute function private.check_core_alias_not_ambiguous();

alter table public.ambiguous_exercise_terms enable row level security;

create policy "Signed-in users can read ambiguous terms"
  on public.ambiguous_exercise_terms for select to authenticated using (true);

revoke all on table public.ambiguous_exercise_terms from anon, authenticated;
grant select on table public.ambiguous_exercise_terms to authenticated;
grant all on table public.ambiguous_exercise_terms to service_role;
