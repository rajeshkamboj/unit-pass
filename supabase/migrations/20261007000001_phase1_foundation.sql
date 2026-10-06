-- =============================================================================
-- UnitPass — Phase 1: Foundation (companies, profiles, membership, RLS)
-- =============================================================================
-- Idempotent: safe to run against an empty Supabase project AND against a
-- project where the legacy `supabase/legacy/schema.sql.txt` was applied before.
-- Re-running it is a no-op apart from refreshing functions/policies.
--
-- Apply with:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<this file>
-- or paste into the Supabase SQL editor / use `supabase db push`.
--
-- Design notes
--  * `company_members` is the single source of truth for tenancy.
--    `profiles.company_id` is only a convenience pointer (which company to open
--    on sign-in) and is NEVER used for authorization.
--  * Policy predicates call SECURITY DEFINER helpers instead of querying
--    `company_members` from inside its own policy — the legacy schema's
--    self-referencing policies caused "infinite recursion detected in policy".
--  * Companies can only be created through `create_company_with_owner()`, so no
--    client can create arbitrary companies or grant itself a membership.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Extensions. gen_random_uuid() is core in PostgreSQL 13+ (Supabase runs 15+),
--    pgcrypto is requested defensively for older/self-hosted databases.
-- -----------------------------------------------------------------------------
do $$
begin
  create extension if not exists pgcrypto;
exception
  when others then
    raise notice 'Skipping pgcrypto (%). gen_random_uuid() comes from PostgreSQL core.', sqlerrm;
end
$$;

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  contact_name text,
  phone text,
  email text,
  website text,
  address text,
  default_service_interval integer not null default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  full_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  role text not null default 'technician' check (role in ('owner', 'admin', 'technician')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id)
);

-- Converge a legacy/partial schema without touching existing data.
alter table public.companies add column if not exists logo_url text;
alter table public.companies add column if not exists contact_name text;
alter table public.companies add column if not exists phone text;
alter table public.companies add column if not exists email text;
alter table public.companies add column if not exists website text;
alter table public.companies add column if not exists address text;
alter table public.companies add column if not exists default_service_interval integer default 12;
alter table public.companies add column if not exists created_at timestamptz default now();
alter table public.companies add column if not exists updated_at timestamptz default now();

alter table public.profiles add column if not exists company_id uuid references public.companies (id) on delete set null;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

alter table public.company_members add column if not exists role text default 'technician';
alter table public.company_members add column if not exists created_at timestamptz default now();
alter table public.company_members add column if not exists updated_at timestamptz default now();

-- Backfill defaults, then tighten constraints (no data is deleted; NULLs get sane values).
update public.companies set default_service_interval = 12 where default_service_interval is null;
update public.companies set created_at = now() where created_at is null;
update public.companies set updated_at = now() where updated_at is null;
update public.profiles set updated_at = now() where updated_at is null;
update public.company_members set role = 'technician' where role is null;
update public.company_members set created_at = now() where created_at is null;
update public.company_members set updated_at = now() where updated_at is null;

alter table public.companies alter column default_service_interval set default 12;
alter table public.companies alter column default_service_interval set not null;
alter table public.companies alter column created_at set default now();
alter table public.companies alter column created_at set not null;
alter table public.companies alter column updated_at set default now();
alter table public.companies alter column updated_at set not null;

alter table public.profiles alter column updated_at set default now();
alter table public.profiles alter column updated_at set not null;

alter table public.company_members alter column created_at set default now();
alter table public.company_members alter column created_at set not null;
alter table public.company_members alter column updated_at set default now();
alter table public.company_members alter column updated_at set not null;

-- The legacy profile id was nullable in some setups; the auth trigger relies on
-- the 1:1 relationship, so make sure the primary key exists.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'p'
  ) then
    alter table public.profiles add constraint profiles_pkey primary key (id);
  end if;
end
$$;

-- Ensure (user_id, company_id) is unique even on a legacy table.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.company_members'::regclass
      and contype = 'u'
  ) then
    alter table public.company_members add constraint company_members_user_id_company_id_key unique (user_id, company_id);
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
create index if not exists company_members_user_id_idx on public.company_members (user_id);
create index if not exists company_members_company_id_idx on public.company_members (company_id);
create index if not exists profiles_company_id_idx on public.profiles (company_id);

-- -----------------------------------------------------------------------------
-- 3. updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists company_members_set_updated_at on public.company_members;
create trigger company_members_set_updated_at
  before update on public.company_members
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. RLS helper functions (anti-recursion pattern)
--    SECURITY DEFINER + empty search_path + authenticated-only EXECUTE.
-- -----------------------------------------------------------------------------
create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_company_admin(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.is_company_admin(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.is_company_admin(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Profile bootstrap on sign-up
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public;

-- -----------------------------------------------------------------------------
-- 6. Atomic company creation (the only way a company comes into existence)
-- -----------------------------------------------------------------------------
create or replace function public.create_company_with_owner(
  p_name text,
  p_contact_name text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_address text default null,
  p_default_service_interval integer default 12
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_company_id uuid;
  v_interval integer := coalesce(p_default_service_interval, 12);
begin
  if v_uid is null then
    raise exception 'create_company_with_owner requires an authenticated user'
      using errcode = '28000';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'company name is required' using errcode = '22023';
  end if;

  if v_interval < 1 or v_interval > 60 then
    raise exception 'default_service_interval must be between 1 and 60 months'
      using errcode = '22023';
  end if;

  insert into public.companies (
    name, contact_name, phone, email, website, address, default_service_interval
  )
  values (
    btrim(p_name),
    nullif(btrim(coalesce(p_contact_name, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_website, '')), ''),
    nullif(btrim(coalesce(p_address, '')), ''),
    v_interval
  )
  returning id into v_company_id;

  insert into public.company_members (user_id, company_id, role)
  values (v_uid, v_company_id, 'owner')
  on conflict (user_id, company_id) do update set role = 'owner';

  insert into public.profiles (id, company_id)
  values (v_uid, v_company_id)
  on conflict (id) do update set company_id = excluded.company_id, updated_at = now();

  return v_company_id;
end;
$$;

revoke all on function public.create_company_with_owner(text, text, text, text, text, text, integer) from public;
grant execute on function public.create_company_with_owner(text, text, text, text, text, text, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_members enable row level security;

-- Remove legacy policies, including the broken recursive ones and the
-- "any authenticated user may insert a company" hole from the legacy schema.
drop policy if exists "Authenticated users can insert companies" on public.companies;
drop policy if exists "Members can view their company" on public.companies;
drop policy if exists "Members can update their company" on public.companies;
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Members can view company members of their company" on public.company_members;
drop policy if exists "Members can insert company members for their company (if owner/admin)" on public.company_members;
drop policy if exists "Members can update company members for their company (if owner/admin)" on public.company_members;
drop policy if exists "Members can delete company members for their company (if owner/admin)" on public.company_members;

-- Phase 1 policy names (so re-running this migration is clean)
drop policy if exists companies_select_members on public.companies;
drop policy if exists companies_update_admins on public.companies;
drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists company_members_select_members on public.company_members;
drop policy if exists company_members_insert_admins on public.company_members;
drop policy if exists company_members_update_admins on public.company_members;
drop policy if exists company_members_delete_admins on public.company_members;

-- companies: members read, admins update. NO insert policy on purpose:
-- creation happens exclusively through create_company_with_owner().
create policy companies_select_members
  on public.companies for select
  to authenticated
  using (public.is_company_member(id));

create policy companies_update_admins
  on public.companies for update
  to authenticated
  using (public.is_company_admin(id))
  with check (public.is_company_admin(id));

-- profiles: a user may only see and change their own row.
create policy profiles_select_self
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- company_members: members read their company's members, admins manage them.
create policy company_members_select_members
  on public.company_members for select
  to authenticated
  using (public.is_company_member(company_id));

create policy company_members_insert_admins
  on public.company_members for insert
  to authenticated
  with check (public.is_company_admin(company_id));

create policy company_members_update_admins
  on public.company_members for update
  to authenticated
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

create policy company_members_delete_admins
  on public.company_members for delete
  to authenticated
  using (public.is_company_admin(company_id));

-- -----------------------------------------------------------------------------
-- 8. Privileges: anonymous users get NOTHING on tenant tables.
-- -----------------------------------------------------------------------------
revoke all on public.companies from anon;
revoke all on public.profiles from anon;
revoke all on public.company_members from anon;

grant usage on schema public to anon, authenticated;

grant select, update on public.companies to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;

-- Supabase's service_role (server-only key) needs table privileges for admin
-- jobs such as webhook/cron processing in later phases.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.companies to service_role;
    grant all on public.profiles to service_role;
    grant all on public.company_members to service_role;
  end if;
end
$$;

commit;

-- =============================================================================
-- Verification (run manually, not part of the migration):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_rls_enabled.sql
-- =============================================================================
