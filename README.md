# UnitPass

**The Digital Service Passport for HVAC Equipment.**

HVAC companies record the equipment they install. Every record gets a permanent QR code. The homeowner scans it to
open a mobile-friendly digital passport (equipment details, warranty, service history, documents, company contact and a
**Book Service** action), while the company is reminded when the unit is due for maintenance — turning installations
into repeat service revenue.

> **Where the project is today:** Phases 1–5 are implemented in code: foundation, authentication, multi-tenancy, company
> profiles, customer management, equipment records, permanent QR codes, the public UnitPass passport, and
> **service history, service tracking, and secure equipment documents**. Phase 5 requires the owner to apply its
> storage migration and verify the live public/private checks before merging/deploying (see
> [`docs/phase5-verification.md`](docs/phase5-verification.md)). Reminders and billing arrive in Phases 6–8. See
> [`prompts/README.md`](prompts/README.md) for the phase plan and agent rules.

---

## 1. Architecture

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 14.2 (App Router)** | Single app directory: **`src/app`** |
| Language | TypeScript | `pnpm typecheck` runs `tsc --noEmit` |
| Styling | **Tailwind CSS 3** + **shadcn/ui** | Components in `src/components/ui` |
| Database / Auth | **Supabase** (PostgreSQL + RLS + Auth) | Migrations in `supabase/migrations` |
| Package manager | **pnpm 9** (lockfile committed) | `packageManager: pnpm@9.15.9` |
| Node | **>= 20** (22 recommended) | `engines.node` |
| Hosting | **Vercel** | no `vercel.json` needed yet (cron is added in Phase 6) |

```
src/
  app/                     # App Router (canonical — there is no root app/ directory)
    layout.tsx             # server layout: metadata, providers, globals.css
    page.tsx               # public landing page
    providers.tsx          # client providers (toaster/sonner/tooltip)
    auth/                  # sign-in, sign-up, forgot/reset password, check-email, callback route
    dashboard/             # protected shell (server-side session check)
      customers/           # tenant-scoped customer list, create, detail, edit, archive
      equipment/           # equipment list, create, detail, service timeline, edit, QR label page
      documents/           # tenant-scoped list/filters, upload, metadata edit, signed download, delete
      services/            # service tracking: 7/30/60-day + overdue lists, Mark Serviced
      settings/            # company profile and service booking settings
    p/[token]/             # PUBLIC UnitPass + token-paired document download route (no auth, noindex)
  components/
    ui/                    # shadcn/ui primitives
    StatCard.tsx           # shared metric card (dashboard + services)
    Sidebar.tsx            # dashboard navigation (mobile-aware)
  lib/
    supabase/              # client.ts (browser) · server.ts (member) · admin.ts (server-only) · middleware.ts
    session.ts             # requireUser() / getUserMembership() / requireCompany()
    types.ts               # hand-written row types (companies, customers, equipment, service records, public payload)
    equipment.ts           # date/warranty/service formatting shared by dashboard + public page
    equipment-search.ts    # PostgREST filter for the equipment search box
    services/              # next-service-date.ts (single date math) + service-windows.ts
    queries/               # service-opportunities.ts (shared dashboard reads)
    storage/               # documents.ts: size/MIME/signature, filename and path rules
    validation/            # zod schemas for server actions + strict public document whitelist
    public/                # unitpass-url.ts (QR payload) + get-unitpass.ts (RPC reader)
    utils.ts               # cn()
  globals.css              # Tailwind entry + design tokens
scripts/
  verify-next-service-date.mjs  # month-end / interval / window assertions (pnpm verify:dates)
  verify-documents.mjs          # signatures, compensation, token route contracts; mocked I/O, no framework
middleware.ts              # session refresh + /dashboard guard
supabase/
  migrations/              # authoritative schema (timestamped, idempotent)
  tests/                   # SQL security tests (see supabase/tests/README.md)
  legacy/schema.sql.txt    # the original Dyad schema, reference only — do not run
prompts/                   # the phased development playbook
```

**Conventions**

* Writes go through **Server Actions**; the tenant (`company_id`) is always derived server-side from
  `company_members`. A `company_id` sent by the browser is never trusted.
* Supabase clients: `@supabase/ssr` (`createBrowserClient` / `createServerClient`). The deprecated
  `@supabase/auth-helpers-nextjs` is intentionally **not** used.
* The service-role key lives only in `src/lib/supabase/admin.ts` (`import 'server-only'`). Phase 5 uses it
  only after validating a public download's visibility/equipment/token pairing. Dashboard operations use the member
  client and RLS. Never add a `NEXT_PUBLIC_` prefix to this key.

---

## 2. Local development

```bash
# 1. Prerequisites: Node 20+ and pnpm 9
corepack enable --install-directory /usr/local/bin pnpm   # if pnpm is not installed

# 2. Install
pnpm install --frozen-lockfile

# 3. Configure environment
cp .env.example .env.local        # then fill in the values from section 3

# 4. Run
pnpm dev                          # http://localhost:3000
```

### Verification commands

```bash
pnpm typecheck    # TypeScript, must be clean
pnpm lint         # ESLint (next lint), must be clean
pnpm build        # production build
pnpm verify:dates # next-service-date math (month-end, leap year, windows, chips; Node 22.6+)
pnpm verify:documents # focused upload/action/download checks with mocked I/O (NOT live Storage verification)
```

Database security tests (see [`supabase/tests/README.md`](supabase/tests/README.md)) — Phases 1–5:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_rls_enabled.sql
```

---

## 3. Supabase setup (required before the app can sign anyone in)

1. **Create a project** at [supabase.com](https://supabase.com) and copy from *Project Settings → API*:
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` into `.env.local`.
2. **Copy the connection string** (*Project Settings → Database → Connection string → URI*) into `SUPABASE_DB_URL`
   (used only by the migration/test scripts, never by the app at runtime).
3. **Apply the migrations** (authoritative schema) in order:

   ```bash
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261007000001_phase1_foundation.sql
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261015000001_phase2_customers.sql
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261022000001_phase3_equipment.sql
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261029000001_phase4_service_records.sql
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261105000001_phase5_documents.sql
   ```

   Or paste each file into the Supabase SQL editor in the same order. All migrations are idempotent. Phase 1 also
   repairs a database where the legacy `supabase/legacy/schema.sql.txt` was applied earlier; Phase 2 adds the customer
   archive field, tenant policies, and company service booking URL without deleting existing data; Phase 3 creates the
   equipment table, backfills a permanent `public_token` for existing rows, and installs the public RPC without
   deleting anything; Phase 4 creates `service_records`, backfills its denormalised `company_id` from equipment (and
   stops loudly if orphan rows make that impossible), and extends the public RPC with the capped service history.
   Phase 5 adds document metadata, tenant/path enforcement, the private `documents` bucket and Storage policies,
   and the public document whitelist. It must run as a role permitted to manage Storage policies (normally
   the Supabase SQL editor/database owner). See the storage setup below; a failed transaction is NOT an applied migration.
4. **Verify the security guarantees** by running the two scripts in `supabase/tests/` (section 2).
5. **Auth URLs** — in *Authentication → URL Configuration*:
   * *Site URL*: `http://localhost:3000` for dev, your production domain later.
   * *Redirect URLs*: add `${NEXT_PUBLIC_SITE_URL}/auth/callback` and `${NEXT_PUBLIC_SITE_URL}/auth/reset-password`
     (`http://localhost:3000/**` is acceptable for local development).
6. **Email confirmation** — *Authentication → Providers → Email*. Keep it **on** for production. For faster local
   testing you may turn it off; the app handles both (it detects an immediate session after sign-up and goes straight
   to the dashboard).

### What the database guarantees (Phases 1–5)

| Table | Contents | Access |
|---|---|---|
| `companies` | one row per HVAC company (tenant), including company contact details, booking URL, and default service interval | members read; admins update; **no direct insert** — companies are only created by `create_company_with_owner()` |
| `profiles` | 1:1 with `auth.users` (auto-created by a trigger) | a user reads/updates only their own row |
| `company_members` | user ↔ company + role (`owner`/`admin`/`technician`) | members read their company's members; admins manage them |
| `customers` | company-owned contact records with `archived_at` soft archive | members read/insert/update only their company; hard-delete policy is reserved for a future explicit purge, and the app never hard-deletes |
| `equipment` | company-owned installed units, service dates, public/private notes, and a permanent `public_token` | members read/insert/update only their company; **no delete privilege or policy** — units are retired with `status = 'Replaced'` so printed QR codes keep working |
| `service_records` | company-owned service visits: date, type, technician, public notes, private notes, next service date | members read/insert/update/delete only their company (delete is the explicit mistake-correction path); `company_id` is resolved from `equipment` by a trigger, never trusted from the browser |
| `documents` | equipment-level metadata and a private storage key (never a public URL) | members manage only their company; trigger derives tenant, enforces immutable file/equipment pairing, and a constraint validates the tenant/equipment storage prefix |

* RLS is enabled on all seven tables; `anon` has **no** privileges on them.
* `equipment.public_token` is generated by the database (`gen_random_uuid()`), is unique, and an immutability trigger
  rejects any attempt to change it. A trigger also refuses an equipment row whose `customer_id` belongs to another
  company.
* The **only** anonymous database access is `public.get_public_unitpass(uuid)`, a `SECURITY DEFINER` function that
  returns an explicit whitelist (company contact + equipment identity, warranty, public notes, status, and the latest
  20 service entries with only `service_date`, `service_type`, `technician_name` and `public_notes`, plus public
  documents containing only `id`, `name`, `type`). Only document ids are allowed, for the token-paired download
  route. It never returns tenant/equipment/customer ids, storage paths, `installer_notes`, `private_notes`, or customer PII, and returns `NULL` for unknown tokens.
* `service_records.company_id` is overwritten on every insert/update by `set_service_record_company()`, which reads the
  parent equipment row. A forged tenant id from the browser is therefore harmless, and RLS validates the resolved row.
* `public.is_company_member()` / `public.is_company_admin()` are `SECURITY DEFINER` helpers used by the policies —
  this is what prevents the "infinite recursion detected in policy" failure of the legacy schema.
* `company_members` is the source of truth for tenancy; `profiles.company_id` is only a convenience pointer.

---

## 4. Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | Canonical origin used for auth redirects **and QR payloads** (`${NEXT_PUBLIC_SITE_URL}/p/<token>`). Set it to the real production domain **before** printing any labels. |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anonymous key (RLS-protected) |
| `SUPABASE_DB_URL` | dev/CI only | Postgres connection string for migration and test scripts |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Token-validated public document downloads; set in server environment, NEVER `NEXT_PUBLIC_` or browser code |

Rules: only variable **names** live in `.env.example`; real values go in `.env.local` (gitignored) or the hosting
provider's environment settings. A missing public variable fails fast at runtime with a message naming the variable —
the production build itself does not require credentials.

**Deployment (Vercel):** import the repository, set the variables above for each environment, and deploy. No
`vercel.json` is required in Phase 1.

---

### Public UnitPass and QR codes (Phase 3)

* `/p/<token>` is public, mobile-first, server-rendered (`force-dynamic`), marked `noindex, nofollow`, and ships no
  authentication. It reads **only** through `get_public_unitpass()` — never `select *` from `equipment`.
* `/dashboard/equipment/<id>/qr` renders the QR (error correction level M, 1024 px PNG), a **Download PNG** button, a
  **Copy public link** button and a print-only label. The dashboard equipment detail page also shows the public link.
* The QR payload is built in one place: `src/lib/public/unitpass-url.ts` → `${NEXT_PUBLIC_SITE_URL}/p/<token>`.
  **Set `NEXT_PUBLIC_SITE_URL` to the production origin before printing labels.** Changing it later does not fix
  QR codes that are already printed — always print from the production deployment.
* Every status keeps the passport reachable: `Active` shows the normal passport, `Inactive` adds a
  "not currently in service" notice, `Replaced` adds a replacement notice plus company contact details. Unknown or
  malformed tokens render a generic 404.

### Service history and service tracking (Phase 4)

* `/dashboard/services` is the office working list: summary cards (total customers, active equipment, due soon within
  30 days, overdue) plus **Next 7 / 30 / 60 days**, **Overdue** and **All scheduled** windows. Replaced units are
  excluded by default and can be included with a toggle.
* **Mark serviced** logs a visit (`Maintenance` by default) and moves `equipment.next_service_date` forward by
  `equipment.service_interval ?? company.default_service_interval ?? 12` months. The default path is one click; a
  Customize dialog can override the date, type, technician, notes and interval. The toast shows the new date.
* The equipment detail page shows the service timeline (newest first) with inline create/edit dialogs and an explicit
  confirmation before deleting a log entry. Private notes are labelled "Private — never shown on UnitPass".
* Next-service math lives in exactly one helper, `src/lib/services/next-service-date.ts` (date-fns `addMonths`), so
  Phase 6 reminders and this dashboard cannot disagree. Month-end visits clamp instead of producing invalid dates
  (31 Jan + 1 month = 28/29 Feb); `pnpm verify:dates` asserts the exact results.
* The public passport adds a **Last service** line and a **Service history** timeline (date, type, technician, public
  notes) and hides both when no visits exist. `private_notes` is absent from the RPC payload and the client parser
  fails closed if it ever appears.

### Documents and private storage (Phase 5)

* Use **Documents** in the sidebar for the company-wide list (equipment/type/visibility filters and pagination).
  The primary upload entry is **Equipment → unit → Documents → Upload document**. Cards are used below `md`.
* Upload one PDF, JPEG, PNG or WEBP, maximum **15 MB (15,728,640 bytes)**. The Server Action checks session,
  membership, equipment ownership, size, extension, declared MIME **and magic bytes**. HTML/SVG are rejected.
  Filenames are ASCII-sanitized to 120 characters and keys are
  `{company_id}/{equipment_id}/{random_uuid}-{sanitized_name}`. Failed row inserts trigger object cleanup.
* **Private** is the default, labelled “Private — never shown on UnitPass”. Public uploads/visibility changes
  require an acknowledgement. The server checks this too. All existing roles (`owner`, `admin`, `technician`)
  may manage their own company's documents; Storage write policies explicitly check these roles.
* Dashboard downloads use member-RLS signed links. Public download links go through
  `/p/{token}/documents/{documentId}`: visibility + exact equipment/token + tenant/path pairing are checked
  server-side before signing. Failures return plain **404**, successes **307**, always **no-store**.
  Replaced units keep historical public documents, matching the existing replaced passport behaviour.
* Signed URLs expire after **300 seconds**. Making a document private removes it from the uncached public
  payload immediately; already-issued links may work for the remaining five minutes. Files already downloaded
  cannot be recalled. No permanent URL is saved or rendered on the passport.
* Delete requires confirmation, removes the storage object first, then the metadata. If storage deletion fails,
  the row is kept. If row deletion fails after removing bytes, the UI explicitly asks the user to retry Delete;
  the same key can safely be removed again. Equipment/customer records are never deleted.

#### Bucket/policy setup (owner required)

The Phase 5 migration creates/updates the bucket **via SQL**. Apply it using the Supabase SQL editor or
`psql` as the project `postgres` role. It sets `documents` to **private**, including if an older bucket was public.
Never enable “Public bucket” and never use `getPublicUrl()` for these files.

If Storage DDL is unavailable to the CLI credentials, the owner must use the Dashboard:

1. **Storage → New bucket** (or edit existing) → name/id **`documents`** → **Public bucket OFF**.
2. Bucket configuration → maximum file size **15 MB / 15728640 bytes** → allowed MIME types exactly:
   `application/pdf`, `image/jpeg`, `image/png`, `image/webp`. The project-level file size limit must be at least 15 MB.
3. **SQL editor**, with the database role set to **`postgres`**: run `20261105000001_phase5_documents.sql` in full. If policy ownership
   prevents it, resolve that permission with the project owner before deploying; do not consider a rolled-back
   migration applied. The SQL installs the table, `set_documents_company()` and
   `can_access_document_storage(text, boolean)` helpers as well as the public RPC.
4. **Storage → Policies → documents**: verify these exact policies (the migration creates them; manual recreation
   uses these expressions). All grant policies target **`authenticated` only**, never `anon`/`public`:

   | Policy | Operation | USING | WITH CHECK |
   |---|---|---|---|
   | `documents_select_members` | SELECT | `bucket_id = 'documents' and public.can_access_document_storage(name, false)` | — |
   | `documents_insert_members` | INSERT | — | `bucket_id = 'documents' and public.can_access_document_storage(name, true)` |
   | `documents_update_members` | UPDATE | `bucket_id = 'documents' and public.can_access_document_storage(name, true)` | same expression |
   | `documents_delete_members` | DELETE | `bucket_id = 'documents' and public.can_access_document_storage(name, true)` | — |

   Also verify `documents_member_fence`: **RESTRICTIVE**, ALL, `authenticated`, both expressions
   `bucket_id <> 'documents' or public.can_access_document_storage(name, true)`. It fences older broad
   authenticated policies without affecting other buckets. No anonymous access policy is created.
5. Audit **all** existing `storage.objects` policies, not just those named `documents_*`:
   permissive policies combine with OR. Remove/narrow any old `anon`/`public` grant that could include this bucket,
   then run the SQL suite and the live HTTP checks in [`docs/phase5-verification.md`](docs/phase5-verification.md).
   A private bucket flag alone does not replace RLS for authenticated/API access.

#### If SQL reports `42501: must be owner of table objects`

An earlier copy of Phase 5 incorrectly ran `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`.
Supabase owns that managed table; its hosted `postgres` role can manage policies but cannot alter the table.
The corrected migration **reads** `pg_class.relrowsecurity` instead, and stops if RLS is not enabled.
It still creates all four authenticated access policies and the restrictive tenant fence.

1. Use the updated `supabase/migrations/20261105000001_phase5_documents.sql`.
2. Open **SQL editor**, select database role **`postgres`**, and run the **whole file**, not just the policy tail.
   The original file is wrapped in `BEGIN`/`COMMIT`; a failure before commit rolls the transaction back.
   If your client retains an aborted transaction, run `ROLLBACK;` before retrying. It is safe to rerun this
   idempotent migration; no customer rows or files are removed.
3. Confirm the managed table's existing setting with this read-only query (expect `true`):

   ```sql
   select relrowsecurity
   from pg_catalog.pg_class
   where oid = 'storage.objects'::regclass;
   ```

Do not change `storage.objects` ownership, grant yourself an internal Supabase role, disable RLS, or skip the
Storage policies. If policy creation itself still fails as `postgres`, use **Storage → Policies** / project
support; keep deployment blocked until the exact policies above and the security tests are verified.

#### Legacy documents and hosting limits

Existing `file_url` values are preserved but **deprecated and never read**. No arbitrary external URL is fetched
or converted into a trusted private path. Tenant ids are backfilled from equipment; orphan references stop the
migration with a descriptive error and a complete rollback. Legacy records lacking private storage metadata are
excluded from public payloads and cannot be edited/downloaded until re-uploaded. A `NOT VALID` check retains old
rows while requiring full valid metadata for every new/updated row. Fresh tables have non-null storage metadata.
Re-upload the file, verify the new private/public choice, then delete the old metadata entry if desired. External
legacy URLs may still exist at their original host; only that host's owner can revoke them.

Next's Server Action multipart limit is **16 MB** (file + form overhead); the file/bucket limit remains 15 MB.
The hosting proxy/function must also allow the request. **Vercel Functions have a 4.5 MB request-body limit**:
full-size 15 MB Server Action uploads need a host with a larger limit, or an owner-approved future change to a
signed direct-to-Storage upload/finalization flow. Do not assume the Next setting overrides a host's limit.

## 5. Phase workflow (for the owner and for AI agents)

Development is split into eight phases, one branch each, merged by the owner:

```
main → phase/01-foundation → owner reviews → merge into main
     → phase/02-customers   → owner reviews → merge into main   → …
```

Branches: `phase/01-foundation`, `phase/02-customers`, `phase/03-unitpass-qr`, `phase/04-service-history`,
`phase/05-documents`, `phase/06-reminders`, `phase/07-billing`, `phase/08-production`.

To run a phase, open a new agent session and say **"Complete Phase N"**. The agent is required to read
[`prompts/README.md`](prompts/README.md), then [`prompts/prompt-phaseN.md`](prompts), verify the previous phases are in
`main`, branch from the latest `main`, implement only that phase, run the verification commands, and finish with a
PHASE COMPLETION REPORT including `SAFE TO MERGE: YES/NO`.

Rules that apply to every phase: never merge or push to `main`, never delete a phase branch, never commit secrets,
never expose private data on public pages, and never build features from a later phase.

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Missing NEXT_PUBLIC_SUPABASE_URL` | `.env.local` is absent or incomplete — copy `.env.example` and fill it in, then restart `pnpm dev`. |
| Sign-up email never arrives | Check *Authentication → URL Configuration* redirect URLs and the email template; check spam; the Supabase built-in SMTP is rate-limited (a custom SMTP is needed for real use). |
| Sign-in works but `/dashboard` bounces to sign-in | The session cookie is not being set (wrong `NEXT_PUBLIC_SUPABASE_URL`) or the middleware matcher was edited. |
| Password reset link → "Link expired" | The link was already used, expired, or the `redirectTo` URL is not allowlisted in Supabase. |
| `permission denied for table …` in tests | You are running the isolation test as a role that cannot `set role authenticated`; run it as the migration owner (`postgres`). |
| `42501: must be owner of table objects` during Phase 5 | Use the corrected migration, which checks RLS without altering Supabase's managed table; run the whole file as `postgres`. See the Phase 5 troubleshooting steps above. |
| `infinite recursion detected in policy` | The legacy schema is still applied — run the Phase 1 migration, which replaces those policies. |

---

## 7. Repository history note

This repository started as a Dyad-generated Vite/React scaffold with a partially migrated Next.js App Router app.
Phase 1 removed the conflicting scaffold (root `app/`, `src/pages/`, Vite config files, the committed `.next/` build
output, the SPA `vercel.json`) and made `src/app` canonical. The old schema is preserved for reference at
`supabase/legacy/schema.sql.txt`; it is not runnable and must not be applied.
