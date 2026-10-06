-- =============================================================================
-- UnitPass — RLS coverage check
-- =============================================================================
-- Fails (raises an exception) if any table in `public` does not have
-- Row Level Security enabled, then prints the full table/policy inventory.
--
-- Run:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_rls_enabled.sql
-- =============================================================================

do $$
declare
  r record;
  v_missing text[] := '{}';
begin
  for r in
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
    order by c.relname
  loop
    raise notice 'public.% | rls_enabled=%', r.relname, r.relrowsecurity;
    if not r.relrowsecurity then
      v_missing := v_missing || r.relname;
    end if;
  end loop;

  if array_length(v_missing, 1) is not null then
    raise exception 'FAIL: RLS is not enabled on: %', array_to_string(v_missing, ', ');
  end if;

  raise notice 'PASS: RLS is enabled on every table in the public schema';
end
$$;

-- Inventory: which tables exist, how many policies each has, and whether anon
-- holds any table privileges (it must not).
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.policyname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relname;

select
  table_name,
  string_agg(distinct privilege_type, ', ' order by privilege_type) as anon_privileges
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
group by table_name
order by table_name;
