-- =============================================================================
-- UnitPass — Phase 2: company profile + customers
-- =============================================================================
-- Idempotent and non-destructive. If the legacy customers table already exists,
-- its rows and columns are preserved; this migration only adds archived_at and
-- refreshes its indexes, trigger, privileges, and tenant policies.
--
-- Apply after 20261007000001_phase1_foundation.sql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261015000001_phase2_customers.sql
-- =============================================================================

begin;

-- Company profile extension. Other company profile columns were added in Phase 1.
alter table public.companies
  add column if not exists service_booking_url text;

-- Customer records. A legacy install may already have this table and its data.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The only new customer column on the legacy table is the soft-archive marker.
-- Do not rewrite or delete any existing customer rows.
alter table public.customers
  add column if not exists archived_at timestamptz;

-- The Phase 1 shared trigger function keeps updated_at consistent.
drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- Tenant-scoped indexes used by the list, ordering, and search queries.
create index if not exists customers_company_archived_at_idx
  on public.customers (company_id, archived_at);
create index if not exists customers_company_last_first_lower_idx
  on public.customers (company_id, lower(last_name), lower(first_name));
create index if not exists customers_company_email_lower_idx
  on public.customers (company_id, lower(email));

-- Replace both Phase 2 policies and the recursive policies from the legacy
-- schema. All tenant checks use the Phase 1 SECURITY DEFINER helper.
alter table public.customers enable row level security;

drop policy if exists "Members can view customers of their company" on public.customers;
drop policy if exists "Members can insert customers for their company" on public.customers;
drop policy if exists "Members can update customers of their company" on public.customers;
drop policy if exists "Members can delete customers of their company" on public.customers;

drop policy if exists customers_select_company_members on public.customers;
drop policy if exists customers_insert_company_members on public.customers;
drop policy if exists customers_update_company_members on public.customers;
drop policy if exists customers_delete_company_members on public.customers;

create policy customers_select_company_members
  on public.customers for select
  to authenticated
  using (public.is_company_member(company_id));

create policy customers_insert_company_members
  on public.customers for insert
  to authenticated
  with check (public.is_company_member(company_id));

create policy customers_update_company_members
  on public.customers for update
  to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- Kept for a future, explicit purge path. The application never hard-deletes.
create policy customers_delete_company_members
  on public.customers for delete
  to authenticated
  using (public.is_company_member(company_id));

revoke all on public.customers from anon;
grant select, insert, update, delete on public.customers to authenticated;

commit;
