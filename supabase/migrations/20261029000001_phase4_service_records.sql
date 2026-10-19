-- =============================================================================
-- UnitPass — Phase 4: service records, service history, public RPC extension
-- =============================================================================
-- Idempotent and non-destructive. Safe on an empty project AND on a project
-- where `supabase/legacy/schema.sql.txt` created `service_records` before.
-- Existing rows are preserved; only missing columns are added. The denormalised
-- `company_id` is backfilled from the parent equipment row (the authoritative
-- owner) and enforced NOT NULL only when no orphan rows remain.
--
-- Apply after the Phase 1, 2 and 3 migrations:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261029000001_phase4_service_records.sql
--
-- Security model
--  * `company_id` is never trusted from the browser. `set_service_record_company()`
--    overwrites it from `equipment.company_id` on every insert/update, and RLS
--    (`is_company_member(company_id)`) validates the resolved row.
--  * Tenant members may select/insert/update/delete their own service records.
--    `anon` holds no table privileges at all.
--  * The public UnitPass RPC gains a capped `service_history` whitelist:
--    service_date, service_type, technician_name, public_notes. `private_notes`
--    is never returned.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Service type enum (reuse the legacy spellings; never invent new labels)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'service_type' and n.nspname = 'public'
  ) then
    create type public.service_type as enum (
      'Installation', 'Maintenance', 'Repair', 'Inspection', 'Warranty Service', 'Other'
    );
  else
    alter type public.service_type add value if not exists 'Installation';
    alter type public.service_type add value if not exists 'Maintenance';
    alter type public.service_type add value if not exists 'Repair';
    alter type public.service_type add value if not exists 'Inspection';
    alter type public.service_type add value if not exists 'Warranty Service';
    alter type public.service_type add value if not exists 'Other';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2. Service records table
-- -----------------------------------------------------------------------------
create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  service_date date not null,
  service_type public.service_type not null,
  technician_name text,
  public_notes text,
  private_notes text,
  next_service_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Converge a legacy/partial table without touching existing data.
alter table public.service_records add column if not exists id uuid default gen_random_uuid();
alter table public.service_records add column if not exists company_id uuid;
alter table public.service_records add column if not exists equipment_id uuid;
alter table public.service_records add column if not exists service_date date;
alter table public.service_records add column if not exists service_type public.service_type;
alter table public.service_records add column if not exists technician_name text;
alter table public.service_records add column if not exists public_notes text;
alter table public.service_records add column if not exists private_notes text;
alter table public.service_records add column if not exists next_service_date date;
alter table public.service_records add column if not exists created_at timestamptz default now();
alter table public.service_records add column if not exists updated_at timestamptz default now();

update public.service_records set id = gen_random_uuid() where id is null;
update public.service_records set created_at = now() where created_at is null;
update public.service_records set updated_at = now() where updated_at is null;

alter table public.service_records alter column id set default gen_random_uuid();
alter table public.service_records alter column id set not null;
alter table public.service_records alter column created_at set default now();
alter table public.service_records alter column created_at set not null;
alter table public.service_records alter column updated_at set default now();
alter table public.service_records alter column updated_at set not null;

-- A primary key is required for idempotent upserts and for PostgREST. Legacy
-- already has one; this covers a partially-created table only.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.service_records'::regclass
      and contype = 'p'
  ) then
    alter table public.service_records add constraint service_records_pkey primary key (id);
  end if;
end
$$;

-- Required values must already be present or the migration stops loudly rather
-- than inventing dates/equipment. (The legacy table declared these NOT NULL.)
do $$
declare
  v_missing integer;
begin
  select count(*) into v_missing
  from public.service_records
  where equipment_id is null
     or service_date is null
     or service_type is null;

  if v_missing > 0 then
    raise exception
      'Phase 4 migration stopped: % service_records row(s) have no equipment_id/service_date/service_type. Repair the legacy rows, then re-run.',
      v_missing;
  end if;
end
$$;

alter table public.service_records alter column equipment_id set not null;
alter table public.service_records alter column service_date set not null;
alter table public.service_records alter column service_type set not null;

-- Denormalised tenant id: the parent equipment row is the single source of
-- truth. Backfill (and repair) every existing row from it.
update public.service_records sr
set company_id = e.company_id
from public.equipment e
where sr.equipment_id = e.id
  and sr.company_id is distinct from e.company_id;

do $$
declare
  v_orphans integer;
begin
  select count(*) into v_orphans
  from public.service_records
  where company_id is null;

  if v_orphans > 0 then
    raise exception
      'Phase 4 migration stopped: % service_records row(s) reference equipment that no longer exists, so company_id cannot be backfilled. Repair or remove those rows with owner approval, then re-run.',
      v_orphans;
  end if;
end
$$;

alter table public.service_records alter column company_id set not null;

-- Foreign keys: fresh installs get them from CREATE TABLE; a legacy/partial
-- table may be missing the company_id one (it never had that column).
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.service_records'::regclass
      and c.contype = 'f'
      and c.conkey = array[
        (select a.attnum
         from pg_attribute a
         where a.attrelid = 'public.service_records'::regclass
           and a.attname = 'company_id')
      ]::smallint[]
  ) then
    alter table public.service_records
      add constraint service_records_company_id_fkey
      foreign key (company_id) references public.companies (id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.service_records'::regclass
      and c.contype = 'f'
      and c.conkey = array[
        (select a.attnum
         from pg_attribute a
         where a.attrelid = 'public.service_records'::regclass
           and a.attname = 'equipment_id')
      ]::smallint[]
  ) then
    alter table public.service_records
      add constraint service_records_equipment_id_fkey
      foreign key (equipment_id) references public.equipment (id) on delete cascade;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 3. Timestamps + tenant resolution (browser-supplied company_id is harmless)
-- -----------------------------------------------------------------------------
drop trigger if exists service_records_set_updated_at on public.service_records;
create trigger service_records_set_updated_at
  before update on public.service_records
  for each row execute function public.set_updated_at();

create or replace function public.set_service_record_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  select e.company_id into v_company
  from public.equipment e
  where e.id = new.equipment_id;

  if v_company is null then
    raise exception 'unknown equipment_id' using errcode = '23503';
  end if;

  -- Always overwrite: a forged value from the client can never become tenancy.
  new.company_id := v_company;
  return new;
end
$$;

revoke all on function public.set_service_record_company() from public;

drop trigger if exists service_records_set_company on public.service_records;
create trigger service_records_set_company
  before insert or update on public.service_records
  for each row execute function public.set_service_record_company();

-- -----------------------------------------------------------------------------
-- 4. Indexes
-- -----------------------------------------------------------------------------
create index if not exists service_records_company_date_idx
  on public.service_records (company_id, service_date desc);
create index if not exists service_records_equipment_date_idx
  on public.service_records (equipment_id, service_date desc);

-- -----------------------------------------------------------------------------
-- 5. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.service_records enable row level security;

-- Legacy recursive policies (they queried equipment, whose policy queried
-- company_members) and any earlier Phase 4 run.
drop policy if exists "Members can view service records for their company's equipment" on public.service_records;
drop policy if exists "Members can insert service records for their company's equipment" on public.service_records;
drop policy if exists "Members can update service records for their company's equipment" on public.service_records;
drop policy if exists "Members can delete service records for their company's equipment" on public.service_records;
drop policy if exists service_records_select_company_members on public.service_records;
drop policy if exists service_records_insert_company_members on public.service_records;
drop policy if exists service_records_update_company_members on public.service_records;
drop policy if exists service_records_delete_company_members on public.service_records;

-- `WITH CHECK` is evaluated on the final row, i.e. after the BEFORE trigger has
-- resolved company_id from equipment. Section 4 of the SQL test asserts this.
create policy service_records_select_company_members
  on public.service_records for select
  to authenticated
  using (public.is_company_member(company_id));

create policy service_records_insert_company_members
  on public.service_records for insert
  to authenticated
  with check (public.is_company_member(company_id));

create policy service_records_update_company_members
  on public.service_records for update
  to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- Members may correct mistakes by deleting a log entry. Deleting a service
-- record never deletes equipment or customer data.
create policy service_records_delete_company_members
  on public.service_records for delete
  to authenticated
  using (public.is_company_member(company_id));

revoke all on public.service_records from anon;
grant select, insert, update, delete on public.service_records to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.service_records to service_role;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 6. Public UnitPass RPC: add the capped, whitelisted service history
-- -----------------------------------------------------------------------------
-- Same signature as Phase 3 (no DROP, no churn). Still SECURITY DEFINER with a
-- frozen search_path, still the only anonymous read surface. Service history is
-- newest-first and capped at 20 entries; private_notes never appears.
create or replace function public.get_public_unitpass(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'company', jsonb_build_object(
      'name', c.name,
      'phone', c.phone,
      'email', c.email,
      'website', c.website,
      'service_booking_url', c.service_booking_url,
      'logo_url', c.logo_url
    ),
    'equipment', jsonb_build_object(
      'name', e.equipment_name,
      'type', e.equipment_type,
      'manufacturer', e.manufacturer,
      'model_number', e.model_number,
      'serial_number', e.serial_number,
      'installation_date', e.installation_date,
      'warranty_expiration_date', e.warranty_expiration_date,
      'warranty_notes', e.warranty_notes,
      'public_notes', e.public_notes,
      'status', e.status,
      'photo_path', e.equipment_photo_path
    ),
    'service_history', coalesce(
      (
        select jsonb_agg(entry order by entry_date desc, entry_created desc)
        from (
          select
            jsonb_build_object(
              'service_date', sr.service_date,
              'service_type', sr.service_type,
              'technician_name', sr.technician_name,
              'public_notes', sr.public_notes
            ) as entry,
            sr.service_date as entry_date,
            sr.created_at as entry_created
          from public.service_records sr
          where sr.equipment_id = e.id
          order by sr.service_date desc, sr.created_at desc
          limit 20
        ) history
      ),
      '[]'::jsonb
    )
  )
  from public.equipment e
  join public.companies c on c.id = e.company_id
  where e.public_token = p_token;
$$;

revoke all on function public.get_public_unitpass(uuid) from public;
grant execute on function public.get_public_unitpass(uuid) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.get_public_unitpass(uuid) to service_role;
  end if;
end
$$;

commit;

-- =============================================================================
-- Verification (run manually, not part of the migration):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_rls_enabled.sql
-- =============================================================================
