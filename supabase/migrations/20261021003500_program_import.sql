-- Program import (Daniel's list of 2026-10-23, item 5; BACKLOG "Program
-- import"): a whole programming document (a month, a year) into one program,
-- in its own workspace. An import is kept while the coach works on it (save
-- and resume), committed in one transaction, and undone in one.
--
--   import_batches     the document's text (never the file; personal data
--                      removed unless kept), its layout, the coach's answers
--                      and choices; draft → committed → undone.
--   import_batch_id    on the workouts, day focuses and closed days an
--                      import made, so it can be undone.
--   commit_import      makes the workouts (save_workout, the same as the
--                      builder), their text and parser version, the day
--                      focuses, closed days and the gym's names for words.
--   undo_import        takes them away again and brings back what the
--                      import replaced.
--
-- Both run as the signed-in member (security invoker): row level security
-- decides as everywhere else (coaches program; owners and head coaches keep
-- the gym's lists of focuses and closed days).

create type public.import_status as enum ('draft', 'committed', 'undone');

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  track_id uuid not null,
  status public.import_status not null default 'draft',
  source_name text not null check (btrim(source_name) <> '' and char_length(source_name) <= 200),
  source_kind text not null check (source_kind in ('xlsx', 'csv', 'docx', 'pdf', 'text')),
  -- The document as text: {kind: "grid", sheets} or {kind: "text", text}. At most 5 MB.
  document jsonb not null check (pg_column_size(document) <= 5242880),
  layout jsonb,
  program_index int not null default 0 check (program_index >= 0),
  answers jsonb not null default '{}'::jsonb,
  choices jsonb not null default '{}'::jsonb,
  -- After the commit: what was made and replaced, for the report and the undo.
  summary jsonb,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  committed_at timestamptz,
  undone_at timestamptz,
  unique (id, org_id),
  foreign key (track_id, org_id) references public.tracks (id, org_id)
);

comment on table public.import_batches is 'A programming document being imported into a program, or imported: its text, layout, answers and what it made.';

create index import_batches_org_id_idx on public.import_batches (org_id, created_at desc);

create trigger import_batches_pin_keys
  before update on public.import_batches
  for each row execute function private.forbid_column_change('org_id', 'created_by');
create trigger import_batches_set_updated_at
  before update on public.import_batches
  for each row execute function private.set_updated_at();

alter table public.workouts add column import_batch_id uuid;
alter table public.workouts add constraint workouts_import_batch_fkey
  foreign key (import_batch_id, org_id) references public.import_batches (id, org_id);
create index workouts_import_batch_id_idx on public.workouts (import_batch_id) where import_batch_id is not null;

alter table public.program_days add column import_batch_id uuid;
alter table public.program_days add constraint program_days_import_batch_fkey
  foreign key (import_batch_id, org_id) references public.import_batches (id, org_id);
alter table public.calendar_days add column import_batch_id uuid;
alter table public.calendar_days add constraint calendar_days_import_batch_fkey
  foreign key (import_batch_id, org_id) references public.import_batches (id, org_id);

-- Coaches import (they program); viewers do not see imports. A draft can be thrown away.
alter table public.import_batches enable row level security;

create policy "Coaches see the gym's imports"
  on public.import_batches for select to authenticated
  using (org_id in (select private.orgs_where_can_program()));
create policy "Coaches start an import"
  on public.import_batches for insert to authenticated
  with check (org_id in (select private.orgs_where_can_program()) and status = 'draft');
create policy "Coaches work on an import"
  on public.import_batches for update to authenticated
  using (org_id in (select private.orgs_where_can_program()))
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches throw away an unfinished import"
  on public.import_batches for delete to authenticated
  using (org_id in (select private.orgs_where_can_program()) and status = 'draft');

revoke all on table public.import_batches from anon, authenticated;
grant select, insert, update, delete on table public.import_batches to authenticated;
grant all on table public.import_batches to service_role;

-- A draft's answers change often and its document is large: the log keeps the commit and the undo.
create trigger import_batches_audit
  after update of status on public.import_batches
  for each row when (old.status is distinct from new.status)
  execute function private.write_audit_log();

-- ---------------------------------------------------------------------------
-- Commit: one transaction for the whole import.
-- ---------------------------------------------------------------------------

/**
 * p_workouts  [{...save_workout's workout, raw_text, parser_version, publish}] (scheduled and templates)
 * p_replace   workouts of the program the import replaces (soft-deleted, brought back by an undo)
 * p_focuses   names of day focuses to add to the gym's list
 * p_days      [{date, focus}]: the program's focus for a day, by name
 * p_closed    [{date, name}]: closed days (a day already on the gym's list stays as it is)
 * p_aliases   [{term, exercise_id}]: the gym's names for words answered
 * p_summary   what the app says was made (counts), kept with the batch
 */
create function public.commit_import(
  p_org uuid,
  p_batch uuid,
  p_workouts jsonb,
  p_replace uuid[] default '{}',
  p_focuses text[] default '{}',
  p_days jsonb default '[]'::jsonb,
  p_closed jsonb default '[]'::jsonb,
  p_aliases jsonb default '[]'::jsonb,
  p_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_workout jsonb;
  v_id uuid;
  v_made uuid[] := '{}';
  v_replaced uuid[];
  v_day jsonb;
  v_focus uuid;
  v_name text;
  v_position int;
begin
  if not exists (select 1 from private.orgs_where_can_program() o where o = p_org) then
    raise exception 'You cannot program workouts in this gym' using errcode = 'insufficient_privilege';
  end if;
  select * into v_batch from public.import_batches b where b.id = p_batch and b.org_id = p_org for update;
  if not found then
    raise exception 'This import does not exist' using errcode = 'no_data_found';
  end if;
  if v_batch.status <> 'draft' then
    raise exception 'This import is already done' using errcode = 'invalid_parameter_value';
  end if;

  -- What the import replaces: the program's own scheduled workouts, nothing else.
  with replaced as (
    update public.workouts w set deleted_at = now()
     where w.id = any(p_replace) and w.org_id = p_org and w.track_id = v_batch.track_id
       and w.kind = 'scheduled' and w.deleted_at is null
    returning w.id
  )
  select coalesce(array_agg(r.id), '{}') into v_replaced from replaced r;

  for v_workout in select value from jsonb_array_elements(coalesce(p_workouts, '[]'::jsonb)) loop
    if (v_workout ->> 'track_id')::uuid is distinct from v_batch.track_id then
      raise exception 'An import makes workouts in its own program' using errcode = 'invalid_parameter_value';
    end if;
    if exists (select 1 from public.workouts w where w.id = (v_workout ->> 'id')::uuid) then
      raise exception 'An import makes new workouts' using errcode = 'invalid_parameter_value';
    end if;
    v_id := public.save_workout(p_org, v_workout);
    update public.workouts w
       set raw_text = nullif(v_workout ->> 'raw_text', ''),
           parser_version = (v_workout ->> 'parser_version')::int,
           import_batch_id = p_batch,
           status = case when coalesce((v_workout ->> 'publish')::boolean, false) then 'published'::public.workout_status else w.status end
     where w.id = v_id and w.org_id = p_org;
    v_made := v_made || v_id;
  end loop;

  -- The gym's list of focuses grows by the names the import brings (owners and head coaches: RLS).
  select coalesce(max(f.position), -1) into v_position from public.day_focuses f where f.org_id = p_org;
  foreach v_name in array coalesce(p_focuses, '{}') loop
    if not exists (select 1 from public.day_focuses f where f.org_id = p_org and f.archived_at is null and lower(btrim(f.name)) = lower(btrim(v_name))) then
      v_position := v_position + 1;
      insert into public.day_focuses (org_id, name, position) values (p_org, btrim(v_name), v_position);
    end if;
  end loop;

  for v_day in select value from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) loop
    select f.id into v_focus from public.day_focuses f
     where f.org_id = p_org and f.archived_at is null and lower(btrim(f.name)) = lower(btrim(v_day ->> 'focus'))
     order by f.position limit 1;
    if v_focus is null then
      raise exception 'There is no day focus "%"', v_day ->> 'focus' using errcode = 'invalid_parameter_value';
    end if;
    insert into public.program_days (org_id, track_id, date, focus_id, import_batch_id)
    values (p_org, v_batch.track_id, (v_day ->> 'date')::date, v_focus, p_batch)
    on conflict (track_id, date) do nothing;
  end loop;

  for v_day in select value from jsonb_array_elements(coalesce(p_closed, '[]'::jsonb)) loop
    insert into public.calendar_days (org_id, date, name, closed, import_batch_id)
    values (p_org, (v_day ->> 'date')::date, left(btrim(v_day ->> 'name'), 80), true, p_batch)
    on conflict (org_id, date) do nothing;
  end loop;

  for v_day in select value from jsonb_array_elements(coalesce(p_aliases, '[]'::jsonb)) loop
    insert into public.exercise_aliases (org_id, alias_normalized, exercise_id)
    values (p_org, v_day ->> 'term', (v_day ->> 'exercise_id')::uuid)
    on conflict on constraint exercise_aliases_org_alias_key do nothing;
  end loop;

  update public.import_batches b
     set status = 'committed', committed_at = now(),
         summary = coalesce(p_summary, '{}'::jsonb) || jsonb_build_object('workouts', to_jsonb(v_made), 'replaced', to_jsonb(v_replaced))
   where b.id = p_batch;
  return jsonb_build_object('workouts', cardinality(v_made), 'replaced', cardinality(v_replaced));
end;
$$;

/** Undoes an import: its workouts go (soft delete, as any delete), what it replaced comes back, its days are cleared. */
create function public.undo_import(p_org uuid, p_batch uuid)
returns jsonb
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_batch public.import_batches;
  v_removed int;
  v_restored int;
begin
  if not exists (select 1 from private.orgs_where_can_program() o where o = p_org) then
    raise exception 'You cannot program workouts in this gym' using errcode = 'insufficient_privilege';
  end if;
  select * into v_batch from public.import_batches b where b.id = p_batch and b.org_id = p_org for update;
  if not found then
    raise exception 'This import does not exist' using errcode = 'no_data_found';
  end if;
  if v_batch.status <> 'committed' then
    raise exception 'Only an import that was made can be undone' using errcode = 'invalid_parameter_value';
  end if;

  update public.workouts w set deleted_at = now()
   where w.import_batch_id = p_batch and w.org_id = p_org and w.deleted_at is null;
  get diagnostics v_removed = row_count;
  update public.workouts w set deleted_at = null
   where w.org_id = p_org and w.deleted_at is not null
     and w.id in (select (r #>> '{}')::uuid from jsonb_array_elements(coalesce(v_batch.summary -> 'replaced', '[]'::jsonb)) r);
  get diagnostics v_restored = row_count;
  delete from public.program_days d where d.import_batch_id = p_batch and d.org_id = p_org;
  -- Closed days: owners and head coaches (RLS); a coach's undo leaves them.
  delete from public.calendar_days d where d.import_batch_id = p_batch and d.org_id = p_org;

  update public.import_batches b set status = 'undone', undone_at = now() where b.id = p_batch;
  return jsonb_build_object('removed', v_removed, 'restored', v_restored);
end;
$$;

revoke all on function public.commit_import(uuid, uuid, jsonb, uuid[], text[], jsonb, jsonb, jsonb, jsonb), public.undo_import(uuid, uuid) from public, anon;
grant execute on function public.commit_import(uuid, uuid, jsonb, uuid[], text[], jsonb, jsonb, jsonb, jsonb), public.undo_import(uuid, uuid) to authenticated;
