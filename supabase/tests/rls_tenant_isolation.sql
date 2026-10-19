-- =============================================================================
-- UnitPass — tenant isolation test suite (Phase 1, extended by later phases)
-- =============================================================================
-- Proves with real database behaviour that Row Level Security isolates tenants.
-- Everything happens inside ONE transaction that is rolled back at the end, so
-- running it never leaves fixtures behind and is safe on a live project.
--
-- Run:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
--
-- Expected result: Phase 1, Phase 2, Phase 3 and Phase 4 "PASS: ..." notices and
-- a final "ALL CHECKS PASSED (Phase 1 + Phase 2 + Phase 3 + Phase 4 tenant
-- isolation)" notice, ending with ROLLBACK. Any failed assertion raises an
-- exception -> non-zero exit.
--
-- Fixtures (deterministic ids so assertions can reference them as literals):
--   user A    11111111-1111-4111-8111-111111111111
--   user B    22222222-2222-4222-8222-222222222222
--   company A aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
--   company B bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Fixtures (created as the migration/owner role: bypasses RLS).
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'owner-a@unitpass.test', '{"full_name":"Owner A"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'owner-b@unitpass.test', '{"full_name":"Owner B"}'::jsonb)
on conflict (id) do nothing;

insert into public.companies (id, name, contact_name, phone, email, address, default_service_interval)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alpha HVAC', 'Ana Alpha', '555-0001', 'ana@alpha.test', '1 Alpha St', 12),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bravo Heating', 'Ben Bravo', '555-0002', 'ben@bravo.test', '2 Bravo St', 6)
on conflict (id) do nothing;

insert into public.profiles (id, company_id, full_name)
values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Owner A'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Owner B')
on conflict (id) do update set company_id = excluded.company_id;

insert into public.company_members (user_id, company_id, role)
values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'owner')
on conflict (user_id, company_id) do update set role = excluded.role;

-- Phase 2 fixtures: matching search terms prove that RLS scopes search results.
insert into public.customers (
  id, company_id, first_name, last_name, email, phone, city, state, archived_at
)
values
  (
    '33333333-3333-4333-8333-333333333331',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Casey', 'Miller', 'casey.miller@alpha.test', '555-1001', 'Springfield', 'IL', null
  ),
  (
    '33333333-3333-4333-8333-333333333332',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Archived', 'Miller', 'archived.miller@alpha.test', '555-1002', 'Springfield', 'IL', now()
  ),
  (
    '44444444-4444-4444-8444-444444444441',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Casey', 'Miller', 'casey.miller@bravo.test', '555-2001', 'Dayton', 'OH', null
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Archived', 'Miller', 'archived.miller@bravo.test', '555-2002', 'Dayton', 'OH', now()
  )
on conflict (id) do nothing;

-- Phase 3 fixtures: equipment for both tenants. The public tokens are
-- deterministic so the assertions can call the public RPC with literals.
-- `installer_notes` carries a unique marker that must never reach the public
-- payload, and the A unit belongs to the customer with distinctive PII.
insert into public.equipment (
  id, company_id, customer_id, equipment_name, equipment_type, manufacturer,
  model_number, serial_number, installation_date, warranty_expiration_date,
  warranty_notes, next_service_date, service_interval, installer_notes,
  public_notes, status, public_token
)
values
  (
    '55555555-5555-4555-8555-555555555551',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333331',
    'Downstairs AC', 'Air Conditioner', 'Carrier', '24ACC636', 'SN-ALPHA-001',
    '2024-05-01', '2029-05-01', '10-year parts warranty', '2026-11-01', 12,
    'PRIVATE_MARKER_12345', 'Alpha public note', 'Active',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  ),
  (
    '55555555-5555-4555-8555-555555555552',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333332',
    'Retired Furnace', 'Furnace', 'Trane', 'XR80', 'SN-ALPHA-002',
    '2012-01-15', '2017-01-15', 'Warranty expired', null, null,
    'PRIVATE_MARKER_12345', 'Retired unit note', 'Replaced',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
  ),
  (
    '66666666-6666-4666-8666-666666666661',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '44444444-4444-4444-8444-444444444441',
    'Bravo Boiler', 'Boiler', 'Viessmann', 'V100', 'SN-BRAVO-001',
    '2021-09-01', '2031-09-01', 'Bravo warranty', '2027-03-01', 24,
    'BRAVO_PRIVATE_MARKER', 'Bravo public note', 'Active',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
  )
on conflict (id) do nothing;

-- The sign-up trigger must have created the profiles rows.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.profiles where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  );
  if v_count <> 2 then
    raise exception 'FAIL: handle_new_user trigger did not create profiles rows (found %)', v_count;
  end if;
  raise notice 'PASS: profiles are created automatically on sign-up';
end
$$;

-- =============================================================================
-- SECTION 1 — PHASE 1: companies / profiles / company_members
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 Company A's owner sees exactly its own company.
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
declare
  v_own integer;
  v_other integer;
begin
  select count(*) into v_own from public.companies where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_own <> 1 then
    raise exception 'FAIL: Company A member cannot read its own company (rows=%)', v_own;
  end if;
  raise notice 'PASS: 1.1 A reads its own company row';

  select count(*) into v_other from public.companies where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if v_other <> 0 then
    raise exception 'FAIL: Company A member can read Company B (rows=%)', v_other;
  end if;
  raise notice 'PASS: 1.2 A cannot read Company B';
end
$$;

-- -----------------------------------------------------------------------------
-- 1.3 Membership rows are scoped to the caller's company.
-- -----------------------------------------------------------------------------
do $$
declare
  v_total integer;
  v_foreign integer;
begin
  select count(*) into v_total from public.company_members;
  if v_total <> 1 then
    raise exception 'FAIL: A sees % membership rows (expected only its own)', v_total;
  end if;
  select count(*) into v_foreign from public.company_members where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if v_foreign <> 0 then
    raise exception 'FAIL: A sees Company B memberships (rows=%)', v_foreign;
  end if;
  raise notice 'PASS: 1.3 A only sees its own membership row';
end
$$;

-- -----------------------------------------------------------------------------
-- 1.4/1.5 Profile isolation.
-- -----------------------------------------------------------------------------
do $$
declare
  v_own integer;
  v_other integer;
begin
  select count(*) into v_own from public.profiles where id = '11111111-1111-4111-8111-111111111111';
  if v_own <> 1 then
    raise exception 'FAIL: A cannot read its own profile (rows=%)', v_own;
  end if;
  select count(*) into v_other from public.profiles where id = '22222222-2222-4222-8222-222222222222';
  if v_other <> 0 then
    raise exception 'FAIL: A can read B profile (rows=%)', v_other;
  end if;
  raise notice 'PASS: 1.4 A reads only its own profile';
end
$$;

-- -----------------------------------------------------------------------------
-- 1.6 Updating another tenant's company affects 0 rows.
-- -----------------------------------------------------------------------------
do $$
declare
  v_updated integer;
  v_name text;
begin
  update public.companies set name = 'HIJACKED' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'FAIL: A updated % rows of Company B', v_updated;
  end if;

  -- A can still update its own company.
  update public.companies set contact_name = 'Ana Alpha (updated)' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'FAIL: A could not update its own company (rows=%)', v_updated;
  end if;

  reset role;
  select name into v_name from public.companies where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if v_name = 'HIJACKED' then
    raise exception 'FAIL: Company B name was modified by Company A';
  end if;
  raise notice 'PASS: 1.5 A cannot update Company B (0 rows) but can update its own';
end
$$;

-- -----------------------------------------------------------------------------
-- 1.7 A cannot add itself (or anyone) to Company B.
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
begin
  begin
    insert into public.company_members (user_id, company_id, role)
    values ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'owner');
    raise exception 'FAIL: A inserted a membership into Company B';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS: 1.6 A cannot insert a membership into Company B (%)', sqlerrm;
    when others then
      -- Any rejection is acceptable (RLS denial surfaces as different SQLSTATEs
      -- depending on PostgreSQL version); only a successful insert is a failure.
      raise notice 'PASS: 1.6 A cannot insert a membership into Company B (%)', sqlerrm;
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- 1.8 Companies cannot be created directly: creation is RPC-only.
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    insert into public.companies (name) values ('Rogue LLC');
    raise exception 'FAIL: a company row was inserted directly by an authenticated user';
  exception
    when others then
      raise notice 'PASS: 1.7 direct company insert is rejected (%)', sqlerrm;
  end;
end
$$;

-- -----------------------------------------------------------------------------
-- 1.9 create_company_with_owner() creates a company + owner membership for the
--     caller, and the other tenant cannot see it.
-- -----------------------------------------------------------------------------
do $$
declare
  v_new_company uuid;
  v_role text;
  v_visible integer;
begin
  v_new_company := public.create_company_with_owner(
    'Alpha Second Company', 'Ana Alpha', '555-0100', 'second@alpha.test', null, '3 Alpha St', 12
  );
  if v_new_company is null then
    raise exception 'FAIL: create_company_with_owner returned null';
  end if;

  select count(*) into v_visible from public.companies where id = v_new_company;
  if v_visible <> 1 then
    raise exception 'FAIL: creator cannot read the company it just created (rows=%)', v_visible;
  end if;

  select role into v_role from public.company_members
    where company_id = v_new_company and user_id = '11111111-1111-4111-8111-111111111111';
  if v_role is distinct from 'owner' then
    raise exception 'FAIL: creator role is % (expected owner)', coalesce(v_role, 'NULL');
  end if;
  raise notice 'PASS: 1.8 create_company_with_owner creates the company with the caller as owner';
end
$$;

set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

do $$
declare
  v_seen integer;
begin
  select count(*) into v_seen from public.companies where name = 'Alpha Second Company';
  if v_seen <> 0 then
    raise exception 'FAIL: Company B can see the company A created (rows=%)', v_seen;
  end if;
  raise notice 'PASS: 1.9 the newly created company is invisible to the other tenant';
end
$$;

-- -----------------------------------------------------------------------------
-- 1.10 Anonymous role has no access at all to Phase 1 tenant tables.
-- -----------------------------------------------------------------------------
reset role;
set local role anon;

do $$
declare
  v_blocked integer := 0;
begin
  begin
    perform 1 from public.companies limit 1;
  exception when others then
    v_blocked := v_blocked + 1;
  end;

  begin
    perform 1 from public.profiles limit 1;
  exception when others then
    v_blocked := v_blocked + 1;
  end;

  begin
    perform 1 from public.company_members limit 1;
  exception when others then
    v_blocked := v_blocked + 1;
  end;

  if v_blocked <> 3 then
    raise exception 'FAIL: anonymous role could read Phase 1 tenant tables (% of 3 blocked)', v_blocked;
  end if;
  raise notice 'PASS: 1.10 anon has no access to companies/profiles/company_members';
end
$$;

-- =============================================================================
-- SECTION 2 — PHASE 2: customers
-- =============================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- 2.1 A can see its own active and archived customers, but no Company B rows.
do $$
declare
  v_own integer;
  v_other integer;
begin
  select count(*) into v_own
    from public.customers
    where id in (
      '33333333-3333-4333-8333-333333333331',
      '33333333-3333-4333-8333-333333333332'
    );
  if v_own <> 2 then
    raise exception 'FAIL: A sees % of its 2 customer rows', v_own;
  end if;

  select count(*) into v_other
    from public.customers
    where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if v_other <> 0 then
    raise exception 'FAIL: A can select Company B customers (rows=%)', v_other;
  end if;
  raise notice 'PASS: 2.1 A can select only its own customers, including archived rows';
end
$$;

-- 2.2 Forged cross-tenant updates/archives affect no rows; own archive works.
do $$
declare
  v_updated integer;
begin
  update public.customers
    set first_name = 'Hijacked', archived_at = now()
    where id = '44444444-4444-4444-8444-444444444441';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'FAIL: A updated/archived a Company B customer (rows=%)', v_updated;
  end if;

  update public.customers
    set archived_at = null
    where id = '44444444-4444-4444-8444-444444444442';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'FAIL: A unarchived a Company B customer (rows=%)', v_updated;
  end if;

  update public.customers
    set archived_at = now()
    where id = '33333333-3333-4333-8333-333333333331';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'FAIL: A could not archive its own customer (rows=%)', v_updated;
  end if;
  raise notice 'PASS: 2.2 A cannot update/archive B, and can archive its own customer';
end
$$;

-- 2.3 A's case-insensitive multi-column search sees matching A rows only.
do $$
declare
  v_matches integer;
  v_foreign integer;
begin
  select count(*) into v_matches
    from public.customers
    where first_name ilike '%Casey%'
       or last_name ilike '%Miller%'
       or email ilike '%Miller%'
       or phone ilike '%Miller%';
  if v_matches <> 2 then
    raise exception 'FAIL: A search returned % matching rows (expected its 2 rows)', v_matches;
  end if;

  select count(*) into v_foreign
    from public.customers
    where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and last_name ilike '%Miller%';
  if v_foreign <> 0 then
    raise exception 'FAIL: A search returned % Company B customer rows', v_foreign;
  end if;
  raise notice 'PASS: 2.3 customer search returns matching Company A rows only';
end
$$;

-- 2.4 An archived customer remains visible to its own company, never another.
do $$
declare
  v_own_archived integer;
  v_foreign_archived integer;
begin
  select count(*) into v_own_archived
    from public.customers
    where id = '33333333-3333-4333-8333-333333333332'
      and archived_at is not null;
  if v_own_archived <> 1 then
    raise exception 'FAIL: A cannot see its own archived customer (rows=%)', v_own_archived;
  end if;

  select count(*) into v_foreign_archived
    from public.customers
    where id = '44444444-4444-4444-8444-444444444442'
      and archived_at is not null;
  if v_foreign_archived <> 0 then
    raise exception 'FAIL: A can see B archived customer (rows=%)', v_foreign_archived;
  end if;
  raise notice 'PASS: 2.4 archived rows remain visible only to their own company';
end
$$;

-- 2.5 A cannot forge company_id on insert: RLS WITH CHECK must reject it.
do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.customers (company_id, first_name, last_name)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Forged', 'Customer');
  exception
    when insufficient_privilege or check_violation then
      v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'FAIL: A inserted a customer with Company B company_id';
  end if;
  raise notice 'PASS: 2.5 A customer insert with Company B company_id is rejected by WITH CHECK';
end
$$;

-- A can restore its own archived customer; the application uses this action
-- instead of deleting customer records.
do $$
declare
  v_updated integer;
begin
  update public.customers
    set archived_at = null
    where id = '33333333-3333-4333-8333-333333333332';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'FAIL: A could not unarchive its own customer (rows=%)', v_updated;
  end if;
  raise notice 'PASS: 2.6 A can unarchive its own customer';
end
$$;

-- 2.7 Company A cannot change Company B's Phase 2 profile fields.
do $$
declare
  v_updated integer;
begin
  update public.companies
    set service_booking_url = 'https://forged.example/book', default_service_interval = 48
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'FAIL: A updated Company B profile settings (rows=%)', v_updated;
  end if;

  update public.companies
    set service_booking_url = 'https://alpha.example/book', default_service_interval = 24
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'FAIL: A could not update its own Phase 2 profile settings (rows=%)', v_updated;
  end if;
  raise notice 'PASS: 2.7 company profile updates are tenant-scoped';
end
$$;

-- 2.8 Anonymous role has no access to customers.
reset role;
set local role anon;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform 1 from public.customers limit 1;
  exception when others then
    v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'FAIL: anonymous role could read customers';
  end if;
  raise notice 'PASS: 2.8 anon has no access to customers';
end
$$;

-- =============================================================================
-- SECTION 3 — PHASE 3: equipment, public tokens, public UnitPass RPC
-- =============================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- 3.1 Company A sees its own equipment only.
do $$
declare
  v_own integer;
  v_foreign integer;
begin
  select count(*) into v_own
    from public.equipment
    where id in (
      '55555555-5555-4555-8555-555555555551',
      '55555555-5555-4555-8555-555555555552'
    );
  if v_own <> 2 then
    raise exception 'FAIL: A sees % of its 2 equipment rows', v_own;
  end if;

  select count(*) into v_foreign
    from public.equipment
    where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if v_foreign <> 0 then
    raise exception 'FAIL: A can select Company B equipment (rows=%)', v_foreign;
  end if;
  raise notice 'PASS: 3.1 A can select only its own equipment rows';
end
$$;

-- 3.2 Forged cross-tenant updates and status changes affect no rows.
do $$
declare
  v_updated integer;
begin
  update public.equipment
    set equipment_name = 'Hijacked', status = 'Replaced'
    where id = '66666666-6666-4666-8666-666666666661';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'FAIL: A updated Company B equipment (rows=%)', v_updated;
  end if;

  update public.equipment
    set manufacturer = 'Carrier Edited'
    where id = '55555555-5555-4555-8555-555555555551';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'FAIL: A could not update its own equipment (rows=%)', v_updated;
  end if;
  raise notice 'PASS: 3.2 A cannot modify B equipment, and can edit its own';
end
$$;

-- 3.3 Forging company_id on insert is rejected by RLS.
do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.equipment (
      company_id, customer_id, equipment_name, equipment_type, status
    )
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '44444444-4444-4444-8444-444444444441',
      'Forged Unit', 'Other', 'Active'
    );
  exception
    when others then
      v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'FAIL: A inserted equipment with Company B company_id';
  end if;
  raise notice 'PASS: 3.3 equipment insert with Company B company_id is rejected';
end
$$;

-- 3.4 Pairing the caller's company with another tenant's customer is rejected
--     by the equipment_customer_same_company trigger (defence in depth).
do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.equipment (
      company_id, customer_id, equipment_name, equipment_type, status
    )
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '44444444-4444-4444-8444-444444444441',
      'Cross Tenant Unit', 'Other', 'Active'
    );
  exception
    when others then
      v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'FAIL: A inserted equipment for Company B customer';
  end if;
  raise notice 'PASS: 3.4 equipment insert with Company B customer_id is rejected';
end
$$;

-- 3.5 The public token is immutable: a normal edit keeps it, changing it fails.
do $$
declare
  v_before uuid;
  v_after uuid;
  v_blocked boolean := false;
begin
  select public_token into v_before
    from public.equipment
    where id = '55555555-5555-4555-8555-555555555551';

  update public.equipment
    set model_number = '24ACC636-B', warranty_notes = 'Edited warranty note'
    where id = '55555555-5555-4555-8555-555555555551';

  select public_token into v_after
    from public.equipment
    where id = '55555555-5555-4555-8555-555555555551';

  if v_before is distinct from v_after then
    raise exception 'FAIL: editing equipment changed public_token (% -> %)', v_before, v_after;
  end if;
  if v_before is distinct from 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1' then
    raise exception 'FAIL: public_token changed to an unexpected value (%)', v_before;
  end if;

  begin
    update public.equipment
      set public_token = gen_random_uuid()
      where id = '55555555-5555-4555-8555-555555555551';
  exception
    when others then
      v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'FAIL: public_token could be changed';
  end if;
  raise notice 'PASS: 3.5 public_token survives edits and cannot be changed';
end
$$;

-- 3.6 Anonymous visitors have no table privileges on equipment.
reset role;
set local role anon;

do $$
declare
  v_blocked integer := 0;
begin
  begin
    perform 1 from public.equipment limit 1;
  exception when others then
    v_blocked := v_blocked + 1;
  end;

  begin
    update public.equipment set public_notes = 'anon' where public_token = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
    -- Even if the statement "succeeds" with zero rows, the privilege check above
    -- is what we assert below via has_table_privilege.
  exception when others then
    v_blocked := v_blocked + 1;
  end;

  if v_blocked < 1 then
    raise exception 'FAIL: anonymous role could read equipment';
  end if;

  if has_table_privilege('anon', 'public.equipment', 'select') then
    raise exception 'FAIL: anon still holds SELECT on public.equipment';
  end if;
  if has_table_privilege('anon', 'public.equipment', 'insert')
     or has_table_privilege('anon', 'public.equipment', 'update')
     or has_table_privilege('anon', 'public.equipment', 'delete') then
    raise exception 'FAIL: anon still holds write privileges on public.equipment';
  end if;
  raise notice 'PASS: 3.6 anon has no privileges on public.equipment';
end
$$;

-- 3.7 The public RPC returns only the approved whitelist for A's token.
do $$
declare
  v_payload jsonb;
  v_text text;
begin
  v_payload := public.get_public_unitpass('cccccccc-cccc-4ccc-8ccc-ccccccccccc1');

  if v_payload is null then
    raise exception 'FAIL: get_public_unitpass returned no payload for a real token';
  end if;

  if v_payload -> 'equipment' ->> 'name' is distinct from 'Downstairs AC' then
    raise exception 'FAIL: public payload has the wrong equipment name (%)',
      v_payload -> 'equipment' ->> 'name';
  end if;
  if v_payload -> 'company' ->> 'name' is distinct from 'Alpha HVAC' then
    raise exception 'FAIL: public payload has the wrong company name (%)',
      v_payload -> 'company' ->> 'name';
  end if;
  if v_payload -> 'equipment' ->> 'warranty_notes' is distinct from 'Edited warranty note' then
    raise exception 'FAIL: public payload is missing warranty notes';
  end if;

  -- Private field must be absent, not merely empty.
  if (v_payload -> 'equipment') ? 'installer_notes' then
    raise exception 'FAIL: installer_notes is present in the public payload';
  end if;

  -- No internal identifiers anywhere in the payload.
  v_text := v_payload::text;
  if v_text like '%"id":%'
     or v_text like '%"company_id":%'
     or v_text like '%"customer_id":%'
     or v_text like '%"equipment_id":%'
     or v_text like '%"public_token":%' then
    raise exception 'FAIL: the public payload contains an internal identifier: %', v_text;
  end if;
  if v_text like '%55555555-5555-4555-8555-555555555551%'
     or v_text like '%33333333-3333-4333-8333-333333333331%'
     or v_text like '%aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa%' then
    raise exception 'FAIL: the public payload contains an internal UUID: %', v_text;
  end if;

  -- Seeded private marker and customer PII must be absent.
  if v_text like '%PRIVATE_MARKER_12345%' then
    raise exception 'FAIL: installer_notes marker leaked into the public payload';
  end if;
  if v_text like '%Casey%'
     or v_text like '%Miller%'
     or v_text like '%casey.miller@alpha.test%'
     or v_text like '%555-1001%'
     or v_text like '%Springfield%' then
    raise exception 'FAIL: customer PII leaked into the public payload: %', v_text;
  end if;

  -- Public notes are allowed and expected.
  if v_text not like '%Alpha public note%' then
    raise exception 'FAIL: public_notes are missing from the public payload';
  end if;

  raise notice 'PASS: 3.7 public payload contains the whitelist only (no ids, notes or PII)';
end
$$;

-- 3.8 Unknown tokens return no payload; replaced equipment still resolves.
do $$
declare
  v_unknown jsonb;
  v_replaced jsonb;
begin
  v_unknown := public.get_public_unitpass('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  if v_unknown is not null then
    raise exception 'FAIL: an unknown token returned a payload';
  end if;

  v_replaced := public.get_public_unitpass('cccccccc-cccc-4ccc-8ccc-ccccccccccc2');
  if v_replaced is null then
    raise exception 'FAIL: replaced equipment no longer resolves (printed QR would break)';
  end if;
  if v_replaced -> 'equipment' ->> 'status' is distinct from 'Replaced' then
    raise exception 'FAIL: replaced equipment status is %', v_replaced -> 'equipment' ->> 'status';
  end if;
  raise notice 'PASS: 3.8 unknown tokens return null and replaced equipment still resolves';
end
$$;

-- 3.9 Anonymous visitors still cannot read the underlying tables.
do $$
declare
  v_blocked integer := 0;
begin
  begin
    perform 1 from public.customers limit 1;
  exception when others then
    v_blocked := v_blocked + 1;
  end;

  begin
    perform 1 from public.companies limit 1;
  exception when others then
    v_blocked := v_blocked + 1;
  end;

  if v_blocked <> 2 then
    raise exception 'FAIL: anon could read customers/companies (% of 2 blocked)', v_blocked;
  end if;
  raise notice 'PASS: 3.9 anon cannot read customers/companies (public access is RPC-only)';
end
$$;

-- =============================================================================
-- SECTION 4 — PHASE 4: service records, tenant resolution, public history
-- =============================================================================
reset role;

-- Fixtures: deterministic service records for both tenants.
--   * A's Downstairs AC (5555…551) has two entries; the private marker must
--     never leave the database through the public RPC.
--   * B's boiler (6666…661) has one recent entry plus 25 older bulk rows, so the
--     public payload must cap at 20 and order newest first.
insert into public.service_records (
  id, company_id, equipment_id, service_date, service_type, technician_name,
  public_notes, private_notes, next_service_date
)
values
  (
    '77777777-7777-4777-8777-777777777771',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555551',
    '2026-09-15', 'Maintenance', 'Tech One',
    'PUBLIC_SERVICE_NOTE_TEXT', 'PRIVATE_SERVICE_MARKER_98765', '2027-09-15'
  ),
  (
    '77777777-7777-4777-8777-777777777772',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555551',
    '2026-03-10', 'Repair', 'Tech Two',
    'Older public note', 'PRIVATE_SERVICE_MARKER_98765', null
  ),
  (
    '88888888-8888-4888-8888-888888888881',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '66666666-6666-4666-8666-666666666661',
    '2026-02-10', 'Inspection', 'Bravo Tech',
    'Bravo recent public note', 'BRAVO_PRIVATE_SERVICE_MARKER', null
  )
on conflict (id) do nothing;

insert into public.service_records (equipment_id, service_date, service_type, public_notes)
select
  '66666666-6666-4666-8666-666666666661',
  date '2026-01-01' + (n || ' days')::interval,
  'Other',
  'Bulk history ' || n
from generate_series(1, 25) as n;

-- 4.1 A can select/update only its own service records and cannot touch B's.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
declare
  v_own integer;
  v_foreign integer;
  v_updated integer;
  v_deleted integer;
begin
  select count(*) into v_own
    from public.service_records
    where equipment_id = '55555555-5555-4555-8555-555555555551';
  if v_own <> 2 then
    raise exception 'FAIL: A sees % of its 2 service records', v_own;
  end if;

  select count(*) into v_foreign
    from public.service_records
    where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if v_foreign <> 0 then
    raise exception 'FAIL: A can select Company B service records (rows=%)', v_foreign;
  end if;

  update public.service_records
    set technician_name = 'Hijacked'
    where id = '88888888-8888-4888-8888-888888888881';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'FAIL: A updated a Company B service record (rows=%)', v_updated;
  end if;

  delete from public.service_records
    where id = '88888888-8888-4888-8888-888888888881';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then
    raise exception 'FAIL: A deleted a Company B service record (rows=%)', v_deleted;
  end if;

  update public.service_records
    set technician_name = 'Tech Two Edited'
    where id = '77777777-7777-4777-8777-777777777772';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'FAIL: A could not update its own service record (rows=%)', v_updated;
  end if;

  raise notice 'PASS: 4.1 A can select/update only its own service records (B is invisible)';
end
$$;

-- 4.2 A cannot insert a service record for B's equipment (trigger resolves B,
--     then RLS rejects the final row).
do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.service_records (equipment_id, service_date, service_type, public_notes)
    values (
      '66666666-6666-4666-8666-666666666661',
      current_date, 'Maintenance', 'cross-tenant attempt'
    );
  exception
    when others then
      v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'FAIL: A inserted a service record for Company B equipment';
  end if;
  raise notice 'PASS: 4.2 service record insert for another tenant''s equipment is rejected';
end
$$;

-- 4.3 A forged company_id (B) is overwritten by the BEFORE trigger: the row
--     lands with A's company, so a browser-supplied tenant id is harmless.
do $$
declare
  v_id uuid := gen_random_uuid();
  v_company uuid;
begin
  insert into public.service_records (
    id, company_id, equipment_id, service_date, service_type, technician_name
  )
  values (
    v_id,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '55555555-5555-4555-8555-555555555552',
    current_date, 'Inspection', 'Spoof Test'
  );

  select company_id into v_company
    from public.service_records
    where id = v_id;

  if v_company is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'FAIL: forged company_id survived the trigger (%)', v_company;
  end if;

  raise notice 'PASS: 4.3 forged company_id is replaced by the equipment''s company';
end
$$;

-- 4.4 A can delete its own log entries (explicit correction path).
do $$
declare
  v_id uuid;
  v_deleted integer;
begin
  insert into public.service_records (equipment_id, service_date, service_type, public_notes)
  values (
    '55555555-5555-4555-8555-555555555552',
    date '2020-01-01', 'Other', 'Throwaway entry'
  )
  returning id into v_id;

  delete from public.service_records where id = v_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'FAIL: A could not delete its own service record (rows=%)', v_deleted;
  end if;
  raise notice 'PASS: 4.4 A can delete its own service records';
end
$$;

-- 4.5 B's tenant view is isolated in both directions.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

do $$
declare
  v_own integer;
  v_foreign integer;
begin
  select count(*) into v_own
    from public.service_records
    where company_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if v_own <> 26 then
    raise exception 'FAIL: B sees % of its 26 service records', v_own;
  end if;

  select count(*) into v_foreign
    from public.service_records
    where company_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_foreign <> 0 then
    raise exception 'FAIL: B can select Company A service records (rows=%)', v_foreign;
  end if;
  raise notice 'PASS: 4.5 B sees only its own service records';
end
$$;

-- 4.6 Anonymous visitors have no table privileges on service_records.
reset role;
set local role anon;

do $$
declare
  v_blocked integer := 0;
begin
  begin
    perform 1 from public.service_records limit 1;
  exception when others then
    v_blocked := v_blocked + 1;
  end;

  if v_blocked <> 1 then
    raise exception 'FAIL: anonymous role could read service_records';
  end if;

  if has_table_privilege('anon', 'public.service_records', 'select') then
    raise exception 'FAIL: anon still holds SELECT on public.service_records';
  end if;
  if has_table_privilege('anon', 'public.service_records', 'insert')
     or has_table_privilege('anon', 'public.service_records', 'update')
     or has_table_privilege('anon', 'public.service_records', 'delete') then
    raise exception 'FAIL: anon still holds write privileges on public.service_records';
  end if;
  raise notice 'PASS: 4.6 anon has no privileges on public.service_records';
end
$$;

-- 4.7 The public RPC exposes a capped, ordered, whitelisted service history and
--     never the private notes.
do $$
declare
  v_alpha jsonb;
  v_bravo jsonb;
  v_length integer;
  v_text text;
begin
  v_alpha := public.get_public_unitpass('cccccccc-cccc-4ccc-8ccc-ccccccccccc1');
  v_bravo := public.get_public_unitpass('dddddddd-dddd-4ddd-8ddd-ddddddddddd1');

  if v_alpha is null or v_bravo is null then
    raise exception 'FAIL: public RPC returned no payload for a real token';
  end if;

  if jsonb_typeof(v_alpha -> 'service_history') is distinct from 'array' then
    raise exception 'FAIL: service_history is not an array (%)',
      jsonb_typeof(v_alpha -> 'service_history');
  end if;

  v_length := jsonb_array_length(v_alpha -> 'service_history');
  if v_length <> 2 then
    raise exception 'FAIL: A service history has % entries, expected 2', v_length;
  end if;

  if v_alpha -> 'service_history' -> 0 ->> 'service_date' is distinct from '2026-09-15' then
    raise exception 'FAIL: service history is not newest first (%)',
      v_alpha -> 'service_history' -> 0 ->> 'service_date';
  end if;
  if v_alpha -> 'service_history' -> 0 ->> 'service_type' is distinct from 'Maintenance' then
    raise exception 'FAIL: service history has the wrong service_type (%)',
      v_alpha -> 'service_history' -> 0 ->> 'service_type';
  end if;
  if v_alpha -> 'service_history' -> 0 ->> 'technician_name' is distinct from 'Tech One' then
    raise exception 'FAIL: service history has the wrong technician (%)',
      v_alpha -> 'service_history' -> 0 ->> 'technician_name';
  end if;
  if v_alpha -> 'service_history' -> 0 ->> 'public_notes' is distinct from 'PUBLIC_SERVICE_NOTE_TEXT' then
    raise exception 'FAIL: service history has the wrong public notes (%)',
      v_alpha -> 'service_history' -> 0 ->> 'public_notes';
  end if;

  if (v_alpha -> 'service_history' -> 0) ? 'private_notes' then
    raise exception 'FAIL: private_notes is present in the public service history';
  end if;
  if (v_alpha -> 'service_history' -> 0) ? 'next_service_date' then
    raise exception 'FAIL: next_service_date leaked into the public service history';
  end if;

  v_text := v_alpha::text;
  if v_text like '%PRIVATE_SERVICE_MARKER_98765%' then
    raise exception 'FAIL: private service notes leaked into the public payload';
  end if;
  if v_text like '%BRAVO_PRIVATE_SERVICE_MARKER%'
     or v_text like '%Bravo recent public note%'
     or v_text like '%Bulk history%' then
    raise exception 'FAIL: another tenant''s service history leaked into A''s payload';
  end if;
  if v_text like '%77777777-7777-4777-8777-777777777771%'
     or v_text like '%55555555-5555-4555-8555-555555555551%' then
    raise exception 'FAIL: internal identifiers leaked into the public payload';
  end if;

  v_length := jsonb_array_length(v_bravo -> 'service_history');
  if v_length <> 20 then
    raise exception 'FAIL: public service history is not capped at 20 (got %)', v_length;
  end if;
  if v_bravo -> 'service_history' -> 0 ->> 'service_date' is distinct from '2026-02-10' then
    raise exception 'FAIL: capped history is not newest first (%)',
      v_bravo -> 'service_history' -> 0 ->> 'service_date';
  end if;
  if v_bravo::text like '%PRIVATE_SERVICE_MARKER_98765%' then
    raise exception 'FAIL: A private marker leaked into B''s payload';
  end if;

  raise notice 'PASS: 4.7 public service history is ordered, capped at 20, whitelisted and private-note free';
end
$$;

reset role;

do $$
begin
  raise notice 'ALL CHECKS PASSED (Phase 1 + Phase 2 + Phase 3 + Phase 4 tenant isolation)';
end
$$;

-- Never persist fixtures.
rollback;
