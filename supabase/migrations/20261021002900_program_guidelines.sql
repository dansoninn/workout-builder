-- Guidelines per program (Daniel's decision 5, 2026-10-23): the gym's
-- guidelines are every program's default; a program can have its own set,
-- set by owners and head coaches (who manage programs; RLS on tracks).
-- NULL uses the gym's; '{}' is an own set with no guideline (no warnings).

alter table public.tracks add column guidelines jsonb;

comment on column public.tracks.guidelines is
  'The program''s own guidelines (decision 5, 2026-10-23), the same shape as organizations.settings.guidelines; NULL uses the gym''s.';

create function private.check_program_guidelines()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_problem text;
begin
  if new.guidelines is not null then
    v_problem := private.guidelines_problem(new.guidelines);
    if v_problem is not null then
      raise exception '%', v_problem using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger tracks_guidelines_valid
  before insert or update of guidelines on public.tracks
  for each row execute function private.check_program_guidelines();
