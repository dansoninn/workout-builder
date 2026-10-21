-- Computed data and audit (SPEC-data-model §7).

-- ---------------------------------------------------------------------------
-- workout_metrics: disposable cache of calculation results, tagged with the
-- calc and taxonomy versions that produced them. Rebuilt on save and in bulk
-- on a version bump. org_id is denormalised so the cache follows tenant RLS.
-- ---------------------------------------------------------------------------

create table public.workout_metrics (
  workout_id uuid not null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  calc_version int not null check (calc_version > 0),
  taxonomy_version int not null references public.taxonomy_versions (version),
  computed_at timestamptz not null default now(),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  confidence jsonb not null default '{}' check (jsonb_typeof(confidence) = 'object'),
  primary key (workout_id, calc_version),
  constraint workout_metrics_workout_same_gym
    foreign key (workout_id, org_id) references public.workouts (id, org_id) on delete cascade
);

create index workout_metrics_org_id_idx on public.workout_metrics (org_id);

create trigger workout_metrics_pin_parent
  before update on public.workout_metrics
  for each row execute function private.forbid_column_change('org_id', 'workout_id');

alter table public.workout_metrics enable row level security;

create policy "Members can read their gym's metrics"
  on public.workout_metrics for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));
create policy "Coaches can write metrics"
  on public.workout_metrics for insert to authenticated
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches can refresh metrics"
  on public.workout_metrics for update to authenticated
  using (org_id in (select private.orgs_where_can_program()))
  with check (org_id in (select private.orgs_where_can_program()));
create policy "Coaches can clear metrics"
  on public.workout_metrics for delete to authenticated
  using (org_id in (select private.orgs_where_can_program()));

revoke all on table public.workout_metrics from anon, authenticated;
grant select, insert, update, delete on table public.workout_metrics to authenticated;
grant all on table public.workout_metrics to service_role;

-- ---------------------------------------------------------------------------
-- audit_log: append-only history of changes to programming tables.
-- No foreign keys on purpose: history outlives deleted rows, users and gyms.
-- diff: insert → {"new": row}; delete → {"old": row};
--       update → {"old": {changed cols}, "new": {changed cols}}.
-- ---------------------------------------------------------------------------

create type public.audit_action as enum ('insert', 'update', 'delete');

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor_id uuid,
  table_name text not null,
  row_id uuid not null,
  action public.audit_action not null,
  diff jsonb not null,
  at timestamptz not null default now()
);

comment on column public.audit_log.org_id is 'NULL for changes to the core library.';
comment on column public.audit_log.actor_id is 'auth.uid() of the user; NULL for service-role changes.';
comment on column public.audit_log.row_id is 'Primary key of the changed row (user_id for memberships).';

create index audit_log_org_at_idx on public.audit_log (org_id, at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id);

-- Trigger argument (optional): the column holding the row id. Default 'id'.
create function private.write_audit_log()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_id_column text := coalesce(tg_argv[0], 'id');
  v_diff jsonb;
begin
  if tg_op = 'INSERT' then
    v_diff := jsonb_build_object('new', v_new);
  elsif tg_op = 'DELETE' then
    v_diff := jsonb_build_object('old', v_old);
  else
    select jsonb_build_object(
             'old', coalesce(jsonb_object_agg(o.key, o.value), '{}'::jsonb),
             'new', coalesce(jsonb_object_agg(o.key, v_new -> o.key), '{}'::jsonb))
      into v_diff
      from jsonb_each(v_old) as o
     where o.value is distinct from v_new -> o.key
       and o.key not in ('updated_at', 'updated_by');

    -- Nothing but bookkeeping changed: not worth a log entry.
    if v_diff -> 'old' = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.audit_log (org_id, actor_id, table_name, row_id, action, diff)
  values (
    (v_row ->> 'org_id')::uuid,
    auth.uid(),
    tg_table_name,
    (v_row ->> v_id_column)::uuid,
    lower(tg_op)::public.audit_action,
    v_diff
  );
  return null;
end;
$$;

create trigger workouts_audit
  after insert or update or delete on public.workouts
  for each row execute function private.write_audit_log();
create trigger blocks_audit
  after insert or update or delete on public.blocks
  for each row execute function private.write_audit_log();
create trigger block_items_audit
  after insert or update or delete on public.block_items
  for each row execute function private.write_audit_log();
create trigger exercises_audit
  after insert or update or delete on public.exercises
  for each row execute function private.write_audit_log();
create trigger memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function private.write_audit_log('user_id');

-- Append-only, enforced for every role (not just through privileges).
create function private.forbid_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function private.forbid_audit_change();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.forbid_audit_change();

alter table public.audit_log enable row level security;

create policy "Members can read their gym's audit log"
  on public.audit_log for select to authenticated
  using (org_id in (select private.orgs_where_can_read()));

revoke all on table public.audit_log from anon, authenticated, service_role;
grant select on table public.audit_log to authenticated;
grant select, insert on table public.audit_log to service_role;
