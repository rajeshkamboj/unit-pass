-- =============================================================================
-- UnitPass — LOCAL PostgreSQL shim (NEVER run this on Supabase)
-- =============================================================================
-- Supabase provides an `auth` schema (users, auth.uid()) and the roles
-- `anon`, `authenticated` and `service_role`. A plain PostgreSQL instance does
-- not, so this file recreates just enough of them to run the migration and the
-- RLS tests locally. On Supabase these objects already exist and this file must
-- NOT be used.
--
-- Usage (disposable database):
--   createdb unitpass_local
--   psql -d unitpass_local -f supabase/tests/local/postgres_shim.sql
--   psql -d unitpass_local -f supabase/migrations/20261007000001_phase1_foundation.sql
--   psql -d unitpass_local -f supabase/tests/rls_tenant_isolation.sql
-- =============================================================================

-- Roles used by Supabase's PostgREST/RLS setup.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;

-- Minimal auth schema: only the columns Supabase guarantees for our usage.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- auth.uid(): the id of the caller, taken from the JWT claims that tests set with
--   set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

-- auth.role(): same idea, for completeness.
create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
    current_user
  );
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
