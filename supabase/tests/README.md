# Database tests

These scripts verify the security guarantees of the schema. They are plain SQL on purpose: Row Level
Security is a **database** behaviour, so it is tested in the database, not with a JavaScript test framework.

| File | Purpose |
|---|---|
| `rls_tenant_isolation.sql` | Proves tenant isolation. Phase 1 covers `companies`, `profiles`, `company_members`, the company-creation RPC, and anonymous access. Phase 2 covers customer select/insert/update/archive isolation and tenant-scoped search. Phase 3 covers equipment isolation, forged `company_id`/`customer_id` inserts, `public_token` immutability, the anonymous table lockout, and the `get_public_unitpass()` whitelist (no ids, no installer notes, no customer PII; unknown tokens return null). Phase 4 covers service-record select/update/delete isolation, cross-tenant equipment inserts, the trigger that overwrites a forged `company_id`, the anonymous lockout on `service_records`, and the capped/ordered public service history (private notes absent). Later phases append their own `SECTION N` blocks. |
| `check_rls_enabled.sql` | Fails if any table in `public` is missing RLS, then prints the table/policy inventory. |
| `local/postgres_shim.sql` | Optional shim that emulates the few Supabase-specific objects (`auth.users`, `auth.uid()`, `anon`/`authenticated` roles) so the two scripts above can run on a plain, disposable PostgreSQL instance. |

## Running against your Supabase project (canonical)

```bash
# from the repo root, with SUPABASE_DB_URL set to your project's connection string
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_rls_enabled.sql
```

What success looks like:

* `rls_tenant_isolation.sql` prints the Phase 1 checks, `PASS: 2.1 …` through `PASS: 2.8 …`, `PASS: 3.1 …` through
  `PASS: 3.9 …`, `PASS: 4.1 …` through `PASS: 4.7 …`, then
  `ALL CHECKS PASSED (Phase 1 + Phase 2 + Phase 3 + Phase 4 tenant isolation)`, and finishes with `ROLLBACK`. Any
  violated assertion raises an exception, psql exits non-zero, and the transaction is rolled back.
* `check_rls_enabled.sql` prints `PASS: RLS is enabled on every table in the public schema` plus the
  inventory tables.

Both scripts run inside a single transaction that ends with `ROLLBACK`, so they never leave test data
behind. They are safe to run against a project that already contains real data, but prefer a staging
project for routine checks.

## Running without Supabase credentials (offline)

`local/postgres_shim.sql` creates the Supabase-shaped objects the migration depends on. On a disposable
PostgreSQL 13+ instance:

```bash
createdb unitpass_local
psql -d unitpass_local -v ON_ERROR_STOP=1 -f supabase/tests/local/postgres_shim.sql
psql -d unitpass_local -v ON_ERROR_STOP=1 -f supabase/migrations/20261007000001_phase1_foundation.sql
psql -d unitpass_local -v ON_ERROR_STOP=1 -f supabase/migrations/20261015000001_phase2_customers.sql
psql -d unitpass_local -v ON_ERROR_STOP=1 -f supabase/migrations/20261022000001_phase3_equipment.sql
psql -d unitpass_local -v ON_ERROR_STOP=1 -f supabase/migrations/20261029000001_phase4_service_records.sql
psql -d unitpass_local -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
psql -d unitpass_local -v ON_ERROR_STOP=1 -f supabase/tests/check_rls_enabled.sql
```

The shim is **only** for local verification: never apply it to a Supabase project, where these objects
already exist.
