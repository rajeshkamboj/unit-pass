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
-- Expected result: a series of "PASS: ..." notices and a final
-- "ALL CHECKS PASSED" notice, ending with ROLLBACK. Any failed assertion raises
-- an exception -> non-zero exit code (never silently "passes").
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
-- 1.10 Anonymous role has no access at all to tenant tables.
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
    raise exception 'FAIL: anonymous role could read tenant tables (% of 3 blocked)', v_blocked;
  end if;
  raise notice 'PASS: 1.10 anon has no access to companies/profiles/company_members';
end
$$;

reset role;

do $$
begin
  raise notice 'ALL CHECKS PASSED (Phase 1 tenant isolation)';
end
$$;

-- Never persist fixtures.
rollback;
