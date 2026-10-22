-- Paste a workout (PLAN-step-4 4c, SPEC-data-model §5): the workout, the text
-- it was pasted from and the gym names the coach answered are saved in one
-- transaction. A generic word ("squat") asked once is saved as a gym alias:
-- any coach may save that answer; only owners and head coaches change or
-- remove gym aliases; every alias change is audited.

-- ---------------------------------------------------------------------------
-- 1. Gym aliases: coaches may answer a generic word; all changes audited.
-- ---------------------------------------------------------------------------

create policy "Coaches can answer a generic word for the gym"
  on public.exercise_aliases for insert to authenticated
  with check (
    org_id in (select private.orgs_where_can_program())
    and exists (select 1 from public.ambiguous_exercise_terms t where t.term = alias_normalized)
  );

create trigger exercise_aliases_audit
  after insert or update or delete on public.exercise_aliases
  for each row execute function private.write_audit_log();

-- ---------------------------------------------------------------------------
-- 2. save_pasted_workout
-- ---------------------------------------------------------------------------

/**
 * Saves a pasted workout: save_workout's payload plus raw_text (the text as
 * pasted, required) and parser_version, and the coach's answers for words the
 * gym has no name for yet (p_aliases: [{ term, exercise_id }], each saved as a
 * gym alias unless the gym already has one for that word). One transaction,
 * run as the signed-in user, so RLS applies to every part: a coach's answer
 * for a word that is not a generic word is refused, and nothing is saved.
 * The builder's later saves keep raw_text as it is.
 */
create function public.save_pasted_workout(p_org uuid, p_workout jsonb, p_aliases jsonb default '[]'::jsonb)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_alias jsonb;
begin
  if coalesce(btrim(p_workout ->> 'raw_text'), '') = '' then
    raise exception 'A pasted workout keeps the text it was pasted from' using errcode = 'invalid_parameter_value';
  end if;
  if coalesce((p_workout ->> 'parser_version')::int, 0) < 1 then
    raise exception 'Say which parser read the text' using errcode = 'invalid_parameter_value';
  end if;

  v_id := public.save_workout(p_org, p_workout);
  update public.workouts w
     set raw_text = p_workout ->> 'raw_text', parser_version = (p_workout ->> 'parser_version')::int
   where w.id = v_id and w.org_id = p_org;

  for v_alias in select value from jsonb_array_elements(coalesce(p_aliases, '[]'::jsonb)) loop
    insert into public.exercise_aliases (org_id, alias_normalized, exercise_id)
    values (p_org, v_alias ->> 'term', (v_alias ->> 'exercise_id')::uuid)
    on conflict on constraint exercise_aliases_org_alias_key do nothing;
  end loop;
  return v_id;
end;
$$;

revoke all on function public.save_pasted_workout(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_pasted_workout(uuid, jsonb, jsonb) to authenticated;
