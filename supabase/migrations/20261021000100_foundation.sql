-- Foundation: shared building blocks used by every later migration.
--
-- The `private` schema holds internal functions (access helpers, validators,
-- trigger functions). It is not exposed through the Supabase Data API, so
-- clients can never call these directly. Signed-in users get USAGE because RLS
-- policies and CHECK constraints call some of these functions as that user.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Functions in `private` are not executable by default; access helpers and
-- validators are granted explicitly where they are created.
alter default privileges in schema private revoke execute on functions from public;

-- Keeps updated_at current on every update.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Rejects updates that change any of the columns named in the trigger
-- arguments. Used to pin tenant rows to their organization and child rows to
-- their parent, so data can never be moved across gyms.
create function private.forbid_column_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    if (to_jsonb(old) -> col) is distinct from (to_jsonb(new) -> col) then
      raise exception '%.% cannot be changed', tg_table_name, col
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;
